import { messageProblem } from './conversation-policy.mjs';
import { discoveryHash, readDiscoveryHash } from '/discovery/model.mjs';

// View changes never switch conversation IDs, reset a session or submit a request.
export function bindDiscovery({ input, setStatus, onExplore = () => {} }) {
  const conversation = document.querySelector('#conversationWorkspace');
  const explorer = document.querySelector('#discoveryWorkspace');
  const topicMap = document.querySelector('manx-discovery');
  const pending = document.querySelector('#discoveryDraft');
  const topicLabel = document.querySelector('#discoveryDraftLabel');
  let lastTopic = 'isle-of-man', preparedTopic = null, previousDraft = '', appliedQuestion = '';
  let wasExploring = false;
  function route() {
    const state = readDiscoveryHash(location.hash);
    if (state.topic) lastTopic = state.topic;
    const exploring = location.hash.startsWith('#explore');
    if (exploring && !wasExploring) onExplore();
    wasExploring = exploring;
    conversation.hidden = exploring; explorer.hidden = !exploring;
    document.querySelectorAll('[data-mani-view]').forEach(link => {
      const active = link.dataset.maniView === (exploring ? 'explore' : 'talk');
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    document.querySelector('[data-mani-view="explore"]').href = discoveryHash(lastTopic);
    if (state.question && state.question !== appliedQuestion) {
      prepare(state.question, state.topic, 'Selected topic');
      history.replaceState(null, '', '#talk');
    }
  }
  function prepare(question, topic, label) {
    const draft = String(question || '').trim();
    const problem = messageProblem(draft);
    if (problem) { setStatus(problem); return; }
    if (input.value !== appliedQuestion) previousDraft = input.value;
    appliedQuestion = draft;
    input.value = draft; input.dispatchEvent(new Event('input')); lastTopic = topic || lastTopic; preparedTopic = lastTopic;
    topicLabel.textContent = `From the topic map: ${label || 'Isle of Man'}`;
    pending.hidden = false;
    document.querySelector('#restoreDiscoveryDraft').hidden = !previousDraft;
    history.pushState(null, '', '#talk');
    route(); input.focus(); input.scrollIntoView({ block: 'center', behavior: 'instant' });
    setStatus('Your discovery question is ready. Edit it or press Ask. Your conversation is unchanged.');
  }
  topicMap.addEventListener('mani:prepare-question', event => prepare(event.detail.question, event.detail.topic, event.detail.label));
  document.querySelector('#returnToTopic').addEventListener('click', () => { location.hash = discoveryHash(preparedTopic || lastTopic); });
  document.querySelector('#restoreDiscoveryDraft').addEventListener('click', () => { input.value = previousDraft; input.dispatchEvent(new Event('input')); pending.hidden = true; input.focus(); setStatus('Your previous draft has been restored.'); });
  document.querySelector('#dismissDiscoveryDraft').addEventListener('click', () => { pending.hidden = true; });
  document.querySelector('[data-mani-view="talk"]').addEventListener('click', () => { requestAnimationFrame(() => input.focus()); });
  window.addEventListener('hashchange', route); window.addEventListener('popstate', route);
  route();
}
