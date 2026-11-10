/* ROAD TO CASH — paper-only portfolio engine
 * No wallet, private key, RPC signer, or live transaction capability.
 * CommonJS export is for deterministic tests; browser export is window.PaperEngine.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PaperEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = 1;
  const CONFIG = Object.freeze({
    startingCash: 1000, maxPositions: 3, maxPositionNotionalPct: 1,
    dailyLossLimitPct: 2, maxDrawdownPct: 5, feeRate: 0.001,
    slippageRate: 0.005, minimumNotional: 1, maxClosedTrades: 500, maxEvents: 100
  });
  const finitePositive = value => Number.isFinite(Number(value)) && Number(value) > 0;
  const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const utcDay = date => new Date(date).toISOString().slice(0, 10);

  function createState(now = new Date()) {
    const cash = CONFIG.startingCash;
    return { version: VERSION, cash, positions: [], closedTrades: [], events: [],
      manualPaused: false, riskLocked: false, riskLockReason: "",
      dayKey: utcDay(now), dayStartEquity: cash, highWaterEquity: cash,
      createdAt: now.toISOString(), updatedAt: now.toISOString() };
  }

  function normalizeState(raw, now = new Date()) {
    if (!raw || raw.version !== VERSION || !Number.isFinite(Number(raw.cash)) || Number(raw.cash) < 0) return createState(now);
    const positions = Array.isArray(raw.positions) ? raw.positions.slice(-CONFIG.maxPositions).filter(p =>
      p && typeof p.id === "string" && typeof p.symbol === "string" && finitePositive(p.qty) &&
      finitePositive(p.entryPrice) && finitePositive(p.notional) && Number.isFinite(Number(p.entryFee))
    ).map(p => ({ id:p.id, symbol:p.symbol.slice(0,64), qty:Number(p.qty), entryPrice:Number(p.entryPrice),
      notional:Number(p.notional), entryFee:Math.max(0,Number(p.entryFee)), openedAt:String(p.openedAt||"") })) : [];
    const closedTrades = Array.isArray(raw.closedTrades) ? raw.closedTrades.slice(0,CONFIG.maxClosedTrades).filter(t =>
      t && typeof t.id === "string" && typeof t.symbol === "string" && Number.isFinite(Number(t.pnl))
    ).map(t => ({ id:t.id, symbol:t.symbol.slice(0,64), pnl:Number(t.pnl), closedAt:String(t.closedAt||"") })) : [];
    const events = Array.isArray(raw.events) ? raw.events.slice(0,CONFIG.maxEvents).filter(e =>
      e && typeof e.message === "string"
    ).map(e => ({ at:String(e.at||""), type:String(e.type||"INFO").slice(0,24), message:e.message.slice(0,240) })) : [];
    return { version:VERSION, cash:Math.max(0,Number(raw.cash)), positions, closedTrades, events,
      manualPaused:raw.manualPaused===true, riskLocked:raw.riskLocked===true,
      riskLockReason:String(raw.riskLockReason||"").slice(0,64),
      dayKey:/^\d{4}-\d{2}-\d{2}$/.test(String(raw.dayKey))?raw.dayKey:utcDay(now),
      dayStartEquity:finitePositive(raw.dayStartEquity)?Number(raw.dayStartEquity):CONFIG.startingCash,
      highWaterEquity:finitePositive(raw.highWaterEquity)?Number(raw.highWaterEquity):CONFIG.startingCash,
      createdAt:String(raw.createdAt||now.toISOString()), updatedAt:now.toISOString() };
  }

  function getEquity(state, prices = {}) {
    return Number(state.cash) + state.positions.reduce((total,p) => {
      const mark=finitePositive(prices[p.symbol])?Number(prices[p.symbol]):p.entryPrice;
      return total+p.qty*mark;
    },0);
  }
  function getRiskSnapshot(state,prices={}) {
    const equity=getEquity(state,prices);
    const dailyLossPct=state.dayStartEquity>0?Math.max(0,(state.dayStartEquity-equity)/state.dayStartEquity*100):0;
    const drawdownPct=state.highWaterEquity>0?Math.max(0,(state.highWaterEquity-equity)/state.highWaterEquity*100):0;
    return {equity,dailyLossPct,drawdownPct,dailyLimitPct:CONFIG.dailyLossLimitPct,
      maxDrawdownPct:CONFIG.maxDrawdownPct,paused:state.manualPaused||state.riskLocked,
      pauseReason:state.riskLockReason||(state.manualPaused?"MANUAL_PAUSE":"")};
  }
  function refreshRisk(state,prices={},now=new Date()) {
    const today=utcDay(now), equity=getEquity(state,prices);
    if(state.dayKey!==today){state.dayKey=today;state.dayStartEquity=equity;}
    if(equity>state.highWaterEquity)state.highWaterEquity=equity;
    const snapshot=getRiskSnapshot(state,prices);
    if(!state.riskLocked&&snapshot.dailyLossPct>=CONFIG.dailyLossLimitPct){state.riskLocked=true;state.riskLockReason="DAILY_LOSS_LIMIT";}
    if(!state.riskLocked&&snapshot.drawdownPct>=CONFIG.maxDrawdownPct){state.riskLocked=true;state.riskLockReason="MAX_DRAWDOWN";}
    state.updatedAt=now.toISOString();
    return getRiskSnapshot(state,prices);
  }
  function setManualPause(state,paused,now=new Date()){state.manualPaused=paused===true;state.updatedAt=now.toISOString();return state.manualPaused||state.riskLocked;}

  function openPosition(state,symbol,midPrice,prices={},now=new Date()) {
    if(typeof symbol!=="string"||!symbol.trim()||!finitePositive(midPrice))return {ok:false,reason:"INVALID_MARKET_DATA"};
    const risk=refreshRisk(state,prices,now);
    if(risk.paused)return {ok:false,reason:risk.pauseReason||"PAUSED"};
    if(state.positions.length>=CONFIG.maxPositions)return {ok:false,reason:"MAX_POSITIONS"};
    const equity=getEquity(state,{...prices,[symbol]:Number(midPrice)});
    const notional=roundMoney(Math.min(equity*CONFIG.maxPositionNotionalPct/100,state.cash/(1+CONFIG.feeRate)));
    if(!finitePositive(notional)||notional<CONFIG.minimumNotional)return {ok:false,reason:"INSUFFICIENT_PAPER_EQUITY"};
    const entryPrice=Number(midPrice)*(1+CONFIG.slippageRate),entryFee=roundMoney(notional*CONFIG.feeRate),qty=notional/entryPrice;
    if(!finitePositive(qty)||state.cash<notional+entryFee)return {ok:false,reason:"INSUFFICIENT_PAPER_CASH"};
    const position={id:"paper-"+now.getTime()+"-"+Math.random().toString(36).slice(2,9),
      symbol:symbol.trim().slice(0,64),qty,entryPrice,notional,entryFee,openedAt:now.toISOString()};
    state.cash=roundMoney(state.cash-notional-entryFee);state.positions.push(position);state.updatedAt=now.toISOString();
    refreshRisk(state,{...prices,[symbol]:Number(midPrice)},now);
    return {ok:true,position,risk:getRiskSnapshot(state,{...prices,[symbol]:Number(midPrice)})};
  }

  function closePosition(state,positionId,midPrice,now=new Date()) {
    if(!finitePositive(midPrice))return {ok:false,reason:"INVALID_MARKET_DATA"};
    const index=state.positions.findIndex(p=>p.id===positionId);
    if(index<0)return {ok:false,reason:"POSITION_NOT_FOUND"};
    const p=state.positions[index],exitPrice=Number(midPrice)*(1-CONFIG.slippageRate),gross=p.qty*exitPrice;
    const exitFee=roundMoney(gross*CONFIG.feeRate),pnl=roundMoney(gross-exitFee-p.notional-p.entryFee);
    state.cash=roundMoney(state.cash+gross-exitFee);state.positions.splice(index,1);
    const trade={id:"closed-"+now.getTime()+"-"+Math.random().toString(36).slice(2,9),
      symbol:p.symbol,pnl,closedAt:now.toISOString()};
    state.closedTrades.unshift(trade);state.closedTrades=state.closedTrades.slice(0,CONFIG.maxClosedTrades);
    state.updatedAt=now.toISOString();return {ok:true,trade};
  }

  function getSummary(state,prices={}) {
    const risk=getRiskSnapshot(state,prices);
    const unrealizedPnl=state.positions.reduce((total,p)=>{
      const mark=finitePositive(prices[p.symbol])?Number(prices[p.symbol]):p.entryPrice;
      return total+(p.qty*mark-p.notional-p.entryFee);
    },0);
    const realizedPnl=state.closedTrades.reduce((total,t)=>total+t.pnl,0);
    return {cash:state.cash,equity:risk.equity,realizedPnl,unrealizedPnl,openPositions:state.positions.length,
      closedTrades:state.closedTrades.length,dailyLossPct:risk.dailyLossPct,drawdownPct:risk.drawdownPct,
      paused:risk.paused,pauseReason:risk.pauseReason};
  }
  return Object.freeze({CONFIG,createState,normalizeState,getEquity,getRiskSnapshot,refreshRisk,
    setManualPause,openPosition,closePosition,getSummary});
});