// Trade Management Rule Engine & Portfolio Sleeve Guardrails
// Implements complete lifecycle state machine:
// - PENDING_ENTRY breakout trigger
// - 50% scale at Target 1 + Breakeven stop ratchet
// - Target 2 runner exit & upward-only dynamic trailing stops
// - Immediate hard stop invalidation (shouldAutoClose: true)
// - 5–7 session time stop warnings and stale expirations
// - Portfolio sleeve limits: Max 3 active positions, max 3.0% sleeve risk, max 2 per sector

import { QuoteData } from "./quotes";

export type TradeStatus =
  | "WATCHLIST"
  | "PENDING_ENTRY"
  | "ACTIVE"
  | "SCALED_T1"
  | "CLOSED"
  | "CANCELLED"
  | "CLOSED_STOP"
  | "CLOSED_TARGET"
  | "CLOSED_TIME_STOP"
  | "CLOSED_MANUAL";

export type RuleActionType =
  | "NONE"
  | "ENTRY_TRIGGER"
  | "ENTRY_TRIGGERED"
  | "SCALE_T1"
  | "TARGET_1_HIT"
  | "TARGET_2_HIT"
  | "STOP_LOSS_HIT"
  | "STOP_ALERT"
  | "TRAIL_STOP_UPDATE"
  | "TIME_STOP_WARNING"
  | "TIME_STOP_EXPIRED"
  | "RISK_CAP_EXCEEDED"
  | "SECTOR_CAP_EXCEEDED";

export type UrgencyLevel = "LOW" | "MEDIUM" | "HIGH";

export interface TradeRuleInput {
  id: string;
  ticker: string;
  companyName?: string;
  sector?: string;
  status: TradeStatus | string;
  setupType?: string;
  entryTrigger: number;
  actualEntry?: number | null;
  entryDate?: string | Date | null;
  sharesTotal: number;
  sharesRemaining: number;
  initialStop: number;
  currentStop: number;
  target1: number;
  target2: number;
  rrRatio?: number;
  timeStopSessions?: number;
  sessionsElapsed?: number;
  notes?: string | null;
}

export interface TradeEvaluation {
  tradeId: string;
  ticker: string;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  currentRMultiple: number;
  actionRequired?: RuleActionType;
  alertType?: "ENTRY_TRIGGERED" | "STOP_ALERT" | "TARGET_1_HIT" | "TARGET_2_HIT" | "TIME_STOP_WARNING" | "TIME_STOP_EXPIRED" | "TRAIL_STOP_UPDATE";
  urgency?: UrgencyLevel;
  headline?: string;
  alertTitle?: string;
  alertMessage?: string;
  recommendedAction?: string;
  orderInstruction?: string;
  whyRationale?: string;
  shouldAutoClose?: boolean;
  suggestedStopUpdate?: number;
  sharesToScale?: number;
}

export interface ProposedTrade {
  ticker: string;
  companyName?: string;
  sector?: string;
  entryPrice?: number;
  stopLoss?: number;
  shares?: number;
  dollarRisk?: number;
  riskDollars?: number;
}

export interface PortfolioStateInput {
  accountSize?: number;
  riskPerTradePct?: number;
  maxSleeveRiskPct?: number; // Default 3.0%
  maxOpenPositions?: number; // Default 3
  maxSectorPositions?: number; // Default 2
  trades?: TradeRuleInput[];
}

export interface PortfolioRuleCheckResult {
  isAllowed: boolean;
  canOpen: boolean;
  blockReason?: string;
  rejectionReason?: string;
  warnings: string[];
  currentOpenRiskDollars: number;
  currentOpenRiskPct: number;
  projectedOpenRiskDollars: number;
  projectedOpenRiskPct: number;
  currentActiveCount: number;
  currentSectorCount: number;
  aggregateRiskDollars: number;
  aggregateRiskPct: number;
}

/**
 * Calculates open dollar risk for a single trade.
 * If the current stop is at or above the actual entry (Breakeven), open risk is mathematically $0.00.
 */
export function calculateTradeOpenRisk(trade: TradeRuleInput): number {
  if (trade.status !== "ACTIVE" && trade.status !== "SCALED_T1") {
    return 0;
  }
  const effectiveEntry = trade.actualEntry || trade.entryTrigger;
  const currentStop = trade.currentStop;
  const remainingShares = trade.sharesRemaining > 0 ? trade.sharesRemaining : trade.sharesTotal;

  // Breakeven check: If stop is at or above entry, zero open risk
  if (currentStop >= effectiveEntry) {
    return 0.0;
  }

  const riskPerShare = Math.max(0, effectiveEntry - currentStop);
  return Number((riskPerShare * remainingShares).toFixed(2));
}

