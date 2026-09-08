import { describe, expect, it } from "vitest";

import { InvalidDomainInputError } from "./errors";
import { serializeUnsignedNostrEvent } from "./nostr";
import { createCashuEscrowDescriptor, createCashuEscrowPlan, parseCashuEscrowDescriptor } from "./pontmore-escrow";
import { createPactDemoFixtures } from "../lib/pact-fixtures";

describe("PIP-01 Cashu escrow modeling", () => {
  it("declares canonical cashu_escrow compatibility without a token", () => {
    const { escrowDescriptor } = createPactDemoFixtures();
    expect(escrowDescriptor.content).toMatchObject({
      escrow_type: "cashu_escrow",
      networks: ["cashu"],
      funding_rules: { funding_threshold: 1, participant_count: 1 },
      dispute_rules: { policy: "pip03" },
    });
    expect(JSON.stringify(escrowDescriptor)).not.toMatch(/token|preimage|private/i);
  });

  it("round-trips the public descriptor", () => {
    const { escrowDescriptor } = createPactDemoFixtures();
    const parsed = parseCashuEscrowDescriptor(serializeUnsignedNostrEvent(escrowDescriptor.event));
    expect(parsed.address).toBe(escrowDescriptor.address);
    expect(parsed.content).toEqual(escrowDescriptor.content);
  });

  it("rejects incompatible funding cardinality", () => {
    const { provider } = createPactDemoFixtures();
    expect(() =>
      createCashuEscrowDescriptor({
        identity: provider.identity,
        identifier: "invalid",
        referenceFormat: "opaque",
        updatedAt: 1,
        fundingThreshold: 2,
        participantCount: 1,
      }),
    ).toThrow(InvalidDomainInputError);
  });

  it("keeps funding, release, refund, timeout, and settlement as application intent", () => {
    const { escrowPlan } = createPactDemoFixtures();
    expect(escrowPlan).toMatchObject({
      settlementState: "planned",
      fundingIntent: { action: "commit", network: "cashu" },
      releaseIntent: { condition: "deterministic_completion_checks_pass" },
      refundIntent: { condition: "timeout_or_pip03_resolution" },
      timeout: {
        class: "refund-trigger timeout",
        durationSeconds: 900,
        fallbackResolution: "cancelling and refunding",
      },
    });
  });

  it("rejects unsupported fields that could leak private Cashu data", () => {
    const { escrowDescriptor } = createPactDemoFixtures();
    const content = JSON.parse(escrowDescriptor.event.content) as Record<string, unknown>;
    content.raw_cashu_token = "cashuA-secret";
    const unsafe = { ...escrowDescriptor.event, content: JSON.stringify(content) };
    expect(() => parseCashuEscrowDescriptor(JSON.stringify(unsafe))).toThrow(InvalidDomainInputError);
  });

  it("requires a positive escrow amount", () => {
    const { escrowDescriptor } = createPactDemoFixtures();
    expect(() => createCashuEscrowPlan({ descriptor: escrowDescriptor, amountSats: 0n as never, timeoutSeconds: 1 }))
      .toThrow(InvalidDomainInputError);
  });
});
