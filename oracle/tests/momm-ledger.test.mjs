// Reviews are durable artifacts, not new primary-source evidence.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MOMM_CORROBORATION_MIN, deliberatedClaims } from "../lib/deliberate.mjs";
import { citableSources } from "../lib/learning.mjs";
import { KnowledgeBase } from "../lib/kb.mjs";

const ORACLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(ORACLE, file), "utf8");

const officialSource = { title: "Rates and allowances", url: "https://www.gov.im/categories/tax-vat-and-your-money/rates-and-allowances/" };
const material = (over = {}) => ({ resolved_question: "Isle of Man income tax allowances", sources: [officialSource], ...over });
const reviewers = (n) => Array.from({ length: n }, (_, i) => ({ agent: `agent${i}`, status: "success", verdict: "ACCEPT", confidence: 0.9 }));
const structured = { claims: [
  { text: "The Isle of Man single person income tax allowance is 17,000 pounds for 2026/27.", topic: "Manx tax", confidence: 0.85 },
  { text: "short", topic: "x", confidence: 0.9 },
] };

test("propositions are kept only when enough independent reviewers agreed", () => {
  const enough = deliberatedClaims({ structured, material: material(), review: { reviewers: reviewers(MOMM_CORROBORATION_MIN) } });
  assert.deepEqual(enough.claims, [], "agreement cannot attach an old source to a new proposition");
  assert.match(enough.reason, /separate source check/);

  const tooFew = deliberatedClaims({ structured, material: material(), review: { reviewers: reviewers(MOMM_CORROBORATION_MIN - 1) } });
  assert.deepEqual(tooFew.claims, []);
  assert.match(tooFew.reason, /not enough independent reviewers/);
});

test("a reviewed answer with no sources teaches the ledger nothing", () => {
  const none = deliberatedClaims({ structured, material: material({ sources: [] }), review: { reviewers: reviewers(3) } });
  assert.deepEqual(none.claims, []);
  assert.match(none.reason, /carried no sources/, "agreement without a source is recollection, not evidence");
});

test("an ungrounded or dissenting reviewer is not counted as agreement", () => {
  const ungrounded = { reviewers: [{ agent: "grok", status: "success", verdict: "MODIFY", confidence: 0.1 }, ...reviewers(1)] };
  assert.deepEqual(deliberatedClaims({ structured, material: material(), review: ungrounded }).claims, [], "0.1 confidence does not count, leaving one reviewer");
  const rejected = { reviewers: [{ agent: "codex", status: "success", verdict: "REJECT", confidence: 0.9 }, ...reviewers(1)] };
  assert.deepEqual(deliberatedClaims({ structured, material: material(), review: rejected }).claims, []);
  const failed = { reviewers: [{ agent: "codex", status: "timeout" }, ...reviewers(1)] };
  assert.deepEqual(deliberatedClaims({ structured, material: material(), review: failed }).claims, []);
});

test("review agreement cannot launder an invented proposition through an unrelated official URL", () => {
  const result = deliberatedClaims({
    structured: {claims:[{text:"The annual rainfall on the Isle of Man is 9000 millimetres.",confidence:.99}]},
    material: material({sources:[{url:"https://www.gov.im/categories/business-and-industries/companies-registry/",title:"Companies Registry"}]}),
    review:{reviewers:reviewers(6)}
  });
  assert.deepEqual(result.claims,[]);
  assert.match(result.reason,/reviewer agreement is not source evidence/i);
});

test("repeated reviews never increase ledger support without a source check", () => {
  const kb = new KnowledgeBase(":memory:");
  for (let n=0;n<3;n++) {
    const result=deliberatedClaims({structured, material:material(), review:{reviewers:reviewers(3)}});
    for(const claim of result.claims) kb.upsertClaim({...claim,kind:"momm",jurisdiction:"IM"});
  }
  assert.equal(kb.recentLearned(10).length,0);
  kb.close();
});

