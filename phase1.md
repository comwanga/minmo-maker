## YOU ARE THE Minmo Maker — Implementation Engineer

# MINMO MAKER — PHASE 1
## Repository Foundation, Verified SDK Integration, and Architectural Boundaries

You are working in the public GitHub repository:

https://github.com/comwanga/minmo-maker

Do not rewrite repository history.
Do not assume the repository is empty.
Inspect the existing repository before modifying anything.

============================================================
1. PROJECT CONTEXT
============================================================

Minmo Maker is being built for BOSS Battle 2026.

PRIMARY DIRECTION

Track 03 — Freedom Stack

Problem:
Balanced & Profitable Lightning Swap Making

SECONDARY DIRECTION

The project may incorporate a limited but genuine Machine Money
component through bounded agent-assisted monitoring, reasoning,
explanation, and eventually constrained action.

Freedom Stack remains the core of the project.

Machine Money must enhance the maker engine rather than replace it.

PROJECT THESIS

Minmo Maker is an intelligent, agent-assisted liquidity policy engine
for balanced and profitable Lightning swap making.

The completed system should eventually help a maker determine:

- what price/spread to quote;
- whether a swap should be accepted or rejected;
- how a proposed swap changes liquidity;
- how inventory and channel state affect pricing;
- whether a swap remains profitable after costs;
- when liquidity should be rebalanced;
- whether a rebalance is economically rational;
- and, eventually, how a bounded agent can monitor, explain,
  recommend, or perform approved actions within deterministic limits.

The intended long-term control hierarchy is:

Market / Minmo / Lightning state
            |
            v
     Normalized State
            |
            v
  Deterministic Economic Engine
            |
     +------+------+
     |             |
     v             v
 Pricing/Risk    Rebalance
     |             |
     +------+------+
            |
            v
    Policy Decision
            |
            v
 Machine Money / Agent Layer
            |
     monitor / explain
     recommend / propose
            |
            v
   Deterministic Guardrails
            |
            v
       Execution Layer

IMPORTANT:

The deterministic policy engine must remain authoritative.

An AI/agent layer must NEVER become the sole authority for:

- monetary calculations;
- balances;
- fee calculations;
- profitability;
- reserve constraints;
- authorization;
- transaction limits;
- signing;
- or execution safety.

Any future agent must operate inside deterministic constraints.

============================================================
2. PHASE 1 SCOPE
============================================================

This is PHASE 1 ONLY.

The objective is to establish:

1. a clean Next.js + TypeScript application;
2. a verified server-only @minmoto/sdk integration boundary;
3. a minimal domain boundary;
4. configuration and security foundations;
5. documentation of verified facts and unresolved assumptions;
6. an architecture capable of supporting later deterministic and
   agent-assisted phases without prematurely implementing them.

DO NOT IMPLEMENT THE MAKER POLICY ENGINE IN THIS PHASE.

DO NOT IMPLEMENT AI IN THIS PHASE.

DO NOT IMPLEMENT AN AGENT IN THIS PHASE.

DO NOT IMPLEMENT LIGHTNING REBALANCING IN THIS PHASE.

DO NOT EXECUTE REAL SWAPS IN THIS PHASE.

DO NOT INVENT FUTURE FUNCTIONALITY.

============================================================
3. REQUIRED TECHNOLOGY DIRECTION
============================================================

The application should use:

- TypeScript;
- Next.js;
- Next.js App Router;
- strict TypeScript configuration;
- server-only Minmo SDK access;
- environment-variable validation;
- focused automated tests.

Use currently compatible package versions discovered from the
repository/package registry/environment.

Do not select versions from memory if they can be verified.

IMPORTANT DISTINCTION:

@minmoto/sdk is expected to be a server-side TypeScript SDK.

Do NOT assume it is a Next.js-specific SDK.

Next.js is the application framework we are choosing around it.

The expected boundary is conceptually:

Browser
   |
   v
Next.js UI
   |
   v
Next.js server boundary
   |
   v
Minmo adapter
   |
   v
@minmoto/sdk
   |
   v
Minmo Partner API

The exact implementation must follow the ACTUAL SDK API discovered
during inspection.

============================================================
4. ZERO-HALLUCINATION RULE
============================================================

This rule is mandatory throughout the phase.

DO NOT INVENT:

