import { InsufficientInventoryError, InvalidDomainInputError } from "./errors";
import type { BtcKesMarketRate } from "./market-rate";
import {
  SATS_PER_BTC,
  basisPoints,
  type BasisPoints,
  type KesMinor,
  type Sats,
  kesMinor,
  sats,
} from "./money";

export interface MakerInventory {
  readonly btcSats: Sats;
  readonly kesMinor: KesMinor;
  readonly observedAt: string;
}

export type SwapDirection = "BUY_BTC" | "SELL_BTC";

/** Direction is from the customer's perspective; inventory effects are documented per variant. */
export type SwapIntent =
  | { readonly direction: "BUY_BTC"; readonly btcSats: Sats; readonly kesMinor: KesMinor }
  | { readonly direction: "SELL_BTC"; readonly btcSats: Sats; readonly kesMinor: KesMinor };

export interface ProjectedInventory {
  readonly btcSats: Sats;
  readonly kesMinor: KesMinor;
  readonly basedOnObservedAt: string;
}

export interface ExactRatio {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export type InventoryRatios =
  | { readonly status: "empty"; readonly btc: null; readonly kes: null }
  | { readonly status: "valued"; readonly btc: ExactRatio; readonly kes: ExactRatio };

export interface MakerStrategyInputs {
  readonly targetBtcRatio: BasisPoints;
  readonly minimumBtcReserve: Sats;
}

export interface MakerPolicyInputs {
  readonly marketRate: BtcKesMarketRate;
  readonly inventory: MakerInventory;
  readonly proposedSwap: SwapIntent;
  readonly projectedInventory: ProjectedInventory;
  readonly currentRatios: InventoryRatios;
  readonly projectedRatios: InventoryRatios;
  readonly strategy: MakerStrategyInputs;
}

function assertTimestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new InvalidDomainInputError("Inventory timestamp must be valid ISO-8601");
  }
}

export function createMakerInventory(input: MakerInventory): MakerInventory {
  // Re-run constructors so callers cannot bypass runtime invariants with casts.
  sats(input.btcSats);
  kesMinor(input.kesMinor);
  assertTimestamp(input.observedAt);
  return { ...input };
}

export function createSwapIntent(
  direction: SwapDirection,
  btcAmount: Sats,
  kesAmount: KesMinor,
): SwapIntent {
  if (direction !== "BUY_BTC" && direction !== "SELL_BTC") {
    throw new InvalidDomainInputError("Swap direction must be BUY_BTC or SELL_BTC");
  }
  sats(btcAmount);
  kesMinor(kesAmount);
  if (btcAmount === 0n || kesAmount === 0n) {
    throw new InvalidDomainInputError("Swap BTC and KES amounts must both be greater than zero");
  }
  return { direction, btcSats: btcAmount, kesMinor: kesAmount };
}

/**
 * Projects maker balances without side effects.
 * BUY_BTC means the customer buys BTC: maker gives BTC and receives KES.
 * SELL_BTC means the customer sells BTC: maker receives BTC and gives KES.
 */
export function projectInventoryAfterSwap(
  inventory: MakerInventory,
  swap: SwapIntent,
): ProjectedInventory {
  createMakerInventory(inventory);
  createSwapIntent(swap.direction, swap.btcSats, swap.kesMinor);

  if (swap.direction === "BUY_BTC") {
    if (inventory.btcSats < swap.btcSats) throw new InsufficientInventoryError("BTC");
    return {
      btcSats: sats(inventory.btcSats - swap.btcSats),
      kesMinor: kesMinor(inventory.kesMinor + swap.kesMinor),
      basedOnObservedAt: inventory.observedAt,
    };
  }

  if (inventory.kesMinor < swap.kesMinor) throw new InsufficientInventoryError("KES");
  return {
    btcSats: sats(inventory.btcSats + swap.btcSats),
    kesMinor: kesMinor(inventory.kesMinor - swap.kesMinor),
    basedOnObservedAt: inventory.observedAt,
  };
}

type InventoryBalances = Pick<MakerInventory, "btcSats" | "kesMinor">;

/** Values sats and KES on a shared exact rational scale; no monetary float is used. */
export function calculateInventoryRatios(
  inventory: InventoryBalances,
  marketRate: BtcKesMarketRate,
): InventoryRatios {
  sats(inventory.btcSats);
  kesMinor(inventory.kesMinor);
  if (marketRate.kesMinorPerBtc.numerator <= 0n || marketRate.kesMinorPerBtc.denominator <= 0n) {
    throw new InvalidDomainInputError("BTC/KES rate numerator and denominator must be positive");
  }

  const btcValue = inventory.btcSats * marketRate.kesMinorPerBtc.numerator;
  const kesValue = inventory.kesMinor * SATS_PER_BTC * marketRate.kesMinorPerBtc.denominator;
  const total = btcValue + kesValue;

  if (total === 0n) return { status: "empty", btc: null, kes: null };
  return {
    status: "valued",
    btc: { numerator: btcValue, denominator: total },
    kes: { numerator: kesValue, denominator: total },
  };
}

export function ratioToBasisPoints(ratio: ExactRatio): BasisPoints {
  if (ratio.denominator <= 0n || ratio.numerator < 0n || ratio.numerator > ratio.denominator) {
    throw new InvalidDomainInputError("Ratio must be between zero and one with a positive denominator");
  }
  const rounded = Number((ratio.numerator * 10_000n + ratio.denominator / 2n) / ratio.denominator);
  return basisPoints(rounded);
}

export function buildMakerPolicyInputs(
  marketRate: BtcKesMarketRate,
  inventory: MakerInventory,
  proposedSwap: SwapIntent,
  strategy: MakerStrategyInputs,
): MakerPolicyInputs {
  basisPoints(strategy.targetBtcRatio);
  sats(strategy.minimumBtcReserve);
  const projectedInventory = projectInventoryAfterSwap(inventory, proposedSwap);
  return {
    marketRate,
    inventory,
    proposedSwap,
    projectedInventory,
    currentRatios: calculateInventoryRatios(inventory, marketRate),
    projectedRatios: calculateInventoryRatios(projectedInventory, marketRate),
    strategy,
  };
}
