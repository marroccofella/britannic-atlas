// Browser-side preflight. Known contextual repairs can proceed; genuinely
// uncertain recognition is held for the user before any paid request is sent.

export function suggestSpeechRepair(raw) {
  let text = String(raw || "").normalize("NFKC").replace(/\s+/g, " ").trim();
  text = text.replace(/\bi\s+beed\s+to\b/gi, "I need to");
  text = text.replace(/\b(?:infastructure\w*|infrastruture\w*|infrastucture\w*)\b/gi, "infrastructure");
  text = text.replace(/\bcaoacity\b/gi, "capacity").replace(/\bunfo\b/gi, "info");
  text = text.replace(/\b(draw|show|open|view)\s+(me\s+)?(a|the)\s+mao\b/gi, "$1 $2$3 map");
  if (/\b(?:all|akk|info|unfo)\b/i.test(raw)) text = text.replace(/\bmanz\b/gi, "Manx").replace(/\bakk\b/gi, "all");
  return text;
}

export function assessSpeech(raw, confidence) {
  const original = String(raw || "").replace(/\s+/g, " ").trim();
  const suggested = suggestSpeechRepair(original);
  const repaired = suggested.toLowerCase() !== original.toLowerCase();
  const numeric = Number(confidence);
  const hasConfidence = confidence != null && confidence !== "" && Number.isFinite(numeric);
  return {
    original,
    suggested,
    repaired,
    confidence: hasConfidence ? numeric : null,
    needsConfirmation: !repaired && hasConfidence && numeric < 0.55,
  };
}
