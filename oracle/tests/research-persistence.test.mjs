import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { KnowledgeBase } from "../lib/kb.mjs";

test("expedition progress is parsed, updateable, and isolated by exact session id", () => {
  const kb = new KnowledgeBase(":memory:");
  try {
    const official = kb.queueExpedition({
      question: "What colours are used by the Isle of Man flag?",
      reason: "requested",
      strategies: ["research"],
      jurisdiction: "Isle of Man",
      sessionId: "session-a",
      mode: "official_sources",
      progress: { phase: "queued", completed: 0, total: 1 },
      preview: { message: "Waiting to begin" },
    });
    const other = kb.queueExpedition({
      question: "What is the Isle of Man population?",
      reason: "requested",
      strategies: ["research", "adversarial"],
      jurisdiction: "Isle of Man",
      sessionId: "session-a-more",
      mode: "deep",
    });
    const exactButDifferent = kb.queueExpedition({
      question: "What is the Isle of Man anthem?",
      reason: "requested",
      sessionId: "session-a ",
      mode: "unknown-mode",
    });
    const sessionless = kb.queueExpedition({ question: "A legacy Isle of Man question?", reason: "legacy" });

    assert.deepEqual(kb.getExpedition(official).strategies, ["research"]);
    assert.equal(kb.getExpedition(official).session_id, "session-a");
    assert.equal(kb.getExpedition(official).mode, "official_sources");
    assert.deepEqual(kb.getExpedition(official).progress, { phase: "queued", completed: 0, total: 1 });
    assert.deepEqual(kb.getExpedition(official).preview, { message: "Waiting to begin" });
    assert.equal(kb.getExpedition(exactButDifferent).mode, "deep");
    assert.equal(kb.getExpedition(sessionless).session_id, null);

    const progressed = kb.updateExpeditionProgress(official, {
      phase: "research",
      message: "Official sources checked",
      completed: 1,
      percent: 100,
    }, { preview: { answer: "Red and gold", sources: ["https://www.gov.im/"] } });
    assert.deepEqual(progressed.progress, {
      phase: "research",
      completed: 1,
      total: 1,
      message: "Official sources checked",
      percent: 100,
    });
    assert.deepEqual(progressed.preview, { answer: "Red and gold", sources: ["https://www.gov.im/"] });

    const wrapped = kb.updateExpeditionProgress(official, { progress: { phase: "finished" }, preview: null });
    assert.equal(wrapped.progress.phase, "finished");
    assert.equal(wrapped.progress.total, 1);
    assert.equal(wrapped.preview, null);
    assert.equal(kb.updateExpeditionProgress("missing", { phase: "none" }), null);

    const mine = kb.expeditionsForSession("session-a");
    assert.deepEqual(mine.map((row) => row.id), [official]);
    assert.equal(mine[0].mode, "official_sources");
    assert.deepEqual(mine[0].progress, wrapped.progress);
    assert.deepEqual(kb.expeditionsForSession("session-a-more").map((row) => row.id), [other]);
    assert.deepEqual(kb.expeditionsForSession("session-a ").map((row) => row.id), [exactButDifferent]);
    assert.deepEqual(kb.expeditionsForSession("session-a-more "), []);
    assert.deepEqual(kb.expeditionsForSession(""), []);
    assert.deepEqual(kb.expeditionsForSession(null), []);
    assert.deepEqual(kb.expeditionsForSession("x".repeat(81)), []);

    kb.db.prepare("UPDATE expeditions SET progress='not-json', preview='not-json' WHERE id=?").run(other);
    assert.deepEqual(kb.getExpedition(other).progress, {});
    assert.equal(kb.getExpedition(other).preview, null);
    kb.db.prepare("UPDATE expeditions SET strategies=NULL, learned='{}', preview='\"scalar\"' WHERE id=?").run(other);
    assert.deepEqual(kb.getExpedition(other).strategies, []);
    assert.deepEqual(kb.getExpedition(other).learned, []);
    assert.equal(kb.getExpedition(other).preview, null);
    assert.equal(kb.recentExpeditions(10).every((row) => Array.isArray(row.strategies) && typeof row.progress === "object"), true);

    kb.updateExpeditionProgress(official, { progress: { stage: "safe" }, preview: { summary: "safe" } });
    kb.updateExpeditionProgress(official, {
      progress: { detail: "p".repeat(20_000) },
      preview: { summary: "v".repeat(70_000) },
    });
    assert.equal(kb.getExpedition(official).progress.stage, "safe", "an oversized update must not erase the last valid progress");
    assert.equal(kb.getExpedition(official).preview.summary, "safe", "an oversized update must not erase the last valid preview");
  } finally {
    kb.close();
  }
});

