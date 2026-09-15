// Shared, deterministic conversation/input policy. It never authorises a paid action.
export const MAX_QUESTION_CHARS = 12_000;
export function questionProblem(value) {
  if (typeof value !== "string" || !value.trim()) return "Type a question or say what you would like to know.";
  if (value.length > MAX_QUESTION_CHARS) return `Message too long (${value.length.toLocaleString("en-GB")} / ${MAX_QUESTION_CHARS.toLocaleString("en-GB")} characters). Paste a shorter section; your text has not been sent.`;
  return "";
}
