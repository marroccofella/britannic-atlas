import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';

let server, routing, data, territoryDossiers, jurisdictionProfiles, api;
before(async () => {
  server = await createServer({ appType: 'custom', configFile: false, logLevel: 'silent', server: { middlewareMode: true } });
  routing = await server.ssrLoadModule('/app/network/routing.ts');
  data = await server.ssrLoadModule('/app/network/data.ts');
  ({ territoryDossiers } = await server.ssrLoadModule('/app/territories/data.ts'));
  ({ jurisdictionProfiles } = await server.ssrLoadModule('/app/questions/answer-data.ts'));
  api = await server.ssrLoadModule('/app/api/network/route.ts');
});
after(async () => { await server?.close(); });

test('every territory keeps its exact dossier and specialist-library context', () => {
  assert.equal(new Set(data.networkPlaces.map(p => p.slug)).size, data.networkPlaces.length);
  for (const territory of territoryDossiers) {
    const place = data.networkPlaces.find(p => p.territory === territory.slug);
    assert.ok(place, territory.name);
    assert.ok(jurisdictionProfiles.some(p => p.name === place.answers), `canonical answers for ${territory.name}`);
    for (const [id, suffix] of [['territories',''], ['insolvency','/insolvency'], ['context','/context']]) {
      assert.equal(routing.appDestination(routing.networkApps.find(a => a.id === id), place), `/territories/${territory.slug}${suffix}`);
    }
  }
});

test('Crown Dependencies preserve their own names and unsupported visual coverage stays explicit', () => {
  const answers = routing.networkApps.find(a => a.id === 'answers');
  for (const name of ['Isle of Man','Jersey','Guernsey']) {
    const place = data.networkPlaces.find(p => p.name === name);
    assert.equal(new URL(routing.appDestination(answers, place), 'https://example.test').searchParams.get('jurisdiction'), name);
  }
  const guernsey = data.networkPlaces.find(p => p.slug === 'guernsey');
  const visual = routing.networkApps.find(a => a.id === 'places');
  assert.equal(routing.appDestination(visual, guernsey), '/explore');
  assert.equal(routing.destinationScope(visual, guernsey), 'Across the British world');
});

test('switching apps resolves current nested paths and never mistakes a foreign place for Manx coverage', () => {
  const bermuda = routing.routePlace('/territories/bermuda/context', new URLSearchParams(), data.networkPlaces);
  assert.equal(bermuda.name, 'Bermuda');
  assert.equal(routing.currentApp('/territories/bermuda/context').id, 'context');
  assert.equal(routing.currentApp('/manx/discover').id, 'discovery');
  assert.equal(routing.routePlace('/questions', new URLSearchParams('jurisdiction=Isle%20of%20Man'), data.networkPlaces).slug, 'isle-of-man');
  assert.equal(routing.routePlace('/explore', new URLSearchParams('place=unknown'), data.networkPlaces)?.slug, 'england');
  const manx = routing.networkApps.find(a => a.id === 'manx');
  assert.equal(routing.destinationScope(manx, bermuda), 'Isle of Man');
});

test('the directory API shares personas and routes without claiming evidence or transferring conversations', async () => {
  const response = api.GET(new Request('https://example.test/api/network?place=bermuda'));
  const body = await response.json();
  assert.equal(body.apps.length, 12);
  assert.equal(body.context.name, 'Bermuda');
  assert.ok(body.apps.every(a => a.voice && a.role && a.focus && a.destinationScope));
  assert.equal(body.apps.find(a => a.id === 'answers').destination, '/questions?jurisdiction=Bermuda');
  assert.equal(body.handoff.privateConversationTransfer, false);
  assert.equal(body.handoff.autoSubmit, false);
  assert.equal(api.GET(new Request('https://example.test/api/network?place=not-real')).status, 400);
});

test('Mannin provides reciprocal links to real registered Atlas destinations', () => {
  const html = fs.readFileSync(new URL('../oracle/public/index.html', import.meta.url), 'utf8');
  const nav = html.match(/<nav class="mannin-family"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(nav);
  const links = [...nav.matchAll(/href="([^"]+)"/g)].map(m => new URL(m[1]));
  assert.ok(links.some(url => url.pathname === '/network' && url.searchParams.get('place') === 'isle-of-man'));
  const known = new Set(routing.networkApps.filter(a => a.href.startsWith('/')).map(a => a.href));
  for (const url of links) {
    assert.equal(url.origin, 'https://britannica-atlas.marroccofella.chatgpt.site');
    assert.ok(known.has(url.pathname) || ['/network','/knowledge/isle-of-man'].includes(url.pathname));
  }
});

test('visual selection and shared context agree for stale and unsupported place links', () => {
  const source = fs.readFileSync(new URL('../app/explore/explore-client.tsx', import.meta.url), 'utf8');
  const expression = source.match(/const selectedSlug = (.+);/)?.[1];
  const resolve = new Function('places', 'searchParams', 'initialPlaceSlug', `return ${expression}`);
  const visual = data.networkPlaces.filter(p => p.visual);
  for (const slug of ['not-real', 'guernsey', '', 'bermuda']) {
    const query = new URLSearchParams({ place: slug });
    const expected = slug === 'bermuda' ? 'bermuda' : 'england';
    assert.equal(resolve(visual, query, 'england'), expected);
    assert.equal(routing.routePlace('/explore', query, data.networkPlaces)?.slug, expected);
  }
});

test('decorated place names retain every answer library that actually exists', async () => {
  const { places } = await server.ssrLoadModule('/app/explore/data.ts');
  for (const p of places.filter(p => p.name.includes(' · '))) {
    const canonical = p.name.split(' · ')[0];
    const profile = jurisdictionProfiles.find(j => j.name === canonical);
    assert.equal(data.networkPlaces.find(n => n.slug === p.slug).answers, profile?.name);
  }
});

test('answer navigation shares the canonical page aliases and default jurisdiction', async () => {
  const { resolveKnownJurisdiction } = await server.ssrLoadModule('/app/questions/resolve-jurisdiction.ts');
  for (const jurisdiction of ['MANX', 'Ellan Vannin', 'iom', ' bermuda ', 'unknown', '']) {
    const expected = resolveKnownJurisdiction(jurisdiction)?.name ?? 'United Kingdom';
    assert.equal(routing.routePlace('/questions', new URLSearchParams({ jurisdiction }), data.networkPlaces)?.answers, expected);
  }
});

test('place-picker styles cannot add form margins to app cards', () => {
  const css = fs.readFileSync(new URL('../app/network/network.css', import.meta.url), 'utf8');
  const bareContextRules = [...css.matchAll(/(?:^|\})\s*\.family-context\s*\{([^}]+)\}/g)];
  assert.ok(bareContextRules.every(rule => !/margin:|display:grid/.test(rule[1])));
});

test('app switching uses client navigation internally and ordinary links for local Mannin', () => {
  for (const file of ['network-bar.tsx', 'page.tsx']) {
    const source = fs.readFileSync(new URL(`../app/network/${file}`, import.meta.url), 'utf8');
    assert.ok(source.includes('const Destination = local ? "a" : Link;'), file);
    assert.match(source, /<Destination[^>]*href=\{href\}/);
  }
});
