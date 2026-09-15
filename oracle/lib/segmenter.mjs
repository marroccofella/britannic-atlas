// Streaming sentence segmentation for speech, plus a guard that keeps the
// trailing <<meta>> JSON block out of the spoken stream.

export const META_MARKER = "<<meta>>";

const ABBREVIATIONS = /(?:^|\s|\()(?:Mr|Mrs|Ms|Dr|St|Prof|Sir|Hon|Rev|Lt|Col|Gen|Capt|Sgt|No|Nos|vs|etc|cf|Jr|Sr|Ltd|Inc|Co|Corp|approx|ca|fig|vol|pp|p|Rt|Bt|Messrs|Mme|Mlle|Ph\.D|e\.g|i\.e|a\.m|p\.m|U\.K|U\.S|U\.N|H\.M)\.$/i;

function isBoundary(buf, i) {
  // buf[i] is one of . ! ?
  const before = buf.slice(0, i + 1);
  const ch = buf[i];
  if (ch === ".") {
    if (/\d\.$/.test(before) && /^\d/.test(buf.slice(i + 1))) return false;         // 3.5
    if (ABBREVIATIONS.test(before)) return false;                                       // Mr.
    if (/(?:^|\s)[A-Z]\.$/.test(before)) return false;                                  // initials: J. Smith
    if (/\.\.$/.test(before) && buf[i + 1] === ".") return false;                        // inside an ellipsis
  }
  let j = i + 1;
  while (j < buf.length && /["'”’)\]]/.test(buf[j])) j += 1;
  if (j >= buf.length) return false;            // need to see what follows before deciding
  return /\s/.test(buf[j]) ? j : false;
}

export class SentenceSegmenter {
  constructor({ minLength = 12 } = {}) { this.buf = ""; this.minLength = minLength; }
  push(delta) {
    this.buf += delta;
    const out = [];
    for (;;) {
      let cut = -1;
      const para = this.buf.indexOf("\n\n");
      for (let i = 0; i < this.buf.length; i += 1) {
        if (para >= 0 && i > para) break;
        if (!/[.!?]/.test(this.buf[i])) continue;
        const end = isBoundary(this.buf, i);
        if (end !== false && end >= this.minLength) { cut = end; break; }
      }
      if (cut < 0 && para >= 0) cut = para + 2;
      if (cut < 0) break;
      const sentence = this.buf.slice(0, cut).trim();
      this.buf = this.buf.slice(cut);
      if (sentence) out.push(sentence);
    }
    return out;
  }
  flush() { const rest = this.buf.trim(); this.buf = ""; return rest ? [rest] : []; }
}

/** Splits streamed text into spoken text and the trailing meta JSON, safely across chunk boundaries. */
export class MetaGuard {
  constructor() { this.spoken = ""; this.meta = ""; this.pending = ""; this.inMeta = false; }
  push(delta) {
    if (this.inMeta) { this.meta += delta; return ""; }
    this.pending += delta;
    const idx = this.pending.indexOf(META_MARKER);
    if (idx >= 0) {
      const safe = this.pending.slice(0, idx);
      this.meta = this.pending.slice(idx + META_MARKER.length);
      this.pending = ""; this.inMeta = true; this.spoken += safe;
      return safe;
    }
    // hold back any suffix that could be the start of the marker
    let hold = 0;
    for (let k = Math.min(META_MARKER.length - 1, this.pending.length); k > 0; k -= 1) {
      if (META_MARKER.startsWith(this.pending.slice(-k))) { hold = k; break; }
    }
    const safe = hold ? this.pending.slice(0, -hold) : this.pending;
    this.pending = hold ? this.pending.slice(-hold) : "";
    this.spoken += safe;
    return safe;
  }
  flush() { const safe = this.pending; this.pending = ""; this.spoken += safe; return safe; }
}

export function parseMeta(raw) {
  if (!raw) return null;
  const start = raw.indexOf("{"); const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

/** Light cleanup so the synthesiser does not read markdown or URLs aloud. */
export function speakable(text) {
  return text
    .replace(/\[(c_[a-z0-9]+)\]/gi, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_`#>]+/g, "")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
