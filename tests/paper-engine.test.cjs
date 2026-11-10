const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("../js/paper-engine.js");
const Policy=require("../js/trading-policy.js");
const fixedDate=(day=10)=>new Date("2026-11-"+String(day).padStart(2,"0")+"T10:00:00Z");
test("uploaded policy defaults to 3 units and capital-protection settings",()=>{
 Engine.configure(Policy.DEFAULTS); const s=Engine.createState(fixedDate());
 assert.equal(s.cash,3); assert.equal(Engine.CONFIG.riskPerTradePct,.5);
 assert.equal(Engine.CONFIG.maxRiskPerTradePct,1); assert.equal(Engine.CONFIG.maxConcurrentRiskPct,2);
 assert.equal(Engine.CONFIG.dailyLossLimitPct,2); assert.equal(Engine.CONFIG.weeklyLossLimitPct,5);
 assert.equal(Engine.CONFIG.maxDrawdownPct,10); assert.equal(Engine.CONFIG.maxPositions,3);
});
test("compound projection is separate from actual equity and uses precise decimal arithmetic",()=>{
 Engine.configure(Policy.DEFAULTS); const s=Engine.createState(fixedDate());
 assert.equal(Policy.cycleTargetAmount(3,Policy.DEFAULTS),.09);
 assert.ok(Math.abs(Policy.theoreticalCompound(3,3,Policy.DEFAULTS)-3.278181)<1e-8);
 assert.equal(Engine.getSummary(s).equity,3);
 assert.notEqual(Engine.getSummary(s).equity,Policy.theoreticalCompound(3,3,Policy.DEFAULTS));
});
test("position sizing respects 0.5% risk and creates a protective 1:2 stop/target",()=>{
 Engine.configure({...Policy.DEFAULTS,initialCapital:1000,stopLossPct:1,commissionPctPerSide:0,slippagePctPerSide:0});
 const s=Engine.createState(fixedDate()),r=Engine.openPosition(s,"TEST",100,{TEST:100},fixedDate());
 assert.equal(r.ok,true); assert.ok(r.position.riskPct<=.5+1e-6);
 assert.ok(r.position.stopPrice<r.position.entryPrice);
 assert.ok(Math.abs((r.position.targetPrice-r.position.entryPrice)/(r.position.entryPrice-r.position.stopPrice)-2)<1e-8);
});
test("manual pause blocks new entries",()=>{
 Engine.configure({...Policy.DEFAULTS,initialCapital:100}); const s=Engine.createState(fixedDate());
 Engine.setManualPause(s,true,fixedDate());
 assert.deepEqual(Engine.openPosition(s,"TEST",10,{TEST:10},fixedDate()),{ok:false,reason:"MANUAL_PAUSE"});
});
test("duplicate positions and position cap are rejected",()=>{
 Engine.configure({...Policy.DEFAULTS,initialCapital:1000,stopLossPct:2,maxPositions:3,maxConcurrentRiskPct:2});
 const s=Engine.createState(fixedDate());
 assert.equal(Engine.openPosition(s,"A",100,{A:100},fixedDate()).ok,true);
 assert.deepEqual(Engine.openPosition(s,"A",100,{A:100},fixedDate()),{ok:false,reason:"DUPLICATE_POSITION"});
 assert.equal(Engine.openPosition(s,"B",100,{B:100},fixedDate()).ok,true);
 assert.equal(Engine.openPosition(s,"C",100,{C:100},fixedDate()).ok,true);
 assert.deepEqual(Engine.openPosition(s,"D",100,{D:100},fixedDate()),{ok:false,reason:"MAX_POSITIONS"});
});
test("maximum concurrent risk blocks entries beyond the configured cap",()=>{
 Engine.configure({...Policy.DEFAULTS,initialCapital:1000,stopLossPct:1,riskPerTradePct:.5,maxConcurrentRiskPct:.5});
 const s=Engine.createState(fixedDate());
 assert.equal(Engine.openPosition(s,"A",100,{A:100},fixedDate()).ok,true);
 assert.deepEqual(Engine.openPosition(s,"B",100,{B:100},fixedDate()),{ok:false,reason:"MAX_CONCURRENT_RISK"});
});
test("daily loss limit suspends new entries while drawdown high-water is retained",()=>{
 Engine.configure({...Policy.DEFAULTS,initialCapital:1000,stopLossPct:1,maxAccountDrawdownPct:10});
 const s=Engine.createState(fixedDate()); assert.equal(Engine.openPosition(s,"A",100,{A:100},fixedDate()).ok,true);
 const risk=Engine.refreshRisk(s,{A:95},fixedDate());
 assert.equal(s.dailyLocked,true); assert.equal(risk.paused,true); assert.equal(risk.pauseReason,"DAILY_LOSS_LIMIT");
 assert.equal(Engine.openPosition(s,"B",100,{B:100},fixedDate()).ok,false);
});
test("weekly loss lock remains until explicit strategy validation",()=>{
 Engine.configure({...Policy.DEFAULTS,initialCapital:1000,dailyLossLimitPct:10,maxAccountDrawdownPct:20,weeklyLossLimitPct:5});
 const s=Engine.createState(fixedDate()); s.cash=940;
 const risk=Engine.refreshRisk(s,{},fixedDate());
 assert.equal(s.weeklyRiskLocked,true); assert.equal(risk.pauseReason,"WEEKLY_LOSS_LIMIT");
 assert.equal(Engine.validateRecovery(s,{},fixedDate(),false).ok,false);
 assert.equal(Engine.validateRecovery(s,{},fixedDate(16),true).ok,true);
});
test("5% drawdown reduces risk to 0.25% without hard locking before 10%",()=>{
 Engine.configure({...Policy.DEFAULTS,initialCapital:1000,dailyLossLimitPct:10,weeklyLossLimitPct:20,drawdownReduceRiskAtPct:5,reducedRiskPerTradePct:.25,maxAccountDrawdownPct:10});
 const s=Engine.createState(fixedDate()); s.cash=940; const risk=Engine.refreshRisk(s,{},fixedDate());
 assert.equal(risk.drawdownPct,6); assert.equal(risk.effectiveRiskPct,.25); assert.equal(s.hardDrawdownLocked,false);
});
test("10% account drawdown activates a hard circuit breaker",()=>{
 Engine.configure({...Policy.DEFAULTS,initialCapital:1000}); const s=Engine.createState(fixedDate()); s.cash=890;
 const risk=Engine.refreshRisk(s,{},fixedDate());
 assert.equal(s.hardDrawdownLocked,true); assert.equal(risk.pauseReason,"MAX_DRAWDOWN");
 assert.deepEqual(Engine.openPosition(s,"A",10,{A:10},fixedDate()),{ok:false,reason:"MAX_DRAWDOWN"});
});
test("three consecutive losses pause entries and five lock the strategy",()=>{
 Engine.configure({...Policy.DEFAULTS,initialCapital:1000,stopLossPct:5,commissionPctPerSide:0,slippagePctPerSide:0,dailyLossLimitPct:10,weeklyLossLimitPct:20,maxAccountDrawdownPct:30,maxConsecutiveLossesPause:3,maxConsecutiveLossesLock:5});
 const s=Engine.createState(fixedDate(1));
 for(let i=0;i<3;i++){const day=fixedDate(i+1),symbol="LOSS"+i;const e=Engine.openPosition(s,symbol,100,{[symbol]:100},day);assert.equal(e.ok,true);assert.equal(Engine.closePosition(s,e.position.id,99,day).ok,true);}
 assert.equal(s.currentConsecutiveLosses,3); assert.equal(Engine.openPosition(s,"BLOCKED",100,{BLOCKED:100},fixedDate(4)).ok,false);
 assert.equal(Engine.validateRecovery(s,{},fixedDate(4),true).ok,true);
 for(let i=3;i<5;i++){const day=fixedDate(i+1),symbol="LOSS"+i;const e=Engine.openPosition(s,symbol,100,{[symbol]:100},day);assert.equal(e.ok,true);Engine.closePosition(s,e.position.id,99,day);}
 assert.equal(s.strategyLocked,true); assert.equal(Engine.openPosition(s,"LOCKED",100,{LOCKED:100},fixedDate(6)).ok,false);
});
test("normalization resets unknown schemas to configured starting capital",()=>{
 Engine.configure({...Policy.DEFAULTS,initialCapital:3}); const now=fixedDate();
 assert.equal(Engine.normalizeState({version:99},now).cash,3);
 const s=Engine.createState(now);s.events=Array.from({length:150},(_,i)=>({at:"",type:"INFO",message:"event "+i}));
 assert.equal(Engine.normalizeState(s,now).events.length,Engine.CONFIG.maxEvents);
});
