import { InvalidDomainInputError } from "./errors";
import type { NostrIdentity } from "./nostr";
import type { Sats } from "./money";
import { sats } from "./money";
import type { PontmoreAgentDefinition } from "./pontmore-agent";
import { parsePontmoreAgentDefinition } from "./pontmore-agent";
import type { PontmoreEscrowDescriptor } from "./pontmore-escrow";
import { isCashuEscrowCompatible } from "./pontmore-escrow";
import { serializeUnsignedNostrEvent } from "./nostr";

export type PactAgentId = "P001" | "P002";
export type ServiceCapability = "document-summary";

export interface RequesterPolicy {
  readonly maxBudgetSats: Sats;
  readonly allowedCapabilities: readonly ServiceCapability[];
  readonly maximumEscrowDurationSeconds: number;
  readonly maximumProviderPriceSats: Sats;
  readonly allowedSettlementNetworks: readonly ["cashu"];
  readonly autoRelease: "deterministic_checks_only";
}

export interface ProviderPolicy {
  readonly minimumPriceSats: Sats;
  readonly maximumDocumentBytes: number;
  readonly supportedMediaTypes: readonly string[];
  readonly maximumExecutionDurationSeconds: number;
  readonly serviceCapabilities: readonly ServiceCapability[];
}

export interface RequesterAgent {
  readonly id: "P001";
  readonly role: "requester";
  readonly identity: NostrIdentity;
  readonly definition: PontmoreAgentDefinition;
  readonly policy: RequesterPolicy;
}

export interface ProviderAgent {
  readonly id: "P002";
  readonly role: "provider";
  readonly identity: NostrIdentity;
  readonly definition: PontmoreAgentDefinition;
  readonly policy: ProviderPolicy;
}

export interface ServiceOffer {
  readonly providerPublicKey: string;
  readonly capability: ServiceCapability;
  readonly priceSats: Sats;
  readonly settlementNetwork: "cashu";
  readonly escrowDescriptorReference: string;
  readonly estimatedExecutionSeconds: number;
}

export interface OfferEvaluation {
  readonly authorized: boolean;
  readonly reasons: readonly string[];
}

export function validateRequesterAgent(agent: RequesterAgent): void {
  if (agent.id !== "P001" || agent.role !== "requester") {
    throw new InvalidDomainInputError("Requester must use PactAgent application identifier P001");
  }
  if (agent.identity.publicKey !== agent.definition.event.pubkey) {
    throw new InvalidDomainInputError("P001 definition must use its independent Nostr identity");
  }
  parsePontmoreAgentDefinition(serializeUnsignedNostrEvent(agent.definition.event));
  sats(agent.policy.maxBudgetSats);
  sats(agent.policy.maximumProviderPriceSats);
  if (agent.policy.maximumProviderPriceSats > agent.policy.maxBudgetSats) {
    throw new InvalidDomainInputError("P001 maximum provider price cannot exceed its budget");
  }
  if (
    agent.policy.maxBudgetSats === 0n ||
    !agent.policy.allowedCapabilities.includes("document-summary") ||
    !Number.isInteger(agent.policy.maximumEscrowDurationSeconds) ||
    agent.policy.maximumEscrowDurationSeconds < 1
  ) {
    throw new InvalidDomainInputError("P001 policy constraints are invalid");
  }
}

export function validateProviderAgent(agent: ProviderAgent): void {
  if (agent.id !== "P002" || agent.role !== "provider") {
    throw new InvalidDomainInputError("Provider must use PactAgent application identifier P002");
  }
  if (agent.identity.publicKey !== agent.definition.event.pubkey) {
    throw new InvalidDomainInputError("P002 definition must use its independent Nostr identity");
  }
  parsePontmoreAgentDefinition(serializeUnsignedNostrEvent(agent.definition.event));
  sats(agent.policy.minimumPriceSats);
  if (!agent.policy.serviceCapabilities.includes("document-summary")) {
    throw new InvalidDomainInputError("P002 must provide the bounded document-summary capability");
  }
  if (
    agent.policy.minimumPriceSats === 0n ||
    !Number.isInteger(agent.policy.maximumDocumentBytes) ||
    agent.policy.maximumDocumentBytes < 1 ||
    !Number.isInteger(agent.policy.maximumExecutionDurationSeconds) ||
    agent.policy.maximumExecutionDurationSeconds < 1 ||
    agent.policy.supportedMediaTypes.length === 0
  ) {
    throw new InvalidDomainInputError("P002 policy constraints are invalid");
  }
}

export function discoverCompatibleProviders(
  requester: RequesterAgent,
  providers: readonly ProviderAgent[],
  capability: ServiceCapability,
): readonly ProviderAgent[] {
  validateRequesterAgent(requester);
  if (!requester.policy.allowedCapabilities.includes(capability)) return [];

  return [...providers]
    .filter((provider) => {
      try {
        validateProviderAgent(provider);
      } catch {
        return false;
      }
      return (
        provider.policy.serviceCapabilities.includes(capability) &&
        provider.definition.content.capabilities.names.includes(capability) &&
        provider.definition.content.capabilities.settlement_networks.some((network) =>
          requester.policy.allowedSettlementNetworks.includes(network as "cashu"),
        )
      );
    })
    .sort((left, right) => left.identity.publicKey.localeCompare(right.identity.publicKey));
}

export function evaluateServiceOffer(input: {
  requester: RequesterAgent;
  provider: ProviderAgent;
  offer: ServiceOffer;
  escrowDescriptor: PontmoreEscrowDescriptor;
}): OfferEvaluation {
  validateRequesterAgent(input.requester);
  validateProviderAgent(input.provider);
  sats(input.offer.priceSats);
  const reasons: string[] = [];

  if (!Number.isInteger(input.offer.estimatedExecutionSeconds) || input.offer.estimatedExecutionSeconds < 1) {
    reasons.push("invalid_execution_duration");
  }

  if (!input.requester.policy.allowedCapabilities.includes(input.offer.capability)) {
    reasons.push("capability_not_allowed");
  }
  if (!input.provider.policy.serviceCapabilities.includes(input.offer.capability)) {
    reasons.push("provider_capability_mismatch");
  }
  if (input.offer.providerPublicKey !== input.provider.identity.publicKey) {
    reasons.push("provider_identity_mismatch");
  }
  if (input.offer.priceSats > input.requester.policy.maxBudgetSats) reasons.push("budget_exceeded");
  if (input.offer.priceSats > input.requester.policy.maximumProviderPriceSats) {
    reasons.push("provider_price_limit_exceeded");
  }
  if (input.offer.priceSats < input.provider.policy.minimumPriceSats) {
    reasons.push("below_provider_minimum");
  }
  if (!input.requester.policy.allowedSettlementNetworks.includes(input.offer.settlementNetwork)) {
    reasons.push("settlement_network_not_allowed");
  }
  if (
    !isCashuEscrowCompatible(input.escrowDescriptor) ||
    input.offer.escrowDescriptorReference !== input.escrowDescriptor.address
  ) {
    reasons.push("escrow_incompatible");
  }
  if (input.offer.estimatedExecutionSeconds > input.provider.policy.maximumExecutionDurationSeconds) {
    reasons.push("provider_execution_limit_exceeded");
  }
  if (input.offer.estimatedExecutionSeconds > input.requester.policy.maximumEscrowDurationSeconds) {
    reasons.push("requester_escrow_duration_exceeded");
  }

  return { authorized: reasons.length === 0, reasons };
}
