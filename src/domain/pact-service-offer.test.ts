import { describe, expect, it } from "vitest";

import { InvalidDomainInputError } from "./errors";
import { btcToSats, sats, type Sats } from "./money";
import { createNostrIdentity, serializeUnsignedNostrEvent, type NostrTag } from "./nostr";
import {
  createPactServiceOffer,
  PACTAGENT_DOCUMENT_SUMMARY_CAPABILITY_ID,
  PACTAGENT_SERVICE_OFFER_CONTENT_VERSION,
  PACTAGENT_SERVICE_OFFER_KIND,
  PactServiceOfferError,
  parsePactServiceOffer,
  parsePactServiceOfferEvent,
  parsePactServiceOfferReference,
  resolveOfferAddressFromPricingPolicy,
  type PactServiceOfferContent,
} from "./pact-service-offer";
import { createCashuEscrowDescriptor } from "./pontmore-escrow";

const FIXTURE_TIME = 1_788_853_200;
const RELAYS = ["wss://relay.example"] as const;

function createOfferFixture(overrides?: {
  readonly amountSats?: Sats;
  readonly maximumExecutionSeconds?: number;
  readonly validFrom?: number;
  readonly expiresAt?: number;
}) {
  const identity = createNostrIdentity("22".repeat(32), RELAYS);
  const escrowDescriptor = createCashuEscrowDescriptor({
    identity,
    identifier: "cashu-document-summary",
    updatedAt: FIXTURE_TIME,
    referenceFormat: "opaque_service_reference",
  });
  const offer = createPactServiceOffer({
    identity,
    identifier: "document-summary-offer",
    capabilityProfile: { id: PACTAGENT_DOCUMENT_SUMMARY_CAPABILITY_ID, version: 1 },
    amountSats: overrides?.amountSats ?? btcToSats("0.00000350"),
    settlementNetwork: "cashu",
    escrowDescriptorReference: escrowDescriptor.address,
    maximumExecutionSeconds: overrides?.maximumExecutionSeconds ?? 120,
    validFrom: overrides?.validFrom ?? FIXTURE_TIME,
    expiresAt: overrides?.expiresAt ?? FIXTURE_TIME + 3_600,
    updatedAt: FIXTURE_TIME,
  });
  return { identity, escrowDescriptor, offer };
}

