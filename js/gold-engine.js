/* ROAD TO CASH — XAUUSD indicative analysis + paper trades only.
 * The public spot feed is not a broker quote. This module has no MT5 or wallet execution.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.GoldEngine=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const CONFIG=Object.freeze({
    minSamples:60, maxQuoteAgeMs:120000, maxSeriesAgeMs:300000,
    maxPositions:3, virtualStartingCash:1000, notionalPct:1,
    feeRate:0.001, stopPct:0.0025, targetPct:0.005,
    dailyLossPct:2, maxDrawdownPct:5
  });
  const positive=n=>Number.isFinite(Number(n))&&Number(n)>0;
  const round=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
  function timestampMs(v){
    if(typeof v==="number"&&Number.isFinite(v))return v<1e12?v*1000:v;
    if(typeof v==="string"){const n=Number(v);if(Number.isFinite(n)&&n>0)return n<1e12?n*1000:n;const d=Date.parse(v);return Number.isFinite(d)?d:NaN;}
    return NaN;
  }
  function normalizePoints(raw){
    const source=Array.isArray(raw)?raw:[];
    const points=source.map(x=>({time:timestampMs(x&&x.t),price:Number(x&&x.p)}))
      .filter(x=>Number.isFinite(x.time)&&positive(x.price))
      .sort((a,b)=>a.time-b.time);
    const dedup=[];
    for(const p of points){if(dedup.length&&dedup[dedup.length-1].time===p.time)dedup[dedup.length-1]=p;else dedup.push(p);}
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
    for(let i=period+1;i<values.length;i++){const d=values[i]-values[i-1];avgGain=((avgGain*(period-1))+Math.max(d,0))/period;avgLoss=((avgLoss*(period-1))+Math.max(-d,0))/period;}
    if(avgLoss===0)return avgGain===0?50:100;
    return 100-(100/(1+avgGain/avgLoss));
  }
  function validateFeed(spot,intraday,now=Date.now()){
    if(!spot||!intraday)return {ok:false,reason:"FEED_UNAVAILABLE"};
    const quote=Number(spot.spot_usd_oz??spot.xau?.price);
    const quoteTime=timestampMs(spot.price_as_of||spot.data_state?.as_of||spot.updated_at);
    if(!positive(quote))return {ok:false,reason:"INVALID_SPOT_PRICE"};
    if(spot.data_state&&spot.data_state.status!=="fresh")return {ok:false,reason:"SPOT_NOT_FRESH"};
    if(!Number.isFinite(quoteTime)||now-quoteTime< -30000||now-quoteTime>CONFIG.maxQuoteAgeMs)return {ok:false,reason:"SPOT_STALE"};
    if(!intraday||!Array.isArray(intraday.points))return {ok:false,reason:"INTRADAY_UNAVAILABLE"};
    if(intraday.data_state&&intraday.data_state.status!=="fresh")return {ok:false,reason:"INTRADAY_NOT_FRESH"};
    const points=normalizePoints(intraday.points);
    if(points.length<CONFIG.minSamples)return {ok:false,reason:"INSUFFICIENT_HISTORY",points,quote,quoteTime};
    const last=points[points.length-1];
    if(now-last.time< -30000||now-last.time>CONFIG.maxSeriesAgeMs)return {ok:false,reason:"INTRADAY_STALE",points,quote,quoteTime,lastTime:last.time};
    return {ok:true,points,quote,quoteTime,lastTime:last.time};
  }
  function analyze(points){
    const clean=normalizePoints(points);
    if(clean.length<CONFIG.minSamples)return {ok:false,reason:"INSUFFICIENT_HISTORY",samples:clean.length};
    const values=clean.map(x=>x.price),last=values[values.length-1];
    const ema20=ema(values,20),ema50=ema(values,50),rsi14=rsi(values,14);
    const previous=values[Math.max(0,values.length-6)];
    const momentumPct=(last/previous-1)*100;
    const recent=values.slice(-20);
    const high=Math.max(...recent),low=Math.min(...recent);
    const rangePct=(high-low)/last*100;
    const bullish=ema20!==null&&ema50!==null&&last>ema20&&ema20>ema50&&rsi14>=50&&rsi14<=70&&momentumPct>0;
    const bearish=ema20!==null&&ema50!==null&&last<ema20&&ema20<ema50&&rsi14<=50&&rsi14>=30&&momentumPct<0;
    let alignment=0;
    if(last>ema20)alignment+=25;else if(last<ema20)alignment+=25;
    if(ema20>ema50)alignment+=25;else if(ema20<ema50)alignment+=25;
    if(rsi14>50&&rsi14<70||rsi14<50&&rsi14>30)alignment+=25;
    if(Math.abs(momentumPct)>0.01)alignment+=25;
    const signal=bullish?"BUY_BIAS":bearish?"SELL_BIAS":"WAIT";
    return {ok:true,signal,alignmentScore:alignment,latest:last,ema20,ema50,rsi14,momentumPct,rangePct,
      high20:high,low20:low,samples:clean.length,latestTime:clean[clean.length-1].time,
      interpretation:signal==="BUY_BIAS"?"اتجاه مرجعي صاعد متوافق — ليس أمراً للشراء":
        signal==="SELL_BIAS"?"اتجاه مرجعي هابط متوافق — ليس أمراً للبيع":"لا يوجد توافق كافٍ؛ الانتظار أفضل"};
  }
  function createPaperState(now=new Date()){
    return {version:1,cash:CONFIG.virtualStartingCash,positions:[],history:[],events:[],
      dayKey:new Date(now).toISOString().slice(0,10),dayStartEquity:CONFIG.virtualStartingCash,
      highWaterEquity:CONFIG.virtualStartingCash,riskLocked:false,createdAt:new Date(now).toISOString()};
  }
  function normalizePaperState(raw,now=new Date()){
    if(!raw||raw.version!==1||!Number.isFinite(Number(raw.cash))||Number(raw.cash)<0)return createPaperState(now);
    const positions=Array.isArray(raw.positions)?raw.positions.slice(-CONFIG.maxPositions).filter(p=>
      p&&typeof p.id==="string"&&["BUY","SELL"].includes(p.side)&&positive(p.entry)&&positive(p.qty)&&positive(p.notional)
    ).map(p=>({...p,entry:Number(p.entry),qty:Number(p.qty),notional:Number(p.notional)})):[];
    const history=Array.isArray(raw.history)?raw.history.slice(0,300).filter(p=>p&&typeof p.id==="string"&&Number.isFinite(Number(p.pnl))):[];
    return {version:1,cash:Number(raw.cash),positions,history,events:Array.isArray(raw.events)?raw.events.slice(0,100):[],
      dayKey:/^\d{4}-\d{2}-\d{2}$/.test(String(raw.dayKey))?raw.dayKey:new Date(now).toISOString().slice(0,10),
      dayStartEquity:positive(raw.dayStartEquity)?Number(raw.dayStartEquity):CONFIG.virtualStartingCash,
      highWaterEquity:positive(raw.highWaterEquity)?Number(raw.highWaterEquity):CONFIG.virtualStartingCash,
      riskLocked:raw.riskLocked===true,createdAt:String(raw.createdAt||new Date(now).toISOString())};
  }
  function equity(state,mark){
    return Number(state.cash)+state.positions.reduce((s,p)=>{
      const px=positive(mark)?Number(mark):p.entry;
      const gross=(px-p.entry)*p.qty*(p.side==="BUY"?1:-1);
      return s+p.notional+gross;
    },0);
  }
  function updateRisk(state,mark,now=new Date()){
    const key=new Date(now).toISOString().slice(0,10),eq=equity(state,mark);
    if(key!==state.dayKey){state.dayKey=key;state.dayStartEquity=eq;}
    if(eq>state.highWaterEquity)state.highWaterEquity=eq;
    const daily=state.dayStartEquity>0?Math.max(0,(state.dayStartEquity-eq)/state.dayStartEquity*100):0;
    const drawdown=state.highWaterEquity>0?Math.max(0,(state.highWaterEquity-eq)/state.highWaterEquity*100):0;
    if(daily>=CONFIG.dailyLossPct||drawdown>=CONFIG.maxDrawdownPct)state.riskLocked=true;
    return {equity:eq,dailyLossPct:daily,drawdownPct:drawdown,locked:state.riskLocked};
  }
  function openPaperTrade(state,side,price,now=new Date()){
    if(!["BUY","SELL"].includes(side)||!positive(price))return {ok:false,reason:"INVALID_ORDER"};
    if(state.riskLocked)return {ok:false,reason:"RISK_LOCKED"};
    if(state.positions.length>=CONFIG.maxPositions)return {ok:false,reason:"MAX_POSITIONS"};
    const eq=equity(state,price),notional=round(Math.min(eq*CONFIG.notionalPct/100,state.cash/(1+CONFIG.feeRate)));
    if(notional<1)return {ok:false,reason:"INSUFFICIENT_VIRTUAL_BALANCE"};
    const fee=round(notional*CONFIG.feeRate),qty=notional/price,sign=side==="BUY"?1:-1;
    const id="gold-"+new Date(now).getTime()+"-"+Math.random().toString(36).slice(2,8);
    const position={id,side,entry:Number(price),qty,notional,entryFee:fee,
      stop:price*(1-sign*CONFIG.stopPct),target:price*(1+sign*CONFIG.targetPct),openedAt:new Date(now).toISOString()};
    state.cash=round(state.cash-notional-fee);state.positions.push(position);
    return {ok:true,position};
  }
  function closePaperTrade(state,id,price,reason="MANUAL",now=new Date()){
    const i=state.positions.findIndex(p=>p.id===id);
    if(i<0||!positive(price))return {ok:false,reason:"POSITION_NOT_FOUND_OR_INVALID_PRICE"};
    const p=state.positions[i],gross=(Number(price)-p.entry)*p.qty*(p.side==="BUY"?1:-1);
    const exitFee=round(p.notional*CONFIG.feeRate),net=round(gross-p.entryFee-exitFee);
    state.cash=round(state.cash+p.notional+gross-exitFee);state.positions.splice(i,1);
    const trade={id:p.id,side:p.side,entry:p.entry,exit:Number(price),notional:p.notional,pnl:net,reason,openedAt:p.openedAt,closedAt:new Date(now).toISOString()};
    state.history.unshift(trade);state.history=state.history.slice(0,300);
    updateRisk(state,price,now);
    return {ok:true,trade};
  }
  function checkStops(state,price,now=new Date()){
    if(!positive(price))return [];
    const closed=[];
    for(const p of state.positions.slice()){
      const hitStop=p.side==="BUY"?price<=p.stop:price>=p.stop;
      const hitTarget=p.side==="BUY"?price>=p.target:price<=p.target;
      if(hitStop||hitTarget){
        const result=closePaperTrade(state,p.id,price,hitStop?"SIMULATED_STOP":"SIMULATED_TARGET",now);
        if(result.ok)closed.push(result.trade);
      }
    }
    updateRisk(state,price,now);
    return closed;
  }
  function summary(state,price){
    const openPnl=state.positions.reduce((s,p)=>s+(Number(price||p.entry)-p.entry)*p.qty*(p.side==="BUY"?1:-1)-p.entryFee,0);
    return {cash:state.cash,equity:equity(state,price),openCount:state.positions.length,openPnl,
      realizedPnl:state.history.reduce((s,t)=>s+Number(t.pnl),0),risk:updateRisk(state,price)};
  }
  return Object.freeze({CONFIG,normalizePoints,validateFeed,analyze,createPaperState,normalizePaperState,
    equity,updateRisk,openPaperTrade,closePaperTrade,checkStops,summary});
});