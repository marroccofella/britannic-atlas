export const STATUSES = Object.freeze(["verified", "corroborated", "single_source", "hypothesis", "contested", "retracted", "model_prior", "local"]);

/** Model- and web-written URLs stay inert unless they are absolute web links. */
export function safeExternalHref(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch { return null; }
}

export function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
