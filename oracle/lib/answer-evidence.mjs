// Deterministic evidence boundary for a MOMM-edited answer. Peer agreement may
// improve wording, but it cannot transfer the old evidence grade to new claims.

const STATUS_ORDER = Object.freeze(["model_prior", "hypothesis", "contested", "single_source", "corroborated", "verified"]);

function comparable(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function unit(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : null;
}

export function boundDeliberatedEvidence({ originalAnswer, originalStatus, originalConfidence, revisedAnswer, proposedStatus, proposedConfidence } = {}) {
  const changed = comparable(originalAnswer) !== comparable(revisedAnswer);
  if (changed) return { changed: true, status: "model_prior", confidence: null };

  const originalIndex = STATUS_ORDER.indexOf(originalStatus);
  const proposedIndex = STATUS_ORDER.indexOf(proposedStatus);
  const status = originalIndex < 0
    ? "model_prior"
    : STATUS_ORDER[Math.min(originalIndex, proposedIndex < 0 ? originalIndex : proposedIndex)];
  const original = unit(originalConfidence), proposed = unit(proposedConfidence);
  const confidence = original == null || proposed == null ? null : Math.min(original, proposed);
  return { changed: false, status, confidence };
}
