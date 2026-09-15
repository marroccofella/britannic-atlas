import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { doctoralDossiers, doctoralReviewedAt, getDoctoralDossier, getDoctoralSources } from "../data";

export function generateStaticParams() {
  return doctoralDossiers.map((dossier) => ({ slug: dossier.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const dossier = getDoctoralDossier(slug);
  if (!dossier) return {};
  return { title: `${dossier.title} | Doctoral Comparative Law`, description: dossier.thesis, alternates: { canonical: `/doctoral/${slug}` } };
}

export default async function DoctoralDossierPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dossier = getDoctoralDossier(slug);
  if (!dossier) notFound();
  const sources = getDoctoralSources(dossier.sourceIds);
  const position = doctoralDossiers.findIndex((item) => item.slug === dossier.slug);
  const previous = doctoralDossiers[(position - 1 + doctoralDossiers.length) % doctoralDossiers.length];
  const next = doctoralDossiers[(position + 1) % doctoralDossiers.length];
  const schema = { "@context": "https://schema.org", "@type": "ScholarlyArticle", headline: dossier.title, description: dossier.thesis, dateModified: doctoralReviewedAt, educationalLevel: "Doctorate", citation: sources.map((source) => source.url), isPartOf: { "@type": "Course", name: "Formal validity across the British–Irish legal archipelago", url: "/doctoral" } };

  return <main className="doctoral-shell doctoral-entry">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <header className="kb-header doctoral-header"><Link className="brand" href="/doctoral"><span className="brand-mark">BA</span><span><b>BRITANNIC ATLAS</b><small>DOCTORAL COMPARATIVE LAW</small></span></Link><div className="kb-header-links"><Link className="kb-back" href="/doctoral">All five dossiers</Link><Link className="kb-back" href="/knowledge">Knowledge base</Link><Link className="kb-back" href="/">← Atlas</Link></div></header>

    <section className="doctoral-entry-hero"><div><span>{dossier.number} / RESEARCH DOSSIER</span><h1>{dossier.title}</h1><p>{dossier.subtitle}</p></div><div><b>THE RESEARCH PROBLEM</b><p>{dossier.question}</p><small>PRIMARY-SOURCE AUDIT · {doctoralReviewedAt}</small></div></section>

    <section className="doctoral-abstract"><span>ABSTRACT / THESIS</span><p>{dossier.thesis}</p></section>

    <section className="doctoral-rule-section"><div className="doctoral-section-head"><span>01 / DOMESTIC RULES</span><h2>Start inside<br />each system.</h2><p>Political labels are excluded from the rule statement. Each column identifies the domestic source, consequence and available cross-border bridge.</p></div><div className="doctoral-rule-grid">{dossier.jurisdictions.map((jurisdiction, index) => <article key={jurisdiction.name}><span>{String(index + 1).padStart(2, '0')}</span><h3>{jurisdiction.name}</h3><dl><div><dt>Rule</dt><dd>{jurisdiction.rule}</dd></div><div><dt>Consequence</dt><dd>{jurisdiction.consequence}</dd></div><div><dt>Bridge</dt><dd>{jurisdiction.bridge}</dd></div></dl></article>)}</div></section>

    <section className="doctoral-analysis"><aside><span>02 / ANALYSIS</span><p>Read as a single argument. The sections move from characterisation to legal effect.</p></aside><div>{dossier.sections.map((section, index) => <article key={section.heading}><span>{String(index + 1).padStart(2, '0')}</span><h2>{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</article>)}</div></section>

    <section className="doctoral-chain"><div><span>03 / CHAIN OF EFFECTS</span><h2>From validity<br />to local effect.</h2></div><ol>{dossier.chain.map((step, index) => <li key={step.label}><span>{String(index + 1).padStart(2, '0')}</span><b>{step.label}</b><p>{step.finding}</p></li>)}</ol></section>

    <section className="doctoral-finding"><span>04 / CONCLUSION</span><blockquote>{dossier.conclusion}</blockquote></section>

    <section className="doctoral-authorities"><div><span>05 / PRIMARY AUTHORITIES</span><h2>The citation<br />ledger.</h2><p>{sources.length} sources used in this dossier. Links open the current official text or decision page.</p></div><ol>{sources.map((source, index) => <li key={source.id}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{source.title}</b><small>{source.jurisdiction} · {source.type}</small><p>{source.proposition}</p></div><a href={source.url} target="_blank" rel="noreferrer" aria-label={`Open ${source.title}`}>↗</a></li>)}</ol></section>

    <section className="doctoral-further"><span>06 / NEXT RESEARCH QUESTIONS</span><ol>{dossier.furtherQuestions.map((question, index) => <li key={question}><b>{String(index + 1).padStart(2, '0')}</b><p>{question}</p></li>)}</ol></section>

    <nav className="doctoral-pager" aria-label="Dossier navigation"><Link href={`/doctoral/${previous.slug}`}><span>← PREVIOUS</span><b>{previous.title}</b></Link><Link href="/doctoral"><span>MODULE INDEX</span><b>All five dossiers</b></Link><Link href={`/doctoral/${next.slug}`}><span>NEXT →</span><b>{next.title}</b></Link></nav>
  </main>;
}
