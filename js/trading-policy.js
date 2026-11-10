/* ROAD Trading Policy — shared defaults and validation for paper engines.
 * Defaults mirror the uploaded trading specification. Values are simulation settings only.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.RoadTradingPolicy=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const DEFAULTS=Object.freeze({
    initialCapital:3,
    targetCycleGrowthPct:3,
    cyclesPerDay:10,
    tradingDaysPerMonth:30,
    autoReinvest:true,
    riskPerTradePct:0.5,
    maxRiskPerTradePct:1,
    maxConcurrentRiskPct:2,
    dailyLossLimitPct:2,
    weeklyLossLimitPct:5,
    maxAccountDrawdownPct:10,
    drawdownReduceRiskAtPct:5,
    reducedRiskPerTradePct:0.25,
    maxPositions:3,
    maxPositionExposurePct:100,
    stopLossPct:0.5,
    minimumRiskReward:2,
    maxConsecutiveLossesPause:3,
    maxConsecutiveLossesLock:5,
    commissionPctPerSide:0.1,
    slippagePctPerSide:0.05,
    martingaleEnabled:false,
    lossRecoveryEnabled:false,
    averagingDownEnabled:false,
    automaticEmergencyStop:true
  });
  const DEFINITIONS=Object.freeze({
    initialCapital:{min:0.01,max:100000000,step:0.01,group:"capital"},
    targetCycleGrowthPct:{min:0.1,max:25,step:0.1,group:"capital"},
    cyclesPerDay:{min:1,max:100,step:1,group:"capital"},
    tradingDaysPerMonth:{min:1,max:31,step:1,group:"capital"},
    riskPerTradePct:{min:0.05,max:1,step:0.05,group:"risk"},
    maxRiskPerTradePct:{min:0.1,max:1,step:0.1,group:"risk"},
    maxConcurrentRiskPct:{min:0.1,max:5,step:0.1,group:"risk"},
    dailyLossLimitPct:{min:0.1,max:10,step:0.1,group:"risk"},
    weeklyLossLimitPct:{min:0.5,max:20,step:0.5,group:"risk"},
    maxAccountDrawdownPct:{min:1,max:30,step:0.5,group:"risk"},
    drawdownReduceRiskAtPct:{min:0.5,max:15,step:0.5,group:"risk"},
    reducedRiskPerTradePct:{min:0.05,max:0.5,step:0.05,group:"risk"},
    maxPositions:{min:1,max:10,step:1,group:"risk"},
    maxPositionExposurePct:{min:10,max:100,step:5,group:"risk"},
    stopLossPct:{min:0.05,max:10,step:0.05,group:"execution"},
    minimumRiskReward:{min:1,max:10,step:0.25,group:"execution"},
    maxConsecutiveLossesPause:{min:1,max:10,step:1,group:"risk"},
    maxConsecutiveLossesLock:{min:2,max:20,step:1,group:"risk"},
    commissionPctPerSide:{min:0,max:2,step:0.01,group:"execution"},
    slippagePctPerSide:{min:0,max:2,step:0.01,group:"execution"}
  });
  const SCALE=100000000n;
  const round8=n=>Math.round((Number(n)+Number.EPSILON)*1e8)/1e8;
  const floor8=n=>Math.floor((Number(n)+Number.EPSILON)*1e8)/1e8;
  const ceil8=n=>Math.ceil((Number(n)-Number.EPSILON)*1e8)/1e8;
  function scaled(value){
    const s=Number(value).toFixed(8),negative=s.startsWith("-"),body=negative?s.slice(1):s;
    const [whole,fraction=""]=body.split(".");
    const out=BigInt(whole||"0")*SCALE+BigInt((fraction+"00000000").slice(0,8));
    return negative?-out:out;
  }
  function fromScaled(value){return Number(value)/Number(SCALE);}
  function compoundFixed(initialCapital,ratePct,cycles){
    let amount=scaled(initialCapital),factor=SCALE+scaled(Number(ratePct)/100),n=BigInt(cycles);
    for(let i=0n;i<n;i++)amount=(amount*factor+SCALE/2n)/SCALE;
    return fromScaled(amount);
  }
  function normalize(input){
    const source=input&&typeof input==="object"?input:{};
    const out={...DEFAULTS};
    for(const [key,rule] of Object.entries(DEFINITIONS)){
      if(source[key]===undefined)continue;
      const n=Number(source[key]);
      if(Number.isFinite(n))out[key]=round8(Math.min(rule.max,Math.max(rule.min,n)));
    }
    for(const key of ["autoReinvest","martingaleEnabled","lossRecoveryEnabled","averagingDownEnabled","automaticEmergencyStop"]){
      if(typeof source[key]==="boolean")out[key]=source[key];
    }
    out.maxRiskPerTradePct=Math.max(out.riskPerTradePct,out.maxRiskPerTradePct);
    out.riskPerTradePct=Math.min(out.riskPerTradePct,out.maxRiskPerTradePct);
    out.reducedRiskPerTradePct=Math.min(out.reducedRiskPerTradePct,out.riskPerTradePct);
    out.maxConcurrentRiskPct=Math.max(out.maxConcurrentRiskPct,out.riskPerTradePct);
    out.maxAccountDrawdownPct=Math.max(out.maxAccountDrawdownPct,out.drawdownReduceRiskAtPct+0.5);
    out.maxConsecutiveLossesLock=Math.max(out.maxConsecutiveLossesLock,out.maxConsecutiveLossesPause+1);
    // Hard prohibitions in this version: no martingale, recovery sizing or averaging down.
    out.martingaleEnabled=false;
    out.lossRecoveryEnabled=false;
    out.averagingDownEnabled=false;
    out.automaticEmergencyStop=true;
    return Object.freeze(out);
  }
  function theoreticalCompound(initialCapital,cycleCount,settings){
    const p=normalize(settings||DEFAULTS),n=Math.max(0,Math.floor(Number(cycleCount)||0));
    const value=Number(initialCapital);
    if(!Number.isFinite(value)||value<0)return null;
    // Projection only. This must never be used as live/actual equity.
    return round8(compoundFixed(value,p.targetCycleGrowthPct,n));
  }
  function cycleTargetAmount(baseCapital,settings){
    const p=normalize(settings||DEFAULTS),base=Number(baseCapital);
    if(!Number.isFinite(base)||base<0)return null;
    return round8(fromScaled((scaled(base)*scaled(p.targetCycleGrowthPct))/(SCALE*100n)));
  }
  function positionSizing({equity,availableCash,entryPrice,stopPrice,riskPct,maxExposurePct,feePct,slippagePct}={}){
    const eq=Number(equity),cash=Number(availableCash),entry=Number(entryPrice),stop=Number(stopPrice);
    const rp=Number(riskPct),exp=Number(maxExposurePct),fee=Number(feePct)||0,slip=Number(slippagePct)||0;
    if(![eq,cash,entry,stop,rp,exp].every(Number.isFinite)||eq<=0||cash<=0||entry<=0||stop<=0||entry===stop||rp<=0||exp<=0)
      return {ok:false,reason:"INVALID_SIZING_INPUT"};
    const stopDistance=Math.abs(entry-stop);
    const riskBudget=eq*rp/100;
    // Add estimated round-trip costs to the stop-distance loss budget.
    const costPerUnit=entry*((2*fee+2*slip)/100);
    const riskPerUnit=stopDistance+costPerUnit;
    const rawQty=riskBudget/riskPerUnit;
    const exposureCap=eq*exp/100;
    const cashCap=cash/(1+fee/100);
    const notionalCap=Math.min(rawQty*entry,exposureCap,cashCap);
    if(!Number.isFinite(notionalCap)||notionalCap<=0)return {ok:false,reason:"POSITION_SIZE_ZERO"};
    // Round quantity DOWN so precision cannot push the order beyond the risk budget.
    const quantity=floor8(notionalCap/entry);
    const notional=floor8(quantity*entry);
    const rawEstimatedStopLoss=quantity*(stopDistance+costPerUnit);
    const estimatedStopLoss=ceil8(rawEstimatedStopLoss);
    const actualRiskPct=rawEstimatedStopLoss/eq*100;
    if(actualRiskPct>rp+1e-7)return {ok:false,reason:"RISK_BUDGET_EXCEEDED"};
    return {ok:true,quantity,notional:round8(notional),riskBudget:round8(riskBudget),
      estimatedStopLoss,actualRiskPct,stopDistance,exposurePct:round8(notional/eq*100)};
  }
  return Object.freeze({DEFAULTS,DEFINITIONS,normalize,theoreticalCompound,cycleTargetAmount,positionSizing,round8});
});
