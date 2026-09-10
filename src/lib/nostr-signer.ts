import { randomBytes } from "node:crypto";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";

import { InvalidDomainInputError } from "../domain/errors";
import {
  type NostrSigner,
  type SignedNostrEvent,
  type UnsignedNostrEvent,
  nostrPublicKey,
} from "../domain/nostr";

const PRIVATE_KEY_PATTERN = /^[0-9a-f]{64}$/;

/** A 32-byte Nostr private key encoded as 64 lowercase hex characters. Module-local brand. */
type NostrPrivateKey = string & { readonly __nostrPrivateKey: "NostrPrivateKey" };

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

function parseNostrPrivateKey(value: string): NostrPrivateKey {
  if (typeof value !== "string" || !PRIVATE_KEY_PATTERN.test(value)) {
    throw new InvalidDomainInputError("Nostr private key must be 64 lowercase hexadecimal characters");
  }
  return value as NostrPrivateKey;
}

/**
 * Generate a fresh, cryptographically random 32-byte Nostr private key as 64 lowercase
 * hex characters, for local development identities only. The result is never stored by
 * the signer; the caller is responsible for keeping it out of logs and public models.
 */
export function generateNostrPrivateKey(): string {
  return bytesToHex(randomBytes(32));
}

/**
 * Create a local Nostr signer that holds a private key only inside the returned closure.
 *
 * The returned object exposes exactly two members:
 *   - `publicKey`: the derived x-only public key, safe to share; and
 *   - `sign`: accepts an {@link UnsignedNostrEvent} and resolves to a {@link SignedNostrEvent}.
 *
 * The private key is never attached as a property of the returned object, never returned
 * from any method, and never placed onto signed event output. There is no accessor for it,
 * which is the mechanism that keeps AI callers — or any other caller — from reaching it.
 *
 * Signing is deterministic (BIP-340 RFC-6979-style nonce) and has no model, network, or
 * external dependency beyond the held key: it is a pure function of the event and that key.
 * It reuses the same nostr-tools crypto stack the domain uses for signature verification.
 */
export function createLocalNostrSigner(privateKeyHex: string): NostrSigner {
  const privateKey = parseNostrPrivateKey(privateKeyHex);
  const secretKeyBytes = hexToBytes(privateKey);
  const publicKey = nostrPublicKey(getPublicKey(secretKeyBytes));

  return {
    publicKey,
    async sign(event: UnsignedNostrEvent): Promise<SignedNostrEvent> {
      if (event.pubkey !== publicKey) {
        throw new InvalidDomainInputError("Signer can only sign events for its own identity");
      }
      // finalizeEvent mutates its template, so build a throwaway copy that excludes id/sig.
      const template = {
        pubkey: event.pubkey,
        created_at: event.created_at,
        kind: event.kind,
        tags: event.tags.map((tag) => [...tag]),
        content: event.content,
      };
      const signed = finalizeEvent(template, secretKeyBytes);
      return {
        pubkey: nostrPublicKey(signed.pubkey),
        created_at: signed.created_at,
        kind: signed.kind,
        tags: event.tags,
        content: signed.content,
        id: signed.id,
        sig: signed.sig,
      };
    },
  };
}
