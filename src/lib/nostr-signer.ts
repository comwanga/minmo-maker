import { finalizeEvent, getPublicKey } from "nostr-tools/pure";

import { InvalidDomainInputError } from "../domain/errors";
import {
  type NostrSigner,
  type SignedNostrEvent,
  type UnsignedNostrEvent,
  nostrPublicKey,
} from "../domain/nostr";

const PRIVATE_KEY_PATTERN = /^[0-9a-f]{64}$/;

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

// For local development identities only; keep it out of logs and public models.
export function generateNostrPrivateKey(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

/*
 * Holds a private key only inside the returned closure; it is never attached as a
 * property, returned from any method, or placed onto signed event output, so no
 * caller — AI or otherwise — can reach it. Signing is a pure function of the event
 * and the held key, reusing the domain's nostr-tools crypto stack.
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
