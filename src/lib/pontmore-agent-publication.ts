import {
  NostrEventValidationError,
  parseSignedNostrEvent,
  verifySignedNostrEvent,
  type NostrSigner,
  type SignedNostrEvent,
} from "../domain/nostr";
import {
  parsePontmoreAgentDefinitionEvent,
  parsePontmoreAgentDefinitionReference,
  PIP00_AGENT_DEFINITION_KIND,
  PontmoreAgentDefinitionError,
  type PontmoreAgentDefinition,
  type PontmoreAgentDefinitionReference,
} from "../domain/pontmore-agent";
import type { PontmoreEscrowDescriptor } from "../domain/pontmore-escrow";
import { retrieveCashuEscrowDescriptor, Pip01PublicationError } from "./pontmore-escrow-publication";
import type {
  NostrFilter,
  NostrRelayAdapter,
  NostrRelayPublishOptions,
} from "./nostr-relay";
import {
  isTimeoutError,
  operationOptions,
  sameUnsignedEvent,
} from "./pontmore-publication-helpers";

export type Pip00PublicationErrorCode =
  | "signing_failure"
  | "publication_failure"
  | "retrieval_failure"
  | "timeout"
  | "agent_not_found"
  | "address_mismatch"
  | "invalid_nip01"
  | "invalid_signature"
  | "invalid_pip00_envelope"
  | "unsupported_profile_version"
  | "escrow_reference_mismatch"
  | "escrow_resolution_failure";

export class Pip00PublicationError extends Error {
  readonly code: Pip00PublicationErrorCode;

  constructor(code: Pip00PublicationErrorCode, message: string) {
    super(message);
    this.name = "Pip00PublicationError";
    this.code = code;
  }
}

export const PIP00_RELAY_TIMEOUT_MS = 10_000;

export async function signAgentDefinition(
  definition: PontmoreAgentDefinition,
  signer: NostrSigner,
): Promise<SignedNostrEvent> {
  if (definition.event.pubkey !== signer.publicKey) {
    throw new Pip00PublicationError("signing_failure", "Signer identity does not match the agent definition");
  }

  let signedValue: SignedNostrEvent;
  try {
    signedValue = await signer.sign(definition.event);
  } catch {
    throw new Pip00PublicationError("signing_failure", "PIP-00 agent definition signing failed");
  }

  const signed = parseSignedNostrEvent(signedValue);
  if (!sameUnsignedEvent(definition.event, signed)) {
    throw new NostrEventValidationError(
      "invalid_nostr_event",
      "Signer returned an event that does not match the PIP-00 draft",
    );
  }
  verifySignedNostrEvent(signed);
  return signed;
}

export async function publishSignedAgentDefinition(
  event: SignedNostrEvent,
  relay: NostrRelayAdapter,
  options?: NostrRelayPublishOptions,
): Promise<void> {
  const signed = parseSignedNostrEvent(event);
  verifySignedNostrEvent(signed);
  parsePontmoreAgentDefinitionEvent(signed);
  try {
    await relay.publish(signed, operationOptions(PIP00_RELAY_TIMEOUT_MS, options));
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new Pip00PublicationError("timeout", "PIP-00 agent definition publication timed out");
    }
    throw new Pip00PublicationError(
      "publication_failure",
      "PIP-00 agent definition publication failed",
    );
  }
}

export async function signAndPublishAgentDefinition(
  definition: PontmoreAgentDefinition,
  signer: NostrSigner,
  relay: NostrRelayAdapter,
  options?: NostrRelayPublishOptions,
): Promise<SignedNostrEvent> {
  const signed = await signAgentDefinition(definition, signer);
  await publishSignedAgentDefinition(signed, relay, options);
  return signed;
}

export function agentDefinitionFilter(reference: string): NostrFilter {
  const parsed = parsePontmoreAgentDefinitionReference(reference);
  return {
    kinds: [PIP00_AGENT_DEFINITION_KIND],
    authors: [parsed.publicKey],
    tags: { d: [parsed.identifier] },
    limit: 10,
  };
}

function hasAgentAddress(event: SignedNostrEvent, reference: string): boolean {
  const parsed = parsePontmoreAgentDefinitionReference(reference);
  const dTags = event.tags.filter((tag) => tag[0] === "d");
  return (
    event.kind === parsed.kind &&
    event.pubkey === parsed.publicKey &&
    dTags.length === 1 &&
    dTags[0][1] === parsed.identifier
  );
}

