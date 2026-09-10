import { InvalidDomainInputError } from "./errors";
import { verifyEvent } from "nostr-tools/pure";

declare const nostrPublicKeyBrand: unique symbol;

/** A lowercase 32-byte Nostr public key encoded as 64 hexadecimal characters. */
export type NostrPublicKey = string & { readonly [nostrPublicKeyBrand]: "NostrPublicKey" };
export type NostrTag = readonly [string, ...string[]];

export interface NostrIdentity {
  readonly publicKey: NostrPublicKey;
  readonly relays: readonly string[];
}

/** An event awaiting a separate signer. It intentionally has no private-key field. */
export interface UnsignedNostrEvent {
  readonly pubkey: NostrPublicKey;
  readonly created_at: number;
  readonly kind: number;
  readonly tags: readonly NostrTag[];
  readonly content: string;
}

export interface SignedNostrEvent extends UnsignedNostrEvent {
  readonly id: string;
  readonly sig: string;
}

/** Signing is an execution boundary; callers submit unsigned data, never key material. */
export interface NostrSigner {
  sign(event: UnsignedNostrEvent): Promise<SignedNostrEvent>;
}

export type NostrEventValidationErrorCode = "invalid_nostr_event" | "invalid_signature";

export class NostrEventValidationError extends InvalidDomainInputError {
  readonly code: NostrEventValidationErrorCode;

  constructor(code: NostrEventValidationErrorCode, message: string) {
    super(message);
    this.name = "NostrEventValidationError";
    this.code = code;
  }
}

export function nostrPublicKey(value: string): NostrPublicKey {
  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw new InvalidDomainInputError("Nostr public key must be 64 lowercase hexadecimal characters");
  }
  return value as NostrPublicKey;
}

export function createNostrIdentity(publicKey: string, relays: readonly string[]): NostrIdentity {
  if (relays.length === 0) throw new InvalidDomainInputError("Nostr identity requires at least one relay");
  const normalizedRelays = [...new Set(relays.map((relay) => relay.trim()))];
  for (const relay of normalizedRelays) {
    try {
      if (new URL(relay).protocol !== "wss:") throw new Error("not wss");
    } catch {
      throw new InvalidDomainInputError("Nostr relay URLs must use wss://");
    }
  }
  return { publicKey: nostrPublicKey(publicKey), relays: normalizedRelays };
}

export function serializeUnsignedNostrEvent(event: UnsignedNostrEvent): string {
  return JSON.stringify(event);
}

export function serializeSignedNostrEvent(event: SignedNostrEvent): string {
  return JSON.stringify(event);
}

export function parseUnsignedNostrEvent(value: string): UnsignedNostrEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new InvalidDomainInputError("Nostr event must be valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new InvalidDomainInputError("Nostr event must be an object");
  }

  const candidate = parsed as Record<string, unknown>;
  const allowedKeys = ["pubkey", "created_at", "kind", "tags", "content"];
  if (Object.keys(candidate).some((key) => !allowedKeys.includes(key))) {
    throw new InvalidDomainInputError("Unsigned Nostr event contains unsupported fields");
  }
  if ("privateKey" in candidate || "nsec" in candidate || "secretKey" in candidate) {
    throw new InvalidDomainInputError("Nostr event must not contain private key material");
  }
  if (!Number.isInteger(candidate.created_at) || (candidate.created_at as number) < 0) {
    throw new InvalidDomainInputError("Nostr event created_at must be a non-negative integer");
  }
  if (!Number.isInteger(candidate.kind) || (candidate.kind as number) < 0) {
    throw new InvalidDomainInputError("Nostr event kind must be a non-negative integer");
  }
  if (typeof candidate.content !== "string" || !Array.isArray(candidate.tags)) {
    throw new InvalidDomainInputError("Nostr event content and tags are invalid");
  }
  const tags = candidate.tags.map((tag) => {
    if (!Array.isArray(tag) || tag.length === 0 || !tag.every((item) => typeof item === "string")) {
      throw new InvalidDomainInputError("Nostr event tags must be non-empty string arrays");
    }
    return tag as unknown as NostrTag;
  });

  return {
    pubkey: nostrPublicKey(String(candidate.pubkey)),
    created_at: candidate.created_at as number,
    kind: candidate.kind as number,
    tags,
    content: candidate.content,
  };
}

/** Validates the untrusted wire representation of a signed Nostr event. */
export function parseSignedNostrEvent(value: unknown): SignedNostrEvent {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new NostrEventValidationError("invalid_nostr_event", "Signed Nostr event must be valid JSON");
    }
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new NostrEventValidationError("invalid_nostr_event", "Signed Nostr event must be an object");
  }

  const candidate = parsed as Record<string, unknown>;
  const allowedKeys = ["id", "pubkey", "created_at", "kind", "tags", "content", "sig"];
  if (Object.keys(candidate).some((key) => !allowedKeys.includes(key))) {
    throw new NostrEventValidationError(
      "invalid_nostr_event",
      "Signed Nostr event contains unsupported fields",
    );
  }
  if (!/^[0-9a-f]{64}$/.test(String(candidate.id))) {
    throw new NostrEventValidationError("invalid_nostr_event", "Nostr event id must be 64 lowercase hexadecimal characters");
  }
  if (!/^[0-9a-f]{128}$/.test(String(candidate.sig))) {
    throw new NostrEventValidationError("invalid_nostr_event", "Nostr event signature must be 128 lowercase hexadecimal characters");
  }

  let unsigned: UnsignedNostrEvent;
  try {
    unsigned = parseUnsignedNostrEvent(
      JSON.stringify({
        pubkey: candidate.pubkey,
        created_at: candidate.created_at,
        kind: candidate.kind,
        tags: candidate.tags,
        content: candidate.content,
      }),
    );
  } catch {
    throw new NostrEventValidationError("invalid_nostr_event", "Signed Nostr event fields are invalid");
  }

  return {
    ...unsigned,
    id: candidate.id as string,
    sig: candidate.sig as string,
  };
}

/** Verifies both the NIP-01 event id and its Schnorr signature. */
export function verifySignedNostrEvent(event: SignedNostrEvent): void {
  const wireEvent = {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags.map((tag) => [...tag]),
    content: event.content,
    sig: event.sig,
  };
  if (!verifyEvent(wireEvent)) {
    throw new NostrEventValidationError(
      "invalid_signature",
      "Nostr event id or signature is invalid",
    );
  }
}