describe("PactAgent signed service offer", () => {
  describe("createPactServiceOffer", () => {
    it("creates a valid offer bound to the provider identity and escrow descriptor", () => {
      const { identity, escrowDescriptor, offer } = createOfferFixture();
      expect(offer.event.kind).toBe(PACTAGENT_SERVICE_OFFER_KIND);
      expect(offer.event.pubkey).toBe(identity.publicKey);
      expect(offer.content.provider).toBe(identity.publicKey);
      expect(offer.amountSats).toBe(btcToSats("0.00000350"));
      expect(offer.content.amount_sats).toBe("350");
      expect(offer.content.capability_profile).toEqual({
        id: PACTAGENT_DOCUMENT_SUMMARY_CAPABILITY_ID,
        version: 1,
      });
      expect(offer.content.escrow_descriptor).toBe(escrowDescriptor.address);
      expect(offer.content.settlement_network).toBe("cashu");
      expect(offer.address).toBe(`30400:${identity.publicKey}:document-summary-offer`);
    });

    it("tags the escrow descriptor address in the a tag matching content", () => {
      const { escrowDescriptor, offer } = createOfferFixture();
      const aTags = offer.event.tags.filter((tag) => tag[0] === "a");
      expect(aTags).toEqual([["a", escrowDescriptor.address]]);
      expect(offer.content.escrow_descriptor).toBe(escrowDescriptor.address);
    });

    it("rejects a zero amount", () => {
      expect(() => createOfferFixture({ amountSats: sats(0n) })).toThrow(PactServiceOfferError);
    });

    it("accepts a valid positive integer amount", () => {
      const { identity, escrowDescriptor } = createOfferFixture();
      expect(() =>
        createPactServiceOffer({
          identity,
          identifier: "document-summary-offer",
          capabilityProfile: { id: PACTAGENT_DOCUMENT_SUMMARY_CAPABILITY_ID, version: 1 },
          amountSats: sats(1n),
          settlementNetwork: "cashu",
          escrowDescriptorReference: escrowDescriptor.address,
          maximumExecutionSeconds: 120,
          validFrom: FIXTURE_TIME,
          expiresAt: FIXTURE_TIME + 3_600,
          updatedAt: FIXTURE_TIME,
        }),
      ).not.toThrow();
    });

    it("rejects an unsupported settlement network", () => {
      const { identity, escrowDescriptor } = createOfferFixture();
      expect(() =>
        createPactServiceOffer({
          identity,
          identifier: "document-summary-offer",
          capabilityProfile: { id: PACTAGENT_DOCUMENT_SUMMARY_CAPABILITY_ID, version: 1 },
          amountSats: btcToSats("0.00000350"),
          settlementNetwork: "lightning" as "cashu",
          escrowDescriptorReference: escrowDescriptor.address,
          maximumExecutionSeconds: 120,
          validFrom: FIXTURE_TIME,
          expiresAt: FIXTURE_TIME + 3_600,
          updatedAt: FIXTURE_TIME,
        }),
      ).toThrow(PactServiceOfferError);
    });

    it("rejects an invalid execution duration", () => {
      expect(() => createOfferFixture({ maximumExecutionSeconds: 0 })).toThrow(PactServiceOfferError);
    });

    it("rejects an inverted validity window", () => {
      expect(() =>
        createOfferFixture({ validFrom: FIXTURE_TIME + 1_000, expiresAt: FIXTURE_TIME }),
      ).toThrow(PactServiceOfferError);
    });

    it("rejects a malformed escrow descriptor reference", () => {
      const { identity } = createOfferFixture();
      expect(() =>
        createPactServiceOffer({
          identity,
          identifier: "document-summary-offer",
          capabilityProfile: { id: PACTAGENT_DOCUMENT_SUMMARY_CAPABILITY_ID, version: 1 },
          amountSats: btcToSats("0.00000350"),
          settlementNetwork: "cashu",
          escrowDescriptorReference: "not-an-address",
          maximumExecutionSeconds: 120,
          validFrom: FIXTURE_TIME,
          expiresAt: FIXTURE_TIME + 3_600,
          updatedAt: FIXTURE_TIME,
        }),
      ).toThrow(PactServiceOfferError);
    });

    it("rejects unsupported input fields", () => {
      const { identity, escrowDescriptor } = createOfferFixture();
      expect(() =>
        createPactServiceOffer({
          identity,
          identifier: "document-summary-offer",
          capabilityProfile: { id: PACTAGENT_DOCUMENT_SUMMARY_CAPABILITY_ID, version: 1 },
          amountSats: btcToSats("0.00000350"),
          settlementNetwork: "cashu",
          escrowDescriptorReference: escrowDescriptor.address,
          maximumExecutionSeconds: 120,
          validFrom: FIXTURE_TIME,
          expiresAt: FIXTURE_TIME + 3_600,
          updatedAt: FIXTURE_TIME,
          extra: true,
        } as Partial<Parameters<typeof createPactServiceOffer>[0]> as Parameters<typeof createPactServiceOffer>[0]),
      ).toThrow(PactServiceOfferError);
    });

    it("rejects a forbidden private field in identifier", () => {
      const { identity, escrowDescriptor } = createOfferFixture();
      expect(() =>
        createPactServiceOffer({
          identity,
          identifier: "cashuA-token",
          capabilityProfile: { id: PACTAGENT_DOCUMENT_SUMMARY_CAPABILITY_ID, version: 1 },
          amountSats: btcToSats("0.00000350"),
          settlementNetwork: "cashu",
          escrowDescriptorReference: escrowDescriptor.address,
          maximumExecutionSeconds: 120,
          validFrom: FIXTURE_TIME,
          expiresAt: FIXTURE_TIME + 3_600,
          updatedAt: FIXTURE_TIME,
        }),
      ).toThrow(PactServiceOfferError);
    });
  });

  describe("parsePactServiceOfferEvent", () => {
    it("round-trips a created offer through serialization", () => {
      const { offer } = createOfferFixture();
      const parsed = parsePactServiceOffer(serializeUnsignedNostrEvent(offer.event));
      expect(parsed).toEqual(offer);
    });

    it("rejects the wrong kind", () => {
      const { offer } = createOfferFixture();
      const wrongKind = { ...offer.event, kind: 30360 };
      expect(() => parsePactServiceOfferEvent(wrongKind)).toThrow(PactServiceOfferError);
    });

    it("rejects content.provider that disagrees with the event author", () => {
      const { offer } = createOfferFixture();
      const content = JSON.parse(offer.event.content) as PactServiceOfferContent;
      const other = "ab".repeat(32);
      const tampered = {
        ...offer.event,
        content: JSON.stringify({ ...content, provider: other }),
      };
      expect(() => parsePactServiceOfferEvent(tampered)).toThrow(PactServiceOfferError);
    });

    it("rejects an unsupported capability profile id", () => {
      const { offer } = createOfferFixture();
      const content = JSON.parse(offer.event.content) as PactServiceOfferContent;
      const tampered = {
        ...offer.event,
        content: JSON.stringify({
          ...content,
          capability_profile: { id: "pactagent/other", version: 1 },
        }),
      };
      expect(() => parsePactServiceOfferEvent(tampered)).toThrow(PactServiceOfferError);
    });

    it("rejects an escrow_descriptor content field that disagrees with the a tag", () => {
      const { offer } = createOfferFixture();
      const content = JSON.parse(offer.event.content) as PactServiceOfferContent;
      const tampered = {
        ...offer.event,
        content: JSON.stringify({ ...content, escrow_descriptor: `30361:${"ab".repeat(32)}:other` }),
      };
      expect(() => parsePactServiceOfferEvent(tampered)).toThrow(PactServiceOfferError);
    });

    it("rejects a fractional amount string", () => {
      const { offer } = createOfferFixture();
      const content = JSON.parse(offer.event.content) as PactServiceOfferContent;
      const tampered = {
        ...offer.event,
        content: JSON.stringify({ ...content, amount_sats: "350.5" }),
      };
      expect(() => parsePactServiceOfferEvent(tampered)).toThrow(PactServiceOfferError);
    });

    it("rejects a negative amount string", () => {
      const { offer } = createOfferFixture();
      const content = JSON.parse(offer.event.content) as PactServiceOfferContent;
      const tampered = {
        ...offer.event,
        content: JSON.stringify({ ...content, amount_sats: "-350" }),
      };
      expect(() => parsePactServiceOfferEvent(tampered)).toThrow(PactServiceOfferError);
    });

    it("rejects an unsupported content field", () => {
      const { offer } = createOfferFixture();
      const content = JSON.parse(offer.event.content) as PactServiceOfferContent;
      const tampered = {
        ...offer.event,
        content: JSON.stringify({ ...content, lifecycle_state: "active" }),
      };
      expect(() => parsePactServiceOfferEvent(tampered)).toThrow(PactServiceOfferError);
    });

    it("rejects a duplicate d tag", () => {
      const { offer } = createOfferFixture();
      const dupD: NostrTag[] = [...offer.event.tags, ["d", "document-summary-offer"]];
      const tampered = { ...offer.event, tags: dupD };
      expect(() => parsePactServiceOfferEvent(tampered)).toThrow(PactServiceOfferError);
    });

    it("rejects an unsupported tag", () => {
      const { offer } = createOfferFixture();
      const tampered = { ...offer.event, tags: [...offer.event.tags, ["x", "unknown"]] as NostrTag[] };
      expect(() => parsePactServiceOfferEvent(tampered)).toThrow(PactServiceOfferError);
    });

    it("rejects updated_at that does not match created_at", () => {
      const { offer } = createOfferFixture();
      const content = JSON.parse(offer.event.content) as PactServiceOfferContent;
      const tampered = {
        ...offer.event,
        content: JSON.stringify({ ...content, updated_at: FIXTURE_TIME + 1 }),
      };
      expect(() => parsePactServiceOfferEvent(tampered)).toThrow(PactServiceOfferError);
    });

    it("rejects unsupported content version", () => {
      const { offer } = createOfferFixture();
      const content = JSON.parse(offer.event.content) as PactServiceOfferContent;
      const tampered = {
        ...offer.event,
        content: JSON.stringify({ ...content, version: 2 }),
      };
      expect(() => parsePactServiceOfferEvent(tampered)).toThrow(PactServiceOfferError);
    });
  });

  describe("parsePactServiceOfferReference", () => {
    it("parses a canonical service-offer address", () => {
      const { offer } = createOfferFixture();
      const ref = parsePactServiceOfferReference(offer.address);
      expect(ref.kind).toBe(PACTAGENT_SERVICE_OFFER_KIND);
      expect(ref.identifier).toBe("document-summary-offer");
    });

    it("rejects a malformed reference", () => {
      expect(() => parsePactServiceOfferReference("not-an-address")).toThrow(PactServiceOfferError);
    });
  });

  describe("resolveOfferAddressFromPricingPolicy", () => {
    it("resolves a provider-owned offer reference", () => {
      const { identity, offer } = createOfferFixture();
      const ref = resolveOfferAddressFromPricingPolicy(offer.address, identity.publicKey);
      expect(ref.identifier).toBe("document-summary-offer");
    });

    it("rejects a reference owned by a different provider", () => {
      const { offer } = createOfferFixture();
      const other = "ab".repeat(32);
      expect(() => resolveOfferAddressFromPricingPolicy(offer.address, other as never)).toThrow(PactServiceOfferError);
    });

    it("rejects a non-offer pricing_policy string", () => {
      const { identity } = createOfferFixture();
      expect(() => resolveOfferAddressFromPricingPolicy("pactagent:P002-policy:v1", identity.publicKey)).toThrow(
        PactServiceOfferError,
      );
    });
  });

  describe("application schema isolation", () => {
    it("does not embed PactAgent fields as PIP-00 fields", () => {
      const { offer } = createOfferFixture();
      const content = JSON.parse(offer.event.content) as Record<string, unknown>;
      expect(content).not.toHaveProperty("lifecycle_state");
      expect(content).not.toHaveProperty("service_agreement_terms");
      expect(content).not.toHaveProperty("authorization_rules");
      expect(Object.keys(content).sort()).toEqual(
        [
          "amount_sats",
          "capability_profile",
          "escrow_descriptor",
          "expires_at",
          "maximum_execution_seconds",
          "provider",
          "settlement_network",
          "updated_at",
          "valid_from",
          "version",
        ].sort(),
      );
      expect(content.version).toBe(PACTAGENT_SERVICE_OFFER_CONTENT_VERSION);
    });
  });

  describe("invalid Nostr identity rejection", () => {
    it("createPactServiceOffer rejects a malformed identity via createNostrIdentity", () => {
      expect(() => createNostrIdentity("not-a-key", RELAYS)).toThrow(InvalidDomainInputError);
    });
  });
});
