// Headless Claude CLI wrapper. Uses the user's existing OAuth login (no API keys).
// Every call strips MCP servers and unneeded tools so the request is small and fast.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Locates the Claude CLI executable. Never falls back to `shell: true`: a
 * shell-quoted command line mangles the JSON schema argument on Windows, so a
 * clear error is better than a silently corrupted request.
 */
export function resolveClaude() {
  if (process.env.ORACLE_CLAUDE_BIN) return { cmd: process.env.ORACLE_CLAUDE_BIN, shell: false };
  const win = process.platform === "win32";
  const names = win ? ["claude.exe"] : ["claude"];
  const candidates = [];
  if (win) candidates.push(path.join(process.env.APPDATA || "", "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe"));
  else candidates.push("/usr/local/bin/claude", path.join(os.homedir(), ".local", "bin", "claude"));
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    for (const name of names) candidates.push(path.join(dir, name));
  }
  for (const candidate of candidates) {
    try { if (candidate && fs.statSync(candidate).isFile()) return { cmd: candidate, shell: false }; } catch { /* keep looking */ }
  }
  throw new Error("Claude CLI executable not found. Install Claude Code, or set ORACLE_CLAUDE_BIN to the full path of the executable (not a .cmd shim).");
}

/**
 * Spawn options that let a timeout or abort kill the whole tree. On Windows
 * taskkill /T walks the tree; elsewhere the child leads its own process group
 * so the reviewer CLIs it spawns die with it instead of spending on.
 */
export function treeSpawnOptions() { return process.platform === "win32" ? {} : { detached: true }; }
export function killTree(child) {
  if (!child?.pid) return;
  try {
    if (process.platform === "win32") {
      if (child.exitCode !== null) return;
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      killer.on("error", () => { try { child.kill("SIGKILL"); } catch { /* best effort */ } });
    } else {
      // The group is signalled even when its leader has already exited:
      // a reviewer CLI can outlive the dispatcher that spawned it.
      try { process.kill(-child.pid, "SIGKILL"); } catch { if (child.exitCode === null) { try { child.kill("SIGKILL"); } catch { /* gone */ } } }
    }
  } catch { /* best effort */ }
}

/** "1.0.100 (Claude Code)" → "1.0.100"; anything else → null. */
export function parseClaudeVersion(text) {
  const m = /(\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?)/.exec(String(text || ""));
  return m ? m[1] : null;
}
let versionCache = null;
/**
 * Which Claude Code CLI answers are generated with. A local, free probe
 * (`claude --version`), cached for the process, so the header can say what
 * harness and model the user is talking to.
 */
export function inspectClaudeVersion({ timeoutMs = 6_000 } = {}) {
  if (versionCache) return versionCache;
  versionCache = new Promise((resolve) => {
    let resolved;
    try { resolved = resolveClaude(); } catch (error) { return resolve({ ok: false, reason: error.message }); }
    let output = "", done = false;
    const finish = (value) => { if (done) return; done = true; clearTimeout(timer); resolve(value); };
    let child;
    try { child = spawn(resolved.cmd, ["--version"], { shell: resolved.shell, stdio: ["ignore", "pipe", "ignore"], windowsHide: true }); }
    catch (error) { return finish({ ok: false, reason: error.message }); }
    const timer = setTimeout(() => { killTree(child); finish({ ok: false, reason: "version check timed out" }); }, timeoutMs);
    child.stdout.on("data", (chunk) => { output += chunk; if (output.length > 4000) killTree(child); });
    child.once("error", (error) => finish({ ok: false, reason: error.message }));
    child.once("close", () => { const version = parseClaudeVersion(output); finish(version ? { ok: true, version, cmd: resolved.cmd } : { ok: false, reason: "version could not be read" }); });
  }).catch((error) => ({ ok: false, reason: String(error?.message || error) }))
    // A transient failure at startup must not become the answer for the
    // life of the process; only a read version is worth remembering.
    .then((value) => { if (!value.ok) versionCache = null; return value; });
  return versionCache;
}

export function parseStreamLine(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return null;
  try { return JSON.parse(trimmed); } catch { return null; }
}

export function parseClaudeOutput(stdout) {
  const text = String(stdout || "").trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch { /* some CLI versions prefix diagnostics */ }
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fall back to compact result lines */ }
  }
  const lines = text.split(/\r?\n/).filter((line) => line.trim().startsWith("{"));
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const parsed = parseStreamLine(lines[i]);
    if (parsed) return parsed;
  }
  return null;
}

/**
 * Minimum turn budget for a run that asks for structured output. The CLI
 * returns the schema payload through a tool call, which consumes turns.
 */
export const SCHEMA_MIN_TURNS = 6;

/**
 * Run one headless Claude turn.
 * @param {object} o
 * @param {string} o.prompt          user prompt (sent on stdin)
 * @param {string} [o.system]        full replacement system prompt
 * @param {string} [o.model]         alias: sonnet | opus | haiku
 * @param {string[]} [o.tools]       built-in tools to allow, e.g. ["WebSearch","WebFetch"]; [] = none
 * @param {object} [o.schema]        JSON schema for structured output
 * @param {(t:string)=>void} [o.onDelta]  streaming text callback
 * @param {(e:object)=>void} [o.onEvent]  raw stream event callback
 * @param {number} [o.timeoutMs]
 * @param {number} [o.maxTurns]
 */
