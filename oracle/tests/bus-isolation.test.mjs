import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Bus, attachBus } from "../lib/bus.mjs";

class Response extends EventEmitter {
  constructor(onWrite = null) {
    super();
    this.body = "";
    this.onWrite = onWrite;
  }
  writeHead(status, headers) { this.status = status; this.headers = headers; }
  write(chunk) {
    this.body += chunk;
    this.onWrite?.(String(chunk));
    return true;
  }
}

function connect(bus, sessionId = null, { since = 0, onWrite = null } = {}) {
  const query = new URLSearchParams({ since: String(since) });
  if (sessionId !== null) query.set("sessionId", sessionId);
  const req = { url: `/api/events?${query}`, headers: {} };
  const res = new Response(onWrite);
  attachBus(bus, req, res);
  return res;
}

function ids(body) {
  return [...body.matchAll(/^id: (\d+)$/gm)].map((match) => Number(match[1]));
}

test("replayed and re-entrant live SSE events are delivered in strictly increasing order", () => {
  const bus = new Bus();
  bus.publish("first", { value: 1 });
  bus.publish("second", { value: 2 });
  let publishedDuringReplay = false;
  const res = connect(bus, null, {
    onWrite(chunk) {
      if (!publishedDuringReplay && chunk.includes("id: 1\n")) {
        publishedDuringReplay = true;
        bus.publish("live", { value: 3 });
      }
    },
  });
  res.emit("close");
  assert.deepEqual(ids(res.body), [1, 2, 3]);
});

test("SSE replay and live delivery expose private events only to the exact opaque session", () => {
  const bus = new Bus();
  bus.publish("public.status", { state: "ready" });
  bus.publish("expedition.preview", {
    sessionId: "Session-A ",
    question: "SECRET-A-QUESTION",
    sources: [{ url: "https://secret-a.invalid/source" }],
  });
  bus.publish("expedition.preview", {
    sessionId: "session-a",
    question: "SECRET-B-QUESTION",
    sources: [{ url: "https://secret-b.invalid/source" }],
  });

  const exact = connect(bus, "Session-A ");
  assert.match(exact.body, /event: public\.status/);
  assert.match(exact.body, /SECRET-A-QUESTION/);
  assert.doesNotMatch(exact.body, /SECRET-B-QUESTION|secret-b\.invalid|"sessionId":"session-a"/);

  const other = connect(bus, "session-a");
  assert.match(other.body, /SECRET-B-QUESTION/);
  assert.doesNotMatch(other.body, /SECRET-A-QUESTION|secret-a\.invalid|"sessionId":"Session-A "/);

  const anonymous = connect(bus);
  assert.match(anonymous.body, /event: public\.status/);
  assert.doesNotMatch(anonymous.body, /SECRET-[AB]-QUESTION|secret-[ab]\.invalid|sessionId/);

  bus.publish("expedition.finished", {
    sessionId: "session-a",
    question: "SECRET-B-LIVE",
    sources: [{ url: "https://secret-b.invalid/live" }],
  });
  bus.publish("expedition.finished", {
    sessionId: "Session-A ",
    question: "SECRET-A-LIVE",
    sources: [{ url: "https://secret-a.invalid/live" }],
  });
  exact.emit("close");
  other.emit("close");
  anonymous.emit("close");
  assert.match(exact.body, /SECRET-A-LIVE/);
  assert.doesNotMatch(exact.body, /SECRET-B-LIVE|secret-b\.invalid\/live/);
  assert.match(other.body, /SECRET-B-LIVE/);
  assert.doesNotMatch(other.body, /SECRET-A-LIVE|secret-a\.invalid\/live/);
  assert.doesNotMatch(anonymous.body, /SECRET-[AB]-LIVE|secret-[ab]\.invalid\/live/);

});

test("an expired replay window emits a content-free resync marker before retained events", () => {
  const bus = new Bus(2);
  bus.publish("expired.private", { sessionId: "other", question: "DO-NOT-LEAK" });
  bus.publish("retained.public", { value: 2 });
  bus.publish("retained.mine", { sessionId: "mine", value: 3 });
  const res = connect(bus, "mine", { since: 0 });
  res.emit("close");
  assert.deepEqual(ids(res.body), [1, 2, 3]);
  assert.match(res.body, /id: 1\nevent: resync/);
  assert.match(res.body, /"reason":"replay_window_missed"/);
  assert.doesNotMatch(res.body, /DO-NOT-LEAK|expired\.private|question|sources?/);
});

test("SSE responses prevent the opaque session URL becoming a referrer", () => {
  const bus = new Bus();
  const res = connect(bus, "private-session");
  res.emit("close");
  assert.equal(res.status, 200);
  assert.equal(res.headers["Referrer-Policy"], "no-referrer");
});
