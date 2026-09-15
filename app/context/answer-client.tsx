"use client";

import { useMemo, useState } from "react";
import type { ContextAnswer } from "./data";

export default function ContextAnswerClient({ answers, territory }: { answers: ContextAnswer[]; territory: string }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All questions");
  const categories = useMemo(() => ["All questions", ...Array.from(new Set(answers.map((answer) => answer.category)))], [answers]);
  const filtered = useMemo(() => answers.filter((answer) => {
    const matchesCategory = category === "All questions" || answer.category === category;
    const text = `${answer.id} ${answer.question} ${answer.answer}`.toLowerCase();
    return matchesCategory && text.includes(query.trim().toLowerCase());
  }), [answers, category, query]);

  return <section className="context-library" id="answers">
    <div className="context-controls">
      <label>SEARCH THE 100 ANSWERS<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${territory}…`} /></label>
      <label>STRUCTURAL FIELD<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <div className="context-count"><strong>{filtered.length}</strong><span>answers shown</span></div>
      <button type="button" onClick={() => { setQuery(""); setCategory("All questions"); }}>RESET</button>
    </div>
    <div className="context-answer-list">
      {filtered.map((answer) => <details key={answer.id} open={answer.number === 1 && !query && category === "All questions"}>
        <summary><span>{answer.id}</span><div><small>{answer.category} · {answer.status}</small><h2>{answer.question}</h2></div><b>+</b></summary>
        <div className="context-answer"><div><span>CONTEXTUAL ANSWER / {territory.toUpperCase()}</span><p>{answer.answer}</p></div><aside><span>VERIFY IN A LIVE MATTER</span>{answer.evidence.map((item) => <p key={item}>{item}</p>)}</aside></div>
      </details>)}
      {!filtered.length && <p className="bankruptcy-empty">No answers match those filters.</p>}
    </div>
  </section>;
}