/**
 * Calculates aggregate open risk across all active portfolio positions.
 */
export function calculateAggregateOpenRisk(trades: TradeRuleInput[]): number {
  const total = trades
    .filter(t => t.status === "ACTIVE" || t.status === "SCALED_T1")
    .reduce((sum, t) => sum + calculateTradeOpenRisk(t), 0);
  return Number(total.toFixed(2));
}

export interface PartialQuote {
  price: number;
  ticker?: string;
  change?: number;
  changePct?: number;
  [key: string]: any;
}

/**
 * Evaluates an individual trade position against live market quotes and session counts.
 */
export function evaluateTrade(
  trade: TradeRuleInput,
  quote: QuoteData | PartialQuote | number,
  sessionsElapsedOverride?: number
): TradeEvaluation {
  const currentPrice = typeof quote === "number" ? quote : quote.price;
  const sessions = sessionsElapsedOverride !== undefined
    ? sessionsElapsedOverride
    : (trade.sessionsElapsed ?? 0);
  const effectiveEntry = trade.actualEntry || trade.entryTrigger;
  const riskPerShare = Math.max(0.01, Math.abs(effectiveEntry - trade.initialStop));

  let unrealizedPnL = 0;
  let unrealizedPnLPct = 0;
  let currentRMultiple = 0;

  const isActive = trade.status === "ACTIVE" || trade.status === "SCALED_T1";

  if (isActive) {
    const remainingShares = trade.sharesRemaining > 0 ? trade.sharesRemaining : trade.sharesTotal;
    unrealizedPnL = Number(((currentPrice - effectiveEntry) * remainingShares).toFixed(2));
    unrealizedPnLPct = effectiveEntry > 0 ? Number((((currentPrice - effectiveEntry) / effectiveEntry) * 100).toFixed(2)) : 0;
    currentRMultiple = Number(((currentPrice - effectiveEntry) / riskPerShare).toFixed(2));
  }

  // Check 1: PENDING_ENTRY breakout trigger
  if (trade.status === "PENDING_ENTRY") {
    if (currentPrice >= trade.entryTrigger) {
      return {
        tradeId: trade.id,
        ticker: trade.ticker,
        currentPrice,
        unrealizedPnL: 0,
        unrealizedPnLPct: 0,
        currentRMultiple: 0,
        actionRequired: "ENTRY_TRIGGER",
        alertType: "ENTRY_TRIGGERED",
        urgency: "HIGH",
        headline: `Entry Trigger Activated: ${trade.ticker}`,
        alertTitle: `Entry Trigger Activated: ${trade.ticker}`,
        alertMessage: `${trade.ticker} reached $${currentPrice.toFixed(2)}, crossing above trigger $${trade.entryTrigger.toFixed(2)}. Ready to execute ${trade.sharesTotal} shares.`,
        orderInstruction: `BUY ${trade.sharesTotal} shares of ${trade.ticker} at market ($${currentPrice.toFixed(2)}), set Stop at $${trade.initialStop.toFixed(2)}.`,
        recommendedAction: `Execute Long Entry with stop placed strictly at $${trade.initialStop.toFixed(2)}`,
        whyRationale: "Price has breached the technical breakout pivot. In swing trading, execution at the pivot captures immediate momentum expansion.",
      };
    }
  }

  // Check 2: STOP LOSS INVALIDATION (High Urgency)
  if (isActive && currentPrice <= trade.currentStop) {
    const isSlippage = currentPrice < trade.currentStop;
    const slippageNote = isSlippage ? ` (Gap slippage: exited at $${currentPrice.toFixed(2)})` : "";
    return {
      tradeId: trade.id,
      ticker: trade.ticker,
      currentPrice,
      unrealizedPnL,
      unrealizedPnLPct,
      currentRMultiple,
      actionRequired: "STOP_LOSS_HIT",
      alertType: "STOP_ALERT",
      urgency: "HIGH",
      headline: `STOP LOSS INVALIDATION: ${trade.ticker}`,
      alertTitle: `STOP LOSS INVALIDATION: ${trade.ticker}`,
      alertMessage: `${trade.ticker} dropped to $${currentPrice.toFixed(2)}, hitting stop price $${trade.currentStop.toFixed(2)}.${slippageNote} Invalidation rule violated.`,
      orderInstruction: `SELL ${trade.sharesRemaining || trade.sharesTotal} shares of ${trade.ticker} immediately at market.`,
      recommendedAction: "HONOR THE STOP IMMEDIATELY. Close remaining position. Never average down into a loser.",
      whyRationale: "Hard stop price touched or breached. The initial setup thesis has been invalidated by price action. Immediate exit is mandatory to protect capital.",
      shouldAutoClose: true,
    };
  }

  // Check 3: TARGET 1 HIT -> Scale 50% & Ratchet Stop to Breakeven
  if (trade.status === "ACTIVE" && currentPrice >= trade.target1) {
    const sharesToScale = Math.ceil(trade.sharesTotal / 2);
    return {
      tradeId: trade.id,
      ticker: trade.ticker,
      currentPrice,
      unrealizedPnL,
      unrealizedPnLPct,
      currentRMultiple,
      actionRequired: "SCALE_T1",
      alertType: "TARGET_1_HIT",
      urgency: "HIGH",
      headline: `TARGET 1 ACHIEVED (+${currentRMultiple}R): ${trade.ticker}`,
      alertTitle: `TARGET 1 ACHIEVED (+${currentRMultiple}R): ${trade.ticker}`,
      alertMessage: `${trade.ticker} hit Target 1 at $${currentPrice.toFixed(2)} ($${trade.target1.toFixed(2)} target).`,
      orderInstruction: `SELL ${sharesToScale} shares at market. RAISE stop loss on remaining ${trade.sharesTotal - sharesToScale} shares to Breakeven ($${effectiveEntry.toFixed(2)}).`,
      recommendedAction: `Scale out 50% (${sharesToScale} shares) to bank profits, and raise stop on remainder to Breakeven ($${effectiveEntry.toFixed(2)}).`,
      whyRationale: "Target 1 (2.0R) achieved. Scaling 50% locks in a guaranteed profitable campaign (+1.0R banked) and raising the stop on the runner to Breakeven eliminates all risk of turning a winning trade into a loser.",
      sharesToScale,
      suggestedStopUpdate: effectiveEntry,
    };
  }

  // Check 4: TARGET 2 MAX RUNNER REACHED -> Close Full Position
  if (trade.status === "SCALED_T1" && currentPrice >= trade.target2) {
    return {
      tradeId: trade.id,
      ticker: trade.ticker,
      currentPrice,
      unrealizedPnL,
      unrealizedPnLPct,
      currentRMultiple,
      actionRequired: "TARGET_2_HIT",
      alertType: "TARGET_2_HIT",
      urgency: "HIGH",
      headline: `TARGET 2 MAX RUNNER REACHED: ${trade.ticker}`,
      alertTitle: `TARGET 2 MAX RUNNER REACHED: ${trade.ticker}`,
      alertMessage: `${trade.ticker} reached full extension target $${trade.target2.toFixed(2)} at $${currentPrice.toFixed(2)}.`,
      orderInstruction: `SELL remaining ${trade.sharesRemaining || Math.floor(trade.sharesTotal / 2)} shares at market to close campaign.`,
      recommendedAction: "Close remaining runner position to lock in full campaign gains.",
      whyRationale: "Full campaign extension target (3.5R) reached. Closing the runner captures maximum asymmetric swing gains before mean reversion.",
      shouldAutoClose: true,
    };
  }

  // Check 5: SCALED_T1 Trailing Stop Progression (Upward-Only Ratchet)
  if (trade.status === "SCALED_T1" && currentPrice < trade.target2) {
    const trailCandidate = Number(Math.max(effectiveEntry, currentPrice - (1.5 * riskPerShare)).toFixed(2));
    if (trailCandidate > trade.currentStop) {
      return {
        tradeId: trade.id,
        ticker: trade.ticker,
        currentPrice,
        unrealizedPnL,
        unrealizedPnLPct,
        currentRMultiple,
        actionRequired: "TRAIL_STOP_UPDATE",
        urgency: "LOW",
        headline: `Trail Stop Adjustment: ${trade.ticker}`,
        alertTitle: `Trail Stop Adjustment: ${trade.ticker}`,
        alertMessage: `Price action supports tightening stop on ${trade.ticker} runner from $${trade.currentStop.toFixed(2)} to $${trailCandidate.toFixed(2)}.`,
        orderInstruction: `UPDATE Stop Loss order for ${trade.ticker} to $${trailCandidate.toFixed(2)}.`,
        recommendedAction: `Tighten trailing stop to $${trailCandidate.toFixed(2)} to lock in runner profits.`,
        whyRationale: "As price trends higher after T1, trailing the stop behind swing pivots locks in open profits without capping upside potential.",
        suggestedStopUpdate: trailCandidate,
      };
    }
  }

  // Check 6: TIME STOP DISCIPLINE (5–7 Sessions / timeStopSessions)
  const timeStopLimit = trade.timeStopSessions || 6;
  const isTimeStopExpired = sessions >= timeStopLimit;
  const isTimeStopWarning = sessions >= 5 && sessions < timeStopLimit;

  if (isActive && isTimeStopExpired) {
    return {
      tradeId: trade.id,
      ticker: trade.ticker,
      currentPrice,
      unrealizedPnL,
      unrealizedPnLPct,
      currentRMultiple,
      actionRequired: "TIME_STOP_EXPIRED",
      alertType: "TIME_STOP_EXPIRED",
      urgency: "HIGH",
      headline: `Time Stop Expired (Session ${sessions}): ${trade.ticker}`,
      alertTitle: `Time Stop Expired (Session ${sessions}): ${trade.ticker}`,
      alertMessage: `${trade.ticker} has been active for ${sessions} sessions without reaching target. Setup momentum has expired.`,
      orderInstruction: `SELL ${trade.sharesRemaining || trade.sharesTotal} shares at market to release risk capital.`,
      recommendedAction: "Liquidate position at market: Time stop reached without technical follow-through. Close out if momentum has stalled rather than tying up risk capital.",
      whyRationale: "Institutional swing trading catalysts deliver expansion within 3–5 sessions. Dead money past 6–7 sessions incurs opportunity cost.",
      shouldAutoClose: false,
    };
  }

  if (isActive && (isTimeStopWarning || sessions === timeStopLimit - 1)) {
    return {
      tradeId: trade.id,
      ticker: trade.ticker,
      currentPrice,
      unrealizedPnL,
      unrealizedPnLPct,
      currentRMultiple,
      actionRequired: "TIME_STOP_WARNING",
      alertType: "TIME_STOP_WARNING",
      urgency: "MEDIUM",
      headline: `Time Stop Warning: ${trade.ticker}`,
      alertTitle: `Time Stop Warning: ${trade.ticker}`,
      alertMessage: `${trade.ticker} has been active for ${sessions} sessions without reaching target. Setup is going stale.`,
      orderInstruction: `Monitor ${trade.ticker} closely for exit if breakout fails to expand today.`,
      recommendedAction: "Review position: Close out if momentum has stalled rather than tying up risk capital.",
      whyRationale: "Position is approaching session 5–6 stagnation. Be prepared to exit at breakeven or small scratch if follow-through fails.",
    };
  }

  // Default: Normal Active State
  return {
    tradeId: trade.id,
    ticker: trade.ticker,
    currentPrice,
    unrealizedPnL,
    unrealizedPnLPct,
    currentRMultiple,
    actionRequired: "NONE",
  };
}

