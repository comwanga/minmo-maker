# Phase 2 domain model

Minmo Maker owns its economic types so policy code is stable even if an SDK response changes. External data is validated once at the integration boundary; the domain never imports `@minmoto/sdk`.

## Units

| Concept | Representation | Unit / invariant |
| --- | --- | --- |
| `Sats` | branded `bigint` | integer satoshis; non-negative |
| `KesMinor` | branded `bigint` | integer hundredths of KES; non-negative |
| `BasisPoints` | branded `number` | integer 0–10,000; 10,000 = 100% |
| `KesMinorPerBtc` | two positive `bigint`s | exact rational KES minor units per one BTC |
| `ExactRatio` | two `bigint`s | exact part/total ratio used before optional basis-point rounding |

Decimal BTC and KES input is accepted only as strings and converted explicitly. This avoids IEEE-754 rounding in monetary balances.

## Models

`BtcKesMarketRate` contains the fixed `BTC/KES` pair, an exact rational rate, observation timestamp, and source. The Minmo normalizer rejects wrong pairs, non-positive or non-finite rates, invalid timestamps, and empty sources.

`MakerInventory` contains the maker's available BTC sats, KES minor units, and observation timestamp. It is a snapshot of economic inventory, not a wallet or Lightning-channel model.

`SwapIntent` is a hypothetical customer action with `BUY_BTC` and `SELL_BTC` variants. Each carries positive BTC and KES legs. It has no execution method.

`ProjectedInventory` is the deterministic result of applying a `SwapIntent` to `MakerInventory`. The calculation performs no I/O and rejects insufficient BTC or KES rather than allowing negative balances.

`MakerPolicyInputs` groups market rate, current inventory, proposed swap, projected inventory, exact current/projected ratios, a target BTC ratio, and minimum BTC reserve. It deliberately contains no decision, spread, score, or recommendation.

## Serialization

JSON cannot encode `bigint`. The read-only market route serializes rational numerator and denominator as decimal strings. Domain calculations retain `bigint`; serialization is an API-boundary concern.
