import { InvalidDomainInputError } from "./errors";
import { findForbiddenPublicMaterial } from "./forbidden-material";
import type { NostrIdentity, NostrPublicKey, NostrTag, UnsignedNostrEvent } from "./nostr";
import { nostrPublicKey, parseUnsignedNostrEvent } from "./nostr";
import { parsePontmoreEscrowDescriptorReference } from "./pontmore-escrow";

export const PIP00_AGENT_DEFINITION_KIND = 30360;

export type PontmoreAgentDefinitionErrorCode =
  | "invalid_pip00_kind"
  | "missing_required_tag"
  | "duplicate_singleton_tag"
  | "invalid_relay_tag"
  | "invalid_content"
  | "escrow_tag_mismatch"
  | "unsupported_profile_version"
  | "malformed_reference"
  | "forbidden_public_field";

export class PontmoreAgentDefinitionError extends InvalidDomainInputError {
  readonly code: PontmoreAgentDefinitionErrorCode;

  constructor(code: PontmoreAgentDefinitionErrorCode, message: string) {
    super(message);
    this.name = "PontmoreAgentDefinitionError";
    this.code = code;
  }
}

function agentError(code: PontmoreAgentDefinitionErrorCode, message: string): never {
  throw new PontmoreAgentDefinitionError(code, message);
}

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

export interface PontmoreAgentDefinition<TEvent extends UnsignedNostrEvent = UnsignedNostrEvent> {
  readonly identifier: string;
  readonly address: string;
  readonly event: TEvent;
  readonly content: PontmoreAgentDefinitionContent;
}

