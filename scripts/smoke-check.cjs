const fs = require("node:fs");
const assert = require("node:assert/strict");
const html = fs.readFileSync("index.html", "utf8");
const tradingPolicy = fs.readFileSync("js/trading-policy.js", "utf8");
const paperEngine = fs.readFileSync("js/paper-engine.js", "utf8");
const goldEngine = fs.readFileSync("js/gold-engine.js", "utf8");
const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));
const sw = fs.readFileSync("service-worker.js", "utf8");
const scripts = html.split("<script>").slice(1).map(part => part.split("</script>")[0]).filter(script => script.trim());

for (const id of ["equity","realized","unrealized","positions","dailyLossValue","drawdownValue","riskReason","storageStatus","assetselect","resetpaper","livefetch","liveDataAge"]) {
  assert.match(html, new RegExp('id="' + id + '"'), "missing Solana UI element: " + id);
}
for (const id of ["gold","goldTrades","goldPrice","goldMonitorToggle","goldMonitorStatus","goldSignal","goldPaperBuy","goldPaperSell","goldOpenPositions","goldTradeHistory","goldResetPaper"]) {
  assert.match(html, new RegExp('id="' + id + '"'), "missing Gold UI element: " + id);
}

assert.match(html, /<html lang="ar" dir="rtl">/, "app shell should be Arabic-first and RTL");
for (const id of ["sidebar","drawerScrim","closeMenu","menu","crumb","subtitle","marketSearch"]) {
  assert.match(html, new RegExp('id="' + id + '"'), "missing redesigned navigation/search element: " + id);
}
assert.match(html, /class="home-hero"/, "home hero is missing");
assert.match(html, /class="feature-grid"/, "quick navigation cards are missing");
assert.match(html, /class="mobile-bottom"/, "mobile bottom navigation is missing");
assert.match(html, /transform:translateX\(110%\)/, "mobile drawer must be off-canvas when closed");
assert.match(html, /class="drawer-scrim"/, "mobile drawer must have a scrim");
assert.match(html, /function setDrawer\(open\)/, "drawer controller is missing");
assert.match(html, /function applyMarketSearch\(\)/, "market search controller is missing");
const bottomNav = html.split('<nav class="mobile-bottom"')[1]?.split("</nav>")[0] || "";
assert.equal((bottomNav.match(/data-page=/g) || []).length, 5, "mobile nav should have five main destinations");
assert.ok(scripts.length >= 1, "application script is missing");
for (const script of scripts) new Function(script);

