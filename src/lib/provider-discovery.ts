import {
  NostrEventValidationError,
  type NostrPublicKey,
  type SignedNostrEvent,
} from "../domain/nostr";
import { parseSignedNostrEvent, verifySignedNostrEvent } from "../domain/nostr";
import type { ServiceCapability, RequesterPolicy } from "../domain/pact-agents";
import type { Sats } from "../domain/money";
import {
  parsePontmoreAgentDefinitionEvent,
  PontmoreAgentDefinitionError,
  type PontmoreAgentDefinition,
} from "../domain/pontmore-agent";
import {
  isCashuEscrowCompatible,
  parsePontmoreEscrowDescriptorReference,
  PontmoreEscrowDescriptorError,
  type PontmoreEscrowDescriptor,
} from "../domain/pontmore-escrow";
import {
  PACTAGENT_DOCUMENT_SUMMARY_CAPABILITY_ID,
  resolveOfferAddressFromPricingPolicy,
  type PactServiceOffer,
} from "../domain/pact-service-offer";
import type { NostrFilter, NostrRelayAdapter, NostrRelayPublishOptions } from "./nostr-relay";
import { isTimeoutError, operationOptions } from "./pontmore-publication-helpers";
import {
  PactServiceOfferPublicationError,
  retrievePactServiceOffer,
} from "./pact-service-offer-publication";
import {
  Pip01PublicationError,
  retrieveCashuEscrowDescriptor,
} from "./pontmore-escrow-publication";

/*
 * Relay-backed provider discovery.
 *
 * Discovery answers "who is compatible and should be selected" from live
 * Pontmore PIP-00 data plus PactAgent's application-owned signed service offer.
 * It does not create a service agreement, imply bilateral consent, advance
 * lifecycle state, authorize settlement, or let AI output perform an economic
 * action. The selected provider must still separately accept the later
 * PactAgent service-agreement root (#10).
 *
 * The pipeline keeps three decisions distinct:
 *   1. Is this a valid signed Pontmore agent definition? (NIP-01 + PIP-00)
 *   2. Does it describe a provider compatible with the requested capability?
 *   3. Does the requester's deterministic economic policy authorize the
 *      provider's current signed offer?
 */

export const PIP00_PROFILE_DISCOVERY_TIMEOUT_MS = 10_000;
export const DEFAULT_DISCOVERY_MAX_PROFILES = 100;
export const DEFAULT_DISCOVERY_MAX_RESOLUTIONS = 200;

export interface DiscoveryBounds {
  readonly maxProfiles: number;
  readonly maxResolutions: number;
}

/*
 * Optional per-provider application constraints evaluated after the offer is
 * resolved. These mirror the provider-side checks in evaluateServiceOffer so
 * discovery's authorization is not weaker than the local fixture path.
 */
export interface ProviderConstraints {
  readonly minimumPriceSats: Sats;
  readonly maximumExecutionDurationSeconds: number;
}

export type DiscoveryRejectionCategory =
  | "invalid_nostr_event"
  | "invalid_pip00_profile"
  | "capability_mismatch"
  | "settlement_network_not_allowed"
  | "missing_offer"
  | "invalid_offer"
  | "offer_identity_mismatch"
  | "offer_capability_mismatch"
  | "offer_escrow_mismatch"
  | "offer_not_active"
  | "offer_expired"
  | "missing_descriptor"
  | "invalid_descriptor"
  | "descriptor_identity_mismatch"
  | "escrow_incompatible"
  | "budget_exceeded"
  | "provider_price_limit_exceeded"
  | "below_provider_minimum"
  | "provider_execution_limit_exceeded"
  | "duration_rejected"
  | "discovery_truncated";

export interface DiscoveryRejection {
  readonly providerPublicKey: string | undefined;
  readonly category: DiscoveryRejectionCategory;
  readonly reason: string;
}

export interface AuthorizedProviderCandidate {
  readonly providerPublicKey: NostrPublicKey;
  readonly definition: PontmoreAgentDefinition<SignedNostrEvent>;
  readonly offer: PactServiceOffer<SignedNostrEvent>;
  readonly escrowDescriptor: PontmoreEscrowDescriptor<SignedNostrEvent>;
}

export interface SelectedProviderReferences {
  readonly providerPublicKey: NostrPublicKey;
  readonly providerDefinitionReference: string;
  readonly escrowDescriptorReference: string;
  readonly offerReference: string;
}

export interface DiscoverySelection {
  readonly selected: SelectedProviderReferences;
  readonly candidate: AuthorizedProviderCandidate;
}

