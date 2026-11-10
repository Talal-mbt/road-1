const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("../js/paper-engine.js");
const Policy=require("../js/trading-policy.js");
const fixedDate=(day=10)=>new Date("2026-11-"+String(day).padStart(2,"0")+"T10:00:00Z");

test("uploaded policy defaults to 3 units and capital-protection settings",()=>{
 Engine.configure(Policy.DEFAULTS);
 const s=Engine.createState(fixedDate());
 assert.equal(s.cash,3);
 assert.equal(Engine.CONFIG.riskPerTradePct,.5);
 assert.equal(Engine.CONFIG.maxRiskPerTradePct,1);
 assert.equal(Engine.CONFIG.maxConcurrentRiskPct,2);
 assert.equal(Engine.CONFIG.dailyLossLimitPct,2);
 assert.equal(Engine.CONFIG.weeklyLossLimitPct,5);
 assert.equal(Engine.CONFIG.maxDrawdownPct,10);
 assert.equal(Engine.CONFIG.maxPositions,3);
});

test("compound projection is separate from actual equity and uses precise decimal arithmetic",()=>{
 const p=Policy.normalize(Policy.DEFAULTS);
 assert.equal(Policy.cycleTargetAmount(3,p),.09);
 assert.ok(Math.abs(Policy.theoreticalCompound(3,3,p)-3.278181)<1e-8);
 const state=Engine.createState(fixedDate());
 assert.equal(Engine.getSummary(state).equity,3);
 assert.notEqual(Engine.getSummary(state).equity,Policy.theoreticalCompound(3,3,p));
});

test("position sizing respects 0.5% risk and creates a protective 1:2 stop/target",()=>{
 Engine.configure({...Policy.DEFAULTS,initialCapital:1000,stopLossPct:1,commissionPctPerSide:0,slippagePctPerSide:0});
 const state=Engine.createState(fixedDate()),opened=Engine.openPosition(state,"TEST",100,{TEST:100},fixedDate());
 assert.equal(opened.ok,true);
 assert.ok(opened.position.riskPct<=.5+1e-6);
 assert.ok(opened.position.stopPrice<opened.position.entryPrice);
 assert.ok(Math.abs((opened.position.targetPrice-opened.position.entryPrice)/
  (opened.position.entryPrice-opened.position.stopPrice)-2)<1e-8);
});

test("manual pause blocks new entries",()=>{
 Engine.configure({...Policy.DEFAULTS,initialCapital:100});
 const state=Engine.createState(fixedDate());
 Engine.setManualPause(state,true,fixedDate());
 assert.deepEqual(Engine.openPosition(state,"TEST",10,{TEST:10},fixedDate()),{ok:false,reason:"MANUAL_PAUSE"});
});

test("duplicate positions and position cap are rejected",()=>{
 Engine.configure({...Policy.DEFAULTS,initialCapital:1000,stopLossPct:2,maxPositions:3,maxConcurrentRiskPct:2});
 const state=Engine.createState(fixedDate());
 assert.equal(Engine.openPosition(state,"A",100,{A:100},fixedDate()).ok,true);
 assert.deepEqual(Engine.openPosition(state,"A",100,{A:100},fixedDate()),{ok:false,reason:"DUPLICATE_POSITION"});
 assert.equal(Engine.openPosition(state,"B",100,{B:100},fixedDate()).ok,true);
 assert.equal(Engine.openPosition(state,"C",100,{C:100},fixedDate()).ok,true);
 assert.deepEqual(Engine.openPosition(state,"D",100,{D:100},fixedDate()),{ok:false,reason:"MAX_POSITIONS"});
});

test("maximum concurrent risk blocks entries beyond 2% equity",()=>{
 Engine.configure({...Policy.DEFAULTS,initialCapital:1000,stopLossPct:1,riskPerTradePct:.5,maxConcurrentRiskPct:1});
 const state=Engine.createState(fixedDate());
 assert.equal(Engine.openPosition(state,"A",100,{A:100},fixedDate()).ok,true);
 assert.deepEqual(Engine.openPosition(state,"B",100,{B:100},fixedDate()),{ok:false,reason:"MAX_CONCURRENT_RISK"});
});

