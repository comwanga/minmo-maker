import { createBtcKesMarketRate, kesMinorPerBtc } from "../domain/market-rate";
import {
  buildMakerPolicyInputs,
  createMakerInventory,
  createSwapIntent,
} from "../domain/maker-state";
import { basisPoints, btcToSats, kesToMinor } from "../domain/money";

/** Static, explicitly labeled fixture for demonstrating Phase 2 calculations. */
export function getDemoMakerPolicyInputs() {
  const observedAt = "2026-09-08T09:00:00.000Z";
  const marketRate = createBtcKesMarketRate({
    kesMinorPerBtc: kesMinorPerBtc(500_000_000n, 1n),
    observedAt,
    source: "demo_fixture",
  });
  const inventory = createMakerInventory({
    btcSats: btcToSats("1"),
    kesMinor: kesToMinor("5000000"),
    observedAt,
  });
  const proposedSwap = createSwapIntent("BUY_BTC", btcToSats("0.1"), kesToMinor("500000"));

  return buildMakerPolicyInputs(marketRate, inventory, proposedSwap, {
    targetBtcRatio: basisPoints(5_000),
    minimumBtcReserve: btcToSats("0.1"),
  });
}
