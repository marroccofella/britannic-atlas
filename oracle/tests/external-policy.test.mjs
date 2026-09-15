import { test } from "node:test";
import assert from "node:assert/strict";
import { publicManxClaimsForVisual, sanitisePublicSourceUrl } from "../lib/external-policy.mjs";

test("public source URLs lose credentials, queries and fragments while private origins are rejected", () => {
  assert.equal(sanitisePublicSourceUrl("https://user:pass@example.test/ports?token=secret#private"), "https://example.test/ports");
  assert.equal(sanitisePublicSourceUrl("http://127.0.0.1:4242/private"), "");
  assert.equal(sanitisePublicSourceUrl("file:///C:/private.txt"), "");
});

test("canvas review receives only safe public Manx claim and source metadata", () => {
  const rows = publicManxClaimsForVisual([
    { jurisdiction: "IM", status: "verified", text: "A public Manx fact.", verified_at: "2026-09-03", sources: [{ url: "https://www.gov.im/maps", publisher: "Isle of Man Government", title: "Maps" }] },
    { jurisdiction: "IM", status: "verified", text: "A source with private metadata.", sources: [{ url: "https://example.test/data", publisher: "My email me@example.test", title: "Private" }] },
    { jurisdiction: "IM", status: "verified", text: "A local-only source.", sources: [{ url: "http://localhost:4242/data", publisher: "Local", title: "Local" }] },
  ]);
  assert.deepEqual(rows, [{
    text: "A public Manx fact.", status: "verified", verified_at: "2026-09-03",
    sources: [{ publisher: "Isle of Man Government", title: "Maps" }],
  }]);
  assert.doesNotMatch(JSON.stringify(rows), /me@example|localhost|https?:\/\//);
});
