import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { KnowledgeBase, deriveStatus, isPrimarySource, registrableDomain, sourceRoutes, confirmedRoutes, claimId } from "../lib/kb.mjs";
import { verifySource, verifyFindingSources, verifyClaimSources, matchClaimToPage, claimBody } from "../lib/source-verification.mjs";
import { entailmentCheck, boundStatusByEntailment, entailmentNotice } from "../lib/entailment.mjs";

const confirmed = (extra = {}) => ({ status: "confirmed", checkedAt: "2026-09-15T00:00:00.000Z", sha256: "a".repeat(64), matched: 1, ...extra });
const page = (body) => async (url) => ({ url, status: 200, headers: { "content-type": "text/html; charset=utf-8" }, body: `<html><head><title>T</title></head><body><main><p>${body}</p></main></body></html>` });
const failing = (code, message) => async () => { throw Object.assign(new Error(message), { code }); };

test("one government is one route, however many subdomains publish for it", () => {
  assert.equal(registrableDomain("https://www.gov.im/x"), "gov.im");
  assert.equal(registrableDomain("https://legislation.gov.im/x"), "gov.im");
  assert.equal(registrableDomain("https://www.legislation.gov.uk/ukpga/1981/61"), "gov.uk");
  assert.equal(registrableDomain("https://tynwald.org.im/x"), "tynwald.org.im");
  assert.equal(registrableDomain("https://www.courts.im/x"), "courts.im");
  assert.equal(registrableDomain("https://en.wikipedia.org/wiki/Tynwald"), "wikipedia.org");
  assert.equal(registrableDomain("https://livrepository.liverpool.ac.uk/1/a.pdf"), "liverpool.ac.uk");
  assert.equal(registrableDomain("not a url"), null);
  const sources = [{ url: "https://www.gov.im/a" }, { url: "https://www.gov.im/a?utm_source=x" }, { url: "https://legislation.gov.im/b" }, { url: "https://tynwald.org.im/c", verification: confirmed() }, { url: "https://gone.example/d", verification: { status: "missing", checkedAt: "2026-09-15T00:00:00.000Z" } }];
  assert.deepEqual([...sourceRoutes(sources)].sort(), ["gov.im", "tynwald.org.im"], "a tracking parameter and a sibling subdomain are the same route; a missing page is none");
  assert.deepEqual([...confirmedRoutes(sources)], ["tynwald.org.im"]);
});

test("verified needs two confirmed routes including a primary one; corroborated needs two distinct routes; nothing sourceless is single_source", () => {
  const gov = { url: "https://www.gov.im/x" }, tynwald = { url: "https://tynwald.org.im/y" }, blog = { url: "https://example.com/z" }, blog2 = { url: "https://example.org/w" };
  assert.equal(deriveStatus({ sources: [], support: 0 }), "hypothesis", "a claim with no source is a hypothesis whatever its kind");
  assert.equal(deriveStatus({ sources: [], support: 3, kind: "momm" }), "hypothesis", "support without a source is not evidence");
  assert.equal(deriveStatus({ sources: [gov], support: 2 }), "single_source", "one route, however often repeated, is one route");
  assert.equal(deriveStatus({ sources: [gov, { url: "https://legislation.gov.im/y" }], support: 2 }), "single_source", "two pages of one government are one route");
  assert.equal(deriveStatus({ sources: [blog, blog2], support: 2 }), "corroborated");
  assert.equal(deriveStatus({ sources: [gov, tynwald], support: 2 }), "corroborated", "two primary routes that nobody has read are corroborated, not verified");
  assert.equal(deriveStatus({ sources: [{ ...gov, verification: confirmed() }, tynwald], support: 2 }), "corroborated", "one confirmed route is not enough");
  assert.equal(deriveStatus({ sources: [{ ...gov, verification: confirmed() }, { ...tynwald, verification: confirmed() }], support: 2 }), "verified");
  assert.equal(deriveStatus({ sources: [{ ...blog, verification: confirmed() }, { ...blog2, verification: confirmed() }], support: 2 }), "corroborated", "two confirmed non-primary routes stay corroborated");
  assert.equal(deriveStatus({ sources: [{ ...gov, verification: { status: "missing", checkedAt: "2026-09-15T00:00:00.000Z" } }], support: 1 }), "hypothesis", "a claim whose only page is gone sinks to a hypothesis");
  assert.equal(deriveStatus({ sources: [{ ...gov, verification: confirmed() }, { ...tynwald, verification: confirmed() }], support: 2, kind: "learned", provenance: { expedition: "x_1" } }), "single_source", "model research stays capped");
  assert.equal(isPrimarySource({ url: "https://blog.example/post", primary: true }), false, "a caller cannot declare a source primary");
  assert.equal(isPrimarySource({ url: "https://www.iomshipregistry.com/" }), true);
  assert.equal(isPrimarySource({ url: "https://www.courts.im/x" }), true);
});

