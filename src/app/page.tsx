import { discoverCompatibleProviders, evaluateServiceOffer } from "@/domain/pact-agents";
import { createPactDemoFixtures } from "@/lib/pact-fixtures";
import { getProjectStatus } from "@/lib/status";

export default function Home() {
  const status = getProjectStatus();
  const demo = createPactDemoFixtures();
  const providers = discoverCompatibleProviders(demo.requester, [demo.provider], "document-summary");
  const evaluation = evaluateServiceOffer({
    requester: demo.requester,
    provider: demo.provider,
    offer: demo.offer,
    escrowDescriptor: demo.escrowDescriptor,
  });

  return (
    <main>
      <section className="hero">
        <nav aria-label="Project identity">
          <span className="mark" aria-hidden="true">P</span>
          <span>PACTAGENT</span>
          <span className="phase">OPEN PROTOCOL FOUNDATION</span>
        </nav>

        <div className="heroCopy">
          <p className="eyebrow">Bounded machine economy</p>
          <h1>Agents make pacts.<br /><em>Protocols keep the truth.</em></h1>
          <p className="lede">
            Autonomous agents contracting and settling over open Bitcoin protocols—built on
            Pontmore, Nostr identity, and Cashu escrow.
          </p>
        </div>

        <div className="signal" aria-hidden="true">
          <span>NOSTR</span><i /><span>PONTMORE</span><i /><span>CASHU</span>
        </div>
      </section>

      <section className="statusSection" aria-labelledby="status-heading">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow dark">Foundation status</p>
            <h2 id="status-heading">Modeled locally. No false live claims.</h2>
          </div>
          <p>These fixtures exercise protocol compatibility and policy only. No relay, mint, AI, signer, or funds are connected.</p>
        </div>

        <dl className="statusGrid">
          <div><dt>Application</dt><dd><span className="dot active" />{status.application}</dd></div>
          <div><dt>Nostr</dt><dd><span className="dot modeled" />Modeled</dd></div>
          <div><dt>Cashu</dt><dd><span className="dot modeled" />Modeled</dd></div>
          <div><dt>AI execution</dt><dd><span className="dot neutral" />Not implemented</dd></div>
        </dl>
      </section>

      <section className="modelSection" aria-labelledby="agents-heading">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow dark">One bounded service</p>
            <h2 id="agents-heading">Summarize a document for ≤ 500 sats.</h2>
          </div>
          <p>P001 discovers P002 and evaluates a 350-sat offer using deterministic constraints.</p>
        </div>

        <div className="projectionGrid">
          <article>
            <p className="cardLabel">P001 · Requester</p>
            <strong>Discover &amp; verify</strong>
            <span>Budget: 500 sats</span>
            <small>Independent Nostr identity · cashu only · 15-minute escrow maximum</small>
          </article>
          <article className="swapCard">
            <p className="cardLabel">Local discovery</p>
            <strong>{providers.length} compatible provider</strong>
            <span>350 sats · {evaluation.authorized ? "authorized" : "rejected"}</span>
            <small>Policy decides. A future AI may propose, but cannot bypass these checks.</small>
          </article>
          <article>
            <p className="cardLabel">P002 · Provider</p>
            <strong>document-summary</strong>
            <span>Minimum: 200 sats</span>
            <small>Text/PDF · 1 MB maximum · 5-minute execution maximum</small>
          </article>
        </div>
      </section>

      <section className="boundary" aria-labelledby="boundary-heading">
        <div>
          <p className="eyebrow dark">Protocol boundary</p>
          <h2 id="boundary-heading">Public history. Private payloads.</h2>
          <p className="boundaryNote">Current fixture state: <strong>proposal inputs validated</strong></p>
        </div>
        <ol>
          <li><span>00</span><strong>Identity</strong><p>PIP-00 definitions advertise capabilities and reference a default escrow.</p></li>
          <li><span>01</span><strong>Escrow</strong><p>PIP-01 declares Cashu compatibility; tokens and secrets stay private.</p></li>
          <li><span>PA</span><strong>History</strong><p>PactAgent agreement events carry the service lifecycle; PIP-02 remains swap-only.</p></li>
          <li><span>03</span><strong>Recovery</strong><p>PIP-03 timeout fallbacks prevent permanently locked settlement paths.</p></li>
        </ol>
      </section>

      <footer><span>PactAgent</span><span>BOSS Battle 2026 · Freedom Stack + Machine Money</span></footer>
    </main>
  );
}
