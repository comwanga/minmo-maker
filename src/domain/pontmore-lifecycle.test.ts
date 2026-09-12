import { describe, expect, it } from "vitest";

import { PIP02_EVENT_KINDS, type PontmoreSwapRequestContent } from "./pontmore-lifecycle";

describe("PIP-02 swap-only declarations", () => {
  it("retains the canonical swap event kinds", () => {
    expect(PIP02_EVENT_KINDS).toEqual({
      request: 7300,
      transition: 7301,
      evidence: 7302,
      dispute: 7303,
      note: 7304,
      snapshot: 30362,
    });
  });

  it("keeps only PIP-02 swap request fields in the retained model", () => {
    const request: PontmoreSwapRequestContent = {
      version: 1,
      swap_id: "swap-1",
      swap_type: "fiat-bitcoin",
      agent: "agent",
      customer: "customer",
      escrow_reference: "escrow",
      fiat: { currency: "KES" },
      bitcoin: { network: "lightning" },
      expiry: 1,
    };
    expect(request.swap_id).toBe("swap-1");
  });
});
