"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildTerritoryInsolvencyAnswers, getTerritoryInsolvencyProfile, territoryInsolvencyCategories, territoryInsolvencyProfiles } from "./territory-data";

export default function BankruptcyResearchClient({ initialSlug = "anguilla", locked = false }: { initialSlug?: string; locked?: boolean }) {
  const [slug, setSlug] = useState(initialSlug);
  const [category, setCategory] = useState("All topics");
  const [query, setQuery] = useState("");
  const [openAll, setOpenAll] = useState(false);
  const profile = getTerritoryInsolvencyProfile(slug) ?? territoryInsolvencyProfiles[0];
  const answers = useMemo(() => buildTerritoryInsolvencyAnswers(slug), [slug]);
  const results = useMemo(() => answers.filter((item) => {
    const matchesCategory = category === "All topics" || item.category === category;
    return matchesCategory && `${item.question} ${item.answer} ${item.category}`.toLowerCase().includes(query.trim().toLowerCase());
  }), [answers, category, query]);

  return <>
    <section className="bankruptcy-controls territory-bankruptcy-controls" aria-label="Territory insolvency research filters">
      {!locked && <label>TERRITORY<select value={slug} onChange={(event) => { setSlug(event.target.value); setOpenAll(false); }}>
        {territoryInsolvencyProfiles.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
      </select></label>}
      <label>SEARCH THIS TERRITORY<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try ‘home’, ‘secured debt’, ‘discharge’…" /></label>
      <label>TOPIC<select value={category} onChange={(event) => setCategory(event.target.value)}><option>All topics</option>{territoryInsolvencyCategories.map((item) => <option key={item}>{item}</option>)}</select></label>
      <div className="bankruptcy-result-count"><strong>{results.length}</strong><span>answers in {profile.code}</span></div>
      <button onClick={() => setOpenAll((value) => !value)}>{openAll ? "COLLAPSE" : "EXPAND ALL"}</button>
    </section>

    {!locked && <section className="territory-bankruptcy-context">
      <div><span>{profile.code} · CURRENT SELECTION</span><h2>{profile.name}</h2><p>{profile.framework}</p></div>
      <div><small>{profile.regime === "active" ? "PUBLISHED LOCAL PROCEDURE" : "NO ORDINARY LOCAL CONSUMER PROCEDURE"}</small><Link href={`/territories/${profile.slug}/insolvency`}>OPEN PERMANENT 100-ANSWER PAGE <b>↗</b></Link></div>
    </section>}

    <section className="bankruptcy-list territory-bankruptcy-list" id="answers">
      {results.map((item) => <details key={`${profile.slug}-${item.id}-${openAll}`} id={`question-${item.id}`} open={openAll}>
        <summary><span>{item.id.toString().padStart(3, "0")}</span><div><small>{item.category} · {item.status}</small><h2>{item.question}</h2></div><b>＋</b></summary>
        <div className="bankruptcy-answer">
          <p>{item.answer}</p>
          <div><span>OFFICIAL BASIS · {profile.code}</span>{item.sources.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.publisher}: {source.title} ↗</a>)}</div>
        </div>
      </details>)}
      {!results.length && <p className="bankruptcy-empty">No answer matches those filters. Try a broader phrase or switch to all topics.</p>}
    </section>

    <section className="bankruptcy-sources" id="sources">
      <div><span>03 / {profile.code} SOURCE REGISTER</span><h2>Primary law,<br />territory first.</h2></div>
      <p>{profile.caution} These are researched legal baselines, not advice. Verify amendments, commencement, court practice and the facts with a qualified practitioner before acting.</p>
      <ol>{profile.sources.map((source, index) => <li key={source.id}><span>{(index + 1).toString().padStart(2, "0")}</span><a href={source.url} target="_blank" rel="noreferrer"><b>{source.title}</b><small>{source.publisher}</small></a><i>↗</i></li>)}</ol>
    </section>
  </>;
}
