import type { FoundationStatus } from "../domain/foundation-status";
import { isMinmoConfigured } from "./minmo/config";

type Environment = Readonly<Record<string, string | undefined>>;

export function getFoundationStatus(environment: Environment = process.env): FoundationStatus {
  return {
    application: "ready",
    minmoConfiguration: isMinmoConfigured(environment) ? "configured" : "missing",
    minmoConnectivity: "not_tested",
    phase: "maker_state",
  };
}
