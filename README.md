# Minmo Maker

**Balanced & Profitable Bitcoin Swap Making**

Minmo Maker is an open-source policy engine for Bitcoin liquidity providers.

It uses the [`@minmoto/sdk`] Minmo Partner API client to access Bitcoin/local-currency rates, swaps, wallets, agents, and related market activity.

## The Problem

A Bitcoin swap maker cannot remain profitable by applying the same spread to every trade.

Every swap changes the maker's inventory.

Persistent one-sided order flow can deplete BTC or local-currency reserves, while replenishing liquidity carries a real cost.

The maker therefore needs to continuously answer:

* What should I quote?
* Should I accept this swap?
* What will this trade do to my liquidity?
* When is rebalancing economically justified?
* What is the minimum price that keeps this trade profitable?

## What We Are Building

Minmo Maker evaluates each proposed swap using:

* current BTC and local-currency inventory;
* current market rates;
* recent order flow;
* execution and settlement costs;
* target maker margin;
* inventory imbalance;
* reserve requirements;
* expected rebalancing costs; and
* projected post-trade risk.

The policy engine then produces a decision:

**QUOTE · ACCEPT · REJECT · REBALANCE · WAIT**

Every decision is explainable from the inputs that produced it.

## Initial Policy Model

A quote is constructed from:

```text
Quote Spread =
    Base Margin
  + Execution Cost
  + Inventory Risk Premium
  + Flow Pressure Premium
  + Volatility Buffer
```

A swap is accepted only when the expected profit meets the maker's minimum profitability requirement and the projected inventory remains within configured safety limits.

## Planned Deliverables

The initial milestone is one complete path:

```text
Minmo market state
        ↓
Incoming swap
        ↓
Inventory analysis
        ↓
Dynamic quote
        ↓
Profit calculation
        ↓
Accept / Reject decision
        ↓
Projected inventory
        ↓
Outcome
```

The project will subsequently add simulation, strategy comparison, maker analytics and Lightning-liquidity integration.

## Status

🚧 Development started September 7, 2026.

## License

MIT
