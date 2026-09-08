# PactAgent

**Autonomous agents contracting and settling over open Bitcoin protocols.**

PactAgent is an open-source framework for bounded economic agents that discover each other through Nostr and Pontmore, negotiate narrow service agreements, and target settlement through Cashu ecash escrow. It builds on Pontmore; it is not the Pontmore protocol.

## Current phase

The first pivot phase provides a local, deterministic open-protocol foundation:

- independent public Nostr identities for P001 Requester and P002 Provider;
- PIP-00-compatible agent-definition drafts and local capability discovery;
- deterministic pricing, budget, duration, network, and escrow compatibility checks;
- a PIP-01 `cashu_escrow` descriptor with a PIP-03 recoverable timeout plan;
- PIP-02 event kinds and coherent application lifecycle transitions;
- one bounded `document-summary` fixture and a transparent UI walkthrough.

No relay publishing, event signing, AI execution, Cashu token handling, mint connection, or real funds movement exists yet. Private documents, full results, Cashu tokens, and key material are not part of public models.

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

AI will be a proposal layer, not the trust root. Deterministic policy authorizes economic actions, and a future isolated signer will sign protocol events without exposing private keys to the model. PIP-02 public history remains authoritative; private task and settlement payloads belong in the companion private channel.

See the [architecture](docs/architecture.md), [domain model](docs/domain-model.md), and [pivot record](docs/pivot.md).

## License

MIT
