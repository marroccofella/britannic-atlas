// Request guards for the local server, kept separate from server.mjs so they
// can be tested without binding a port.

import path from "node:path";

export class RequestError extends Error {
  constructor(message,status=400){super(message);this.status=status;}
}
export function readJson(req, limit=64000) {
  return new Promise((resolve,reject)=>{
    const chunks=[];let size=0,settled=false;
    const fail=error=>{if(settled)return;settled=true;chunks.length=0;reject(error);};
    const tooLarge=()=>fail(new RequestError("This message is too large. Paste a shorter section; nothing was sent to the AI.",413));
    req.on("error",fail);
    req.on("aborted",()=>fail(new RequestError("The message was interrupted. Please try again.")));
    req.on("data",chunk=>{
      if(settled)return;
      size+=Buffer.byteLength(chunk);
      if(size>limit){tooLarge();return;} // Keep the response socket alive to return 413.
      chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));
    });
    req.on("end",()=>{
      if(settled)return;
      try {
        const text=Buffer.concat(chunks).toString("utf8"),body=text?JSON.parse(text):{};
        if(!body||Array.isArray(body)||typeof body!=="object")throw new Error();
        settled=true;resolve(body);
      } catch {fail(new RequestError("The message could not be read. Please try again."));}
    });
    if(Number(req.headers?.["content-length"])>limit)tooLarge();
  });
}

export function boundedPositiveInt(value, fallback, { min = 1, max = 32 } = {}) {
  if (!/^\d+$/.test(String(value ?? ""))) return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : fallback;
}

/** Identity-safe admission for paid answer work. */
export class ActiveRequestRegistry {
  constructor(limit = 4, { completedTtlMs = 120_000, maxCompleted = 512, maxSessions = 1_000, now = Date.now } = {}) {
    this.limit = boundedPositiveInt(limit, 4);
    this.completedTtlMs = completedTtlMs;
    this.maxCompleted = maxCompleted;
    this.maxSessions = maxSessions;
    this.now = now;
    this.byRequest = new Map();
    this.bySession = new Map();
    this.recentlyCompleted = new Map();
    this.lastTurnBySession = new Map();
    this.emptyWaiters = new Set();
  }
  get size() { return this.byRequest.size; }
  getSession(sessionId) { return this.bySession.get(String(sessionId)) || null; }
  isCurrentTurn(sessionId, clientTurn) {
    const turn = Number(clientTurn);
    return Number.isSafeInteger(turn) && this.lastTurnBySession.get(String(sessionId)) === turn;
  }
  values() { return this.byRequest.values(); }
  prune() {
    const cutoff = this.now() - this.completedTtlMs;
    for (const [id, completedAt] of this.recentlyCompleted) if (completedAt < cutoff) this.recentlyCompleted.delete(id);
    while (this.recentlyCompleted.size > this.maxCompleted) this.recentlyCompleted.delete(this.recentlyCompleted.keys().next().value);
    while (this.lastTurnBySession.size > this.maxSessions) this.lastTurnBySession.delete(this.lastTurnBySession.keys().next().value);
  }
  check({ sessionId, requestId, clientTurn }) {
    this.prune();
    const session = String(sessionId);
    const id = String(requestId);
    if (this.byRequest.has(id) || this.recentlyCompleted.has(id)) return { ok: false, status: 409, error: "duplicate request" };
    let turn = null;
    if (clientTurn != null) {
      turn = Number(clientTurn);
      if (!Number.isSafeInteger(turn) || turn < 1) return { ok: false, status: 400, error: "invalid conversation turn" };
      const lastTurn = this.lastTurnBySession.get(session);
      if (lastTurn != null && turn <= lastTurn) return { ok: false, status: 409, error: "stale conversation turn" };
    }
    return { ok: true, session, id, turn };
  }
  rememberTurn(session, turn) {
    if (turn == null) return;
    this.lastTurnBySession.delete(session);
    this.lastTurnBySession.set(session, turn);
    this.prune();
  }
  rememberCompleted(id) {
    this.recentlyCompleted.delete(id);
    this.recentlyCompleted.set(id, this.now());
    this.prune();
  }
  admit({ sessionId, requestId, clientTurn, operation, replacePrevious = false }) {
    const checked = this.check({ sessionId, requestId, clientTurn });
    if (!checked.ok) return checked;
    const { session, id, turn } = checked;
    const previous = this.bySession.get(session) || null;
    if (previous && !replacePrevious) return { ok: false, status: 409, error: "an answer is already in progress for this conversation" };
    if (this.byRequest.size >= this.limit) return { ok: false, status: 429, error: "too many questions in flight" };
    const record = { sessionId: session, requestId: id, clientTurn: turn, operation };
    if (previous) previous.superseded = true;
    this.byRequest.set(id, record);
    this.bySession.set(session, record);
    this.rememberTurn(session, turn);
    return { ok: true, record, previous };
  }
  completeLocal({ sessionId, requestId, clientTurn, replacePrevious = false }) {
    const checked = this.check({ sessionId, requestId, clientTurn });
    if (!checked.ok) return checked;
    const previous = this.bySession.get(checked.session) || null;
    if (previous && !replacePrevious) return { ok: false, status: 409, error: "an answer is already in progress for this conversation" };
    if (previous) {
      previous.superseded = true;
      if (this.bySession.get(checked.session) === previous) this.bySession.delete(checked.session);
    }
    this.rememberTurn(checked.session, checked.turn);
    this.rememberCompleted(checked.id);
    return { ok: true, previous };
  }
  release(requestId, operation) {
    const record = this.byRequest.get(String(requestId));
    if (!record || record.operation !== operation) return false;
    const authoritative = !record.superseded && this.bySession.get(record.sessionId) === record;
    this.byRequest.delete(record.requestId);
    if (this.bySession.get(record.sessionId) === record) this.bySession.delete(record.sessionId);
    this.rememberCompleted(record.requestId);
    this.notifyEmpty();
    return authoritative;
  }
  whenEmpty() { return this.size === 0 ? Promise.resolve() : new Promise((resolve) => this.emptyWaiters.add(resolve)); }
  notifyEmpty() {
    if (this.size) return;
    for (const resolve of this.emptyWaiters) resolve();
    this.emptyWaiters.clear();
  }
}

/**
 * Every state-changing route spends the user's Claude credits, so a page on
 * another origin must not be able to drive it. Requests with no Origin header
 * (same-origin fetch, curl, the dream runner) are allowed; a cross-origin
 * Origin is refused. No CORS headers are ever sent, so no other origin can read
 * a response either.
 */
export function originAllowed(req, host) {
  const origin = req.headers?.origin;
  if (!origin) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

/** A JSON content type defeats the CORS-safelisted text/plain form post. */
export function isJsonRequest(req) {
  return String(req.headers?.["content-type"] || "").split(";")[0].trim().toLowerCase() === "application/json";
}

/**
 * Resolves a URL path inside `root`, or null if it escapes. Compares against
 * `root + separator` so a sibling directory sharing the prefix cannot pass.
 */
export function safeStaticPath(root, pathname) {
  const rel = pathname === "/" ? "/index.html" : pathname;
  let decoded;
  try { decoded = decodeURIComponent(rel); } catch { return null; }
  if (decoded.includes("\0")) return null;
  const file = path.normalize(path.join(root, decoded));
  return file === root || file.startsWith(root + path.sep) ? file : null;
}
