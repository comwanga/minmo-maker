import { InvalidDomainInputError } from "./errors";
import { findForbiddenPublicMaterial, isForbiddenFieldName } from "./forbidden-material";
import { sats, type Sats } from "./money";
import type { NostrIdentity, NostrPublicKey, NostrTag, UnsignedNostrEvent } from "./nostr";
import { nostrPublicKey, parseUnsignedNostrEvent } from "./nostr";
import { parsePontmoreEscrowDescriptorReference } from "./pontmore-escrow";

/*
 * PactAgent signed service-offer record.
 *
 * PIP-00 names `capabilities` and `pricing_policy` but does not standardize a
 * concrete service-offer schema or the nested value shape needed to obtain a
 * price and execution duration. This application-owned, signed record carries
 * the current provider offer (amount, settlement network, escrow reference,
 * execution limit, and validity window) and is referenced from a provider's
 * PIP-00 `pricing_policy` field via its addressable Nostr reference.
 *
 * This is a PactAgent convention, NOT a PIP-00 field. The kind is chosen
 * outside the Pontmore PIP range (PIP-00 30360, PIP-01 30361, PIP-02 30362)
 * so it does not appear to extend the Pontmore PIP surface. It is kept behind a
 * constant so the application kind can be revised after checking the Nostr kind
 * registry without touching Pontmore code.
 */
export const PACTAGENT_SERVICE_OFFER_KIND = 30400;
export const PACTAGENT_DOCUMENT_SUMMARY_CAPABILITY_ID = "pactagent/document-summary";
export const PACTAGENT_SERVICE_OFFER_PROFILE_VERSION = 1;
export const PACTAGENT_SERVICE_OFFER_CONTENT_VERSION = 1;

export type PactServiceOfferErrorCode =
  | "invalid_offer_kind"
  | "missing_required_tag"
  | "duplicate_singleton_tag"
  | "invalid_content"
  | "escrow_tag_mismatch"
  | "unsupported_capability_profile"
  | "unsupported_settlement_network"
  | "invalid_validity_window"
  | "invalid_amount"
  | "invalid_execution_duration"
  | "forbidden_public_field"
  | "malformed_offer_reference";

export class PactServiceOfferError extends InvalidDomainInputError {
  readonly code: PactServiceOfferErrorCode;

  constructor(code: PactServiceOfferErrorCode, message: string) {
    super(message);
    this.name = "PactServiceOfferError";
    this.code = code;
  }
}

function offerError(code: PactServiceOfferErrorCode, message: string): never {
  throw new PactServiceOfferError(code, message);
}

export interface PactServiceOfferCapabilityProfile {
  readonly id: "pactagent/document-summary";
  readonly version: 1;
}

export interface PactServiceOfferContent {
  readonly version: 1;
  readonly provider: string;
  readonly capability_profile: PactServiceOfferCapabilityProfile;
  readonly amount_sats: string;
  readonly settlement_network: "cashu";
  readonly escrow_descriptor: string;
  readonly maximum_execution_seconds: number;
  readonly valid_from: number;
  readonly expires_at: number;
  readonly updated_at: number;
}

export interface PactServiceOffer<TEvent extends UnsignedNostrEvent = UnsignedNostrEvent> {
  readonly identifier: string;
  readonly address: string;
  readonly event: TEvent;
  readonly content: PactServiceOfferContent;
  readonly amountSats: Sats;
}

export interface PactServiceOfferReference {
  readonly kind: typeof PACTAGENT_SERVICE_OFFER_KIND;
  readonly publicKey: NostrPublicKey;
  readonly identifier: string;
}

const CONTENT_KEYS = [
  "version",
  "provider",
  "capability_profile",
  "amount_sats",
  "settlement_network",
  "escrow_descriptor",
  "maximum_execution_seconds",
  "valid_from",
  "expires_at",
  "updated_at",
] as const;

function requireIdentifier(value: string): string {
  const identifier = value.trim();
  if (/^[0-9a-f]{64}$/i.test(identifier)) {
    offerError(
      "forbidden_public_field",
      "PactAgent service-offer identifier must not contain secret-key-shaped material",
    );
  }
  if (!identifier || identifier !== value || /[\u0000-\u001f\u007f]/.test(identifier)) {
    offerError("invalid_content", "PactAgent service-offer d tag must be a stable non-empty identifier");
  }
  if (findForbiddenPublicMaterial(identifier) !== undefined) {
    offerError("forbidden_public_field", "PactAgent service-offer identifier contains forbidden material");
  }
  return identifier;
}

function requireNonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    offerError("invalid_content", `PactAgent service-offer ${field} must be a non-negative integer`);
  }
  return value as number;
}

function findTags(event: UnsignedNostrEvent, name: string): readonly NostrTag[] {
  return event.tags.filter((tag) => tag[0] === name);
}

function requireSingletonTag(
  event: UnsignedNostrEvent,
  name: string,
  fieldDescription: string,
): NostrTag {
  const tags = findTags(event, name);
  if (tags.length === 0) {
    offerError("missing_required_tag", `PactAgent service-offer is missing required ${fieldDescription} tag`);
  }
  if (tags.length > 1) {
    offerError("duplicate_singleton_tag", `PactAgent service-offer has duplicate ${fieldDescription} tags`);
  }
  return tags[0];
}

function parseAmountSats(value: unknown): Sats {
  if (typeof value !== "string") {
    offerError("invalid_amount", "PactAgent service-offer amount_sats must be a string");
  }
  if (!/^\d+$/.test(value as string)) {
    offerError("invalid_amount", "PactAgent service-offer amount_sats must be an unsigned integer string");
  }
  let amount: Sats;
  try {
    amount = sats(BigInt(value as string));
  } catch {
    offerError("invalid_amount", "PactAgent service-offer amount_sats is out of range");
  }
  return amount;
}

function validateCapabilityProfile(value: unknown): PactServiceOfferCapabilityProfile {
  if (typeof value !== "object" || value === null) {
    offerError("unsupported_capability_profile", "PactAgent service-offer capability_profile must be an object");
  }
  const profile = value as Record<string, unknown>;
  if (Object.keys(profile).some((key) => !["id", "version"].includes(key))) {
    offerError("unsupported_capability_profile", "PactAgent service-offer capability_profile contains unsupported fields");
  }
  if (
    profile.id !== PACTAGENT_DOCUMENT_SUMMARY_CAPABILITY_ID ||
    !Number.isInteger(profile.version) ||
    profile.version !== PACTAGENT_SERVICE_OFFER_PROFILE_VERSION
  ) {
    offerError("unsupported_capability_profile", "PactAgent service-offer capability_profile is not supported");
  }
  return { id: profile.id, version: profile.version };
}

export function parsePactServiceOfferReference(reference: string): PactServiceOfferReference {
  const match = /^30400:([0-9a-f]{64}):(.+)$/.exec(reference);
  if (!match) {
    offerError("malformed_offer_reference", "PactAgent service-offer reference is malformed");
  }
  return {
    kind: PACTAGENT_SERVICE_OFFER_KIND,
    publicKey: nostrPublicKey(match[1]),
    identifier: requireIdentifier(match[2]),
  };
}

export interface CreatePactServiceOfferInput {
  readonly identity: NostrIdentity;
  readonly identifier: string;
  readonly capabilityProfile: PactServiceOfferCapabilityProfile;
  readonly amountSats: Sats;
  readonly settlementNetwork: "cashu";
  readonly escrowDescriptorReference: string;
  readonly maximumExecutionSeconds: number;
  readonly validFrom: number;
  readonly expiresAt: number;
  readonly updatedAt: number;
}

const CREATE_INPUT_KEYS = [
  "identity",
  "identifier",
  "capabilityProfile",
  "amountSats",
  "settlementNetwork",
  "escrowDescriptorReference",
  "maximumExecutionSeconds",
  "validFrom",
  "expiresAt",
  "updatedAt",
] as const;

function assertNoForbiddenPublicMaterial(value: unknown): void {
  const reason = findForbiddenPublicMaterial(value);
  if (reason === undefined) return;
  offerError(
    "forbidden_public_field",
    reason.kind === "field"
      ? "PactAgent service-offer contains a forbidden private field"
      : "PactAgent service-offer contains forbidden secret or token material",
  );
}