export interface DiscoveryResult {
  readonly candidates: readonly AuthorizedProviderCandidate[];
  readonly selected: DiscoverySelection | undefined;
  readonly rejections: readonly DiscoveryRejection[];
}

export type DiscoveryErrorCode = "profile_query_failed" | "profile_query_timeout";

export class DiscoveryError extends Error {
  readonly code: DiscoveryErrorCode;

  constructor(code: DiscoveryErrorCode, message: string) {
    super(message);
    this.name = "DiscoveryError";
    this.code = code;
  }
}

export interface DiscoverProvidersInput {
  readonly requesterPolicy: RequesterPolicy;
  readonly capability: ServiceCapability;
  readonly relay: NostrRelayAdapter;
  readonly now: number;
  readonly bounds?: Partial<DiscoveryBounds>;
  readonly options?: NostrRelayPublishOptions;
  readonly providerConstraints?: ReadonlyMap<string, ProviderConstraints>;
  /*
   * Optional advisory preference among ALREADY-AUTHORIZED candidates only. It
   * can never authorize a rejected offer and only breaks ties after the
   * deterministic price and execution-duration ordering. When omitted, the
   * provider public key ascending is the final stable tie-break. Relay order,
   * arrival time, and AI preference never determine the economic result.
   */
  readonly advisoryPreferredProviders?: readonly string[];
}

const CAPABILITY_PROFILE_BY_CAPABILITY: Readonly<Record<ServiceCapability, string>> = {
  "document-summary": PACTAGENT_DOCUMENT_SUMMARY_CAPABILITY_ID,
};

function rejection(
  providerPublicKey: string | undefined,
  category: DiscoveryRejectionCategory,
  reason: string,
): DiscoveryRejection {
  return { providerPublicKey, category, reason };
}

function profileDiscoveryFilter(maxProfiles: number): NostrFilter {
  return {
    kinds: [30360],
    tags: { t: ["agent"] },
    limit: maxProfiles,
  };
}

/*
 * Group raw profile events by their declared pubkey so duplicate or
 * multi-version events for one identity cannot crowd other providers out of
 * the bounded profile window. Returns groups in insertion order; each group is
 * sorted newest-first (created_at desc, then id asc) so the current valid
 * profile can be selected by replacement ordering.
 */
function groupProfilesByPubkey(
  events: readonly SignedNostrEvent[],
): readonly { readonly pubkey: string; readonly events: readonly SignedNostrEvent[] }[] {
  const groups = new Map<string, SignedNostrEvent[]>();
  for (const event of events) {
    if (typeof event.pubkey !== "string") continue;
    const list = groups.get(event.pubkey);
    if (list) list.push(event);
    else groups.set(event.pubkey, [event]);
  }
  return [...groups.entries()].map(([pubkey, groupEvents]) => ({
    pubkey,
    events: [...groupEvents].sort((left, right) => {
      const timestampOrder = right.created_at - left.created_at;
      return timestampOrder === 0 ? left.id.localeCompare(right.id) : timestampOrder;
    }),
  }));
}

function mapOfferRetrievalError(error: unknown): DiscoveryRejectionCategory {
  if (error instanceof PactServiceOfferPublicationError) {
    switch (error.code) {
      case "offer_not_found":
      case "retrieval_failure":
      case "timeout":
        return "missing_offer";
      case "address_mismatch":
        return "offer_identity_mismatch";
      case "invalid_signature":
      case "invalid_nip01":
      case "invalid_offer":
      case "signing_failure":
      case "publication_failure":
        return "invalid_offer";
    }
  }
  return "invalid_offer";
}

function mapDescriptorRetrievalError(error: unknown): DiscoveryRejectionCategory {
  if (error instanceof Pip01PublicationError) {
    switch (error.code) {
      case "descriptor_not_found":
      case "retrieval_failure":
      case "timeout":
        return "missing_descriptor";
      case "descriptor_agent_mismatch":
        return "descriptor_identity_mismatch";
      case "invalid_signature":
      case "invalid_nip01":
      case "invalid_descriptor":
      case "signing_failure":
      case "publication_failure":
        return "invalid_descriptor";
    }
  }
  return "invalid_descriptor";
}

