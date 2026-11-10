const test=require("node:test");
const assert=require("node:assert/strict");
const Gold=require("../js/gold-engine.js");
function series(n=120,base=4000,step=.1){
 const now=Date.now();return Array.from({length:n},(_,i)=>({t:now-(n-i)*120000,p:base+i*step+1.5*Math.sin(i*.7)}));
}
test("normalizes epoch timestamps and removes duplicate timestamps",()=>{
 const now=Date.now(),p=Gold.normalizePoints([{t:Math.floor(now/1000),p:4000},{t:Math.floor(now/1000),p:4001},{t:Math.floor(now/1000)-120,p:3999}]);
 assert.equal(p.length,2);assert.equal(p.at(-1).price,4001);
});
test("requires sufficient recent indicative data before analysis",()=>{
 assert.deepEqual(Gold.analyze(series(20)),{ok:false,reason:"INSUFFICIENT_HISTORY",samples:20});
});
test("identifies bullish alignment without calling it a win probability",()=>{
 const result=Gold.analyze(series(120,4000,.1));
 assert.equal(result.ok,true);assert.equal(result.signal,"BUY_BIAS");assert.ok(result.alignmentScore<=100);
 assert.equal(Object.hasOwn(result,"winProbability"),false);
});
test("feed validator rejects stale spot prices",()=>{
 const now=Date.now(),old=new Date(now-600000).toISOString();
 const result=Gold.validateFeed({spot_usd_oz:4000,price_as_of:old,data_state:{status:"fresh"}},
 {points:series().map(x=>({t:x.t/1000,p:x.p})),data_state:{status:"fresh"}},now);
 assert.deepEqual(result,{ok:false,reason:"SPOT_STALE"});
});
test("feed validator rejects stale intraday samples",()=>{
 const now=Date.now(),points=series().map(x=>({t:(x.t-600000)/1000,p:x.p}));
 const result=Gold.validateFeed({spot_usd_oz:4000,price_as_of:new Date(now).toISOString(),data_state:{status:"fresh"}},
 {points,data_state:{status:"fresh"}},now);
 assert.equal(result.ok,false);assert.equal(result.reason,"INTRADAY_STALE");
});
test("paper positions are capped and remain local",()=>{
 const now=new Date(),s=Gold.createPaperState(now);
 for(let i=0;i<3;i++)assert.equal(Gold.openPaperTrade(s,"BUY",4000,now).ok,true);
 assert.deepEqual(Gold.openPaperTrade(s,"BUY",4000,now),{ok:false,reason:"MAX_POSITIONS"});
});
test("paper trade uses explicit simulated stop and target",()=>{
 const now=new Date(),s=Gold.createPaperState(now),r=Gold.openPaperTrade(s,"BUY",4000,now);
 assert.equal(r.ok,true);assert.ok(r.position.stop<4000);assert.ok(r.position.target>4000);
 const result=Gold.checkStops(s,r.position.target,now);
 assert.equal(result.length,1);assert.equal(result[0].reason,"SIMULATED_TARGET");assert.equal(s.positions.length,0);
});
test("manual close books net simulated result after fee assumptions",()=>{
 const now=new Date(),s=Gold.createPaperState(now),r=Gold.openPaperTrade(s,"SELL",4000,now);
 const close=Gold.closePaperTrade(s,r.position.id,3980,"MANUAL",now);
 assert.equal(close.ok,true);assert.ok(close.trade.pnl>0);assert.equal(s.history.length,1);
});
test("identifies bearish alignment from a falling reference series",()=>{
 const now=Date.now(),points=Array.from({length:120},(_,i)=>({t:now-(120-i)*120000,p:4200-i*.1+1.5*Math.sin(i*.7+2)}));
 const result=Gold.analyze(points);assert.equal(result.ok,true);assert.equal(result.signal,"SELL_BIAS");
});
test("requires explicit fresh-state metadata from both providers",()=>{
 const now=Date.now(),points=series().map(x=>({t:x.t/1000,p:x.p}));
 const spot={spot_usd_oz:4000,price_as_of:new Date(now).toISOString(),data_state:{status:"fresh"}};
 assert.equal(Gold.validateFeed(spot,{points},now).reason,"INTRADAY_NOT_FRESH");
});
test("unknown schema resets paper account instead of trusting bad storage",()=>{
 const s=Gold.normalizePaperState({version:44,cash:999999});
 assert.equal(s.cash,Gold.CONFIG.virtualStartingCash);assert.equal(s.positions.length,0);
});
test("daily loss or drawdown lock blocks new paper positions",()=>{
 const now=new Date(),s=Gold.createPaperState(now);
 s.cash=900; s.highWaterEquity=1000;
 const risk=Gold.updateRisk(s,4000,now);
 assert.equal(risk.locked,true);
 assert.deepEqual(Gold.openPaperTrade(s,"BUY",4000,now),{ok:false,reason:"RISK_LOCKED"});
});
