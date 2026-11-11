const test=require("node:test");
const assert=require("node:assert/strict");
const P=require("../js/trading-policy.js");
test("uploaded defaults match the capital and risk specification",()=>{
 const s=P.normalize(P.DEFAULTS);
 assert.equal(s.initialCapital,3); assert.equal(s.targetCycleGrowthPct,3);
 assert.equal(s.cyclesPerDay,10); assert.equal(s.tradingDaysPerMonth,30);
 assert.equal(s.riskPerTradePct,.5); assert.equal(s.maxRiskPerTradePct,1);
 assert.equal(s.maxConcurrentRiskPct,2); assert.equal(s.dailyLossLimitPct,2);
 assert.equal(s.weeklyLossLimitPct,5); assert.equal(s.drawdownReduceRiskAtPct,5);
 assert.equal(s.reducedRiskPerTradePct,.25); assert.equal(s.maxAccountDrawdownPct,10);
 assert.equal(s.maxConsecutiveLossesPause,3); assert.equal("maxConsecutiveLossesLock" in s,false);
 assert.equal(s.minimumRiskReward,2);
 assert.equal(s.martingaleEnabled,false); assert.equal(s.lossRecoveryEnabled,false); assert.equal(s.averagingDownEnabled,false);
});
test("theoretical compounding uses fixed decimal arithmetic",()=>{
 const s=P.normalize(P.DEFAULTS);
 assert.equal(P.cycleTargetAmount(3,s),.09);
 assert.ok(Math.abs(P.theoreticalCompound(3,3,s)-3.278181)<1e-8);
 assert.ok(Math.abs(P.theoreticalCompound(3,10,s)-4.031)<.001);
});
test("settings normalize unsafe values and enforce hard prohibitions",()=>{
 const s=P.normalize({riskPerTradePct:1.5,maxRiskPerTradePct:.2,reducedRiskPerTradePct:.9,maxConcurrentRiskPct:.1,maxPositions:100,martingaleEnabled:true,lossRecoveryEnabled:true,averagingDownEnabled:true});
 assert.equal(s.riskPerTradePct,1); assert.equal(s.maxRiskPerTradePct,1);
 assert.equal(s.reducedRiskPerTradePct,.5); assert.equal(s.maxConcurrentRiskPct,1);
 assert.equal(s.maxPositions,10); assert.equal(s.martingaleEnabled,false);
 assert.equal(s.lossRecoveryEnabled,false); assert.equal(s.averagingDownEnabled,false);
});
test("position sizing stays within the configured risk budget",()=>{
 const result=P.positionSizing({equity:1000,availableCash:1000,entryPrice:100,stopPrice:99.5,riskPct:.5,maxExposurePct:100,feePct:.1,slippagePct:.05});
 assert.equal(result.ok,true); assert.ok(result.actualRiskPct<=.5+1e-8);
 assert.ok(result.notional<=1000); assert.ok(result.quantity>0);
});
test("invalid position sizing input fails closed",()=>{
 assert.deepEqual(P.positionSizing({equity:100,availableCash:100,entryPrice:10,stopPrice:10,riskPct:.5,maxExposurePct:100}),{ok:false,reason:"INVALID_SIZING_INPUT"});
});
