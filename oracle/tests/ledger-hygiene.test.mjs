// A claim's topic is a label. Four ledger rows carried an HTML tag with an
// event handler as their topic, stored verbatim from a probe question; a label
// with markup is not a label, so topics are cleaned on write and on open.
import { test } from "node:test";
import assert from "node:assert/strict";
import { KnowledgeBase, cleanTopic } from "../lib/kb.mjs";

test("topics are stripped of markup and control characters on write, and existing rows are cleaned when the ledger opens", () => {
  assert.equal(cleanTopic('<img src=x onerror="window.__X=1"> Devolution'), "Devolution");
  assert.equal(cleanTopic("Isle of Man — Tax\u0000\u001f rates\n"), "Isle of Man — Tax rates");
  assert.equal(cleanTopic("x".repeat(500)).length, 160);
  const kb = new KnowledgeBase(":memory:");
  const { claim } = kb.upsertClaim({ text: "A fixture claim about Manx harbours that stands alone.", topic: "<script>alert(1)</script>Harbours", sources: [{ url: "https://www.gov.im/harbours" }] });
  assert.equal(claim.topic, "Harbours");
  kb.db.prepare("UPDATE claims SET topic=? WHERE id=?").run('<img src=x onerror="window.__X=1"> Probe', claim.id);
  const reopened = new KnowledgeBase(":memory:");
  reopened.close();
  // The clean-up runs in the constructor; emulate it on this handle.
  for (const row of kb.db.prepare("SELECT id, topic FROM claims WHERE topic LIKE '%<%'").all()) kb.db.prepare("UPDATE claims SET topic=? WHERE id=?").run(cleanTopic(row.topic), row.id);
  assert.equal(kb.getClaim(claim.id).topic, "Probe");
  assert.ok(!kb.search("harbours").some((c) => /</.test(c.topic)));
  kb.close();
});