test("daily loss limit suspends new entries while drawdown high-water is retained",()=>{
 Engine.configure({...Policy.DEFAULTS,initialCapital:1000,stopLossPct:1,maxAccountDrawdownPct:10});
 const state=Engine.createState(fixedDate());
 assert.equal(Engine.openPosition(state,"A",100,{A:100},fixedDate()).ok,true);
 const snap=Engine.refreshRisk(state,{A:97},fixedDate());
 assert.equal(state.dailyLocked,true);
 assert.equal(snap.paused,true);
 assert.equal(snap.pauseReason,"DAILY_LOSS_LIMIT");
 assert.equal(Engine.openPosition(state,"B",100,{B:100},fixedDate()).ok,false);
});

test("weekly loss lock remains until explicit strategy validation",()=>{
 Engine.configure({...Policy.DEFAULTS,initialCapital:1000,stopLossPct:1,maxAccountDrawdownPct:20,weeklyLossLimitPct:5});
 const state=Engine.createState(fixedDate());
 state.cash=940;
 const risk=Engine.refreshRisk(state,{},fixedDate());
 assert.equal(state.weeklyRiskLocked,true);
 assert.equal(risk.pauseReason,"WEEKLY_LOSS_LIMIT");
 assert.equal(Engine.validateRecovery(state,{},fixedDate(),false).ok,false);
 assert.equal(Engine.validateRecovery(state,{},fixedDate(),true).ok,true);
});

test("5% drawdown reduces risk to 0.25% without hard locking before 10%",()=>{
 Engine.configure({...Policy.DEFAULTS,initialCapital:1000,drawdownReduceRiskAtPct:5,reducedRiskPerTradePct:.25,maxAccountDrawdownPct:10});
 const state=Engine.createState(fixedDate());state.cash=940;
 const risk=Engine.refreshRisk(state,{},fixedDate());
 assert.equal(risk.drawdownPct,6);
 assert.equal(risk.effectiveRiskPct,.25);
 assert.equal(state.hardDrawdownLocked,false);
});

test("10% account drawdown activates a hard circuit breaker",()=>{
 Engine.configure({...Policy.DEFAULTS,initialCapital:1000,maxAccountDrawdownPct:10});
 const state=Engine.createState(fixedDate());state.cash=890;
 const risk=Engine.refreshRisk(state,{},fixedDate());
 assert.equal(state.hardDrawdownLocked,true);
 assert.equal(risk.pauseReason,"MAX_DRAWDOWN");
 assert.equal(Engine.openPosition(state,"A",10,{A:10},fixedDate()),{ok:false,reason:"MAX_DRAWDOWN"});
});

test("three consecutive losses pause entries and five lock strategy",()=>{
 Engine.configure({...Policy.DEFAULTS,initialCapital:1000,stopLossPct:5,commissionPctPerSide:0,slippagePctPerSide:0,
   dailyLossLimitPct:10,weeklyLossLimitPct:20,maxAccountDrawdownPct:30,maxConsecutiveLossesPause:3,maxConsecutiveLossesLock:5});
 const state=Engine.createState(fixedDate(1));
 for(let i=0;i<3;i++){
  const day=fixedDate(i+1),symbol="LOSS"+i;
  const entry=Engine.openPosition(state,symbol,100,{[symbol]:100},day);
  assert.equal(entry.ok,true);
  const closed=Engine.closePosition(state,entry.position.id,99,day);
  assert.equal(closed.ok,true);
 }
 assert.equal(state.currentConsecutiveLosses,3);
 assert.equal(Engine.openPosition(state,"BLOCKED",100,{BLOCKED:100},fixedDate(4)).ok,false);
 for(let i=3;i<5;i++){
  const day=fixedDate(i+1),symbol="LOSS"+i;
  const entry=Engine.openPosition(state,symbol,100,{[symbol]:100},day);
  assert.equal(entry.ok,true);
  Engine.closePosition(state,entry.position.id,99,day);
 }
 assert.equal(state.strategyLocked,true);
 assert.equal(Engine.openPosition(state,"LOCKED",100,{LOCKED:100},fixedDate(6)).ok,false);
});

test("normalization resets unknown schemas to configured starting capital",()=>{
 Engine.configure({...Policy.DEFAULTS,initialCapital:3});
 const now=fixedDate();
 assert.equal(Engine.normalizeState({version:99},now).cash,3);
 const state=Engine.createState(now);
 state.events=Array.from({length:150},(_,i)=>({at:"",type:"INFO",message:"event "+i}));
 assert.equal(Engine.normalizeState(state,now).events.length,Engine.CONFIG.maxEvents);
});
