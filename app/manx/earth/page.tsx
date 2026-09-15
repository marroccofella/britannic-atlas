import type { Metadata } from "next";
import Link from "next/link";
import EarthClient from "./earth-client";
import { manxLocalityCount, manxPlaceCategoryCount } from "./data";
import { discoveryLinks } from "../discover/data";

export const metadata: Metadata = {
  title: "MANX Earth & Street View | Britannic Atlas",
  description: "Explore Isle of Man localities through Google Earth, satellite maps, Street View and nearby hotel, bar, fuel and coffee searches.",
  alternates: { canonical: "/manx/earth" },
};

export default function ManxEarthPage() {
  return <main className="manx-earth-shell">
    <header className="kb-header manx-earth-header">
      <Link className="brand" href="/manx"><span className="brand-mark">M</span><span><b>MANX / EARTH</b><small>ISLE OF MAN · LOCAL VIEW FINDER</small></span></Link>
      <div className="kb-header-links"><Link className="kb-back" href={discoveryLinks.geographyPlaces}>Explore island topics</Link><Link className="kb-back" href="/manx">← MANX intelligence</Link><Link className="kb-back" href="/explore?place=isle-of-man">Place profile</Link></div>
    </header>

    <section className="manx-earth-hero">
      <div><p>04 / SPATIAL INTELLIGENCE · ELLAN VANNIN</p><h1>Earth,<br /><em>at street level.</em></h1></div>
      <aside><p>Move from whole-island satellite context to a named Manx locality, then open the nearest available panorama or find useful places around it.</p><div><span>{String(manxLocalityCount).padStart(2, "0")}</span><b>local views</b></div><div><span>{String(manxPlaceCategoryCount).padStart(2, "0")}</span><b>place filters</b></div></aside>
    </section>

    <EarthClient />

    <section className="manx-earth-note"><span>HOW TO READ THIS</span><h2>Place first.<br /><em>Provider second.</em></h2><p>Choose the Manx locality here, then continue into Google’s live service. Satellite, panorama and nearby-business data remain Google-hosted and may change independently; Street View is offered for named localities and opens the closest panorama Google can resolve for that viewpoint.</p></section>

    <footer className="manx-footer"><Link className="brand" href="/manx"><span className="brand-mark">M</span><span><b>MANX</b><small>FOCUSED INTELLIGENCE</small></span></Link><p>This spatial layer supports local orientation. It does not replace Manx legal, planning, licensing or registry evidence.</p><Link href="/manx">RETURN TO MANX ↗</Link></footer>
  </main>;
}
