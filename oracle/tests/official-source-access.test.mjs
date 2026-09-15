// The official Manx estate is thinly indexed by search engines and partly
// firewalled: gov.im rejects plain automated requests and its /media/ PDFs are
// refused outright. Reporting a refusal as an absence made every "Check
// official Manx sources" run look permanently empty, which is what the user
// saw as "the search never returns anything".

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boundUnreachableSources, buildResearchPreview, classifyResearchOutcome, isOfficialManxSource } from "../lib/learning.mjs";

const ORACLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(ORACLE, file), "utf8");

const blocked = [
  { url: "https://www.gov.im/media/623687/corporateidentityguidelines.pdf", reason: "request rejected by the site" },
  { url: "https://legislation.gov.im/cms/", reason: "403" },
];

test("unreachable sources are bounded, de-duplicated and labelled official", () => {
  const rows = boundUnreachableSources([
    ...blocked,
    { url: "https://www.gov.im/media/623687/corporateidentityguidelines.pdf", reason: "again" },
    { url: "https://en.wikipedia.org/wiki/Flag_of_the_Isle_of_Man", reason: "timeout" },
    { url: "javascript:alert(1)", reason: "hostile" },
    { url: "not a url", reason: "nonsense" },
    null,
  ]);
  assert.equal(rows.length, 3, "duplicates and non-web URLs are dropped");
  assert.equal(rows.filter((r) => r.official).length, 2);
  assert.equal(rows.find((r) => r.url.includes("wikipedia")).official, false);
  assert.equal(boundUnreachableSources([{ url: "https://www.gov.im/x", reason: "y".repeat(400) }])[0].reason.length, 160);
  assert.equal(boundUnreachableSources([{ url: "https://user:pw@www.gov.im/x", reason: "z" }])[0].url.includes("pw"), false, "credentials never survive");
  assert.deepEqual(boundUnreachableSources("nonsense"), []);
  assert.ok(isOfficialManxSource("https://legislation.gov.im/x"), "a genuine gov.im subdomain counts as official");
});

test("a blocked official check is reported as blocked, not as nothing existing", () => {
  const preview = buildResearchPreview({ mode: "official_sources", strategies: ["research"], findings: [], unresolved: [], spoken: "", unreachable: blocked });
  assert.equal(preview.officialAccessBlocked, true);
  assert.match(preview.summary, /2 official pages refused automated access/);
  assert.doesNotMatch(preview.summary, /No official Manx source on the allowed host list/);
  assert.equal(preview.unreachable.length, 2);

  const genuinelyAbsent = buildResearchPreview({ mode: "official_sources", strategies: ["research"], findings: [], unresolved: [], spoken: "" });
  assert.equal(genuinelyAbsent.officialAccessBlocked, false);
  assert.match(genuinelyAbsent.summary, /No official Manx source on the allowed host list was found/);
});

test("the outcome distinguishes an unreachable official estate from an empty one", () => {
  const unreachableOutcome = classifyResearchOutcome({ mode: "official_sources", learned: [], unreachable: blocked });
  assert.equal(unreachableOutcome.result, "official_source_unreachable");
  assert.equal(unreachableOutcome.officialAccessBlocked, true);
  assert.equal(unreachableOutcome.unreachable.length, 2);

  const absent = classifyResearchOutcome({ mode: "official_sources", learned: [] });
  assert.equal(absent.result, "official_source_not_found");
  assert.equal(absent.officialAccessBlocked, false);

  // A secondary-source finding still cannot pass an official-source request.
  const secondary = classifyResearchOutcome({ mode: "official_sources", unreachable: blocked, learned: [{ status: "single_source", answersQuestion: true, sources: [{ url: "https://en.wikipedia.org/wiki/X" }] }] });
  assert.equal(secondary.answered, false);
  assert.equal(secondary.result, "official_source_unreachable");

  const official = classifyResearchOutcome({ mode: "official_sources", learned: [{ status: "single_source", answersQuestion: true, sources: [{ url: "https://www.gov.im/categories/x/" }] }] });
  assert.equal(official.answered, true);
  assert.equal(official.result, "answered");
});

test("the research pass is told how to reach a thinly indexed, partly firewalled estate", () => {
  const source = read("lib/learning.mjs");
  assert.match(source, /site:gov\.im/, "host-scoped searches are requested explicitly");
  assert.match(source, /site:legislation\.gov\.im/);
  assert.match(source, /files under \/media\/ are frequently refused/, "the known blocked path is called out");
  assert.match(source, /Never invent or guess a URL/);
  assert.match(source, /unreachable_sources/, "the schema collects what could not be read");
  assert.match(source, /unreachable_sources: \{/);
  assert.match(source, /blocked check rather than proof that nothing official exists/);
});

test("blocked pages reach the browser and are shown as such", () => {
  const learning = read("lib/learning.mjs"), app = read("public/app.js");
  assert.match(learning, /officialAccessBlocked: outcome\.officialAccessBlocked, unreachable/, "the finished event carries the evidence");
  assert.match(learning, /unreachable: unreachableSources/, "so does the stored preview");
  assert.match(app, /record\.unreachable\?\.length \? record\.unreachable : record\.preview\?\.unreachable/, "the card reads whichever of the live event or stored preview actually has rows");
  assert.match(app, /function normaliseUnreachable\(/, "model-written rows are bounded before rendering");
  assert.match(app, /unreachable: normaliseUnreachable\(preview\.unreachable\)/, "the bounded preview projection keeps the field");
  assert.match(app, /unreachable: next\.unreachable\.length \? next\.unreachable : old\.unreachable/, "merging a later update never loses it");
  assert.match(app, /Official pages that could not be read/);
  assert.match(app, /blocked check rather than proof that nothing official exists/);
  assert.match(app, /safeExternalHref\(item\.url\)/, "blocked URLs are still rendered through the safe-href guard");
});
