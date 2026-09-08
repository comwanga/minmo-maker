export type ConfigurationStatus = "configured" | "missing";
export type ConnectivityStatus = "not_tested";

/** Application-owned status. It intentionally contains no SDK response types. */
export interface FoundationStatus {
  application: "ready";
  minmoConfiguration: ConfigurationStatus;
  minmoConnectivity: ConnectivityStatus;
  phase: "maker_state";
}
