import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: path.startsWith("/api/") ? "application/json" : "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the atlas as an indexable knowledge site", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<html lang="en-GB">/);
  assert.match(html, /<title>Britannica Atlas — British World Knowledge Base<\/title>/);
  assert.match(html, /The British world/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /\/knowledge/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("renders a crawlable knowledge index and article", async () => {
  const index = await render("/knowledge");
  assert.equal(index.status, 200);
  const indexHtml = await index.text();
  assert.match(indexHtml, /Knowledge,.*with provenance\./s);
  assert.match(indexHtml, /The constitutional family, without shortcuts/);
  assert.match(indexHtml, /OFFICIAL-SOURCE MONITOR/);

  const article = await render("/knowledge/crown-dependencies");
  assert.equal(article.status, 200);
  const articleHtml = await article.text();
  assert.match(articleHtml, /What makes a Crown Dependency distinct\?/);
  assert.match(articleHtml, /ANSWER IN BRIEF/);
  assert.match(articleHtml, /SOURCES &amp; PROVENANCE/);
  assert.match(articleHtml, /schema\.org/);
});

test("exposes discovery files for search and knowledge engines", async () => {
  const [robots, sitemap, llms, api, questionApi] = await Promise.all([
    render("/robots.txt"), render("/sitemap.xml"), render("/llms.txt"), render("/api/knowledge"), render("/api/questions?jurisdiction=Jersey"),
  ]);
  assert.match(await robots.text(), /Sitemap: http:\/\/localhost\/sitemap\.xml/);
  assert.match(await sitemap.text(), /<loc>http:\/\/localhost\/knowledge\/commonwealth<\/loc>/);
  assert.match(await llms.text(), /## Machine-readable resources/);
  const json = await api.json();
  assert.equal(json.items.length, 7);
  assert.equal(json.dateModified, "2026-08-23");
  assert.equal(json.focusedSubsets[0].name, "MANX");
  const questionJson = await questionApi.json();
  assert.equal(questionJson.count, 1000);
  assert.deepEqual(questionJson.dimensions, { domains: 10, mechanisms: 100, lenses: 10 });
  assert.match(questionJson.questions[0].question, /in Jersey/);
});

test("every page advertised in the sitemap resolves", async () => {
  const response = await render("/sitemap.xml");
  assert.equal(response.status, 200);
  const xml = await response.text();
  const paths = [...xml.matchAll(/<loc>http:\/\/localhost([^<]*)<\/loc>/g)].map((match) => match[1] || "/");
  assert.ok(paths.length > 20);
  const responses = await Promise.all(paths.map((path) => render(path)));
  const failures = paths.filter((_, index) => responses[index].status !== 200);
  assert.deepEqual(failures, []);
});

test("renders the searchable territory answer library", async () => {
  const response = await render("/questions");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Every question/);
  assert.match(html, /18,000/);
  assert.match(html, /Q-0001/);
  assert.match(html, /Templated baseline/);
  assert.doesNotMatch(html, /Answered baseline/);
  assert.match(html, /theme-toggle/);
  assert.match(html, /application\/ld\+json/);
});

test("provides one thousand templated research baselines for every British jurisdiction", async () => {
  const [jersey, antarctic, turks] = await Promise.all([
    render("/api/answers?jurisdiction=Jersey"),
    render("/api/answers?jurisdiction=British%20Antarctic%20Territory"),
    render("/api/answers?jurisdiction=Turks%20and%20Caicos%20Islands"),
  ]);
  const jerseyJson = await jersey.json();
  const antarcticJson = await antarctic.json();
  const turksJson = await turks.json();
  assert.equal(jerseyJson.count, 1000);
  assert.equal(jerseyJson.totalTerritories, 18);
  assert.match(jerseyJson.answers[0].answer.summary, /Jersey/);
  assert.equal(antarcticJson.answers[0].answer.status, "Not ordinarily applicable");
  assert.equal(turksJson.count, 1000);
  assert.equal(jerseyJson.answers[0].answer.status, "Templated baseline");
  assert.match(jerseyJson.method, /composed from a jurisdiction profile/);
});

test("renders the visual place encyclopaedia and its data API", async () => {
  const [page, api] = await Promise.all([render("/explore"), render("/api/places")]);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Britain,.*place by place\./s);
  assert.match(html, /OPEN.*ENGLAND.*IN GOOGLE EARTH/s);
  assert.match(html, /Street View \/ Photo spheres/i);
  assert.match(html, /Context before comparison/);
  assert.match(html, /application\/ld\+json/);
  const json = await api.json();
  assert.equal(json.count, 10);
  assert.equal(json.places[0].population, "58,620,101");
});