async function resolveProfile(
  raw: SignedNostrEvent,
): Promise<PontmoreAgentDefinition<SignedNostrEvent> | { rejection: DiscoveryRejection }> {
  let parsed: SignedNostrEvent;
  try {
    parsed = parseSignedNostrEvent(raw);
  } catch (error) {
    if (error instanceof NostrEventValidationError) {
      return { rejection: rejection(undefined, "invalid_nostr_event", error.message) };
    }
    return { rejection: rejection(undefined, "invalid_nostr_event", "PIP-00 profile is not a valid NIP-01 event") };
  }
  try {
    verifySignedNostrEvent(parsed);
  } catch (error) {
    if (error instanceof NostrEventValidationError) {
      return {
        rejection: rejection(
          parsed.pubkey,
          "invalid_nostr_event",
          "PIP-00 profile signature is invalid",
        ),
      };
    }
    return { rejection: rejection(parsed.pubkey, "invalid_nostr_event", "PIP-00 profile signature verification failed") };
  }
  try {
    return parsePontmoreAgentDefinitionEvent(parsed);
  } catch (error) {
    if (error instanceof PontmoreAgentDefinitionError) {
      return { rejection: rejection(parsed.pubkey, "invalid_pip00_profile", error.message) };
    }
    return { rejection: rejection(parsed.pubkey, "invalid_pip00_profile", "PIP-00 profile is invalid") };
  }
}

function evaluateCapabilityCompatibility(
  definition: PontmoreAgentDefinition<SignedNostrEvent>,
  capability: ServiceCapability,
  requesterPolicy: RequesterPolicy,
): DiscoveryRejection | undefined {
  if (!definition.content.capabilities.names.includes(capability)) {
    return rejection(
      definition.event.pubkey,
      "capability_mismatch",
      "Provider does not advertise the requested capability",
    );
  }
  const supportsAllowedSettlement = definition.content.capabilities.settlement_networks.some((network) =>
    requesterPolicy.allowedSettlementNetworks.includes(network as "cashu"),
  );
  if (!supportsAllowedSettlement) {
    return rejection(
      definition.event.pubkey,
      "settlement_network_not_allowed",
      "Provider does not advertise a requester-allowed settlement network",
    );
  }
  return undefined;
}

async function resolveOffer(
  definition: PontmoreAgentDefinition<SignedNostrEvent>,
  relay: NostrRelayAdapter,
  options: NostrRelayPublishOptions | undefined,
): Promise<PactServiceOffer<SignedNostrEvent> | { rejection: DiscoveryRejection }> {
  /*
   * resolveOfferAddressFromPricingPolicy validates that pricing_policy is a
   * canonical service-offer address owned by the provider. The pricing_policy
   * string itself is the canonical address, so it can be passed directly to
   * retrieval without reconstruction.
   */
  try {
    resolveOfferAddressFromPricingPolicy(
      definition.content.pricing_policy,
      definition.event.pubkey,
    );
  } catch {
    return {
      rejection: rejection(
        definition.event.pubkey,
        "missing_offer",
        "PIP-00 pricing_policy does not resolve to a provider-owned service offer",
      ),
    };
  }

  try {
    const offer = await retrievePactServiceOffer(definition.content.pricing_policy, relay, options);
    return offer;
  } catch (error) {
    return {
      rejection: rejection(definition.event.pubkey, mapOfferRetrievalError(error), "Service offer could not be resolved"),
    };
  }
}

function crossValidateOffer(
  definition: PontmoreAgentDefinition<SignedNostrEvent>,
  offer: PactServiceOffer<SignedNostrEvent>,
  capability: ServiceCapability,
  requesterPolicy: RequesterPolicy,
  now: number,
): DiscoveryRejection | undefined {
  if (offer.event.pubkey !== definition.event.pubkey || offer.content.provider !== definition.event.pubkey) {
    return rejection(definition.event.pubkey, "offer_identity_mismatch", "Service offer is not signed by the provider");
  }
  const expectedProfileId = CAPABILITY_PROFILE_BY_CAPABILITY[capability];
  if (offer.content.capability_profile.id !== expectedProfileId) {
    return rejection(definition.event.pubkey, "offer_capability_mismatch", "Service offer targets a different capability profile");
  }
  if (offer.content.escrow_descriptor !== definition.content.escrow) {
    return rejection(definition.event.pubkey, "offer_escrow_mismatch", "Service offer escrow reference does not match the provider definition");
  }
  if (!requesterPolicy.allowedSettlementNetworks.includes(offer.content.settlement_network)) {
    return rejection(definition.event.pubkey, "settlement_network_not_allowed", "Service offer settlement network is not allowed");
  }
  if (now < offer.content.valid_from) {
    return rejection(definition.event.pubkey, "offer_not_active", "Service offer is not yet valid");
  }
  if (now > offer.content.expires_at) {
    return rejection(definition.event.pubkey, "offer_expired", "Service offer has expired");
  }
  return undefined;
}

