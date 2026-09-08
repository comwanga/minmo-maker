import { getFoundationStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

const labels = {
  configured: "Configured",
  missing: "Missing",
  not_tested: "Not tested",
  foundation: "Foundation",
} as const;

export default function Home() {
  const status = getFoundationStatus();

  return (
    <main>
      <section className="hero">
        <nav aria-label="Project identity">
          <span className="mark" aria-hidden="true">M</span>
          <span>MINMO MAKER</span>
          <span className="phase">PHASE 01</span>
        </nav>

        <div className="heroCopy">
          <p className="eyebrow">Liquidity policy infrastructure</p>
          <h1>Balanced &amp; Profitable<br /><em>Lightning Swap Making</em></h1>
          <p className="lede">
            A deterministic foundation for intelligent maker decisions—designed
            to keep policy, integrations, and future automation in their proper lanes.
          </p>
        </div>

        <div className="signal" aria-hidden="true">
          <span>MARKET</span><i /><span>POLICY</span><i /><span>GUARD</span>
        </div>
      </section>

      <section className="statusSection" aria-labelledby="status-heading">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow dark">System status</p>
            <h2 id="status-heading">Foundation, clearly stated.</h2>
          </div>
          <p>No simulated balances. No invented activity. Just the state of the application today.</p>
        </div>

        <dl className="statusGrid">
          <div><dt>Application</dt><dd><span className="dot active" />Ready</dd></div>
          <div><dt>Minmo configuration</dt><dd><span className={`dot ${status.minmoConfiguration}`} />{labels[status.minmoConfiguration]}</dd></div>
          <div><dt>SDK connectivity</dt><dd><span className="dot neutral" />{labels[status.minmoConnectivity]}</dd></div>
          <div><dt>Current phase</dt><dd><span className="dot active" />{labels[status.phase]}</dd></div>
        </dl>
      </section>

      <section className="boundary" aria-labelledby="boundary-heading">
        <div>
          <p className="eyebrow dark">The boundary</p>
          <h2 id="boundary-heading">Determinism stays in charge.</h2>
        </div>
        <ol>
          <li><span>01</span><strong>Normalize</strong><p>Translate external state into application-owned data.</p></li>
          <li><span>02</span><strong>Decide</strong><p>Calculate policy with explicit, testable economics.</p></li>
          <li><span>03</span><strong>Constrain</strong><p>Keep every future action inside deterministic guardrails.</p></li>
        </ol>
      </section>

      <footer><span>Minmo Maker</span><span>BOSS Battle 2026 · Freedom Stack</span></footer>
    </main>
  );
}
