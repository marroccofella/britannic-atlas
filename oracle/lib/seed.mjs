import { correctImmigrationSeed } from './seed-corrections.mjs';
// Seeds the ledger from the Britannica Atlas corpus (app/knowledge/content.ts
// and app/manx/data.ts). Requires Node's --experimental-strip-types flag
// because the corpus is TypeScript.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { claimId } from "./kb.mjs";

const importDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "oracle-ts-"));

const VOLATILITY = { structural: "structural", periodic: "periodic", "live-check": "live" };

/**
 * Import a TypeScript module whose relative imports omit the .ts extension
 * (the Next/vinext convention). Node's type stripping cannot resolve those, so
 * the source is copied to a temp file with each relative specifier rewritten to
 * an absolute file URL, recursively. Only relative specifiers are touched.
 */
export async function importTs(file, cache = new Map()) {
  const abs = path.resolve(file);
  if (cache.has(abs)) return cache.get(abs);
  let src = fs.readFileSync(abs, "utf8");
  const dir = path.dirname(abs);
  const specs = [...src.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)].map((m) => m[1]);
  for (const spec of new Set(specs)) {
    const base = path.resolve(dir, spec);
    const target = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
    if (!target) continue;
    const url = pathToFileURL(await importTsPath(target, cache)).href;
    src = src.split(`"${spec}"`).join(`"${url}"`).split(`'${spec}'`).join(`'${url}'`);
  }
  // Each process owns its files; content identity also prevents stale module-cache reads.
  const tmp = path.join(importDirectory, `${createHash("sha256").update(abs).update("\0").update(src).digest("hex")}-${path.basename(abs)}`);
  if (!fs.existsSync(tmp)) fs.writeFileSync(tmp, src, { encoding: "utf8", flag: "wx" });
  cache.set(abs, tmp);
  const mod = await import(pathToFileURL(tmp).href);
  return mod;
}
async function importTsPath(file, cache) {
  const abs = path.resolve(file);
  if (!cache.has(abs)) await importTs(abs, cache);
  return cache.get(abs);
}

export async function loadAtlas(root) {
  const cache = new Map();
  const content = await importTs(path.join(root, "app", "knowledge", "content.ts"), cache);
  let manx = null;
  try { manx = await importTs(path.join(root, "app", "manx", "data.ts"), cache); } catch (err) { console.warn(`[oracle] manx modules skipped: ${err.message.split("\n")[0]}`); manx = null; }
  return { content, manx };
}

export function articleClaims(content) {
  const out = [];
  for (const article of content.articles) {
    const sources = content.getSources(article.sourceIds).map((s) => ({ url: s.url, title: s.title, publisher: s.publisher, primary: true }));
    const reviewed = content.getSources(article.sourceIds).map((s) => s.lastReviewed).sort().pop() || content.siteUpdatedAt;
    out.push({ text: `${article.title}: ${article.summary}`, topic: article.title, sources, verifiedAt: reviewed });
    for (const section of article.sections) out.push({ text: `${article.title} — ${section.heading}: ${section.body}`, topic: article.title, sources, verifiedAt: reviewed });
  }
  return out;
}

export function manxClaims(manx) {
  if (!manx?.manxModules) return [];
  const bySource = new Map((manx.manxSources || []).map((s) => [s.id, s]));
  const out = [];
  for (const mod of manx.manxModules) {
    const sources = (mod.sourceIds || []).map((id) => bySource.get(id)).filter(Boolean).map((s) => ({ url: s.url, title: s.title, publisher: s.publisher, primary: true }));
    for (const sig of mod.signals || []) {
      out.push({ text: `Isle of Man — ${mod.title}: ${sig.statement} Implication: ${sig.implication}`, topic: `Isle of Man — ${mod.title}`, sources, volatility: VOLATILITY[sig.volatility] || "structural", verifiedAt: manx.manxReviewedAt });
    }
  }
  return out;
}

// Bump when the corpus changes fact or citation, so every ledger re-seeds:
// reworded claims replace their predecessors and corrected URLs drop the dead ones.
export const SEED_VERSION = "3";

/** Seeds in one transaction, so the completion marker can never outrun the rows. */
export async function seedFromAtlas(kb, root) {
  const { content, manx } = await loadAtlas(root);
  const items = [...articleClaims(content), ...manxClaims(manx)];
  const summary = kb.transaction(() => {
    let created = 0, refreshed = 0, retired = 0;
    const live = new Set();
    for (const item of items) {
      const id = claimId(item.text);
      live.add(id);
      const existing = kb.getClaim(id);
      // A re-seed refreshes what is already there; it is not fresh evidence, so
      // it adds no support. A claim the corpus still carries keeps its earned
      // status, which the derivation recomputes from its refreshed citations.
      const { created: isNew } = kb.upsertClaim({
        ...item,
        kind: "seed",
        ...(existing ? {} : { status: "verified", confidence: 0.92 }),
        support: existing ? 0 : 2,
        evidenceKey: `seed:${SEED_VERSION}`,
        provenance: { origin: "britannica-atlas", editorial: true, seedVersion: SEED_VERSION },
      });
      if (isNew) created += 1;
      else { kb.replaceSources(id, item.sources); refreshed += 1; }
    }
    // Anything the corpus no longer says is retired, never left standing as
    // verified beside its replacement.
    for (const row of kb.listClaims({ limit: 100_000, kind: "seed" })) {
      if (live.has(row.id) || row.status === "retracted") continue;
      kb.upsertClaim({ text: row.text, status: "retracted", support: 0, contradict: 0, evidenceKey: `seed:${SEED_VERSION}:retire`, provenance: { retiredBy: `seed:${SEED_VERSION}`, reason: "no longer in the Atlas corpus" } });
      retired += 1;
    }
    kb.setMeta("seeded_at", new Date().toISOString());
    kb.setMeta("seed_version", SEED_VERSION);
    return { created, refreshed, retired };
  });
  return { total: items.length, ...summary };
}

/**
 * Re-seeds unless a *completed* seed of this version is recorded. Checking the
 * completion marker rather than the claim count means an interrupted first run
 * is finished on the next startup instead of being locked in forever.
 */
export async function ensureSeeded(kb, root) {
  const result = kb.getMeta("seeded_at") && kb.getMeta("seed_version") === SEED_VERSION
    ? { skipped: true, count: kb.count() }
    : await seedFromAtlas(kb, root);
  const { manx } = await loadAtlas(root);
  correctImmigrationSeed(kb, manxClaims(manx));
  return result;
}
