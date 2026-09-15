import Link from "next/link";
import { doctoralDossiers, doctoralJurisdictionMatrix, doctoralReviewedAt, doctoralSources } from "./data";

export default function DoctoralKnowledgeBase() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: "Formal validity across the British–Irish legal archipelago",
    educationalLevel: "Doctorate",
    dateModified: doctoralReviewedAt,
    provider: { "@type": "Organization", name: "Britannic Atlas" },
    hasCourseInstance: doctoralDossiers.map((dossier) => ({ "@type": "CourseInstance", name: dossier.title, url: `/doctoral/${dossier.slug}` })),
  };

  return <main className="doctoral-shell">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <header className="kb-header doctoral-header">
      <Link className="brand" href="/"><span className="brand-mark">BA</span><span><b>BRITANNIC ATLAS</b><small>DOCTORAL COMPARATIVE LAW</small></span></Link>
      <div className="kb-header-links"><Link className="kb-back" href="/knowledge">Knowledge base</Link><Link className="kb-back" href="/territories">Territories</Link><Link className="kb-back" href="/">← Atlas</Link></div>
    </header>

    <section className="doctoral-hero">
      <div className="doctoral-hero-kicker"><span>DOCTORAL MODULE · COMPARATIVE PRIVATE LAW</span><b>REVIEWED {doctoralReviewedAt}</b></div>
      <h1>Formal validity<br /><em>has borders.</em></h1>
      <div className="doctoral-hero-foot"><p>Five completed research dossiers on what happens when legal form crosses from one system into another: not summaries, but rule → divergence → bridge → residual gap.</p><a href="#dossiers">ENTER THE MODULE <span>↓</span></a></div>
    </section>

    <section className="doctoral-stats" aria-label="Module statistics">
      <div><strong>05</strong><span>completed dossiers</span></div><div><strong>04</strong><span>core legal systems</span></div><div><strong>{doctoralSources.length}</strong><span>primary authorities</span></div><div><strong>06</strong><span>steps in every conflicts audit</span></div>
    </section>

    <section className="doctoral-thesis">
      <span>01 / THE CENTRAL THESIS</span>
      <h2>Political association is<br /><em>not a conflicts rule.</em></h2>
      <div><p>The United Kingdom, Ireland, the Isle of Man and Jersey sit close together, but their formal legal requirements do not merge. Domestic validity answers only the first question.</p><p>The receiving system must still supply a treaty, statute, common-law doctrine or administrative exception before the foreign act acquires local effect. Where no bridge is established, this knowledge base says so.</p></div>
    </section>

    <section className="doctoral-dossiers" id="dossiers">
      <div className="doctoral-section-head"><span>02 / COMPLETED RESEARCH</span><h2>Five problems.<br />Five argued answers.</h2><p>Each dossier states the domestic rule, isolates the point of divergence, traces every available bridge and evaluates what remains outside it.</p></div>
      <div className="doctoral-dossier-grid">
        {doctoralDossiers.map((dossier, index) => <Link href={`/doctoral/${dossier.slug}`} className="doctoral-dossier-card" key={dossier.slug}>
          <span>{dossier.number} / DISSERTATION NOTE</span><h3>{dossier.title}</h3><p>{dossier.subtitle}</p><div><b>{dossier.jurisdictions.length} systems compared</b><i>READ THE ARGUMENT ↗</i></div><em aria-hidden="true">{String(index + 1).padStart(2, "0")}</em>
        </Link>)}
      </div>
    </section>

    <section className="doctoral-method">
      <div><span>03 / RESEARCH METHOD</span><h2>The six-step<br />conflicts audit.</h2></div>
      <ol>
        {[['Characterise','Name the legal object: judgment, registration, service act, licence or status.'],['Validate','Read the origin statute, rules and cases to establish domestic validity.'],['Connect','Find the receiving forum’s choice-of-law or recognition rule.'],['Bridge','Identify the treaty, reciprocal statute, common-law doctrine or administrative route.'],['Filter','Test territory, timing, subject exclusions, notice, fraud and public policy.'],['State effect','Say precisely: enforcement, limited recognition, re-registration, evidence only or none.']].map(([title, copy], index) => <li key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{title}</b><p>{copy}</p></div></li>)}
      </ol>
    </section>

    <section className="doctoral-matrix">
      <div className="doctoral-section-head"><span>04 / JURISDICTION MATRIX</span><h2>Four systems,<br />never one shortcut.</h2><p>The matrix keeps constitutional status separate from the operative procedural and registry rules.</p></div>
      <div className="doctoral-table-wrap"><table><thead><tr><th>System</th><th>Constitutional position</th><th>Service</th><th>Company registry</th><th>Vehicle marks</th><th>Recognition</th></tr></thead><tbody>{doctoralJurisdictionMatrix.map((row) => <tr key={row.system}><th>{row.system}</th><td>{row.constitutional}</td><td>{row.service}</td><td>{row.company}</td><td>{row.vehicles}</td><td>{row.recognition}</td></tr>)}</tbody></table></div>
    </section>

    <section className="doctoral-source-register">
      <div><span>05 / AUTHORITY REGISTER</span><h2>Primary law,<br /><em>not inherited assumptions.</em></h2></div>
      <p>Every proposition is routed to legislation, court rules, official decisions, treaty text or current government guidance. Case-law coverage is explicit where an authoritative decision controls the analytical point; no unverified island precedent has been invented to fill a citation box.</p>
      <div className="doctoral-source-sample">{doctoralSources.slice(0, 12).map((source, index) => <a href={source.url} target="_blank" rel="noreferrer" key={source.id}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{source.title}</b><small>{source.jurisdiction} · {source.type}</small></div><i>↗</i></a>)}</div>
      <Link className="doctoral-api-link" href="/api/doctoral">OPEN THE MACHINE-READABLE RESEARCH CORPUS <b>→</b></Link>
    </section>
  </main>;
}
