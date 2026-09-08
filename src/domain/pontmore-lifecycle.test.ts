import { describe, expect, it } from "vitest";

import { InvalidDomainInputError } from "./errors";
import { serializeUnsignedNostrEvent } from "./nostr";
import { createPontmoreTransitionDraft, isValidDocumentSummaryTransition, parsePontmoreTransitionDraft, validateTransitionSequence } from "./pontmore-lifecycle";
import { createPactDemoFixtures } from "../lib/pact-fixtures";

describe("PIP-02 append-only lifecycle modeling", () => {
  it("validates a coherent transition sequence", () => {
    const { transitions } = createPactDemoFixtures();
    expect(validateTransitionSequence("requested", transitions)).toBe("funding_intended");
    expect(transitions.every((entry) => entry.event.kind === 7301)).toBe(true);
  });

  it("round-trips an application-owned PIP-02 transition draft", () => {
    const { transitions } = createPactDemoFixtures();
    expect(parsePontmoreTransitionDraft(serializeUnsignedNostrEvent(transitions[0].event))).toEqual(
      transitions[0],
    );
  });

  it("rejects invalid state jumps", () => {
    expect(isValidDocumentSummaryTransition("requested", "settled")).toBe(false);
    const { requester } = createPactDemoFixtures();
    expect(() =>
      createPontmoreTransitionDraft({
        identity: requester.identity,
        swapId: "swap-1",
        previous: "requested",
        next: "settled",
        actorRole: "customer",
        reason: "invalid_jump",
        createdAt: 1,
      }),
    ).toThrow(InvalidDomainInputError);
  });

  it("rejects incoherent append-only history", () => {
    const { requester, transitions } = createPactDemoFixtures();
    const wrongPrevious = createPontmoreTransitionDraft({
      identity: requester.identity,
      swapId: "pact-demo-001",
      previous: "requested",
      next: "cancelled",
      actorRole: "customer",
      reason: "out_of_sequence",
      createdAt: transitions[1].content.created_at + 1,
    });
    expect(() => validateTransitionSequence("requested", [...transitions, wrongPrevious])).toThrow(
      InvalidDomainInputError,
    );
  });

  it("provides recoverable refund or dispute paths after escrow is secured", () => {
    expect(isValidDocumentSummaryTransition("escrow_secured", "refund_intended")).toBe(true);
    expect(isValidDocumentSummaryTransition("escrow_secured", "disputed")).toBe(true);
    expect(isValidDocumentSummaryTransition("refund_intended", "refunded")).toBe(true);
    expect(isValidDocumentSummaryTransition("disputed", "resolved")).toBe(true);
  });
});
