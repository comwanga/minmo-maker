import { InvalidDomainInputError } from "./errors";

/** A positive exact rational measured in KES minor units per one BTC. */
export interface KesMinorPerBtc {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

/** Application-owned BTC/KES market observation; it has no SDK type dependency. */
export interface BtcKesMarketRate {
  readonly pair: "BTC/KES";
  readonly kesMinorPerBtc: KesMinorPerBtc;
  readonly observedAt: string;
  readonly source: string;
}

export function kesMinorPerBtc(numerator: bigint, denominator: bigint): KesMinorPerBtc {
  if (numerator <= 0n || denominator <= 0n) {
    throw new InvalidDomainInputError("BTC/KES rate numerator and denominator must be positive");
  }
  return { numerator, denominator };
}

export function createBtcKesMarketRate(input: Omit<BtcKesMarketRate, "pair">): BtcKesMarketRate {
  kesMinorPerBtc(input.kesMinorPerBtc.numerator, input.kesMinorPerBtc.denominator);
  if (!input.source.trim()) {
    throw new InvalidDomainInputError("Market rate source must be non-empty");
  }
  if (!Number.isFinite(Date.parse(input.observedAt))) {
    throw new InvalidDomainInputError("Market observation timestamp must be valid ISO-8601");
  }
  return { pair: "BTC/KES", ...input };
}
