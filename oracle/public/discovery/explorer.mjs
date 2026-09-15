import { ATLAS_ORIGIN, ancestors, createCatalogue, connectedTopics, discoveryHash, knowledgeLinks, maniQuestionUrl, readDiscoveryHash, searchTopics, topicQuestion } from './model.mjs';

import { MAX_QUESTION_CHARS, questionProblem } from './question-policy.mjs';

let cataloguePromise;
function loadCatalogue() {
  if (!cataloguePromise) cataloguePromise = fetch(new URL('./catalog.json', import.meta.url)).then(response => {
    if (!response.ok) throw new Error('The topic catalogue could not be loaded.');
    return response.json();
  }).then(createCatalogue).catch(error => { cataloguePromise = null; throw error; });
  return cataloguePromise;
}
function element(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text) item.textContent = text;
  return item;
}
function action(text, callback, className = 'dx-button') {
  const button = element('button', className, text); button.type = 'button'; button.addEventListener('click', callback); return button;
}
function safeLink(text, href, className, external = false) {
  const anchor = element('a', className, text);
  let url;
  try { url = new URL(href, location.href); } catch { return element('span', className, text || 'Reference unavailable'); }
  if (!['https:', 'http:'].includes(url.protocol)) return element('span', className, text);
  anchor.href = url.href;
  if (external) { anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; if (text) anchor.setAttribute('aria-label', text + ' (opens in a new tab)'); }
  return anchor;
}

