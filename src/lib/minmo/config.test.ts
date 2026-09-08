import { describe, expect, it } from "vitest";

import { isMinmoConfigured, MinmoConfigurationError, readMinmoConfig } from "./config";

describe("Minmo configuration", () => {
  it("accepts non-empty server credentials and trims whitespace", () => {
    const config = readMinmoConfig({ MINMO_PARTNER_ID: " partner-id ", MINMO_API_KEY: " api-key " });
    expect(config).toEqual({ partnerId: "partner-id", apiKey: "api-key" });
    expect(isMinmoConfigured({ MINMO_PARTNER_ID: config.partnerId, MINMO_API_KEY: config.apiKey })).toBe(true);
  });

  it("reports every missing variable without including secret values", () => {
    expect(() => readMinmoConfig({ MINMO_API_KEY: "   " })).toThrowError(
      new MinmoConfigurationError(["MINMO_PARTNER_ID", "MINMO_API_KEY"]),
    );
  });

  it("treats partial configuration as not configured", () => {
    expect(isMinmoConfigured({ MINMO_PARTNER_ID: "partner-id" })).toBe(false);
  });
});
