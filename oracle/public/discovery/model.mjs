import { additionalConnections, readingRoutes } from './connections.mjs';
import { MAX_QUESTION_CHARS } from './question-policy.mjs';
export const ATLAS_ORIGIN = 'https://britannica-atlas.marroccofella.chatgpt.site';
export const MANI_ORIGIN = 'http://127.0.0.1:4242';
export function normalise(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
export function createCatalogue(data) {
  if (!data || !Array.isArray(data.nodes) || data.nodes.length > 20000) throw new Error('The topic catalogue is unavailable.');
  const byId = new Map(data.nodes.map(node => [node.id, node]));
  if (byId.size !== data.nodes.length || !byId.has(data.root)) throw new Error('The topic catalogue needs repair.');
  for (const node of byId.values()) {
    if (!Array.isArray(node.children) || !Array.isArray(node.related) || !Array.isArray(node.path) || typeof node.label !== 'string') throw new Error('Invalid topic.');
    if (node.parent && !byId.has(node.parent)) throw new Error('Missing parent.');
    for (const id of [...node.children, ...node.related]) if (!byId.has(id)) throw new Error('Missing connection.');
    for (const id of node.children) if (byId.get(id).parent !== node.id) throw new Error('Inconsistent topic path.');
  }
  const byPath = new Map(data.nodes.map(node => [node.path.slice(1).join(' / '), node]));
  for (const [left, right] of additionalConnections) {
    const a = byPath.get(left), b = byPath.get(right);
    if (!a || !b) continue;
    if (!a.related.includes(b.id)) a.related.push(b.id);
    if (!b.related.includes(a.id)) b.related.push(a.id);
  }
  const totals = new Map(), visiting = new Set();
  function count(id) {
    if (visiting.has(id)) throw new Error('Circular topic path.');
    visiting.add(id);
    const value = byId.get(id).children.reduce((sum, child) => sum + count(child) + 1, 0);
    visiting.delete(id); totals.set(id, value); return value;
  }
  count(data.root);
  if (totals.size !== byId.size) throw new Error('Disconnected topic.');
  const searchable = data.nodes.map(node => ({node, title: normalise(node.label), trail: normalise(node.path.join(' '))}));
  return { ...data, byId, totals, searchable };
}
export function searchTopics(catalogue, query) {
  const term = normalise(query);
  const words = term.split(' ').filter(Boolean);
  if (!words.length) return [];
  return catalogue.searchable.filter(row => words.every(word => row.trail.includes(word)))
    .map(row => ({node: row.node, score: (row.title === term ? 100 : 0) + words.filter(word => row.title.includes(word)).length * 10 - row.node.path.length}))
    .sort((a, b) => b.score - a.score || a.node.label.localeCompare(b.node.label)).map(row => row.node);
}
export function ancestors(catalogue, node) {
  const chain = [node];
  while (chain[0].parent) chain.unshift(catalogue.byId.get(chain[0].parent));
  return chain;
}
export function topicQuestion(node, mode = 'explain') {
  const subject = node.path.slice(1).join(' → ') || 'Isle of Man';
  const openings = {
    explain: `Explain ${subject} in the Isle of Man.`,
    evidence: `What do official Isle of Man sources establish about ${subject}?`,
    connections: `How does ${subject} connect to other parts of life and government in the Isle of Man?`,
    discover: `What important questions and missing information should I investigate about ${subject} in the Isle of Man?`,
  };
  return (openings[mode] || openings.explain) + ' Start with a clear answer, identify the relevant Manx institutions or rules, and cite primary sources. Separate verified facts from uncertainty.';
}
export function discoveryHash(id) { return '#explore=' + encodeURIComponent(id); }
export function readDiscoveryHash(hash) {
  const params = new URLSearchParams(String(hash).replace(/^#/, ''));
  return { topic: params.get('explore') || params.get('topic'), question: params.get('question') || '', conversation: params.has('talk') || params.has('question') };
}
export function maniQuestionUrl(node, question) {
  // The same limit the composer validates against; a longer cut here sent
  // Mannin the first 2,000 characters of a question the page had accepted.
  const params = new URLSearchParams({ question: String(question).slice(0, MAX_QUESTION_CHARS), topic: node.id });
  return MANI_ORIGIN + '/#' + params.toString();
}
export function knowledgeLinks(node) {
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