function mapValidationError(error: unknown): Pip00PublicationError {
  if (error instanceof NostrEventValidationError) {
    return error.code === "invalid_signature"
      ? new Pip00PublicationError("invalid_signature", "PIP-00 agent definition signature is invalid")
      : new Pip00PublicationError("invalid_nip01", "PIP-00 agent definition failed NIP-01 validation");
  }
  if (error instanceof PontmoreAgentDefinitionError) {
    return error.code === "unsupported_profile_version"
      ? new Pip00PublicationError("unsupported_profile_version", error.message)
      : new Pip00PublicationError("invalid_pip00_envelope", error.message);
  }
  return new Pip00PublicationError("invalid_pip00_envelope", "PIP-00 agent definition is invalid");
}

function matchesRawAddress(raw: unknown, ref: PontmoreAgentDefinitionReference): boolean {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  if (r.kind !== ref.kind || typeof r.pubkey !== "string" || r.pubkey !== ref.publicKey) return false;
  if (!Array.isArray(r.tags)) return false;
  const dTags = r.tags.filter((tag: unknown) => Array.isArray(tag) && tag[0] === "d");
  return dTags.length === 1 && dTags[0][1] === ref.identifier;
}

export async function retrieveAgentDefinition(
  reference: string,
  relay: NostrRelayAdapter,
  options?: NostrRelayPublishOptions,
): Promise<PontmoreAgentDefinition<SignedNostrEvent>> {
  const ref = parsePontmoreAgentDefinitionReference(reference);
  const filter = agentDefinitionFilter(reference);
  let events: readonly SignedNostrEvent[];
  try {
    events = await relay.queryEvents(filter, operationOptions(PIP00_RELAY_TIMEOUT_MS, options));
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new Pip00PublicationError("timeout", "PIP-00 agent definition retrieval timed out");
    }
    throw new Pip00PublicationError("retrieval_failure", "PIP-00 agent definition retrieval failed");
  }

  if (events.length === 0) {
    throw new Pip00PublicationError("agent_not_found", "PIP-00 agent definition was not found");
  }

  const sorted = [...events].sort((left, right) => {
    const timestampOrder = right.created_at - left.created_at;
    return timestampOrder === 0 ? left.id.localeCompare(right.id) : timestampOrder;
  });

  let anyAddressMatch = false;
  let firstError: Pip00PublicationError | undefined;

  for (const raw of sorted) {
    let parsedEvent: SignedNostrEvent;
    try {
      parsedEvent = parseSignedNostrEvent(raw);
    } catch (error) {
      if (matchesRawAddress(raw, ref)) {
        anyAddressMatch = true;
        if (!firstError) firstError = mapValidationError(error);
      }
      continue;
    }

    if (!hasAgentAddress(parsedEvent, reference)) continue;
    anyAddressMatch = true;

    try {
      verifySignedNostrEvent(parsedEvent);
      return parsePontmoreAgentDefinitionEvent(parsedEvent);
    } catch (error) {
      if (!firstError) firstError = mapValidationError(error);
    }
  }

  if (!anyAddressMatch) {
    throw new Pip00PublicationError(
      "address_mismatch",
      "Relay result does not match the requested PIP-00 agent definition reference",
    );
  }

  throw firstError ?? new Pip00PublicationError("invalid_pip00_envelope", "PIP-00 agent definition is invalid");
}

export async function resolveAgentDefinitionEscrow(
  definition: PontmoreAgentDefinition<SignedNostrEvent>,
  relay: NostrRelayAdapter,
  options?: NostrRelayPublishOptions,
): Promise<PontmoreEscrowDescriptor<SignedNostrEvent>> {
  try {
    return await retrieveCashuEscrowDescriptor(definition.content.escrow, relay, options);
  } catch (error) {
    if (error instanceof Pip01PublicationError) {
      if (error.code === "timeout") {
        throw new Pip00PublicationError("timeout", "PIP-01 escrow resolution timed out");
      }
      if (error.code === "descriptor_agent_mismatch") {
        throw new Pip00PublicationError("escrow_reference_mismatch", error.message);
      }
    }
    throw new Pip00PublicationError("escrow_resolution_failure", "PIP-01 escrow descriptor resolution failed");
  }
}
