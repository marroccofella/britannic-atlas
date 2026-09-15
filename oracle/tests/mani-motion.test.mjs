// The Three Legs turning is the only visual sign that Oracle is working. It
// never appeared for the user because prefers-reduced-motion is off by default
// on many Windows machines and silently disabled the whole indicator. The
// system preference is now the default rather than the verdict.
//
// These tests drive the animation with a fake clock: requestAnimationFrame does
// not fire in a hidden browser pane, so a browser check cannot prove this.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createManiVisual } from "../public/mani-visual.mjs";

const ORACLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readSource = (file) => readFileSync(path.join(ORACLE, file), "utf8");

function harness({ systemReducedMotion = false, hidden = false } = {}) {
  const attrs = {};
  const rotor = { setAttribute: (key, value) => { attrs[key] = value; } };
  const button = { querySelector: () => rotor, dataset: {}, style: { setProperty() {} } };
  let queue = [], now = 0;
  const platform = {
    matchMedia: () => ({ matches: systemReducedMotion, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: (fn) => queue.push(fn),
    cancelAnimationFrame: () => { queue = []; },
    performance: { now: () => now },
    document: { hidden, addEventListener() {}, removeEventListener() {} },
  };
  const visual = createManiVisual(button, platform);
  const pump = (ms) => { for (let i = 0; i < ms / 16; i += 1) { now += 16; const due = queue; queue = []; for (const fn of due) fn(now); } };
  const angle = () => Number((attrs.transform || "rotate(0)").replace(/[^\d.]/g, ""));
  return { visual, pump, angle, button };
}

test("the Three Legs turn while Oracle is thinking", () => {
  const { visual, pump, angle } = harness();
  assert.equal(angle(), 0);
  visual.setState("thinking");
  pump(1000);
  const afterOne = angle();
  assert.ok(afterOne > 30, `expected visible rotation after a second, got ${afterOne}`);
  pump(1000);
  assert.ok(angle() > afterOne, "and it keeps turning while the wait continues");
});

test("listening and idle never rotate like computation", () => {
  const { visual, pump, angle } = harness();
  visual.setState("listening");
  pump(600);
  const moved = angle();
  assert.equal(moved, 0, "listening has separate leg movement, never rotor spin");
  visual.setState("idle");
  pump(600);
  assert.equal(angle(), moved, "idle holds still");
});

test("typing gives feedback without computation rotation", () => {
  const {visual,pump,angle}=harness();
  visual.inputPulse("typing");pump(300);
  assert.equal(angle(),0,"typing must not masquerade as computation");
  visual.clearInput("typing");const stopped=angle();pump(500);
  assert.equal(angle(),stopped,"clearing the input stops the idle rotor");
  visual.setMotionPreference("off");visual.inputPulse("typing");pump(500);
  assert.equal(angle(),stopped,"Never animate remains authoritative");
});

test("a reduced-motion system default can be overridden in both directions", () => {
  const { visual, pump, angle } = harness({ systemReducedMotion: true });
  visual.setState("thinking");
  pump(1000);
  assert.equal(angle(), 0, "the system preference is honoured by default");

  visual.setMotionPreference("on");
  pump(1000);
  const animated = angle();
  assert.ok(animated > 30, `an explicit choice to animate must win, got ${animated}`);

  visual.setMotionPreference("off");
  pump(1000);
  assert.equal(angle(), animated, "and an explicit choice to stop must also win");

  visual.setMotionPreference("auto");
  pump(1000);
  assert.equal(angle(), animated, "auto returns to following the system, which here says reduce");
});

test("an invalid preference falls back to following the system", () => {
  const { visual, pump, angle } = harness({ systemReducedMotion: true });
  visual.setState("thinking");
  visual.setMotionPreference("sideways");
  pump(1000);
  assert.equal(angle(), 0);
  assert.equal(visual.reducedMotion, true);
});

test("a hidden tab never animates, whatever the preference", () => {
  const { visual, pump, angle } = harness({ hidden: true });
  visual.setMotionPreference("on");
  visual.setState("thinking");
  pump(1000);
  assert.equal(angle(), 0, "battery and CPU are not spent on an unseen animation");
});

test("the control is offered in the interface and remembered", () => {
  const html = readSource("public/index.html"), app = readSource("public/app.js");
  assert.match(html, /id="motionPreference"/);
  assert.match(html, /value="auto"[^>]*>Auto \(follow system\)/);
  assert.match(app, /maniVisual\.setMotionPreference\(choice\)/);
  assert.match(app, /localStorage\.setItem\("oracle\.motion", choice\)/);
});
