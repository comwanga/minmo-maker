import "server-only";

import { InvalidMinmoResponseError } from "@/domain/errors";
import type { BtcKesMarketRate } from "@/domain/market-rate";
import type { BtcKesMarketState, SerializedBtcKesMarketRate } from "@/domain/market-state";

import { isMinmoConfigured } from "./minmo/config";
import { fetchMinmoBtcKesRate } from "./minmo/rate-adapter";

type Environment = Readonly<Record<string, string | undefined>>;

export function serializeMarketRate(rate: BtcKesMarketRate): SerializedBtcKesMarketRate {
  return {
    pair: rate.pair,
    kesMinorPerBtc: {
      numerator: rate.kesMinorPerBtc.numerator.toString(),
      denominator: rate.kesMinorPerBtc.denominator.toString(),
    },
    observedAt: rate.observedAt,
    source: rate.source,
  };
}

export async function getBtcKesMarketState(
  environment: Environment = process.env,
): Promise<BtcKesMarketState> {
  if (!isMinmoConfigured(environment)) return { status: "not_configured", pair: "BTC/KES" };

  try {
    return { status: "available", rate: serializeMarketRate(await fetchMinmoBtcKesRate()) };
  } catch (error) {
    // The public state is deliberately sanitized; callers can distinguish this from configuration.
    if (error instanceof InvalidMinmoResponseError) {
      return { status: "invalid_response", pair: "BTC/KES" };
    }
    return { status: "unavailable", pair: "BTC/KES" };
  }
}
