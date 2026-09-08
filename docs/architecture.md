# Architecture

## Phase 2 status

```text
@minmoto/sdk `otc.rates.get(BTC, KES)`       IMPLEMENTED (read-only)
                 |
                 v
Minmo rate adapter + response validation     IMPLEMENTED
                 |
                 v
Application-owned BTC/KES market rate        IMPLEMENTED
                 |
                 +--------------------+
                 v                    v
Maker inventory                    Hypothetical swap
                 |                    |
                 +----------+---------+
                            v
                  Projected inventory          IMPLEMENTED
                            |
                            v
                  Exact inventory ratios       IMPLEMENTED
                            |
                            v
                  Maker policy inputs          IMPLEMENTED
                            |
                            v
                  Maker policy engine          DEFERRED
```

Phase 2 supplies economic inputs. It does not price, approve, reject, execute, or rebalance a swap.

## Server and SDK boundary

`src/lib/minmo/client.ts` remains the only SDK client-construction boundary and is marked `server-only`. The narrow adapter in `src/lib/minmo/rate-adapter.ts` calls the installed SDK 0.2.0 declaration-backed read method:

```ts
client.otc.rates.get(Currency.BTC, Currency.KES)
```

The SDK declares this as `get(baseCurrency: Currency, targetCurrency: Currency): Promise<FxRateResponse>` and implements it as a GET request to `/fx/rates/BTC/KES`. The raw response is accepted as `unknown`, validated, and immediately mapped to `BtcKesMarketRate`; SDK types do not cross into domain code.

Credentials stay in `MINMO_PARTNER_ID` and `MINMO_API_KEY` on the server. `GET /api/market` returns only a serialized application-owned state. It explicitly reports `not_configured`, `unavailable`, or `invalid_response`; it never returns secrets or raw SDK error details. No credentials were available during Phase 2, so remote connectivity remains untested.

## Economic-state boundary

All BTC amounts are integer satoshis (`bigint`). All KES amounts are integer minor units (`bigint`, 100 per KES). The SDK rate is KES per BTC and arrives as a JavaScript number; at the adapter boundary its serialized decimal value is converted to an exact rational measured in KES minor units per BTC. Calculations after normalization use integer arithmetic only.

Inventory projection is pure:

- `BUY_BTC` is the customer's direction: the maker gives BTC and receives KES.
- `SELL_BTC` is the customer's direction: the maker receives BTC and gives KES.
- A projection that would make either balance negative throws `InsufficientInventoryError`.

Portfolio valuation places BTC value and KES value on one exact rational scale. A zero-value portfolio returns an explicit `empty` state because its ratios are undefined. Basis points are produced only as a rounded display/policy boundary.

See [Domain model](domain-model.md) for units and invariants.

## Lightning boundary

The installed SDK verifies Lightning payment-related inputs, but not node identity, peers, channels, local/remote balances, inbound/outbound liquidity, routing, channel fees, or channel rebalancing. Phase 2 does not invent or simulate those capabilities.

Future economic state may combine Minmo data with a separately verified Lightning-liquidity adapter. That adapter is not implemented.

## Intentionally deferred

- dynamic spreads and quote pricing;
- profitability, volatility, risk, and flow-pressure policy;
- accept/reject decisions and rebalance recommendations;
- swap execution, BTC sending, wallet changes, and channel operations;
- database persistence, customer accounts, M-Pesa, KYC, AI, Nostr, and Ecash.
