import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BankruptcyResearchClient from "../../../bankruptcy/research-client";
import { buildTerritoryInsolvencyAnswers, getTerritoryInsolvencyProfile, territoryInsolvencyProfiles, territoryInsolvencyReviewedAt } from "../../../bankruptcy/territory-data";

type PageProps = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return territoryInsolvencyProfiles.map((profile) => ({ slug: profile.slug })); }
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const profile = getTerritoryInsolvencyProfile((await params).slug);
  if (!profile) return { title: "Territory not found | Britannic Atlas" };
  return { title: `${profile.name}: 100 Insolvency Answers | Britannic Atlas`, description: `One hundred locally scoped bankruptcy and insolvency answers for ${profile.name}, with official sources.`, alternates: { canonical: `/territories/${profile.slug}/insolvency` } };
}

export default async function TerritoryInsolvencyPage({ params }: PageProps) {
  const profile = getTerritoryInsolvencyProfile((await params).slug);
  if (!profile) notFound();
  const answers = buildTerritoryInsolvencyAnswers(profile.slug);
  const schema = { "@context": "https://schema.org", "@type": "FAQPage", name: `${profile.name}: 100 insolvency answers`, dateModified: territoryInsolvencyReviewedAt, mainEntity: answers.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) };
  return <main className="bankruptcy-shell territory-insolvency-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <header className="kb-header"><Link className="brand" href="/"><span className="brand-mark">BA</span><span><b>BRITANNIC ATLAS</b><small>{profile.code} · INSOLVENCY DOSSIER</small></span></Link><div className="kb-header-links"><Link className="kb-back" href={`/territories/${profile.slug}`}>Territory dossier</Link><Link className="kb-back" href="/bankruptcy">All 1,400 answers</Link><Link className="kb-back" href="/territories">← 14 territories</Link></div></header>
    <section className="territory-insolvency-hero"><div><p>{profile.regime === "active" ? "PUBLISHED LOCAL PROCEDURE" : "NO ORDINARY LOCAL CONSUMER PROCEDURE"} · REVIEWED {territoryInsolvencyReviewedAt}</p><span>{profile.code}</span><h1>{profile.name}</h1></div><div><strong>100</strong><p>bankruptcy and insolvency questions answered against the territory’s own legal framework.</p><a href="#answers">READ THE ANSWERS ↓</a></div></section>
    <section className="territory-insolvency-framework"><span>LEGAL STARTING POINT</span><h2>{profile.framework}</h2><p>{profile.caution}</p></section>
    <BankruptcyResearchClient initialSlug={profile.slug} locked />
  </main>;
}