test("links and renders permanent dossiers for all 14 Overseas Territories", async () => {
  const [home, directory, gibraltar, api, sitemap] = await Promise.all([
    render("/"),
    render("/territories"),
    render("/territories/gibraltar"),
    render("/api/territories"),
    render("/sitemap.xml"),
  ]);
  assert.equal(directory.status, 200);
  assert.equal(gibraltar.status, 200);
  assert.match(await home.text(), /href="\/territories\/falkland-islands"/);
  const directoryHtml = await directory.text();
  assert.match(directoryHtml, /Every territory/);
  assert.match(directoryHtml, /14 \/ 14/);
  assert.match(directoryHtml, /href="\/territories\/pitcairn-islands"/);
  const gibraltarHtml = await gibraltar.text();
  assert.match(gibraltarHtml, /What kind of/);
  assert.match(gibraltarHtml, /VIEW IN GOOGLE EARTH/);
  assert.match(gibraltarHtml, /OPEN 1,000 TEMPLATED RESEARCH BASELINES/);
  assert.match(gibraltarHtml, /OPEN 100 INSOLVENCY ANSWERS/);
  const json = await api.json();
  assert.equal(json.count, 14);
  assert.equal(json.territories.length, 14);
  assert.ok(json.territories.every((territory) => territory.url.startsWith("/territories/")));
  assert.match(await sitemap.text(), /<loc>http:\/\/localhost\/territories\/turks-caicos-islands<\/loc>/);
});

test("answers 100 insolvency questions separately for every territory", async () => {
  const [index, anguilla, antarctic, anguillaApi, allApi, sitemap] = await Promise.all([
    render("/bankruptcy"),
    render("/territories/anguilla/insolvency"),
    render("/territories/british-antarctic-territory/insolvency"),
    render("/api/bankruptcy?territory=anguilla"),
    render("/api/bankruptcy"),
    render("/sitemap.xml"),
  ]);
  assert.equal(index.status, 200);
  assert.match(await index.text(), /1,400/);
  const anguillaHtml = await anguilla.text();
  assert.match(anguillaHtml, /Anguilla/);
  assert.match(anguillaHtml, /What is bankruptcy \(or its local equivalent\)\?/);
  assert.match(anguillaHtml, /Bankruptcy Act, R\.S\.A\. c\. B15/);
  const antarcticHtml = await antarctic.text();
  assert.match(antarcticHtml, /NO ORDINARY LOCAL CONSUMER PROCEDURE/);
  assert.match(antarcticHtml, /no ordinary resident consumer-bankruptcy procedure/i);
  const one = await anguillaApi.json();
  assert.equal(one.count, 100);
  assert.equal(one.answers.length, 100);
  assert.match(one.answers[0].answer, /Anguilla/);
  const all = await allApi.json();
  assert.equal(all.count, 1400);
  assert.equal(all.territoryCount, 14);
  assert.ok(all.territories.every((territory) => territory.answers.length === 100));
  assert.match(await sitemap.text(), /<loc>http:\/\/localhost\/territories\/gibraltar\/insolvency<\/loc>/);
});

test("publishes the completed doctoral comparative-law knowledge base", async () => {
  const [index, service, recognition, api, sitemap] = await Promise.all([
    render("/doctoral"),
    render("/doctoral/service-of-process"),
    render("/doctoral/recognition-and-residual-gaps"),
    render("/api/doctoral"),
    render("/sitemap.xml"),
  ]);
  assert.equal(index.status, 200);
  const indexHtml = await index.text();
  assert.match(indexHtml, /Formal validity.*has borders/s);
  assert.match(indexHtml, /Five problems.*Five argued answers/s);
  assert.match(indexHtml, /The six-step.*conflicts audit/s);
  const serviceHtml = await service.text();
  assert.match(serviceHtml, /Service is not mere notice/);
  assert.match(serviceHtml, /Abela v Baadarani/);
  assert.match(serviceHtml, /PRIMARY AUTHORITIES/);
  assert.match(await recognition.text(), /Hague 2019 changes the contemporary map/);
  const json = await api.json();
  assert.equal(json.count, 5);
  assert.ok(json.sourceCount >= 30);
  assert.equal(json.methodology.length, 6);
  assert.match(await sitemap.text(), /<loc>http:\/\/localhost\/doctoral\/company-names<\/loc>/);
});