export class ManxDiscovery extends HTMLElement {
  connectedCallback() {
    if (this.started) return;
    this.started = true; this.query = ''; this.resultLimit = 30; this.mode = 'explain';
    this.questionDrafts ??= new Map(); this.topicModes ??= new Map();
    this.historyLocation = '';
    this.onHistory = () => {
      if (!this.catalogue || this.historyLocation === location.href) return;
      this.historyLocation = location.href;
      this.show(readDiscoveryHash(location.hash).topic || this.catalogue.root, false);
    };
    window.addEventListener('hashchange', this.onHistory); window.addEventListener('popstate', this.onHistory);
    void this.load();
  }
  disconnectedCallback() {
    window.removeEventListener('hashchange', this.onHistory); window.removeEventListener('popstate', this.onHistory);
    clearTimeout(this.searchTimer);
    this.started = false;
  }
  async load() {
    this.replaceChildren(element('p', 'dx-loading', 'Opening the island’s topic map…'));
    try {
      this.catalogue = await loadCatalogue();
      if (!this.isConnected) return;
      this.build(); this.onHistory();
    } catch {
      const message = element('p', 'dx-error', 'The topics could not be opened. Your conversation is still available.'); message.setAttribute('role', 'alert');
      this.replaceChildren(message, action('Try again', () => { void this.load(); }));
    }
  }
  build() {
    this.replaceChildren();
    this.classList.add('dx');
    const top = element('div', 'dx-top');
    const title = element('div', 'dx-title'); title.append(element('span', 'dx-eyebrow', 'ELLAN VANNIN / DISCOVERY'), element('h1', '', 'Explore the Isle of Man'));
    const size = this.catalogue.byId.size - 1;
    const coverage = { sourced: 0, outline: 0 }; for (const node of this.catalogue.byId.values()) { if (node.evidence === 'sourced') coverage.sourced += 1; else if (node.evidence === 'outline') coverage.outline += 1; }
    title.append(element('p', 'dx-summary', `${size.toLocaleString('en-GB')} connected topics · ${this.catalogue.byId.get(this.catalogue.root).children.length} areas of island life`));
    title.append(element('p', 'dx-coverage', `${coverage.sourced.toLocaleString('en-GB')} source-linked · ${coverage.outline.toLocaleString('en-GB')} research outlines still to investigate · ${(size - coverage.sourced - coverage.outline).toLocaleString('en-GB')} grouping nodes`));
    const searchLabel = element('label', 'dx-search'); searchLabel.append(element('span', '', 'Find a topic'));
    this.searchInput = element('input'); this.searchInput.type = 'search'; this.searchInput.placeholder = 'Try law, housing, language…'; this.searchInput.autocomplete = 'off';
    this.searchInput.addEventListener('input', () => {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => { this.query = this.searchInput.value; this.resultLimit = 30; this.renderContent(false); }, 120);
    });
    searchLabel.append(this.searchInput); top.append(title, searchLabel); this.append(top);
    const layout = element('div', 'dx-layout');
    this.sidebar = element('nav', 'dx-domains'); this.sidebar.setAttribute('aria-label', 'Island subjects');
    this.content = element('section', 'dx-content'); this.content.setAttribute('aria-label', 'Topic explorer');
    this.details = element('aside', 'dx-details'); this.details.setAttribute('aria-label', 'Connections and discovery question');
    layout.append(this.sidebar, this.content, this.details); this.append(layout);
    this.status = element('p', 'dx-sr'); this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite'); this.append(this.status);
    this.append(element('p', 'dx-footnote', 'Subject relationships are not reporting lines. A source-linked description has a citation attached; that does not establish that the citation supports it. Outlines identify subjects still to investigate.'));
  }
  navigate(id) {
    this.query = ''; this.searchInput.value = ''; this.resultLimit = 30;
    const current = readDiscoveryHash(location.hash);
    if (current.topic !== id || current.conversation) {
      history.pushState(null, '', discoveryHash(id));
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else this.show(id, false);
    this.content.querySelector('h2')?.focus({ preventScroll: true });
    if (matchMedia('(max-width: 760px)').matches) this.content.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  show(id, focus = false) {
    this.node = this.catalogue.byId.get(id) || this.catalogue.byId.get(this.catalogue.root);
    this.query = ''; this.searchInput.value = ''; this.resultLimit = 30;
    this.mode = this.topicModes.get(this.node.id) || 'explain';
    this.renderSidebar(); this.renderContent(focus); this.renderDetails();
    if (id !== this.node.id) this.status.textContent = 'That topic is unavailable. Showing the island overview.';
  }
  renderSidebar() {
    this.sidebar.replaceChildren(element('span', 'dx-eyebrow', 'BROWSE THE ISLAND'));
    const root = this.catalogue.byId.get(this.catalogue.root);
    const home = action('All subjects', () => this.navigate(root.id), 'dx-domain dx-home');
    if (this.node.id === root.id) home.setAttribute('aria-current', 'page');
    this.sidebar.append(home);
    const selectLabel = element('label', 'dx-mobile-domain'); selectLabel.append(element('span', '', 'Jump to an area'));
    const select = element('select'); select.append(new Option('All subjects', root.id));
    const list = element('div', 'dx-domain-list');
    root.children.forEach((id, index) => {
      const topic = this.catalogue.byId.get(id);
      const button = action('', () => this.navigate(id), 'dx-domain');
      button.append(element('span', 'dx-domain-number', String(index + 1).padStart(2, '0')), element('span', '', topic.label));
      if (this.node.id === id || this.node.id.startsWith(id + '/')) button.setAttribute('aria-current', 'true');
      list.append(button); select.append(new Option(topic.label, id));
    });
    select.value = ancestors(this.catalogue, this.node)[1]?.id || root.id;
    select.addEventListener('change', () => this.navigate(select.value)); selectLabel.append(select); this.sidebar.append(selectLabel, list);
  }
  renderContent(focus) {
    this.content.replaceChildren();
    if (this.query.trim()) { this.renderSearch(); return; }
    const node = this.node, chain = ancestors(this.catalogue, node);
    const crumbs = element('nav', 'dx-crumbs'); crumbs.setAttribute('aria-label', 'Your topic path');
    chain.forEach((topic, index) => {
      if (index) { const separator = element('span', '', '›'); separator.setAttribute('aria-hidden', 'true'); crumbs.append(separator); }
      if (topic === node) { const current = element('span', '', topic.label); current.setAttribute('aria-current', 'page'); crumbs.append(current); }
      else crumbs.append(action(topic.label, () => this.navigate(topic.id), 'dx-text-button'));
    });
    this.content.append(crumbs);
    const header = element('header', 'dx-topic-heading');
    const type = node.evidence === 'sourced' ? 'SOURCE-LINKED DESCRIPTION' : node.evidence === 'outline' ? 'RESEARCH OUTLINE' : 'SUBJECT GROUP';
    header.append(element('span', 'dx-eyebrow', type));
    const heading = element('h2', '', node.label); heading.tabIndex = -1; header.append(heading);
    const description = node.description || (node.children.length ? `Explore the subjects within ${node.label.toLowerCase()}.` : 'Local details for this subject still need to be established from evidence.');
    header.append(element('p', '', description));
    const stats = element('div', 'dx-topic-meta');
    if (node.children.length) stats.append(element('span', '', `${node.children.length} branches`), element('span', '', `${this.catalogue.totals.get(node.id).toLocaleString('en-GB')} topics below`));
    if (node.parent) stats.append(action('↑ Up one level', () => this.navigate(node.parent), 'dx-text-button'));
    header.append(stats); this.content.append(header);
    if (node.children.length) {
      const grid = element('div', 'dx-branches');
      node.children.forEach((id, index) => {
        const child = this.catalogue.byId.get(id), button = action('', () => this.navigate(id), 'dx-branch');
        const number = element('span', 'dx-branch-number', String(index + 1).padStart(2, '0'));
        const copy = element('span', 'dx-branch-copy'); copy.append(element('strong', '', child.label));
        copy.append(element('span', 'dx-branch-preview', child.children.length ? child.children.slice(0, 3).map(key => this.catalogue.byId.get(key).label).join(' · ') : child.evidence === 'sourced' ? 'Read the source-linked description' : 'Explore this research topic'));
        copy.append(element('small', '', child.children.length ? `${this.catalogue.totals.get(id)} topics` : child.evidence === 'sourced' ? 'Source-linked' : 'To investigate'));
        const arrow = element('span', 'dx-arrow', '↗'); arrow.setAttribute('aria-hidden', 'true'); button.append(number, copy, arrow); grid.append(button);
      });
      this.content.append(grid);
    } else {
      const end = element('div', 'dx-end'); end.append(element('span', 'dx-eyebrow', 'CONTINUE THE DISCOVERY'), element('h3', '', 'Turn this subject into a question.'));
      end.append(element('p', '', node.evidence === 'sourced' ? 'Ask for an explanation, check the evidence, or discover what connects to this topic.' : 'This is the current edge of the map. Ask Mannin to investigate the Manx details and identify what is still missing.'));
      end.append(action('Prepare a discovery question', () => { this.mode = 'discover'; this.topicModes.set(node.id, this.mode); this.renderDetails(); this.details.querySelector('textarea')?.focus(); }, 'dx-button dx-primary'));
      this.content.append(end);
    }
    if (focus) heading.focus({ preventScroll: true });
    this.status.textContent = `${node.path.join(', ')}. ${node.children.length} branches.`;
  }
  renderSearch() {
    const matches = searchTopics(this.catalogue, this.query);
    const header = element('header', 'dx-search-heading');
    const heading = element('h2', '', `${matches.length.toLocaleString('en-GB')} matching topics`); heading.tabIndex = -1;
    header.append(heading, action('Back to ' + this.node.label, () => { this.query = ''; this.searchInput.value = ''; this.renderContent(true); }, 'dx-text-button'));
    this.content.append(header);
    if (!matches.length) this.content.append(element('p', '', 'Try a broader subject, fewer words, or a nearby area in the island index.'));
    const list = element('div', 'dx-results');
    for (const node of matches.slice(0, this.resultLimit)) {
      const result = action('', () => this.navigate(node.id), 'dx-result');
      result.append(element('strong', '', node.label), element('span', '', node.path.slice(0, -1).join(' › '))); list.append(result);
    }
    this.content.append(list);
    if (matches.length > this.resultLimit) {
      const remaining = Math.min(30, matches.length - this.resultLimit);
      this.content.append(action(`Show ${remaining} more topics`, () => {
        const firstNew = this.resultLimit; this.resultLimit += remaining; this.renderContent(false);
        this.content.querySelectorAll('.dx-result')[firstNew]?.focus();
        this.status.textContent = `Showing ${Math.min(this.resultLimit, matches.length)} of ${matches.length} matching topics.`;
      }));
    }
    this.status.textContent = `${matches.length} topics match ${this.query}.`;
  }
  renderDetails() {
    this.details.replaceChildren();
    const node = this.node, local = this.getAttribute('data-context') === 'local';
    const questionPanel = element('section', 'dx-question-panel');
    questionPanel.append(element('span', 'dx-eyebrow', 'DISCOVER WITH MANNIN'), element('h3', '', 'Where next?'));
    const modes = element('div', 'dx-question-modes'); modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', 'Question direction');
    for (const [value, label] of [['explain', 'Explain'], ['evidence', 'Evidence'], ['connections', 'Connections'], ['discover', 'What’s missing?']]) {
      const button = action(label, () => { this.mode = value; this.topicModes.set(node.id, value); this.renderDetails(); this.details.querySelector(`[data-mode="${value}"]`)?.focus(); }, 'dx-mode');
      button.dataset.mode = value; button.setAttribute('aria-pressed', String(this.mode === value)); modes.append(button);
    }
    const label = element('label', 'dx-question-label', 'Your question about ' + node.label);
    const draft = element('textarea'); draft.rows = 6; draft.value = this.questionDrafts.get(node.id + '|' + this.mode) ?? topicQuestion(node, this.mode);
    const count = element('span', 'dx-small'); count.id = 'dx-question-count';
    const problem = element('span', 'dx-small dx-error'); problem.id = 'dx-question-error'; problem.setAttribute('role', 'status');
    draft.setAttribute('aria-describedby', count.id + ' ' + problem.id);
    let attempted = false;
    const refresh = () => {
      count.textContent = draft.value.length.toLocaleString('en-GB') + ' / ' + MAX_QUESTION_CHARS.toLocaleString('en-GB') + ' characters';
      const message = (attempted || draft.value.length > MAX_QUESTION_CHARS) ? questionProblem(draft.value) : '';
      problem.textContent = message; problem.hidden = !message;
      if (message) draft.setAttribute('aria-invalid', 'true'); else draft.removeAttribute('aria-invalid');
      return message;
    };
    draft.addEventListener('input', () => { this.questionDrafts.set(node.id + '|' + this.mode, draft.value); refresh(); }); refresh(); label.append(draft, count, problem);
    const deliver = action('Bring question to Mannin', () => {
      const question = draft.value.trim();
      attempted = true; if (refresh()) { draft.focus(); return; }
      if (local) this.dispatchEvent(new CustomEvent('mani:prepare-question', { bubbles: true, detail: { question, topic: node.id, label: node.label } }));
      else window.open(maniQuestionUrl(node, question), '_blank', 'noopener,noreferrer');
    }, 'dx-button dx-primary');
    questionPanel.append(modes, label, deliver);
    questionPanel.append(element('p', 'dx-small', local ? 'Opens an editable draft in your conversation. Ask when you’re ready.' : 'Attempts to open Mannin in a new tab with an editable question. Mannin must be running on this computer.'));
    if (!local) {
      questionPanel.append(action('Copy question', async () => {
        try { await navigator.clipboard.writeText(draft.value); this.status.textContent = 'Question copied.'; }
        catch { draft.focus(); draft.select(); this.status.textContent = 'Select and copy the question from the text box.'; }
      }, 'dx-text-button'));
    }
    this.details.append(questionPanel);
    const source = node.source || node.reference;
    if (source) {
      const evidence = element('section', 'dx-evidence');
      evidence.append(element('span', 'dx-eyebrow', node.source ? 'SOURCE LINKED TO THIS DESCRIPTION' : 'REFERENCE FOR THIS AREA'));
      evidence.append(safeLink(source.label + ' ↗', source.url, 'dx-source', true));
      if (!node.source) evidence.append(element('p', 'dx-small', 'A starting reference for the broader subject. It does not verify this outline’s local details.'));
      if (node.source && node.reference && node.reference.url !== node.source.url) {
        evidence.append(element('span', 'dx-eyebrow', 'REFERENCE FOR THIS AREA'));
        evidence.append(safeLink(node.reference.label + ' ↗', node.reference.url, 'dx-source', true));
      }
      this.details.append(evidence);
    }
    const connections = connectedTopics(this.catalogue, node);
    if (connections.nodes.length) {
      const related = element('section', 'dx-related'); related.append(element('h3', '', connections.branch.id === node.id ? 'Connected topics' : 'Connected to ' + connections.branch.label));
      for (const target of connections.nodes) { const button = action('', () => this.navigate(target.id), 'dx-related-topic'); button.append(element('strong', '', target.label), element('span', '', target.path.slice(1, -1).join(' › '))); related.append(button); }
      this.details.append(related);
    }
    const reading = element('section', 'dx-reading'); reading.append(element('h3', '', 'Elsewhere in the knowledge base'));
    if (local) reading.append(element('p', 'dx-small', 'Atlas research opens in a new tab and may require sign-in.'));
    for (const link of knowledgeLinks(node)) {
      const anchor = safeLink('', local ? ATLAS_ORIGIN + link.href : link.href, 'dx-reading-link', local);
      if (local) anchor.setAttribute('aria-label', link.label + ' (opens in a new tab)');
      anchor.append(element('span', '', link.kind), element('strong', '', link.label + ' ↗')); reading.append(anchor);
    }
    this.details.append(reading);
  }
}
if (!customElements.get('manx-discovery')) customElements.define('manx-discovery', ManxDiscovery);
