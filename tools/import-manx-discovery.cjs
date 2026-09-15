// One-time migration from the reviewed conversation map into the app catalogue.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const input = process.argv[2];
if (!input) throw new Error('Pass the reviewed source map path.');
const html = fs.readFileSync(input, 'utf8');
const start = html.indexOf('  const sources =');
const end = html.indexOf('  let topicTotal=0;');
if (start < 0 || end < start) throw new Error('Unrecognised map format');
const { DATA, sources } = vm.runInNewContext(html.slice(start, end) + ';({DATA,sources});', {}, { timeout: 2000 });
const slug = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const nodes = [], ids = new Map(), used = new Set();
function walk(node, parent = null, trail = [], reference = 'government') {
  const id = parent ? parent + '/' + slug(node.label) : 'isle-of-man';
  if (used.has(id)) throw new Error('Duplicate ID: ' + id);
  used.add(id); ids.set(node, id);
  const context = node.reference || node.source || reference;
  const record = { id, label: node.label, parent, path: [...trail, node.label], description: node.description || '', evidence: node.source ? 'sourced' : node.outline ? 'outline' : 'group', source: node.source ? { label: sources[node.source][0], url: sources[node.source][1] } : null, reference: context ? { label: sources[context][0], url: sources[context][1] } : null, children: [], related: [] };
  nodes.push(record);
  for (const child of node.children) record.children.push(walk(child, id, record.path, context));
  return id;
}
walk(DATA);
for (const [node, id] of ids) nodes.find(n => n.id === id).related = (node.related || []).map(n => ids.get(n));
const output = path.resolve(__dirname, '../public/discovery/catalog.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify({ version: 1, reviewedAt: '2026-09-09', root: 'isle-of-man', nodes }, null, 2) + '\n');
console.log(JSON.stringify({ topics: nodes.length - 1, roots: nodes[0].children.length, output }));
