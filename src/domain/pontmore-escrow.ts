import { InvalidDomainInputError } from "./errors";
import type { NostrIdentity, UnsignedNostrEvent } from "./nostr";
import { parseUnsignedNostrEvent } from "./nostr";
import type { Sats } from "./money";
import { sats } from "./money";

export const PIP01_ESCROW_DESCRIPTOR_KIND = 30361;

export interface PontmoreEscrowDescriptorContent {
  readonly version: 1;
  readonly escrow_type: "cashu_escrow";
  readonly networks: readonly ["cashu", ...string[]];
  readonly funding_rules: Readonly<{
    funding_threshold: number;
    participant_count: number;
  }>;
  readonly dispute_rules: Readonly<{ policy: "pip03" }>;
  readonly reference_format: string;
  readonly updated_at: number;
}

export interface PontmoreEscrowDescriptor {
  readonly identifier: string;
  readonly address: string;
  readonly event: UnsignedNostrEvent;
  readonly content: PontmoreEscrowDescriptorContent;
}

export type Pip03TimeoutClass =
  | "request expiry"
  | "funding timeout"
  | "payment proof timeout"
  | "payout timeout"
  | "resolution timeout"
  | "refund-trigger timeout";

export type Pip03FallbackResolution =
  | "confirming the customer claim"
  | "confirming the agent claim"
  | "splitting outcome"
  | "cancelling and refunding"
  | "escalating to manual review";

export type CashuSettlementState =
  | "planned"
  | "funding_intended"
  | "secured"
  | "release_intended"
  | "refund_intended"
  | "disputed"
  | "released"
  | "refunded";

/** Application escrow intent; none of these fields are added to the public PIP-01 descriptor. */
export interface CashuEscrowPlan {
  readonly descriptorReference: string;
  readonly amountSats: Sats;
  readonly settlementState: CashuSettlementState;
  readonly fundingIntent: Readonly<{ action: "commit"; network: "cashu" }>;
  readonly releaseIntent: Readonly<{
    action: "release";
    condition: "deterministic_completion_checks_pass";
  }>;
  readonly refundIntent: Readonly<{
    action: "refund";
    condition: "timeout_or_pip03_resolution";
  }>;
  readonly timeout: Readonly<{
    class: Pip03TimeoutClass;
    durationSeconds: number;
    fallbackResolution: Pip03FallbackResolution;
  }>;
}

interface CreateCashuDescriptorInput {
  readonly identity: NostrIdentity;
  readonly identifier: string;
  readonly updatedAt: number;
  readonly referenceFormat: string;
  readonly fundingThreshold?: number;
  readonly participantCount?: number;
}

function requirePositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new InvalidDomainInputError(`${field} must be a positive integer`);
  }
}

export function createCashuEscrowDescriptor(
  input: CreateCashuDescriptorInput,
): PontmoreEscrowDescriptor {
  const identifier = input.identifier.trim();
  const referenceFormat = input.referenceFormat.trim();
  const fundingThreshold = input.fundingThreshold ?? 1;
  const participantCount = input.participantCount ?? 1;
  if (!identifier || !referenceFormat) {
    throw new InvalidDomainInputError("Cashu descriptor identifier and reference format are required");
  }
  if (!Number.isInteger(input.updatedAt) || input.updatedAt < 0) {
    throw new InvalidDomainInputError("PIP-01 updated_at must be a non-negative integer");
  }
  requirePositiveInteger(fundingThreshold, "Funding threshold");
  requirePositiveInteger(participantCount, "Participant count");
  if (participantCount < fundingThreshold) {
    throw new InvalidDomainInputError("Participant count must be at least the funding threshold");
  }

  const content: PontmoreEscrowDescriptorContent = {
    version: 1,
    escrow_type: "cashu_escrow",
    networks: ["cashu"],
    funding_rules: { funding_threshold: fundingThreshold, participant_count: participantCount },
    dispute_rules: { policy: "pip03" },
    reference_format: referenceFormat,
    updated_at: input.updatedAt,
  };
  const event: UnsignedNostrEvent = {
    pubkey: input.identity.publicKey,
    created_at: input.updatedAt,
    kind: PIP01_ESCROW_DESCRIPTOR_KIND,
    tags: [["d", identifier], ["network", "cashu"]],
    content: JSON.stringify(content),
  };
  return {
    identifier,
    address: `${PIP01_ESCROW_DESCRIPTOR_KIND}:${input.identity.publicKey}:${identifier}`,
    event,
    content,
  };
}