test("answers the 100 structural context questions in every territory", async () => {
  const [directory, bermuda, antarctic, oneApi, allApi, sitemap] = await Promise.all([
    render("/context"),
    render("/territories/bermuda/context"),
    render("/territories/british-antarctic-territory/context"),
    render("/api/context?territory=bermuda"),
    render("/api/context"),
    render("/sitemap.xml"),
  ]);
  assert.equal(directory.status, 200);
  assert.match(await directory.text(), /1,400/);
  const bermudaHtml = await bermuda.text();
  assert.match(bermudaHtml, /Bermuda/);
  assert.match(bermudaHtml, /What constitutes a valid address for service/);
  assert.match(bermudaHtml, /Where, in any given pair of related legal systems/);
  assert.match(bermudaHtml, /CONTEXTUAL ANSWER/);
  const antarcticHtml = await antarctic.text();
  assert.match(antarcticHtml, /Exceptional \/ limited application/);
  const one = await oneApi.json();
  assert.equal(one.count, 100);
  assert.equal(one.answers.length, 100);
  assert.match(one.answers[0].answer, /In Bermuda/);
  const all = await allApi.json();
  assert.equal(all.count, 1400);
  assert.equal(all.territoryCount, 14);
  assert.ok(all.territories.every((territory) => territory.answers.length === 100));
  assert.match(await sitemap.text(), /<loc>http:\/\/localhost\/territories\/gibraltar\/context<\/loc>/);
});