test("the ledger records a verification per source and re-derives status from it", () => {
  const kb = new KnowledgeBase(":memory:");
  const changes = []; kb.onClaimChange((e) => changes.push(e.change));
  const text = "Tynwald sits in Douglas and has two branches, the House of Keys and the Legislative Council.";
  const { claim } = kb.upsertClaim({ text, topic: "Tynwald", jurisdiction: "IM", support: 2, sources: [{ url: "https://www.gov.im/tynwald" }, { url: "https://tynwald.org.im/about" }] });
  assert.equal(claim.status, "corroborated");
  const one = kb.recordSourceVerification(claim.id, "https://www.gov.im/tynwald", confirmed());
  assert.equal(one.status, "corroborated");
  assert.ok(one.verified_at, "a confirmed read is a check and resets the decay anchor");
  const two = kb.recordSourceVerification(claim.id, "https://tynwald.org.im/about", confirmed({ sha256: "b".repeat(64) }));
  assert.equal(two.status, "verified");
  assert.deepEqual(two.sources.map((s) => s.verification.status), ["confirmed", "confirmed"]);
  assert.ok(changes.includes("verify"), "the vector index is told about verification writes");
  // The page behind one route disappears: the claim drops back to a single route.
  const gone = kb.recordSourceVerification(claim.id, "https://tynwald.org.im/about", { status: "missing", checkedAt: "2026-09-16T00:00:00.000Z", detail: "HTTP 404" });
  assert.equal(gone.status, "single_source");
  assert.throws(() => kb.recordSourceVerification(claim.id, "https://www.gov.im/tynwald", { status: "believe-me" }), /invalid/);
  // A merge keeps the newest verification for a URL seen again.
  kb.upsertClaim({ text, sources: [{ url: "https://www.gov.im/tynwald", verification: confirmed({ checkedAt: "2026-09-17T00:00:00.000Z", sha256: "c".repeat(64) }) }], support: 0 });
  assert.equal(kb.getClaim(claim.id).sources[0].verification.sha256, "c".repeat(64));
  const stats = kb.verificationStats();
  assert.equal(stats.sources, 2); assert.equal(stats.confirmed, 1); assert.equal(stats.missing, 1);
  const queue = kb.sourcesToVerify({ limit: 10, staleMs: 0, now: Date.parse("2026-09-18T00:00:00.000Z") });
  assert.equal(queue[0].url, "https://tynwald.org.im/about", "the least recently checked source is re-checked first");
  assert.equal(kb.sourcesToVerify({ limit: 10, now: Date.parse("2026-09-18T00:00:00.000Z") }).length, 0, "recently checked sources are left alone");
  assert.deepEqual(kb.sourcesToVerify({ limit: 10, staleMs: 0, statuses: ["missing"], now: Date.parse("2026-09-18T00:00:00.000Z") }).map((s) => s.url), ["https://tynwald.org.im/about"], "a status filter re-reads only what it names");
  kb.close();
});

