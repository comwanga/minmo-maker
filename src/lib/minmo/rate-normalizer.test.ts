import { describe, expect, it } from "vitest";

import { InvalidMinmoResponseError } from "../../domain/errors";

import { normalizeMinmoBtcKesRate } from "./rate-normalizer";

describe("Minmo BTC/KES rate normalization", () => {
  it("normalizes a valid SDK-shaped response and preserves metadata", () => {
    const result = normalizeMinmoBtcKesRate({
      baseCurrency: "BTC",
      targetCurrency: "KES",
      rate: 5_000_000.125,
      timestamp: "2026-09-08T08:30:00.000Z",
      source: "coingecko",
      confidence: 0.99,
    });

    expect(result).toEqual({
      pair: "BTC/KES",
      kesMinorPerBtc: { numerator: 1_000_000_025n, denominator: 2n },
      observedAt: "2026-09-08T08:30:00.000Z",
      source: "coingecko",
    });
  });

  it.each([
    null,
    {},
    { baseCurrency: "USD", targetCurrency: "KES", rate: 1, timestamp: "2026-01-01", source: "x" },
    { baseCurrency: "BTC", targetCurrency: "KES", rate: Number.NaN, timestamp: "2026-01-01", source: "x" },
    { baseCurrency: "BTC", targetCurrency: "KES", rate: 1, timestamp: "not-a-date", source: "x" },
    { baseCurrency: "BTC", targetCurrency: "KES", rate: 1, timestamp: "2026-01-01", source: "" },
  ])("rejects malformed or unsupported responses", (response) => {
    expect(() => normalizeMinmoBtcKesRate(response)).toThrow(InvalidMinmoResponseError);
  });
});
