# Minmo Maker

**Balanced & Profitable Lightning Swap Making**

Minmo Maker is an open-source, agent-assisted liquidity policy engine for balanced and profitable Lightning swap making. It is being built for BOSS Battle 2026 with **Freedom Stack** as its primary direction and a limited, bounded **Machine Money** layer as a secondary direction.

The eventual system will normalize Minmo, market, and Lightning state; apply deterministic pricing, profitability, inventory-risk, and rebalance policy; and only then allow an agent to explain or propose actions. Deterministic calculations and authorization remain authoritative.

## Current phase

Phase 1 establishes the application foundation only:

- Next.js App Router, React, and strict TypeScript;
- a server-only `@minmoto/sdk` client boundary;
- validated server configuration;
- application-owned readiness types and a side-effect-free status route;
- focused tests and explicit SDK findings.

Pricing policy, simulation, AI, agents, Lightning-node integration, rebalancing, and swap execution are not implemented.

## Technology

- Node.js 22 or newer (required by `@minmoto/sdk` 0.2.0)
- Next.js 16
- TypeScript 5.9 in strict mode
- Vitest and ESLint

## Local setup

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Set the two values in `.env.local` only when Minmo configuration is needed:

```dotenv
MINMO_PARTNER_ID=
MINMO_API_KEY=
```

These names are **Minmo Maker application conventions** mapped to the SDK's verified `partnerId` and `apiKey` constructor options. They are never exposed through `NEXT_PUBLIC_` variables. The foundation page works without credentials and accurately reports configuration as missing.

## Commands

```sh
npm run dev        # local development
npm run lint       # lint source and configuration
npm run typecheck  # strict TypeScript check
npm test           # focused unit tests
npm run build      # production build
npm start          # serve a production build
```

## Server-only Minmo boundary

Browser code never imports the SDK client. `src/lib/minmo/client.ts` is marked with `server-only`, centralizes construction, and reads validated configuration from `src/lib/minmo/config.ts`. No secrets are returned by `GET /api/status`; the route reports only application readiness, whether both variables are present, and that remote connectivity has not been tested.

See [architecture](docs/architecture.md) and [SDK verification](docs/sdk-verification.md) for implemented/planned boundaries and package-backed findings.

## License

MIT
