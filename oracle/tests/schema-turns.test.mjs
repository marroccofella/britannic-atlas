// A schema run asks the CLI for structured output, which it returns through a
// tool call. That call consumes turns, so a budget of one or two ends the run
// with error_max_turns before any result exists. Live symptom on 2026-09-04:
// four MOMM reviewers completed, the synthesis died, and the user was charged
// for a review that produced nothing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMA_MIN_TURNS, runClaude } from "../lib/claude.mjs";

const ORACLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(ORACLE, file), "utf8");

/** Capture the argv runClaude would use, without spawning the CLI. */
async function argvFor(options) {
  const original = process.env.ORACLE_CLAUDE_BIN;
  process.env.ORACLE_CLAUDE_BIN = path.join(ORACLE, "tests", "no-such-claude-binary");
  try {
    await runClaude({ prompt: "x", timeoutMs: 50, ...options });
    return null;
  } catch (error) {
    return error;
  } finally {
    if (original === undefined) delete process.env.ORACLE_CLAUDE_BIN; else process.env.ORACLE_CLAUDE_BIN = original;
  }
}

test("a structured-output run never gets a turn budget that kills it before the result", () => {
  const source = read("lib/claude.mjs");
  assert.match(source, /const turns = schema \? Math\.max\(SCHEMA_MIN_TURNS, Number\(maxTurns\) \|\| 0\) : maxTurns/);
  assert.ok(SCHEMA_MIN_TURNS >= 3, "one and two turns both fail live against sonnet");
  // The floor raises a too-small budget and never lowers a generous one.
  const applied = (schema, maxTurns) => (schema ? Math.max(SCHEMA_MIN_TURNS, Number(maxTurns) || 0) : maxTurns);
  assert.equal(applied(true, 1), SCHEMA_MIN_TURNS);
  assert.equal(applied(true, 2), SCHEMA_MIN_TURNS);
  assert.equal(applied(true, undefined), SCHEMA_MIN_TURNS);
  assert.equal(applied(true, 16), 16, "a generous research budget is left alone");
  assert.equal(applied(false, 1), 1, "runs without a schema keep the caller's budget");
});

test("every schema caller is covered by the floor rather than each remembering it", () => {
  for (const file of ["lib/deliberate.mjs", "lib/visual.mjs", "lib/learning.mjs"]) {
    const source = read(file);
    if (!/schema:/.test(source)) continue;
    assert.doesNotMatch(source, /--max-turns/, `${file} must not build its own turn flag`);
  }
  // These three call sites all passed maxTurns: 1 and were all silently broken.
  assert.match(read("lib/deliberate.mjs"), /maxTurns: 1/);
  assert.match(read("lib/visual.mjs"), /maxTurns: 1/);
});

test("a failed synthesis says why instead of only calling itself invalid", () => {
  const source = read("lib/deliberate.mjs");
  assert.match(source, /modelResult\?\.isError \? plainText\(modelResult\.errorSubtype/);
  assert.match(source, /The reviewers finished, but the answer could not be rewritten/);
  assert.match(read("lib/claude.mjs"), /errorSubtype: result\.is_error \?/, "the wrapper reports the CLI's own failure subtype");
});

test("an unusable CLI path still fails loudly", async () => {
  const error = await argvFor({ schema: { type: "object" }, maxTurns: 1 });
  assert.ok(error, "a missing executable must reject");
});
