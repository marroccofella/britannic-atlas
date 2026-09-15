// The items left open by the 15 September trust review, each reproduced
// before its fix: a research offer made on a foreign-only answer was stale on
// arrival so "yes" was refused; a canvas requested before a reload was gone
// for good; a VACUUM would silently desynchronise the claims full-text index
// from its rows; and "Like" opening a sentence counted as an unbacked name.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { DialogueSessions, resolveDialogue } from "../lib/dialogue.mjs";
import { KnowledgeBase } from "../lib/kb.mjs";
import { entailmentCheck } from "../lib/entailment.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

test("a research offer on a foreign-only answer binds to that answer, so 'yes' runs it; 'go deeper' still cannot reach an older Manx subject", () => {
  const sessions = new DialogueSessions();
  const manx = sessions.resolve("s", "What is Tynwald?", { turnId: "t1", clientTurn: 1 });
  sessions.markInFlight("s", manx); sessions.complete("s", manx.semanticKey);
  const wales = sessions.resolve("s", "What is the corporation tax rate in Wales?", { turnId: "t2", clientTurn: 2 });
  assert.equal(wales.jurisdiction, "Wales");
  sessions.markInFlight("s", wales);
  sessions.complete("s", wales.semanticKey, { pendingAction: { kind: "research", subject: wales.canonical, jurisdiction: "Wales", researchMode: "live_sources", status: "offered" } });
  assert.ok(sessions.get("s").pendingAction, "the offer survived completion");
  const yes = sessions.preview("s", "yes");
  assert.equal(yes.route, "research", yes.speech);
  assert.equal(yes.canonical, wales.canonical);
  assert.equal(yes.jurisdiction, "Wales");
  // A later answer retires it.
  const later = sessions.resolve("s", "What is the capital of France?", { turnId: "t3", clientTurn: 3 });
  sessions.markInFlight("s", later); sessions.complete("s", later.semanticKey);
  assert.notEqual(sessions.preview("s", "yes").route, "research", "the offer belonged to the previous answer");
  // The README contract holds: "go deeper" after a foreign-only answer with no offer does not research an older Manx subject.
  const d = new DialogueSessions();
  for (const q of ["Tell me about Manx infrastructure.", "What is the capital of France?"]) { const r = d.resolve("qa", q); d.markInFlight("qa", r); d.complete("qa", r.semanticKey); }
  assert.notEqual(d.preview("qa", "Go deeper.").route, "research");
  assert.equal(resolveDialogue("Go deeper.").route, "clarify");
});

test("the claims full-text index survives a VACUUM that renumbers rows", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oracle-vacuum-"));
  const file = path.join(dir, "ledger.db");
  let kb = new KnowledgeBase(file);
  t.after(() => { try { kb.close(); } catch { /* already closed */ } fs.rmSync(dir, { recursive: true, force: true }); });
  const texts = ["Fixture alpha: the first claim about Manx harbour dues at Douglas.", "Fixture beta: a claim to be deleted about Peel castle opening hours.", "Fixture gamma: the third claim about Ramsey swing bridge closures."];
  const ids = texts.map((text) => kb.upsertClaim({ text, topic: "fixture", jurisdiction: "IM", kind: "learned", sources: [{ url: "https://www.gov.im/fixture/" + text.length }], support: 1 }).claim.id);
  kb.db.prepare("DELETE FROM claims WHERE id=?").run(ids[1]); // the delete trigger keeps the index in step
  kb.close();
  // A VACUUM on a table with a TEXT primary key may renumber rowids.
  kb = new KnowledgeBase(file); kb.db.exec("VACUUM"); kb.close();
  kb = new KnowledgeBase(file);
  assert.deepEqual(kb.search("Ramsey swing bridge", { jurisdiction: "IM" }).map((c) => c.id), [ids[2]]);
  assert.deepEqual(kb.search("harbour dues Douglas", { jurisdiction: "IM" }).map((c) => c.id), [ids[0]]);
});

test("a sentence opener like 'Like' is discourse, not an unbacked name", () => {
  const result = entailmentCheck({ answer: "Manx Utilities is a statutory board. Like other boards, it answers to Tynwald.", claims: [{ text: "Manx Utilities is a statutory board of the Isle of Man Government answerable to Tynwald.", topic: "utilities" }] });
  assert.equal(result.verdict, "entailed", JSON.stringify(result));
});

async function freePort() { const s = createServer(); s.listen(0, "127.0.0.1"); await once(s, "listening"); const port = s.address().port; await new Promise((resolve) => s.close(resolve)); return port; }

