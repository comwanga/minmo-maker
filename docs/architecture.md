# Architecture

## Status legend

- **IMPLEMENTED** — present and tested in Phase 1.
- **PLANNED** — an architectural intention, not functioning software.
- **UNVERIFIED** — evidence is insufficient; no implementation may be inferred.

## System direction

```text
Sources
  +-- Minmo SDK adapter                         IMPLEMENTED (construction only)
  +-- Minmo remote data                         PLANNED
  +-- Lightning node/channel state              UNVERIFIED
             |
             v
Normalized maker state                          PLANNED
             |
             v
Deterministic policy engine                     PLANNED
  +-- pricing                                   PLANNED
  +-- profitability                             PLANNED
  +-- inventory risk                            PLANNED
  +-- flow pressure                             PLANNED
  +-- rebalance economics                       PLANNED
             |
             v
Structured policy decision                      PLANNED
             |
             v
Agent-assisted layer (explain / propose)        PLANNED
             |
             v
Deterministic authorization guardrails          PLANNED
             |
             v
Execution                                       PLANNED
```

Phase 1 implements the browser/server separation, configuration validation, SDK client construction boundary, application-owned foundation status, a UI, and a read-only status route. It does not fetch remote Minmo data.

## Runtime boundary

```text
Browser UI
    |
    v
Next.js server boundary
    |
    +-- application status (no secrets, no remote mutation)
    |
    v
server-only Minmo client factory
    |
    v
@minmoto/sdk
```

The `server-only` marker makes importing the privileged client into a Client Component a build-time error. SDK construction is centralized. Configuration errors name missing variables but never include their values. There are no financial commands in the application.

## Domain boundary

`FoundationStatus` is owned by Minmo Maker and contains only Phase 1 readiness information. It does not reuse an SDK response shape. Future normalized financial types should be added only alongside a real use case and an explicit mapper from verified external data.

## Future Machine Money boundary

The intended modes are **OBSERVE**, **ADVISE**, **APPROVAL**, and **AUTONOMOUS**. They are planned concepts only. A future agent consumes structured state and deterministic policy outputs; it may explain or propose, but deterministic code calculates money, validates reserves and limits, authorizes actions, and controls execution. No agent or AI code exists in Phase 1.

## Verified SDK Surface

Package-backed findings are recorded in [SDK verification](sdk-verification.md). At a high level, version 0.2.0 verifies Partner account/settings/analytics/team resources, Minmo Pay, OTC rates/swaps/agents, wallets, escrow, and typed event subscriptions. These SDK capabilities are not Minmo Maker features until deliberately integrated.

The SDK includes Lightning as a payment channel and accepts Lightning invoices/addresses in payment data. Wallet declarations also expose Lightning receive/send-related inputs. This does **not** verify access to Lightning nodes, peers, channel balances, routing, channel fees, or rebalancing.

## Unverified / Future Investigation

- Lightning node identity and operational connection model;
- channel inventory, local/remote balances, inbound/outbound liquidity, peers, routing, and channel fees;
- channel rebalancing capabilities and economics;
- which Minmo read models should be normalized for maker policy;
- production credential capabilities and connectivity;
- webhook delivery formats;
- requirements for deterministic policy, authorization, and execution.
