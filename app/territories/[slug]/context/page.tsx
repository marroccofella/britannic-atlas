import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ContextAnswerClient from "../../../context/answer-client";
import { buildTerritoryContextAnswers, contextReviewedAt } from "../../../context/data";
import { getTerritory, territoryDossiers } from "../../data";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() { return territoryDossiers.map((territory) => ({ slug: territory.slug })); }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const territory = getTerritory((await params).slug);
  if (!territory) return {};
  return { title: `${territory.name}: 100 Structural Context Answers | Britannic Atlas`, description: `One hundred source-linked answers on formal validity, recognition and residual legal gaps in ${territory.name}.`, alternates: { canonical: `/territories/${territory.slug}/context` } };
}

export default async function TerritoryContextPage({ params }: PageProps) {
  const territory = getTerritory((await params).slug);
  if (!territory) notFound();
  const answers = buildTerritoryContextAnswers(territory.slug);
  const index = territoryDossiers.findIndex((item) => item.slug === territory.slug);
  const previous = territoryDossiers[(index - 1 + territoryDossiers.length) % territoryDossiers.length];
  const next = territoryDossiers[(index + 1) % territoryDossiers.length];
  const sources = answers[0]?.authorities ?? territory.sources;
  const schema = { "@context": "https://schema.org", "@type": "Dataset", name: `${territory.name}: 100 structural legal context answers`, dateModified: contextReviewedAt, spatialCoverage: territory.officialName, hasPart: answers.map((answer) => ({ "@type": "Question", name: answer.question, acceptedAnswer: { "@type": "Answer", text: answer.answer } })), isAccessibleForFree: true };
  return <main className="context-shell territory-context-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <header className="kb-header"><Link className="brand" href="/context"><span className="brand-mark">BA</span><span><b>BRITANNIC ATLAS</b><small>STRUCTURAL CONTEXT · {territory.code}</small></span></Link><div className="kb-header-links"><Link className="kb-back" href={`/territories/${territory.slug}`}>Territory dossier</Link><Link className="kb-back" href="/context">All 14 libraries</Link><Link className="kb-back" href="/">← Atlas</Link></div></header>
    <section className="context-territory-hero"><div><span>{territory.code}</span><p>BRITISH OVERSEAS TERRITORY · {territory.region.toUpperCase()}</p><h1>{territory.name}</h1></div><div><strong>100</strong><p>critical-thinking questions answered in the territory’s own constitutional, administrative and legal context.</p><a href="#answers">EXPLORE THE ANSWERS <b>↓</b></a></div></section>
    <section className="context-territory-frame"><div><span>THE LOCAL FRAME</span><h2>Separate system.<br />Specific effect.</h2></div><div><p>{territory.constitutionalPosition}</p><blockquote>{territory.researchNote}</blockquote></div></section>
    <ContextAnswerClient answers={answers} territory={territory.name} />
    <section className="context-sources"><div><span>PRIMARY STARTING POINTS</span><h2>Read the local text<br />before the analogy.</h2><p>These answers are research baselines, not transaction-specific legal advice. Current legislation, commencement history, court rules and treaty extensions remain decisive.</p></div><ol>{sources.map((source, sourceIndex) => <li key={source.href}><span>{String(sourceIndex + 1).padStart(2, "0")}</span><a href={source.href} target="_blank" rel="noreferrer">{source.label}</a><b>↗</b></li>)}</ol></section>
    <nav className="territory-pagination" aria-label="Context libraries"><Link href={`/territories/${previous.slug}/context`}><span>← PREVIOUS</span><b>{previous.name}</b></Link><Link href="/context"><span>DIRECTORY</span><b>14 × 100</b></Link><Link href={`/territories/${next.slug}/context`}><span>NEXT →</span><b>{next.name}</b></Link></nav>
  </main>;
}
