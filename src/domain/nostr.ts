import { InvalidDomainInputError } from "./errors";

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