export function createPactServiceOffer(input: CreatePactServiceOfferInput): PactServiceOffer {
  assertNoForbiddenPublicMaterial(input);
  if (Object.keys(input).some((key) => !CREATE_INPUT_KEYS.includes(key as (typeof CREATE_INPUT_KEYS)[number]))) {
    offerError("invalid_content", "PactAgent service-offer input contains unsupported fields");
  }
  const identifier = requireIdentifier(input.identifier);
  if (input.capabilityProfile.id !== PACTAGENT_DOCUMENT_SUMMARY_CAPABILITY_ID) {
    offerError("unsupported_capability_profile", "PactAgent service-offer capability profile id is unsupported");
  }
  if (input.capabilityProfile.version !== PACTAGENT_SERVICE_OFFER_PROFILE_VERSION) {
    offerError("unsupported_capability_profile", "PactAgent service-offer capability profile version is unsupported");
  }
  if (input.settlementNetwork !== "cashu") {
    offerError("unsupported_settlement_network", "PactAgent service-offer settlement network is unsupported");
  }
  sats(input.amountSats);
  if (input.amountSats === 0n) {
    offerError("invalid_amount", "PactAgent service-offer amount must be positive");
  }
  if (!Number.isInteger(input.maximumExecutionSeconds) || input.maximumExecutionSeconds < 1) {
    offerError("invalid_execution_duration", "PactAgent service-offer execution duration must be a positive integer");
  }
  if (!Number.isInteger(input.updatedAt) || input.updatedAt < 0) {
    offerError("invalid_content", "PactAgent service-offer updated_at must be a non-negative integer");
  }
  requireNonNegativeInteger(input.validFrom, "valid_from");
  requireNonNegativeInteger(input.expiresAt, "expires_at");
  if (input.expiresAt < input.validFrom) {
    offerError("invalid_validity_window", "PactAgent service-offer expires_at must not precede valid_from");
  }
  try {
    parsePontmoreEscrowDescriptorReference(input.escrowDescriptorReference);
  } catch {
    offerError("escrow_tag_mismatch", "PactAgent service-offer escrow_descriptor must be a canonical 30361:<pubkey>:<d> address");
  }

  const content: PactServiceOfferContent = {
    version: PACTAGENT_SERVICE_OFFER_CONTENT_VERSION,
    provider: input.identity.publicKey,
    capability_profile: input.capabilityProfile,
    amount_sats: input.amountSats.toString(),
    settlement_network: input.settlementNetwork,
    escrow_descriptor: input.escrowDescriptorReference,
    maximum_execution_seconds: input.maximumExecutionSeconds,
    valid_from: input.validFrom,
    expires_at: input.expiresAt,
    updated_at: input.updatedAt,
  };

  const event: UnsignedNostrEvent = {
    pubkey: input.identity.publicKey,
    created_at: input.updatedAt,
    kind: PACTAGENT_SERVICE_OFFER_KIND,
    tags: [
      ["d", identifier],
      ["a", input.escrowDescriptorReference],
    ],
    content: JSON.stringify(content),
  };

  return {
    identifier,
    address: `${PACTAGENT_SERVICE_OFFER_KIND}:${input.identity.publicKey}:${identifier}`,
    event,
    content,
    amountSats: input.amountSats,
  };
}

