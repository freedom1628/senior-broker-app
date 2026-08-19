import { QuoteData } from "./quotes";

export interface TradeEvaluation {
  tradeId: string;
  ticker: string;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  currentRMultiple: number;
  alertType?: "ENTRY_TRIGGERED" | "STOP_ALERT" | "TARGET_1_HIT" | "TARGET_2_HIT" | "TIME_STOP_WARNING";
  alertTitle?: string;
  alertMessage?: string;
  recommendedAction?: string;
  shouldAutoClose?: boolean;
}

export function evaluateTrade(
  trade: {
    id: string;
    ticker: string;
    status: string;
    entryTrigger: number;
    actualEntry?: number | null;
    sharesTotal: number;
    sharesRemaining: number;
    initialStop: number;
    currentStop: number;
    target1: number;
    target2: number;
    timeStopSessions: number;
    sessionsElapsed: number;
  },
  quote: QuoteData
): TradeEvaluation {
  const currentPrice = quote.price;
  const effectiveEntry = trade.actualEntry || trade.entryTrigger;
  const riskPerShare = Math.max(0.01, Math.abs(effectiveEntry - trade.initialStop));

  let unrealizedPnL = 0;
  let unrealizedPnLPct = 0;
  let currentRMultiple = 0;

  if (trade.status === "ACTIVE" || trade.status === "SCALED_T1") {
    unrealizedPnL = Number(((currentPrice - effectiveEntry) * trade.sharesRemaining).toFixed(2));
    unrealizedPnLPct = Number((((currentPrice - effectiveEntry) / effectiveEntry) * 100).toFixed(2));
    currentRMultiple = Number(((currentPrice - effectiveEntry) / riskPerShare).toFixed(2));
  }

  // Check 1: PENDING_ENTRY
  if (trade.status === "PENDING_ENTRY") {
    // If current price is at or above the trigger (for breakout) or within entry zone
    const isTriggered = currentPrice >= trade.entryTrigger;
    if (isTriggered) {
      return {
        tradeId: trade.id,
        ticker: trade.ticker,
        currentPrice,
        unrealizedPnL: 0,
        unrealizedPnLPct: 0,
        currentRMultiple: 0,
        alertType: "ENTRY_TRIGGERED",
        alertTitle: `Entry Trigger Activated: ${trade.ticker}`,
        alertMessage: `${trade.ticker} reached $${currentPrice.toFixed(2)}, crossing above trigger $${trade.entryTrigger.toFixed(2)}. Ready to execute ${trade.sharesTotal} shares.`,
        recommendedAction: "Execute Long Entry with stop placed strictly at $" + trade.initialStop.toFixed(2),
      };
    }
  }

  // Check 2: ACTIVE position hitting STOP LOSS
  if ((trade.status === "ACTIVE" || trade.status === "SCALED_T1") && currentPrice <= trade.currentStop) {
    return {
      tradeId: trade.id,
      ticker: trade.ticker,
      currentPrice,
      unrealizedPnL,
      unrealizedPnLPct,
      currentRMultiple,
      alertType: "STOP_ALERT",
      alertTitle: `STOP LOSS INVALIDATION: ${trade.ticker}`,
      alertMessage: `${trade.ticker} dropped to $${currentPrice.toFixed(2)}, hitting stop price $${trade.currentStop.toFixed(2)}. Invalidation rule violated.`,
      recommendedAction: "HONOR THE STOP IMMEDIATELY. Close remaining position. Never average down into a loser.",
      shouldAutoClose: true,
    };
  }

  // Check 3: ACTIVE position hitting TARGET 1
  if (trade.status === "ACTIVE" && currentPrice >= trade.target1) {
    return {
      tradeId: trade.id,
      ticker: trade.ticker,
      currentPrice,
      unrealizedPnL,
      unrealizedPnLPct,
      currentRMultiple,
      alertType: "TARGET_1_HIT",
      alertTitle: `TARGET 1 ACHIEVED (+${currentRMultiple}R): ${trade.ticker}`,
      alertMessage: `${trade.ticker} hit Target 1 at $${currentPrice.toFixed(2)} ($${trade.target1.toFixed(2)} target).`,
      recommendedAction: `Scale out 50% (${Math.ceil(trade.sharesTotal / 2)} shares) to bank profits, and raise stop on remainder to Breakeven ($${effectiveEntry.toFixed(2)}).`,
    };
  }

  // Check 4: SCALED position hitting TARGET 2
  if (trade.status === "SCALED_T1" && currentPrice >= trade.target2) {
    return {
      tradeId: trade.id,
      ticker: trade.ticker,
      currentPrice,
      unrealizedPnL,
      unrealizedPnLPct,
      currentRMultiple,
      alertType: "TARGET_2_HIT",
      alertTitle: `TARGET 2 MAX RUNNER REACHED: ${trade.ticker}`,
      alertMessage: `${trade.ticker} reached full extension target $${trade.target2.toFixed(2)} at $${currentPrice.toFixed(2)}.`,
      recommendedAction: "Close remaining runner position to lock in full campaign gains.",
      shouldAutoClose: true,
    };
  }

  // Check 5: TIME STOP WARNING
  if ((trade.status === "ACTIVE" || trade.status === "SCALED_T1") && trade.sessionsElapsed >= trade.timeStopSessions) {
    return {
      tradeId: trade.id,
      ticker: trade.ticker,
      currentPrice,
      unrealizedPnL,
      unrealizedPnLPct,
      currentRMultiple,
      alertType: "TIME_STOP_WARNING",
      alertTitle: `Time Stop Warning: ${trade.ticker}`,
      alertMessage: `${trade.ticker} has been active for ${trade.sessionsElapsed} sessions without reaching target. Setup is going stale.`,
      recommendedAction: "Review position: Close out if momentum has stalled rather than tying up risk capital.",
    };
  }

  return {
    tradeId: trade.id,
    ticker: trade.ticker,
    currentPrice,
    unrealizedPnL,
    unrealizedPnLPct,
    currentRMultiple,
  };
}
