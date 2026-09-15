// The Atlas corpus was corrected on 12 September 2026 (two dead source URLs
// replaced, a rule-change statement rewritten, a source added) but the seed
// version was not bumped, so the ledger kept three verified claims citing a
// dead ship-registry URL and the old wording standing beside the new. A corpus
// fix must reach the ledger: reworded claims replace their predecessors and
// corrected citations drop the dead ones.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KnowledgeBase, claimId } from "../lib/kb.mjs";
import { SEED_VERSION, ensureSeeded, loadAtlas, articleClaims, manxClaims } from "../lib/seed.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { content, manx } = await loadAtlas(REPO_ROOT);
const corpus = [...articleClaims(content), ...manxClaims(manx)];

test("the current corpus no longer carries the dead ship-registry URL", () => {
  const dead = corpus.filter((item) => item.sources.some((s) => s.url.includes("shipregistry/fees/commercialfees.xml")));
  assert.equal(dead.length, 0, "if this fails the corpus itself regressed, not the ledger");
  assert.ok(corpus.some((item) => item.sources.some((s) => s.url === "https://www.iomshipregistry.com/")), "the replacement registry URL is present");
});

test("an older seed re-seeds: dead citations are replaced and vanished wording is retired, support is not inflated", async () => {
  const kb = new KnowledgeBase(":memory:");
  // A ledger seeded under the previous corpus: a stale citation, stale wording,
  // and one claim that is still current.
  const stale = { text: "Isle of Man — Vehicles, ships & aircraft: an old seed row citing a registry page that has since moved.", topic: "Isle of Man — Vehicles, ships & aircraft" };
  const current = corpus.find((item) => item.sources.some((s) => s.url === "https://www.iomshipregistry.com/"));
  kb.upsertClaim({ ...stale, kind: "seed", status: "verified", support: 2, sources: [{ url: "https://www.gov.im/ded/shipregistry/fees/commercialfees.xml", title: "old" }], evidenceKey: "seed:1", provenance: { origin: "britannica-atlas", editorial: true } });
  kb.upsertClaim({ ...current, kind: "seed", status: "verified", support: 2, sources: [{ url: "https://www.gov.im/ded/shipregistry/fees/commercialfees.xml", title: "old" }], evidenceKey: "seed:1", provenance: { origin: "britannica-atlas", editorial: true } });
  kb.setMeta("seeded_at", "2026-09-02T00:00:00.000Z");
  kb.setMeta("seed_version", "1");

  const result = await ensureSeeded(kb, REPO_ROOT);
  assert.notEqual(result.skipped, true, "a version bump must re-seed");
  assert.equal(kb.getMeta("seed_version"), SEED_VERSION);

  const retired = kb.getClaim(claimId(stale.text));
  assert.equal(retired.status, "retracted", "wording the corpus no longer says is retired");
  assert.equal(retired.provenance.retiredBy, `seed:${SEED_VERSION}`);
  assert.ok(!kb.search("registry page that has since moved").some((c) => c.id === retired.id), "and no longer answers questions");

  const kept = kb.getClaim(claimId(current.text));
  assert.equal(kept.status, "corroborated", "several official publishers are cited but none has been read yet");
  assert.equal(kept.support, 2, "a refresh is not fresh evidence");
  assert.ok(!kept.sources.some((s) => s.url.includes("commercialfees.xml")), "the dead citation is gone");
  assert.ok(kept.sources.some((s) => s.url === "https://www.iomshipregistry.com/"), "the corrected citation is present");
  assert.ok(kept.sources.every((s) => s.primary), "seed citations remain official");

  assert.equal((await ensureSeeded(kb, REPO_ROOT)).skipped, true, "a completed seed at the current version is not repeated");
  assert.equal(kb.getClaim(claimId(current.text)).support, 2, "and repeating it still adds nothing");
  kb.close();
});

test("re-seeding never touches learned, reviewed or retracted claims", async () => {
  const kb = new KnowledgeBase(":memory:");
  const learned = kb.upsertClaim({ text: "A learned claim about Manx ferries with its own evidence and history.", topic: "ferries", kind: "learned", support: 2, sources: [{ url: "https://www.gov.im/ferries" }] }).claim;
  const momm = kb.upsertClaim({ text: "A reviewed claim about Manx harbours that three models agreed on.", topic: "harbours", kind: "momm", support: 3, sources: [{ url: "https://www.gov.im/harbours" }] }).claim;
  kb.setMeta("seeded_at", "2026-09-02T00:00:00.000Z");
  kb.setMeta("seed_version", "1");
  await ensureSeeded(kb, REPO_ROOT);
  for (const before of [learned, momm]) {
    const after = kb.getClaim(before.id);
    assert.equal(after.status, before.status, `${before.kind} status untouched`);
    assert.equal(after.support, before.support, `${before.kind} support untouched`);
    assert.deepEqual(after.sources.map((s) => s.url), before.sources.map((s) => s.url), `${before.kind} citations untouched`);
  }
  assert.equal(kb.replaceSources(learned.id, [{ url: "https://example.com/x" }]), null, "replaceSources refuses non-seed kinds");
  kb.close();
});
