import { describe, expect, it } from "vitest";

import { InsufficientInventoryError, InvalidDomainInputError } from "./errors";
import { createBtcKesMarketRate, kesMinorPerBtc } from "./market-rate";
import {
  buildMakerPolicyInputs,
  calculateInventoryRatios,
  createMakerInventory,
  createSwapIntent,
  projectInventoryAfterSwap,
  ratioToBasisPoints,
} from "./maker-state";
import { basisPoints, btcToSats, kesToMinor, sats } from "./money";

const observedAt = "2026-09-08T09:00:00.000Z";
const marketRate = createBtcKesMarketRate({
  kesMinorPerBtc: kesMinorPerBtc(500_000_000n, 1n), // KES 5,000,000.00 per BTC
  observedAt,
  source: "test_fixture",
});

describe("maker inventory and swap projection", () => {
  const inventory = createMakerInventory({
    btcSats: btcToSats("1.00000000"),
    kesMinor: kesToMinor("5000000.00"),
    observedAt,
  });

  it("projects BUY_BTC as BTC out and KES in for the maker", () => {
    const projected = projectInventoryAfterSwap(
      inventory,
      createSwapIntent("BUY_BTC", btcToSats("0.10000000"), kesToMinor("500000.00")),
    );
    expect(projected.btcSats).toBe(btcToSats("0.90000000"));
    expect(projected.kesMinor).toBe(kesToMinor("5500000.00"));
  });

  it("projects SELL_BTC as BTC in and KES out for the maker", () => {
    const projected = projectInventoryAfterSwap(
      inventory,
      createSwapIntent("SELL_BTC", btcToSats("0.10000000"), kesToMinor("500000.00")),
    );
    expect(projected.btcSats).toBe(btcToSats("1.10000000"));
    expect(projected.kesMinor).toBe(kesToMinor("4500000.00"));
  });

  it("allows exact inventory exhaustion but never a negative balance", () => {
    const buyAll = projectInventoryAfterSwap(
      inventory,
      createSwapIntent("BUY_BTC", inventory.btcSats, kesToMinor("5000000.00")),
    );
    expect(buyAll.btcSats).toBe(0n);

    expect(() =>
      projectInventoryAfterSwap(
        inventory,
        createSwapIntent("BUY_BTC", sats(inventory.btcSats + 1n), kesToMinor("5000000.00")),
      ),
    ).toThrow(new InsufficientInventoryError("BTC"));

    expect(() =>
      projectInventoryAfterSwap(
        inventory,
        createSwapIntent("SELL_BTC", btcToSats("1"), kesToMinor("5000000.01")),
      ),
    ).toThrow(new InsufficientInventoryError("KES"));
  });

  it("rejects invalid inventory, timestamps, and zero swaps", () => {
    expect(() => createMakerInventory({ ...inventory, btcSats: -1n as never })).toThrow(InvalidDomainInputError);
    expect(() => createMakerInventory({ ...inventory, observedAt: "invalid" })).toThrow(InvalidDomainInputError);
    expect(() => createSwapIntent("BUY_BTC", sats(0n), kesToMinor("1"))).toThrow(InvalidDomainInputError);
    expect(() => createSwapIntent("INVALID" as never, btcToSats("1"), kesToMinor("1"))).toThrow(
      InvalidDomainInputError,
    );
  });
});

describe("inventory ratios", () => {
  it("calculates a balanced portfolio exactly", () => {
    const ratios = calculateInventoryRatios(
      { btcSats: btcToSats("1"), kesMinor: kesToMinor("5000000") },
      marketRate,
    );
    expect(ratios.status).toBe("valued");
    if (ratios.status === "valued") {
      expect(ratioToBasisPoints(ratios.btc)).toBe(5_000);
      expect(ratios.btc.numerator + ratios.kes.numerator).toBe(ratios.btc.denominator);
    }
  });

  it.each([
    ["2", "5000000", 6_667],
    ["0.5", "5000000", 3_333],
    ["1", "0", 10_000],
    ["0", "5000000", 0],
  ])("handles BTC/KES portfolio extremes", (btc, kes, expectedBps) => {
    const ratios = calculateInventoryRatios(
      { btcSats: btcToSats(btc), kesMinor: kesToMinor(kes) },
      marketRate,
    );
    expect(ratios.status).toBe("valued");
    if (ratios.status === "valued") expect(ratioToBasisPoints(ratios.btc)).toBe(expectedBps);
  });

  it("marks a zero-value portfolio as empty instead of inventing a ratio", () => {
    expect(
      calculateInventoryRatios({ btcSats: sats(0n), kesMinor: kesToMinor("0") }, marketRate),
    ).toEqual({ status: "empty", btc: null, kes: null });
  });

  it("assembles future policy inputs without making a policy decision", () => {
    const inventory = createMakerInventory({
      btcSats: btcToSats("1"),
      kesMinor: kesToMinor("5000000"),
      observedAt,
    });
    const swap = createSwapIntent("BUY_BTC", btcToSats("0.1"), kesToMinor("500000"));
    const inputs = buildMakerPolicyInputs(marketRate, inventory, swap, {
      targetBtcRatio: basisPoints(5_000),
      minimumBtcReserve: btcToSats("0.1"),
    });

    expect(inputs.projectedInventory.btcSats).toBe(btcToSats("0.9"));
    expect(inputs.projectedRatios.status).toBe("valued");
    expect("decision" in inputs).toBe(false);
  });
});
