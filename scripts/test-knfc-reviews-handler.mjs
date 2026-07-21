/**
 * Smoke-test KNFC reviews handler (no network). Run: node scripts/test-knfc-reviews-handler.mjs
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const handler = require("../landing-knfcpilot/api/reviews.js").default;

function mockRes() {
  const state = { statusCode: 200, headers: {}, body: null };
  return {
    state,
    setHeader(k, v) {
      state.headers[k] = v;
    },
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(body) {
      state.body = body;
      return this;
    },
  };
}

const getRes = mockRes();
await handler({ method: "GET" }, getRes);
if (getRes.state.statusCode !== 200 || !Array.isArray(getRes.state.body)) {
  console.error("FAIL: GET expected 200 + array, got", getRes.state);
  process.exit(1);
}

const postRes = mockRes();
await handler(
  {
    method: "POST",
    on(event, cb) {
      if (event === "data") cb(JSON.stringify({ name: "Test", text: "Hi", rating: 5 }));
      if (event === "end") cb();
    },
  },
  postRes
);
if (postRes.state.statusCode !== 200 || !postRes.state.body?.ok) {
  console.error("FAIL: POST expected 200 ok, got", postRes.state);
  process.exit(1);
}

console.log("OK: KNFC reviews handler GET/POST smoke test passed.");