assert.match(html, /src="js\/trading-policy\.js"/, "shared trading policy must load before paper engines");
assert.match(html, /src="js\/paper-engine\.js"/, "paper engine must load from same origin");
assert.match(html, /src="js\/gold-engine\.js"/, "gold engine must load from same origin");
assert.match(html, /manifest\.webmanifest/, "PWA manifest must be linked");
assert.match(html, /serviceWorker\.register/, "PWA service worker registration must exist");
assert.match(html, /Content-Security-Policy/, "CSP must be present");
assert.match(html, /api\.dexscreener\.com/, "Solana public provider must be explicit");
assert.match(html, /xaus\.com/, "Gold reference provider must be explicit");
assert.match(tradingPolicy, /initialCapital:3/, "initial capital default is missing");
assert.match(tradingPolicy, /targetCycleGrowthPct:3/, "cycle growth target default is missing");
assert.match(paperEngine, /function openPosition/, "Solana paper entry function missing");
assert.match(paperEngine, /function closePosition/, "Solana paper close function missing");
assert.match(goldEngine, /function analyze/, "gold analysis function missing");
assert.match(goldEngine, /function openPaperTrade/, "gold paper entry missing");
assert.match(goldEngine, /function closePaperTrade/, "gold paper close missing");
assert.match(goldEngine, /dailyLossPct/, "gold daily loss limit missing");
assert.match(goldEngine, /maxDrawdownPct/, "gold drawdown limit missing");
assert.match(goldEngine, /INTRADAY_STALE/, "gold stale feed check missing");
assert.match(manifest.display, /standalone/, "PWA must support standalone display");
assert.match(sw, /road-shell-v6/, "PWA cache namespace must include new trading policy module");
assert.match(sw, /js\/trading-policy\.js/, "PWA shell must cache the shared trading policy");
assert.equal(manifest.short_name, "ROAD", "PWA short name must be ROAD");
assert.match(manifest.name, /^ROAD —/, "PWA display name must start with ROAD");
assert.ok(html.includes("<title>ROAD — Gold &amp; Market Intelligence</title>"), "browser title must use ROAD identity");
assert.ok(html.includes('<div class="brand-mini"><span class="brand-mini-icon">R</span><div><b>ROAD</b>'), "top brand must show ROAD");
assert.ok(html.includes('<div class="brand-copy"><strong>ROAD</strong>'), "drawer brand must show ROAD");
assert.doesNotMatch(html, /ROAD TO CASH|Road to Cash/i, "legacy product name must not appear in the app UI");
assert.ok(html.includes("function migrateLegacyStorage()"), "legacy local storage migration must be present");
assert.ok(html.includes('const STORAGE_KEY="road.paper.v1"'), "paper state must use ROAD storage namespace");
assert.ok(html.includes('const GOLD_PAPER_KEY="road.gold-paper.v1"'), "Gold paper state must use ROAD storage namespace");
assert.match(sw, /if\(url\.origin!==self\.location\.origin\)return/, "service worker must not cache external market data");
assert.doesNotMatch(paperEngine + goldEngine, /sendTransaction|signTransaction|wallet\.adapter|OrderSend/i, "live transaction capability must not be added");

assert.match(html, /id="policyInitialCapital"/, "capital must be editable inside the app");
assert.match(html, /id="currentPaperEquity"/, "current paper equity must be visible");
assert.match(html, /id="resetAllPaper"/, "app must provide explicit capital reinitialization control");
assert.match(html, /function savePolicy\(\)/, "trading policy settings must be savable");
assert.match(html, /function validateRiskRecovery\(\)/, "risk recovery review must be available");
assert.match(html, /id="languageToggle"/, "Arabic/English toggle is missing");
assert.match(html, /function applyLanguage\(\)/, "language controller is missing");
assert.match(html, /function setDrawer\(open\)/, "drawer controller is missing");
assert.match(html, /function decorateNavigationIcons\(\)/, "SVG navigation icon decorator is missing");
assert.match(html, /id="networkStatus"/, "online/offline status indicator is missing");
assert.match(html, /addEventListener\("offline"/, "offline event handler is missing");
assert.match(html, /addEventListener\("online"/, "online event handler is missing");
assert.match(html, /id="networkBanner"/, "offline banner is missing");
assert.match(html, /Times New Roman/, "English font fallback must use Times New Roman");
assert.match(html, /Noto Sans Arabic/, "Arabic font fallback must use a readable Arabic sans font");
assert.match(html, /id="mt5ProfilesList"/, "local MT5 profile list is missing");
assert.match(html, /function saveMt5Profile\(\)/, "local MT5 profile save handler is missing");
assert.match(html, /road\.mt5\.profiles\.v1/, "MT5 profile storage key is missing");
assert.doesNotMatch(html, /location\.reload\s*\(/, "ordinary updates must never reload the whole page");
assert.doesNotMatch(html, /setInterval\([^;]*render\(\)[^;]*,\s*5000\)/, "full app rendering must not run on a short polling timer");
assert.match(html, /if\(!navigator\.onLine\)/, "market data requests must fail closed while offline");
assert.match(html, /abort\(\)/, "in-flight market requests must be cancellable");

console.log("Static smoke checks passed for Solana + Gold phone app.");
