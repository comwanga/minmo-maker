import { describe, expect, it } from "vitest";

import { getFoundationStatus } from "./status";

describe("foundation status", () => {
  it("reports readiness without claiming remote connectivity", () => {
    expect(getFoundationStatus({ MINMO_PARTNER_ID: "partner-id", MINMO_API_KEY: "api-key" })).toEqual({
      application: "ready",
      minmoConfiguration: "configured",
      minmoConnectivity: "not_tested",
      phase: "foundation",
    });
  });

  it("reports missing configuration", () => {
    expect(getFoundationStatus({}).minmoConfiguration).toBe("missing");
  });
});