test("legacy expedition migration never guesses session ownership", () => {
  const dir = mkdtempSync(join(tmpdir(), "oracle-research-persistence-"));
  const file = join(dir, "legacy.db");
  let kb = null;
  try {
    const legacy = new DatabaseSync(file);
    legacy.exec(`
      CREATE TABLE episodes(id TEXT PRIMARY KEY, session_id TEXT, resolved_question TEXT, created_at TEXT);
      CREATE TABLE expeditions(id TEXT PRIMARY KEY, question TEXT, reason TEXT, strategies TEXT, jurisdiction TEXT, status TEXT, summary TEXT, learned TEXT, cost_usd REAL, duration_ms INTEGER, created_at TEXT, finished_at TEXT);
    `);
    const episode = legacy.prepare("INSERT INTO episodes(id,session_id,resolved_question,created_at) VALUES(?,?,?,?)");
    const expedition = legacy.prepare("INSERT INTO expeditions(id,question,reason,strategies,jurisdiction,status,created_at) VALUES(?,?,?,'[]','IM','done',?)");

    episode.run("e_unique", "session-unique", "Unique question", "2026-09-04T12:00:00.000Z");
    episode.run("e_blank", "   ", "Unique question", "2026-09-04T12:01:00.000Z");
    expedition.run("x_unique", "Unique question", "requested", "2026-09-04T12:05:00.000Z");

    episode.run("e_ambiguous_a", "session-a", "Ambiguous question", "2026-09-04T12:00:00.000Z");
    episode.run("e_ambiguous_b", "session-b", "Ambiguous question", "2026-09-04T12:04:00.000Z");
    expedition.run("x_ambiguous", "Ambiguous question", "requested", "2026-09-04T12:05:00.000Z");

    episode.run("e_too_old", "session-old", "Old question", "2026-09-04T11:54:59.000Z");
    expedition.run("x_too_old", "Old question", "requested", "2026-09-04T12:05:00.000Z");

    episode.run("e_after", "session-after", "Following question", "2026-09-04T12:05:01.000Z");
    expedition.run("x_after", "Following question", "requested", "2026-09-04T12:05:00.000Z");
    legacy.close();

    kb = new KnowledgeBase(file);
    assert.equal(kb.getExpedition("x_unique").session_id, null);
    assert.equal(kb.getExpedition("x_ambiguous").session_id, null);
    assert.equal(kb.getExpedition("x_too_old").session_id, null);
    assert.equal(kb.getExpedition("x_after").session_id, null);
    assert.equal(kb.getExpedition("x_unique").mode, "deep");
    assert.deepEqual(kb.getExpedition("x_unique").progress, {});
    assert.equal(kb.getExpedition("x_unique").preview, null);
    assert.deepEqual(kb.expeditionsForSession("session-unique").map((row) => row.id), []);
    assert.deepEqual(kb.expeditionsForSession("session-a"), []);

    const columns = new Set(kb.db.prepare("PRAGMA table_info(expeditions)").all().map((row) => row.name));
    assert.equal(["session_id", "mode", "progress", "preview"].every((name) => columns.has(name)), true);
    const indexes = new Set(kb.db.prepare("PRAGMA index_list(expeditions)").all().map((row) => row.name));
    assert.equal(indexes.has("expeditions_session_created"), true);

    kb.close();
    kb = new KnowledgeBase(file);
    assert.equal(kb.getExpedition("x_unique").session_id, null, "migration remains fail-closed and idempotent");
    assert.equal(kb.getExpedition("x_ambiguous").session_id, null);
  } finally {
    kb?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
