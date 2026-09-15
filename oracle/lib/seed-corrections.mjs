import { claimId } from './kb.mjs';

export const LEGACY_IMMIGRATION_TEXT = 'Isle of Man — Immigration, work & residence: Immigration and worker-migrant policy changed from June 2026 for new applications. Implication: Application date and transitional position are material to any current answer.';
export const IMMIGRATION_NOTICE_URL = 'https://www.gov.im/categories/travel-traffic-and-motoring/immigration/latest-immigration-rules-and-associated-policy-notices/';
const correctionKey = 'editorial:worker-migrant-20260912';

/** Supersede only the known Atlas seed; preserve its ID for historical references. */
export function correctImmigrationSeed(kb, currentClaims) {
  const old = kb.getClaim(claimId(LEGACY_IMMIGRATION_TEXT));
  if (!old || old.text !== LEGACY_IMMIGRATION_TEXT || old.kind !== 'seed' || old.provenance.origin !== 'britannica-atlas' || old.status === 'retracted') return { corrected: false };
  const replacement = currentClaims.find(item => item.topic === old.topic && item.text.includes('Worker Migrant rules and associated employer policies changed on 1 June 2026'));
  const source = replacement?.sources.find(item => item.url === IMMIGRATION_NOTICE_URL);
  if (!replacement || !source) throw new Error('The immigration seed correction needs its current text and official notice.');
  const replacementId = claimId(replacement.text);
  const existing = kb.getClaim(replacementId);
  if (existing && (existing.kind !== 'seed' || existing.provenance.origin !== 'britannica-atlas' || !['single_source', 'corroborated', 'verified'].includes(existing.status))) return { corrected: false };
  return kb.transaction(() => {
    const result = kb.upsertClaim({
      ...replacement, sources: [source], kind: 'seed', support: existing ? 0 : 1, contradict: 0,
      ...(existing ? {} : { confidence: 0.82, verifiedAt: null }), evidenceKey: correctionKey,
      provenance: { origin: 'britannica-atlas', editorial: true, supersedes: old.id, correction: correctionKey },
    });
    if (!['single_source', 'corroborated', 'verified'].includes(result.claim.status)) throw new Error('The replacement claim is unavailable.');
    kb.upsertClaim({ text: old.text, status: 'retracted', support: 0, contradict: 0, evidenceKey: correctionKey,
      provenance: { supersededBy: replacementId, correction: correctionKey } });
    return { corrected: true, oldId: old.id, replacementId };
  });
}