/**
 * Alias for evaluateTrade adhering to PROJECT.md interface contract.
 */
export function evaluateTradeRules(
  trade: TradeRuleInput,
  quote: QuoteData | PartialQuote | number,
  sessionsElapsed?: number
): TradeEvaluation {
  return evaluateTrade(trade, quote, sessionsElapsed);
}

/**
 * Pre-trade gatekeeper verifying portfolio-level risk constraints:
 * 1. Max 3 active concurrent swing trades per sleeve
 * 2. Max 3.0% aggregate sleeve open risk ($450 on $15,000 account)
 * 3. Max 2 concurrent positions in the same sector
 */
export function validateProposedTrade(
  proposed: ProposedTrade,
  portfolio: PortfolioStateInput
): PortfolioRuleCheckResult {
  const accountSize = portfolio.accountSize || 15000.0;
  const maxSleeveRiskPct = portfolio.maxSleeveRiskPct || 3.0;
  const maxOpenPositions = portfolio.maxOpenPositions || 3;
  const maxSectorPositions = portfolio.maxSectorPositions || 2;
  const trades = portfolio.trades || [];

  const warnings: string[] = [];

  // Filter active trades
  const activeTrades = trades.filter(t => t.status === "ACTIVE" || t.status === "SCALED_T1");
  const activeCount = activeTrades.length;

  // Calculate current aggregate open risk
  const currentOpenRiskDollars = calculateAggregateOpenRisk(activeTrades);
  const currentOpenRiskPct = accountSize > 0 ? Number(((currentOpenRiskDollars / accountSize) * 100).toFixed(4)) : 0;

  // Proposed Trade Risk
  let proposedRiskDollars = proposed.riskDollars ?? proposed.dollarRisk ?? 0;
  if (proposedRiskDollars <= 0 && proposed.entryPrice && proposed.stopLoss && proposed.shares) {
    const riskPerShare = Math.max(0, proposed.entryPrice - proposed.stopLoss);
    proposedRiskDollars = Number((riskPerShare * proposed.shares).toFixed(2));
  }

  const projectedOpenRiskDollars = Number((currentOpenRiskDollars + proposedRiskDollars).toFixed(2));
  const projectedOpenRiskPct = accountSize > 0 ? Number(((projectedOpenRiskDollars / accountSize) * 100).toFixed(4)) : 0;

  // Sector count calculation
  const proposedSector = (proposed.sector || "Diversified").trim().toLowerCase();
  const currentSectorCount = activeTrades.filter(t => {
    const s = (t.sector || "Diversified").trim().toLowerCase();
    return s === proposedSector;
  }).length;

  // Check 1: Max Open Trades Limit
  if (activeCount >= maxOpenPositions) {
    const reason = `Sleeve position limit reached: Maximum ${maxOpenPositions} active concurrent swing trades allowed`;
    return {
      isAllowed: false,
      canOpen: false,
      blockReason: reason,
      rejectionReason: reason,
      warnings,
      currentOpenRiskDollars,
      currentOpenRiskPct,
      projectedOpenRiskDollars,
      projectedOpenRiskPct,
      currentActiveCount: activeCount,
      currentSectorCount,
      aggregateRiskDollars: currentOpenRiskDollars,
      aggregateRiskPct: currentOpenRiskPct,
    };
  }

  // Check 2: Sector Concentration Limit
  if (currentSectorCount >= maxSectorPositions) {
    const sectorDisplay = proposed.sector || "this";
    const reason = `Sector concentration limit exceeded: Maximum ${maxSectorPositions} concurrent positions allowed in ${sectorDisplay} sector`;
    return {
      isAllowed: false,
      canOpen: false,
      blockReason: reason,
      rejectionReason: reason,
      warnings,
      currentOpenRiskDollars,
      currentOpenRiskPct,
      projectedOpenRiskDollars,
      projectedOpenRiskPct,
      currentActiveCount: activeCount,
      currentSectorCount,
      aggregateRiskDollars: currentOpenRiskDollars,
      aggregateRiskPct: currentOpenRiskPct,
    };
  }

  // Check 3: Aggregate Sleeve Open Risk Cap (e.g. 3.0% = $450)
  const maxRiskBudgetDollars = Number(((accountSize * maxSleeveRiskPct) / 100.0).toFixed(2));
  if (projectedOpenRiskDollars > maxRiskBudgetDollars) {
    const reason = `Aggregate sleeve open risk limit exceeded: Proposed risk ($${projectedOpenRiskDollars.toFixed(2)} / ${projectedOpenRiskPct.toFixed(2)}%) exceeds the ${maxSleeveRiskPct.toFixed(1)}% sleeve cap ($${maxRiskBudgetDollars.toFixed(2)})`;
    return {
      isAllowed: false,
      canOpen: false,
      blockReason: reason,
      rejectionReason: reason,
      warnings,
      currentOpenRiskDollars,
      currentOpenRiskPct,
      projectedOpenRiskDollars,
      projectedOpenRiskPct,
      currentActiveCount: activeCount,
      currentSectorCount,
      aggregateRiskDollars: currentOpenRiskDollars,
      aggregateRiskPct: currentOpenRiskPct,
    };
  }

  return {
    isAllowed: true,
    canOpen: true,
    warnings,
    currentOpenRiskDollars,
    currentOpenRiskPct,
    projectedOpenRiskDollars,
    projectedOpenRiskPct,
    currentActiveCount: activeCount,
    currentSectorCount,
    aggregateRiskDollars: currentOpenRiskDollars,
    aggregateRiskPct: currentOpenRiskPct,
  };
}

/**
 * Helper conforming to test harness expectations:
 * `evaluatePortfolioRules(activeTrades, proposed, settings)`
 */
export function evaluatePortfolioRules(
  activeTrades: TradeRuleInput[] | any[],
  proposed: ProposedTrade,
  settings?: { accountSize?: number; maxSleeveRiskPct?: number; maxOpenPositions?: number; maxSectorPositions?: number }
): PortfolioRuleCheckResult {
  return validateProposedTrade(proposed, {
    accountSize: settings?.accountSize ?? 15000.0,
    maxSleeveRiskPct: settings?.maxSleeveRiskPct ?? 3.0,
    maxOpenPositions: settings?.maxOpenPositions ?? 3,
    maxSectorPositions: settings?.maxSectorPositions ?? 2,
    trades: activeTrades,
  });
}
