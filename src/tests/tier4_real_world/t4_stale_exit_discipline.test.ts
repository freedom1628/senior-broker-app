// Tier 4 Real-World Workload Scenario Test: Stale Exit Discipline & Capital Recycling
// Requirements: ORIGINAL_REQUEST §R2.1, §R2.2, §R2.3, §R3.1, §R3.3, §R5.1

import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade } from "../helpers/mock-storage";
import { MockMarketEngine } from "../helpers/mock-market";
import {
  evaluateTrade,
  validateProposedTrade,
  calculateTradeOpenRisk,
  calculateAggregateOpenRisk,
} from "../../lib/market/rule-engine";
import { generateDailyPortfolioReport } from "../../lib/portfolio/daily-report";
import { calculatePositionSize } from "../../lib/portfolio/sizing-calculator";

// Helper for Journal Analytics Calculation
export interface JournalAnalyticsMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  totalRealizedPnL: number;
  winRatePct: number;
  profitFactor: number;
  avgRMultiple: number;
  avgWinDollars: number;
  avgLossDollars: number;
  disciplineScorePct: number;
}

export function computeJournalAnalytics(closedTrades: StoredTrade[]): JournalAnalyticsMetrics {
  if (closedTrades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      breakevenTrades: 0,
      totalRealizedPnL: 0.0,
      winRatePct: 0.0,
      profitFactor: 0.0,
      avgRMultiple: 0.0,
      avgWinDollars: 0.0,
      avgLossDollars: 0.0,
      disciplineScorePct: 100.0,
    };
  }

  let totalPnL = 0;
  let totalR = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let winningCount = 0;
  let losingCount = 0;
  let breakevenCount = 0;

  for (const t of closedTrades) {
    const pnl = t.realizedPnL ?? 0;
    const r = t.rMultiple ?? 0;
    totalPnL += pnl;
    totalR += r;

    if (pnl > 0.01) {
      winningCount++;
      grossProfit += pnl;
    } else if (pnl < -0.01) {
      losingCount++;
      grossLoss += Math.abs(pnl);
    } else {
      breakevenCount++;
    }
  }

  const winRatePct = Number(((winningCount / closedTrades.length) * 100).toFixed(1));
  const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 999.0 : 0.0;
  const avgRMultiple = Number((totalR / closedTrades.length).toFixed(2));
  const avgWinDollars = winningCount > 0 ? Number((grossProfit / winningCount).toFixed(2)) : 0;
  const avgLossDollars = losingCount > 0 ? Number((grossLoss / losingCount).toFixed(2)) : 0;

  // Calculate Discipline Score: 100% baseline with deductions for time-stop violations
  let timeStopViolations = 0;
  for (const t of closedTrades) {
    const limit = t.timeStopSessions || 7;
    if (t.sessionsElapsed > limit && t.exitReason !== "TARGET_1_REACHED" && t.exitReason !== "TARGET_2_REACHED") {
      timeStopViolations++;
    }
  }
  const violationRatio = closedTrades.length > 0 ? timeStopViolations / closedTrades.length : 0;
  const disciplineScorePct = Number(Math.max(0, 100.0 - (violationRatio * 35)).toFixed(1));

  return {
    totalTrades: closedTrades.length,
    winningTrades: winningCount,
    losingTrades: losingCount,
    breakevenTrades: breakevenCount,
    totalRealizedPnL: Number(totalPnL.toFixed(2)),
    winRatePct,
    profitFactor,
    avgRMultiple,
    avgWinDollars,
    avgLossDollars,
    disciplineScorePct,
  };
}