test("a canvas requested before a reload is recorded, restorable and regenerable after a restart", { timeout: 60000 }, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "oracle-canvas-restore-")); let child;
  t.after(async () => { if (child && child.exitCode === null) { const stopped = once(child, "exit"); child.kill(); await stopped; } fs.rmSync(directory, { recursive: true, force: true }); });
  const port = await freePort(), base = `http://127.0.0.1:${port}`;
  async function launch() {
    child = spawn(process.execPath, ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "oracle/server.mjs"], { cwd: ROOT, env: { ...process.env, ORACLE_DB: path.join(directory, "test.db"), ORACLE_PORT: String(port), ORACLE_EXPEDITIONS: "off", ORACLE_VERIFY_SOURCES: "off" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    await new Promise((resolve, reject) => { let output = ""; const timer = setTimeout(() => reject(new Error("Oracle startup timed out: " + output)), 25000);
      child.stdout.on("data", (chunk) => { output += chunk; if (output.includes("[oracle] listening")) { clearTimeout(timer); resolve(); } });
      child.stderr.on("data", (chunk) => { output += chunk; }); child.once("error", (error) => { clearTimeout(timer); reject(error); }); child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Oracle stopped (${code}): ${output}`)); }); });
  }
  const post = (url, body) => fetch(base + url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  await launch();
  const session = (await (await post("/api/conversations", {})).json()).conversation.id;
  // A subject the reviewed canvas refuses (a credential), so nothing is generated or paid for.
  const stream = await (await post("/api/ask", { sessionId: session, requestId: "r_visual", clientTurn: 1, question: "Draw a chart of my password history", source: "typed" })).text();
  const actionId = (stream.match(/"actionId":"(v_[a-f0-9-]+)"/) || [])[1];
  assert.ok(actionId, "the visual action carries an id: " + stream.slice(0, 300));
  const page = await (await fetch(`${base}/api/conversation?sessionId=${session}`)).json();
  const turn = page.turns.find((row) => row.id === "r_visual");
  assert.equal(turn.canvasResult?.ok, false);
  assert.equal(turn.canvasResult?.phase, "not_generated", "the request is on record before any generation");
  assert.equal(turn.canvasResult?.clientTurn, 1, "the originating turn travels with the record");
  const health = await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.runtime?.harness, "Claude Code CLI");
  assert.equal(typeof health.runtime?.answerModel, "string");
  assert.equal(typeof health.runtime?.researchModel, "string");
  const stopped = once(child, "exit"); child.kill(); await stopped; await launch();
  const wrongSession = await post("/api/canvas", { actionId, sessionId: "other", requestId: "r_c1" });
  assert.equal(wrongSession.status, 404, "another conversation cannot claim the action");
  const regenerate = await post("/api/canvas", { actionId, sessionId: session, requestId: "r_c2" });
  assert.equal(regenerate.status, 400, "after a restart the action is rebuilt from its record and reaches the public-subject check instead of 404");
  assert.match((await regenerate.json()).error, /non-sensitive public/);
});

test("a person's own medical, financial or identity details are never sent to external reviewers; public questions on those subjects still are", async () => {
  const { safeForExternalPeerReview } = await import("../lib/external-policy.mjs");
  for (const q of ["Draw me a chart of my own medical records", "Chart my bank account number 12345678 and sort code 40-11-22", "My national insurance number is QQ 12 34 56 C, am I resident?", "Review my tax return figures", "What does my prescription cost on the Island?", "Draw a chart of my medications: metformin 500 mg daily", "Chart my condition over time"]) assert.equal(safeForExternalPeerReview(q), false, q);
  for (const q of ["How do I open a bank account on the Isle of Man?", "What is the income tax rate for residents?", "Which medical services does Noble's Hospital provide?", "Explain the national insurance system"]) assert.equal(safeForExternalPeerReview(q), true, q);
});

test("the header badge reports the real harness, models and reviewer dispatcher from the server, never from the page", async () => {
  const { parseClaudeVersion } = await import("../lib/claude.mjs");
  assert.equal(parseClaudeVersion("1.0.100 (Claude Code)"), "1.0.100");
  assert.equal(parseClaudeVersion("claude-code 2.3.4-beta.1"), "2.3.4-beta.1");
  assert.equal(parseClaudeVersion("not a version"), null);
  const html = fs.readFileSync(path.join(HERE, "..", "public", "index.html"), "utf8");
  assert.match(html, /id="runtime" class="pill"/);
  const app = fs.readFileSync(path.join(HERE, "..", "public", "app.js"), "utf8");
  assert.match(app, /async function loadRuntime\(\)/);
  assert.match(app, /\n {2}loadRuntime\(\);/, "loaded at startup");
  assert.doesNotMatch(app, /badge\.innerHTML/, "rendered as text");
  const server = fs.readFileSync(path.join(HERE, "..", "server.mjs"), "utf8");
  assert.match(server, /runtime: \{ \.\.\.runtimeInfo \}/);
  assert.match(server, /harness: "Claude Code CLI"/);
});

test("canvas generation is shared, retryable after failure, and keeps its originating turn", () => {
  const server = fs.readFileSync(path.join(HERE, "..", "server.mjs"), "utf8");
  const route = server.slice(server.indexOf('p === "/api/canvas"'), server.indexOf('p === "/api/expedition"'));
  const assign = route.indexOf("visualAction.promise = trackToolWork(");
  const firstAwait = route.indexOf("await retrieval.focus(");
  assert.ok(assign > 0 && firstAwait > 0 && firstAwait < assign, "the generation promise wraps the retrieval await, so it is assigned before anything is awaited");
  assert.ok(route.indexOf("(async () => {") < firstAwait, "retrieval runs inside the shared promise");
  assert.match(route, /visualAction\.promise = null; visualAction\.controller = null;/, "a failed generation does not stay cached");
  assert.match(server, /clientTurn: visualActions\.get\(id\)\.clientTurn/, "the originating turn is recorded");
  assert.match(server, /clientTurn: Number\.isSafeInteger\(Number\(saved\.clientTurn\)\)/, "and restored");
});
