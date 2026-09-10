# PactAgent

**Autonomous agents contracting and settling over open Bitcoin protocols.**

PactAgent is an open-source framework for bounded economic agents that discover each other through Nostr and Pontmore, negotiate narrow service agreements, and target settlement through Cashu ecash escrow. It builds on Pontmore; it is not the Pontmore protocol.

## Current phase

The first pivot phase provides a local, deterministic open-protocol foundation:

- independent public Nostr identities for P001 Requester and P002 Provider;
- PIP-00-compatible agent-definition drafts and local capability discovery;
- deterministic pricing, budget, duration, network, and escrow compatibility checks;
- a PIP-01 `cashu_escrow` descriptor with a PIP-03 recoverable timeout plan;
- a relay-backed PactAgent service-agreement lifecycle for `document-summary@1`;
- one bounded `document-summary` fixture and a transparent UI walkthrough.

The PIP-01 path now constructs a kind `30361` descriptor, signs it through the
isolated `NostrSigner` boundary, verifies its NIP-01 signature, publishes and
retrieves it through a narrow relay port, and resolves the PIP-00 `a`-tag
reference. Deterministic tests use an in-memory relay and synthetic signing key.
Live transport uses the `NostrRelayAdapter` delivered by issue #4. A production
signer remains a dependency of issue #6.

The service-agreement path publishes immutable requester proposals and separately
signed participant transitions as provisional PactAgent kind `3921` regular events.
This unregistered application-owned kind is not a Pontmore PIP or Nostr standard. It validates
the referenced PIP-00 identities and PIP-01 descriptor, reconstructs history from
predecessor event IDs, and refuses unauthorized, stale, forked, or terminal-state
advancement. It does not synthesize a PIP-02 kind `7300` swap for document-summary.

No AI execution, Cashu token handling, mint connection, escrow funding, or real
funds movement exists. Private documents, full results, Cashu tokens, proofs,
credentials, preimages, payout instructions, and key material are not part of
public models.

## Technology

- Node.js 22 or newer
- Next.js 16 and React 19
- strict TypeScript 5.9
- Vitest and ESLint

## Local setup

```powershell
npm install
npm run dev
```

No credentials or external services are needed for the deterministic fixtures and tests.

## Commands

```sh
npm run dev
npm run lint
npm run typecheck
npm test
npm run build -- --webpack
npm start
```

## Trust boundary

AI will be a proposal layer, not the trust root. Deterministic policy authorizes
economic actions, and the production isolated signer supplied by issue #6 will
sign events without exposing private keys to the model. PactAgent application
events are authoritative for the service-agreement lifecycle; private task,
result, and settlement payloads remain outside public events.

See the [architecture](docs/architecture.md), [domain model](docs/domain-model.md), and [pivot record](docs/pivot.md).
The public descriptor wire shape and boundary are documented in the
[PIP-01 Cashu descriptor flow](docs/pip01-cashu-descriptor.md).
The application event shape and lifecycle are documented in
[PactAgent service agreements](docs/pact-service-agreements.md).

## License

MIT
