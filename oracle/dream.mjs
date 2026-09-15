// Unattended curiosity: run N expeditions against the ledger from the terminal.
// Usage: npm run oracle:dream -- [count] [--question "..."]
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openKb } from "./lib/kb.mjs";
import { ensureSeeded } from "./lib/seed.mjs";
import { Bus } from "./lib/bus.mjs";
import { runExpedition, ExpeditionQueue } from "./lib/learning.mjs";
import { curiosityTarget } from "./lib/curiosity.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const args = process.argv.slice(2);
const count = Math.max(1, Number(args.find((a) => /^\d+$/.test(a)) || 1));
const qi = args.indexOf("--question");
const forced = qi >= 0 ? args[qi + 1] : null;

const kb = openKb(process.env.ORACLE_DB || path.join(HERE, "data", "oracle.db"));
await ensureSeeded(kb, ROOT).catch((e) => console.warn("seed skipped:", e.message));
const bus = new Bus();
bus.on("event", (e) => { if (e.type !== "expedition.momm") console.log(`[${e.type}]`, e.step || "", e.detail || e.count != null ? `(${e.count})` : "", e.error || "", e.hypotheses ? "\n  " + e.hypotheses.map((h) => `[${h.operator}] ${h.hypothesis}`).join("\n  ") : ""); });

// The same hourly cap the server enforces. The terminal runner used to bypass
// it, so a scheduler calling it could spend without limit.
const cap = new ExpeditionQueue({ kb, bus, root: ROOT });
if (!cap.enabled) { console.log("expeditions are disabled (ORACLE_EXPEDITIONS=off); nothing dreamed"); kb.close(); process.exit(0); }
for (let i = 0; i < count; i += 1) {
  if (cap.budgetLeft() <= 0) { console.log(`hourly expedition budget spent (${cap.maxPerHour}/hour); stopping after ${i}`); break; }
  const target = curiosityTarget(kb, { forcedQuestion: forced });
  if (!target) { console.log("nothing to dream about: the ledger is empty"); break; }
  const id = kb.startExpedition(target);
  console.log(`\n=== expedition ${i + 1}/${count}: ${target.question}\n    reason: ${target.reason}`);
  try {
    const r = await runExpedition({ kb, bus, root: ROOT, id, ...target, sessionId: "dream" });
    console.log(`\n${r.addendum}\n  cost $${r.costUsd.toFixed(3)}`);
    for (const c of r.learned) console.log(`  - [${c.status}${c.kind === "lateral" ? "/lateral" : ""}] ${c.text}`);
  } catch (err) { kb.finishExpedition(id, { status: "failed", summary: err.message }); console.error("failed:", err.message); }
  if (forced) break;
}
console.log("\nledger:", JSON.stringify(kb.stats().byStatus));
kb.close();
