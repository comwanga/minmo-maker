import { describe, expect, it } from "vitest";

import { InvalidDomainInputError } from "./errors";
import {
  basisPoints,
  btcToSats,
  formatKesMinor,
  formatSatsAsBtc,
  kesMinor,
  kesToMinor,
  sats,
} from "./money";

describe("money representations", () => {
  it("converts BTC decimal strings to integer sats without floating point", () => {
    const amount = btcToSats("21000000.00000001");
    expect(amount).toBe(2_100_000_000_000_001n);
    expect(formatSatsAsBtc(amount)).toBe("21000000.00000001");
  });

  it("converts KES decimal strings to integer minor units", () => {
    const amount = kesToMinor("98765432101234567890.09");
    expect(amount).toBe(9_876_543_210_123_456_789_009n);
    expect(formatKesMinor(amount)).toBe("98765432101234567890.09");
  });

  it("rejects negative values and unsupported decimal precision", () => {
    expect(() => sats(-1n)).toThrow(InvalidDomainInputError);
    expect(() => kesMinor(-1n)).toThrow(InvalidDomainInputError);
    expect(() => btcToSats("0.000000001")).toThrow(InvalidDomainInputError);
    expect(() => kesToMinor("1.001")).toThrow(InvalidDomainInputError);
  });

  it("accepts only integer basis points within a unit interval", () => {
    expect(basisPoints(5_000)).toBe(5_000);
    expect(() => basisPoints(5_000.5)).toThrow(InvalidDomainInputError);
    expect(() => basisPoints(10_001)).toThrow(InvalidDomainInputError);
  });
});