test("a citation must point at a page, not at a website's front door", () => {
  const rows = citableSources([
    { url: "https://www.gov.im", title: "Isle of Man Government" },
    { url: "https://www.britannica.com/", title: "Britannica" },
    officialSource,
    { url: "https://en.wikipedia.org/wiki/Flag_of_the_Isle_of_Man", title: "Flag" },
    { url: "https://www.gov.im/categories/tax-vat-and-your-money/rates-and-allowances/", title: "duplicate" },
    { url: "javascript:alert(1)", title: "hostile" },
  ]);
  assert.equal(rows.length, 4, "duplicates and non-web URLs are dropped");
  const byUrl = Object.fromEntries(rows.map((row) => [row.url, row]));
  assert.equal(byUrl["https://www.gov.im/"].citable, false, "a bare origin is context, not a reference");
  assert.equal(byUrl["https://www.britannica.com/"].citable, false);
  assert.equal(byUrl[officialSource.url].citable, true);
  assert.equal(byUrl[officialSource.url].official, true);
  assert.equal(byUrl["https://en.wikipedia.org/wiki/Flag_of_the_Isle_of_Man"].official, false);
  assert.equal(rows[0].citable, true, "checkable, official citations sort first");
});

test("the server stores what a review established and says when it stored nothing", () => {
  const server = read("server.mjs");
  assert.match(server, /kind: "momm"/, "reviewed propositions are stored under their own kind");
  assert.match(server, /evidenceKey: `momm:\$\{review\?\.runId \|\| episodeId\}`/, "one review run is one evidence contribution");
  assert.match(server, /corroborated_by: candidate\.agreeing/, "provenance records which models agreed");
  assert.match(server, /learnedSkipped/, "and why nothing was stored when that happens");
  assert.match(server, /citableSources\(\[\.\.\.claims\.flatMap[^;]+episode\.source_excerpts/s, "both ledger and stored excerpt citations pass through validation before review");
});

test("the interface shows what a review taught the ledger, and marks uncheckable citations", () => {
  const app = read("public/app.js");
  assert.match(app, /Added to the ledger \(\$\{learned\.length\}\)/);
  assert.match(app, /Nothing was added to the ledger/);
  assert.match(app, /site homepage, not a page that carries this claim/, "a bare origin is never passed off as a citation");
  assert.ok(app.includes("new URL(href).pathname.replace(/\\/+$/, \"\").length > 0"), "a citation is only checkable when it has a path");
});

test("the page carries the 42.uk identity, the Promptus credit and SEO metadata", () => {
  const html = read("public/index.html"), css = read("public/style.css");
  assert.match(html, /<title>Mannin — the oracle for the Isle of Man<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]{80,}"/, "a real description, not a stub");
  assert.match(html, /rel="canonical" href="https:\/\/42\.uk\/"/);
  assert.match(html, /property="og:site_name" content="42\.uk"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /"isPartOf":\{"@type":"WebSite","name":"42\.uk"/);
  assert.match(html, /Powered by <a href="https:\/\/42\.uk\/"[^>]*>Promptus<\/a>/, "Promptus is credited with a backlink");
  assert.match(html, /part of the <a href="https:\/\/42\.uk\/"[^>]*>42\.uk<\/a> universe/);
  assert.match(html, /RELAX\. IT’S ALREADY OVER\./);
  assert.match(html, /class="crest" aria-hidden="true">◆</);
  assert.match(css, /--bg: #080a0a; --panel: #0e1211/, "the 42.uk terminal palette");
  assert.match(css, /--brass: #00ff99/);
  assert.match(css, /--ink: #e6ffe6/);
  assert.match(css, /--font: ui-monospace/);
  assert.match(css, /\.siteFoot \{/);
  for (const link of html.match(/<a href="https:\/\/42\.uk\/"[^>]*>/g) || []) assert.match(link, /rel="noopener"/, "outbound links carry rel");
});
