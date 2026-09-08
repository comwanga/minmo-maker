import { ratioToBasisPoints } from "@/domain/maker-state";
import { formatKesMinor, formatSatsAsBtc } from "@/domain/money";
import { getDemoMakerPolicyInputs } from "@/lib/demo-state";
import { getBtcKesMarketState } from "@/lib/market-state";
import { getFoundationStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

function marketConnectionLabel(
  status: "not_configured" | "unavailable" | "invalid_response" | "available",
): string {
  if (status === "not_configured") return "Not configured";
  if (status === "unavailable") return "Unavailable";
  if (status === "invalid_response") return "Invalid response";
  return "Connected";
}

function marketRateLabel(numerator: string, denominator: string): string {
  const divisor = BigInt(denominator);
  const minor = (BigInt(numerator) + divisor / 2n) / divisor;
  const wholeKes = minor / 100n;
  const cents = (minor % 100n).toString().padStart(2, "0");
  return `KES ${wholeKes.toLocaleString("en-US")}.${cents}`;
}

export default async function Home() {
  const status = getFoundationStatus();
  const market = await getBtcKesMarketState();
  const demo = getDemoMakerPolicyInputs();
  const currentBtcRatio = demo.currentRatios.status === "valued"
    ? ratioToBasisPoints(demo.currentRatios.btc) / 100
    : null;
  const projectedBtcRatio = demo.projectedRatios.status === "valued"
    ? ratioToBasisPoints(demo.projectedRatios.btc) / 100
    : null;

  return (
    <main>
      <section className="hero">
        <nav aria-label="Project identity">
          <span className="mark" aria-hidden="true">M</span>
          <span>MINMO MAKER</span>
          <span className="phase">PHASE 02</span>
        </nav>

        <div className="heroCopy">
          <p className="eyebrow">Deterministic maker state</p>
          <h1>Know the inventory<br /><em>before the quote.</em></h1>
          <p className="lede">
            Precise BTC/KES market observations, integer-safe balances, and side-effect-free
            swap projections form the economic state layer for future maker policy.
          </p>
        </div>

        <div className="signal" aria-hidden="true">
          <span>MARKET</span><i /><span>INVENTORY</span><i /><span>PROJECTION</span>
        </div>
      </section>

      <section className="statusSection" aria-labelledby="status-heading">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow dark">Live boundary</p>
            <h2 id="status-heading">Connection, honestly stated.</h2>
          </div>
          <p>The application never presents fixture data as a Minmo observation.</p>
        </div>

        <dl className="statusGrid">
          <div><dt>Application</dt><dd><span className="dot active" />Ready</dd></div>
          <div><dt>Minmo connection</dt><dd><span className={`dot ${market.status}`} />{marketConnectionLabel(market.status)}</dd></div>
          <div><dt>BTC/KES rate</dt><dd>{market.status === "available" ? marketRateLabel(market.rate.kesMinorPerBtc.numerator, market.rate.kesMinorPerBtc.denominator) : "—"}</dd></div>
          <div><dt>Current phase</dt><dd><span className="dot active" />Maker state</dd></div>
        </dl>
        {market.status === "available" && (
          <p className="marketMeta">Source: {market.rate.source} · Observed {market.rate.observedAt}</p>
        )}
        {status.minmoConfiguration === "missing" && (
          <p className="marketMeta">Set server-only Minmo credentials to request a live read-only rate.</p>
        )}
      </section>

      <section className="modelSection" aria-labelledby="model-heading">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow dark">Deterministic demo fixture</p>
            <h2 id="model-heading">One swap. Every movement explicit.</h2>
          </div>
          <p>This static scenario demonstrates the model only. Its values did not come from Minmo.</p>
        </div>

        <div className="projectionGrid">
          <article>
            <p className="cardLabel">Current inventory</p>
            <strong>{formatSatsAsBtc(demo.inventory.btcSats)} BTC</strong>
            <span>KES {formatKesMinor(demo.inventory.kesMinor)}</span>
            <small>{currentBtcRatio}% BTC value</small>
          </article>
          <article className="swapCard">
            <p className="cardLabel">Hypothetical BUY_BTC</p>
            <strong>− {formatSatsAsBtc(demo.proposedSwap.btcSats)} BTC</strong>
            <span>+ KES {formatKesMinor(demo.proposedSwap.kesMinor)}</span>
            <small>Maker gives BTC · receives KES</small>
          </article>
          <article>
            <p className="cardLabel">Projected inventory</p>
            <strong>{formatSatsAsBtc(demo.projectedInventory.btcSats)} BTC</strong>
            <span>KES {formatKesMinor(demo.projectedInventory.kesMinor)}</span>
            <small>{projectedBtcRatio}% BTC value</small>
          </article>
        </div>
      </section>

      <section className="boundary" aria-labelledby="boundary-heading">
        <div>
          <p className="eyebrow dark">The boundary</p>
          <h2 id="boundary-heading">Inputs now. Policy later.</h2>
        </div>
        <ol>
          <li><span>01</span><strong>Normalize</strong><p>Translate the verified Minmo rate response into application-owned data.</p></li>
          <li><span>02</span><strong>Project</strong><p>Apply a hypothetical swap to inventory with exact integer arithmetic.</p></li>
          <li><span>03</span><strong>Measure</strong><p>Value the portfolio with exact ratios ready for future policy.</p></li>
        </ol>
      </section>

      <footer><span>Minmo Maker</span><span>BOSS Battle 2026 · Freedom Stack</span></footer>
    </main>
  );
}
