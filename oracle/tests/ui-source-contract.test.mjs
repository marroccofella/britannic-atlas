import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ORACLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = readFileSync(path.join(ORACLE, "public", "app.js"), "utf8");
const HTML = readFileSync(path.join(ORACLE, "public", "index.html"), "utf8");
const CSS = readFileSync(path.join(ORACLE, "public", "style.css"), "utf8");
const README = readFileSync(path.join(ORACLE, "README.md"), "utf8");

test("the conversation uses one small live status instead of re-announcing the stream", () => {
  assert.match(HTML, /id="liveStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(HTML, /id="transcript"[^>]*role="log"[^>]*aria-live="off"/);
  assert.match(APP, /function setLiveStatus\(/);
});

test("per-answer MOMM review and canvas actions use the fixed same-origin contracts", () => {
  assert.match(HTML, /class="deliberate"[^>]*>Think harder with MOMM</);
  assert.doesNotMatch(HTML, /class="visualise"/);
  assert.match(HTML, /data-question="Make a chart or diagram from the last answer"/);
  assert.match(APP, /postJson\("\/api\/deliberate",\s*\{[^\n]*sessionId,\s*requestId/);
  assert.match(APP, /event === "action" && d\.kind === "generate_canvas"/);
  assert.match(APP, /postJson\("\/api\/canvas",\s*\{\s*actionId,\s*sessionId,\s*requestId/);
  assert.doesNotMatch(APP, /postJson\("\/api\/canvas",\s*\{\s*question/);
  assert.match(APP, /function renderReviewSummary\(/);
  assert.match(APP, /result\.message\s*\|\|\s*result\.reason/);
  assert.match(APP, /result\?\.narration\s*\|\|\s*result\?\.reason/);
  assert.doesNotMatch(APP, /chainOfThought|chain_of_thought|\.reasoning\b/);
});

test("canvas output is revalidated against the closed server schema and always has a derived table plus PNG download", () => {
  assert.match(APP, /function validateCanvasSpec\(/);
  assert.match(APP, /CANVAS_COLORS\s*=\s*Object\.freeze\(\{/);
  assert.match(APP, /\["bar",\s*"line",\s*"scatter",\s*"node-edge"\]/);
  assert.match(APP, /safeFinite\(value\.width,\s*320,\s*1200/);
  assert.match(APP, /safeFinite\(value\.height,\s*240,\s*900/);
  assert.match(APP, /function deriveCanvasTables\(/);
  assert.match(APP, /function renderCanvasWorkspace\(/);
  assert.match(APP, /document\.createElement\("table"\)/);
  assert.match(APP, /canvas\.toBlob\(/);
  assert.match(APP, /download\s*=\s*[^;]*\.png/);
  assert.doesNotMatch(APP, /value\?\.table|value\.palette|safeHex\(/);
});

test("map actions are allowlisted and deduplicated", () => {
  assert.match(APP, /function safeMapWorkspaceHref\(/);
  assert.match(APP, /function safeOsmMapHref\(/);
  assert.match(APP, /MAP_PROVIDER_ALLOWLIST\s*=\s*Object\.freeze\(\{/);
  assert.match(APP, /function safeMapProvider\(/);
  assert.match(APP, /d\.kind === "describe_manx_map"/);
  assert.match(APP, /d\.kind === "open_full_map"/);
  assert.match(APP, /action\.artifact\?\.id === "manx-map"/);
  for (const label of ["MANX Earth", "Isle of Man Government maps", "OpenStreetMap", "Google Maps", "Google Earth"]) {
    assert.match(APP, new RegExp(label));
  }
  assert.match(APP, /renderedActions\s*=\s*new Map\(\)/);
  assert.match(APP, /function claimActionCard\(/);
});

test("the speaking control visibly tells the user how to interrupt", () => {
  assert.match(APP, /speaking:\s*"Speaking · interrupt"/);
  assert.match(APP, /aria-label[^\n]*"Interrupt and speak"/);
});

test("long MOMM and canvas calls can be stopped and a completed review cannot be accidentally bought twice", () => {
  assert.match(APP, /activeToolControllers\s*=\s*new Set\(\)/);
  assert.match(APP, /postJson\(url, body, \{ signal \} = \{\}\)/);
  assert.match(APP, /for \(const controller of activeToolControllers\) controller\.abort\(\)/);
  assert.match(APP, /MOMM review complete/);
  assert.match(APP, /MOMM's considered answer/);
});

test("a delayed canvas cannot render after a newer conversation turn", () => {
  assert.match(APP, /generateCanvasFromAction\(turn, actionId, generation\)/);
  assert.match(APP, /generation !== responseGeneration/);
  assert.match(APP, /generateCanvasFromAction\(el, d\.actionId, generation\)/);
});

test("categorical line charts use point indexes instead of string arithmetic", () => {
  assert.match(APP, /typeof point\.x === "number" && Number\.isFinite\(point\.x\)/);
  assert.doesNotMatch(APP, /every\(\(point\) => point\.x != null\)/);
});

test("Think harder follows server eligibility including Manx cross-border answers", () => {
  assert.match(APP, /d\.episodeId && d\.answered !== false/);
  assert.match(APP, /d\.reviewable !== false/);
});

test("a rewritten considered answer explains its evidence downgrade and lists bounded corrections", () => {
  assert.match(APP, /result\.evidenceChanged/);
  assert.match(APP, /Reviewer agreement is not source evidence/);
  assert.match(APP, /What changed/);
  assert.match(APP, /result\.corrections/);
});

test("Space is ignored whenever an editable control has focus", () => {
  assert.match(APP, /closest\("input, textarea, select, button, a, summary, \[contenteditable='true'\]"\)/);
  const keydown = APP.slice(APP.indexOf('window.addEventListener("keydown"'), APP.indexOf('window.addEventListener("keyup"'));
  assert.match(keydown, /!isEditableTarget\(e\.target\)/);
});

test("interrupt and incomplete states are announced without sight", () => {
  assert.match(APP, /Mannin is (?:working|speaking)\. Activate Interrupt and speak/);
  assert.match(APP, /Interrupted\. The previous answer is incomplete\. Listening for you\./);
  assert.match(APP, /markIncomplete[\s\S]*setLiveStatus/);
});

test("the shared MOMM allowance is visible and documentation is per-answer", () => {
  assert.match(APP, /b\.mommAllowance\.remaining/);
  assert.match(APP, /MOMM review slots? left this hour/);
  assert.match(README, /that answer's button disables/i);
  assert.match(README, /fixed local capability action, not a MOMM-reviewed canvas/i);
});

test("barge-in preserves recognition and stale streams cannot update the current turn", () => {
  assert.match(APP, /function bargeIn\(/);
  assert.match(APP, /hush\(\{\s*preserveListening:\s*true\s*\}\)/);
  assert.match(APP, /responseGeneration/);
  assert.match(APP, /function isCurrentResponse\(/);
  assert.match(APP, /if \(!isCurrentResponse\(/);
  assert.match(APP, /function canSpeakBackgroundUpdate\(/);
  const finished = APP.slice(APP.indexOf('es.addEventListener("expedition.finished"'), APP.indexOf("loadBrain();\n  fetch"));
  assert.match(finished, /canSpeakBackgroundUpdate\(\)/);
});

test("interactive controls have visible focus and touch-sized targets", () => {
  assert.match(CSS, /:focus-visible\s*\{[^}]*outline:/s);
  assert.match(CSS, /button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(CSS, /@media\s*\(max-width:\s*620px\)[^]*\.answerActions/s);
});

test("research suggestions are confirmed in dialogue instead of bypassing it", () => {
  assert.match(HTML, /class="nextSteps hidden"/);
  assert.match(APP, /Array\.isArray\(d\.nextSteps\)/);
  assert.match(APP, /Check official Manx sources/);
  assert.match(APP, /searchAnswer\(turn,step\)/);
  assert.match(APP, /ask\(command,\{researchTurnId:token\.requestId,preserveSpeech:true,canDispatch:valid\}\)/);
  const deeper = APP.slice(APP.indexOf('$("#deeper").onclick'), APP.indexOf('$("#dream").onclick'));
  assert.match(deeper, /ask\("Go deeper on what you suggested"\)/);
  assert.doesNotMatch(deeper, /\/api\/expedition/);
});

test("research progress and completion return in the conversation and recover after reload", () => {
  assert.match(HTML, /class="researchProgressLive srOnly"[^>]*aria-live="polite"/);
  assert.match(HTML, /class="researchOutcomeLive srOnly"[^>]*aria-live="polite"/);
  assert.match(APP, /function ensureResearchTurn\(/);
  assert.match(APP, /function renderResearchProgress\(/);
  assert.match(APP, /function renderResearchResult\(/);
  assert.match(APP, /es\.addEventListener\("expedition\.preview"/);
  assert.match(APP, /es\.addEventListener\("expedition\.failed"[\s\S]*renderResearchFailure/);
  assert.match(APP, /fetch\(`\/api\/research\?sessionId=/);
  assert.match(APP, /syncResearch\(\)/);
});