test("verifySource turns a read page into a confirmation and a website problem into a recorded outcome, never evidence", async () => {
  const text = "Tynwald sits in Douglas and has two branches, the House of Keys and the Legislative Council.";
  const ok = await verifySource({ text, url: "https://tynwald.org.im/about", read: page("Tynwald, the parliament of the Isle of Man, sits in Douglas. Its branches are the House of Keys and the Legislative Council.") });
  assert.equal(ok.status, "confirmed"); assert.match(ok.sha256, /^[a-f0-9]{64}$/); assert.equal(ok.finalUrl, "https://tynwald.org.im/about");
  const other = await verifySource({ text, url: "https://tynwald.org.im/about", read: page("Opening hours for the public gallery and how to book a tour of the building in Douglas this summer.") });
  assert.equal(other.status, "unmatched"); assert.match(other.detail, /does not mention/);
  assert.equal((await verifySource({ text, url: "https://x.example/a", read: failing("http_error", "The website returned HTTP 404.") })).status, "missing");
  assert.equal((await verifySource({ text, url: "https://x.example/a", read: failing("http_error", "The website returned HTTP 500.") })).status, "unreachable");
  assert.equal((await verifySource({ text, url: "https://x.example/a", read: failing("site_blocked", "refused") })).status, "blocked");
  assert.equal((await verifySource({ text, url: "https://x.example/a", read: failing("ECONNRESET", "reset") })).status, "unreachable");
  assert.equal((await verifySource({ text, url: "https://x.example/a", read: async (url) => ({ url, status: 200, headers: { "content-type": "image/png" }, body: "" }) })).status, "unverifiable");
  assert.equal(matchClaimToPage("Snaefell is 621 metres high.", "Snaefell, the highest point, rises to 621 metres.").ratio, 1);
  assert.equal(claimBody("The constitutional family, without shortcuts — How to research it: Separate formal legal status from political ties."), "Separate formal legal status from political ties.");
  assert.equal(claimBody("Isle of Man — Constitutional order: Tynwald is not devolved. Implication: start with Manx text."), "Tynwald is not devolved. Implication: start with Manx text.");
  assert.equal(claimBody("Tynwald sits in Douglas: it has two branches."), "Tynwald sits in Douglas: it has two branches.", "a colon inside an ordinary sentence is not a heading");
  assert.equal(matchClaimToPage("Isle of Man — Constitutional order: Tynwald sits in Douglas.", "Tynwald sits in Douglas.").ratio, 1, "the editorial heading is not something the page must mention");
  const kept = await verifyFindingSources(text, [{ url: "https://tynwald.org.im/about" }, { url: "https://gone.example/x" }], { read: async (url) => { if (url.includes("gone")) throw Object.assign(new Error("The website returned HTTP 404."), { code: "http_error" }); return page("Tynwald sits in Douglas; House of Keys; Legislative Council.")(url); } });
  assert.deepEqual(kept.map((s) => [s.url, s.verification.status]), [["https://tynwald.org.im/about", "confirmed"]], "a page that is gone is not stored as a citation");
});

test("the routine pass reads stale citations and lets the ledger re-derive status", async () => {
  const kb = new KnowledgeBase(":memory:");
  const text = "Tynwald sits in Douglas and has two branches, the House of Keys and the Legislative Council.";
  const { claim } = kb.upsertClaim({ text, topic: "Tynwald", jurisdiction: "IM", support: 2, sources: [{ url: "https://www.gov.im/tynwald" }, { url: "https://tynwald.org.im/about" }] });
  const read = page("Tynwald sits in Douglas. The House of Keys and the Legislative Council are its branches.");
  const summary = await verifyClaimSources(kb, { limit: 10, staleMs: 0, read });
  assert.equal(summary.checked, 2);
  assert.deepEqual(summary.byStatus, { confirmed: 2 });
  assert.deepEqual(summary.statusChanges, { "corroborated->verified": 1 });
  assert.equal(kb.getClaim(claim.id).status, "verified");
  kb.close();
});

test("expired source excerpts are purged from the ledger, current ones are kept", () => {
  const kb = new KnowledgeBase(":memory:");
  const deleted = []; kb.onClaimChange((e) => { if (e.change === "delete") deleted.push(e.id); });
  const excerpt = (text, expiresAt) => kb.upsertClaim({ text, topic: "weather", kind: "source_excerpt", jurisdiction: "IM", sources: [{ url: "https://api.open-meteo.com/v1/forecast?latitude=54.15&longitude=-4.48" }], provenance: { origin: "public-reader", sourceEvidence: { fetchedAt: "2026-09-13T19:00:00.000Z", expiresAt } } }).claim;
  const stale = excerpt("Open-Meteo model estimate for Douglas: 15.1 degrees Celsius, valid at 2026-09-13T19:00:00.000Z.", "2026-09-13T21:00:00.000Z");
  const fresh = excerpt("Open-Meteo model estimate for Peel: 14.8 degrees Celsius, valid at 2026-09-15T09:00:00.000Z.", "2026-09-15T11:00:00.000Z");
  const keep = kb.upsertClaim({ text: "Tynwald sits in Douglas and is the parliament of the Isle of Man.", sources: [{ url: "https://tynwald.org.im/" }] }).claim;
  const result = kb.purgeExpiredExcerpts({ now: Date.parse("2026-09-15T10:00:00.000Z"), graceMs: 3_600_000 });
  assert.equal(result.purged, 1);
  assert.equal(kb.getClaim(stale.id), null);
  assert.ok(kb.getClaim(fresh.id)); assert.ok(kb.getClaim(keep.id));
  assert.deepEqual(deleted, [stale.id]);
  assert.equal(kb.count(), 2);
  kb.close();
});