export function parsePactServiceOfferEvent<TEvent extends UnsignedNostrEvent>(
  event: TEvent,
): PactServiceOffer<TEvent> {
  if (event.kind !== PACTAGENT_SERVICE_OFFER_KIND) {
    offerError("invalid_offer_kind", "PactAgent service-offer must use the PactAgent application kind");
  }

  assertNoForbiddenPublicMaterial(event.tags);
  for (const tag of event.tags) {
    if (isForbiddenFieldName(tag[0])) {
      offerError("forbidden_public_field", "PactAgent service-offer contains a forbidden private tag");
    }
    if (!["d", "a"].includes(tag[0]) || tag.length !== 2) {
      offerError("invalid_content", "PactAgent service-offer contains unsupported tags");
    }
  }

  const dTag = requireSingletonTag(event, "d", "d (identifier)");
  const identifier = requireIdentifier(dTag[1]);

  const aTag = requireSingletonTag(event, "a", "a (escrow descriptor reference)");
  const escrowReference = aTag[1];
  try {
    parsePontmoreEscrowDescriptorReference(escrowReference);
  } catch {
    offerError("escrow_tag_mismatch", "PactAgent service-offer a tag must be a canonical 30361:<pubkey>:<d> escrow address");
  }

  let rawContent: unknown;
  try {
    rawContent = JSON.parse(event.content);
  } catch {
    offerError("invalid_content", "PactAgent service-offer content must be valid JSON");
  }
  if (typeof rawContent !== "object" || rawContent === null) {
    offerError("invalid_content", "PactAgent service-offer content must be an object");
  }
  assertNoForbiddenPublicMaterial(rawContent);
  const candidate = rawContent as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !CONTENT_KEYS.includes(key as (typeof CONTENT_KEYS)[number]))) {
    offerError("invalid_content", "PactAgent service-offer content contains unsupported fields");
  }
  if (CONTENT_KEYS.some((key) => !(key in candidate))) {
    offerError("invalid_content", "PactAgent service-offer content is missing required fields");
  }
  if (candidate.version !== PACTAGENT_SERVICE_OFFER_CONTENT_VERSION) {
    offerError("invalid_content", "PactAgent service-offer content version is not supported");
  }
  if (typeof candidate.provider !== "string") {
    offerError("invalid_content", "PactAgent service-offer provider must be a string");
  }
  try {
    nostrPublicKey(candidate.provider);
  } catch {
    offerError("invalid_content", "PactAgent service-offer provider must be a valid Nostr public key");
  }
  if (candidate.provider !== event.pubkey) {
    offerError("invalid_content", "PactAgent service-offer provider must match the event author");
  }
  const capabilityProfile = validateCapabilityProfile(candidate.capability_profile);
  if (candidate.settlement_network !== "cashu") {
    offerError("unsupported_settlement_network", "PactAgent service-offer settlement network is unsupported");
  }
  if (typeof candidate.escrow_descriptor !== "string" || candidate.escrow_descriptor !== escrowReference) {
    offerError("escrow_tag_mismatch", "PactAgent service-offer content.escrow_descriptor must match the a tag");
  }
  const amountSats = parseAmountSats(candidate.amount_sats);
  if (amountSats === 0n) {
    offerError("invalid_amount", "PactAgent service-offer amount must be positive");
  }
  const maximumExecutionSeconds = candidate.maximum_execution_seconds;
  if (!Number.isInteger(maximumExecutionSeconds) || (maximumExecutionSeconds as number) < 1) {
    offerError("invalid_execution_duration", "PactAgent service-offer maximum_execution_seconds must be a positive integer");
  }
  const validFrom = requireNonNegativeInteger(candidate.valid_from, "valid_from");
  const expiresAt = requireNonNegativeInteger(candidate.expires_at, "expires_at");
  if (expiresAt < validFrom) {
    offerError("invalid_validity_window", "PactAgent service-offer expires_at must not precede valid_from");
  }
  const updatedAt = requireNonNegativeInteger(candidate.updated_at, "updated_at");
  if (updatedAt !== event.created_at) {
    offerError("invalid_content", "PactAgent service-offer updated_at must match event created_at");
  }

  const content: PactServiceOfferContent = {
    version: PACTAGENT_SERVICE_OFFER_CONTENT_VERSION,
    provider: candidate.provider,
    capability_profile: capabilityProfile,
    amount_sats: candidate.amount_sats as string,
    settlement_network: "cashu",
    escrow_descriptor: escrowReference,
    maximum_execution_seconds: maximumExecutionSeconds as number,
    valid_from: validFrom,
    expires_at: expiresAt,
    updated_at: updatedAt,
  };

  return {
    identifier,
    address: `${PACTAGENT_SERVICE_OFFER_KIND}:${event.pubkey}:${identifier}`,
    event,
    content,
    amountSats,
  };
}

export function parsePactServiceOffer(serialized: string): PactServiceOffer {
  const event = parseUnsignedNostrEvent(serialized);
  return parsePactServiceOfferEvent(event);
}

/*
 * The PIP-00 `pricing_policy` field references the current application offer.
 * This helper resolves an offer address from a provider definition's
 * pricing_policy string and validates that it is a canonical service-offer
 * address owned by the same provider.
 */
export function resolveOfferAddressFromPricingPolicy(
  pricingPolicy: string,
  providerPublicKey: NostrPublicKey,
): PactServiceOfferReference {
  let reference: PactServiceOfferReference;
  try {
    reference = parsePactServiceOfferReference(pricingPolicy);
  } catch {
    offerError("malformed_offer_reference", "PIP-00 pricing_policy does not reference a canonical PactAgent service offer");
  }
  if (reference.publicKey !== providerPublicKey) {
    offerError("malformed_offer_reference", "PIP-00 pricing_policy offer reference must be owned by the provider");
  }
  return reference;
}
