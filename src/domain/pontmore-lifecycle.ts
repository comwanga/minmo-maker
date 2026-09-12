export const PIP02_EVENT_KINDS = {
  request: 7300,
  transition: 7301,
  evidence: 7302,
  dispute: 7303,
  note: 7304,
  snapshot: 30362,
} as const;

/** PIP-02 required request fields. Payload semantics remain protocol-owned and unextended here. */
export interface PontmoreSwapRequestContent {
  readonly version: number;
  readonly swap_id: string;
  readonly swap_type: string;
  readonly agent: string;
  readonly customer: string;
  readonly escrow_reference: string;
  readonly fiat: unknown;
  readonly bitcoin: unknown;
  readonly expiry: number;
}