test("opening a ledger written under the old rules re-derives every status once and retires reviewer-agreement claims", () => {
  const kb = new KnowledgeBase(":memory:");
  const insert = kb.db.prepare("INSERT INTO claims(id,text,topic,kind,status,confidence,support,contradict,sources,provenance,created_at,verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)");
  const seedText = "What makes a Crown Dependency distinct? — Domestic autonomy: Each dependency legislates for itself.";
  insert.run(claimId(seedText), seedText, "Crown Dependencies", "seed", "verified", 0.92, 4, 0, JSON.stringify([{ url: "https://www.gov.uk/government/publications/crown-dependencies", primary: true }]), JSON.stringify({ origin: "britannica-atlas", editorial: true }), "2026-09-02T00:00:00.000Z", "2026-08-15");
  const twoRoutes = "Isle of Man — Legislation: Most new primary legislation affecting the Island is made in Tynwald.";
  insert.run(claimId(twoRoutes), twoRoutes, "Legislation", "seed", "verified", 0.92, 2, 0, JSON.stringify([{ url: "https://tynwald.org.im/TC/making-legislation", primary: true }, { url: "https://legislation.gov.im/", primary: true }, { url: "https://www.iomshipregistry.com/", primary: true }]), JSON.stringify({ origin: "britannica-atlas" }), "2026-09-02T00:00:00.000Z", "2026-08-23");
  const mommText = "Tynwald is the parliament of the Isle of Man.";
  insert.run(claimId(mommText), mommText, "Tynwald", "momm", "verified", 0.9, 2, 0, JSON.stringify([{ url: "https://tynwald.org.im/TC/making-legislation" }, { url: "https://legislation.gov.im/" }]), JSON.stringify({ origin: "momm-deliberation", corroborated_by: ["codex", "grok"] }), "2026-09-03T00:00:00.000Z", "2026-09-03T00:00:00.000Z");
  kb.setMeta("status_rules_version", "1");
  const summary = kb.migrateStatusRules();
  assert.equal(summary.retired, 1); assert.equal(summary.rederived, 2);
  assert.equal(kb.getClaim(claimId(seedText)).status, "single_source", "one government page, however often stamped, is one unread route");
  assert.equal(kb.getClaim(claimId(twoRoutes)).status, "corroborated");
  const retired = kb.getClaim(claimId(mommText));
  assert.equal(retired.status, "retracted"); assert.match(retired.provenance.reason, /reviewer agreement/);
  assert.ok(!kb.search("parliament of the Isle of Man").some((c) => c.id === retired.id));
  assert.deepEqual(kb.migrateStatusRules(), { skipped: true }, "the migration runs once per rules version");
  kb.close();
});

test("a figure must sit beside its own name in the evidence, and a mostly-entailed answer is named and capped", () => {
  const claims = [{ text: "Douglas is the capital of the Isle of Man." }, { text: "Ramsey had 7,845 residents at the 2021 census." }];
  const swapped = entailmentCheck({ answer: "Ramsey is the capital and Douglas had 7,845 residents in 2021.", claims });
  assert.ok(swapped.unsupported.includes("7,845"), "the figure belongs to Ramsey, not Douglas, in the evidence");
  assert.notEqual(boundStatusByEntailment("verified", swapped), "verified");
  const honest = entailmentCheck({ answer: "Douglas is the capital, and Ramsey had 7,845 residents in 2021.", claims });
  assert.deepEqual(honest.unsupported, []);
  assert.equal(boundStatusByEntailment("verified", honest), "verified");
  const mostly = entailmentCheck({ answer: "Douglas, Ramsey, Peel, Castletown, Laxey, Onchan and Port Erin are Manx towns; Snaefell is the summit.", claims: [{ text: "Douglas, Ramsey, Peel, Castletown, Laxey, Onchan and Port Erin are Manx towns." }] });
  assert.equal(mostly.verdict, "mostly_entailed");
  assert.equal(boundStatusByEntailment("verified", mostly), "corroborated", "one invented term costs the verified badge");
  assert.match(entailmentNotice(mostly), /Snaefell/, "the unbacked term is named, not hidden");
});

test("the unattended dream runner honours the expedition switch and hourly budget, and findings are read before they are stored", () => {
  const dream = fs.readFileSync(new URL("../dream.mjs", import.meta.url), "utf8");
  assert.match(dream, /ORACLE_EXPEDITIONS/); assert.match(dream, /budgetLeft\(\)/);
  const learning = fs.readFileSync(new URL("../lib/learning.mjs", import.meta.url), "utf8");
  assert.match(learning, /verifySources\(/, "expedition findings pass through source verification");
  assert.match(learning, /untrusted source material/, "the research model is told fetched pages are not instructions");
  const server = fs.readFileSync(new URL("../server.mjs", import.meta.url), "utf8");
  assert.match(server, /verifyClaimSources\(kb/); assert.match(server, /purgeExpiredExcerpts\(/); assert.match(server, /verification: kb\.verificationStats\(\)/);
});
