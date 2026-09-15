// One shared definition of what text names the Isle of Man. Dialogue,
// retrieval, migrations and expeditions all depend on this exact predicate.

export const MANX_ALIASES = Object.freeze([
  "isle of man",
  "manx",
  "mann",
  "ellan vannin",
  "calf of man",
  "tynwald",
  "iom",
]);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MANX_RE = new RegExp(`\\b(?:${MANX_ALIASES.map(escapeRegExp).join("|")})\\b`, "i");

export function isManxText(...values) {
  return MANX_RE.test(values.filter(Boolean).map(String).join(" "));
}

// Towns, parishes and landmarks that place a question on the Island even when
// nobody says "Isle of Man". Used by dialogue scoping only: a claim about
// Douglas the person must not be migrated into the Manx ledger by this.
export const MANX_PLACES = Object.freeze([
  "douglas", "onchan", "ramsey", "peel", "castletown", "port erin", "port st mary", "laxey", "ballasalla",
  // Generic English ("the sound", "andreas") is left out; a false positive here
  // only widens Manx scope, but it should not fire on "the sound settings".
  "kirk michael", "snaefell", "ronaldsway", "tynwald hill", "st john's", "jurby", "maughold", "sulby",
  "foxdale", "ballaugh", "santon", "malew", "arbory", "rushen", "lonan", "lezayre", "marown", "braddan", "glen maye",
  "point of ayre", "calf of man", "cregneash", "castle rushen", "peel castle", "manx utilities", "steam packet",
]);
const MANX_PLACE_RE = new RegExp(`\\b(?:${MANX_PLACES.map(escapeRegExp).join("|")})\\b`, "i");
export function isManxPlaceText(...values) {
  return MANX_PLACE_RE.test(values.filter(Boolean).map(String).join(" "));
}