export function parseCashuEscrowDescriptor(serialized: string): PontmoreEscrowDescriptor {
  const event = parseUnsignedNostrEvent(serialized);
  if (event.kind !== PIP01_ESCROW_DESCRIPTOR_KIND) {
    throw new InvalidDomainInputError("PIP-01 escrow descriptor must use kind 30361");
  }
  const identifier = event.tags.find((tag) => tag[0] === "d")?.[1];
  if (!identifier) throw new InvalidDomainInputError("PIP-01 escrow descriptor requires a d tag");

  let content: unknown;
  try {
    content = JSON.parse(event.content);
  } catch {
    throw new InvalidDomainInputError("PIP-01 content must be valid JSON");
  }
  if (typeof content !== "object" || content === null) {
    throw new InvalidDomainInputError("PIP-01 content must be an object");
  }
  const candidate = content as Record<string, unknown>;
  const keys = Object.keys(candidate);
  const allowedKeys = [
    "version",
    "escrow_type",
    "networks",
    "funding_rules",
    "dispute_rules",
    "reference_format",
    "updated_at",
  ];
  if (keys.some((key) => !allowedKeys.includes(key))) {
    throw new InvalidDomainInputError("PIP-01 descriptor contains unsupported or private fields");
  }
  const funding = candidate.funding_rules as Record<string, unknown> | undefined;
  const dispute = candidate.dispute_rules as Record<string, unknown> | undefined;
  const networkTags = event.tags.filter((tag) => tag[0] === "network").map((tag) => tag[1]);
  if (
    candidate.version !== 1 ||
    candidate.escrow_type !== "cashu_escrow" ||
    !Array.isArray(candidate.networks) ||
    candidate.networks.length !== 1 ||
    !candidate.networks.includes("cashu") ||
    candidate.networks.some((network) => typeof network !== "string" || network !== network.toLowerCase()) ||
    networkTags.length !== 1 ||
    networkTags[0] !== "cashu" ||
    typeof candidate.reference_format !== "string" ||
    !candidate.reference_format.trim() ||
    !Number.isInteger(candidate.updated_at) ||
    typeof funding !== "object" ||
    funding === null ||
    Object.keys(funding).some((key) => !["funding_threshold", "participant_count"].includes(key)) ||
    !Number.isInteger(funding.funding_threshold) ||
    !Number.isInteger(funding.participant_count) ||
    (funding.funding_threshold as number) < 1 ||
    (funding.participant_count as number) < (funding.funding_threshold as number) ||
    typeof dispute !== "object" ||
    dispute === null ||
    Object.keys(dispute).some((key) => key !== "policy") ||
    dispute.policy !== "pip03"
  ) {
    throw new InvalidDomainInputError("PIP-01 Cashu descriptor is incompatible");
  }

  const typedContent: PontmoreEscrowDescriptorContent = {
    version: 1,
    escrow_type: "cashu_escrow",
    networks: ["cashu"],
    funding_rules: {
      funding_threshold: funding.funding_threshold as number,
      participant_count: funding.participant_count as number,
    },
    dispute_rules: { policy: "pip03" },
    reference_format: candidate.reference_format,
    updated_at: candidate.updated_at as number,
  };
  return {
    identifier,
    address: `${PIP01_ESCROW_DESCRIPTOR_KIND}:${event.pubkey}:${identifier}`,
    event,
    content: typedContent,
  };
}

export function isCashuEscrowCompatible(descriptor: PontmoreEscrowDescriptor): boolean {
  return (
    descriptor.content.escrow_type === "cashu_escrow" &&
    descriptor.content.networks.includes("cashu") &&
    descriptor.content.dispute_rules.policy === "pip03" &&
    descriptor.content.funding_rules.funding_threshold >= 1 &&
    descriptor.content.funding_rules.participant_count >=
      descriptor.content.funding_rules.funding_threshold
  );
}

export function createCashuEscrowPlan(input: {
  descriptor: PontmoreEscrowDescriptor;
  amountSats: Sats;
  timeoutSeconds: number;
}): CashuEscrowPlan {
  if (!isCashuEscrowCompatible(input.descriptor)) {
    throw new InvalidDomainInputError("Escrow descriptor is not Cashu/PIP-03 compatible");
  }
  sats(input.amountSats);
  if (input.amountSats === 0n) throw new InvalidDomainInputError("Escrow amount must be positive");
  if (!Number.isInteger(input.timeoutSeconds) || input.timeoutSeconds < 1) {
    throw new InvalidDomainInputError("Escrow timeout must be a positive integer");
  }
  return {
    descriptorReference: input.descriptor.address,
    amountSats: input.amountSats,
    settlementState: "planned",
    fundingIntent: { action: "commit", network: "cashu" },
    releaseIntent: { action: "release", condition: "deterministic_completion_checks_pass" },
    refundIntent: { action: "refund", condition: "timeout_or_pip03_resolution" },
    timeout: {
      class: "refund-trigger timeout",
      durationSeconds: input.timeoutSeconds,
      fallbackResolution: "cancelling and refunding",
    },
  };
}
