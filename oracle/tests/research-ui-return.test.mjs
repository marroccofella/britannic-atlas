import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = readFileSync(join(ROOT, "public", "app.js"), "utf8");
const HTML = readFileSync(join(ROOT, "public", "index.html"), "utf8");
const CSS = readFileSync(join(ROOT, "public", "style.css"), "utf8");
const RESEARCH = APP.slice(APP.indexOf("// ---------- conversation-visible research ----------"), APP.indexOf("function safeFinite"));
const EVENTS = APP.slice(APP.indexOf("function researchEventData"), APP.lastIndexOf("loadBrain();"));

test("every answer turn separates progress from terminal live announcements", () => {
  assert.match(HTML, /class="researchStatus hidden"[^>]*aria-label="Research progress and result"/);
  assert.match(HTML, /class="researchProgressLive srOnly"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.match(HTML, /class="researchOutcomeLive srOnly"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.match(HTML, /class="researchBody"/);
  assert.doesNotMatch(HTML, /class="researchStatus hidden"[^>]*aria-live=/);
  assert.match(CSS, /\.researchStatus\s*\{/);
  assert.match(CSS, /\.researchStatus\[data-status="done"\]/);
  assert.match(CSS, /\.researchStatus\[data-status="failed"\]/);
});

test("queued, progress, preview, finished, and failed events update the research card", () => {
  for (const event of ["expedition.queued", "expedition.started", "expedition.progress", "expedition.preview", "expedition.step", "expedition.failed", "expedition.finished"]) {
    assert.match(EVENTS, new RegExp(`es\\.addEventListener\\("${event.replace(".", "\\.")}"`));
  }
  assert.match(RESEARCH, /function renderResearchStatus\(/);
  assert.match(RESEARCH, /appendTextElement\(panel, "p", researchProgressText\(record\), "researchProgress"\)/);
  assert.match(RESEARCH, /className = "researchPreview"/);
  assert.match(RESEARCH, /className = "researchResult"/);
  assert.match(RESEARCH, /What the check established/);
  assert.match(RESEARCH, /Still unresolved/);
});

test("research sources remain inert text and pass a strict external-link boundary", () => {
  assert.match(RESEARCH, /function safeResearchSource\(/);
  assert.match(RESEARCH, /safeExternalHref\(rawUrl\)/);
  assert.match(RESEARCH, /url\.protocol !== "https:"/);
  assert.match(RESEARCH, /url\.username \|\| url\.password \|\| privateHost/);
  assert.match(RESEARCH, /link\.target = "_blank"; link\.rel = "noopener noreferrer"; link\.textContent = source\.title/);
  assert.doesNotMatch(RESEARCH, /innerHTML/);
});

test("completion is always announced visibly and optional speech waits until Oracle is free", () => {
  assert.match(RESEARCH, /function announceResearchOutcome\([\s\S]*\.researchOutcomeLive[\s\S]*textContent = message/);
  assert.match(RESEARCH, /result and sources are now in the conversation/);
  assert.match(RESEARCH, /deferResearchSpeech\(record\.id/);
  assert.match(APP, /function flushDeferredResearchSpeech\([\s\S]*canSpeakBackgroundUpdate\(\)/);
  assert.match(APP, /function onSpeechDrained\(\)[\s\S]*flushDeferredResearchSpeech\(\)/);
  assert.match(APP, /onState: next => \{[\s\S]*afterCaptureStops\(\)/);
  assert.match(APP, /function afterCaptureStops\(\)[\s\S]*queueMicrotask[\s\S]*flushDeferredResearchSpeech\(\)/);
});

test("a stale nonterminal event cannot regress fresher recovered progress or preview", () => {
  assert.match(RESEARCH, /function researchRevision\(/);
  assert.match(RESEARCH, /const staleNonterminal =/);
  assert.match(RESEARCH, /if \(staleNonterminal\) return old/);
});

test("recovery plus duplicate terminal SSE events announce completion only once", () => {
  const announcement = RESEARCH.slice(RESEARCH.indexOf("function announceResearchOutcome"), RESEARCH.indexOf("function updateResearch"));
  assert.match(announcement, /completedResearchAnnouncements\.has\(record\.id\)/);
  assert.match(announcement, /completedResearchAnnouncements\.add\(record\.id\)/);
  assert.ok(announcement.indexOf(".has(record.id)") < announcement.indexOf(".add(record.id)"));
});

test("a dynamically recovered card is connected with empty live regions before deferred rendering", () => {
  const ensure = RESEARCH.slice(RESEARCH.indexOf("function ensureResearchTurn"), RESEARCH.indexOf("function appendResearchSources"));
  assert.match(ensure, /transcript\.prepend\(target\)/);
  assert.match(RESEARCH, /target\.dataset\.researchPending = "true"/);
  assert.match(RESEARCH, /setTimeout\(\(\) =>/);
  assert.match(RESEARCH, /panel\.querySelector\("\.researchProgressLive"\)/);
  assert.match(RESEARCH, /panel\.querySelector\("\.researchOutcomeLive"\)/);
});

test("research state is restored per session on initial load and EventSource reconnect", () => {
  assert.match(RESEARCH, /fetch\(`\/api\/research\?sessionId=\$\{encodeURIComponent\(requestedSession\)\}`/);
  assert.match(RESEARCH, /Array\.isArray\(payload\.expeditions\)/);
  assert.match(RESEARCH, /updateResearch\(row, \{ fromSync: true, announce: wasActive \}\)/);
  assert.match(APP, /else if \(!trusted && \(!eventSession \|\| eventSession !== sessionId\)\) return null/);
  assert.match(APP, /es\.onopen = \(\) => \{[\s\S]{0,180}loadBrain\(\); syncResearch\(\)/);
  assert.match(APP, /historyReady=restoreConversation\(sessionId\)/);
  assert.match(APP, /await syncResearch\(\)/);
});

test("a delayed restore cannot cross a New-conversation boundary", () => {
  assert.match(RESEARCH, /const requestedSession = sessionId/);
  assert.match(RESEARCH, /researchSyncSession === requestedSession/);
  assert.match(RESEARCH, /if \(sessionId !== requestedSession\) return/);
  assert.match(RESEARCH, /if \(researchSyncPromise === syncPromise\)/);
  assert.match(RESEARCH, /if \(fromSync\)[\s\S]{0,240}!eventSession \|\| eventSession !== sessionId/);
});

test("successful recovery fails closed any tracked active job absent from its session response", () => {
  assert.match(RESEARCH, /const restoredIds = new Set\(\)/);
  assert.match(RESEARCH, /const trackedAtStart = new Set\(/);
  assert.match(RESEARCH, /for \(const \[id, record\] of researchRecords\)/);
  assert.match(RESEARCH, /restoredIds\.has\(id\)/);
  assert.match(RESEARCH, /!trackedAtStart\.has\(id\)/);
  assert.match(RESEARCH, /could not be restored for this conversation/);
});

test("terminal official-source truth overrides a stale preview", () => {
  assert.match(RESEARCH, /officialAnswerFound:/);
  assert.match(RESEARCH, /function researchOfficialFlags\(/);
  assert.match(RESEARCH, /record\.officialRequested \?\? record\.preview\?\.officialRequested/);
  assert.match(RESEARCH, /record\.officialSourceFound \?\? record\.preview\?\.officialSourceFound/);
  assert.match(RESEARCH, /record\.officialAnswerFound \?\? record\.preview\?\.officialAnswerFound/);
  assert.match(RESEARCH, /status === "done"[\s\S]{0,220}officialRequested[\s\S]{0,220}status = "partial"/);
});

test("recovery reads terminal official-source truth from the persisted progress snapshot", () => {
  assert.match(RESEARCH, /optionalResearchBoolean\(raw, "officialRequested", "official_requested"\)\s*\?\?\s*optionalResearchBoolean\(progress, "officialRequested", "official_requested"\)/);
  assert.match(RESEARCH, /optionalResearchBoolean\(raw, "officialSourceFound", "official_source_found"\)\s*\?\?\s*optionalResearchBoolean\(progress, "officialSourceFound", "official_source_found"\)/);
  assert.match(RESEARCH, /optionalResearchBoolean\(raw, "officialAnswerFound", "official_answer_found"\)\s*\?\?\s*optionalResearchBoolean\(progress, "officialAnswerFound", "official_answer_found"\)/);
});

test("the event stream and every expedition diagnostic are session scoped", () => {
  assert.match(APP, /new EventSource\(`\/api\/events\?sessionId=\$\{encodeURIComponent\(connectedSession\)\}`\)/);
  assert.match(APP, /function currentResearchEventData\(event, connectedSession\)/);
  assert.match(APP, /eventSession !== connectedSession \|\| connectedSession !== sessionId/);
  for (const event of ["expedition.queued", "expedition.started", "expedition.progress", "expedition.preview", "expedition.step", "expedition.momm", "expedition.failed", "expedition.finished"]) {
    const start = EVENTS.indexOf(`es.addEventListener("${event}"`);
    assert.notEqual(start, -1, `${event} handler exists`);
    const next = EVENTS.indexOf("es.addEventListener(\"", start + 24);
    const body = EVENTS.slice(start, next === -1 ? EVENTS.length : next);
    assert.match(body, /currentResearchEventData\(e, connectedSession\)/, `${event} is filtered before diagnostics`);
    assert.ok(body.indexOf("currentResearchEventData") < body.indexOf("feedLine("), `${event} filters before feedLine`);
  }
  const reset = APP.slice(APP.indexOf('async function openConversation('), APP.indexOf('$("#deeper").onclick'));
  assert.match(reset, /connectResearchEvents\(\)/);
});

test("session ids use at least 128 bits of browser CSPRNG output", () => {
  assert.match(APP, /new Uint8Array\(16\)/);
  assert.match(APP, /crypto\.getRandomValues\(bytes\)/);
  assert.doesNotMatch(APP.slice(0, 900), /newSessionId[\s\S]{0,160}Math\.random/);
});

test("deferred spoken completions do not silently expire", () => {
  assert.match(APP, /MAX_DEFERRED_RESEARCH_SPEECH = 50/);
  assert.doesNotMatch(APP, /DEFERRED_RESEARCH_SPEECH_TTL_MS|expiresAt <= Date\.now/);
  assert.match(APP, /More research results are ready/);
});

test("an active in-card research job has a session-owned cancel action", () => {
  assert.match(RESEARCH, /className = "cancelResearch"/);
  assert.match(RESEARCH, /cancel\.onclick = \(\) => cancelResearch\(record\.id\)/);
  assert.match(RESEARCH, /postJson\("\/api\/expedition\/cancel", \{ id: record\.id, sessionId \}\)/);
  assert.match(RESEARCH, /Cancellation requested/);
});

test("completion renders the substantive summary rather than only ledger accounting", () => {
  assert.match(RESEARCH, /record\.summary \|\| record\.preview\?\.summary \|\| record\.addendum/);
  assert.match(EVENTS, /Array\.isArray\(d\.learned\)/);
  assert.match(EVENTS, /canonicalResearchStatus\(d\.status, d\.answered \? "done" : d\.productive \? "partial" : "empty"\)/);
});