- Minmo SDK methods;
- Minmo classes;
- Minmo namespaces;
- Minmo response types;
- Minmo event names;
- Minmo endpoints;
- Minmo webhook formats;
- Minmo authentication mechanisms;
- Minmo wallet behavior;
- Minmo swap behavior;
- Minmo Lightning capabilities;
- Minmo rebalance capabilities;
- Minmo agent capabilities;
- environment variable names;
- API response fields;
- Lightning APIs;
- channel APIs;
- AI provider APIs;
- BOSS Battle requirements not provided to you.

Before using ANY @minmoto/sdk API:

1. inspect the actual installed package;
2. inspect its package.json;
3. inspect its exports;
4. inspect its TypeScript declarations/source where available;
5. inspect its included README/documentation/examples;
6. verify the exact method/type being used.

Classify relevant findings as:

VERIFIED
INFERRED
UNKNOWN

Only VERIFIED SDK functionality may be implemented.

INFERRED functionality must not be treated as fact.

UNKNOWN functionality must remain unresolved.

If documentation and implementation disagree, report the discrepancy.

If a capability needed by the eventual architecture cannot currently
be verified, create an internal boundary/interface only if that
boundary is justified by our own domain model.

Do NOT fabricate an adapter implementation behind it.

It is acceptable and preferred to write:

"Not yet verified"

rather than invent functionality.

============================================================
5. STEP 1 — REPOSITORY INSPECTION
============================================================

Before changing files, inspect the repository completely.

Report:

- current branch;
- git status;
- existing commits;
- existing files;
- README contents;
- LICENSE;
- package configuration if present;
- TypeScript/Next.js configuration if present;
- existing source code;
- existing tests;
- existing documentation.

Do not initialize blindly over existing work.

Do not remove existing project documentation simply because a
framework generator produces replacements.

Preserve the existing project identity.

============================================================
6. STEP 2 — VERIFY @minmoto/sdk
============================================================

Investigate @minmoto/sdk before designing integration code.

Determine from authoritative/package-provided evidence:

- package version;
- supported runtime;
- ESM/CommonJS behavior;
- Node requirements if specified;
- exported classes;
- exported functions;
- exported enums;
- exported types;
- client initialization;
- authentication/configuration requirements;
- functional namespaces/resources;
- read-only capabilities;
- write capabilities;
- documented error behavior;
- documented examples;
- any relevant restrictions.

Pay particular attention to capabilities that may eventually matter
for Minmo Maker, but do NOT assume they exist:

- rates;
- quotes;
- swaps;
- wallets;
- balances;
- activity/history;
- events;
- agents;
- settlement;
- Lightning.

For each one report:

VERIFIED — package evidence confirms it.

UNKNOWN — no sufficient evidence found.

Do not convert "Bitcoin wallet" into "Lightning channel management"
without explicit evidence.

Do not convert "swap" into "Lightning swap" without explicit evidence.

Those distinctions are important.

============================================================
7. STEP 3 — NEXT.JS FOUNDATION
============================================================

Establish a minimal production-quality Next.js application using
TypeScript and App Router.

Prefer a simple structure along the lines of:

src/
  app/
  components/
  domain/
  lib/
    minmo/

docs/

The exact structure may differ if there is a concrete reason.

Avoid unnecessary libraries.

Do not introduce:

- Redux;
- databases;
- queues;
- Redis;
- authentication systems;
- AI frameworks;
- vector databases;
- orchestration frameworks;
- Lightning libraries;
- charting frameworks;

unless an existing repository requirement makes one necessary.

This phase is infrastructure, not feature accumulation.

============================================================
8. STEP 4 — SERVER-ONLY MINMO ADAPTER
============================================================

Create a small server-side integration boundary for @minmoto/sdk.

A possible structure is:

src/lib/minmo/
  client.ts
  config.ts

Additional files should only be created when justified.

Requirements:

- Minmo credentials remain server-side;
- SDK initialization is centralized;
- credentials never enter client bundles;
- secrets are never logged;
- configuration failures produce useful errors without leaking values;
- client components cannot import the privileged SDK client;
- Minmo-specific code does not spread throughout the application.

Use Next.js/server-only mechanisms where appropriate.

Do not invent wrappers for capabilities we have not yet used.

============================================================
9. STEP 5 — ENVIRONMENT CONFIGURATION
============================================================

Create/update:

.env.example

Include ONLY variable names required by VERIFIED configuration.

Never include:

- real credentials;
- fake credentials that resemble real ones;
- private keys;
- tokens;
- production secrets.

