import "server-only";

import { Currency } from "@minmoto/sdk";

import { InvalidMinmoResponseError, MinmoDataUnavailableError } from "../../domain/errors";
import type { BtcKesMarketRate } from "../../domain/market-rate";

import { getMinmoClient } from "./client";
import { normalizeMinmoBtcKesRate } from "./rate-normalizer";

interface MinmoRateReader {
  readonly otc: {
    readonly rates: {
      get(baseCurrency: Currency, targetCurrency: Currency): Promise<unknown>;
    };
  };
}

/** Calls only the verified read-only OTC rate operation. */
export async function fetchMinmoBtcKesRate(
  client: MinmoRateReader = getMinmoClient(),
): Promise<BtcKesMarketRate> {
  try {
    const response = await client.otc.rates.get(Currency.BTC, Currency.KES);
    return normalizeMinmoBtcKesRate(response);
  } catch (error) {
    if (error instanceof InvalidMinmoResponseError) throw error;
    throw new MinmoDataUnavailableError();
  }
}
