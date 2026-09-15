import {evidenceCurrent} from './evidence-ledger.mjs';
// Provenance-gated belief ledger on Node's built-in SQLite (FTS5 for retrieval).
//
// A claim's status is *derived* from evidence, never asserted by a model:
//   verified      two confirmed routes (cited pages read and found to carry the
//                 claim), one of them a primary/official publisher
//   corroborated  two or more distinct publishers cited, not yet both confirmed
//   single_source one publisher, however many of its pages are cited
//   hypothesis    no readable source yet (lateral thinking, or every cited page gone)
//   contested     contradictions equal or outnumber support
//   retracted     withdrawn
// Trust decays with age at a half-life set by the claim's volatility, and is
// nudged by an attention ledger (was this claim useful in past answers?).

import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isManxText } from "./scope.mjs";

export { isManxText } from "./scope.mjs";

export const STATUS_WEIGHT = { verified: 1, corroborated: 0.82, single_source: 0.58, hypothesis: 0.3, contested: 0.35, retracted: 0 };
export const HALF_LIFE_DAYS = { structural: 1460, periodic: 180, live: 30 };
export const STATUS_RANK = ["retracted", "hypothesis", "contested", "single_source", "corroborated", "verified"];
export const CLAIM_VIEWS = Object.freeze({
  answer: Object.freeze(["single_source", "corroborated", "verified"]),
  promoted: Object.freeze(["corroborated", "verified"]),
  all: Object.freeze([...STATUS_RANK]),
});

const PRIMARY_DOMAINS = [
  "gov.uk", "gov.im", "gov.je", "gov.gg", "gov.ky", "gov.bm", "gov.gi", "gov.fk",
  "parliament.uk", "tynwald.org.im", "judgments.im", "iomfsa.im", "gfsc.gg",
  "jerseyfsc.org", "thecommonwealth.org", "un.org", "bailii.org", "royal.uk",
  "bankofengland.co.uk", "courts.im", "tynwald.im", "manxnationalheritage.im", "iomshipregistry.com",
  "iomaircraftregistry.com", "iomdfenterprise.im", "manxutilities.im", "legislation.gov.uk", "ons.gov.uk",
];
const PRIMARY_PUBLIC_SUFFIXES = ["gov", "ac.uk", "gc.ca", "gov.au", "govt.nz"];