async function resolveDescriptor(
  definition: PontmoreAgentDefinition<SignedNostrEvent>,
  relay: NostrRelayAdapter,
  options: NostrRelayPublishOptions | undefined,
): Promise<PontmoreEscrowDescriptor<SignedNostrEvent> | { rejection: DiscoveryRejection }> {
  let escrowReference;
  try {
    escrowReference = parsePontmoreEscrowDescriptorReference(definition.content.escrow);
  } catch (error) {
    if (error instanceof PontmoreEscrowDescriptorError) {
      return {
        rejection: rejection(definition.event.pubkey, "invalid_descriptor", "PIP-00 escrow reference is malformed"),
      };
    }
    return { rejection: rejection(definition.event.pubkey, "invalid_descriptor", "PIP-00 escrow reference is invalid") };
  }
  if (escrowReference.publicKey !== definition.event.pubkey) {
    return {
      rejection: rejection(definition.event.pubkey, "descriptor_identity_mismatch", "PIP-01 escrow descriptor is not owned by the provider"),
    };
  }

  try {
    const descriptor = await retrieveCashuEscrowDescriptor(definition.content.escrow, relay, options);
    return descriptor;
  } catch (error) {
    return {
      rejection: rejection(definition.event.pubkey, mapDescriptorRetrievalError(error), "PIP-01 escrow descriptor could not be resolved"),
    };
  }
}

function crossValidateDescriptor(
  descriptor: PontmoreEscrowDescriptor<SignedNostrEvent>,
): DiscoveryRejection | undefined {
  if (!isCashuEscrowCompatible(descriptor)) {
    return { providerPublicKey: descriptor.event.pubkey, category: "escrow_incompatible", reason: "PIP-01 descriptor is not Cashu-compatible" };
  }
  return undefined;
}

function evaluateEconomicPolicy(
  offer: PactServiceOffer<SignedNostrEvent>,
  requesterPolicy: RequesterPolicy,
  providerConstraints: ProviderConstraints | undefined,
): DiscoveryRejection | undefined {
  if (offer.amountSats > requesterPolicy.maxBudgetSats) {
    return rejection(offer.content.provider, "budget_exceeded", "Service offer exceeds the requester budget");
  }
  if (offer.amountSats > requesterPolicy.maximumProviderPriceSats) {
    return rejection(offer.content.provider, "provider_price_limit_exceeded", "Service offer exceeds the requester provider-price ceiling");
  }
  if (providerConstraints && offer.amountSats < providerConstraints.minimumPriceSats) {
    return rejection(offer.content.provider, "below_provider_minimum", "Service offer is below the provider minimum price");
  }
  if (offer.content.maximum_execution_seconds > requesterPolicy.maximumEscrowDurationSeconds) {
    return rejection(offer.content.provider, "duration_rejected", "Service offer execution duration exceeds the requester escrow duration");
  }
  if (
    providerConstraints &&
    offer.content.maximum_execution_seconds > providerConstraints.maximumExecutionDurationSeconds
  ) {
    return rejection(offer.content.provider, "provider_execution_limit_exceeded", "Service offer execution duration exceeds the provider execution limit");
  }
  return undefined;
}

function compareAuthorizedCandidates(
  advisory: readonly string[] | undefined,
): (left: AuthorizedProviderCandidate, right: AuthorizedProviderCandidate) => number {
  return (left, right) => {
    if (left.offer.amountSats !== right.offer.amountSats) {
      return left.offer.amountSats < right.offer.amountSats ? -1 : 1;
    }
    const leftDuration = left.offer.content.maximum_execution_seconds;
    const rightDuration = right.offer.content.maximum_execution_seconds;
    if (leftDuration !== rightDuration) {
      return leftDuration < rightDuration ? -1 : 1;
    }
    if (advisory) {
      const leftIndex = advisory.indexOf(left.providerPublicKey);
      const rightIndex = advisory.indexOf(right.providerPublicKey);
      const leftRank = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const rightRank = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
      if (leftRank !== rightRank) {
        return leftRank < rightRank ? -1 : 1;
      }
    }
    return left.providerPublicKey < right.providerPublicKey ? -1 : left.providerPublicKey > right.providerPublicKey ? 1 : 0;
  };
}

