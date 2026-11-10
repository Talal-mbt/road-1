/* ROAD — XAUUSD indicative analysis + policy-driven paper trades only.
 * XAUS spot is not a broker quote. No MT5, wallet or live execution is present.
 */
(function(root,factory){
  const api=factory(root&&root.RoadTradingPolicy);
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.GoldEngine=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(Policy){
  "use strict";
  const DEFAULTS={initialCapital:3,targetCycleGrowthPct:3,cyclesPerDay:10,tradingDaysPerMonth:30,autoReinvest:true,
    riskPerTradePct:.5,maxRiskPerTradePct:1,maxConcurrentRiskPct:2,dailyLossLimitPct:2,weeklyLossLimitPct:5,
    maxAccountDrawdownPct:10,drawdownReduceRiskAtPct:5,reducedRiskPerTradePct:.25,maxPositions:3,
    maxPositionExposurePct:100,stopLossPct:.5,minimumRiskReward:2,maxConsecutiveLossesPause:3,
    maxConsecutiveLossesLock:5,commissionPctPerSide:.1,slippagePctPerSide:.05,
    martingaleEnabled:false,lossRecoveryEnabled:false,averagingDownEnabled:false,automaticEmergencyStop:true};
  let POLICY=Policy?Policy.normalize(DEFAULTS):Object.freeze({...DEFAULTS});
  const CONFIG_BASE={minSamples:60,maxQuoteAgeMs:120000,maxSeriesAgeMs:300000,maxHistory:300,maxEvents:100};
  const finite=n=>Number.isFinite(Number(n)),positive=n=>finite(n)&&Number(n)>0;
  const round=n=>Math.round((Number(n)+Number.EPSILON)*1e8)/1e8;
  const timestampMs(v){
    if(typeof v==="number"&&Number.isFinite(v))return v<1e12?v*1000:v;
    if(typeof v==="string"){const n=Number(v);if(Number.isFinite(n)&&n>0)return n<1e12?n*1000:n;const d=Date.parse(v);return Number.isFinite(d)?d:NaN;}
    return NaN;
  }
  function configure(settings){POLICY=Policy?Policy.normalize(settings):Object.freeze({...DEFAULTS,...settings});return POLICY;}
  function getConfig(){return Object.freeze({...CONFIG_BASE,...POLICY,virtualStartingCash:POLICY.initialCapital,
    notionalPct:POLICY.maxPositionExposurePct,feeRate:POLICY.commissionPctPerSide/100,
    slippageRate:POLICY.slippagePctPerSide/100,dailyLossPct:POLICY.dailyLossLimitPct,
    maxDrawdownPct:POLICY.maxAccountDrawdownPct});}
  function normalizePoints(raw){
    const source=Array.isArray(raw)?raw:[];
    const points=source.map(x=>({time:timestampMs(x&&x.t),price:Number(x&&x.p)}))
      .filter(x=>Number.isFinite(x.time)&&positive(x.price)).sort((a,b)=>a.time-b.time);
    const dedup=[];for(const p of points){if(dedup.length&&dedup[dedup.length-1].time===p.time)dedup[dedup.length-1]=p;else dedup.push(p);}
    return dedup.slice(-1500);
  }
  function ema(values,period){
    if(!Array.isArray(values)||values.length<period)return null;
    const k=2/(period+1);let value=values.slice(0,period).reduce((a,b)=>a+b,0)/period;
    for(let i=period;i<values.length;i++)value=values[i]*k+value*(1-k);
    return value;
  }
  function rsi(values,period=14){
    if(values.length<=period)return null;
    let gain=0,loss=0;
    for(let i=1;i<=period;i++){const d=values[i]-values[i-1];if(d>0)gain+=d;else loss-=d;}
    let avgGain=gain/period,avgLoss=loss/period;
    for(let i=period+1;i<values.length;i++){const d=values[i]-values[i-1];avgGain=(avgGain*(period-1)+Math.max(d,0))/period;avgLoss=(avgLoss*(period-1)+Math.max(-d,0))/period;}
    if(avgLoss===0)return avgGain===0?50:100;
    return 100-(100/(1+avgGain/avgLoss));
  }
  function validateFeed(spot,intraday,now=Date.now()){
    if(!spot||!intraday)return {ok:false,reason:"FEED_UNAVAILABLE"};
    const quote=Number(spot.spot_usd_oz??spot.xau?.price),quoteTime=timestampMs(spot.price_as_of||spot.data_state?.as_of||spot.updated_at);
    if(!positive(quote))return {ok:false,reason:"INVALID_SPOT_PRICE"};
    if(!spot.data_state||spot.data_state.status!=="fresh")return {ok:false,reason:"SPOT_NOT_FRESH"};
    if(!Number.isFinite(quoteTime)||now-quoteTime< -30000||now-quoteTime>CONFIG_BASE.maxQuoteAgeMs)return {ok:false,reason:"SPOT_STALE"};
    if(!Array.isArray(intraday.points))return {ok:false,reason:"INTRADAY_UNAVAILABLE"};
    if(!intraday.data_state||intraday.data_state.status!=="fresh")return {ok:false,reason:"INTRADAY_NOT_FRESH"};
    const points=normalizePoints(intraday.points);
    if(points.length<CONFIG_BASE.minSamples)return {ok:false,reason:"INSUFFICIENT_HISTORY",points,quote,quoteTime};
    const last=points[points.length-1];
    if(now-last.time< -30000||now-last.time>CONFIG_BASE.maxSeriesAgeMs)return {ok:false,reason:"INTRADAY_STALE",points,quote,quoteTime,lastTime:last.time};
    return {ok:true,points,quote,quoteTime,lastTime:last.time};
  }
  function analyze(points){
    const clean=normalizePoints(points);
    if(clean.length<CONFIG_BASE.minSamples)return {ok:false,reason:"INSUFFICIENT_HISTORY",samples:clean.length};
    const values=clean.map(x=>x.price),last=values[values.length-1],ema20=ema(values,20),ema50=ema(values,50),rsi14=rsi(values,14);
    const previous=values[Math.max(0,values.length-6)],momentumPct=(last/previous-1)*100;
    const recent=values.slice(-20),high=Math.max(...recent),low=Math.min(...recent),rangePct=(high-low)/last*100;
    const bullishVotes=[last>ema20,ema20>ema50,rsi14>=50&&rsi14<=70,momentumPct>0].filter(Boolean).length;
    const bearishVotes=[last<ema20,ema20<ema50,rsi14>=30&&rsi14<=50,momentumPct<0].filter(Boolean).length;
    const signal=bullishVotes===4?"BUY_BIAS":bearishVotes===4?"SELL_BIAS":"WAIT";
    return {ok:true,signal,alignmentScore:Math.max(bullishVotes,bearishVotes)*25,latest:last,ema20,ema50,rsi14,momentumPct,
      rangePct,high20:high,low20:low,samples:clean.length,latestTime:clean[clean.length-1].time,
      interpretation:signal==="BUY_BIAS"?"اتجاه مرجعي صاعد متوافق — ليس أمراً للشراء":
        signal==="SELL_BIAS"?"اتجاه مرجعي هابط متوافق — ليس أمراً للبيع":"لا يوجد توافق كافٍ؛ الانتظار أفضل"};
  }
  function utcDay(d){return new Date(d).toISOString().slice(0,10);}
  function isoWeek(d){const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);const start=new Date(Date.UTC(x.getUTCFullYear(),0,1));return x.getUTCFullYear()+"-W"+String(Math.ceil((((x-start)/86400000)+1)/7)).padStart(2,"0");}
  function createPaperState(now=new Date()){
    const cash=round(POLICY.initialCapital),day=utcDay(now),week=isoWeek(now);
    return {version:2,initialCapital:cash,cash,positions:[],history:[],events:[],dayKey:day,dayStartEquity:cash,
      weekKey:week,weekStartEquity:cash,highWaterEquity:cash,riskLocked:false,riskLockReason:"",
      dailyLocked:false,weeklyRiskLocked:false,hardDrawdownLocked:false,strategyLocked:false,
      consecutiveLossPause:false,currentConsecutiveLosses:0,completedCycles:0,createdAt:new Date(now).toISOString()};
  }
  function normalizePaperState(raw,now=new Date()){
    if(!raw||(raw.version!==1&&raw.version!==2)||!finite(raw.cash)||Number(raw.cash)<0)return createPaperState(now);
    const positions=Array.isArray(raw.positions)?raw.positions.slice(-POLICY.maxPositions).filter(p=>p&&typeof p.id==="string"&&
      ["BUY","SELL"].includes(p.side)&&positive(p.entry)&&positive(p.qty)&&positive(p.notional)).map(p=>{
      const entry=Number(p.entry),sign=p.side==="BUY"?1:-1,stop=positive(p.stop)?Number(p.stop):entry*(1-sign*POLICY.stopLossPct/100);
      const target=positive(p.target)?Number(p.target):entry+(entry-stop)*POLICY.minimumRiskReward;
      return {...p,entry,qty:Number(p.qty),notional:Number(p.notional),stop,target,
        riskAmount:positive(p.riskAmount)?Number(p.riskAmount):Number(p.qty)*Math.abs(entry-stop)};
    }):[];
    const history=Array.isArray(raw.history)?raw.history.slice(0,CONFIG_BASE.maxHistory).filter(p=>p&&typeof p.id==="string"&&finite(p.pnl)):[];
    return {version:2,initialCapital:positive(raw.initialCapital)?Number(raw.initialCapital):POLICY.initialCapital,
      cash:round(Number(raw.cash)),positions,history,events:Array.isArray(raw.events)?raw.events.slice(0,CONFIG_BASE.maxEvents):[],
      dayKey:/^\d{4}-\d{2}-\d{2}$/.test(String(raw.dayKey))?raw.dayKey:utcDay(now),
      dayStartEquity:positive(raw.dayStartEquity)?Number(raw.dayStartEquity):POLICY.initialCapital,
      weekKey:/^\d{4}-W\d{2}$/.test(String(raw.weekKey))?raw.weekKey:isoWeek(now),
      weekStartEquity:positive(raw.weekStartEquity)?Number(raw.weekStartEquity):POLICY.initialCapital,
      highWaterEquity:positive(raw.highWaterEquity)?Number(raw.highWaterEquity):POLICY.initialCapital,
      riskLocked:raw.riskLocked===true,riskLockReason:String(raw.riskLockReason||""),
      dailyLocked:raw.dailyLocked===true,weeklyRiskLocked:raw.weeklyRiskLocked===true,
      hardDrawdownLocked:raw.hardDrawdownLocked===true,strategyLocked:raw.strategyLocked===true,
      consecutiveLossPause:raw.consecutiveLossPause===true,currentConsecutiveLosses:Math.max(0,Math.floor(Number(raw.currentConsecutiveLosses)||0)),
      completedCycles:Math.max(0,Math.floor(Number(raw.completedCycles)||0)),createdAt:String(raw.createdAt||new Date(now).toISOString())};
  }
  function equity(state,mark){
    return round(Number(state.cash)+state.positions.reduce((sum,p)=>{
      const px=positive(mark)?Number(mark):p.entry,gross=(px-p.entry)*p.qty*(p.side==="BUY"?1:-1);
      return sum+p.notional+gross;
    },0));
  }
  function updateRisk(state,mark,now=new Date()){
    const key=utcDay(now),week=isoWeek(now),eq=equity(state,mark);
    if(key!==state.dayKey){state.dayKey=key;state.dayStartEquity=eq;state.dailyLocked=false;}
    if(week!==state.weekKey){state.weekKey=week;state.weekStartEquity=eq;}
    if(eq>state.highWaterEquity)state.highWaterEquity=eq;
    const daily=state.dayStartEquity>0?Math.max(0,(state.dayStartEquity-eq)/state.dayStartEquity*100):0;
    const weekly=state.weekStartEquity>0?Math.max(0,(state.weekStartEquity-eq)/state.weekStartEquity*100):0;
    const drawdown=state.highWaterEquity>0?Math.max(0,(state.highWaterEquity-eq)/state.highWaterEquity*100):0;
    if(daily>=POLICY.dailyLossLimitPct)state.dailyLocked=true;
    if(weekly>=POLICY.weeklyLossLimitPct)state.weeklyRiskLocked=true;
    if(drawdown>=POLICY.maxAccountDrawdownPct)state.hardDrawdownLocked=true;
    if(state.currentConsecutiveLosses>=POLICY.maxConsecutiveLossesLock)state.strategyLocked=true;
    if(state.currentConsecutiveLosses>=POLICY.maxConsecutiveLossesPause)state.consecutiveLossPause=true;
    const reason=state.hardDrawdownLocked?"MAX_DRAWDOWN":state.weeklyRiskLocked?"WEEKLY_LOSS_LIMIT":
      state.strategyLocked?"CONSECUTIVE_LOSS_STRATEGY_LOCK":state.dailyLocked?"DAILY_LOSS_LIMIT":
      state.consecutiveLossPause?"CONSECUTIVE_LOSS_PAUSE":"";
    state.riskLocked=!!(state.hardDrawdownLocked||state.weeklyRiskLocked||state.strategyLocked||state.dailyLocked);
    state.riskLockReason=reason;
    const openRisk=state.positions.reduce((sum,p)=>sum+(positive(p.riskAmount)?p.riskAmount:p.qty*Math.abs(p.entry-p.stop)),0);
    return {equity:eq,dailyLossPct:daily,weeklyLossPct:weekly,drawdownPct:drawdown,locked:!!reason,reason,
      openRisk,openRiskPct:eq>0?openRisk/eq*100:100,effectiveRiskPct:drawdown>=POLICY.drawdownReduceRiskAtPct?
        POLICY.reducedRiskPerTradePct:POLICY.riskPerTradePct,consecutiveLosses:state.currentConsecutiveLosses};
  }
  function openRiskAmount(state){return state.positions.reduce((sum,p)=>sum+(positive(p.riskAmount)?p.riskAmount:p.qty*Math.abs(p.entry-p.stop)),0);}
  function openPaperTrade(state,side,price,now=new Date()){
    if(!["BUY","SELL"].includes(side)||!positive(price))return {ok:false,reason:"INVALID_ORDER"};
    const risk=updateRisk(state,price,now);
    if(risk.locked)return {ok:false,reason:risk.reason||"RISK_LOCKED"};
    if(state.positions.length>=POLICY.maxPositions)return {ok:false,reason:"MAX_POSITIONS"};
    if(state.positions.length)return {ok:false,reason:"DUPLICATE_OR_AVERAGING_BLOCKED"};
    const equityNow=equity(state,price),riskBasis=POLICY.autoReinvest?equityNow:Math.min(equityNow,state.initialCapital);
    const sign=side==="BUY"?1:-1,entry=Number(price)*(1+sign*POLICY.slippagePctPerSide/100);
    const stop=entry*(1-sign*POLICY.stopLossPct/100),target=entry+(entry-stop)*POLICY.minimumRiskReward;
    const sizing=Policy?Policy.positionSizing({equity:riskBasis,availableCash:state.cash,entryPrice:entry,stopPrice:stop,
      riskPct:Math.min(POLICY.maxRiskPerTradePct,risk.effectiveRiskPct),maxExposurePct:POLICY.maxPositionExposurePct,
      feePct:POLICY.commissionPctPerSide,slippagePct:POLICY.slippagePctPerSide}):{ok:false,reason:"POLICY_HELPER_UNAVAILABLE"};
    if(!sizing.ok)return {ok:false,reason:sizing.reason};
    const concurrentLimit=equityNow*POLICY.maxConcurrentRiskPct/100;
    if(openRiskAmount(state)+sizing.estimatedStopLoss>concurrentLimit+1e-8)return {ok:false,reason:"MAX_CONCURRENT_RISK"};
    const notional=round(sizing.notional),fee=round(notional*POLICY.commissionPctPerSide/100),qty=round(sizing.quantity);
    if(notional<.01||!positive(qty)||state.cash<notional+fee)return {ok:false,reason:"INSUFFICIENT_VIRTUAL_BALANCE"};
    const id="gold-"+new Date(now).getTime()+"-"+Math.random().toString(36).slice(2,8);
    const position={id,side,entry,qty,notional,entryFee:fee,stop,target,riskAmount:sizing.estimatedStopLoss,
      riskPct:sizing.actualRiskPct,openedAt:new Date(now).toISOString()};
    state.cash=round(state.cash-notional-fee);state.positions.push(position);
    return {ok:true,position,risk:updateRisk(state,price,now)};
  }
  function closePaperTrade(state,id,price,reason="MANUAL",now=new Date()){
    const i=state.positions.findIndex(p=>p.id===id);
    if(i<0||!positive(price))return {ok:false,reason:"POSITION_NOT_FOUND_OR_INVALID_PRICE"};
    const p=state.positions[i],exitPrice=Number(price)*(1-(p.side==="BUY"?1:-1)*POLICY.slippagePctPerSide/100);
    const gross=(exitPrice-p.entry)*p.qty*(p.side==="BUY"?1:-1),exitFee=round(p.notional*POLICY.commissionPctPerSide/100);
    const net=round(gross-p.entryFee-exitFee);
    state.cash=round(state.cash+p.notional+gross-exitFee);state.positions.splice(i,1);
    const trade={id:p.id,side:p.side,entry:p.entry,exit:exitPrice,notional:p.notional,stop:p.stop,target:p.target,
      riskAmount:p.riskAmount,riskPct:p.riskPct,pnl:net,reason,openedAt:p.openedAt,closedAt:new Date(now).toISOString()};
    state.history.unshift(trade);state.history=state.history.slice(0,CONFIG_BASE.maxHistory);
    if(net<0){state.currentConsecutiveLosses++;if(state.currentConsecutiveLosses>=POLICY.maxConsecutiveLossesLock)state.strategyLocked=true;
      if(state.currentConsecutiveLosses>=POLICY.maxConsecutiveLossesPause)state.consecutiveLossPause=true;
    }else if(net>0){state.currentConsecutiveLosses=0;state.consecutiveLossPause=false;state.completedCycles++;}
    updateRisk(state,price,now);return {ok:true,trade};
  }
  function checkStops(state,price,now=new Date()){
    if(!positive(price))return [];
    const closed=[];
    for(const p of state.positions.slice()){
      const stopHit=p.side==="BUY"?price<=p.stop:price>=p.stop;
      const targetHit=p.side==="BUY"?price>=p.target:price<=p.target;
      if(stopHit||targetHit){const result=closePaperTrade(state,p.id,price,stopHit?"SIMULATED_STOP":"SIMULATED_TARGET",now);if(result.ok)closed.push(result.trade);}
    }
    updateRisk(state,price,now);return closed;
  }
  function validateRecovery(state,price,now=new Date(),strategyValidated=false){
    const risk=updateRisk(state,price,now);
    if(risk.dailyLossPct>=POLICY.dailyLossLimitPct||risk.weeklyLossPct>=POLICY.weeklyLossLimitPct||
       risk.drawdownPct>=POLICY.maxAccountDrawdownPct||(state.currentConsecutiveLosses>=POLICY.maxConsecutiveLossesPause&&strategyValidated!==true))
      return {ok:false,reason:"RISK_CONDITIONS_NOT_RECOVERED"};
    if((state.weeklyRiskLocked||state.hardDrawdownLocked||state.strategyLocked||state.consecutiveLossPause)&&strategyValidated!==true)
      return {ok:false,reason:"EXPLICIT_STRATEGY_VALIDATION_REQUIRED"};
    state.dailyLocked=false;state.weeklyRiskLocked=false;state.hardDrawdownLocked=false;state.strategyLocked=false;
    state.consecutiveLossPause=false;state.currentConsecutiveLosses=0;state.riskLocked=false;state.riskLockReason="";
    return {ok:true};
  }
  function summary(state,price){
    const mark=positive(price)?Number(price):null,openPnl=state.positions.reduce((sum,p)=>{
      const value=mark??p.entry;return sum+(value-p.entry)*p.qty*(p.side==="BUY"?1:-1)-p.entryFee;
    },0);
    const risk=updateRisk(state,mark,new Date()),realizedPnl=state.history.reduce((sum,t)=>sum+Number(t.pnl),0);
    const base=POLICY.autoReinvest?risk.equity:state.initialCapital;
    return {cash:state.cash,equity:risk.equity,initialCapital:state.initialCapital,openCount:state.positions.length,openPnl,
      realizedPnl:round(realizedPnl),dailyLossPct:risk.dailyLossPct,weeklyLossPct:risk.weeklyLossPct,drawdownPct:risk.drawdownPct,
      highWaterMark:state.highWaterEquity,openRiskPct:risk.openRiskPct,consecutiveLosses:state.currentConsecutiveLosses,
      effectiveRiskPct:risk.effectiveRiskPct,cycleTargetAmount:round(base*POLICY.targetCycleGrowthPct/100),
      theoreticalCompound:Policy?Policy.theoreticalCompound(state.initialCapital,state.completedCycles,POLICY):null,
      completedCycles:state.completedCycles,paused:risk.locked,pauseReason:risk.reason,riskLocked:state.riskLocked};
  }
  function theoreticalProjection(cycles,capital){return Policy?Policy.theoreticalCompound(capital===undefined?POLICY.initialCapital:capital,cycles,POLICY):null;}
  return Object.freeze({get CONFIG(){return getConfig();},configure,normalizePoints,validateFeed,analyze,
    createPaperState,normalizePaperState,equity,updateRisk,openPaperTrade,closePaperTrade,checkStops,
    validateRecovery,summary,theoreticalProjection});
});