Do not guess environment variable names from memory.

Choose our own application environment names only where necessary
and document that they are application conventions rather than SDK
requirements.

============================================================
10. STEP 6 — MINIMAL DOMAIN BOUNDARY
============================================================

Establish only enough domain separation to prevent the future
economic engine from becoming coupled directly to Minmo SDK response
objects.

For example, future architecture may eventually contain concepts such
as:

MakerState
MarketState
LiquidityState
SwapRequest
Quote
PolicyDecision
RiskAssessment
RebalanceRecommendation

BUT:

Do not automatically implement all of these now.

They are future concepts, not verified SDK types.

Only create the minimum types required by Phase 1.

Domain types belong to Minmo Maker.

SDK types belong to @minmoto/sdk.

Keep that distinction explicit.

============================================================
11. STEP 7 — READ-ONLY CONNECTIVITY
============================================================

Determine whether @minmoto/sdk exposes a VERIFIED safe, read-only
operation appropriate for checking connectivity/authentication.

If yes, a server-side status mechanism may use it.

If no such operation can be verified, do NOT fabricate:

minmo.health()
minmo.ping()
minmo.status()
minmo.me()

or any equivalent method.

Instead report only truthful application state such as:

Application: ready
Minmo configuration: configured/not configured
Minmo connectivity: not tested

A status route must never:

- create a wallet;
- initiate a swap;
- send Bitcoin;
- move local currency;
- create an escrow;
- alter an agent;
- mutate remote state.

============================================================
12. STEP 8 — MINIMAL UI
============================================================

Create a restrained initial UI.

It should identify the project as:

Minmo Maker

Balanced & Profitable Lightning Swap Making

It may communicate the architecture and truthful development status.

For example:

Application
Ready

Minmo configuration
Configured / Missing

SDK connectivity
Verified / Not tested

Current Phase
Foundation

Do NOT display invented:

- BTC balances;
- KES balances;
- channel balances;
- swap volume;
- profit;
- spreads;
- maker risk scores;
- rebalancing recommendations;
- transaction histories.

No fake operational dashboard data.

A realistic simulator will be introduced later and must be clearly
identified as simulation when it exists.

============================================================
13. FUTURE MACHINE MONEY BOUNDARY
============================================================

Document the future Machine Money architecture, but do not implement
it.

The future model is:

Deterministic engine
        |
        v
Structured decision
        |
        v
Agent
        |
   +----+----+
   |         |
 explain   propose
   |         |
   +----+----+
        |
        v
Deterministic authorization
        |
        v
Execution

Potential future operating modes are:

OBSERVE
ADVISE
APPROVAL
AUTONOMOUS

These are architectural intentions, NOT Phase 1 features.

Do not create fake implementations for them.

The future agent should consume structured state and structured
policy outputs.

It should not perform financial arithmetic using free-form natural
language when deterministic code can perform that calculation.

For example:

GOOD FUTURE DESIGN:

deterministic engine:
  expectedProfit = ...
  projectedReserve = ...
  risk = ...

agent:
  explains why the decision matters
  proposes an action

guard:
  validates hard limits

BAD FUTURE DESIGN:

prompt an LLM:
"Do you think this swap looks profitable?"

The latter is explicitly NOT our architecture.

============================================================
14. FUTURE LIGHTNING BOUNDARY
============================================================

The BOSS problem concerns balanced and profitable Lightning swap
making.

Therefore eventual Lightning state may become important.

However:

Do not assume @minmoto/sdk exposes:

- Lightning node information;
- channels;
- local balance;
- remote balance;
- inbound liquidity;
- outbound liquidity;
- channel fees;
- rebalancing;
- peers;
- routing.

Verify first.

If @minmoto/sdk does not provide these capabilities, document that
fact.

Do NOT select or integrate another Lightning implementation during
Phase 1.

That decision belongs to a later phase after requirements and SDK
capabilities have been established.

============================================================
15. STEP 9 — TESTING
============================================================

Add focused tests for Phase 1 functionality.

At minimum test, where applicable:

- environment/config validation;
- missing configuration behavior;
- domain mapping introduced in this phase;
- status/readiness behavior;
- server integration boundaries.

Mocks must represent VERIFIED APIs.

Never create mocks for imagined SDK functionality merely to make
tests pass.

Do not make tests dependent on real financial transactions.

============================================================
16. STEP 10 — DOCUMENTATION
============================================================

