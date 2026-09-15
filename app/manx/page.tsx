import Link from "next/link";
import { serialiseStructuredData } from "../structured-data";
import { getManxSources, manxAgentContract, manxConnections, manxModules, manxReviewedAt, manxSources } from "./data";
import { discoveryLinks } from "./discover/data";
import { discoveryCoverageSentence, discoveryStats } from "./discover/stats";

const kindLabels = {
  core: "Core knowledge",
  answers: "Answer library",
  doctoral: "Comparative law",
  place: "Place evidence",
  machine: "Machine access",
};

export default function ManxPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "MANX — Isle of Man focused intelligence",
    alternateName: manxAgentContract.aliases,
    description: "A source-led routing and synthesis layer for Isle of Man research, connected to the wider Britannic Atlas corpus.",
    dateModified: manxReviewedAt,
    inLanguage: "en-GB",
    isAccessibleForFree: true,
    about: { "@type": "AdministrativeArea", name: "Isle of Man", alternateName: "Ellan Vannin" },
    variableMeasured: manxModules.map((module) => module.title),
    distribution: { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: "/api/manx" },
    citation: [...new Set(manxModules.flatMap((module) => getManxSources(module.sourceIds).map((source) => source.url)))],
  };
  const structuredData = serialiseStructuredData(schema);

  return <main className="manx-shell">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
    <header className="kb-header manx-header">
      <Link className="brand" href="/"><span className="brand-mark">BA</span><span><b>BRITANNIC ATLAS</b><small>MANX FOCUSED INTELLIGENCE</small></span></Link>
      <div className="kb-header-links"><Link className="kb-back" href={discoveryLinks.index}>Explore island topics</Link><Link className="kb-back" href="/manx/earth">Earth &amp; Street View</Link><Link className="kb-back" href="/knowledge/isle-of-man">Core dossier</Link><Link className="kb-back" href="/questions?jurisdiction=Isle%20of%20Man">1,000 templated baselines</Link><a className="kb-back" href="/api/manx">MANX API</a><Link className="kb-back" href="/knowledge">Knowledge base</Link></div>
    </header>

    <section className="manx-discovery-entry"><div><span>EXPLORE THE ISLAND</span><h2>Follow a subject.<br /><em>Discover its connections.</em></h2><p>Browse {discoveryStats.topicCount.toLocaleString("en-GB")} topics across {discoveryStats.areaCount} areas, follow the evidence, and bring your next question into Mannin.</p><p className="manx-discovery-coverage">{discoveryCoverageSentence} Source-linked means a citation is attached, not that it has been checked against the claim.</p></div><Link href={discoveryLinks.index}>Open the topic explorer <b>↗</b></Link></section>

    <section className="manx-hero">
      <div className="manx-hero-mark" aria-hidden="true">M</div>
      <div className="manx-hero-copy"><p>FOCUSED SUBSET · {manxAgentContract.nativeName.toUpperCase()} · REVIEWED {manxReviewedAt}</p><h1 className="manx-wordmark">MANX</h1><strong>Isle of Man<br /><em>intelligence, in place.</em></strong></div>
      <div className="manx-hero-aside"><p>{manxAgentContract.classification}</p><div><span>{manxModules.length}</span><b>focused modules</b></div><div><span>{manxSources.length}</span><b>primary routes</b></div><div><span>1,000</span><b>templated research baselines</b></div></div>
    </section>

    <section className="manx-spatial-entry"><span>LIVE SPATIAL LAYER</span><div><h2>See the Island<br /><em>before you classify it.</em></h2><p>Move from satellite context to street-level Manx localities, then reveal hotels, bars, fuel and coffee through live Google Maps searches.</p></div><Link href="/manx/earth">OPEN EARTH &amp; STREET VIEW <b>↗</b></Link></section>

    <section className="manx-contract">
      <div><span>01 / AGENT CONTRACT</span><h2>Think Manx<br /><em>before comparing.</em></h2><p>{manxAgentContract.useWhen}</p></div>
      <ol>{manxAgentContract.answerSequence.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>)}</ol>
      <aside><span>HARD STOPS</span>{manxAgentContract.hardStops.map((item) => <p key={item}>{item}</p>)}</aside>
    </section>

    <section className="manx-router" id="modules">
      <div className="manx-section-heading"><span>02 / INTELLIGENCE ROUTER</span><div><h2>One island.<br />Ten precise lenses.</h2><p>Route by the actual legal or institutional problem. Combine modules where a matter crosses systems—for example immigration plus work permits, or company formation plus financial regulation.</p></div><a href="/api/manx?q=work%20permit">TRY QUERY ROUTING ↗</a></div>
      <nav className="manx-module-grid" aria-label="MANX intelligence modules">{manxModules.map((module) => <a href={`#${module.id}`} key={module.id}><span>{module.number}</span><strong>{module.title}</strong><p>{module.strapline}</p><b>↓</b></a>)}</nav>
    </section>

    <section className="manx-modules">
      {manxModules.map((module) => {
        const sources = getManxSources(module.sourceIds);
        return <article id={module.id} key={module.id} className="manx-module">
          <header><span>{module.number} / MANX</span><h2>{module.title}</h2><p>{module.strapline}</p></header>
          <div className="manx-module-purpose"><span>MISSION</span><p>{module.purpose}</p><div>{module.keywords.slice(0, 8).map((keyword) => <b key={keyword}>{keyword}</b>)}</div></div>
          <section className="manx-capabilities"><span>AGENTIC CAPABILITIES</span><ol>{module.capabilities.map((capability, index) => <li key={capability}><b>{String(index + 1).padStart(2, "0")}</b><p>{capability}</p></li>)}</ol></section>
          <section className="manx-signals"><span>DECISION SIGNALS</span>{module.signals.map((signal) => <div key={signal.statement}><i className={`manx-volatility ${signal.volatility}`} /> <article><strong>{signal.statement}</strong><p>{signal.implication}</p></article><b>{signal.volatility}</b></div>)}</section>
          <aside className="manx-guardrails"><span>DO NOT COLLAPSE</span>{module.guardrails.map((guardrail) => <p key={guardrail}>{guardrail}</p>)}</aside>
          <section className="manx-module-links"><div><span>PRIMARY ROUTES</span>{sources.map((source) => <a href={source.url} target="_blank" rel="noopener noreferrer" key={source.id}><small>{source.sourceType}</small><b>{source.title}</b><i>↗</i></a>)}</div><div><span>ATLAS CONNECTIONS</span>{module.connections.map((connection) => connection.kind === "machine" ? <a href={connection.href} key={`${module.id}-${connection.href}`}><small>{kindLabels[connection.kind]}</small><b>{connection.label}</b><p>{connection.use}</p><i>→</i></a> : <Link href={connection.href} key={`${module.id}-${connection.href}`}><small>{kindLabels[connection.kind]}</small><b>{connection.label}</b><p>{connection.use}</p><i>→</i></Link>)}</div></section>
        </article>;
      })}
    </section>

    <section className="manx-weave">
      <div><span>03 / KNOWLEDGE WEAVE</span><h2>Focused,<br /><em>not isolated.</em></h2></div>
      <p>MANX is a retrieval layer over the atlas, not a parallel encyclopaedia. It preserves the Isle of Man nexus while handing comparative, place, question-bank and machine tasks to the corpus that already does them best.</p>
      <div>{manxConnections.map((connection) => connection.kind === "machine" ? <a href={connection.href} key={connection.href}><span>{kindLabels[connection.kind]}</span><strong>{connection.label}</strong><p>{connection.use}</p><b>↗</b></a> : <Link href={connection.href} key={connection.href}><span>{kindLabels[connection.kind]}</span><strong>{connection.label}</strong><p>{connection.use}</p><b>↗</b></Link>)}</div>
    </section>

    <footer className="manx-footer"><Link className="brand" href="/"><span className="brand-mark">BA</span><span><b>BRITANNIC ATLAS</b><small>THE BRITISH WORLD, PROPERLY MAPPED</small></span></Link><p>MANX names the focused intelligence subset. The jurisdiction remains the Isle of Man; Ellan Vannin is retained as its Manx name.</p><a href="/api/manx">OPEN MACHINE CORPUS ↗</a></footer>
  </main>;
}
