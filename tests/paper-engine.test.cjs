const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("../js/paper-engine.js");
const prices = (symbols, value) => Object.fromEntries(symbols.map(symbol => [symbol, value]));

test("new paper account starts with configured virtual cash", () => {
  const state=Engine.createState(new Date("2026-11-10T10:00:00Z"));
  assert.equal(Engine.getEquity(state),1000);
  assert.equal(state.positions.length,0);
  assert.equal(state.manualPaused,false);
});
test("paper entry sizes notional to 1% of equity and records simulated costs", () => {
  const now=new Date("2026-11-10T10:00:00Z"),state=Engine.createState(now);
  const result=Engine.openPosition(state,"SOLX",1,{SOLX:1},now);
  assert.equal(result.ok,true);assert.equal(result.position.notional,10);
  assert.ok(result.position.entryPrice>1);assert.ok(state.cash<990);assert.equal(state.positions.length,1);
});
test("manual pause blocks new entries", () => {
  const now=new Date("2026-11-10T10:00:00Z"),state=Engine.createState(now);
  Engine.setManualPause(state,true,now);
  assert.deepEqual(Engine.openPosition(state,"SOLX",1,{SOLX:1},now),{ok:false,reason:"MANUAL_PAUSE"});
});
test("engine enforces concurrent-position cap", () => {
  const now=new Date("2026-11-10T10:00:00Z"),state=Engine.createState(now);
  for(const symbol of ["A","B","C"])assert.equal(Engine.openPosition(state,symbol,1,{[symbol]:1},now).ok,true);
  assert.deepEqual(Engine.openPosition(state,"D",1,{D:1},now),{ok:false,reason:"MAX_POSITIONS"});
});
test("severe portfolio loss activates a sticky risk lock", () => {
  const now=new Date("2026-11-10T10:00:00Z"),state=Engine.createState(now);
  for(const symbol of ["A","B","C"])Engine.openPosition(state,symbol,1,{[symbol]:1},now);
  const snap=Engine.refreshRisk(state,prices(["A","B","C"],0.1),now);
  assert.equal(state.riskLocked,true);assert.equal(snap.pauseReason,"DAILY_LOSS_LIMIT");
  assert.equal(Engine.openPosition(state,"D",1,{D:1},now).ok,false);
});
test("close records net PnL after entry/exit fees and slippage", () => {
  const now=new Date("2026-11-10T10:00:00Z"),state=Engine.createState(now);
  const opened=Engine.openPosition(state,"SOLX",1,{SOLX:1},now);
  const result=Engine.closePosition(state,opened.position.id,1,now);
  assert.equal(result.ok,true);assert.ok(result.trade.pnl<0);assert.equal(state.positions.length,0);
  assert.equal(state.closedTrades[0].pnl,result.trade.pnl);assert.ok(Engine.getSummary(state).realizedPnl<0);
});
test("invalid market prices are rejected", () => {
  const state=Engine.createState();
  assert.deepEqual(Engine.openPosition(state,"SOLX",0,{},new Date()),{ok:false,reason:"INVALID_MARKET_DATA"});
});
test("UTC day rollover resets daily reference and preserves high-water mark", () => {
  const d1=new Date("2026-11-10T22:00:00Z"),d2=new Date("2026-11-11T00:01:00Z"),state=Engine.createState(d1);
  state.highWaterEquity=1200;state.cash=950;Engine.refreshRisk(state,{},d2);
  assert.equal(state.dayKey,"2026-11-11");assert.equal(state.dayStartEquity,950);assert.equal(state.highWaterEquity,1200);
});
test("normalization resets unknown schema and bounds persisted collections", () => {
  const now=new Date("2026-11-10T10:00:00Z");
  assert.equal(Engine.normalizeState({version:99},now).cash,1000);
  const state=Engine.createState(now);
  state.events=Array.from({length:150},(_,i)=>({at:"",type:"INFO",message:"event "+i}));
  assert.equal(Engine.normalizeState(state,now).events.length,Engine.CONFIG.maxEvents);
});