export interface PontmoreAgentDefinitionReference {
  readonly kind: typeof PIP00_AGENT_DEFINITION_KIND;
  readonly publicKey: NostrPublicKey;
  readonly identifier: string;
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

function findTags(event: UnsignedNostrEvent, name: string): readonly NostrTag[] {
  return event.tags.filter((tag) => tag[0] === name);
}

function requireSingletonTag(
  event: UnsignedNostrEvent,
  name: string,
  fieldDescription: string,
): NostrTag {
  const tags = findTags(event, name);
  if (tags.length === 0) agentError("missing_required_tag", `PIP-00 agent definition is missing required ${fieldDescription} tag`);
  if (tags.length > 1) agentError("duplicate_singleton_tag", `PIP-00 agent definition has duplicate ${fieldDescription} tags`);
  return tags[0];
}

function validateRelayTags(event: UnsignedNostrEvent): readonly string[] {
  const relayTags = findTags(event, "relay");
  if (relayTags.length === 0) agentError("missing_required_tag", "PIP-00 agent definition requires at least one relay tag");
  const seen = new Set<string>();
  for (const tag of relayTags) {
    if (tag.length !== 2) agentError("invalid_relay_tag", "PIP-00 relay tag must have exactly one value");
    const url = tag[1];
    try {
      if (new URL(url).protocol !== "wss:") throw new Error("not wss");
    } catch {
      agentError("invalid_relay_tag", "PIP-00 relay URLs must use wss://");
    }
    seen.add(url);
  }
  return [...seen];
}

export function parsePontmoreAgentDefinitionReference(reference: string): PontmoreAgentDefinitionReference {
  const match = /^30360:([0-9a-f]{64}):(.+)$/.exec(reference);
  if (!match) {
    agentError("malformed_reference", "PIP-00 agent definition reference is malformed");
  }
  return {
    kind: PIP00_AGENT_DEFINITION_KIND,
    publicKey: nostrPublicKey(match[1]),
    identifier: match[2],
  };
}

/*
 * Layer 2 — PIP-00 envelope validation.
 * Checks kind 30360, addressability (d), required discovery tags (t=agent, relay, a),
 * versioned content presence, and escrow/content consistency.
 */
export interface Pip00Envelope {
  readonly identifier: string;
  readonly escrowReference: string;
  readonly relays: readonly string[];
  readonly rawContent: unknown;
}

export function validatePip00AgentEnvelope(event: UnsignedNostrEvent): Pip00Envelope {
  if (event.kind !== PIP00_AGENT_DEFINITION_KIND) {
    agentError("invalid_pip00_kind", "PIP-00 agent definition must use kind 30360");
  }

  const dTag = requireSingletonTag(event, "d", "d (identifier)");
  const identifier = dTag[1];
  if (!identifier) agentError("missing_required_tag", "PIP-00 d tag must be non-empty");

  const tTag = requireSingletonTag(event, "t", "t (type)");
  if (tTag[1] !== "agent") agentError("invalid_content", "PIP-00 t tag must be 'agent'");

  const aTag = requireSingletonTag(event, "a", "a (escrow reference)");
  const escrowReference = aTag[1];
  if (!escrowReference) agentError("missing_required_tag", "PIP-00 a tag must be non-empty");

  try {
    parsePontmoreEscrowDescriptorReference(escrowReference);
  } catch {
    agentError("escrow_tag_mismatch", "PIP-00 a tag must be a canonical 30361:<pubkey>:<d> escrow address");
  }

  const relays = validateRelayTags(event);

  let rawContent: unknown;
  try {
    rawContent = JSON.parse(event.content);
  } catch {
    agentError("invalid_content", "PIP-00 content must be valid JSON");
  }
  if (typeof rawContent !== "object" || rawContent === null) {
    agentError("invalid_content", "PIP-00 content must be an object");
  }
  const candidate = rawContent as Record<string, unknown>;
  const forbiddenReason = findForbiddenPublicMaterial(candidate);
  if (forbiddenReason !== undefined) {
    agentError(
      "forbidden_public_field",
      forbiddenReason.kind === "field"
        ? "PIP-00 agent definition content contains a forbidden private field"
        : "PIP-00 agent definition content contains forbidden secret or token material",
    );
  }
  if (!("version" in candidate) || !Number.isInteger(candidate.version)) {
    agentError("invalid_content", "PIP-00 content must contain an integer version field");
  }
  if (typeof candidate.escrow !== "string" || candidate.escrow !== escrowReference) {
    agentError("escrow_tag_mismatch", "PIP-00 content.escrow must match the a tag");
  }

  return { identifier, escrowReference, relays, rawContent };
}

/*
 * Layer 3 — PactAgent profile validation.
 * Checks the application-owned conventions inside capabilities, pricing_policy,
 * name, about, and updated_at. Rejects unsupported profile versions.
 */
export function validatePactAgentProfile(
  rawContent: unknown,
  escrowReference: string,
  createdAt: number,
): PontmoreAgentDefinitionContent {
  const candidate = rawContent as Record<string, unknown>;
  const contentKeys = ["version", "name", "about", "capabilities", "pricing_policy", "escrow", "updated_at"];
  if (Object.keys(candidate).some((key) => !contentKeys.includes(key))) {
    agentError("invalid_content", "PIP-00 content contains unsupported fields");
  }
  if (candidate.version !== 1) {
    agentError("unsupported_profile_version", "PactAgent profile version is not supported");
  }
  if (typeof candidate.name !== "string" || !candidate.name.trim()) {
    agentError("invalid_content", "PIP-00 content name must be a non-empty string");
  }
  if (typeof candidate.about !== "string" || !candidate.about.trim()) {
    agentError("invalid_content", "PIP-00 content about must be a non-empty string");
  }
  if (typeof candidate.pricing_policy !== "string" || !candidate.pricing_policy.trim()) {
    agentError("invalid_content", "PIP-00 content pricing_policy must be a non-empty string");
  }
  if (typeof candidate.escrow !== "string" || candidate.escrow !== escrowReference) {
    agentError("escrow_tag_mismatch", "PIP-00 content.escrow must match the a tag");
  }
  if (!Number.isInteger(candidate.updated_at) || (candidate.updated_at as number) < 0) {
    agentError("invalid_content", "PIP-00 content updated_at must be a non-negative integer");
  }
  if ((candidate.updated_at as number) !== createdAt) {
    agentError("invalid_content", "PIP-00 content updated_at must match event created_at");
  }

  const capabilities = candidate.capabilities as Record<string, unknown> | undefined;
  if (typeof capabilities !== "object" || capabilities === null) {
    agentError("invalid_content", "PIP-00 content capabilities must be an object");
  }
  if (Object.keys(capabilities).some((key) => !["names", "settlement_networks"].includes(key))) {
    agentError("invalid_content", "PIP-00 content capabilities contains unsupported fields");
  }
  if (!Array.isArray(capabilities.names) || !capabilities.names.every((value) => typeof value === "string")) {
    agentError("invalid_content", "PIP-00 content capabilities.names must be an array of strings");
  }
  if (
    !Array.isArray(capabilities.settlement_networks) ||
    !capabilities.settlement_networks.every((value) => typeof value === "string")
  ) {
    agentError("invalid_content", "PIP-00 content capabilities.settlement_networks must be an array of strings");
  }

  return {
    version: 1,
    name: candidate.name,
    about: candidate.about,
    capabilities: {
      names: capabilities.names,
      settlement_networks: capabilities.settlement_networks,
    },
    pricing_policy: candidate.pricing_policy,
    escrow: candidate.escrow,
    updated_at: candidate.updated_at as number,
  };
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
  return {
    identifier,
    address: `${PIP00_AGENT_DEFINITION_KIND}:${input.identity.publicKey}:${identifier}`,
    event,
    content,
  };
}

export function parsePontmoreAgentDefinitionEvent<TEvent extends UnsignedNostrEvent>(
  event: TEvent,
): PontmoreAgentDefinition<TEvent> {
  const envelope = validatePip00AgentEnvelope(event);
  const content = validatePactAgentProfile(envelope.rawContent, envelope.escrowReference, event.created_at);

  return {
    identifier: envelope.identifier,
    address: `${PIP00_AGENT_DEFINITION_KIND}:${event.pubkey}:${envelope.identifier}`,
    event,
    content,
  };
}

export function parsePontmoreAgentDefinition(serialized: string): PontmoreAgentDefinition {
  const event = parseUnsignedNostrEvent(serialized);
  return parsePontmoreAgentDefinitionEvent(event);
}