// 1-Click Stale Position Liquidation Helper
export function executeStalePositionExit(
  storage: MockDualLayerStorage,
  tradeId: string,
  exitPrice: number,
  exitReason: string = "TIME_STOP_EXPIRED"
): { success: boolean; closedTrade?: StoredTrade; error?: string } {
  const trades = storage.getTrades();
  const trade = trades.find(t => t.id === tradeId);
  if (!trade) {
    return { success: false, error: "Trade not found" };
  }
  if (trade.status === "CLOSED" || trade.status === "CANCELLED") {
    return { success: false, error: "Trade is already closed or cancelled" };
  }

  const effectiveEntry = trade.actualEntry || trade.entryTrigger;
  const riskPerShare = Math.max(0.01, Math.abs(effectiveEntry - trade.initialStop));
  const realizedPnL = Number(((exitPrice - effectiveEntry) * trade.sharesRemaining).toFixed(2));
  const rMultiple = Number(((exitPrice - effectiveEntry) / riskPerShare).toFixed(2));

  const closedTrade: StoredTrade = {
    ...trade,
    status: "CLOSED",
    sharesRemaining: 0,
    closedPrice: exitPrice,
    closedDate: new Date().toISOString(),
    realizedPnL: Number(((trade.realizedPnL || 0) + realizedPnL).toFixed(2)),
    rMultiple,
    exitReason,
    notes: trade.notes
      ? `${trade.notes} | 1-Click Stale Exit executed after ${trade.sessionsElapsed} sessions at $${exitPrice.toFixed(2)}.`
      : `1-Click Stale Exit executed after ${trade.sessionsElapsed} sessions at $${exitPrice.toFixed(2)}.`,
  };

  storage.addOrUpdateTrade(closedTrade);
  return { success: true, closedTrade };
}

