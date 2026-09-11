const FORBIDDEN_FIELD_NAMES = new Set([
  "token",
  "tokens",
  "cashutoken",
  "rawcashutoken",
  "proof",
  "proofs",
  "mintcredential",
  "mintcredentials",
  "apicredential",
  "apicredentials",
  "apikey",
  "privatekey",
  "nostrsecretkey",
  "secretkey",
  "nsec",
  "preimage",
  "preimages",
  "payoutinstruction",
  "payoutinstructions",
  "privateroutinginformation",
  "privateroutingstate",
  "internalcustodyidentifier",
  "custodybackendidentifier",
  "privatesettlementmetadata",
  "settlementsecret",
  "settlementsecrets",
  "privatenote",
  "privatenotes",
  "walletidentifier",
  "internalaccountdetails",
]);

const NSEC_PATTERN = /nsec1[023456789acdefghjklmnpqrstuvwxyz]+/i;
const CASHU_PATTERN = /cashu[ab][a-z0-9_-]+/i;

function normalizedFieldName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isForbiddenFieldName(name: string): boolean {
  return FORBIDDEN_FIELD_NAMES.has(normalizedFieldName(name));
}

export type ForbiddenMaterialReason =
  | { readonly kind: "secret_or_token" }
  | { readonly kind: "field"; readonly field: string };

export function findForbiddenPublicMaterial(value: unknown): ForbiddenMaterialReason | undefined {
  if (typeof value === "string") {
    if (NSEC_PATTERN.test(value) || CASHU_PATTERN.test(value)) return { kind: "secret_or_token" };
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findForbiddenPublicMaterial(item);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  for (const [key, nested] of Object.entries(value)) {
    if (isForbiddenFieldName(key)) return { kind: "field", field: key };
    const found = findForbiddenPublicMaterial(nested);
    if (found !== undefined) return found;
  }
  return undefined;
}
