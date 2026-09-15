import { MAX_MESSAGE_CHARS, messageProblem } from './conversation-policy.mjs';

// One submission path for the keyboard and button. Never truncate a pasted draft.
export function bindQuestionComposer({ form, input, counter, error, onSubmit }) {
  let composing = false, attempted = false, revision = 0;
  function refresh() {
    const over = input.value.length > MAX_MESSAGE_CHARS;
    counter.textContent = input.value.length.toLocaleString('en-GB') + ' / ' + MAX_MESSAGE_CHARS.toLocaleString('en-GB') + ' characters';
    counter.dataset.overLimit = String(over);
    const problem = (attempted || over) ? messageProblem(input.value) : '';
    error.textContent = problem; error.hidden = !problem;
    if (problem) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    return problem;
  }
  input.addEventListener('input', () => { revision++; refresh(); });
  input.addEventListener('change', () => { revision++; attempted = true; refresh(); });
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; refresh(); });
  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || composing || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    if (!event.repeat) form.requestSubmit();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (composing) return;
    attempted = true;
    if (refresh()) { input.focus(); return; }
    const question = input.value;
    input.value = ''; attempted = false; refresh();
    const submittedRevision = ++revision;
    // Normal request failures are handled by ask(). Also retain the draft if an
    // unexpected startup failure escapes, without replacing later edits.
    Promise.resolve().then(() => onSubmit(question)).catch(() => {
      if (revision !== submittedRevision || input.value !== '') return;
      input.value = question; refresh();
      error.textContent = 'Could not send this question. Your draft is here; please try again.';
      error.hidden = false;
    });
  });
  refresh();
  return { refresh };
}