describe("Tier 4 Scenario: Stale Exit Discipline & Capital Recycling", () => {
  let storage: MockDualLayerStorage;
  let market: MockMarketEngine;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
    market = new MockMarketEngine();
  });

  it("Scenario 1 - Stagnation Detection & Session Count Progression (Day 0 Entry -> Days 1-4 Consolidation -> Session 5 Warning -> Session 7 Expired Liquidation)", () => {
    // 1. Breakout setup enters on Day 0: Entry $100.00, Hard Stop $98.00 ($2.00 risk = 1.0R, 75 shares for $150 risk on $15,000 capital)
    const settings = storage.getSettings();
    expect(settings.accountSize).toBe(15000.0);
    expect(settings.riskPerTrade).toBe(1.0);

    const sized = calculatePositionSize({
      accountSize: settings.accountSize,
      riskPct: settings.riskPerTrade,
      entryPrice: 100.00,
      stopLoss: 98.00,
      maxPositionPct: 50.0, // Allocate up to 50% capital to accommodate $7,500 position size
    });

    expect(sized.isValid).toBe(true);
    expect(sized.shares).toBe(75);
    expect(sized.dollarRisk).toBe(150.00);
    expect(sized.riskPerShare).toBe(2.00);

    const trade: StoredTrade = {
      id: "tr_stale_1",
      ticker: "STAL",
      companyName: "Stagnant Corp",
      status: "ACTIVE",
      setupType: "Resistance Breakout",
      entryTrigger: 100.00,
      actualEntry: 100.00,
      entryDate: market.getSessionInfo().dateIso,
      sharesTotal: 75,
      sharesRemaining: 75,
      initialStop: 98.00,
      currentStop: 98.00,
      target1: 104.00,
      target2: 107.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 0,
      notes: "High-tight consolidation breakout pivot",
    };
    storage.addOrUpdateTrade(trade);

    // 2. Day 1 to 4: Price fluctuates between $99.80 and $100.30 (<0.2R expansion). Rule engine evaluates state as "NONE" / NORMAL.
    const pricePath = [
      { day: 1, price: 100.20, rMultiple: 0.10 },
      { day: 2, price: 99.85, rMultiple: -0.08 },
      { day: 3, price: 100.30, rMultiple: 0.15 },
      { day: 4, price: 99.90, rMultiple: -0.05 },
    ];

    for (const step of pricePath) {
      market.advanceSession(1);
      market.setPrice("STAL", step.price);
      trade.sessionsElapsed = step.day;

      const evalRes = evaluateTrade(trade, market.getQuote("STAL"));
      expect(evalRes.actionRequired).toBe("NONE");
      expect(evalRes.alertType).toBeUndefined();
      expect(Math.abs(evalRes.currentRMultiple)).toBeLessThan(0.20);
    }

    // 3. Session 5: Rule engine triggers "TIME_STOP_WARNING" with MEDIUM urgency and warns trader of stagnation.
    market.advanceSession(1);
    market.setPrice("STAL", 100.10);
    trade.sessionsElapsed = 5;

    const session5Eval = evaluateTrade(trade, market.getQuote("STAL"));
    expect(session5Eval.actionRequired).toBe("TIME_STOP_WARNING");
    expect(session5Eval.alertType).toBe("TIME_STOP_WARNING");
    expect(session5Eval.urgency).toBe("MEDIUM");
    expect(session5Eval.alertTitle).toContain("Time Stop Warning: STAL");
    expect(session5Eval.alertMessage).toContain("5 sessions without reaching target");
    expect(session5Eval.recommendedAction).toContain("Close out if momentum has stalled");

    // Session 6: Proximity check in Daily Report
    market.advanceSession(1);
    market.setPrice("STAL", 99.80);
    trade.sessionsElapsed = 6;
    storage.addOrUpdateTrade(trade);

    const report = generateDailyPortfolioReport(storage.getTrades(), market.getAllQuotes(), settings.accountSize);
    const timeAlert = report.actionItems.find(a => a.ticker === "STAL" && a.actionType === "TIME_STOP_WARNING");
    expect(timeAlert).toBeDefined();
    expect(timeAlert?.urgency).toBe("HIGH");
    expect(timeAlert?.headline).toContain("6/7 Sessions Elapsed");

    // 4. Session 7: Rule engine triggers "TIME_STOP_EXPIRED" with HIGH urgency instructing immediate liquidation.
    market.advanceSession(1);
    market.setPrice("STAL", 99.70);
    trade.sessionsElapsed = 7;

    const session7Eval = evaluateTrade(trade, market.getQuote("STAL"));
    expect(session7Eval.actionRequired).toBe("TIME_STOP_EXPIRED");
    expect(session7Eval.alertType).toBe("TIME_STOP_EXPIRED");
    expect(session7Eval.urgency).toBe("HIGH");
    expect(session7Eval.alertTitle).toContain("Time Stop Expired (Session 7): STAL");
    expect(session7Eval.alertMessage).toContain("7 sessions without reaching target");
    expect(session7Eval.orderInstruction).toContain("SELL 75 shares at market to release risk capital");
    expect(session7Eval.recommendedAction).toContain("Liquidate position at market");
    expect(session7Eval.whyRationale).toContain("Dead money past 6–7 sessions incurs opportunity cost");
  });

  it("Scenario 2 - 1-Click Stale Exit Execution & R-Multiple Calculation (Instant Execution -> P&L -$22.50 -> -0.15R -> Clean Journal Record)", () => {
    // 1. Set up active trade at Session 7 expiration
    const trade: StoredTrade = {
      id: "tr_stale_exec_2",
      ticker: "STAL",
      companyName: "Stagnant Corp",
      status: "ACTIVE",
      setupType: "Resistance Breakout",
      entryTrigger: 100.00,
      actualEntry: 100.00,
      entryDate: "2026-08-10",
      sharesTotal: 75,
      sharesRemaining: 75,
      initialStop: 98.00,
      currentStop: 98.00,
      target1: 104.00,
      target2: 107.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 7,
      notes: "High-tight consolidation breakout pivot",
    };
    storage.addOrUpdateTrade(trade);

    expect(storage.getTrades().filter(t => t.status === "ACTIVE")).toHaveLength(1);
    expect(storage.getTrades().filter(t => t.status === "CLOSED")).toHaveLength(0);

    // 2. Market price is at $99.70 upon expiration trigger
    market.setPrice("STAL", 99.70);
    const exitQuote = market.getQuote("STAL");
    expect(exitQuote.price).toBe(99.70);

    // 3. Trader executes 1-Click "Exit Stale Position" action
    const exitResult = executeStalePositionExit(storage, "tr_stale_exec_2", 99.70, "TIME_STOP_EXPIRED");

    expect(exitResult.success).toBe(true);
    expect(exitResult.closedTrade).toBeDefined();

    // 4. Validate exact arithmetic calculations:
    // Realized P&L: 75 shares * ($99.70 - $100.00) = -$22.50
    // Realized R-Multiple: -$22.50 / $150.00 = -0.15R
    const closed = exitResult.closedTrade!;
    expect(closed.status).toBe("CLOSED");
    expect(closed.sharesRemaining).toBe(0);
    expect(closed.closedPrice).toBe(99.70);
    expect(closed.realizedPnL).toBe(-22.50);
    expect(closed.rMultiple).toBe(-0.15);
    expect(closed.exitReason).toBe("TIME_STOP_EXPIRED");
    expect(closed.sessionsElapsed).toBe(7);
    expect(closed.notes).toContain("1-Click Stale Exit executed after 7 sessions at $99.70");

    // 5. Verify dual-layer persistence integrity
    const allTrades = storage.getTrades();
    const activeList = allTrades.filter(t => t.status === "ACTIVE");
    const closedList = allTrades.filter(t => t.status === "CLOSED");

    expect(activeList).toHaveLength(0);
    expect(closedList).toHaveLength(1);
    expect(closedList[0].id).toBe("tr_stale_exec_2");
    expect(closedList[0].realizedPnL).toBe(-22.50);

    // Open risk is now mathematically $0.00
    const openRisk = calculateTradeOpenRisk(closedList[0]);
    expect(openRisk).toBe(0.00);
  });

  it("Scenario 3 - Discipline Score & Analytics Impact (Prompt Session 7 Exit Maintains 95%+ Discipline vs Undisciplined Holding Penalty)", () => {
    // 1. Portfolio A: Disciplined Trader Portfolio (3 Closed Trades)
    // - Trade 1: Textbook Winner ATRO (+2.0R, +$300.00)
    // - Trade 2: Disciplined Hard Stop MTRN (-1.0R, -$150.00)
    // - Trade 3: Prompt Session 7 Time-Stop Exit STAL (-0.15R, -$22.50)
    const disciplinedTrades: StoredTrade[] = [
      {
        id: "c_disc_1",
        ticker: "ATRO",
        companyName: "Astronics Corporation",
        status: "CLOSED",
        setupType: "Base Breakout",
        entryTrigger: 88.50,
        actualEntry: 88.50,
        sharesTotal: 27,
        sharesRemaining: 0,
        initialStop: 83.75,
        currentStop: 88.50,
        target1: 98.00,
        target2: 108.00,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 4,
        closedPrice: 99.60,
        realizedPnL: 300.00,
        rMultiple: 2.00,
        exitReason: "TARGET_1_REACHED",
      },
      {
        id: "c_disc_2",
        ticker: "MTRN",
        companyName: "Materion Corporation",
        status: "CLOSED",
        setupType: "Pullback Pivot",
        entryTrigger: 282.00,
        actualEntry: 282.00,
        sharesTotal: 13,
        sharesRemaining: 0,
        initialStop: 270.50,
        currentStop: 270.50,
        target1: 305.00,
        target2: 328.00,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 2,
        closedPrice: 270.50,
        realizedPnL: -149.50,
        rMultiple: -1.00,
        exitReason: "HARD_STOP",
      },
      {
        id: "c_disc_3",
        ticker: "STAL",
        companyName: "Stagnant Corp",
        status: "CLOSED",
        setupType: "Resistance Breakout",
        entryTrigger: 100.00,
        actualEntry: 100.00,
        sharesTotal: 75,
        sharesRemaining: 0,
        initialStop: 98.00,
        currentStop: 98.00,
        target1: 104.00,
        target2: 107.00,
        rrRatio: 2.0,
        timeStopSessions: 7,
        sessionsElapsed: 7, // Exited promptly on Session 7
        closedPrice: 99.70,
        realizedPnL: -22.50,
        rMultiple: -0.15,
        exitReason: "TIME_STOP_EXPIRED",
      },
    ];

    const disciplinedMetrics = computeJournalAnalytics(disciplinedTrades);

    expect(disciplinedMetrics.totalTrades).toBe(3);
    expect(disciplinedMetrics.winningTrades).toBe(1);
    expect(disciplinedMetrics.losingTrades).toBe(2);
    expect(disciplinedMetrics.winRatePct).toBe(33.3);
    // Net Realized P&L = +300.00 - 149.50 - 22.50 = +$128.00
    expect(disciplinedMetrics.totalRealizedPnL).toBe(128.00);
    // Profit Factor = $300.00 / ($149.50 + $22.50) = $300.00 / $172.00 = 1.74
    expect(disciplinedMetrics.profitFactor).toBe(1.74);
    // Average R-Multiple = (+2.00 - 1.00 - 0.15) / 3 = +0.28R
    expect(disciplinedMetrics.avgRMultiple).toBe(0.28);
    // Discipline Score maintained at 95%+
    expect(disciplinedMetrics.disciplineScorePct).toBeGreaterThanOrEqual(95.0);
    expect(disciplinedMetrics.disciplineScorePct).toBe(100.0);

    // 2. Portfolio B: Undisciplined Trader Comparison
    // Trader ignores time-stop warnings on STAL, holds for 12 sessions, and price slowly drifts down to $96.00 (-2.0R, -$300.00 loss)
    const undisciplinedTrades: StoredTrade[] = [
      disciplinedTrades[0],
      disciplinedTrades[1],
      {
        id: "c_undisc_3",
        ticker: "STAL",
        companyName: "Stagnant Corp",
        status: "CLOSED",
        setupType: "Resistance Breakout",
        entryTrigger: 100.00,
        actualEntry: 100.00,
        sharesTotal: 75,
        sharesRemaining: 0,
        initialStop: 98.00,
        currentStop: 96.00, // Widened stop violation!
        target1: 104.00,
        target2: 107.00,
        rrRatio: 2.0,
        timeStopSessions: 7,
        sessionsElapsed: 12, // Held to session 12 in violation of time-stop rule
        closedPrice: 96.00,
        realizedPnL: -300.00,
        rMultiple: -2.00,
        exitReason: "CATASTROPHIC_STOP",
      },
    ];

    const undisciplinedMetrics = computeJournalAnalytics(undisciplinedTrades);

    // Total Realized P&L flips from profitable +$128.00 to net negative -$149.50
    expect(undisciplinedMetrics.totalRealizedPnL).toBe(-149.50);
    // Profit Factor collapses below 1.0 to 0.67 ($300 / $449.50)
    expect(undisciplinedMetrics.profitFactor).toBe(0.67);
    // Average R-Multiple collapses into negative territory (-0.33R)
    expect(undisciplinedMetrics.avgRMultiple).toBe(-0.33);
    // Discipline score suffers a severe penalty dropping well below 90%
    expect(undisciplinedMetrics.disciplineScorePct).toBeLessThan(90.0);
    expect(undisciplinedMetrics.disciplineScorePct).toBeCloseTo(88.3, 1);
  });

  it("Scenario 4 - Sleeve Capacity & Risk Recycling ($450 Max Risk Cap -> Stale Exit Frees $150 Open Risk & $7,500 Capital -> Sizing & Entry of LITE Candidate)", () => {
    const settings = storage.getSettings();
    const accountSize = settings.accountSize; // $15,000
    const maxSleeveRiskDollars = accountSize * (settings.maxSleeveRiskPct / 100); // 3.0% = $450.00

    expect(accountSize).toBe(15000.0);
    expect(maxSleeveRiskDollars).toBe(450.00);

    // 1. Initial State: Portfolio has 3 active trades utilizing the full 3.0% sleeve risk cap ($446.65)
    // Trade 1: Stagnant STAL (Tech) - $150.00 open risk ($7,500 allocated capital, 7 sessions elapsed)
    const trade1: StoredTrade = {
      id: "tr_cap_stal",
      ticker: "STAL",
      companyName: "Stagnant Corp",
      status: "ACTIVE",
      setupType: "Technology / Breakout",
      entryTrigger: 100.00,
      actualEntry: 100.00,
      sharesTotal: 75,
      sharesRemaining: 75,
      initialStop: 98.00,
      currentStop: 98.00,
      target1: 104.00,
      target2: 107.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 7, // Stale!
    };

    // Trade 2: Constructive ATRO (Aerospace) - $147.15 open risk ($2,408.40 allocated capital)
    const trade2: StoredTrade = {
      id: "tr_cap_atro",
      ticker: "ATRO",
      companyName: "Astronics Corporation",
      status: "ACTIVE",
      setupType: "Aerospace & Defense Breakout",
      entryTrigger: 89.20,
      actualEntry: 89.20,
      sharesTotal: 27,
      sharesRemaining: 27,
      initialStop: 83.75,
      currentStop: 83.75,
      target1: 100.10,
      target2: 112.00,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 2,
    };

    // Trade 3: Constructive MTRN (Materials) - $149.50 open risk ($3,666.00 allocated capital)
    const trade3: StoredTrade = {
      id: "tr_cap_mtrn",
      ticker: "MTRN",
      companyName: "Materion Corporation",
      status: "ACTIVE",
      setupType: "Materials Pullback",
      entryTrigger: 282.00,
      actualEntry: 282.00,
      sharesTotal: 13,
      sharesRemaining: 13,
      initialStop: 270.50,
      currentStop: 270.50,
      target1: 305.00,
      target2: 328.00,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 2,
    };

    storage.saveTrades([trade1, trade2, trade3]);

    const initialActiveTrades = storage.getTrades().filter(t => t.status === "ACTIVE");
    expect(initialActiveTrades).toHaveLength(3);

    const initialOpenRisk = calculateAggregateOpenRisk(initialActiveTrades);
    // Risk = (100 - 98)*75 + (89.20 - 83.75)*27 + (282 - 270.50)*13 = 150.00 + 147.15 + 149.50 = $446.65
    expect(initialOpenRisk).toBeCloseTo(446.65, 2);
    expect(initialOpenRisk).toBeLessThanOrEqual(450.00);

    const initialAllocatedCapital = (100.00 * 75) + (89.20 * 27) + (282.00 * 13); // $7,500 + $2,408.40 + $3,666 = $13,574.40
    expect(initialAllocatedCapital).toBeCloseTo(13574.40, 2);

    // 2. High-conviction AI Screener candidate arrives: LITE Breakout (Entry $950.00, Stop $930.00, Risk $140.00)
    const proposedLite = {
      ticker: "LITE",
      companyName: "Lumentum Holdings Inc.",
      sector: "Technology",
      entryPrice: 950.00,
      stopLoss: 930.00,
      shares: 7,
      riskDollars: 140.00,
    };

    // 3. Pre-Exit Validation Gate: Attempting to open LITE is BLOCKED due to max 3 positions and risk ceiling
    const preCheck = validateProposedTrade(proposedLite, {
      accountSize: 15000.0,
      maxSleeveRiskPct: 3.0,
      maxOpenPositions: 3,
      trades: initialActiveTrades,
    });

    expect(preCheck.isAllowed).toBe(false);
    expect(preCheck.canOpen).toBe(false);
    expect(preCheck.blockReason).toContain("Maximum 3 active concurrent swing trades allowed");

    // 4. Trader executes 1-Click Stale Exit on Trade 1 (STAL) at market $99.70
    const exitRes = executeStalePositionExit(storage, "tr_cap_stal", 99.70, "TIME_STOP_EXPIRED");
    expect(exitRes.success).toBe(true);

    // 5. Verify freed capacity & risk recycling:
    // - Active count drops from 3 to 2
    // - Open risk drops from $446.65 to $296.65 (releasing $150.00 open risk)
    // - Allocated capital decreases by $7,500.00
    const postExitActiveTrades = storage.getTrades().filter(t => t.status === "ACTIVE");
    expect(postExitActiveTrades).toHaveLength(2);

    const postExitOpenRisk = calculateAggregateOpenRisk(postExitActiveTrades);
    expect(postExitOpenRisk).toBeCloseTo(296.65, 2);
    expect(postExitOpenRisk).toBeLessThan(300.00);

    const freedRiskBudget = maxSleeveRiskDollars - postExitOpenRisk;
    expect(freedRiskBudget).toBeCloseTo(153.35, 2);
    expect(freedRiskBudget).toBeGreaterThanOrEqual(140.00);

    // 6. Sizing calculator sizes LITE with 1% account risk budget
    const liteSizing = calculatePositionSize({
      accountSize: 15000.0,
      riskPct: 1.0,
      entryPrice: 950.00,
      stopLoss: 930.00,
      maxPositionPct: 50.0, // Accommodate $6,650 allocation
      availableCash: 15000.0 - (89.20 * 27 + 282.00 * 13) + (75 * 99.70), // ~$16,403 cash
    });

    expect(liteSizing.isValid).toBe(true);
    expect(liteSizing.shares).toBe(7); // $150 budget / $20 risk per sh = 7.5 -> 7 shares ($140 risk)
    expect(liteSizing.dollarRisk).toBe(140.00);
    expect(liteSizing.target1).toBe(990.00); // +2.0R = 950 + 2*20 = 990
    expect(liteSizing.target2).toBe(1020.00); // +3.5R = 950 + 3.5*20 = 1020

    // 7. Post-Exit Validation Gate: Proposed LITE trade is now APPROVED
    const postCheck = validateProposedTrade(proposedLite, {
      accountSize: 15000.0,
      maxSleeveRiskPct: 3.0,
      maxOpenPositions: 3,
      trades: postExitActiveTrades,
    });

    expect(postCheck.isAllowed).toBe(true);
    expect(postCheck.canOpen).toBe(true);
    expect(postCheck.projectedOpenRiskDollars).toBeCloseTo(436.65, 2);
    expect(postCheck.projectedOpenRiskPct).toBeLessThanOrEqual(3.0);

    // 8. Execute entry for LITE into active portfolio
    const liteTrade: StoredTrade = {
      id: "tr_cap_lite",
      ticker: "LITE",
      companyName: "Lumentum Holdings Inc.",
      status: "ACTIVE",
      setupType: "Photonics Breakout",
      entryTrigger: 950.00,
      actualEntry: 950.00,
      entryDate: market.getSessionInfo().dateIso,
      sharesTotal: liteSizing.shares,
      sharesRemaining: liteSizing.shares,
      initialStop: liteSizing.stopLoss,
      currentStop: liteSizing.stopLoss,
      target1: liteSizing.target1,
      target2: liteSizing.target2,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 0,
      notes: "Sized and entered via recycled stale capital",
    };
    storage.addOrUpdateTrade(liteTrade);

    // 9. Final Portfolio Audit: 3 active positions, total open risk within 3.0% cap ($436.65 / 2.91%)
    const finalActiveTrades = storage.getTrades().filter(t => t.status === "ACTIVE");
    expect(finalActiveTrades).toHaveLength(3);

    const finalAggregateRisk = calculateAggregateOpenRisk(finalActiveTrades);
    expect(finalAggregateRisk).toBeCloseTo(436.65, 2);
    expect(finalAggregateRisk).toBeLessThanOrEqual(450.00);

    const finalReport = generateDailyPortfolioReport(storage.getTrades(), market.getAllQuotes(), 15000.0);
    expect(finalReport.portfolioSummary.totalOpenPositions).toBe(3);
    expect(finalReport.portfolioSummary.aggregateRiskPct).toBeLessThanOrEqual(3.0);
    // No RISK_ALERT generated because risk is properly compliant
    const riskAlert = finalReport.actionItems.find(a => a.actionType === "RISK_ALERT");
    expect(riskAlert).toBeUndefined();
  });

  it("Scenario 5 - Dynamic Resolution: Near-Stale Warning vs Target 1 Breakout Recovery", () => {
    // Two positions at Session 5 warning zone:
    // Setup A (Stale Path): Remains stagnant on Day 6-7 -> Expiration -> Stale Exit
    // Setup B (Recovery Path): Breaks out on Day 6 to Target 1 -> Scale 50% & Breakeven stop -> Time-stop threat eliminated!

    const tradeA: StoredTrade = {
      id: "tr_branch_a",
      ticker: "STAL_A",
      companyName: "Stagnant Corp A",
      status: "ACTIVE",
      entryTrigger: 100.00,
      actualEntry: 100.00,
      sharesTotal: 75,
      sharesRemaining: 75,
      initialStop: 98.00,
      currentStop: 98.00,
      target1: 104.00,
      target2: 107.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 5,
    };

    const tradeB: StoredTrade = {
      id: "tr_branch_b",
      ticker: "SURG_B",
      companyName: "Surge Corp B",
      status: "ACTIVE",
      entryTrigger: 50.00,
      actualEntry: 50.00,
      sharesTotal: 150,
      sharesRemaining: 150,
      initialStop: 49.00, // $1.00 risk/sh * 150 = $150 risk
      currentStop: 49.00,
      target1: 52.00, // +2.0R ($2.00 gain)
      target2: 53.50, // +3.5R
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 5,
    };

    storage.saveTrades([tradeA, tradeB]);

    // Session 5 Check: Both in TIME_STOP_WARNING zone
    market.setPrice("STAL_A", 100.10);
    market.setPrice("SURG_B", 50.20);

    const evalA5 = evaluateTrade(tradeA, market.getQuote("STAL_A"));
    const evalB5 = evaluateTrade(tradeB, market.getQuote("SURG_B"));

    expect(evalA5.alertType).toBe("TIME_STOP_WARNING");
    expect(evalB5.alertType).toBe("TIME_STOP_WARNING");

    // Session 6: SURG_B breaks out to $52.20 (Hits Target 1), while STAL_A drifts to $99.80
    market.advanceSession(1);
    market.setPrice("STAL_A", 99.80);
    market.setPrice("SURG_B", 52.20);
    tradeA.sessionsElapsed = 6;
    tradeB.sessionsElapsed = 6;

    const evalA6 = evaluateTrade(tradeA, market.getQuote("STAL_A"));
    const evalB6 = evaluateTrade(tradeB, market.getQuote("SURG_B"));

    expect(evalA6.alertType).toBe("TIME_STOP_WARNING");
    expect(evalB6.alertType).toBe("TARGET_1_HIT"); // Target 1 supersedes time stop!

    // Execute Scale 50% on SURG_B: Sell 75 shares at $52.20 (+$165.00 gain), move stop to Breakeven $50.00
    tradeB.status = "SCALED_T1";
    tradeB.sharesRemaining = 75;
    tradeB.currentStop = 50.00; // Breakeven floor! Open risk is now $0.00
    tradeB.realizedPnL = 165.00;
    storage.addOrUpdateTrade(tradeB);

    // Open risk on SURG_B is now mathematically $0.00
    expect(calculateTradeOpenRisk(tradeB)).toBe(0.00);

    // Session 7: STAL_A reaches expiration and is liquidated. SURG_B runner floats risk-free at $50.50 (consolidating above BE stop).
    market.advanceSession(1);
    market.setPrice("STAL_A", 99.70);
    market.setPrice("SURG_B", 50.50);
    tradeA.sessionsElapsed = 7;
    tradeB.sessionsElapsed = 7;

    const evalA7 = evaluateTrade(tradeA, market.getQuote("STAL_A"));
    expect(evalA7.alertType).toBe("TIME_STOP_EXPIRED");

    // Liquidate STAL_A
    const exitA = executeStalePositionExit(storage, "tr_branch_a", 99.70, "TIME_STOP_EXPIRED");
    expect(exitA.success).toBe(true);

    // Daily Report evaluation: SURG_B is treated as a healthy risk-free runner (TRAIL_STOP), not forced liquidation
    storage.addOrUpdateTrade(tradeB);
    const report = generateDailyPortfolioReport(storage.getTrades(), market.getAllQuotes(), 15000.0);
    const runnerAction = report.actionItems.find(a => a.ticker === "SURG_B" && a.actionType === "TRAIL_STOP");
    expect(runnerAction).toBeDefined();
    expect(runnerAction?.actionType).toBe("TRAIL_STOP");
    expect(runnerAction?.urgency).toBe("LOW");
    expect(runnerAction?.headline).toContain("Runner Active with Breakeven Floor");
  });
});
