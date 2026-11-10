/* ROAD — long-only paper portfolio engine with configurable risk controls.
 * No wallet, broker session, private key, order signer or live transaction capability.
 */
(function(root,factory){
  const api=factory(root&&root.RoadTradingPolicy);
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.PaperEngine=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(Policy){
  "use strict";
  const DEFAULTS={
    initialCapital:3,targetCycleGrowthPct:3,cyclesPerDay:10,tradingDaysPerMonth:30,autoReinvest:true,
    riskPerTradePct:.5,maxRiskPerTradePct:1,maxConcurrentRiskPct:2,dailyLossLimitPct:2,
    weeklyLossLimitPct:5,maxAccountDrawdownPct:10,drawdownReduceRiskAtPct:5,reducedRiskPerTradePct:.25,
    maxPositions:3,maxPositionExposurePct:100,stopLossPct:.5,minimumRiskReward:2,
    maxConsecutiveLossesPause:3,maxConsecutiveLossesLock:5,commissionPctPerSide:.1,slippagePctPerSide:.05,
    martingaleEnabled:false,lossRecoveryEnabled:false,averagingDownEnabled:false,automaticEmergencyStop:true
  };
  let POLICY=Policy?Policy.normalize(DEFAULTS):Object.freeze({...DEFAULTS});
  const MAX_CLOSED=500,MAX_EVENTS=120;
  const finite=n=>Number.isFinite(Number(n));
  const positive=n=>finite(n)&&Number(n)>0;
  const round=n=>Math.round((Number(n)+Number.EPSILON)*1e8)/1e8;
  const utcDay=d=>new Date(d).toISOString().slice(0,10);
  function isoWeek(d){
    const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));
    const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);
    const yearStart=new Date(Date.UTC(x.getUTCFullYear(),0,1));
    return x.getUTCFullYear()+"-W"+String(Math.ceil((((x-yearStart)/86400000)+1)/7)).padStart(2,"0");
  }
  function configure(settings){POLICY=Policy?Policy.normalize(settings):Object.freeze({...DEFAULTS,...settings});return POLICY;}
  function getConfig(){return Object.freeze({startingCash:POLICY.initialCapital,maxPositions:POLICY.maxPositions,
    dailyLossLimitPct:POLICY.dailyLossLimitPct,weeklyLossLimitPct:POLICY.weeklyLossLimitPct,
    maxDrawdownPct:POLICY.maxAccountDrawdownPct,feeRate:POLICY.commissionPctPerSide/100,
    slippageRate:POLICY.slippagePctPerSide/100,minimumNotional:.01,maxClosedTrades:MAX_CLOSED,maxEvents:MAX_EVENTS,
    riskPerTradePct:POLICY.riskPerTradePct,maxRiskPerTradePct:POLICY.maxRiskPerTradePct,
    maxConcurrentRiskPct:POLICY.maxConcurrentRiskPct,minimumRiskReward:POLICY.minimumRiskReward});}
  function createState(now=new Date()){
    const cash=round(POLICY.initialCapital),day=utcDay(now),week=isoWeek(now);
    return {version:2,initialCapital:cash,cash,positions:[],closedTrades:[],events:[],
      manualPaused:false,riskLocked:false,riskLockReason:"",dailyLocked:false,weeklyRiskLocked:false,
      hardDrawdownLocked:false,strategyLocked:false,consecutiveLossPause:false,currentConsecutiveLosses:0,
      dayKey:day,dayStartEquity:cash,weekKey:week,weekStartEquity:cash,highWaterEquity:cash,
      completedCycles:0,createdAt:now.toISOString(),updatedAt:now.toISOString()};
  }
  function normalizeState(raw,now=new Date()){
    if(!raw||(raw.version!==1&&raw.version!==2)||!finite(raw.cash)||Number(raw.cash)<0)return createState(now);
    const positions=Array.isArray(raw.positions)?raw.positions.slice(-POLICY.maxPositions).filter(p=>
      p&&typeof p.id==="string"&&typeof p.symbol==="string"&&positive(p.qty)&&positive(p.entryPrice)&&positive(p.notional)&&finite(p.entryFee)
    ).map(p=>{
      const entry=Number(p.entryPrice),stop=positive(p.stopPrice)?Number(p.stopPrice):entry*(1-POLICY.stopLossPct/100);
      const target=positive(p.targetPrice)?Number(p.targetPrice):entry+(entry-stop)*POLICY.minimumRiskReward;
      return {id:p.id,symbol:p.symbol.slice(0,64),qty:Number(p.qty),entryPrice:entry,notional:Number(p.notional),
        entryFee:Math.max(0,Number(p.entryFee)),stopPrice:stop,targetPrice:target,
        riskAmount:positive(p.riskAmount)?Number(p.riskAmount):Number(p.qty)*Math.abs(entry-stop),
        openedAt:String(p.openedAt||"")};
    }):[];
    const closedTrades=Array.isArray(raw.closedTrades)?raw.closedTrades.slice(0,MAX_CLOSED).filter(t=>
      t&&typeof t.id==="string"&&typeof t.symbol==="string"&&finite(t.pnl)
    ).map(t=>({id:t.id,symbol:t.symbol.slice(0,64),pnl:Number(t.pnl),closedAt:String(t.closedAt||"")})):[];
    const events=Array.isArray(raw.events)?raw.events.slice(0,MAX_EVENTS).filter(e=>e&&typeof e.message==="string")
      .map(e=>({at:String(e.at||""),type:String(e.type||"INFO").slice(0,24),message:e.message.slice(0,240)})):[];
    const initial=positive(raw.initialCapital)?Number(raw.initialCapital):POLICY.initialCapital;
    const day=utcDay(now),week=isoWeek(now);
    return {version:2,initialCapital:initial,cash:round(Math.max(0,Number(raw.cash))),positions,closedTrades,events,
      manualPaused:raw.manualPaused===true,riskLocked:raw.riskLocked===true,
      riskLockReason:String(raw.riskLockReason||"").slice(0,64),
      dailyLocked:raw.dailyLocked===true,weeklyRiskLocked:raw.weeklyRiskLocked===true,
      hardDrawdownLocked:raw.hardDrawdownLocked===true,strategyLocked:raw.strategyLocked===true,
      consecutiveLossPause:raw.consecutiveLossPause===true,currentConsecutiveLosses:Math.max(0,Math.floor(Number(raw.currentConsecutiveLosses)||0)),
      dayKey:/^\d{4}-\d{2}-\d{2}$/.test(String(raw.dayKey))?raw.dayKey:day,
      dayStartEquity:positive(raw.dayStartEquity)?Number(raw.dayStartEquity):initial,
      weekKey:/^\d{4}-W\d{2}$/.test(String(raw.weekKey))?raw.weekKey:isoWeek(now),
      weekStartEquity:positive(raw.weekStartEquity)?Number(raw.weekStartEquity):initial,
      highWaterEquity:positive(raw.highWaterEquity)?Number(raw.highWaterEquity):initial,
      completedCycles:Math.max(0,Math.floor(Number(raw.completedCycles)||0)),
      createdAt:String(raw.createdAt||now.toISOString()),updatedAt:now.toISOString()};
  }
  function getEquity(state,prices={}){
    return round(Number(state.cash)+state.positions.reduce((total,p)=>{
      const mark=positive(prices[p.symbol])?Number(prices[p.symbol]):p.entryPrice;
      return total+p.qty*mark;
    },0));
  }
  function positionRiskAmount(position){
    return positive(position.riskAmount)?Number(position.riskAmount):Number(position.qty)*Math.abs(Number(position.entryPrice)-Number(position.stopPrice||position.entryPrice));
  }
  function getRiskSnapshot(state,prices={}){
    const equity=getEquity(state,prices);
    const dailyLossPct=state.dayStartEquity>0?Math.max(0,(state.dayStartEquity-equity)/state.dayStartEquity*100):0;
    const weeklyLossPct=state.weekStartEquity>0?Math.max(0,(state.weekStartEquity-equity)/state.weekStartEquity*100):0;
    const drawdownPct=state.highWaterEquity>0?Math.max(0,(state.highWaterEquity-equity)/state.highWaterEquity*100):0;
    const openRisk=state.positions.reduce((sum,p)=>sum+positionRiskAmount(p),0);
    const openRiskPct=equity>0?openRisk/equity*100:100;
    let pauseReason="";
    if(state.hardDrawdownLocked)pauseReason="MAX_DRAWDOWN";
    else if(state.weeklyRiskLocked)pauseReason="WEEKLY_LOSS_LIMIT";
    else if(state.strategyLocked)pauseReason="CONSECUTIVE_LOSS_STRATEGY_LOCK";
    else if(state.dailyLocked)pauseReason="DAILY_LOSS_LIMIT";
    else if(state.consecutiveLossPause)pauseReason="CONSECUTIVE_LOSS_PAUSE";
    else if(state.manualPaused)pauseReason="MANUAL_PAUSE";
    const effectiveRiskPct=drawdownPct>=POLICY.drawdownReduceRiskAtPct?POLICY.reducedRiskPerTradePct:POLICY.riskPerTradePct;
    return {equity,dailyLossPct,weeklyLossPct,drawdownPct,openRisk,openRiskPct,
      dailyLimitPct:POLICY.dailyLossLimitPct,weeklyLimitPct:POLICY.weeklyLossLimitPct,
      maxDrawdownPct:POLICY.maxAccountDrawdownPct,drawdownReduceAtPct:POLICY.drawdownReduceRiskAtPct,
      effectiveRiskPct,consecutiveLosses:state.currentConsecutiveLosses,
      paused:!!pauseReason,pauseReason};
  }
  function refreshRisk(state,prices={},now=new Date()){
    const today=utcDay(now),week=isoWeek(now),equity=getEquity(state,prices);
    if(state.dayKey!==today){state.dayKey=today;state.dayStartEquity=equity;state.dailyLocked=false;}
    if(state.weekKey!==week){state.weekKey=week;state.weekStartEquity=equity;}
    if(equity>state.highWaterEquity)state.highWaterEquity=equity;
    const snap=getRiskSnapshot(state,prices);
    if(snap.dailyLossPct>=POLICY.dailyLossLimitPct)state.dailyLocked=true;
    if(snap.weeklyLossPct>=POLICY.weeklyLossLimitPct)state.weeklyRiskLocked=true;
    if(snap.drawdownPct>=POLICY.maxAccountDrawdownPct)state.hardDrawdownLocked=true;
    if(state.currentConsecutiveLosses>=POLICY.maxConsecutiveLossesLock)state.strategyLocked=true;
    if(state.currentConsecutiveLosses>=POLICY.maxConsecutiveLossesPause)state.consecutiveLossPause=true;
    const final=getRiskSnapshot(state,prices);
    state.riskLocked=state.dailyLocked||state.weeklyRiskLocked||state.hardDrawdownLocked||state.strategyLocked;
    state.riskLockReason=state.hardDrawdownLocked?"MAX_DRAWDOWN":state.weeklyRiskLocked?"WEEKLY_LOSS_LIMIT":
      state.strategyLocked?"CONSECUTIVE_LOSS_STRATEGY_LOCK":state.dailyLocked?"DAILY_LOSS_LIMIT":"";
    state.updatedAt=now.toISOString();
    return {...final,paused:final.paused||state.riskLocked,riskLocked:state.riskLocked,riskLockReason:state.riskLockReason};
  }
  function setManualPause(state,paused,now=new Date()){
    state.manualPaused=paused===true;state.updatedAt=now.toISOString();
    return getRiskSnapshot(state).paused;
  }
  function validateRecovery(state,prices={},now=new Date(),strategyValidated=false){
    const snap=refreshRisk(state,prices,now);
    const safe=snap.dailyLossPct<POLICY.dailyLossLimitPct&&snap.weeklyLossPct<POLICY.weeklyLossLimitPct&&
      snap.drawdownPct<POLICY.maxAccountDrawdownPct&&(state.currentConsecutiveLosses<POLICY.maxConsecutiveLossesPause||strategyValidated===true);
    if(!safe)return {ok:false,reason:"RISK_CONDITIONS_NOT_RECOVERED"};
    if((state.weeklyRiskLocked||state.hardDrawdownLocked||state.strategyLocked||state.consecutiveLossPause)&&strategyValidated!==true)
      return {ok:false,reason:"EXPLICIT_STRATEGY_VALIDATION_REQUIRED"};
    state.dailyLocked=false;state.weeklyRiskLocked=false;state.hardDrawdownLocked=false;state.strategyLocked=false;
    state.consecutiveLossPause=false;state.currentConsecutiveLosses=0;state.riskLocked=false;state.riskLockReason="";
    return {ok:true};
  }
  function openPosition(state,symbol,midPrice,prices={},now=new Date()){
    if(typeof symbol!=="string"||!symbol.trim()||!positive(midPrice))return {ok:false,reason:"INVALID_MARKET_DATA"};
    const risk=refreshRisk(state,prices,now);
    if(risk.paused)return {ok:false,reason:risk.pauseReason||"PAUSED"};
    if(state.positions.length>=POLICY.maxPositions)return {ok:false,reason:"MAX_POSITIONS"};
    if(state.positions.some(p=>p.symbol===symbol.trim()))return {ok:false,reason:"DUPLICATE_POSITION"};
    const markPrices={...prices,[symbol]:Number(midPrice)},equity=getEquity(state,markPrices);
    const riskBasis=POLICY.autoReinvest?equity:Math.min(equity,state.initialCapital);
    const riskPct=Math.min(POLICY.maxRiskPerTradePct,risk.effectiveRiskPct);
    const entry=Number(midPrice)*(1+POLICY.slippagePctPerSide/100);
    const stop=entry*(1-POLICY.stopLossPct/100);
    const target=entry+(entry-stop)*POLICY.minimumRiskReward;
    const sizing=Policy?Policy.positionSizing({equity:riskBasis,availableCash:state.cash,entryPrice:entry,stopPrice:stop,
      riskPct,maxExposurePct:POLICY.maxPositionExposurePct,feePct:POLICY.commissionPctPerSide,slippagePct:POLICY.slippagePctPerSide})
      :{ok:false,reason:"POLICY_HELPER_UNAVAILABLE"};
    if(!sizing.ok)return {ok:false,reason:sizing.reason};
    const openRisk=state.positions.reduce((sum,p)=>sum+positionRiskAmount(p),0);
    const concurrentLimit=equity*POLICY.maxConcurrentRiskPct/100;
    if(openRisk+sizing.estimatedStopLoss>concurrentLimit+1e-8)return {ok:false,reason:"MAX_CONCURRENT_RISK"};
    const notional=round(sizing.notional),entryFee=round(notional*POLICY.commissionPctPerSide/100),qty=round(sizing.quantity);
    if(!positive(qty)||!positive(notional)||state.cash<notional+entryFee)return {ok:false,reason:"INSUFFICIENT_PAPER_CASH"};
    const position={id:"paper-"+now.getTime()+"-"+Math.random().toString(36).slice(2,9),
      symbol:symbol.trim().slice(0,64),qty,entryPrice:entry,notional,entryFee,stopPrice:stop,targetPrice:target,
      riskAmount:sizing.estimatedStopLoss,riskPct:sizing.actualRiskPct,openedAt:now.toISOString()};
    state.cash=round(state.cash-notional-entryFee);state.positions.push(position);state.updatedAt=now.toISOString();
    refreshRisk(state,markPrices,now);
    return {ok:true,position,risk:getRiskSnapshot(state,markPrices)};
  }
  function closePosition(state,positionId,midPrice,now=new Date()){
    if(!positive(midPrice))return {ok:false,reason:"INVALID_MARKET_DATA"};
    const index=state.positions.findIndex(p=>p.id===positionId);
    if(index<0)return {ok:false,reason:"POSITION_NOT_FOUND"};
    const p=state.positions[index],exitPrice=Number(midPrice)*(1-POLICY.slippagePctPerSide/100),gross=p.qty*exitPrice;
    const exitFee=round(gross*POLICY.commissionPctPerSide/100),pnl=round(gross-exitFee-p.notional-p.entryFee);
    state.cash=round(state.cash+gross-exitFee);state.positions.splice(index,1);
    const trade={id:"closed-"+now.getTime()+"-"+Math.random().toString(36).slice(2,9),
      symbol:p.symbol,pnl,closedAt:now.toISOString(),entry:p.entryPrice,exit:exitPrice,stopPrice:p.stopPrice,
      targetPrice:p.targetPrice,riskAmount:p.riskAmount,riskPct:p.riskPct};
    state.closedTrades.unshift(trade);state.closedTrades=state.closedTrades.slice(0,MAX_CLOSED);
    if(pnl<0){state.currentConsecutiveLosses++;if(state.currentConsecutiveLosses>=POLICY.maxConsecutiveLossesPause)state.consecutiveLossPause=true;
      if(state.currentConsecutiveLosses>=POLICY.maxConsecutiveLossesLock)state.strategyLocked=true;
    }else if(pnl>0){state.currentConsecutiveLosses=0;state.consecutiveLossPause=false;state.completedCycles++;}
    state.updatedAt=now.toISOString();refreshRisk(state,{},now);
    return {ok:true,trade};
  }
  function checkStops(state,prices={},now=new Date()){
    const closed=[];
    for(const p of state.positions.slice()){
      const mark=prices[p.symbol];if(!positive(mark))continue;
      const stopHit=mark<=p.stopPrice,targetHit=mark>=p.targetPrice;
      if(stopHit||targetHit){const r=closePosition(state,p.id,mark,now);if(r.ok){r.trade.reason=stopHit?"SIMULATED_STOP":"SIMULATED_TARGET";closed.push(r.trade);}}
    }
    refreshRisk(state,prices,now);return closed;
  }
  function getSummary(state,prices={}){
    const risk=refreshRisk(state,prices,new Date());
    const unrealizedPnl=state.positions.reduce((sum,p)=>{
      const mark=positive(prices[p.symbol])?Number(prices[p.symbol]):p.entryPrice;
      return sum+(p.qty*mark-p.notional-p.entryFee);
    },0);
    const realizedPnl=state.closedTrades.reduce((sum,t)=>sum+Number(t.pnl),0);
    const targetBase=POLICY.autoReinvest?risk.equity:state.initialCapital;
    const cycleTarget=targetBase*POLICY.targetCycleGrowthPct/100;
    const theoretical=Policy?Policy.theoreticalCompound(state.initialCapital,state.completedCycles,POLICY):null;
    return {cash:state.cash,equity:risk.equity,initialCapital:state.initialCapital,availableBalance:state.cash,
      realizedPnl:round(realizedPnl),unrealizedPnl:round(unrealizedPnl),openPositions:state.positions.length,
      closedTrades:state.closedTrades.length,dailyLossPct:risk.dailyLossPct,weeklyLossPct:risk.weeklyLossPct,
      drawdownPct:risk.drawdownPct,highWaterMark:state.highWaterEquity,openRiskPct:risk.openRiskPct,
      currentConsecutiveLosses:state.currentConsecutiveLosses,completedCycles:state.completedCycles,
      cycleTargetAmount:round(cycleTarget),theoreticalCompound:theoretical,paused:risk.paused,
      pauseReason:risk.pauseReason,effectiveRiskPct:risk.effectiveRiskPct};
  }
  function theoreticalProjection(cycles,capital){return Policy?Policy.theoreticalCompound(capital===undefined?POLICY.initialCapital:capital,cycles,POLICY):null;}
  return Object.freeze({get CONFIG(){return getConfig();},configure,createState,normalizeState,getEquity,getRiskSnapshot,
    refreshRisk,setManualPause,validateRecovery,openPosition,closePosition,checkStops,getSummary,theoreticalProjection});
});
