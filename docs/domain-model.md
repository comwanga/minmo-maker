# PactAgent domain model

## Retained primitives

The previous engineering phase established useful deterministic foundations. `Sats` remains a branded `bigint`, decimal BTC conversion still accepts strings, and domain validation continues to reject ambiguous or negative money. General strict TypeScript, error, testing, and UI foundations are retained.

## Protocol-facing models

`NostrIdentity` contains only a validated public key and public relay URLs. `UnsignedNostrEvent` deliberately excludes `id` and `sig`; `NostrSigner` defines a future signing boundary without accepting or exposing a private key.

`PontmoreAgentDefinition` models a PIP-00 kind-30360 draft and validates its required tags and minimum versioned content. PIP-00 currently names content fields without fixing their nested value schemas, so PactAgent v1 documents `capabilities.names`, `capabilities.settlement_networks`, string policy references, and string escrow references as application conventions. P001/P002 identifiers and detailed policies remain separate PactAgent fields—not PIP numbers or additions to the protocol.

`PontmoreEscrowDescriptor` models the current PIP-01 public compatibility object.
Its strict allowlisted constructor and parser reject unsupported fields and named
private settlement material. The public descriptor mirrors the existing
recoverable PIP-03 refund-trigger timeout; the remaining `CashuEscrowPlan` fields
are application funding/release/refund intent and have no execution method.

`signCashuEscrowDescriptor` accepts the existing `NostrSigner` interface, confirms
that the signer did not alter the draft, and verifies the resulting NIP-01
signature. `retrieveCashuEscrowDescriptor` queries by kind, author, and `d` tag,
selects the current addressable event, verifies it, and strictly parses it.
`resolveAgentCashuEscrowDescriptor` follows the protocol-visible address stored in
the PIP-00 content and `a` tag rather than relying on fixture identity.

`PontmoreTransitionDraft` models the required PIP-02 transition content. `DocumentSummaryLifecycleState` is a deliberately narrow application-specific vocabulary because the current PIP-02 draft does not define canonical state values. Validation enforces allowed changes, one swap identifier, chronological append-only events, and `prev_state` coherence.

## Application roles

- **P001 Requester:** allows only `document-summary`, has a 500-sat total budget, a 450-sat provider-price ceiling, a 15-minute escrow maximum, Cashu-only settlement, and auto-release only after deterministic completion checks.
- **P002 Provider:** advertises `document-summary`, requires at least 200 sats, accepts text/plain or PDF up to 1 MB, and limits execution to five minutes.

`discoverCompatibleProviders` performs local fixture discovery. `evaluateServiceOffer` applies deterministic capability, identity, price, budget, settlement-network, escrow-reference, and duration constraints. It returns a structured authorization result; it neither signs nor executes anything.
