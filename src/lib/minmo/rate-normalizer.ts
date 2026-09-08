import { InvalidMinmoResponseError } from "../../domain/errors";
import {
  createBtcKesMarketRate,
  kesMinorPerBtc,
  type BtcKesMarketRate,
} from "../../domain/market-rate";

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

/** Converts the SDK's finite number to the exact decimal value it serialized. */
function sdkKesRateToMinorUnitRatio(value: number): { numerator: bigint; denominator: bigint } {
  if (!Number.isFinite(value) || value <= 0) {
    throw new InvalidMinmoResponseError("Minmo BTC/KES rate must be a positive finite number");
  }

  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(value.toString());
  if (!match) throw new InvalidMinmoResponseError("Minmo BTC/KES rate has an unsupported number format");

  const digits = `${match[1]}${match[2] ?? ""}`;
  const exponent = Number(match[3] ?? "0") - (match[2]?.length ?? 0);
  let numerator = BigInt(digits) * 100n; // SDK units are KES; domain units are KES minor.
  let denominator = 1n;

  if (exponent >= 0) numerator *= 10n ** BigInt(exponent);
  else denominator = 10n ** BigInt(-exponent);

  const divisor = greatestCommonDivisor(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Normalizes the verified SDK FxRateResponse without exporting an SDK type. */
export function normalizeMinmoBtcKesRate(response: unknown): BtcKesMarketRate {
  if (!isRecord(response)) throw new InvalidMinmoResponseError("Minmo rate response must be an object");
  if (response.baseCurrency !== "BTC" || response.targetCurrency !== "KES") {
    throw new InvalidMinmoResponseError("Minmo rate response must be for BTC/KES");
  }
  if (typeof response.rate !== "number") {
    throw new InvalidMinmoResponseError("Minmo BTC/KES rate must be numeric");
  }
  if (typeof response.timestamp !== "string" || !Number.isFinite(Date.parse(response.timestamp))) {
    throw new InvalidMinmoResponseError("Minmo rate timestamp must be valid ISO-8601");
  }
  if (typeof response.source !== "string" || !response.source.trim()) {
    throw new InvalidMinmoResponseError("Minmo rate source must be non-empty");
  }

  const exactRate = sdkKesRateToMinorUnitRatio(response.rate);
  return createBtcKesMarketRate({
    kesMinorPerBtc: kesMinorPerBtc(exactRate.numerator, exactRate.denominator),
    observedAt: response.timestamp,
    source: response.source,
  });
}