Update README.md while preserving existing project purpose.

Document:

- project thesis;
- BOSS Battle direction;
- primary Freedom Stack focus;
- secondary Machine Money direction;
- technology stack;
- current implementation phase;
- local setup;
- environment setup;
- run/test/build commands;
- server-only Minmo architecture.

Create:

docs/architecture.md

Document the long-term architecture clearly:

Sources
  |
  +-- Minmo
  |
  +-- future Lightning state
  |
  v
Normalized maker state
  |
  v
Deterministic policy engine
  |
  +-- pricing
  +-- profitability
  +-- inventory risk
  +-- flow pressure
  +-- rebalance economics
  |
  v
Policy decision
  |
  v
Agent-assisted layer
  |
  v
Deterministic guardrails
  |
  v
Execution

Clearly mark components as:

IMPLEMENTED
PLANNED
UNVERIFIED

Do not allow architecture diagrams to imply that planned components
already exist.

Also document:

## Verified SDK Surface

List only verified @minmoto/sdk capabilities.

And:

## Unverified / Future Investigation

Record unresolved questions, particularly around Lightning/channel
capabilities.

============================================================
17. STEP 11 — VALIDATION
============================================================

Run all relevant checks after implementation.

At minimum, where configured:

- install;
- lint;
- TypeScript typecheck;
- tests;
- production build.

Do not say "passed" unless the command was actually executed and
returned successfully.

Record exact commands and outcomes.

If a command fails:

1. investigate;
2. determine the actual cause;
3. fix it if within Phase 1;
4. otherwise document the blocker.

Do not hide warnings or failures.

============================================================
18. SECURITY REQUIREMENTS
============================================================

Treat this as financial software from the beginning.

Never:

- expose Minmo API credentials client-side;
- log secrets;
- commit .env files;
- trust client-provided financial calculations;
- use floating-point arithmetic for real monetary accounting without
  an explicit justified representation;
- execute financial actions from a GET request;
- allow an LLM to bypass deterministic authorization;
- silently fall back to unsafe behavior.

Do not build transaction execution in Phase 1.

============================================================
19. OUT OF SCOPE
============================================================

Explicitly out of scope for Phase 1:

- dynamic spread algorithm;
- inventory-risk algorithm;
- profitability engine;
- order-flow engine;
- Maker Risk Score;
- simulator;
- Lightning node integration;
- channel rebalancing;
- real swap execution;
- autonomous execution;
- LLM integration;
- AI provider selection;
- prompt engineering;
- vector databases;
- user authentication;
- KYC;
- M-Pesa integration;
- OTP;
- mobile application;
- multi-currency expansion;
- production deployment.

Do not implement these "while you're here."

============================================================
20. COMPLETION REPORT
============================================================

When Phase 1 is complete, STOP.

Do not proceed to Phase 2.

Return a structured report containing:

1. PRE-IMPLEMENTATION REPOSITORY STATE

2. VERIFIED @minmoto/sdk FINDINGS
   Include evidence/source location for important SDK claims.

3. IMPLEMENTATION SUMMARY

4. FILES ADDED

5. FILES MODIFIED

6. ARCHITECTURE ESTABLISHED

7. SECURITY BOUNDARIES

8. TESTS ADDED

9. VALIDATION COMMANDS AND EXACT RESULTS

10. VERIFIED SDK CAPABILITIES

11. UNKNOWN / UNVERIFIED SDK CAPABILITIES

12. LIGHTNING-SPECIFIC GAPS

13. KNOWN LIMITATIONS

14. GIT DIFF SUMMARY

15. RECOMMENDED PHASE 2 SCOPE

Do not implement the recommendation.

============================================================
21. GIT RULES
============================================================

Do not:

- rewrite history;
- squash existing commits;
- force push;
- delete unrelated work;
- commit secrets;
- commit generated dependency directories;
- push automatically.

After successful validation, recommend an appropriate commit message.

Suggested:

chore: establish Next.js and Minmo SDK foundation

But adjust the wording if the actual implementation warrants a more
accurate conventional commit.

Do not commit or push unless explicitly instructed.

============================================================
FINAL OPERATING PRINCIPLE
============================================================

Accuracy is more important than apparent completeness.

When evidence is missing:

STOP.
REPORT THE UNKNOWN.
PRESERVE THE ARCHITECTURAL BOUNDARY.

Do not fill missing information with plausible-looking code.

This project will be developed one verified phase at a time.