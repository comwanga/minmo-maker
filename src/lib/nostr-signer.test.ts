import { describe, expect, it } from "vitest";

import type { NostrTag, SignedNostrEvent, UnsignedNostrEvent } from "../domain/nostr";
import { InvalidDomainInputError } from "../domain/errors";
import {
  NostrEventValidationError,
  parseSignedNostrEvent,
  parseUnsignedNostrEvent,
  serializeSignedNostrEvent,
  verifySignedNostrEvent,
} from "../domain/nostr";
import { createLocalNostrSigner, generateNostrPrivateKey } from "./nostr-signer";

const HEX64_PATTERN = /^[0-9a-f]{64}$/;
const SIGNATURE_PATTERN = /^[0-9a-f]{128}$/;

const P001_PRIVATE_KEY = "11".repeat(32);
const P002_PRIVATE_KEY = "22".repeat(32);

function unsignedEvent(
  pubkey: string,
  overrides: Partial<UnsignedNostrEvent> = {},
): UnsignedNostrEvent {
  return {
    pubkey: pubkey as UnsignedNostrEvent["pubkey"],
    created_at: 1_788_853_200,
    kind: 1,
    tags: [["p", "ab".repeat(32)]] as readonly NostrTag[],
    content: "hello pactagent",
    ...overrides,
  };
}

