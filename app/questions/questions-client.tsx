"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { serialiseStructuredData } from "../structured-data";
import { questionDomains, questionLenses } from "./question-data";
import { buildAnsweredQuestionBank, jurisdictionProfiles } from "./answer-data";
import { discoveryLinks } from "../manx/discover/data";

export default function QuestionsClient({ initialJurisdiction = "United Kingdom" }: { initialJurisdiction?: string }) {
  const [domain, setDomain] = useState("all");
  const [lens, setLens] = useState("all");
  const [query, setQuery] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedJurisdiction = searchParams.get("jurisdiction");
  const jurisdiction = jurisdictionProfiles.find(p => p.name === requestedJurisdiction)?.name ?? initialJurisdiction;
  const setJurisdiction = (name: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("jurisdiction", name);
    router.replace(`/questions?${params}`, { scroll: false });
  };
  const [visible, setVisible] = useState(40);
  const questions = useMemo(() => buildAnsweredQuestionBank(jurisdiction), [jurisdiction]);
  const results = useMemo(() => questions.filter((item) => {
    const matchesDomain = domain === "all" || item.domainSlug === domain;
    const matchesLens = lens === "all" || item.lensSlug === lens;
    const haystack = `${item.question} ${item.topic} ${item.domain} ${item.lens}`.toLowerCase();
    return matchesDomain && matchesLens && haystack.includes(query.toLowerCase());
  }), [questions, domain, lens, query]);

  const resetVisible = (action: () => void) => { action(); setVisible(40); };

  return <main className="question-shell">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiseStructuredData({
      "@context": "https://schema.org", "@type": "Dataset",
      name: "18,000 Templated Territory Research Baselines",
      description: "1,000 templated research baselines for each of the United Kingdom, the Crown Dependencies and all 14 British Overseas Territories, composed from jurisdiction, domain and lens templates rather than individually researched.",
      dateModified: "2026-08-16", inLanguage: "en-GB", isAccessibleForFree: true,
      keywords: ["comparative law", "tax compliance", "jurisdiction", "anti-abuse rules", "legal research"],
      distribution: { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: "/api/answers" },
    }) }} />
    <header className="kb-header"><Link className="brand" href="/"><span className="brand-mark">BA</span><span><b>BRITANNICA</b><small>ATLAS OF THE BRITISH WORLD</small></span></Link><Link className="kb-back" href="/knowledge">Knowledge base →</Link></header>
    <section className="question-hero">
      <div><p className="kb-eyebrow">TEMPLATED RESEARCH BASELINES · 18 JURISDICTIONS × 1,000</p><h1>Every question,<br /><em>answered in place.</em></h1></div>
      <div><p>Select the United Kingdom, any Crown Dependency or any of the 14 British Overseas Territories. Every response identifies the local legal baseline, applicability, evidence required and the official route for verification.</p><a href={`/api/answers?jurisdiction=${encodeURIComponent(jurisdiction)}`}>DOWNLOAD ANSWERS AS JSON ↘</a></div>
    </section>
    <section className="question-method answer-method"><strong>18,000</strong><p><b>1,000 templated research baselines for each of 18 constitutional jurisdictions:</b> the UK, three Crown Dependencies and all 14 Overseas Territories. Each baseline is composed from a jurisdiction profile, a domain baseline and a lens finding. It is not an individually researched answer, not instructions for evasion, and not a substitute for fact-specific advice.</p></section>
    <section className="question-workspace">
      <aside className="question-filters">
        <span>FILTER THE BANK</span>
        <label>JURISDICTION<select value={jurisdiction} onChange={(event) => resetVisible(() => setJurisdiction(event.target.value))}>{jurisdictionProfiles.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
        <label>DOMAIN<select value={domain} onChange={(event) => resetVisible(() => setDomain(event.target.value))}><option value="all">All 10 domains</option>{questionDomains.map((item) => <option value={item.slug} key={item.slug}>{item.title}</option>)}</select></label>
        <label>INVESTIGATIVE LENS<select value={lens} onChange={(event) => resetVisible(() => setLens(event.target.value))}><option value="all">All 10 lenses</option>{questionLenses.map((item) => <option value={item.slug} key={item.slug}>{item.title}</option>)}</select></label>
        <label>KEYWORD<input value={query} onChange={(event) => resetVisible(() => setQuery(event.target.value))} placeholder="Search mechanism or issue…" /></label>
        <div className="question-count"><b>{results.length.toLocaleString("en-GB")}</b><span>answered for {jurisdiction}</span></div>
        {jurisdiction === "Isle of Man" && <>
          <Link className="answer-download manx-answer-link" href="/manx">OPEN MANX INTELLIGENCE ↗</Link>
          <Link className="answer-download manx-answer-link" href={discoveryLinks.lawJustice}>EXPLORE CONNECTED TOPICS ↗</Link>
        </>}
        <a className="answer-download" href={`/api/answers?jurisdiction=${encodeURIComponent(jurisdiction)}`}>DOWNLOAD THIS TERRITORY ↗</a>
      </aside>
      <div className="question-results">
        <div className="question-results-head"><span>ANSWERED QUESTION</span><span>OPEN A DOSSIER ↓</span></div>
        {results.slice(0, visible).map((item) => <details className="answer-card" key={item.id} id={item.id}>
          <summary><span>{item.id}</span><div><p>{item.question}</p><small>{item.domain} · {item.lens} · {item.topic}</small></div><b>{item.answer.status}</b><i>+</i></summary>
          <div className="answer-body"><div><span>ANSWER FOR {jurisdiction.toUpperCase()}</span><p>{item.answer.summary}</p></div><aside><span>EVIDENCE TO VERIFY</span><ol>{item.answer.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ol><span>OFFICIAL ROUTES</span>{item.answer.authorities.map((source) => <a key={source.href} href={source.href} target="_blank" rel="noreferrer">{source.label} ↗</a>)}<small>Editorial baseline reviewed {item.answer.reviewedAt}</small></aside></div>
        </details>)}
        {!results.length && <p className="question-empty">No questions match those filters.</p>}
        {visible < results.length && <button className="load-questions" onClick={() => setVisible((count) => count + 40)}>SHOW 40 MORE <span>{visible} / {results.length}</span></button>}
      </div>
    </section>
  </main>;
}
