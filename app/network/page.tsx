import Link from "next/link";
import type { Metadata } from "next";
import { networkPlaces, sharedPractice } from "./data";
import { appDestination, destinationScope, networkApps } from "./routing";

export const metadata: Metadata = { title: "Apps & knowledge | The British world", description: "A connected directory of the Atlas, territory libraries, MANX and Mannin, with distinct voices and shared research practices.", alternates: { canonical: "/network" } };

export default async function NetworkPage({ searchParams }: { searchParams?: Promise<{ place?: string | string[] }> }) {
  const requested = (await searchParams)?.place;
  const slug = Array.isArray(requested) ? requested[0] : requested;
  const place = networkPlaces.find(p => p.slug === slug);
  return <main className="family-page">
    <header className="family-intro"><span>CONNECTED KNOWLEDGE · DISTINCT PERSPECTIVES</span><h1>One British world.<br /><em>Many ways to understand it.</em></h1><p>Choose the guide for your question. Each app keeps its own voice, while the links bring you back to the same places and original research.</p></header>
    <form className="family-context" action="/network" method="get"><label htmlFor="family-place">Your place or jurisdiction</label><select id="family-place" name="place" defaultValue={place?.slug ?? ""}><option value="">Across the British world</option>{networkPlaces.map(p => <option value={p.slug} key={p.slug}>{p.name}</option>)}</select><button type="submit">Find connected apps</button><p>{place ? `${place.name} · ${place.status}. Links retain this place where a library supports it.` : "Pick a place to connect its maps, dossier and specialist libraries."}</p>{slug && !place && <p role="status">That place is not in this directory. Showing all apps.</p>}</form>
    <section className="family-grid" aria-label="Apps and knowledge libraries">{networkApps.map(app => {
      const href = appDestination(app, place), local = app.id === "mannin";
      const Destination = local ? "a" : Link;
      const scope = destinationScope(app, place);
      return <article className={`family-card family-${app.id}`} key={app.id}><div className="family-card-top"><span className="family-mark">{app.mark}</span><span>{app.role}</span></div><h2>{app.name}</h2><p className="family-voice">{app.voice}</p><p>{app.focus}</p><small>{scope}{local ? " · Runs on this computer" : ""}</small><Destination href={href} target={local ? "_blank" : undefined} rel={local ? "noopener noreferrer" : undefined}>Open {app.name} <span aria-hidden="true">↗</span></Destination>{local && <p className="family-local-note">Start Mannin locally first. Your Atlas stays open; your conversation stays in Mannin.</p>}</article>;
    })}</section>
    <section className="family-practice"><div><span>THE COMMON GOOD</span><h2>Share the knowledge.<br />Respect its context.</h2><p>These are the shared editorial principles. The source libraries retain their own review dates and coverage; this directory does not certify every answer.</p></div><ol>{sharedPractice.map(rule => <li key={rule.title}><h3>{rule.title}</h3><p>{rule.detail}</p></li>)}</ol></section>
    <section className="family-resources"><h2>For connected research tools</h2><p>The <a href="/api/network">app directory API</a> publishes the same destinations, personas and shared principles. Existing knowledge APIs remain the source for their own records.</p><Link href="/llms.txt">Knowledge guide for assistants →</Link><p>Mannin runs locally. The hosted Atlas currently requires the owner’s sign-in.</p></section>
  </main>;
}
