const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');
function edit(file, transform){const target=path.join(root,file),before=fs.readFileSync(target,'utf8'),after=transform(before);if(before===after)throw new Error('No edit for '+file);fs.writeFileSync(target,after);}
edit('public/discovery/model.mjs',text=>{
 text="import { additionalConnections, readingRoutes } from './connections.mjs';\n"+text;
 text=text.replace('  const totals = new Map(), visiting = new Set();',`  const byPath = new Map(data.nodes.map(node => [node.path.slice(1).join(' / '), node]));
  for (const [left, right] of additionalConnections) {
    const a = byPath.get(left), b = byPath.get(right);
    if (!a || !b) throw new Error('Missing curated connection: ' + (!a ? left : right));
    if (!a.related.includes(b.id)) a.related.push(b.id);
    if (!b.related.includes(a.id)) b.related.push(a.id);
  }
  for (const [topic] of readingRoutes) if (!byPath.has(topic)) throw new Error('Missing reading route topic: ' + topic);
  const totals = new Map(), visiting = new Set();`);
 const start=text.indexOf('const moduleRules =');if(start<0)throw new Error('Missing route rules');
 return text.slice(0,start)+`export function knowledgeLinks(node) {
  const topic = node.path.slice(1).join(' / ');
  const matches = readingRoutes.filter(([prefix]) => topic === prefix || topic.startsWith(prefix + ' / ')).sort((a,b) => b[0].length-a[0].length);
  const links = matches.map(([prefix,label,href]) => ({label,href,kind:'Related research · '+prefix.split(' / ').at(-1)}));
  links.push({label:'Isle of Man dossier',href:'/knowledge/isle-of-man',kind:'Island overview'});
  return [...new Map(links.map(link=>[link.href,link])).values()].slice(0,4);
}
export function connectedTopics(catalogue, node) {
  const branch = ancestors(catalogue,node).reverse().find(item=>item.related.length);
  return branch ? { branch, nodes: branch.related.map(id=>catalogue.byId.get(id)) } : {branch:node,nodes:[]};
}
`;
});
edit('public/discovery/explorer.mjs',text=>text.replace('createCatalogue, discoveryHash','createCatalogue, connectedTopics, discoveryHash').replace("    if (node.related.length) {\n      const related", "    const connections = connectedTopics(this.catalogue, node);\n    if (connections.nodes.length) {\n      const related").replace("related.append(element('h3', '', 'Connected topics'));","related.append(element('h3', '', connections.branch.id === node.id ? 'Connected topics' : 'Connected to ' + connections.branch.label));").replace("for (const id of node.related) { const target = this.catalogue.byId.get(id); const button = action('', () => this.navigate(id),", "for (const target of connections.nodes) { const button = action('', () => this.navigate(target.id),"));
console.log('Curated links and inherited, explicitly labelled related topics applied.');
