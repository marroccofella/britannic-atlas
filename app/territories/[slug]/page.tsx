import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTerritory, territoryDossiers } from "../data";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return territoryDossiers.map((territory) => ({ slug: territory.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const territory = getTerritory((await params).slug);
  if (!territory) return { title: "Territory not found | Britannic Atlas" };
  return { title: `${territory.name} dossier | Britannic Atlas`, description: territory.summary, alternates: { canonical: `/territories/${territory.slug}` } };
}

export default async function TerritoryPage({ params }: PageProps) {
  const territory = getTerritory((await params).slug);
  if (!territory) notFound();
  const index = territoryDossiers.findIndex((item) => item.slug === territory.slug);
  const previous = territoryDossiers[(index - 1 + territoryDossiers.length) % territoryDossiers.length];
  const next = territoryDossiers[(index + 1) % territoryDossiers.length];
  const earth = `https://earth.google.com/web/search/${encodeURIComponent(territory.name)}`;
  const maps = `https://www.google.com/maps/search/?api=1&query=${territory.coordinates[0]},${territory.coordinates[1]}`;
  const schema = { "@context": "https://schema.org", "@type": "Place", name: territory.officialName, description: territory.summary, geo: { "@type": "GeoCoordinates", latitude: territory.coordinates[0], longitude: territory.coordinates[1] }, containedInPlace: { "@type": "AdministrativeArea", name: "British Overseas Territories" } };

  return <main className="territory-shell territory-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <header className="kb-header territory-header"><Link className="brand" href="/"><span className="brand-mark">BA</span><span><b>BRITANNIC ATLAS</b><small>TERRITORY DOSSIER · {territory.code}</small></span></Link><div className="kb-header-links"><Link className="kb-back" href="/territories">All territories</Link><Link className="kb-back" href="/questions">Answer library</Link><Link className="kb-back" href="/">← Atlas</Link></div></header>
    <section className={`territory-hero ${territory.image ? "has-image" : ""}`}>
      {territory.image && <div className="territory-hero-image"><img src={territory.image} alt={territory.imageAlt ?? territory.name} /></div>}
      <div className="territory-hero-overlay" />
      <div className="territory-coordinates"><span>{Math.abs(territory.coordinates[0]).toFixed(2)}°{territory.coordinates[0] >= 0 ? "N" : "S"}</span><span>{Math.abs(territory.coordinates[1]).toFixed(2)}°{territory.coordinates[1] >= 0 ? "E" : "W"}</span></div>
      <div className="territory-hero-copy"><p>BRITISH OVERSEAS TERRITORY · {territory.region.toUpperCase()}</p><span>{territory.code}</span><h1>{territory.name}</h1><strong>{territory.summary}</strong></div>
      <div className="territory-fact-strip"><div><span>Administrative centre</span><b>{territory.administrativeCentre}</b></div><div><span>Population</span><b>{territory.population}</b><small>{territory.populationDate}</small></div><div><span>Land area</span><b>{territory.area}</b></div><div><span>Currency</span><b>{territory.currency}</b></div></div>
    </section>

    <section className="territory-relationship"><div><span>01 / THE RELATIONSHIP</span><h2>What kind of<br /><em>British place?</em></h2></div><div><p>{territory.constitutionalPosition}</p><dl><div><dt>OFFICIAL NAME</dt><dd>{territory.officialName}</dd></div><div><dt>TIME ZONE</dt><dd>{territory.timeZone}</dd></div><div><dt>STATUS</dt><dd>British Overseas Territory</dd></div><div><dt>UK ROLE</dt><dd>Defence, external affairs and constitutional responsibilities vary by territory</dd></div></dl></div></section>

    <section className="territory-encyclopedia"><article><span>02 / GOVERNMENT & LAW</span><h2>Institutions</h2><p>{territory.government}</p></article><article><span>03 / ECONOMY</span><h2>Livelihoods</h2><p>{territory.economy}</p></article><article><span>04 / ENVIRONMENT</span><h2>Land & sea</h2><p>{territory.environment}</p></article><article><span>05 / PEOPLE & IDENTITY</span><h2>Belonging</h2><p>{territory.identity}</p></article></section>

    <section className="territory-research"><div><span>06 / RESEARCH CAUTION</span><h2>The shortcut<br />to avoid.</h2></div><blockquote>{territory.researchNote}</blockquote><div className="territory-actions"><a href={`/territories/${territory.slug}/context`}>OPEN 100 STRUCTURAL CONTEXT ANSWERS <b>→</b></a><a href={`/questions?jurisdiction=${encodeURIComponent(territory.name)}`}>OPEN 1,000 TEMPLATED RESEARCH BASELINES <b>→</b></a><a href={`/territories/${territory.slug}/insolvency`}>OPEN 100 INSOLVENCY ANSWERS <b>→</b></a><a href={earth} target="_blank" rel="noreferrer">VIEW IN GOOGLE EARTH <b>↗</b></a><a href={maps} target="_blank" rel="noreferrer">OPEN GOOGLE MAPS <b>↗</b></a></div></section>

    <section className="territory-sources"><div><span>07 / SOURCES</span><h2>Continue with<br />primary material.</h2></div><div>{territory.sources.map((source, sourceIndex) => <a href={source.href} target="_blank" rel="noreferrer" key={source.href}><span>{String(sourceIndex + 1).padStart(2, "0")}</span><b>{source.label}</b><i>↗</i></a>)}</div></section>

    <nav className="territory-pagination" aria-label="Territory dossiers"><Link href={`/territories/${previous.slug}`}><span>← PREVIOUS</span><b>{previous.name}</b></Link><Link href="/territories"><span>DIRECTORY</span><b>14 / 14</b></Link><Link href={`/territories/${next.slug}`}><span>NEXT →</span><b>{next.name}</b></Link></nav>
  </main>;
}
