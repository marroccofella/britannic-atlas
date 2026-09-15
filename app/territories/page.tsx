import type { Metadata } from "next";
import Link from "next/link";
import { territoryDossiers } from "./data";

export const metadata: Metadata = {
  title: "All 14 British Overseas Territories | Britannic Atlas",
  description: "Permanent encyclopaedia dossiers for every British Overseas Territory, with constitutional status, people, economy, environment, maps and official sources.",
  alternates: { canonical: "/territories" },
};

export default function TerritoriesIndex() {
  return <main className="territory-shell">
    <header className="kb-header"><Link className="brand" href="/"><span className="brand-mark">BA</span><span><b>BRITANNIC ATLAS</b><small>THE BRITISH WORLD, PROPERLY MAPPED</small></span></Link><div className="kb-header-links"><Link className="kb-back" href="/explore">Visual explore</Link><Link className="kb-back" href="/questions">18,000 templated baselines</Link><Link className="kb-back" href="/">← Atlas</Link></div></header>
    <section className="territory-index-hero"><div><p>THE COMPLETE DIRECTORY · 14 / 14</p><h1>Every territory,<br /><em>on its own terms.</em></h1></div><p>Fourteen constitutional relationships. Fourteen permanent dossiers. Each page separates legal status, local government, people, economy, environment and the responsibilities retained by the United Kingdom.</p></section>
    <section className="territory-directory"><div className="territory-directory-head"><span>CODE</span><span>TERRITORY</span><span>REGION</span><span>POPULATION CONTEXT</span><span>OPEN</span></div>{territoryDossiers.map((territory, index) => <Link href={`/territories/${territory.slug}`} key={territory.slug}><span>{territory.code}</span><div><small>{String(index + 1).padStart(2, "0")}</small><strong>{territory.name}</strong></div><span>{territory.region}</span><span>{territory.population}</span><b>↗</b></Link>)}</section>
    <section className="territory-index-note"><span>HOW TO READ THE DIRECTORY</span><h2>Territory does not mean sameness.</h2><p>Some territories are self-governing island societies with elected institutions. Others are scientific, environmental or military administrations without permanent civilian populations. Each dossier therefore begins with constitutional reality rather than forcing every place into the same template.</p></section>
  </main>;
}
