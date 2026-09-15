// Tiny event bus with a replay buffer, exposed to the browser over SSE.
import { EventEmitter } from "node:events";

export class Bus extends EventEmitter {
  constructor(keep = 200) { super(); this.keep = keep; this.buffer = []; this.seq = 0; this.setMaxListeners(100); }
  publish(type, data = {}) {
    const event = { seq: ++this.seq, at: new Date().toISOString(), type, ...data };
    this.buffer.push(event); if (this.buffer.length > this.keep) this.buffer.shift();
    // A subscriber that throws (a closed SSE socket, a UI hook) must not
    // unwind the publisher: an expedition that had just recorded "done" was
    // being re-recorded as "failed, $0" by exactly that.
    // rawListeners keeps once() wrappers (so they still unsubscribe) and the
    // call preserves the emitter as `this`, exactly as emit() would.
    for (const listener of this.rawListeners("event")) { try { listener.call(this, event); } catch { /* subscriber failure is the subscriber's */ } }
    return event;
  }
  since(seq) { return this.buffer.filter((e) => e.seq > seq); }
}

export function sseStart(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "Referrer-Policy": "no-referrer",
  });
  res.write(": ok\n\n");
  const ping = setInterval(() => { try { res.write(`event: heartbeat\ndata: ${JSON.stringify({at:new Date().toISOString()})}\n\n`); } catch { /* closed */ } }, 5_000);
  res.on("close", () => clearInterval(ping));
  return (event, data, id = data?.seq) => {
    try {
      const eventId = Number(id);
      const idLine = Number.isSafeInteger(eventId) && eventId >= 0 ? `id: ${eventId}\n` : "";
      res.write(`${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch { /* closed */ }
  };
}

const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function subscriberSession(req) {
  const value = new URL(req.url, "http://x").searchParams.get("sessionId");
  return value == null || value === "" ? null : value.slice(0, 80);
}

function visibleTo(event, sessionId) {
  if (!owns(event, "sessionId")) return true;
  return sessionId !== null && event.sessionId === sessionId;
}

export function attachBus(bus, req, res) {
  const send = sseStart(res);
  const header = Array.isArray(req.headers?.["last-event-id"]) ? req.headers["last-event-id"].at(-1) : req.headers?.["last-event-id"];
  const requestUrl = new URL(req.url, "http://x");
  const query = requestUrl.searchParams.get("since");
  const parsed = Number(header == null || header === "" ? query || 0 : header);
  const since = Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
  const sessionId = subscriberSession(req);
  let replaying = true;
  let draining = false;
  let closed = false;
  let lastSent = since;
  const pending = [];

  const drain = () => {
    if (replaying || draining || closed) return;
    draining = true;
    try {
      while (!closed && pending.length) {
        const event = pending.shift();
        if (event.seq <= lastSent) continue;
        send(event.type, event, event.seq);
        lastSent = event.seq;
      }
    } finally {
      draining = false;
    }
  };
  const enqueue = (event) => {
    if (!visibleTo(event, sessionId) || !Number.isSafeInteger(event.seq) || event.seq <= lastSent) return;
    const existing = pending.findIndex((candidate) => candidate.seq === event.seq);
    if (existing !== -1) return;
    const insertion = pending.findIndex((candidate) => candidate.seq > event.seq);
    if (insertion === -1) pending.push(event);
    else pending.splice(insertion, 0, event);
    drain();
  };

  // Subscribe before taking the high-water mark. Live events that arrive while
  // retained events are being written join the same ordered delivery queue.
  const listener = (event) => enqueue(event);
  bus.on("event", listener);
  const highWater = bus.seq;
  const close = () => {
    closed = true;
    pending.length = 0;
    bus.off("event", listener);
  };
  res.on("close", close);

  const firstRetained = bus.buffer[0]?.seq ?? highWater + 1;
  if (highWater > since && since < firstRetained - 1) {
    enqueue({
      seq: firstRetained - 1,
      at: new Date().toISOString(),
      type: "resync",
      reason: "replay_window_missed",
    });
  }
  for (const event of bus.since(since)) if (event.seq <= highWater) enqueue(event);
  replaying = false;
  drain();
}
