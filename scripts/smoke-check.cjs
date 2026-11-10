const fs = require("node:fs");
const assert = require("node:assert/strict");
const html = fs.readFileSync("index.html", "utf8");
const engine = fs.readFileSync("js/paper-engine.js", "utf8");
for (const id of ["equity","realized","unrealized","positions","dailyLossValue","drawdownValue","riskReason","storageStatus","assetselect","resetpaper","livefetch","liveDataAge"]) {
  assert.match(html, new RegExp('id="' + id + '"'), "missing required UI element: " + id);
}
assert.match(html, /src="js\/paper-engine\.js"/, "paper engine must be loaded as a same-origin script");
assert.match(html, /Content-Security-Policy/, "CSP must be present");
assert.match(html, /api\.dexscreener\.com/, "public provider must be explicit");
assert.match(engine, /function openPosition/, "paper engine entry function missing");
assert.match(engine, /function closePosition/, "paper engine close function missing");
assert.match(engine, /dailyLossLimitPct/, "daily loss circuit breaker missing");
assert.match(engine, /maxDrawdownPct/, "drawdown circuit breaker missing");
assert.doesNotMatch(engine, /sendTransaction|signTransaction|wallet\.adapter/i, "live wallet execution must not be added to paper engine");
console.log("Static smoke checks passed.");
