"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { photoPlaces, places } from "./data";
import { territorySlugByName } from "../territories/data";
import { discoveryLinks } from "../manx/discover/data";

function earthUrl(name: string) {
  return `https://earth.google.com/web/search/${encodeURIComponent(name)}`;
}

function streetUrl(coordinates: [number, number]) {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coordinates[0]},${coordinates[1]}`;
}

function mapsUrl(name: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
}

export default function ExploreClient({ initialPlaceSlug = "england" }: { initialPlaceSlug?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedSlug = places.find(place => place.slug === searchParams.get("place"))?.slug ?? initialPlaceSlug;
  const setSelectedSlug = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("place", slug);
    router.replace(`/explore?${params}`, { scroll: false });
  };
  const [query, setQuery] = useState("");
  const selected = places.find((place) => place.slug === selectedSlug) ?? places[0];
  const filtered = useMemo(() => places.filter((place) => `${place.name} ${place.status} ${place.region} ${place.capital}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const mapEmbed = `https://www.google.com/maps?q=${selected.coordinates[0]},${selected.coordinates[1]}&z=11&output=embed`;

  return <main className="explore-shell">
    <header className="explore-header">
      <Link className="brand explore-brand" href="/"><span className="brand-mark">BA</span><span><b>BRITANNIC ATLAS</b><small>A VISUAL ENCYCLOPAEDIA</small></span></Link>
      <nav aria-label="Explore navigation"><a href="#places">Places</a><a href="#portrait">Portrait</a><Link href="/territories">Territories</Link><a href="#sources">Sources</a><Link href="/knowledge">Knowledge base</Link></nav>
      <Link className="explore-back" href="/">Atlas index ↗</Link>
    </header>

    <section className="explore-hero">
      <div className="explore-hero-photo"><img src="/places/london.jpg" alt="The Palace of Westminster and Elizabeth Tower in London" /></div>
      <div className="explore-hero-shade" />
      <div className="explore-hero-copy">
        <p><span>51° 30′ N</span><span>THE BRITISH WORLD · SEEN UP CLOSE</span></p>
        <h1>Britain,<br /><em>place by place.</em></h1>
        <div><p>A modern visual encyclopaedia of the four UK nations, the Crown Dependencies and Britain’s far-flung territories—with official statistics, constitutional context and immersive ways to look around.</p><a href="#places">Begin exploring <b>↓</b></a></div>
      </div>
      <div className="explore-hero-stats"><div><b>{places.length}</b><span>Featured profiles</span></div><div><b>4</b><span>UK nations</span></div><div><b>3</b><span>Crown Dependencies</span></div><div><b>14</b><span>Overseas Territories</span></div></div>
    </section>

    <section className="photo-ribbon" aria-label="Featured places">
      {photoPlaces.map((place, index) => <button key={place.slug} onClick={() => { setSelectedSlug(place.slug); document.getElementById("portrait")?.scrollIntoView({ behavior: "smooth" }); }}>
        <img src={place.image} alt={place.imageAlt ?? place.name} /><span>{String(index + 1).padStart(2, "0")}</span><strong>{place.name}</strong>
      </button>)}
    </section>

    <section className="place-explorer" id="places">
      <div className="place-explorer-intro"><span>01 / FIND A PLACE</span><h2>From the home nations<br />to the far horizons.</h2><p>Choose a profile to compare people, pay, place and constitutional position. Figures retain their original units and definitions.</p></div>
      <div className="place-index">
        <label>SEARCH THE ATLAS <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try Jersey or Caribbean…" /></label>
        <div>{filtered.map((place) => <button className={place.slug === selected.slug ? "selected" : ""} key={place.slug} onClick={() => setSelectedSlug(place.slug)}><span>{place.status.split(" · ")[0]}</span><strong>{place.name}</strong><small>{place.population} people</small><b>→</b></button>)}</div>
      </div>
    </section>

    <section className="place-portrait" id="portrait">
      <div className="portrait-media">
        {selected.image ? <img src={selected.image} alt={selected.imageAlt ?? selected.name} /> : <div className="portrait-no-photo"><span>{selected.coordinates[0].toFixed(2)}°</span><b>{selected.name}</b><small>{selected.region}</small></div>}
        <div className="portrait-caption"><span>{selected.region}</span>{selected.imageCredit && <a href={selected.imageCredit.href} target="_blank" rel="noreferrer">PHOTO · {selected.imageCredit.label} ↗</a>}</div>
      </div>
      <article className="portrait-copy">
        <div className="portrait-title"><span>{selected.status}</span><h2>{selected.name}</h2><p>{selected.strapline}</p></div>
        <div className="headline-facts"><div><span>Population</span><strong>{selected.population}</strong><small>{selected.populationNote}</small></div><div><span>Earnings level</span><strong>{selected.earnings}</strong><small>{selected.earningsNote}</small></div></div>
        <p className="portrait-intro">{selected.introduction}</p>
        {selected.slug === "isle-of-man" && <>
          <Link className="portrait-dossier-link manx-portrait-link" href="/manx">OPEN MANX FOCUSED INTELLIGENCE <span>↗</span></Link>
          <Link className="portrait-dossier-link manx-portrait-link" href={discoveryLinks.geographyPlaces}>EXPLORE ISLAND TOPICS <span>↗</span></Link>
        </>}
        {territorySlugByName[selected.name] && <Link className="portrait-dossier-link" href={`/territories/${territorySlugByName[selected.name]}`}>OPEN THE COMPLETE {selected.name.toUpperCase()} DOSSIER <span>↗</span></Link>}
        <dl className="fact-grid"><div><dt>Capital</dt><dd>{selected.capital}</dd></div><div><dt>Area</dt><dd>{selected.area}</dd></div><div><dt>Currency</dt><dd>{selected.currency}</dd></div><div><dt>Languages</dt><dd>{selected.languages}</dd></div><div><dt>Time</dt><dd>{selected.timeZone}</dd></div><div><dt>Driving</dt><dd>{selected.driving}</dd></div><div><dt>Calling code</dt><dd>{selected.callingCode}</dd></div><div><dt>Internet</dt><dd>{selected.tld}</dd></div></dl>
        <div className="portrait-character"><span>THE CHARACTER OF THE PLACE</span><ol>{selected.character.map((item) => <li key={item}>{item}</li>)}</ol></div>
      </article>
    </section>

    <section className="immersive-panel">
      <div className="map-frame"><iframe key={selected.slug} src={mapEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={`Map of ${selected.name}`} /></div>
      <div className="map-copy"><span>02 / LOOK AROUND</span><h2>The atlas becomes<br /><em>the landscape.</em></h2><p>Jump from the profile into satellite imagery, 3D terrain, maps and any available street-level imagery. Google coverage varies by place, especially on remote islands.</p><div><a href={earthUrl(selected.name)} target="_blank" rel="noreferrer">OPEN {selected.name.toUpperCase()} IN GOOGLE EARTH <b>↗</b></a><a href={streetUrl(selected.coordinates)} target="_blank" rel="noreferrer">TRY STREET VIEW / PHOTO SPHERES <b>↗</b></a><a href={mapsUrl(selected.name)} target="_blank" rel="noreferrer">OPEN FULL GOOGLE MAP <b>↗</b></a></div></div>
    </section>

    <section className="comparison-note"><span>03 / READ THE NUMBERS</span><h2>Context before comparison.</h2><p>A £850 weekly median in Jersey, a KYD 3,599.50 monthly median in Cayman and a BMD 75,718 annual median in Bermuda describe different labour markets, currencies, periods and survey populations. The original measure is therefore shown beside every number; it is not converted into a misleading league table.</p></section>

    <section className="explore-sources" id="sources"><div><span>04 / PROVENANCE</span><h2>Official sources,<br />close at hand.</h2></div><p>Every population and earnings figure links to the originating national or territorial statistics authority. Open the sources for definitions, revisions and detailed tables.</p><div className="source-list">{selected.sources.map((source, index) => <a key={source.href} href={source.href} target="_blank" rel="noreferrer"><span>{String(index + 1).padStart(2, "0")}</span><b>{source.label}</b><i>↗</i></a>)}</div></section>

    <footer className="explore-footer"><Link className="brand" href="/"><span className="brand-mark">BA</span><span><b>BRITANNIC ATLAS</b><small>THE BRITISH WORLD, PROPERLY MAPPED</small></span></Link><p>Constitutional relationships are described precisely. Population and earnings figures are dated and sourced.</p><span>VISUAL EDITION · 16 AUG 2026</span></footer>
  </main>;
}
