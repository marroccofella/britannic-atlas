import type { Metadata } from "next";
import "../../../public/discovery/explorer.css";
import Link from "next/link";
import DiscoveryClient from "./discovery-client";
import { discoveryAreas, discoveryCoverageSentence, discoveryStats, sourceLinkedCaveat } from "./stats";

export const metadata: Metadata = {
  title: "Explore the Isle of Man — Mannin discovery",
  description: `Explore ${discoveryStats.topicCount.toLocaleString("en-GB")} Isle of Man topics across ${discoveryStats.areaCount} areas. ${discoveryCoverageSentence} Follow connected subjects and references, and bring a focused question into Mannin.`,
  alternates: { canonical: "/manx/discover" },
};

export default function DiscoveryPage() {
  return <main className="discovery-page">
    <header className="kb-header discovery-header">
      <Link className="brand" href="/manx"><span className="brand-mark">M</span><span><b>MANX</b><small>ISLAND KNOWLEDGE & DISCOVERY</small></span></Link>
      <nav aria-label="Manx navigation"><Link href="/manx/discover" aria-current="page">Explore topics</Link><Link href="/manx/earth">Map & places</Link><Link href="/manx#modules">Research guides</Link><Link href="/knowledge/isle-of-man">Island dossier</Link><a href="http://127.0.0.1:4242/" target="_blank" rel="noopener noreferrer" title="Requires Mannin to be running on this computer">Open local Mannin ↗</a></nav>
    </header>
    <section className="discovery-coverage" aria-labelledby="discovery-coverage-heading">
      <div>
        <span className="kb-eyebrow">COVERAGE · REVIEWED {discoveryStats.reviewedAt}</span>
        <h2 id="discovery-coverage-heading">{discoveryStats.topicCount.toLocaleString("en-GB")} topics across {discoveryStats.areaCount} areas</h2>
        <p>{discoveryCoverageSentence}</p>
        <p className="discovery-coverage-caveat">{sourceLinkedCaveat} A research outline names a subject and inherits a starting reference; most have no description of their own yet.</p>
      </div>
      <dl className="discovery-coverage-totals">
        <div><dt>Source-linked topics</dt><dd>{discoveryStats.sourceLinkedCount.toLocaleString("en-GB")}</dd></div>
        <div><dt>Research outlines</dt><dd>{discoveryStats.outlineCount.toLocaleString("en-GB")}</dd></div>
        <div><dt>Grouping nodes</dt><dd>{discoveryStats.groupCount.toLocaleString("en-GB")}</dd></div>
      </dl>
      <details className="discovery-coverage-areas">
        <summary>Coverage by area</summary>
        <table>
          <thead><tr><th scope="col">Area</th><th scope="col">Topics</th><th scope="col">Source-linked</th><th scope="col">Outlines</th><th scope="col">Grouping</th></tr></thead>
          <tbody>{discoveryAreas.map((area) => <tr key={area.id}><th scope="row">{area.label}</th><td>{area.topicCount}</td><td>{area.sourceLinkedCount}</td><td>{area.outlineCount}</td><td>{area.groupCount}</td></tr>)}</tbody>
        </table>
      </details>
    </section>
    <DiscoveryClient />
  </main>;
}
