// Re-check the citations behind ledger claims by reading the cited pages.
// Usage: npm run oracle:verify-sources -- [--limit N] [--stale-days D] [--all] [--status unmatched,blocked]
//
// Reads the least recently checked citations (never-checked first), records
// the outcome on each source, and lets the ledger re-derive claim status:
// two confirmed routes including a primary one make "verified"; a page that
// has gone stops counting. Blocked sites are recorded as blocked, never as
// evidence for or against a claim. Nothing is bypassed to reach a page.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openKb } from "../lib/kb.mjs";
import { verifyClaimSources, RECHECK_AFTER_MS } from "../lib/source-verification.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] != null ? args[i + 1] : fallback; };
const limit = Math.max(1, Math.min(2000, Number(flag("--limit", 25)) || 25));
const staleMs = args.includes("--all") ? 0 : Math.max(0, Number(flag("--stale-days", RECHECK_AFTER_MS / 86_400_000)) || 0) * 86_400_000;
const statuses = flag("--status", "") ? String(flag("--status", "")).split(",").map((s) => s.trim()).filter(Boolean) : null;

const kb = openKb(process.env.ORACLE_DB || path.join(HERE, "..", "data", "oracle.db"));
try {
  console.log(`[verify-sources] before: ${JSON.stringify(kb.verificationStats())}`);
  const summary = await verifyClaimSources(kb, { limit, staleMs, statuses, log: (row) => console.log(`  ${row.status.padEnd(12)} ${row.before} -> ${row.after}  ${row.url}${row.detail ? "  (" + row.detail + ")" : ""}`) });
  console.log(`[verify-sources] checked ${summary.checked}: ${JSON.stringify(summary.byStatus)}; status changes ${JSON.stringify(summary.statusChanges)}`);
  console.log(`[verify-sources] after: ${JSON.stringify(kb.verificationStats())}`);
} finally { kb.close(); }
