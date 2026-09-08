import { InvalidDomainInputError } from "./errors";
import type { NostrIdentity, UnsignedNostrEvent } from "./nostr";
import { parseUnsignedNostrEvent } from "./nostr";

export const PIP00_AGENT_DEFINITION_KIND = 30360;

/** PactAgent's versioned convention inside PIP-00's canonical `capabilities` field. */
export interface PactAgentCapabilities {
  readonly names: readonly string[];
  readonly settlement_networks: readonly string[];
}

/** The minimum PIP-00 content fields, with PactAgent's documented field-value conventions. */
export interface PontmoreAgentDefinitionContent {
  readonly version: 1;
  readonly name: string;
  readonly about: string;
  readonly capabilities: PactAgentCapabilities;
  readonly pricing_policy: string;
  readonly escrow: string;
  readonly updated_at: number;
}

export interface PontmoreAgentDefinition {
  readonly identifier: string;
  readonly event: UnsignedNostrEvent;
  readonly content: PontmoreAgentDefinitionContent;
}

interface CreateAgentDefinitionInput {
  readonly identity: NostrIdentity;
  readonly identifier: string;
  readonly name: string;
  readonly about: string;
  readonly capabilities: PactAgentCapabilities;
  readonly pricingPolicyReference: string;
  readonly escrowDescriptorReference: string;
  readonly updatedAt: number;
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new InvalidDomainInputError(`${field} must be non-empty`);
  return normalized;
}

function normalizeValues(values: readonly string[], field: string): readonly string[] {
  const normalized = [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) throw new InvalidDomainInputError(`${field} must be non-empty`);
  return normalized;
}

function findTag(event: UnsignedNostrEvent, name: string): readonly string[] | undefined {
  return event.tags.find((tag) => tag[0] === name);
}

export function createPontmoreAgentDefinition(input: CreateAgentDefinitionInput): PontmoreAgentDefinition {
  if (!Number.isInteger(input.updatedAt) || input.updatedAt < 0) {
    throw new InvalidDomainInputError("PIP-00 updated_at must be a non-negative integer");
  }
  const identifier = requireText(input.identifier, "PIP-00 d tag");
  const capabilities = {
    names: normalizeValues(input.capabilities.names, "Agent capabilities"),
    settlement_networks: normalizeValues(
      input.capabilities.settlement_networks,
      "Agent settlement networks",
    ),
  };
  const escrow = requireText(input.escrowDescriptorReference, "PIP-00 escrow reference");
  const content: PontmoreAgentDefinitionContent = {
    version: 1,
    name: requireText(input.name, "Agent name"),
    about: requireText(input.about, "Agent about"),
    capabilities,
    pricing_policy: requireText(input.pricingPolicyReference, "Pricing policy reference"),
    escrow,
    updated_at: input.updatedAt,
  };
  const event: UnsignedNostrEvent = {
    pubkey: input.identity.publicKey,
    created_at: input.updatedAt,
    kind: PIP00_AGENT_DEFINITION_KIND,
    tags: [
      ["d", identifier],
      ["t", "agent"],
      ...input.identity.relays.map((relay) => ["relay", relay] as const),
      ["a", escrow],
    ],
    content: JSON.stringify(content),
  };
  return { identifier, event, content };
}

export function parsePontmoreAgentDefinition(serialized: string): PontmoreAgentDefinition {
  const event = parseUnsignedNostrEvent(serialized);
  if (event.kind !== PIP00_AGENT_DEFINITION_KIND) {
    throw new InvalidDomainInputError("PIP-00 agent definition must use kind 30360");
  }
  const identifier = findTag(event, "d")?.[1];
  if (!identifier || findTag(event, "t")?.[1] !== "agent" || !findTag(event, "relay")) {
    throw new InvalidDomainInputError("PIP-00 agent definition is missing required discovery tags");
  }
  const escrowReference = findTag(event, "a")?.[1];
  if (!escrowReference) throw new InvalidDomainInputError("PIP-00 agent definition requires an escrow tag");

  let content: unknown;
  try {
    content = JSON.parse(event.content);
  } catch {
    throw new InvalidDomainInputError("PIP-00 content must be valid JSON");
  }
  if (typeof content !== "object" || content === null) {
    throw new InvalidDomainInputError("PIP-00 content must be an object");
  }
  const candidate = content as Record<string, unknown>;
  const capabilities = candidate.capabilities as Record<string, unknown> | undefined;
  const contentKeys = ["version", "name", "about", "capabilities", "pricing_policy", "escrow", "updated_at"];
  if (
    Object.keys(candidate).some((key) => !contentKeys.includes(key)) ||
    candidate.version !== 1 ||
    typeof candidate.name !== "string" ||
    typeof candidate.about !== "string" ||
    typeof candidate.pricing_policy !== "string" ||
    candidate.escrow !== escrowReference ||
    !Number.isInteger(candidate.updated_at) ||
    typeof capabilities !== "object" ||
    capabilities === null ||
    Object.keys(capabilities).some((key) => !["names", "settlement_networks"].includes(key)) ||
    !Array.isArray(capabilities.names) ||
    !capabilities.names.every((value) => typeof value === "string") ||
    !Array.isArray(capabilities.settlement_networks) ||
    !capabilities.settlement_networks.every((value) => typeof value === "string")
  ) {
    throw new InvalidDomainInputError("PIP-00 content is invalid or inconsistent with its tags");
  }

  return createPontmoreAgentDefinition({
    identity: {
      publicKey: event.pubkey,
      relays: event.tags.filter((tag) => tag[0] === "relay").map((tag) => tag[1]),
    },
    identifier,
    name: candidate.name,
    about: candidate.about,
    capabilities: {
      names: capabilities.names,
      settlement_networks: capabilities.settlement_networks,
    },
    pricingPolicyReference: candidate.pricing_policy,
    escrowDescriptorReference: escrowReference,
    updatedAt: candidate.updated_at as number,
  });
}