export async function discoverProviders(input: DiscoverProvidersInput): Promise<DiscoveryResult> {
  const maxProfiles = input.bounds?.maxProfiles ?? DEFAULT_DISCOVERY_MAX_PROFILES;
  const maxResolutions = input.bounds?.maxResolutions ?? DEFAULT_DISCOVERY_MAX_RESOLUTIONS;
  if (!Number.isInteger(maxProfiles) || maxProfiles < 1) {
    throw new DiscoveryError("profile_query_failed", "Discovery bounds maxProfiles must be a positive integer");
  }
  if (!Number.isInteger(maxResolutions) || maxResolutions < 0) {
    throw new DiscoveryError("profile_query_failed", "Discovery bounds maxResolutions must be a non-negative integer");
  }
  if (!input.requesterPolicy.allowedCapabilities.includes(input.capability)) {
    return { candidates: [], selected: undefined, rejections: [] };
  }

  let rawProfiles: readonly SignedNostrEvent[];
  try {
    rawProfiles = await input.relay.queryEvents(
      profileDiscoveryFilter(maxProfiles),
      operationOptions(PIP00_PROFILE_DISCOVERY_TIMEOUT_MS, input.options),
    );
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new DiscoveryError("profile_query_timeout", "PIP-00 profile discovery query timed out");
    }
    throw new DiscoveryError("profile_query_failed", "PIP-00 profile discovery query failed");
  }

  const groupedProfiles = groupProfilesByPubkey(rawProfiles).slice(0, maxProfiles);
  const rejections: DiscoveryRejection[] = [];
  const candidates: AuthorizedProviderCandidate[] = [];
  let resolutionsRemaining = maxResolutions;

  for (const group of groupedProfiles) {
    let definition: PontmoreAgentDefinition<SignedNostrEvent> | undefined;
    let groupRejection: DiscoveryRejection | undefined;
    for (const raw of group.events) {
      const profile = await resolveProfile(raw);
      if ("rejection" in profile) {
        if (!groupRejection) groupRejection = profile.rejection;
        continue;
      }
      definition = profile;
      break;
    }
    if (!definition) {
      if (groupRejection) rejections.push(groupRejection);
      continue;
    }

    const capabilityRejection = evaluateCapabilityCompatibility(definition, input.capability, input.requesterPolicy);
    if (capabilityRejection) {
      rejections.push(capabilityRejection);
      continue;
    }

    if (resolutionsRemaining < 2) {
      rejections.push(rejection(definition.event.pubkey, "discovery_truncated", "Discovery resolution budget exhausted before this provider"));
      continue;
    }
    resolutionsRemaining -= 2;

    const offerResult = await resolveOffer(definition, input.relay, input.options);
    if ("rejection" in offerResult) {
      rejections.push(offerResult.rejection);
      continue;
    }
    const offer = offerResult;

    const offerRejection = crossValidateOffer(definition, offer, input.capability, input.requesterPolicy, input.now);
    if (offerRejection) {
      rejections.push(offerRejection);
      continue;
    }

    if (resolutionsRemaining < 1) {
      rejections.push(rejection(definition.event.pubkey, "discovery_truncated", "Discovery resolution budget exhausted before descriptor resolution"));
      continue;
    }
    resolutionsRemaining -= 1;

    const descriptorResult = await resolveDescriptor(definition, input.relay, input.options);
    if ("rejection" in descriptorResult) {
      rejections.push(descriptorResult.rejection);
      continue;
    }
    const descriptor = descriptorResult;

    const descriptorRejection = crossValidateDescriptor(descriptor);
    if (descriptorRejection) {
      rejections.push(descriptorRejection);
      continue;
    }

    const economicRejection = evaluateEconomicPolicy(
      offer,
      input.requesterPolicy,
      input.providerConstraints?.get(definition.event.pubkey),
    );
    if (economicRejection) {
      rejections.push(economicRejection);
      continue;
    }

    candidates.push({
      providerPublicKey: definition.event.pubkey,
      definition,
      offer,
      escrowDescriptor: descriptor,
    });
  }

  const sorted = [...candidates].sort(compareAuthorizedCandidates(input.advisoryPreferredProviders));
  const winner = sorted[0];
  const selected = winner
    ? {
        selected: {
          providerPublicKey: winner.providerPublicKey,
          providerDefinitionReference: winner.definition.address,
          escrowDescriptorReference: winner.escrowDescriptor.address,
          offerReference: winner.offer.address,
        },
        candidate: winner,
      }
    : undefined;

  return { candidates: sorted, selected, rejections };
}
