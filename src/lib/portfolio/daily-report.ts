import { QuoteData } from "../market/quotes";

export interface PortfolioActionItem {
  ticker: string;
  actionType: "TAKE_PROFIT" | "TRAIL_STOP" | "TIME_STOP_WARNING" | "ENTRY_TRIGGER" | "HEALTHY_HOLD" | "RISK_ALERT";
  urgency: "HIGH" | "MEDIUM" | "LOW";
  headline: string;
  details: string;
  suggestedOrder: string;
  rMultiple?: number;
  currentPrice: number;
}

export interface DailyPortfolioReport {
  generatedAt: string;
  marketRegime: string;
  portfolioSummary: {
    totalOpenPositions: number;
    pendingOrdersCount: number;
    aggregateRiskDollars: number;
    aggregateRiskPct: number;
    totalUnrealizedPnL: number;
    topPerformingTicker?: string;
  };
  actionItems: PortfolioActionItem[];
  sectorExposure: Record<string, number>;
  deskChecklist: string[];
}

export function generateDailyPortfolioReport(
  trades: any[],
  quotes: Record<string, QuoteData>,
  accountSize: number = 10000,
  marketRegime: string = "FAVORABLE"
): DailyPortfolioReport {
  const activeTrades = trades.filter(t => t.status === "ACTIVE" || t.status === "SCALED_T1");
  const pendingTrades = trades.filter(t => t.status === "PENDING_ENTRY");

  let aggregateRiskDollars = 0;
  let totalUnrealizedPnL = 0;
  let topR = -999;
  let topTicker = "";
  const sectorExposure: Record<string, number> = {};
  const actionItems: PortfolioActionItem[] = [];

  // Analyze active positions
  activeTrades.forEach(trade => {
    const sym = trade.ticker.toUpperCase();
    const quote = quotes[sym];
    const currentPrice = quote?.price || trade.entryTrigger;
    const entry = trade.actualEntry || trade.entryTrigger;
    const riskPerShare = Math.max(0.01, Math.abs(entry - trade.initialStop));
    const unrealized = (currentPrice - entry) * trade.sharesRemaining;
    const rMultiple = Number(((currentPrice - entry) / riskPerShare).toFixed(2));

    totalUnrealizedPnL += unrealized;

    // Track aggregate risk on open shares
    if (trade.currentStop < entry) {
      const openRisk = Math.abs(entry - trade.currentStop) * trade.sharesRemaining;
      aggregateRiskDollars += openRisk;
    }

    if (rMultiple > topR) {
      topR = rMultiple;
      topTicker = trade.ticker;
    }

    // Sector tracking
    const sector = trade.setupType?.includes("Aerospace")
      ? "Aerospace & Defense"
      : trade.setupType?.includes("Materials")
      ? "Materials"
      : trade.setupType?.includes("E-Commerce") || trade.setupType?.includes("Tech")
      ? "Technology"
      : "Diversified";
    sectorExposure[sector] = (sectorExposure[sector] || 0) + 1;

    // Check Action 1: Target 1 Proximity / Reached
    const distToT1Pct = ((trade.target1 - currentPrice) / currentPrice) * 100;
    if (currentPrice >= trade.target1) {
      actionItems.push({
        ticker: trade.ticker,
        actionType: "TAKE_PROFIT",
        urgency: "HIGH",
        headline: `Target 1 Hit ($${trade.target1.toFixed(2)}) — Scale 50% & Move to Breakeven`,
        details: `${trade.ticker} reached $${currentPrice.toFixed(2)} (+${rMultiple}R). Lock in profits on ${Math.ceil(trade.sharesTotal / 2)} shares immediately.`,
        suggestedOrder: `Sell Limit ${Math.ceil(trade.sharesTotal / 2)} shares at market ($${currentPrice.toFixed(2)}) and raise stop on remainder to $${entry.toFixed(2)}.`,
        rMultiple,
        currentPrice,
      });
    } else if (distToT1Pct > 0 && distToT1Pct <= 2.5) {
      actionItems.push({
        ticker: trade.ticker,
        actionType: "TAKE_PROFIT",
        urgency: "MEDIUM",
        headline: `Approaching Target 1 ($${trade.target1.toFixed(2)} is ${distToT1Pct.toFixed(1)}% away)`,
        details: `${trade.ticker} is trading at $${currentPrice.toFixed(2)} (+${rMultiple}R). Watch intraday tape for potential rejection or surge into $${trade.target1.toFixed(2)}.`,
        suggestedOrder: `Pre-set Sell Limit order for 50% position (${Math.ceil(trade.sharesTotal / 2)} shares) at $${trade.target1.toFixed(2)}.`,
        rMultiple,
        currentPrice,
      });
    }

    // Check Action 2: Time Stop Warning
    if (trade.sessionsElapsed >= (trade.timeStopSessions - 1) && trade.status === "ACTIVE") {
      actionItems.push({
        ticker: trade.ticker,
        actionType: "TIME_STOP_WARNING",
        urgency: "HIGH",
        headline: `Time Stop Stale Warning (${trade.sessionsElapsed}/${trade.timeStopSessions} Sessions Elapsed)`,
        details: `${trade.ticker} has consumed ${trade.sessionsElapsed} trading sessions without reaching Target 1. Setup is losing freshness.`,
        suggestedOrder: `If momentum does not expand within the next session, close position and reallocate capital.`,
        rMultiple,
        currentPrice,
      });
    }

    // Check Action 3: Scaled position trailing stop
    if (trade.status === "SCALED_T1") {
      actionItems.push({
        ticker: trade.ticker,
        actionType: "TRAIL_STOP",
        urgency: "LOW",
        headline: `Runner Active with Breakeven Floor ($${trade.currentStop.toFixed(2)})`,
        details: `50% of position was banked. Remaining ${trade.sharesRemaining} shares are floating risk-free targeting T2 ($${trade.target2.toFixed(2)}).`,
        suggestedOrder: `Hold runner. Consider trailing stop under previous session low once above $${((entry + trade.target1) / 2).toFixed(2)}.`,
        rMultiple,
        currentPrice,
      });
    }

    // Check Action 4: Healthy trending hold
    if (trade.status === "ACTIVE" && currentPrice > entry && distToT1Pct > 2.5) {
      actionItems.push({
        ticker: trade.ticker,
        actionType: "HEALTHY_HOLD",
        urgency: "LOW",
        headline: `Trend Constructive (+${rMultiple}R) — Maintain Stop at $${trade.currentStop.toFixed(2)}`,
        details: `${trade.ticker} holding above entry $${entry.toFixed(2)}. No technical breakdown detected.`,
        suggestedOrder: `Continue holding full ${trade.sharesTotal} shares. Do not disturb stop until T1 is touched.`,
        rMultiple,
        currentPrice,
      });
    }
  });

  // Analyze pending watch orders
  pendingTrades.forEach(pt => {
    const sym = pt.ticker.toUpperCase();
    const quote = quotes[sym];
    const currentPrice = quote?.price || pt.entryTrigger;
    const distToTrigger = ((pt.entryTrigger - currentPrice) / currentPrice) * 100;

    if (currentPrice >= pt.entryTrigger) {
      actionItems.push({
        ticker: pt.ticker,
        actionType: "ENTRY_TRIGGER",
        urgency: "HIGH",
        headline: `Entry Trigger Activated! (${pt.ticker} @ $${currentPrice.toFixed(2)})`,
        details: `${pt.ticker} crossed above entry pivot of $${pt.entryTrigger.toFixed(2)}. Planned risk: 1% ($${(pt.sharesTotal * Math.abs(pt.entryTrigger - pt.initialStop)).toFixed(2)}).`,
        suggestedOrder: `Execute Buy Limit for ${pt.sharesTotal} shares. Place stop loss immediately at $${pt.initialStop.toFixed(2)}.`,
        currentPrice,
      });
    } else if (Math.abs(distToTrigger) <= 2.0) {
      actionItems.push({
        ticker: pt.ticker,
        actionType: "ENTRY_TRIGGER",
        urgency: "MEDIUM",
        headline: `Watch Setup Coiling (${Math.abs(distToTrigger).toFixed(1)}% to $${pt.entryTrigger.toFixed(2)} trigger)`,
        details: `${pt.ticker} is testing resistance at $${currentPrice.toFixed(2)}. Ready to trigger on 30-min bar close.`,
        suggestedOrder: `Keep buy-stop order queued at $${pt.entryTrigger.toFixed(2)}.`,
        currentPrice,
      });
    }
  });

  const aggregateRiskPct = Number(((aggregateRiskDollars / accountSize) * 100).toFixed(2));

  // Risk concentration warning
  if (aggregateRiskPct > 3.0) {
    actionItems.unshift({
      ticker: "PORTFOLIO",
      actionType: "RISK_ALERT",
      urgency: "HIGH",
      headline: `Aggregate Portfolio Risk (${aggregateRiskPct}%) Exceeds Recommended 3.0% Cap`,
      details: `You currently have ${aggregateRiskDollars.toFixed(2)} total open risk across active positions. Avoid opening new longs until existing trades scale to breakeven.`,
      suggestedOrder: `Freeze new entries until 1 or more positions reach Target 1 and have stops moved to breakeven.`,
      currentPrice: 0,
    });
  }

  const deskChecklist = [
    "Verify confirmed earnings dates weekly — never hold through unexpected binary events.",
    "Honor every hard stop without hesitation. A stop widened is a plan abandoned.",
    "Scale 50% at Target 1 and immediately adjust stop to breakeven.",
    "Enforce time stops: after 5–7 sessions without expansion, reallocate risk capital.",
    `Maintain aggregate open risk below 3.0% of total account value ($${(accountSize * 0.03).toFixed(2)}).`,
  ];

  return {
    generatedAt: new Date().toISOString(),
    marketRegime,
    portfolioSummary: {
      totalOpenPositions: activeTrades.length,
      pendingOrdersCount: pendingTrades.length,
      aggregateRiskDollars: Number(aggregateRiskDollars.toFixed(2)),
      aggregateRiskPct,
      totalUnrealizedPnL: Number(totalUnrealizedPnL.toFixed(2)),
      topPerformingTicker: topTicker ? `${topTicker} (+${topR.toFixed(2)}R)` : undefined,
    },
    actionItems,
    sectorExposure,
    deskChecklist,
  };
}
