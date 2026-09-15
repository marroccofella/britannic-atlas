import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCatalogue, ancestors, connectedTopics, knowledgeLinks, maniQuestionUrl, readDiscoveryHash, searchTopics, topicQuestion } from '../public/discovery/model.mjs';
import { additionalConnections, readingRoutes } from '../public/discovery/connections.mjs';
const data = JSON.parse(fs.readFileSync(new URL('../public/discovery/catalog.json', import.meta.url), 'utf8'));
const catalogue = createCatalogue(data);

test('discovery uses Mannin branding and the current official Biosphere document link',()=>{
  const source=fs.readFileSync(new URL('../public/discovery/explorer.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\bMani\b|\bMANI\b/);
  const urls=data.nodes.flatMap(node=>[node.source?.url,node.reference?.url]).filter(Boolean);
  assert.ok(urls.includes('https://www.biosphere.im/uploads/biosphere-iom-nomination-papers-1-part-1-and-2-comp.pdf'));
  assert.ok(!urls.some(url=>url.includes('biosphere-isle-of-man-nomination-papers-part-i-and-ii_web.pdf')));
});
test('complete hierarchy and bidirectional topic connections are preserved', () => {
  assert.equal(catalogue.byId.size, 2870);
  assert.equal(catalogue.byId.get(catalogue.root).children.length, 22);
  assert.equal(catalogue.totals.get(catalogue.root), 2869);
  for (const node of catalogue.nodes) {
    assert.equal(ancestors(catalogue,node).length,node.path.length);
    for (const id of node.related) assert.ok(catalogue.byId.get(id).related.includes(node.id));
    const question=topicQuestion(node);assert.ok(question.length<2000);assert.match(question,/Isle of Man/);
  }
});
test('search distinguishes same-name subjects with their full context', () => {
  const results=searchTopics(catalogue,'contract offer acceptance');
  assert.ok(results.some(node=>node.label==='Offer and acceptance'));
  assert.equal(searchTopics(catalogue,'zzyzxqv').length,0);
  assert.ok(searchTopics(catalogue,'Gaelg').length);
});
test('deep links preserve exact topic and question without an auto-submit parameter', () => {
  const node=catalogue.nodes.find(node=>node.label==='Offer and acceptance');
  const url=new URL(maniQuestionUrl(node,topicQuestion(node,'evidence')));
  const parsed=readDiscoveryHash(url.hash);
  assert.equal(parsed.topic,node.id);assert.equal(parsed.question,topicQuestion(node,'evidence'));
  assert.equal(url.origin,'http://127.0.0.1:4242');assert.equal(url.search,'');
});
test('all curated research destinations correspond to existing pages and anchors', () => {
  const manx=fs.readFileSync(new URL('../app/manx/data.ts',import.meta.url),'utf8');
  const doctoral=fs.readFileSync(new URL('../app/doctoral/data.ts',import.meta.url),'utf8');
  const knowledge=fs.readFileSync(new URL('../app/knowledge/content.ts',import.meta.url),'utf8');
  for (const [, , href] of readingRoutes) {
    const url=new URL(href,'https://example.test');
    if(url.pathname==='/manx'&&url.hash) assert.ok(manx.includes('"'+url.hash.slice(1)+'"'),href);
    else if(url.pathname.startsWith('/doctoral/'))assert.ok(doctoral.includes('"'+url.pathname.split('/').at(-1)+'"'),href);
    else if(url.pathname.startsWith('/knowledge/'))assert.ok(knowledge.includes('"'+url.pathname.split('/').at(-1)+'"'),href);
    else assert.ok(fs.existsSync(new URL('../app'+url.pathname+'/page.tsx',import.meta.url)),href);
  }
});
test('references are not promoted to evidence and relations retain their context',()=>{
  const leaf=catalogue.nodes.find(node=>node.label==='Offer and acceptance');
  assert.equal(leaf.evidence,'outline');assert.equal(leaf.source,null);assert.ok(leaf.reference);
  const tax=catalogue.nodes.find(node=>node.path.slice(1).join(' / ')==='Government / Law & justice / Public and specialist law / Tax law');
  assert.ok(connectedTopics(catalogue,tax).nodes.some(node=>node.label==='Taxes and contributions'));
  const religion=catalogue.nodes.find(node=>node.label==='Religion & belief');
  assert.deepEqual(knowledgeLinks(religion).map(link=>link.href),['/knowledge/isle-of-man']);
});
test('Mani and hosted app share identical discovery files',()=>{
  for(const file of ['catalog.json','connections.mjs','model.mjs','explorer.mjs','explorer.css','question-policy.mjs'])assert.equal(fs.readFileSync(new URL('../public/discovery/'+file,import.meta.url),'utf8'),fs.readFileSync(new URL('../oracle/public/discovery/'+file,import.meta.url),'utf8'),file);
});

test('the hosted discovery route exists and every advertised topic fragment resolves',async()=>{
  assert.ok(fs.existsSync(new URL('../app/manx/discover/page.tsx',import.meta.url)));
  const {createServer}=await import('vite');
  const server=await createServer({appType:'custom',configFile:false,logLevel:'silent',server:{middlewareMode:true}});
  let sharedIds;
  try {
    const {discoveryTopicIds}=await server.ssrLoadModule('/app/manx/discover/data.ts');
    sharedIds=Object.values(discoveryTopicIds);
  } finally { await server.close(); }
  for(const id of sharedIds)assert.ok(catalogue.byId.has(id),`shared discovery data links to unknown topic ${id}`);
  const sources=['../app/explore/explore-client.tsx','../app/manx/earth/page.tsx','../app/questions/questions-client.tsx'];
  for(const source of sources){
    const text=fs.readFileSync(new URL(source,import.meta.url),'utf8');
    assert.match(text,/discoveryLinks\./,`${source} must use the shared link registry`);
    assert.doesNotMatch(text,/#explore=/,`${source} must not hand-build topic fragments`);
  }
});

test('local Oracle tooling stays outside the deployed dependency set',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  for(const dependency of ['@huggingface/transformers','cheerio','robots-parser','sqlite-vec']){
    assert.equal(manifest.dependencies?.[dependency],undefined,`${dependency} is local tooling, not a deployed runtime dependency`);
    assert.ok(manifest.devDependencies?.[dependency],`${dependency} remains available for local Oracle work`);
  }
});

test('the MANX wordmark is the page heading and retains its fluid hero scale',()=>{
  const css=fs.readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
  const page=fs.readFileSync(new URL('../app/manx/page.tsx',import.meta.url),'utf8');
  assert.match(css,/\.manx-wordmark\s*\{[^}]*clamp\(125px,22vw,335px\)/s);
  assert.match(css,/@media \(max-width:680px\)[\s\S]*?\.manx-wordmark\s*\{[^}]*font-size:105px/);
  assert.match(page,/<h1 className="manx-wordmark">MANX<\/h1>/);
});

test('advertised discovery totals come directly from the catalogue',async()=>{
  const {createServer}=await import('vite');
  const server=await createServer({appType:'custom',configFile:false,logLevel:'silent',server:{middlewareMode:true}});
  try {
    const {discoveryStats}=await server.ssrLoadModule('/app/manx/discover/stats.ts');
    assert.equal(discoveryStats.topicCount,catalogue.totals.get(catalogue.root));
    assert.equal(discoveryStats.areaCount,catalogue.byId.get(catalogue.root).children.length);
    assert.equal(discoveryStats.reviewedAt,data.reviewedAt);
    const tally={sourced:0,outline:0,group:0};
    for(const node of catalogue.byId.values()){ if(node.id===catalogue.root) continue; tally[node.evidence==='sourced'?'sourced':node.evidence==='outline'?'outline':'group']++; }
    assert.equal(discoveryStats.sourceLinkedCount,tally.sourced);
    assert.equal(discoveryStats.outlineCount,tally.outline);
    assert.equal(discoveryStats.groupCount,tally.group);
    assert.equal(discoveryStats.sourceLinkedCount+discoveryStats.outlineCount+discoveryStats.groupCount,discoveryStats.topicCount);
    const {discoveryAreas,discoveryCoverageSentence}=await server.ssrLoadModule('/app/manx/discover/stats.ts');
    assert.equal(discoveryAreas.length,discoveryStats.areaCount);
    assert.equal(discoveryAreas.reduce((sum,area)=>sum+area.topicCount,0),discoveryStats.topicCount);
    assert.equal(discoveryAreas.reduce((sum,area)=>sum+area.sourceLinkedCount,0),discoveryStats.sourceLinkedCount);
    assert.match(discoveryCoverageSentence,/source-linked/);
    assert.match(discoveryCoverageSentence,/research outlines/);
    assert.match(discoveryCoverageSentence,/grouping nodes/);
  } finally { await server.close(); }
});

test('no page, metadata or API surface advertises a bare answer count or a "verified" evidence label',()=>{
  const files=[];
  const walk=dir=>{ for(const entry of fs.readdirSync(dir,{withFileTypes:true})){ const p=path.join(dir,entry.name); if(entry.isDirectory()) walk(p); else if(/\.(tsx?|mjs)$/.test(entry.name)) files.push(p); } };
  walk(fileURLToPath(new URL('../app',import.meta.url)));
  files.push(fileURLToPath(new URL('../public/discovery/explorer.mjs',import.meta.url)));
  const bare=[/\b1,000 (Isle of Man |Manx |connected |legal |territory )?answers\b/i,/\b18,000 (territory |territory-specific )?(legal )?answers\b/i,/\bAnswered baseline\b/,/\bSource-backed\b/i,/\bsourced description\b/i];
  const offenders=[];
  for(const file of files){ const text=fs.readFileSync(file,'utf8'); for(const pattern of bare) if(pattern.test(text)) offenders.push(path.relative(process.cwd(),file)+' :: '+pattern); }
  assert.deepEqual(offenders,[]);
  const explorer=fs.readFileSync(new URL('../public/discovery/explorer.mjs',import.meta.url),'utf8');
  assert.match(explorer,/SOURCE-LINKED DESCRIPTION/);
  assert.match(explorer,/source-linked · .* research outlines still to investigate · .* grouping nodes/);
  assert.match(explorer,/does not establish that the citation supports it/);
});

test('stale optional curation cannot disable the structural catalogue',()=>{
  additionalConnections.push(['Missing / Left','Missing / Right']);
  readingRoutes.push(['Missing / Reading','Broken','/manx']);
  try { assert.doesNotThrow(()=>createCatalogue(structuredClone(data))); }
  finally { additionalConnections.pop(); readingRoutes.pop(); }
});

test('the command palette opens as a native modal and supports backdrop dismissal',()=>{
  const page=fs.readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
  const css=fs.readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
  assert.match(page,/\.showModal\(\)/);
  assert.doesNotMatch(page,/<dialog open/);
  assert.match(page,/palette-backdrop-dismiss/);
  assert.match(css,/\.palette-backdrop\[open\]/);
});

test('the theme control synchronises state without a deferred animation frame',()=>{
  const source=fs.readFileSync(new URL('../app/theme-toggle.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/requestAnimationFrame|cancelAnimationFrame|setTheme/);
});
