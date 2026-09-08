import { InvalidDomainInputError } from "./errors";
import type { NostrIdentity, UnsignedNostrEvent } from "./nostr";
import { parseUnsignedNostrEvent } from "./nostr";

export const PIP02_EVENT_KINDS = {
  request: 7300,
  transition: 7301,
  evidence: 7302,
  dispute: 7303,
  note: 7304,
  snapshot: 30362,
} as const;

/** PIP-02 required request fields. Payload semantics remain protocol-owned and unextended here. */
export interface PontmoreSwapRequestContent {
  readonly version: number;
  readonly swap_id: string;
  readonly swap_type: string;
  readonly agent: string;
  readonly customer: string;
  readonly escrow_reference: string;
  readonly fiat: unknown;
  readonly bitcoin: unknown;
  readonly expiry: number;
}

/**
 * PactAgent's narrow application state vocabulary carried by PIP-02 transition events.
 * PIP-02 defines coherence and event fields but currently does not define state values.
 */
export type DocumentSummaryLifecycleState =
  | "requested"
  | "offer_accepted"
  | "funding_intended"
  | "escrow_secured"
  | "work_started"
  | "delivered"
  | "verified"
  | "release_intended"
  | "refund_intended"
  | "disputed"
  | "resolved"
  | "settled"
  | "refunded"
  | "cancelled";

export interface PontmoreTransitionContent {
  readonly swap_id: string;
  readonly state: DocumentSummaryLifecycleState;
  readonly prev_state: DocumentSummaryLifecycleState;
  readonly actor_role: "customer" | "agent" | "escrow_operator";
  readonly reason: string;
  readonly created_at: number;
}

export interface PontmoreTransitionDraft {
  readonly event: UnsignedNostrEvent;
  readonly content: PontmoreTransitionContent;
}

const ALLOWED_TRANSITIONS: Readonly<Record<DocumentSummaryLifecycleState, readonly DocumentSummaryLifecycleState[]>> = {
  requested: ["offer_accepted", "cancelled"],
  offer_accepted: ["funding_intended", "cancelled"],
  funding_intended: ["escrow_secured", "cancelled"],
  escrow_secured: ["work_started", "refund_intended", "disputed"],
  work_started: ["delivered", "refund_intended", "disputed"],
  delivered: ["verified", "refund_intended", "disputed"],
  verified: ["release_intended", "disputed"],
  release_intended: ["settled", "disputed"],
  refund_intended: ["refunded", "disputed"],
  disputed: ["resolved"],
  resolved: ["settled", "refunded"],
  settled: [],
  refunded: [],
  cancelled: [],
};

export function isValidDocumentSummaryTransition(
  previous: DocumentSummaryLifecycleState,
  next: DocumentSummaryLifecycleState,
): boolean {
  return ALLOWED_TRANSITIONS[previous]?.includes(next) ?? false;
}

export function parsePontmoreTransitionDraft(serialized: string): PontmoreTransitionDraft {
  const event = parseUnsignedNostrEvent(serialized);
  if (event.kind !== PIP02_EVENT_KINDS.transition) {
    throw new InvalidDomainInputError("PIP-02 transition must use kind 7301");
  }
  let content: unknown;
  try {
    content = JSON.parse(event.content);
  } catch {
    throw new InvalidDomainInputError("PIP-02 transition content must be valid JSON");
  }
  if (typeof content !== "object" || content === null) {
    throw new InvalidDomainInputError("PIP-02 transition content must be an object");
  }
  const candidate = content as Record<string, unknown>;
  if (
    typeof candidate.swap_id !== "string" ||
    typeof candidate.state !== "string" ||
    typeof candidate.prev_state !== "string" ||
    !["customer", "agent", "escrow_operator"].includes(String(candidate.actor_role)) ||
    typeof candidate.reason !== "string" ||
    !Number.isInteger(candidate.created_at) ||
    !isValidDocumentSummaryTransition(
      candidate.prev_state as DocumentSummaryLifecycleState,
      candidate.state as DocumentSummaryLifecycleState,
    )
  ) {
    throw new InvalidDomainInputError("PIP-02 transition content is invalid");
  }
  return {
    event,
    content: {
      swap_id: candidate.swap_id,
      state: candidate.state as DocumentSummaryLifecycleState,
      prev_state: candidate.prev_state as DocumentSummaryLifecycleState,
      actor_role: candidate.actor_role as PontmoreTransitionContent["actor_role"],
      reason: candidate.reason,
      created_at: candidate.created_at as number,
    },
  };
}

export function createPontmoreTransitionDraft(input: {
  identity: NostrIdentity;
  swapId: string;
  previous: DocumentSummaryLifecycleState;
  next: DocumentSummaryLifecycleState;
  actorRole: PontmoreTransitionContent["actor_role"];
  reason: string;
  createdAt: number;
}): PontmoreTransitionDraft {
  if (!input.swapId.trim() || !input.reason.trim()) {
    throw new InvalidDomainInputError("PIP-02 transition swap_id and reason must be non-empty");
  }
  if (!Number.isInteger(input.createdAt) || input.createdAt < 0) {
    throw new InvalidDomainInputError("PIP-02 transition created_at must be a non-negative integer");
  }
  if (!isValidDocumentSummaryTransition(input.previous, input.next)) {
    throw new InvalidDomainInputError(`Invalid document-summary transition: ${input.previous} -> ${input.next}`);
  }
  const content: PontmoreTransitionContent = {
    swap_id: input.swapId,
    state: input.next,
    prev_state: input.previous,
    actor_role: input.actorRole,
    reason: input.reason,
    created_at: input.createdAt,
  };
  return {
    event: {
      pubkey: input.identity.publicKey,
      created_at: input.createdAt,
      kind: PIP02_EVENT_KINDS.transition,
      tags: [],
      content: JSON.stringify(content),
    },
    content,
  };
}

export function validateTransitionSequence(
  initialState: DocumentSummaryLifecycleState,
  transitions: readonly PontmoreTransitionDraft[],
): DocumentSummaryLifecycleState {
  let currentState = initialState;
  let previousTimestamp = -1;
  let swapId: string | undefined;

  for (const transition of transitions) {
    if (transition.event.kind !== PIP02_EVENT_KINDS.transition) {
      throw new InvalidDomainInputError("Lifecycle history may contain only PIP-02 transition events");
    }
    if (transition.event.content !== JSON.stringify(transition.content)) {
      throw new InvalidDomainInputError("PIP-02 transition event and parsed content must agree");
    }
    if (transition.content.prev_state !== currentState) {
      throw new InvalidDomainInputError("PIP-02 transition history is not sequence-coherent");
    }
    if (!isValidDocumentSummaryTransition(currentState, transition.content.state)) {
      throw new InvalidDomainInputError("PIP-02 transition history contains an invalid state change");
    }
    if (transition.content.created_at < previousTimestamp) {
      throw new InvalidDomainInputError("PIP-02 transition history timestamps must be append-only");
    }
    swapId ??= transition.content.swap_id;
    if (transition.content.swap_id !== swapId) {
      throw new InvalidDomainInputError("PIP-02 transition history must reference one swap_id");
    }
    currentState = transition.content.state;
    previousTimestamp = transition.content.created_at;
  }
  return currentState;
}
