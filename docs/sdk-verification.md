# `@minmoto/sdk` verification record

Verified on 2026-09-08 from the published npm artifact `@minmoto/sdk@0.2.0` (integrity `sha512-DOh4+WhETf/RrQg3xhcafgolSXKYfIcPHaZXFHa6+a7V2fLNPFusbYb1qJcIa3xGJVvjCVru2qOwzZDhkqq0Cw==`). After installation, evidence is available in `node_modules/@minmoto/sdk/package.json`, `README.md`, `CHANGELOG.md`, and `dist/index.d.ts`.

## Package and runtime — VERIFIED

- Version: `0.2.0`.
- Node.js requirement: `>=22`.
- Format: ESM (`type: module`) with an import-only root export.
- Types: `dist/index.d.ts` through the root export.
- Runtime dependencies: none declared.
- Default production base URL: `https://api.minmo.to/api/v1`.
- Constructor: `new MinmoClient({ partnerId, apiKey, baseUrl? })`.
- Authentication: non-empty Partner ID and API key; the README states the key is sent as `X-API-Key` and only Partner API-key authentication is supported.

`MINMO_PARTNER_ID` and `MINMO_API_KEY` are application-owned environment names, not names required by the SDK.

## Exported surface — VERIFIED

The declaration file exports `MinmoClient`, `MINMO_PRODUCTION_BASE_URL`, typed SDK/API/auth/authorization/rate-limit/transport errors, resource clients, domain enums, request/response types, and event subscription types. Partner-bound client namespaces are:

- `account`, `settings`, `analytics`, `members`, `invitations`, `apiKeys`, `referrals`;
- `integrations.pay`;
- `otc.swap`, `otc.rates`, `otc.agents`;
- `wallet`, `escrow`, and `events`.

Verified reads include `account.get()`, `settings.get()`, `analytics.get()`, Pay store/invoice reads, OTC rate reads, swap/agent reads, wallet list/get/overview/history/payout status, escrow reads/reconciliation, and event subscriptions. `account.get()` is a documented safe Partner-scoped read and could support a future explicit connectivity check.

Verified writes include account/team/API-key management, store/invoice creation, OTC swap and agent commands, wallet create/update/delete/receive/send/transfer/stabilize/connection commands, and escrow create/release/refund/dispute commands. Phase 1 calls none of them.

## Capability classification

| Capability | Classification | Package evidence and boundary |
| --- | --- | --- |
| Rates | VERIFIED | `RatesClient` exposes health, quote, get, detailed, and supported-pair reads plus Partner/agent variants. |
| Quotes | VERIFIED | OTC `quote` methods return declared FX/Partner quote types. No maker pricing policy is inferred. |
| Swaps | VERIFIED | `SwapClient` and swap types/events are exported, including reads and mutations. “Swap” does not prove a Lightning liquidity swap. |
| Wallets/balances | VERIFIED | Wallet list/get/overview/history and money-moving methods are declared. Availability depends on credential policy. |
| Activity/history | VERIFIED | Wallet history and several list/analytics reads are declared. |
| Events | VERIFIED | Typed subscriptions exist for OTC, Pay, wallet, escrow, and general events. |
| Agents | VERIFIED | Agent operations are declared. These are Minmo domain agents, not proof of an AI framework. |
| Settlement | VERIFIED, scoped | Pay wallet/invoice, wallet payout, and escrow release/refund operations are declared. No project execution exists. |
| Lightning payments | VERIFIED, scoped | `PaymentChannel.LIGHTNING`, BOLT11/Lightning-address fields, and wallet Lightning network inputs are declared. |
| Lightning node/channel management | UNKNOWN | No sufficient evidence for nodes, peers, channel state/balances, routing, channel fees, or channel rebalancing. |

## Errors — VERIFIED

The SDK exports `MinmoSdkError`, `MinmoApiError`, `MinmoAuthenticationError`, `MinmoAuthorizationError`, `MinmoRateLimitError`, `MinmoTransportError`, and `ResyncRequiredError`. The README documents `code`, `status`, `requestId`, and `retryable` and advises bounded backoff plus stable idempotency keys for money-moving retries. Phase 1 adds no retry behavior.

## Discrepancies and limits

No contradiction was found between the published README, metadata, and declarations for the client construction used here. The README is descriptive; declarations are the evidence for exact signatures. Connectivity and credential permissions were not tested because no credentials were supplied. Capabilities describe the SDK surface, not confirmed access for a Partner account.

## Phase 2 rate integration

Phase 2 uses exactly `client.otc.rates.get(Currency.BTC, Currency.KES)`. The installed declarations type it as a read returning `FxRateResponse`; the installed runtime issues `GET /fx/rates/BTC/KES`. Its response is normalized into application-owned data before use. This call was not exercised against the remote service because Minmo credentials were unavailable.