// ---- independence of evidence routes ----
// Two citations are one route when the same publisher stands behind both. One
// government is one publisher however many subdomains it runs, and a tracking
// parameter or a sibling page never manufactures a second route.
const GOVERNMENT_SECOND_LEVEL = new Set(["gov", "gc", "govt"]);
const SHARED_SECOND_LEVEL = new Set(["org", "co", "ac", "net", "com", "edu", "nhs", "police", "sch", "me", "ltd", "plc"]);
export function registrableDomain(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/\.$/, "");
    const parts = host.split(".").filter(Boolean);
    if (parts.length < 2) return host || null;
    const sld = parts.at(-2), tld = parts.at(-1);
    if (GOVERNMENT_SECOND_LEVEL.has(sld) && tld.length === 2) return `${sld}.${tld}`;
    if (tld.length === 2 && SHARED_SECOND_LEVEL.has(sld) && parts.length >= 3) return parts.slice(-3).join(".");
    return parts.slice(-2).join(".");
  } catch { return null; }
}
/** Outcomes a source check can record; see lib/source-verification.mjs. */
export const VERIFICATION_STATUSES = Object.freeze(["confirmed", "unmatched", "blocked", "missing", "unreachable", "unverifiable"]);
function boundVerification(value) {
  if (!value || typeof value !== "object" || !VERIFICATION_STATUSES.includes(value.status)) return null;
  const out = { status: value.status, checkedAt: Number.isFinite(Date.parse(value.checkedAt)) ? String(value.checkedAt) : nowIso() };
  if (typeof value.sha256 === "string" && /^[a-f0-9]{16,64}$/.test(value.sha256)) out.sha256 = value.sha256;
  if (Number.isFinite(Number(value.matched))) out.matched = Number(value.matched);
  if (typeof value.finalUrl === "string" && /^https?:\/\//.test(value.finalUrl)) out.finalUrl = value.finalUrl.slice(0, 500);
  if (typeof value.detail === "string" && value.detail) out.detail = value.detail.slice(0, 200);
  if (["reader", "browser", "archive"].includes(value.via)) out.via = value.via;
  if (Number.isFinite(Date.parse(value.snapshotAt))) out.snapshotAt = String(value.snapshotAt).slice(0, 40);
  if (typeof value.liveOutcome === "string" && value.liveOutcome) out.liveOutcome = value.liveOutcome.slice(0, 40);
  return out;
}
/** An archived-copy note on a live-read source: when the snapshot was taken and where it lives. */
function boundArchived(value) {
  if (!value || typeof value !== "object" || !Number.isFinite(Date.parse(value.snapshotAt)) || typeof value.archiveUrl !== "string" || !/^https:\/\/web\.archive\.org\//.test(value.archiveUrl)) return null;
  return { snapshotAt: String(value.snapshotAt).slice(0, 40), archiveUrl: value.archiveUrl.slice(0, 600), ...(typeof value.liveOutcome === "string" ? { liveOutcome: value.liveOutcome.slice(0, 40) } : {}) };
}
const liveSource = (source) => Boolean(source?.url) && source.verification?.status !== "missing";
/** Distinct publishers still standing behind a claim. */
export function sourceRoutes(sources = []) { return new Set(sources.filter(liveSource).map((s) => registrableDomain(s.url)).filter(Boolean)); }
/** Distinct publishers whose cited page has been read and found to carry the claim. */
export function confirmedRoutes(sources = []) { return new Set(sources.filter((s) => s?.verification?.status === "confirmed").map((s) => registrableDomain(confirmedUrl(s))).filter(Boolean)); }
/** Where a confirmed citation actually resolved: two citations that redirect to one page are one route. */
export function confirmedUrl(source) { return source?.verification?.finalUrl || source?.url; }
const STOPWORDS = new Set("a an the and or of to in on for with is are was were be been by at from as that this these those it its what who whom whose which when where why how does do did can could would should will shall may might about into over under out between than then there their they them he she his her we our you your i me my not no yes tell say said explain describe please give".split(" "));

// Retrieval and trust tuning, named rather than scattered as magic numbers.
export const BM25_WEIGHTS = { text: 3.0, topic: 1.0 };
export const TRUST = { decayFloor: 0.2, decaySpan: 0.8, attentionFloor: 0.75, attentionSpan: 0.5, relevanceFloor: 0.4, relevanceSpan: 0.6 };
// A reviewer that agrees while declaring near-zero confidence is not evidence.
export const MIN_AGREEMENT_CONFIDENCE = 0.3;
export const GAP_RETRY_BASE_MS = 15 * 60_000;
export const GAP_RETRY_MAX_MS = 24 * 60 * 60_000;
export const GAP_AUTO_ATTEMPT_LIMIT = 5;

export function claimId(text) { return "c_" + createHash("sha1").update(String(text).toLowerCase().replace(/\s+/g, " ").trim()).digest("hex").slice(0, 10); }

/**
 * Identifies one contribution of evidence so the same evidence cannot be
 * counted twice. Callers may pass an explicit key; otherwise the key is a hash
 * of the source URLs and the counts, making re-ingestion idempotent.
 */
export function evidenceKey({ explicit, sources = [], support = 0, contradict = 0 }) {
  if (explicit) return String(explicit).slice(0, 80);
  const urls = sources.map((s) => s.url).sort();
  return "ev_" + createHash("sha1").update(JSON.stringify([urls, support, contradict])).digest("hex").slice(0, 12);
}
const newId = (p) => `${p}_${randomBytes(5).toString("hex")}`;
const nowIso = () => new Date().toISOString();

export function isPrimarySource(source) {
  if (!source) return false;
  // Only the publisher's domain makes a source primary; a caller's say-so does not.
  try {
    const host = new URL(source.url).hostname.toLowerCase().replace(/\.$/, "");
    const matches = (domain) => host === domain || host.endsWith("." + domain);
    return PRIMARY_DOMAINS.some(matches) || PRIMARY_PUBLIC_SUFFIXES.some((suffix) => host.endsWith("." + suffix));
  } catch { return false; }
}

export function deriveStatus({ sources = [], support = 0, contradict = 0, kind = "learned", provenance = {} }) {
  if (contradict > 0 && contradict >= support) return "contested";
  // A cited page that has gone is no longer a route.
  const live = (Array.isArray(sources) ? sources : []).filter(liveSource);
  // Evidence nobody here has read cannot verify: a source excerpt, a model's
  // research finding, or several models agreeing. Their status is capped at
  // single_source however many agree. Editorial seed claims are exempt: a
  // research pass that re-finds a corpus sentence is no reason to doubt it.
  const unverifiedByUs = kind === "source_excerpt" || kind === "momm" || provenance.origin === "momm-deliberation"
    || ((provenance.expedition || provenance.modelResearch) && kind !== "seed");
  if (unverifiedByUs) return live.length ? "single_source" : "hypothesis";
  // "verified" is earned by reading: two distinct publishers whose cited pages
  // were fetched and found to carry the claim, one of them primary.
  const routes = sourceRoutes(live), confirmed = confirmedRoutes(live);
  const primaryConfirmed = live.some((s) => s.verification?.status === "confirmed" && isPrimarySource({ url: confirmedUrl(s) }));
  if (primaryConfirmed && confirmed.size >= 2 && support >= 2) return "verified";
  if (routes.size >= 2 && support >= 2) return "corroborated";
  if (live.length > 0) return "single_source";
  return "hypothesis";
}

export function tokens(text) {
  const cleaned = String(text).toLowerCase().replace(/\bfigure\s+(?:it\s+)?out\b/g, " ");
  return cleaned.replace(/[’']/g, "").split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}
const stem = (t) => (t.length >= 6 ? t.slice(0, 5) : t);

export function ftsQuery(text) {
  const ts = [...new Set(tokens(text).map(stem))];
  if (!ts.length) return null;
  return ts.map((t) => (t.length >= 5 ? `"${t}"*` : `"${t}"`)).join(" OR ");
}

function manxWhere(prefix = "") {
  const p = prefix ? prefix + "." : "";
  return p + "jurisdiction='IM'";
}
/** A source excerpt is evidence only until it expires; everything else has no expiry. */
export function currentEvidenceWhere(prefix = "") {
  const p = prefix ? prefix + "." : "";
  return `(${p}kind<>'source_excerpt' OR (json_valid(${p}provenance) AND json_extract(${p}provenance,'$.sourceEvidence.expiresAt') > strftime('%Y-%m-%dT%H:%M:%fZ','now')))`;
}

function normaliseJurisdiction(value) {
  const text = String(value || "").trim().toLowerCase();
  return ["im", "iom", "isle of man", "manx", "mann", "ellan vannin"].includes(text) ? "IM" : (text ? text.toUpperCase() : null);
}

export function retryDelayMs(attemptCount) {
  const exponent = Math.max(0, Math.floor(Number(attemptCount) || 1) - 1);
  return Math.min(GAP_RETRY_BASE_MS * (2 ** exponent), GAP_RETRY_MAX_MS);
}

export function trust(claim, now = Date.now()) {
  const weight = STATUS_WEIGHT[claim.status] ?? 0.3;
  const half = HALF_LIFE_DAYS[claim.volatility] ?? HALF_LIFE_DAYS.structural;
  const anchor = Date.parse(claim.verified_at || claim.created_at || nowIso());
  const days = Math.max(0, (now - anchor) / 86_400_000);
  const decay = Math.pow(0.5, days / half);
  const attention = (1 + (claim.helpful || 0)) / (2 + (claim.helpful || 0) + (claim.unhelpful || 0));
  const boost = TRUST.attentionFloor + TRUST.attentionSpan * attention;
  return Math.max(0, weight * Number(claim.confidence || 0) * (TRUST.decayFloor + TRUST.decaySpan * decay) * boost);
}

export function coverageFor(question, claimTexts) {
  const q = [...new Set(tokens(question).map(stem))];
  if (!q.length) return { ratio: 0, level: "none" };
  const hay = new Set(tokens(claimTexts.join(" ")).map(stem));
  const hit = q.filter((t) => hay.has(t)).length;
  const ratio = hit / q.length;
  return { ratio, level: ratio >= 0.6 ? "strong" : ratio >= 0.25 ? "thin" : "none" };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS claims(
  id TEXT PRIMARY KEY, text TEXT NOT NULL, topic TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'learned',
  status TEXT NOT NULL DEFAULT 'single_source', confidence REAL NOT NULL DEFAULT 0.5, volatility TEXT NOT NULL DEFAULT 'structural', jurisdiction TEXT,
  support INTEGER NOT NULL DEFAULT 0, contradict INTEGER NOT NULL DEFAULT 0,
  sources TEXT NOT NULL DEFAULT '[]', provenance TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL, verified_at TEXT, last_used_at TEXT,
  use_count INTEGER NOT NULL DEFAULT 0, helpful INTEGER NOT NULL DEFAULT 0, unhelpful INTEGER NOT NULL DEFAULT 0);
CREATE VIRTUAL TABLE IF NOT EXISTS claims_fts USING fts5(text, topic, content='claims', content_rowid='rowid');
CREATE TRIGGER IF NOT EXISTS claims_ai AFTER INSERT ON claims BEGIN INSERT INTO claims_fts(rowid,text,topic) VALUES (new.rowid,new.text,new.topic); END;
CREATE TRIGGER IF NOT EXISTS claims_ad AFTER DELETE ON claims BEGIN INSERT INTO claims_fts(claims_fts,rowid,text,topic) VALUES('delete',old.rowid,old.text,old.topic); END;
CREATE TRIGGER IF NOT EXISTS claims_au AFTER UPDATE ON claims BEGIN INSERT INTO claims_fts(claims_fts,rowid,text,topic) VALUES('delete',old.rowid,old.text,old.topic); INSERT INTO claims_fts(rowid,text,topic) VALUES (new.rowid,new.text,new.topic); END;
CREATE TABLE IF NOT EXISTS episodes(id TEXT PRIMARY KEY, session_id TEXT, question TEXT, resolved_question TEXT, jurisdiction TEXT, answer TEXT, confidence REAL, status TEXT, claims_used TEXT, model TEXT, duration_ms INTEGER, cost_usd REAL, feedback INTEGER, created_at TEXT);
CREATE TABLE IF NOT EXISTS expeditions(id TEXT PRIMARY KEY, question TEXT, reason TEXT, strategies TEXT, jurisdiction TEXT, session_id TEXT,
  mode TEXT NOT NULL DEFAULT 'deep', progress TEXT NOT NULL DEFAULT '{}', preview TEXT,
  status TEXT, summary TEXT, learned TEXT, cost_usd REAL, duration_ms INTEGER, created_at TEXT, finished_at TEXT);
CREATE TABLE IF NOT EXISTS gaps(id TEXT PRIMARY KEY, question TEXT, reason TEXT, created_at TEXT, resolved_at TEXT, expedition_id TEXT,
  jurisdiction TEXT, attempt_count INTEGER NOT NULL DEFAULT 0, last_attempt_at TEXT, next_attempt_at TEXT, last_outcome TEXT, last_error TEXT);
CREATE TABLE IF NOT EXISTS calibration(bucket INTEGER PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0, hits INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);
CREATE INDEX IF NOT EXISTS episodes_session ON episodes(session_id, created_at);
`;

const parseJson = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };
const EXPEDITION_MODES = new Set(["official_sources", "sources", "deep"]);
function expeditionMode(value) { return EXPEDITION_MODES.has(value) ? value : "deep"; }
function expeditionSessionId(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 80) return null;
  return value;
}
function boundedJson(value, maxLength = 64_000) {
  try {
    const encoded = JSON.stringify(value);
    return typeof encoded === "string" && encoded.length <= maxLength ? encoded : null;
  } catch { return null; }
}
function jsonForDb(value, fallback, maxLength = 64_000) {
  return boundedJson(value ?? fallback, maxLength) ?? JSON.stringify(fallback);
}
function ensureColumn(db, table, name, definition) {
  const columns = new Set(db.prepare("PRAGMA table_info(" + table + ")").all().map((row) => row.name));
  if (!columns.has(name)) db.exec("ALTER TABLE " + table + " ADD COLUMN " + name + " " + definition);
}
function rowToClaim(row) {
  if (!row) return null;
  const c = { ...row, sources: parseJson(row.sources, []), provenance: parseJson(row.provenance, {}) };
  if(c.kind==='source_excerpt'){if(['verified','corroborated'].includes(c.status))c.status=c.sources.length?'single_source':'hypothesis';const e=c.provenance.sourceEvidence||{};Object.assign(c,{evidenceKind:'source_excerpt',fetchedAt:e.fetchedAt,publishedAt:e.publishedAt,expiresAt:e.expiresAt,contentHash:e.sha256});}
  if((c.provenance.expedition||c.provenance.modelResearch)&&c.kind!=='seed'){c.evidenceKind='research_finding';if(['verified','corroborated'].includes(c.status))c.status='single_source';c.evidenceNote='Model-researched, source-linked finding; claim support has not been independently verified.';}
  if(c.kind==='momm'||c.provenance.origin==='momm-deliberation'){c.evidenceKind='peer_agreement';if(['verified','corroborated'].includes(c.status))c.status='single_source';c.evidenceNote='Independent models agreed with this; agreement is not a source and the citation has not been independently read.';}
  c.trust = trust(c);
  return c;
}
export function rowToExpedition(row) {
  if (!row) return null;
  const progress = parseJson(row.progress, {});
  const strategies = parseJson(row.strategies, []);
  const learned = parseJson(row.learned, []);
  const preview = row.preview == null ? null : parseJson(row.preview, null);
  return {
    ...row,
    session_id: expeditionSessionId(row.session_id),
    mode: expeditionMode(row.mode),
    strategies: Array.isArray(strategies) ? strategies : [],
    learned: Array.isArray(learned) ? learned : [],
    progress: progress && typeof progress === "object" && !Array.isArray(progress) ? progress : {},
    preview: preview && typeof preview === "object" && !Array.isArray(preview) ? preview : null,
  };
}
function provenanceQuestion(value) {
  const parsed = typeof value === "string" ? parseJson(value, {}) : value;
  return typeof parsed?.question === "string" ? parsed.question : "";
}
function clamp01(x) { const n = Number(x); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5; }
/** A topic is a label: no markup, no control characters, one line, bounded. */
export function cleanTopic(value) {
  const unmarked = String(value || "").replace(/<(script|style)[^>]*>[\s\S]*?<\/\1\s*>/gi, " ").replace(/<[^>]*>?/g, " ");
  const printable = [...unmarked].map((c) => { const code = c.charCodeAt(0); return code < 32 || code === 127 ? " " : c; }).join("");
  return printable.replace(/\s+/g, " ").trim().slice(0, 160);
}

export class KnowledgeBase {
  constructor(file = ":memory:") {
    if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;");
    // Derived indexes (the vector store) follow the ledger through these.
    this.listeners = new Set();
    this.db.function("oracle_is_manx", (value) => isManxText(value) ? 1 : 0);
    this.db.function("oracle_provenance_question", provenanceQuestion);
    this.db.exec(SCHEMA);
    ensureColumn(this.db, "claims", "jurisdiction", "TEXT");
    ensureColumn(this.db, "episodes", "resolved_question", "TEXT");
    ensureColumn(this.db, "episodes", "jurisdiction", "TEXT");
    ensureColumn(this.db, "episodes", "source_excerpts", "TEXT NOT NULL DEFAULT '[]'");
    ensureColumn(this.db, "episodes", "retrieval_mode", "TEXT");
    ensureColumn(this.db, "expeditions", "jurisdiction", "TEXT");
    ensureColumn(this.db, "expeditions", "session_id", "TEXT");
    ensureColumn(this.db, "expeditions", "mode", "TEXT NOT NULL DEFAULT 'deep'");
    ensureColumn(this.db, "expeditions", "progress", "TEXT NOT NULL DEFAULT '{}'");
    ensureColumn(this.db, "expeditions", "preview", "TEXT");
    ensureColumn(this.db, "gaps", "jurisdiction", "TEXT");
    ensureColumn(this.db, "gaps", "attempt_count", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn(this.db, "gaps", "last_attempt_at", "TEXT");
    ensureColumn(this.db, "gaps", "next_attempt_at", "TEXT");
    ensureColumn(this.db, "gaps", "last_outcome", "TEXT");
    ensureColumn(this.db, "gaps", "last_error", "TEXT");
    this.db.exec(`UPDATE claims SET jurisdiction='IM' WHERE jurisdiction IS NULL AND oracle_is_manx(COALESCE(text,'') || ' ' || COALESCE(topic,'') || ' ' || oracle_provenance_question(provenance))=1;
      UPDATE claims SET status='single_source' WHERE status IN ('verified','corroborated') AND (kind IN ('source_excerpt','momm') OR (kind<>'seed' AND CASE WHEN json_valid(provenance) THEN json_extract(provenance,'$.expedition') IS NOT NULL OR json_extract(provenance,'$.modelResearch')=1 OR json_extract(provenance,'$.origin')='momm-deliberation' ELSE 0 END));
      UPDATE claims SET support=2 WHERE kind='seed' AND status<>'retracted' AND support>2 AND json_valid(provenance) AND json_extract(provenance,'$.origin')='britannica-atlas' AND json_extract(provenance,'$.evidence_keys') LIKE '%"seed:1"%' AND json_extract(provenance,'$.evidence_keys') LIKE '%"seed:2"%';
      UPDATE gaps SET jurisdiction='IM' WHERE jurisdiction IS NULL AND oracle_is_manx(COALESCE(question,'') || ' ' || COALESCE(reason,''))=1;
      UPDATE expeditions SET mode='deep' WHERE mode IS NULL OR TRIM(mode)='';
      UPDATE expeditions SET progress='{}' WHERE progress IS NULL OR TRIM(progress)='';
      CREATE INDEX IF NOT EXISTS gaps_scope_retry ON gaps(jurisdiction,resolved_at,next_attempt_at,created_at);
      CREATE INDEX IF NOT EXISTS claims_scope_status ON claims(jurisdiction,status,kind);
      CREATE INDEX IF NOT EXISTS episodes_resolved_created ON episodes(resolved_question,created_at);
      CREATE INDEX IF NOT EXISTS expeditions_session_created ON expeditions(session_id,created_at DESC);
      DROP TRIGGER IF EXISTS claims_au;
      CREATE TRIGGER claims_au AFTER UPDATE OF text,topic ON claims BEGIN
        INSERT INTO claims_fts(claims_fts,rowid,text,topic) VALUES('delete',old.rowid,old.text,old.topic);
        INSERT INTO claims_fts(rowid,text,topic) VALUES (new.rowid,new.text,new.topic);
      END;`);
    this.lastStatusMigration = this.migrateStatusRules();
    // Labels written before topics were cleaned may carry markup from a probe.
    const cleanTopicStatement = this.db.prepare("UPDATE claims SET topic=? WHERE id=?");
    for (const row of this.db.prepare("SELECT id, topic FROM claims WHERE topic LIKE '%<%'").all()) cleanTopicStatement.run(cleanTopic(row.topic), row.id);
    // The full-text index is keyed on claims' rowid, which a VACUUM can
    // renumber because the table's primary key is text. Check the index
    // against the rows on every open and rebuild it when they have parted.
    try { this.db.exec("INSERT INTO claims_fts(claims_fts, rank) VALUES('integrity-check', 1)"); }
    catch { this.db.exec("INSERT INTO claims_fts(claims_fts) VALUES('rebuild')"); }
  }
  close() { this.db.close(); }
  count() { return this.db.prepare("SELECT COUNT(*) n FROM claims").get().n; }
  getMeta(key) { return this.db.prepare("SELECT value FROM meta WHERE key=?").get(key)?.value ?? null; }
  setMeta(key, value) { this.db.prepare("INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, String(value)); }

  getClaim(id) { return rowToClaim(this.db.prepare("SELECT * FROM claims WHERE id=?").get(id)); }

  /**
   * Subscribe to claim writes so a derived index can follow the ledger instead
   * of drifting until someone remembers a manual rebuild. Returns an
   * unsubscribe function. A listener that throws never breaks the write: the
   * ledger is the source of truth and the index is rebuildable from it.
   */
  onClaimChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  notifyClaimChange(id, change) {
    for (const fn of this.listeners) { try { fn({ id, change }); } catch { /* derived index failure is reported by its own status, never here */ } }
  }

  /** Insert or merge a claim. Returns { claim, created }. */
  upsertClaim(input) {
    const text = String(input.text || "").replace(/\s+/g, " ").trim();
    if (text.length < 12) throw new Error("claim text too short");
    const sources = (Array.isArray(input.sources)?input.sources:[]).filter((s) => s && typeof s.url === "string" && /^https?:\/\//.test(s.url)).map((s) => ({ url: s.url, title: String(s.title || s.url).slice(0, 200), publisher: String(s.publisher || "").slice(0, 120), primary: isPrimarySource(s), ...(boundVerification(s.verification) ? { verification: boundVerification(s.verification) } : {}), ...(boundArchived(s.archived) ? { archived: boundArchived(s.archived) } : {}) }));
    // Keep new source records separate by exact source/page and case-sensitive text.
    // A sound legacy record for the SAME source keeps its ID and episode links.
    const identityUrls=[...new Set(sources.map(s=>s.url))].sort();
    let id = input.kind==='source_excerpt'
      ? 'c_'+createHash('sha256').update(JSON.stringify(['source_excerpt',text,identityUrls])).digest('hex').slice(0,24)
      : claimId(text);
    if(input.kind==='source_excerpt'&&!this.getClaim(id)){
      const legacy=this.getClaim(claimId(text)),fetched=Date.parse(legacy?.provenance?.sourceEvidence?.fetchedAt);
      if(legacy?.kind==='source_excerpt'&&legacy.text===text&&JSON.stringify([...new Set(legacy.sources.map(s=>s.url))].sort())===JSON.stringify(identityUrls)&&evidenceCurrent(legacy,fetched))id=legacy.id;
    }
    const existing = this.getClaim(id);
    const now = nowIso();
    const addSupport = Number(input.support ?? (sources.length ? 1 : 0));
    const addContradict = Number(input.contradict ?? 0);
    const key = evidenceKey({ explicit: input.evidenceKey, sources, support: addSupport, contradict: addContradict });
    const jurisdiction = normaliseJurisdiction(input.jurisdiction) || (isManxText(text, input.topic) ? "IM" : null);
    if (!existing) {
      const status = input.status === "retracted" ? "retracted" : deriveStatus({ sources, support: addSupport, contradict: addContradict, kind: input.kind, provenance: input.provenance });
      const provenance = { ...(input.provenance || {}), evidence_keys: [key] };
      this.db.prepare(`INSERT INTO claims(id,text,topic,kind,status,confidence,volatility,jurisdiction,support,contradict,sources,provenance,created_at,verified_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, text, cleanTopic(input.topic), input.kind || "learned", status, clamp01(input.confidence ?? 0.5), input.volatility || "structural", jurisdiction, addSupport, addContradict, JSON.stringify(sources), JSON.stringify(provenance), now, input.verifiedAt || (status === "verified" || status === "corroborated" ? now : null));
      this.notifyClaimChange(id, "create");
      return { claim: this.getClaim(id), created: true };
    }
    const mergedSources = [...existing.sources];
    for (const s of sources) {
      const seen = mergedSources.find((m) => m.url === s.url);
      if (!seen) mergedSources.push(s);
      else if (s.verification && (!seen.verification || Date.parse(s.verification.checkedAt) >= Date.parse(seen.verification.checkedAt))) seen.verification = s.verification;
    }
    // The same evidence seen twice is still one piece of evidence. Without this
    // guard, re-researching a topic would inflate a claim to "verified" on its
    // own repetition.
    const seenKeys = Array.isArray(existing.provenance.evidence_keys) ? existing.provenance.evidence_keys : [];
    const duplicate = seenKeys.includes(key);
    const support = duplicate ? existing.support : existing.support + addSupport;
    const contradict = duplicate ? existing.contradict : existing.contradict + addContradict;
    const status = existing.status === "retracted" || input.status === "retracted" ? "retracted" : deriveStatus({ sources: mergedSources, support, contradict, kind: existing.kind, provenance: {...existing.provenance,...input.provenance} });
    const confidence = clamp01(input.confidence != null ? 0.5 * existing.confidence + 0.5 * input.confidence : existing.confidence);
    const provenance = { ...existing.provenance, ...(input.provenance || {}), merges: (existing.provenance.merges || 0) + 1, evidence_keys: duplicate ? seenKeys : [...seenKeys, key] };
    // The verification date moves only with fresh evidence, or to a date the
    // caller vouches for (the corpus review date on a re-seed). A merge that
    // adds nothing must not reset trust decay or claim a recent check.
    const freshEvidence = !duplicate && addSupport > 0;
    const verifiedAt = input.verifiedAt || (freshEvidence && (status === "verified" || status === "corroborated") ? now : existing.verified_at);
    this.db.prepare("UPDATE claims SET status=?, confidence=?, support=?, contradict=?, sources=?, provenance=?, verified_at=?, topic=CASE WHEN topic='' THEN ? ELSE topic END, jurisdiction=COALESCE(jurisdiction,?) WHERE id=?")
      .run(status, confidence, support, contradict, JSON.stringify(mergedSources), JSON.stringify(provenance), verifiedAt, cleanTopic(input.topic), jurisdiction, id);
    this.notifyClaimChange(id, "merge");
    return { claim: this.getClaim(id), created: false };
  }

  /**
   * Seed claims mirror the corpus, so their citations are replaced rather than
   * merged: a URL the corpus has since corrected must not survive a re-seed.
   * Restricted to the given kind so learned and reviewed evidence is untouched.
   */
  replaceSources(id, sources, { kind = "seed" } = {}) {
    const c = this.getClaim(id); if (!c || c.kind !== kind) return null;
    // A citation the corpus still carries keeps the record of its last check.
    const checked = new Map(c.sources.filter((s) => s.verification).map((s) => [s.url, s.verification]));
    const clean = (Array.isArray(sources) ? sources : [])
      .filter((s) => s && typeof s.url === "string" && /^https?:\/\//.test(s.url))
      .map((s) => ({ url: s.url, title: String(s.title || s.url).slice(0, 200), publisher: String(s.publisher || "").slice(0, 120), primary: isPrimarySource(s), ...(checked.get(s.url) ? { verification: checked.get(s.url) } : {}) }));
    if (!clean.length) return c;
    const status = c.status === "retracted" ? "retracted" : deriveStatus({ sources: clean, support: c.support, contradict: c.contradict, kind: c.kind, provenance: c.provenance });
    this.db.prepare("UPDATE claims SET sources=?, status=? WHERE id=?").run(JSON.stringify(clean), status, id);
    this.notifyClaimChange(id, "sources");
    return this.getClaim(id);
  }

  contradictClaim(id, note, agent = "unknown") {
    const c = this.getClaim(id); if (!c) return null;
    const contradict = c.contradict + 1;
    const status = c.status === "retracted" ? "retracted" : deriveStatus({ sources: c.sources, support: c.support, contradict, kind: c.kind, provenance: c.provenance });
    const provenance = { ...c.provenance, contradictions: [...(c.provenance.contradictions || []), { agent, note: String(note).slice(0, 300), at: nowIso() }].slice(-10) };
    this.db.prepare("UPDATE claims SET contradict=?, status=?, provenance=? WHERE id=?").run(contradict, status, JSON.stringify(provenance), id);
    this.notifyClaimChange(id, "contradict");
    return this.getClaim(id);
  }

  search(query, { limit = 12, jurisdiction, allowedStatuses = CLAIM_VIEWS.answer } = {}) {
    const q = ftsQuery(query); if (!q) return [];
    let rows;
    try {
      const scope = normaliseJurisdiction(jurisdiction) === "IM" ? " AND " + manxWhere("c") : "";
      const states = [...new Set((Array.isArray(allowedStatuses) ? allowedStatuses : CLAIM_VIEWS.answer).filter((s) => STATUS_RANK.includes(s)))];
      if (!states.length) return [];
      const slots = states.map(() => "?").join(",");
      // Expired source excerpts are filtered in SQL, before the LIMIT: forty
      // stale weather readings were filling every slot ahead of the one
      // current one and the JS filter after the LIMIT found nothing left.
      const sql = "SELECT c.*, bm25(claims_fts, " + BM25_WEIGHTS.text + ", " + BM25_WEIGHTS.topic + ") AS bm FROM claims_fts JOIN claims c ON c.rowid = claims_fts.rowid WHERE claims_fts MATCH ? AND c.status IN (" + slots + ")" + scope + " AND " + currentEvidenceWhere("c") + " ORDER BY bm LIMIT ?";
      rows = this.db.prepare(sql).all(q, ...states, limit * 3);
    } catch { return []; }
    if (!rows.length) return [];
    const maxRel = Math.max(...rows.map((r) => -r.bm)) || 1;
    return rows.map((r) => { const c = rowToClaim(r); c.relevance = -r.bm / maxRel; c.score = c.relevance * (TRUST.relevanceFloor + TRUST.relevanceSpan * Math.min(1, c.trust)); return c; })
      .filter(c=>evidenceCurrent(c)).sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /** Pick the claims worth loading into the model's "brain space" for this question, within a token budget. */
  focus(question, { budgetTokens = 2200, limit = 14, jurisdiction } = {}) {
    const ranked = this.search(question, { limit, jurisdiction });
    const chosen = []; let used = 0;
    for (const c of ranked) {
      const cost = Math.ceil((c.text.length + c.topic.length + 40) / 4);
      if (used + cost > budgetTokens) continue;
      chosen.push(c); used += cost;
    }
    const coverage = coverageFor(question, chosen.slice(0, 4).map((c) => c.text + " " + c.topic));
    return { claims: chosen, coverage: coverage.level, coverageRatio: Number(coverage.ratio.toFixed(2)), budgetUsed: used, candidates: ranked.length };
  }

  touchUsed(ids) {
    const st = this.db.prepare("UPDATE claims SET use_count=use_count+1, last_used_at=? WHERE id=?");
    const now = nowIso();
    this.transaction(() => { for (const id of ids) st.run(now, id); });
  }

  recordEpisode(e) {
    const id = newId("e");
    this.db.prepare("INSERT INTO episodes(id,session_id,question,resolved_question,jurisdiction,answer,confidence,status,claims_used,model,duration_ms,cost_usd,created_at,source_excerpts,retrieval_mode) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(id, e.sessionId || "", e.question, e.resolvedQuestion || e.question, normaliseJurisdiction(e.jurisdiction), e.answer, clamp01(e.confidence), e.status || "", JSON.stringify(e.claimsUsed || []), e.model || "", Math.round(e.durationMs || 0), Number(e.costUsd || 0), nowIso(), JSON.stringify(e.sourceExcerpts || []), e.retrievalMode ? String(e.retrievalMode).slice(0, 60) : null);
    return id;
  }
  getEpisode(id) { const r = this.db.prepare("SELECT * FROM episodes WHERE id=?").get(id); return r ? { ...r, claims_used: parseJson(r.claims_used, []), source_excerpts: parseJson(r.source_excerpts, []) } : null; }
  /** Run fn inside a transaction so a partial write cannot be mistaken for a complete one. */
  transaction(fn) {
    if (fn?.constructor?.name === "AsyncFunction") throw new TypeError("transaction callback must be synchronous");
    this.db.exec("BEGIN");
    try {
      const out = fn();
      if (out && typeof out.then === "function") {
        out.catch?.(() => {});
        throw new TypeError("transaction callback must be synchronous");
      }
      this.db.exec("COMMIT");
      return out;
    }
    catch (err) { try { this.db.exec("ROLLBACK"); } catch { /* already rolled back */ } throw err; }
  }
  sessionHistory(sessionId, n = 4, { jurisdiction } = {}) {
    const scope = normaliseJurisdiction(jurisdiction);
    const sql = `SELECT question,resolved_question,jurisdiction,answer FROM episodes WHERE session_id=?${scope ? " AND jurisdiction=?" : ""} ORDER BY created_at DESC LIMIT ?`;
    return this.db.prepare(sql).all(...(scope ? [sessionId, scope, n] : [sessionId, n])).reverse();
  }

  /**
   * vote: +1 helpful / -1 wrong. One episode carries one vote: repeating it is
   * a no-op and changing it reverses the previous contribution, so a retry or a
   * double-click cannot inflate the attention ledger or the calibration table.
   * Anything that is not +1 or -1 is rejected rather than silently read as a
   * downvote.
   */
  setFeedback(episodeId, vote) {
    const v = Number(vote);
    if (v !== 1 && v !== -1) return { error: "vote must be 1 or -1" };
    const ep = this.getEpisode(episodeId); if (!ep) return null;
    const prev = ep.feedback === 1 || ep.feedback === -1 ? ep.feedback : null;
    if (prev === v) return { episodeId, vote: v, claims: ep.claims_used.length, unchanged: true };
    return this.transaction(() => {
      this.db.prepare("UPDATE episodes SET feedback=? WHERE id=?").run(v, episodeId);
      const bump = this.db.prepare("UPDATE claims SET helpful=MAX(0, helpful+?), unhelpful=MAX(0, unhelpful+?) WHERE id=?");
      const dHelpful = (v > 0 ? 1 : 0) - (prev === 1 ? 1 : 0);
      const dUnhelpful = (v < 0 ? 1 : 0) - (prev === -1 ? 1 : 0);
      for (const id of ep.claims_used) bump.run(dHelpful, dUnhelpful, id);
      const bucket = Math.min(9, Math.floor(clamp01(ep.confidence) * 10));
      if (prev === null) this.db.prepare("INSERT INTO calibration(bucket,n,hits) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET n=n+1, hits=hits+excluded.hits").run(bucket, v > 0 ? 1 : 0);
      else this.db.prepare("UPDATE calibration SET hits=MAX(0, MIN(n, hits+?)) WHERE bucket=?").run(v > 0 ? 1 : -1, bucket);
      return { episodeId, vote: v, claims: ep.claims_used.length, changed: prev !== null };
    });
  }
  calibrationAdjust(conf) {
    const c = clamp01(conf);
    const row = this.db.prepare("SELECT n,hits FROM calibration WHERE bucket=?").get(Math.min(9, Math.floor(c * 10)));
    if (!row || row.n < 5) return c;
    return Number((0.5 * c + 0.5 * (row.hits / row.n)).toFixed(2));
  }
  calibrationSummary() {
    const rows = this.db.prepare("SELECT bucket,n,hits FROM calibration ORDER BY bucket").all();
    const total = rows.reduce((s, r) => s + r.n, 0);
    const ece = total ? rows.reduce((s, r) => s + (r.n / total) * Math.abs(r.hits / r.n - (r.bucket + 0.5) / 10), 0) : null;
    return { samples: total, ece: ece == null ? null : Number(ece.toFixed(3)), buckets: rows.map((r) => ({ range: `${r.bucket / 10}-${(r.bucket + 1) / 10}`, n: r.n, empirical: Number((r.hits / r.n).toFixed(2)) })) };
  }

  addGap(question, reason, { jurisdiction } = {}) {
    const open = this.db.prepare("SELECT id FROM gaps WHERE question=? AND resolved_at IS NULL").get(question);
    if (open) return open.id;
    const id = newId("g");
    const scope = normaliseJurisdiction(jurisdiction) || (isManxText(question, reason) ? "IM" : null);
    this.db.prepare("INSERT INTO gaps(id,question,reason,created_at,jurisdiction) VALUES(?,?,?,?,?)").run(id, question, String(reason || ""), nowIso(), scope);
    return id;
  }
  openGaps(limit = 20, { jurisdiction, readyOnly = false, at = Date.now() } = {}) {
    const where = ["resolved_at IS NULL"];
    const args = [];
    if (normaliseJurisdiction(jurisdiction) === "IM") where.push("jurisdiction='IM'");
    if (readyOnly) {
      where.push("attempt_count < ?");
      args.push(GAP_AUTO_ATTEMPT_LIMIT);
      where.push("(next_attempt_at IS NULL OR next_attempt_at <= ?)");
      args.push(new Date(at).toISOString());
    }
    const sql = "SELECT * FROM gaps WHERE " + where.join(" AND ") + " ORDER BY CASE WHEN last_attempt_at IS NULL THEN 0 ELSE 1 END, COALESCE(last_attempt_at,created_at) ASC, created_at ASC LIMIT ?";
    return this.db.prepare(sql).all(...args, limit);
  }
  resolveGap(id, expeditionId) { this.db.prepare("UPDATE gaps SET resolved_at=?, expedition_id=?, last_outcome='answered', next_attempt_at=NULL, last_error=NULL WHERE id=?").run(nowIso(), expeditionId || null, id); }
  resolveGapsFor(question, expeditionId) { this.db.prepare("UPDATE gaps SET resolved_at=?, expedition_id=?, last_outcome='answered', next_attempt_at=NULL, last_error=NULL WHERE question=? AND resolved_at IS NULL").run(nowIso(), expeditionId || null, question); }

  queueExpedition({ question, reason, strategies, jurisdiction, sessionId, mode = "deep", progress = {}, preview = null }) {
    const id = newId("x");
    const scope = normaliseJurisdiction(jurisdiction) || (isManxText(question) ? "IM" : null);
    this.db.prepare("INSERT INTO expeditions(id,question,reason,strategies,jurisdiction,session_id,mode,progress,preview,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,'queued',?)")
      .run(id, question, String(reason || ""), JSON.stringify(strategies || []), scope, expeditionSessionId(sessionId), expeditionMode(mode), jsonForDb(progress, {}, 16_000), preview == null ? null : jsonForDb(preview, null), nowIso());
    return id;
  }
  updateExpeditionProgress(id, update = {}, options = {}) {
    const current = this.getExpedition(id);
    if (!current) return null;
    const patch = update && typeof update === "object" && !Array.isArray(update) ? update : {};
    const wrapped = Object.prototype.hasOwnProperty.call(patch, "progress");
    const progressPatch = wrapped
      ? patch.progress
      : Object.fromEntries(Object.entries(patch).filter(([key]) => key !== "preview"));
    const nextProgress = progressPatch && typeof progressPatch === "object" && !Array.isArray(progressPatch)
      ? { ...current.progress, ...progressPatch }
      : current.progress;
    const hasPreview = Object.prototype.hasOwnProperty.call(patch, "preview") || Object.prototype.hasOwnProperty.call(options || {}, "preview");
    const nextPreview = Object.prototype.hasOwnProperty.call(patch, "preview") ? patch.preview : options?.preview;
    const progressJson = boundedJson(nextProgress, 16_000) ?? jsonForDb(current.progress, {}, 16_000);
    const previewJson = hasPreview
      ? nextPreview == null
        ? null
        : boundedJson(nextPreview) ?? (current.preview == null ? null : jsonForDb(current.preview, null))
      : current.preview == null ? null : jsonForDb(current.preview, null);
    this.db.prepare("UPDATE expeditions SET progress=?, preview=? WHERE id=?")
      .run(progressJson, previewJson, id);
    return this.getExpedition(id);
  }
  beginExpedition(id) {
    return this.transaction(() => {
      const expedition = this.db.prepare("SELECT question,status FROM expeditions WHERE id=?").get(id);
      if (!expedition || expedition.status !== "queued") return false;
      const at = nowIso();
      this.db.prepare("UPDATE expeditions SET status='running' WHERE id=? AND status='queued'").run(id);
      // An attempt starts only when work actually begins. Its one-hour lease
      // prevents another Dream from selecting the same gap after a crash.
      this.db.prepare("UPDATE gaps SET attempt_count=attempt_count+1,last_attempt_at=?,next_attempt_at=?,last_outcome='running',last_error=NULL,expedition_id=? WHERE question=? AND resolved_at IS NULL")
        .run(at, new Date(Date.parse(at) + 60 * 60_000).toISOString(), id, expedition.question);
      return true;
    });
  }
  startExpedition(input) {
    const id = this.queueExpedition(input);
    this.beginExpedition(id);
    return id;
  }
  finishExpedition(id, r) {
    const status = r.status || "done";
    const summary = String(r.summary || "").slice(0, 4000);
    const at = nowIso();
    this.transaction(() => {
      this.db.prepare("UPDATE expeditions SET status=?, summary=?, learned=?, cost_usd=?, duration_ms=?, finished_at=? WHERE id=?")
        .run(status, summary, JSON.stringify(r.learned || []), Number(r.costUsd || 0), Math.round(r.durationMs || 0), at, id);
      if (["failed", "empty", "partial", "interrupted"].includes(status)) {
        const gaps = this.db.prepare("SELECT id,attempt_count FROM gaps WHERE expedition_id=? AND resolved_at IS NULL").all(id);
        const update = this.db.prepare("UPDATE gaps SET next_attempt_at=?,last_outcome=?,last_error=? WHERE id=?");
        for (const gap of gaps) update.run(new Date(Date.parse(at) + retryDelayMs(gap.attempt_count)).toISOString(), status, summary.slice(0, 500), gap.id);
      }
      if (status === "done") {
        this.db.prepare("UPDATE gaps SET resolved_at=?,last_outcome='answered',next_attempt_at=NULL,last_error=NULL WHERE expedition_id=? AND resolved_at IS NULL").run(at, id);
      }
    });
  }
  getExpedition(id) { return rowToExpedition(this.db.prepare("SELECT * FROM expeditions WHERE id=?").get(id)); }
  recentExpeditions(n = 10) { return this.db.prepare("SELECT * FROM expeditions ORDER BY created_at DESC LIMIT ?").all(n).map(rowToExpedition); }
  expeditionsForSession(sessionId, { limit = 20 } = {}) {
    const session = expeditionSessionId(sessionId);
    if (!session) return [];
    const bounded = Number.isFinite(Number(limit)) ? Math.min(100, Math.max(1, Math.floor(Number(limit)))) : 20;
    return this.db.prepare("SELECT * FROM expeditions WHERE session_id=? ORDER BY created_at DESC LIMIT ?").all(session, bounded).map(rowToExpedition);
  }
  expeditionsSince(iso) { return this.db.prepare("SELECT COUNT(*) n FROM expeditions WHERE created_at >= ?").get(iso).n; }
  /** On startup: anything still 'running' belonged to a dead process. */
  interruptRunning() {
    const rows = this.db.prepare("SELECT id FROM expeditions WHERE status IN ('running','queued')").all();
    for (const row of rows) this.finishExpedition(row.id, { status: "interrupted", summary: "The previous Oracle process stopped before this expedition finished." });
    return rows.length;
  }

  randomClaim({ excludeTopic = "", jurisdiction } = {}) {
    let sql = "SELECT * FROM claims WHERE status IN ('verified','corroborated')";
    if (normaliseJurisdiction(jurisdiction) === "IM") sql += " AND " + manxWhere();
    return rowToClaim(excludeTopic
      ? this.db.prepare(sql + " AND topic != ? ORDER BY RANDOM() LIMIT 1").get(excludeTopic)
      : this.db.prepare(sql + " ORDER BY RANDOM() LIMIT 1").get());
  }
  weakestClaims(n = 5, { jurisdiction } = {}) {
    let sql = "SELECT * FROM claims WHERE status NOT IN ('retracted') AND kind != 'seed'";
    if (normaliseJurisdiction(jurisdiction) === "IM") sql += " AND " + manxWhere();
    const rows = this.db.prepare(sql).all().map(rowToClaim);
    return rows.sort((a, b) => a.trust - b.trust).slice(0, n);
  }
  recentLearned(limit = 20, { jurisdiction } = {}) {
    let sql = "SELECT * FROM claims WHERE kind != 'seed' AND status IN ('verified','corroborated')";
    if (normaliseJurisdiction(jurisdiction) === "IM") sql += " AND " + manxWhere();
    return this.db.prepare(sql + " ORDER BY created_at DESC LIMIT ?").all(limit).map(rowToClaim);
  }
  /** Size, sourcing and growth of the ledger for a jurisdiction: what a knowledge map speaks from. */
  ledgerOverview({ jurisdiction, days = 7 } = {}) {
    const scope = normaliseJurisdiction(jurisdiction) === "IM" ? " AND " + manxWhere() : "";
    const live_ = " AND " + currentEvidenceWhere();
    const byStatus = Object.fromEntries(this.db.prepare("SELECT status, COUNT(*) n FROM claims WHERE status <> 'retracted'" + scope + live_ + " GROUP BY status").all().map((r) => [r.status, r.n]));
    const live = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const topics = this.db.prepare("SELECT COUNT(DISTINCT topic) n FROM claims WHERE status <> 'retracted'" + scope + live_).get().n;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const recent = this.db.prepare("SELECT COUNT(*) n FROM claims WHERE status <> 'retracted' AND created_at >= ?" + scope + live_).get(since).n;
    const official = this.db.prepare("SELECT COUNT(*) n FROM claims WHERE status <> 'retracted'" + scope + live_ + " AND EXISTS (SELECT 1 FROM json_each(claims.sources) WHERE json_extract(value, '$.primary') = 1)").get().n;
    const gapsOpen = this.db.prepare("SELECT COUNT(*) n FROM gaps WHERE resolved_at IS NULL" + (scope ? " AND jurisdiction='IM'" : "")).get().n;
    return { live, byStatus, topics, recent, recentDays: days, official, gapsOpen };
  }
  /** Topics by claim count, so the thin and the well-covered areas are visible. */
  topicSummary({ jurisdiction, limit = 20 } = {}) {
    const scope = normaliseJurisdiction(jurisdiction) === "IM" ? " AND " + manxWhere() : "";
    return this.db.prepare("SELECT topic, COUNT(*) n, SUM(CASE WHEN status='verified' THEN 1 ELSE 0 END) verified, MAX(COALESCE(verified_at, created_at)) newest FROM claims WHERE status <> 'retracted' AND topic <> ''" + scope + " AND " + currentEvidenceWhere() + " GROUP BY topic ORDER BY n DESC, newest DESC LIMIT ?").all(limit);
  }
  /**
   * Record the outcome of reading one cited page. Status is re-derived from the
   * sources as they now stand; a confirmed read is a real check, so it also
   * resets the trust-decay anchor.
   */
  recordSourceVerification(id, url, verification) {
    const c = this.getClaim(id); if (!c) return null;
    const bound = boundVerification(verification); if (!bound) throw new Error("invalid source verification");
    if (!c.sources.some((s) => s.url === url)) return c;
    const sources = c.sources.map((s) => s.url === url ? { ...s, verification: bound } : s);
    const status = c.status === "retracted" ? "retracted" : deriveStatus({ sources, support: c.support, contradict: c.contradict, kind: c.kind, provenance: c.provenance });
    const verifiedAt = bound.status === "confirmed" ? nowIso() : c.verified_at;
    this.db.prepare("UPDATE claims SET sources=?, status=?, verified_at=? WHERE id=?").run(JSON.stringify(sources), status, verifiedAt, id);
    this.notifyClaimChange(id, "verify");
    return this.getClaim(id);
  }
  /** Citations due a read: never checked first, then the longest unchecked. */
  sourcesToVerify({ limit = 10, staleMs = 30 * 86_400_000, now = Date.now(), statuses = null } = {}) {
    const rows = this.db.prepare("SELECT id, text, sources FROM claims WHERE status<>'retracted' AND kind<>'source_excerpt'").all();
    const due = [];
    for (const row of rows) {
      for (const s of parseJson(row.sources, [])) {
        if (!s?.url) continue;
        const checked = Date.parse(s.verification?.checkedAt);
        const age = Number.isFinite(checked) ? now - checked : Infinity;
        if (age < staleMs) continue;
        if (Array.isArray(statuses) && !statuses.includes(s.verification?.status || "unchecked")) continue;
        due.push({ claimId: row.id, url: s.url, text: row.text, checkedAt: Number.isFinite(checked) ? s.verification.checkedAt : null, age });
      }
    }
    due.sort((a, b) => b.age - a.age);
    return due.slice(0, Math.max(0, limit));
  }
  verificationStats() {
    const rows = this.db.prepare("SELECT sources FROM claims WHERE status<>'retracted' AND kind<>'source_excerpt'").all();
    const counts = { sources: 0, unchecked: 0 };
    for (const status of VERIFICATION_STATUSES) counts[status] = 0;
    for (const row of rows) for (const s of parseJson(row.sources, [])) {
      counts.sources += 1;
      const status = s?.verification?.status;
      if (VERIFICATION_STATUSES.includes(status)) counts[status] += 1; else counts.unchecked += 1;
    }
    return counts;
  }
  /**
   * Expired live excerpts (weather readings, news items, page reads past their
   * TTL) are not knowledge; they were already unretrievable and only inflated
   * counts. Episodes keep their own copy of the excerpts they used.
   */
  purgeExpiredExcerpts({ now = Date.now(), graceMs = 0 } = {}) {
    const rows = this.db.prepare("SELECT id, provenance FROM claims WHERE kind='source_excerpt'").all();
    const gone = [];
    for (const row of rows) {
      const expires = Date.parse(parseJson(row.provenance, {})?.sourceEvidence?.expiresAt);
      if (Number.isFinite(expires) && expires + graceMs <= now) gone.push(row.id);
    }
    if (gone.length) {
      const del = this.db.prepare("DELETE FROM claims WHERE id=?");
      this.transaction(() => { for (const id of gone) del.run(id); });
      for (const id of gone) this.notifyClaimChange(id, "delete");
    }
    return { purged: gone.length };
  }
  /**
   * When the status rules change, every stored status is re-derived once from
   * the evidence on record, and claims that only ever rested on reviewer
   * agreement are retired. Runs on open; a ledger already at this version is
   * left alone.
   */
  migrateStatusRules() {
    const RULES_VERSION = "2";
    if (this.getMeta("status_rules_version") === RULES_VERSION) return { skipped: true };
    const rows = this.db.prepare("SELECT * FROM claims WHERE status<>'retracted'").all();
    const summary = { rederived: 0, retired: 0, changed: {} };
    const update = this.db.prepare("UPDATE claims SET status=?, sources=?, provenance=? WHERE id=?");
    this.transaction(() => {
      for (const row of rows) {
        const provenance = parseJson(row.provenance, {});
        const sources = parseJson(row.sources, []).filter((s) => s && typeof s.url === "string").map((s) => ({ ...s, primary: isPrimarySource(s) }));
        if (row.kind === "momm" || provenance.origin === "momm-deliberation") {
          update.run("retracted", JSON.stringify(sources), JSON.stringify({ ...provenance, retiredBy: `status-rules:${RULES_VERSION}`, reason: "reviewer agreement is not source evidence" }), row.id);
          summary.retired += 1;
          continue;
        }
        const status = deriveStatus({ sources, support: row.support, contradict: row.contradict, kind: row.kind, provenance });
        update.run(status, JSON.stringify(sources), JSON.stringify(provenance), row.id);
        if (status !== row.status) { summary.rederived += 1; const key = `${row.status}->${status}`; summary.changed[key] = (summary.changed[key] || 0) + 1; }
      }
      this.setMeta("status_rules_version", RULES_VERSION);
    });
    return summary;
  }

  listClaims({ limit = 50, status, kind } = {}) {
    const where = []; const args = [];
    if (status) { where.push("status=?"); args.push(status); }
    if (kind) { where.push("kind=?"); args.push(kind); }
    return this.db.prepare(`SELECT * FROM claims ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT ?`).all(...args, limit).map(rowToClaim);
  }

  stats() {
    const byStatus = Object.fromEntries(this.db.prepare("SELECT status, COUNT(*) n FROM claims GROUP BY status").all().map((r) => [r.status, r.n]));
    const byKind = Object.fromEntries(this.db.prepare("SELECT kind, COUNT(*) n FROM claims GROUP BY kind").all().map((r) => [r.kind, r.n]));
    const episodes = this.db.prepare("SELECT COUNT(*) n, AVG(confidence) avg_conf, SUM(cost_usd) cost, SUM(CASE WHEN feedback=1 THEN 1 ELSE 0 END) up, SUM(CASE WHEN feedback=-1 THEN 1 ELSE 0 END) down FROM episodes").get();
    const expeditions = this.db.prepare("SELECT COUNT(*) n, SUM(cost_usd) cost, SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) running FROM expeditions").get();
    return {
      claims: this.count(), byStatus, byKind,
      episodes: { n: episodes.n, avgConfidence: episodes.avg_conf == null ? null : Number(episodes.avg_conf.toFixed(2)), costUsd: Number((episodes.cost || 0).toFixed(3)), up: episodes.up || 0, down: episodes.down || 0 },
      expeditions: { n: expeditions.n, costUsd: Number((expeditions.cost || 0).toFixed(3)), running: expeditions.running || 0 },
      gapsOpen: this.db.prepare("SELECT COUNT(*) n FROM gaps WHERE resolved_at IS NULL").get().n,
      calibration: this.calibrationSummary(),
      seededAt: this.getMeta("seeded_at"),
    };
  }
}

export function openKb(file) { return new KnowledgeBase(file); }
