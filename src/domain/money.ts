import { InvalidDomainInputError } from "./errors";

declare const satsBrand: unique symbol;
declare const kesMinorBrand: unique symbol;
declare const basisPointsBrand: unique symbol;

/** Integer satoshis. One BTC is exactly 100,000,000 sats. */
export type Sats = bigint & { readonly [satsBrand]: "Sats" };
/** Integer KES minor units. One Kenyan shilling is exactly 100 minor units. */
export type KesMinor = bigint & { readonly [kesMinorBrand]: "KesMinor" };
/** Integer hundredths of one percent. 10,000 basis points is 100%. */
export type BasisPoints = number & { readonly [basisPointsBrand]: "BasisPoints" };

export const SATS_PER_BTC = 100_000_000n;
export const KES_MINOR_PER_KES = 100n;
export const BASIS_POINTS_PER_UNIT = 10_000;

function assertNonNegativeInteger(value: bigint, label: string): void {
  if (value < 0n) {
    throw new InvalidDomainInputError(`${label} must be a non-negative integer`);
  }
}

export function sats(value: bigint): Sats {
  assertNonNegativeInteger(value, "Satoshis");
  return value as Sats;
}

export function kesMinor(value: bigint): KesMinor {
  assertNonNegativeInteger(value, "KES minor units");
  return value as KesMinor;
}

export function basisPoints(value: number): BasisPoints {
  if (!Number.isInteger(value) || value < 0 || value > BASIS_POINTS_PER_UNIT) {
    throw new InvalidDomainInputError("Basis points must be an integer from 0 through 10,000");
  }
  return value as BasisPoints;
}

function decimalToMinorUnits(value: string, decimalPlaces: number, label: string): bigint {
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(value);
  if (!match) {
    throw new InvalidDomainInputError(`${label} must be an unsigned decimal string`);
  }

  const fraction = match[2] ?? "";
  if (fraction.length > decimalPlaces) {
    throw new InvalidDomainInputError(`${label} supports at most ${decimalPlaces} decimal places`);
  }

  return BigInt(match[1]) * 10n ** BigInt(decimalPlaces) + BigInt(fraction.padEnd(decimalPlaces, "0") || "0");
}

export function btcToSats(value: string): Sats {
  return sats(decimalToMinorUnits(value, 8, "BTC"));
}

export function kesToMinor(value: string): KesMinor {
  return kesMinor(decimalToMinorUnits(value, 2, "KES"));
}

function formatMinorUnits(value: bigint, decimalPlaces: number): string {
  const scale = 10n ** BigInt(decimalPlaces);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimalPlaces, "0");
  return `${whole}.${fraction}`;
}

export function formatSatsAsBtc(value: Sats): string {
  return formatMinorUnits(value, 8);
}

export function formatKesMinor(value: KesMinor): string {
  return formatMinorUnits(value, 2);
}
