import test from 'node:test';
import assert from 'node:assert/strict';
import { KnowledgeBase, claimId } from '../lib/kb.mjs';
import { ensureSeeded, loadAtlas, manxClaims, SEED_VERSION } from '../lib/seed.mjs';
import { correctImmigrationSeed, LEGACY_IMMIGRATION_TEXT, IMMIGRATION_NOTICE_URL } from '../lib/seed-corrections.mjs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const current = manxClaims((await loadAtlas(root)).manx);
const updated = current.find(item => item.text.includes('Worker Migrant rules and associated employer policies changed on 1 June 2026'));
const persisted = claim => { const copy = { ...claim }; delete copy.trust; return copy; };
const origin = { origin: 'britannica-atlas', editorial: true };
function fixture(t, overrides = {}) {
  const kb = new KnowledgeBase(':memory:'); t.after(() => kb.close());
  kb.upsertClaim({ text: LEGACY_IMMIGRATION_TEXT, topic: 'Isle of Man — Immigration, work & residence', kind: 'seed', support: 2, provenance: origin, ...overrides });
  return kb;
}
test('a completed seed receives the narrow correction without changing prior answers or unrelated claims', async t => {
  const kb = fixture(t); kb.setMeta('seeded_at', '2026-08-23'); kb.setMeta('seed_version', SEED_VERSION);
  const unrelated = kb.upsertClaim({ text: 'Isle of Man unrelated claim is retained.', kind: 'learned' }).claim;
  const episodeId = kb.recordEpisode({ question: 'Previous question', answer: 'Previous answer', claimsUsed: [claimId(LEGACY_IMMIGRATION_TEXT)] });
  const episode = kb.getEpisode(episodeId);
  const result = await ensureSeeded(kb, root); assert.equal(result.skipped, true);
  const corrected = kb.getClaim(claimId(updated.text));
  assert.ok(corrected); assert.equal(corrected.status, 'single_source'); assert.equal(corrected.support, 1);
  assert.deepEqual(corrected.sources.map(s => s.url), [IMMIGRATION_NOTICE_URL]);
  assert.equal(kb.getClaim(claimId(LEGACY_IMMIGRATION_TEXT)).status, 'retracted');
  assert.equal(kb.getClaim(claimId(LEGACY_IMMIGRATION_TEXT)).provenance.supersededBy, corrected.id);
  assert.ok(kb.search('Worker Migrant rules').some(c => c.id === corrected.id));
  assert.ok(!kb.search('Worker Migrant rules').some(c => c.id === claimId(LEGACY_IMMIGRATION_TEXT)));
  assert.deepEqual(kb.getEpisode(episodeId), episode); assert.deepEqual(persisted(kb.getClaim(unrelated.id)), persisted(unrelated));
  await ensureSeeded(kb, root); assert.deepEqual(persisted(kb.getClaim(corrected.id)), persisted(corrected));
});
test('matching text with non-editorial provenance is untouched', t => {
  const kb = fixture(t, { provenance: { origin: 'user' } }); const before = kb.getClaim(claimId(LEGACY_IMMIGRATION_TEXT));
  assert.equal(correctImmigrationSeed(kb, current).corrected, false); assert.deepEqual(persisted(kb.getClaim(before.id)), persisted(before));
});
test('a failed retraction rolls back the inserted replacement', t => {
  const kb = fixture(t); const original = kb.upsertClaim.bind(kb);
  kb.upsertClaim = input => { if (input.status === 'retracted') throw new Error('injected write failure'); return original(input); };
  assert.throws(() => correctImmigrationSeed(kb, current), /injected write failure/);
  assert.equal(kb.getClaim(claimId(updated.text)), null); assert.notEqual(kb.getClaim(claimId(LEGACY_IMMIGRATION_TEXT)).status, 'retracted');
});
test('a retracted replacement is not revived or used to supersede the old row', t => {
  const kb = fixture(t); kb.upsertClaim({ ...updated, kind: 'seed', provenance: origin, status: 'retracted' });
  assert.equal(correctImmigrationSeed(kb, current).corrected, false); assert.equal(kb.getClaim(claimId(updated.text)).status, 'retracted');
  assert.notEqual(kb.getClaim(claimId(LEGACY_IMMIGRATION_TEXT)).status, 'retracted');
});
test('the correction requires the specific official notice', t => {
  const kb = fixture(t); assert.throws(() => correctImmigrationSeed(kb, [{ ...updated, sources: [] }]), /official notice/);
  assert.notEqual(kb.getClaim(claimId(LEGACY_IMMIGRATION_TEXT)).status, 'retracted');
});
