const fs = require("node:fs");
const assert = require("node:assert/strict");
const html = fs.readFileSync("index.html", "utf8");
const paperEngine = fs.readFileSync("js/paper-engine.js", "utf8");
const goldEngine = fs.readFileSync("js/gold-engine.js", "utf8");
const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));
const sw = fs.readFileSync("service-worker.js", "utf8");

for (const id of ["equity","realized","unrealized","positions","dailyLossValue","drawdownValue","riskReason","storageStatus","assetselect","resetpaper","livefetch","liveDataAge"]) {
  assert.match(html, new RegExp('id="' + id + '"'), "missing Solana UI element: " + id);
}
for (const id of ["gold","goldTrades","goldPrice","goldMonitorToggle","goldMonitorStatus","goldSignal","goldPaperBuy","goldPaperSell","goldOpenPositions","goldTradeHistory","goldResetPaper"]) {
  assert.match(html, new RegExp('id="' + id + '"'), "missing Gold UI element: " + id);
}
assert.match(html, /src="js\/paper-engine\.js"/, "paper engine must load from same origin");
assert.match(html, /src="js\/gold-engine\.js"/, "gold engine must load from same origin");
assert.match(html, /manifest\.webmanifest/, "PWA manifest must be linked");
assert.match(html, /serviceWorker\.register/, "PWA service worker registration must exist");
assert.match(html, /Content-Security-Policy/, "CSP must be present");
assert.match(html, /api\.dexscreener\.com/, "Solana public provider must be explicit");
assert.match(html, /xaus\.com/, "Gold reference provider must be explicit");
assert.match(paperEngine, /function openPosition/, "Solana paper entry function missing");
assert.match(paperEngine, /function closePosition/, "Solana paper close function missing");
assert.match(goldEngine, /function analyze/, "gold analysis function missing");
assert.match(goldEngine, /function openPaperTrade/, "gold paper entry missing");
assert.match(goldEngine, /function closePaperTrade/, "gold paper close missing");
assert.match(goldEngine, /dailyLossPct/, "gold daily loss limit missing");
assert.match(goldEngine, /maxDrawdownPct/, "gold drawdown limit missing");
assert.match(goldEngine, /INTRADAY_STALE/, "gold stale feed check missing");
assert.match(manifest.display, /standalone/, "PWA must support standalone display");
assert.match(sw, /if\(url\.origin!==self\.location\.origin\)return/, "service worker must not cache external market data");
assert.doesNotMatch(paperEngine + goldEngine, /sendTransaction|signTransaction|wallet\.adapter|OrderSend/i, "live transaction capability must not be added");
console.log("Static smoke checks passed for Solana + Gold phone app.");