describe("local Nostr signer", () => {
  it("gives P001 and P002 independent signing identities", () => {
    const p001 = createLocalNostrSigner(P001_PRIVATE_KEY);
    const p002 = createLocalNostrSigner(P002_PRIVATE_KEY);

    expect(p001.publicKey).not.toBe(p002.publicKey);
    expect(p001.publicKey).toMatch(HEX64_PATTERN);
    expect(p002.publicKey).toMatch(HEX64_PATTERN);
  });

  it("exposes the public key without exposing the private key", () => {
    const signer = createLocalNostrSigner(P001_PRIVATE_KEY);

    expect(signer.publicKey).toMatch(HEX64_PATTERN);
    expect(signer.publicKey).not.toBe(P001_PRIVATE_KEY);
  });

  it("signs an unsigned event and returns id + sig with preserved fields", async () => {
    const signer = createLocalNostrSigner(P001_PRIVATE_KEY);
    const unsigned = unsignedEvent(signer.publicKey);

    const signed = await signer.sign(unsigned);

    expect(signed.id).toMatch(HEX64_PATTERN);
    expect(signed.sig).toMatch(SIGNATURE_PATTERN);
    expect(signed.pubkey).toBe(unsigned.pubkey);
    expect(signed.created_at).toBe(unsigned.created_at);
    expect(signed.kind).toBe(unsigned.kind);
    expect(signed.tags).toEqual(unsigned.tags);
    expect(signed.tags).not.toBe(unsigned.tags);
    expect(signed.content).toBe(unsigned.content);
  });

  it("does not alias mutable input tags into the signed event", async () => {
    const signer = createLocalNostrSigner(P001_PRIVATE_KEY);
    const mutableTags: [string, string][] = [["p", "ab".repeat(32)]];
    const unsigned = unsignedEvent(signer.publicKey, {
      tags: mutableTags,
    });

    const signed = await signer.sign(unsigned);

    mutableTags[0][1] = "cd".repeat(32);

    expect(signed.tags[0][1]).toBe("ab".repeat(32));
    expect(() => verifySignedNostrEvent(signed)).not.toThrow();
  });

  it("produces a signature that verifies via the domain verifier", async () => {
    const signer = createLocalNostrSigner(P001_PRIVATE_KEY);
    const signed = await signer.sign(unsignedEvent(signer.publicKey));

    expect(() => verifySignedNostrEvent(signed)).not.toThrow();
  });

  it("rejects a signature over tampered content", async () => {
    const signer = createLocalNostrSigner(P001_PRIVATE_KEY);
    const signed = await signer.sign(unsignedEvent(signer.publicKey));

    expect(() => verifySignedNostrEvent({ ...signed, content: "tampered" })).toThrow(NostrEventValidationError);
  });

  it("rejects a tampered signature", async () => {
    const signer = createLocalNostrSigner(P001_PRIVATE_KEY);
    const signed = await signer.sign(unsignedEvent(signer.publicKey));

    expect(() => verifySignedNostrEvent({ ...signed, sig: "00".repeat(64) })).toThrow(NostrEventValidationError);
  });

  it("rejects a signature whose id does not match the recomputed id", async () => {
    const signer = createLocalNostrSigner(P001_PRIVATE_KEY);
    const signed = await signer.sign(unsignedEvent(signer.publicKey));

    expect(() => verifySignedNostrEvent({ ...signed, id: "00".repeat(32) })).toThrow(NostrEventValidationError);
  });

  it("rejects a signature whose pubkey differs from the signer", async () => {
    const signer = createLocalNostrSigner(P001_PRIVATE_KEY);
    const signed = await signer.sign(unsignedEvent(signer.publicKey));

    expect(() => verifySignedNostrEvent({ ...signed, pubkey: "ff".repeat(32) } as unknown as SignedNostrEvent)).toThrow(
      NostrEventValidationError,
    );
  });

  it("refuses to sign an event whose pubkey is not its own", async () => {
    const signer = createLocalNostrSigner(P001_PRIVATE_KEY);
    const otherPubkey = createLocalNostrSigner(P002_PRIVATE_KEY).publicKey;

    await expect(signer.sign(unsignedEvent(otherPubkey))).rejects.toBeInstanceOf(InvalidDomainInputError);
  });

  it("signs as a self-contained function with no model or external dependency", async () => {
    const signer = createLocalNostrSigner(P001_PRIVATE_KEY);
    const unsigned = unsignedEvent(signer.publicKey);

    const first = await signer.sign(unsigned);
    const second = await signer.sign(unsigned);

    expect(second.id).toBe(first.id);
    expect(() => verifySignedNostrEvent(first)).not.toThrow();
    expect(() => verifySignedNostrEvent(second)).not.toThrow();
  });

  describe("secret boundary", () => {
    it("exposes only publicKey and sign on the signer object", () => {
      const signer = createLocalNostrSigner(P001_PRIVATE_KEY);

      expect(Object.keys(signer).sort()).toEqual(["publicKey", "sign"]);
    });

    it("never leaks the private key through JSON serialization of the signer", () => {
      const signer = createLocalNostrSigner(P001_PRIVATE_KEY);

      expect(JSON.stringify(signer)).not.toContain(P001_PRIVATE_KEY);
    });

    it("never leaks the private key through any own enumerable property", () => {
      const signer = createLocalNostrSigner(P001_PRIVATE_KEY) as unknown as Record<string, unknown>;

      for (const value of Object.values(signer)) {
        expect(String(value)).not.toContain(P001_PRIVATE_KEY);
      }
    });

    it("never places private-key material on signed event output", async () => {
      const signer = createLocalNostrSigner(P001_PRIVATE_KEY);
      const signed = await signer.sign(unsignedEvent(signer.publicKey));
      const serialized = serializeSignedNostrEvent(signed);

      expect(serialized).not.toContain(P001_PRIVATE_KEY);
      expect(serialized).not.toContain("privateKey");
      expect(serialized).not.toContain("nsec");
      expect(serialized).not.toContain("secretKey");
    });

    it("still rejects private-key fields when an unsigned event is parsed", () => {
      const signer = createLocalNostrSigner(P001_PRIVATE_KEY);
      const event = unsignedEvent(signer.publicKey);
      const poisoned = { ...event, privateKey: P001_PRIVATE_KEY };

      expect(() => parseUnsignedNostrEvent(JSON.stringify(poisoned))).toThrow(InvalidDomainInputError);
    });

    it("domain parsing rejects a signed event carrying extra secret fields", async () => {
      const signer = createLocalNostrSigner(P001_PRIVATE_KEY);
      const signed = await signer.sign(unsignedEvent(signer.publicKey));
      const poisoned = { ...signed, privateKey: P001_PRIVATE_KEY } as unknown as SignedNostrEvent;

      expect(() => parseSignedNostrEvent(poisoned)).toThrow(NostrEventValidationError);
    });
  });

  describe("generateNostrPrivateKey", () => {
    it("returns a valid 64-hex key that differs between calls", () => {
      const a = generateNostrPrivateKey();
      const b = generateNostrPrivateKey();

      expect(a).toMatch(HEX64_PATTERN);
      expect(b).toMatch(HEX64_PATTERN);
      expect(a).not.toBe(b);

      const signer = createLocalNostrSigner(a);
      expect(signer.publicKey).toMatch(HEX64_PATTERN);
    });
  });

  describe("invalid private keys", () => {
    it("rejects non-hex input", () => {
      expect(() => createLocalNostrSigner("z".repeat(64))).toThrow(InvalidDomainInputError);
    });

    it("rejects the wrong length", () => {
      expect(() => createLocalNostrSigner("11".repeat(31))).toThrow(InvalidDomainInputError);
    });

    it("rejects the zero scalar", () => {
      expect(() => createLocalNostrSigner("00".repeat(32))).toThrow(InvalidDomainInputError);
    });

    it("rejects a scalar equal to the secp256k1 group order", () => {
      const groupOrder = "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141";
      expect(() => createLocalNostrSigner(groupOrder)).toThrow(InvalidDomainInputError);
    });

    it("rejects a scalar greater than the secp256k1 group order", () => {
      const aboveOrder = "ffffffffffffffffffffffffffffffffbaaedce6af48a03bbfd25e8cd0364141";
      expect(() => createLocalNostrSigner(aboveOrder)).toThrow(InvalidDomainInputError);
    });
  });
});
