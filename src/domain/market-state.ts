export type SerializedBtcKesMarketRate = Readonly<{
  pair: "BTC/KES";
  kesMinorPerBtc: Readonly<{ numerator: string; denominator: string }>;
  observedAt: string;
  source: string;
}>;

export type BtcKesMarketState =
  | Readonly<{ status: "not_configured"; pair: "BTC/KES" }>
  | Readonly<{ status: "unavailable"; pair: "BTC/KES" }>
  | Readonly<{ status: "invalid_response"; pair: "BTC/KES" }>
  | Readonly<{ status: "available"; rate: SerializedBtcKesMarketRate }>;