test("weaves the MANX focused intelligence subset through human and machine knowledge paths", async () => {
  const [page, earth, article, corpus, query, focus, invalid, answers, places, sitemap, llms, full] = await Promise.all([
    render("/manx"),
    render("/manx/earth"),
    render("/knowledge/isle-of-man"),
    render("/api/manx"),
    render("/api/manx?q=work%20permit%20visa"),
    render("/api/manx?focus=legislation-courts"),
    render("/api/manx?focus=not-a-module"),
    render("/api/answers?jurisdiction=Isle%20of%20Man"),
    render("/api/places"),
    render("/sitemap.xml"),
    render("/llms.txt"),
    render("/llms-full.txt"),
  ]);

  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /MANX/);
  assert.match(html, /Think Manx/);
  assert.match(html, /Ten precise lenses/);
  assert.match(html, /Never describe the Isle of Man as part of the UK/);
  assert.match(html, /Finance, insurance &amp; digital assets/);
  assert.match(html, /OPEN EARTH &amp; STREET VIEW/);

  assert.equal(earth.status, 200);
  const earthHtml = await earth.text();
  assert.match(earthHtml, /MANX \/ EARTH/);
  assert.match(earthHtml, /Google Earth/);
  assert.match(earthHtml, /Street View/);
  assert.match(earthHtml, /Hotels/);
  assert.match(earthHtml, /Gas \/ petrol/);
  assert.match(earthHtml, /Coffee shops/);
  assert.match(earthHtml, /earth\.google\.com\/web\/search/);
  assert.match(earthHtml, /map_action=pano/);
  assert.match(earthHtml, /aria-pressed="true"/);
  assert.match(earthHtml, /aria-live="polite"/);

  const articleHtml = await article.text();
  assert.match(articleHtml, /The Isle of Man: a jurisdiction in its own right/);
  assert.match(articleHtml, /CONNECTED INTELLIGENCE/);
  assert.match(articleHtml, /href="\/manx"/);

  const all = await corpus.json();
  assert.equal(all.subset, "MANX");
  assert.equal(all.totalModules, 10);
  assert.equal(all.count, 10);
  assert.equal(all.agentContract.canonicalJurisdiction, "Isle of Man");
  assert.ok(all.modules.every((module) => module.sources.length > 0));
  assert.ok(all.modules.every((module) => module.sources.length === module.sourceIds.length));
  assert.ok(all.connections.some((connection) => connection.href === "/doctoral/service-of-process"));

  const routed = await query.json();
  assert.equal(routed.modules[0].id, "immigration-work");
  assert.ok(routed.modules[0].relevance.score > 0);
  assert.ok(routed.modules[0].relevance.matchedKeywords.includes("work permit"));

  const focused = await focus.json();
  assert.equal(focused.count, 1);
  assert.equal(focused.module.id, "legislation-courts");
  assert.equal(invalid.status, 400);

  const answerJson = await answers.json();
  assert.equal(answerJson.focusedSubset.name, "MANX");
  const placeJson = await places.json();
  const isleOfMan = placeJson.places.find((place) => place.slug === "isle-of-man");
  assert.ok(isleOfMan);
  assert.equal(isleOfMan.focusedSubset.api, "/api/manx");
  const connectedResponses = await Promise.all(all.connections.map((connection) => render(connection.href)));
  assert.ok(connectedResponses.every((response) => response.status === 200));
  const sitemapText = await sitemap.text();
  assert.match(sitemapText, /<loc>http:\/\/localhost\/manx<\/loc>/);
  assert.match(sitemapText, /<loc>http:\/\/localhost\/manx\/earth<\/loc>/);
  const llmsText = await llms.text();
  assert.match(llmsText, /## MANX focused intelligence/);
  assert.match(llmsText, /MANX Earth & Street View/);
  const fullText = await full.text();
  assert.match(fullText, /# MANX: Isle of Man focused intelligence/);
  assert.match(fullText, /Spatial view: http:\/\/localhost\/manx\/earth/);
});

test("MANX routing does not confuse substrings and preserves promised focused state", async () => {
  const [falsePositive, genericQuery, punctuationQuery, focused, listing, validLimit, invalidLimit, emptyLimit, zeroLimit, negativeLimit, garbageLimit, exponentLimit, queryLimited, focusPrecedence, explore, questions, manxPageAlias, manxAlias, lowercaseAlias, knowledge] = await Promise.all([
    render("/api/manx?q=human%20rights"),
    render("/api/manx?q=Isle%20of%20Man"),
    render("/api/manx?q=%21%21"),
    render("/api/manx?focus=legislation-courts"),
    render("/api/manx"),
    render("/api/manx?limit=2"),
    render("/api/manx?limit=abc"),
    render("/api/manx?limit="),
    render("/api/manx?limit=0"),
    render("/api/manx?limit=-3"),
    render("/api/manx?limit=3xyz"),
    render("/api/manx?limit=1e9"),
    render("/api/manx?q=work%20permit%20visa&limit=2"),
    render("/api/manx?focus=legislation-courts&q=work%20permit"),
    render("/explore?place=isle-of-man"),
    render("/questions?jurisdiction=Isle%20of%20Man"),
    render("/questions?jurisdiction=manx"),
    render("/api/questions?jurisdiction=manx"),
    render("/api/questions?jurisdiction=isle%20of%20man"),
    render("/api/knowledge"),
  ]);

  const falsePositiveJson = await falsePositive.json();
  assert.ok(falsePositiveJson.modules.every((module) => !module.relevance.matchedKeywords.includes("man")));
  assert.equal((await genericQuery.json()).modules[0].id, "constitutional-order");
  assert.equal((await punctuationQuery.json()).count, 0);

  const focusedJson = await focused.json();
  assert.equal(focusedJson.modules.length, 1);
  assert.equal(focusedJson.modules[0].id, "legislation-courts");
  assert.equal(focusedJson.totalModules, 10);
  assert.equal(focusedJson.connectedApis.legalAnswers, "http://localhost/api/answers?jurisdiction=Isle%20of%20Man");

  const listingJson = await listing.json();
  assert.ok(listingJson.modules.every((module) => module.relevance === undefined));
  assert.equal((await validLimit.json()).count, 2);
  assert.equal((await invalidLimit.json()).count, 10);
  assert.equal((await emptyLimit.json()).count, 10);
  assert.equal((await zeroLimit.json()).count, 1);
  assert.equal((await negativeLimit.json()).count, 1);
  assert.equal((await garbageLimit.json()).count, 10);
  assert.equal((await exponentLimit.json()).count, 10);
  assert.equal((await queryLimited.json()).count, 2);
  assert.equal((await focusPrecedence.json()).module.id, "legislation-courts");

  const exploreHtml = await explore.text();
  assert.match(exploreHtml, /OPEN MANX FOCUSED INTELLIGENCE/);
  assert.match(await questions.text(), /answered for (?:<!-- -->)?Isle of Man/);
  assert.match(await manxPageAlias.text(), /answered for (?:<!-- -->)?Isle of Man/);
  const aliasJson = await manxAlias.json();
  assert.equal(aliasJson.jurisdiction, "Isle of Man");
  assert.equal(aliasJson.focusedSubset.name, "MANX");
  assert.equal((await lowercaseAlias.json()).jurisdiction, "Isle of Man");
  const knowledgeJson = await knowledge.json();
  assert.equal(knowledgeJson.items[0].sources[0].lastReviewed, "2026-08-15");
});

test("every internal link rendered by the MANX hub resolves", async () => {
  const page = await render("/manx");
  const html = await page.text();
  const paths = [...new Set([...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((href) => href.startsWith("/") && !href.startsWith("/_next/"))
    .map((href) => new URL(href, "http://localhost").pathname))];
  const responses = await Promise.all(paths.map((path) => render(path)));
  const failures = paths.filter((_, index) => responses[index].status !== 200);
  assert.deepEqual(failures, []);
});

test("MANX provenance fails closed when a module names an unknown source", async () => {
  const { createServer } = await import("vite");
  const server = await createServer({ appType: "custom", configFile: false, logLevel: "silent", server: { middlewareMode: true } });
  try {
    const { getManxSources } = await server.ssrLoadModule("/app/manx/data.ts");
    assert.throws(() => getManxSources(["not-a-manx-source"]), /Unknown MANX source: not-a-manx-source/);
  } finally {
    await server.close();
  }
});

test("MANX Earth reserves Street View for named localities", async () => {
  const { createServer } = await import("vite");
  const server = await createServer({ appType: "custom", configFile: false, logLevel: "silent", server: { middlewareMode: true } });
  try {
    const { manxAreas } = await server.ssrLoadModule("/app/manx/earth/data.ts");
    const wholeIsland = manxAreas.find((area) => area.id === "island");
    assert.equal(wholeIsland.streetView, false);
    assert.ok(manxAreas.filter((area) => area.id !== "island").every((area) => area.streetView));
  } finally {
    await server.close();
  }
});

test("structured data cannot terminate its script container", async () => {
  const { createServer } = await import("vite");
  const server = await createServer({ appType: "custom", configFile: false, logLevel: "silent", server: { middlewareMode: true } });
  try {
    const { serialiseStructuredData } = await server.ssrLoadModule("/app/structured-data.ts");
    const serialised = serialiseStructuredData({ value: "</script>&>line\u2028paragraph\u2029" });
    assert.doesNotMatch(serialised, /<|>|&|\u2028|\u2029/u);
    assert.deepEqual(JSON.parse(serialised), { value: "</script>&>line\u2028paragraph\u2029" });
  } finally {
    await server.close();
  }
});

test("headline counts are rendered alongside their coverage qualification", async () => {
  const { readFileSync } = await import("node:fs");
  const catalogue = JSON.parse(readFileSync(new URL("../public/discovery/catalog.json", import.meta.url), "utf8"));
  const tally = { sourced: 0, outline: 0, group: 0 };
  for (const node of catalogue.nodes) { if (node.id === catalogue.root) continue; tally[node.evidence === "sourced" ? "sourced" : node.evidence === "outline" ? "outline" : "group"] += 1; }
  const n = (value) => value.toLocaleString("en-GB");
  const topics = n(catalogue.nodes.length - 1);
  const areas = catalogue.nodes.find((node) => node.id === catalogue.root).children.length;
  const coverageSentence = `${n(tally.sourced)} topics are source-linked, ${n(tally.outline)} are research outlines still to investigate, and ${n(tally.group)} are grouping nodes.`;
  const strip = (html) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, " ");

  const [hub, discover, questions, llms] = await Promise.all([render("/manx"), render("/manx/discover"), render("/questions"), render("/llms.txt")]);

  const hubHtml = strip(await hub.text());
  // The topic count and its qualification must sit in the same rendered section.
  const hubEntry = hubHtml.slice(hubHtml.indexOf("EXPLORE THE ISLAND"), hubHtml.indexOf("Open the topic explorer"));
  assert.match(hubEntry, new RegExp(`Browse ${topics} topics across ${areas} areas`));
  assert.ok(hubEntry.includes(coverageSentence), "MANX hub must show the coverage sentence next to the topic count");
  assert.match(hubEntry, /Source-linked means a citation is attached/);
  assert.match(hubHtml, /1,000 templated research baselines/);
  assert.doesNotMatch(hubHtml, /1,000 (Manx |Isle of Man |connected )?answers/);

  const discoverHtml = strip(await discover.text());
  assert.match(discoverHtml, new RegExp(`${topics} topics across ${areas} areas`));
  assert.ok(discoverHtml.includes(coverageSentence), "discover page must show the coverage sentence");
  assert.match(discoverHtml, new RegExp(`Source-linked topics ${n(tally.sourced)}`));
  assert.match(discoverHtml, new RegExp(`Research outlines ${n(tally.outline)}`));
  assert.match(discoverHtml, new RegExp(`Grouping nodes ${n(tally.group)}`));
  assert.match(discoverHtml, /does not establish that the citation supports the claim/);
  assert.match(discoverHtml, /Coverage by area/);
  assert.doesNotMatch(discoverHtml, /\bverified\b/i);

  const questionsHtml = strip(await questions.text());
  assert.match(questionsHtml, /1,000 templated research baselines for each of 18 constitutional jurisdictions/);
  assert.match(questionsHtml, /not an individually researched answer/);

  const llmsText = await llms.text();
  assert.match(llmsText, /1,000 templated research baselines for the Isle of Man/);
  assert.doesNotMatch(llmsText, /1,000 Isle of Man answers|1,000-question research bank/);
});
