import Link from "next/link";
import BankruptcyResearchClient from "./research-client";
import { territoryInsolvencyProfiles, territoryInsolvencyReviewedAt } from "./territory-data";

export default function BankruptcyResearchPage() {
  const schema = { "@context": "https://schema.org", "@type": "Dataset", name: "1,400 British Overseas Territory insolvency answers", dateModified: territoryInsolvencyReviewedAt, spatialCoverage: territoryInsolvencyProfiles.map((profile) => profile.name), isAccessibleForFree: true };
  return <main className="bankruptcy-shell">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <header className="kb-header"><Link className="brand" href="/"><span className="brand-mark">BA</span><span><b>BRITANNIC ATLAS</b><small>INSOLVENCY ACROSS THE TERRITORIES</small></span></Link><div className="kb-header-links"><Link className="kb-back" href="/territories">14 territories</Link><Link className="kb-back" href="/knowledge">Knowledge base</Link><Link className="kb-back" href="/">← Atlas</Link></div></header>
    <section className="bankruptcy-hero territory-bankruptcy-hero">
      <div><p className="kb-eyebrow">14 TERRITORIES × 100 ANSWERS · REVIEWED {territoryInsolvencyReviewedAt}</p><h1>Insolvency,<br /><em>territory by territory.</em></h1></div>
      <div><p>One hundred neutral questions answered separately for every British Overseas Territory—from full bankruptcy statutes to places where no ordinary resident procedure exists.</p><a href="#answers">CHOOSE A TERRITORY <span>↘</span></a></div>
    </section>
    <section className="bankruptcy-signal"><div><strong>1,400</strong><span>territory answers</span></div><div><strong>14</strong><span>permanent libraries</span></div><div><strong>100</strong><span>questions each</span></div><p><b>Scope note</b> Local equivalents are named precisely. A “no ordinary procedure” answer records the legal and demographic reality; it does not pretend that another jurisdiction’s bankruptcy law applies automatically.</p></section>
    <section className="bankruptcy-method"><span>01 / COMPARATIVE RULE</span><h2>Same question.<br />Different legal answer.</h2><p>Each page distinguishes personal bankruptcy, company liquidation and rescue, secured enforcement, local court powers and cross-border connections. Current official legislation is linked beside every answer.</p></section>
    <BankruptcyResearchClient />
  </main>;
}