export function runClaude(o) {
  const { prompt, system, model = process.env.ORACLE_MODEL || "sonnet", tools = [], schema, onDelta, onEvent, timeoutMs = 120_000, maxTurns, cwd, effort, signal } = o;
  if (signal?.aborted) { const err = new Error("request cancelled"); err.name = "AbortError"; return Promise.reject(err); }
  const stream = typeof onDelta === "function" || typeof onEvent === "function";
  const args = ["-p", "--output-format", stream ? "stream-json" : "json", "--strict-mcp-config", "--no-session-persistence", "--model", model];
  if (stream) args.push("--verbose", "--include-partial-messages");
  if (tools.length) args.push("--tools", ...tools, "--allowedTools", ...tools);
  else args.push("--tools", "");
  if (schema) args.push("--json-schema", JSON.stringify(schema));
  // Structured output (--json-schema) is delivered as a tool call, so a schema
  // run spends turns on the model's reply *and* on that call. A budget of one
  // or two dies with error_max_turns before any result exists, throwing away
  // the whole (paid) call, so a schema run gets a floor regardless of caller.
  const turns = schema ? Math.max(SCHEMA_MIN_TURNS, Number(maxTurns) || 0) : maxTurns;
  if (turns) args.push("--max-turns", String(turns));
  if (effort) args.push("--effort", effort);
  let sysFile = null;
  if (system) {
    sysFile = path.join(os.tmpdir(), `oracle-sys-${randomUUID()}.txt`);
    fs.writeFileSync(sysFile, system, "utf8");
    args.push("--system-prompt-file", sysFile);
  }
  const env = { ...process.env };
  delete env.CLAUDECODE; delete env.CLAUDE_CODE_ENTRYPOINT; delete env.CLAUDE_CODE_SSE_PORT;
  let resolved;
  try { resolved = resolveClaude(); }
  catch (err) { if (sysFile) fs.rmSync(sysFile, { force: true }); return Promise.reject(err); }
  const { cmd, shell } = resolved;
  const started = Date.now();

  return new Promise((resolve, reject) => {
    let child;
    try { child = spawn(cmd, args, { cwd: cwd || os.tmpdir(), env, shell, stdio: ["pipe", "pipe", "pipe"], windowsHide: true, ...treeSpawnOptions() }); }
    catch (err) { if (sysFile) fs.rmSync(sysFile, { force: true }); return reject(err); }
    let stdout = "", stderr = "", buffered = "", text = "", result = null, done = false;
    const finish = (err, value) => {
      if (done) return; done = true; clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (sysFile) fs.rmSync(sysFile, { force: true });
      if (err) reject(err); else resolve(value);
    };
    const onAbort = () => { killTree(child); const err = new Error("request cancelled"); err.name = "AbortError"; finish(err); };
    const timer = setTimeout(() => { killTree(child); finish(new Error(`claude timed out after ${timeoutMs}ms`)); }, timeoutMs);
    signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout.on("data", (chunk) => {
      const s = chunk.toString("utf8");
      // Full non-stream JSON must be retained for parsing. In stream mode keep
      // only a bounded diagnostic tail; answer text is already accumulated
      // separately from parsed deltas.
      stdout = stream ? (stdout + s).slice(-4096) : stdout + s;
      if (!stream) return;
      buffered += s;
      const lines = buffered.split(/\r?\n/); buffered = lines.pop();
      for (const line of lines) {
        const ev = parseStreamLine(line); if (!ev) continue;
        onEvent?.(ev);
        if (ev.type === "stream_event" && ev.event?.type === "content_block_delta" && ev.event.delta?.type === "text_delta") {
          text += ev.event.delta.text; onDelta?.(ev.event.delta.text);
        } else if (ev.type === "result") result = ev;
      }
    });
    child.stderr.on("data", (c) => { stderr += c.toString("utf8"); });
    child.on("error", (err) => finish(err));
    child.on("close", (code) => {
      if (!stream) result = parseClaudeOutput(stdout);
      if (!result) return finish(new Error(`claude exited ${code} without a result: ${stderr.slice(0, 400) || stdout.slice(0, 400)}`));
      const finalText = stream ? (text || result.result || "") : (result.result || "");
      finish(null, {
        text: finalText,
        structured: result.structured_output ?? null,
        isError: Boolean(result.is_error),
        // Why it failed, so a caller can say something better than "invalid".
        errorSubtype: result.is_error ? String(result.subtype || result.terminal_reason || "error").slice(0, 60) : null,
        costUsd: Number(result.total_cost_usd || 0),
        durationMs: Date.now() - started,
        sessionId: result.session_id || null,
        model: result.modelUsage ? Object.keys(result.modelUsage).join(",") : model,
        webSearches: Number(result.usage?.server_tool_use?.web_search_requests || 0),
        stderr: stderr.slice(0, 2000),
      });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(prompt, "utf8");
  });
}
