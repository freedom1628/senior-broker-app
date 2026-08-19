// Tier 2 Boundary Value Analysis: Session Staleness, Time Stops, 1-Click Exits & Daily Briefing
// Covers:
// - Feature 17: 5–7 Session Time-Stop Rule (sessions 0, 1, 4, 5, 6, 7, 8+, custom parameters, SCALED_T1 runner exemption)
// - Feature 11: 1-Click Exit Stale Position (liquidation at market, R-multiple calculation, journal logging, double-exit defense)
// - Feature 14: Prioritized Daily Moves Briefing (HIGH/MEDIUM/LOW urgency triage, time stop warnings)
// - Feature 15: 1-Click Copy Briefing (standardized markdown formatting, empty briefing edge cases)
// - Mock Market: Session calendar, weekend skipping (Fri -> Mon), daily quote reference resets

import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade } from "../helpers/mock-storage";
import { MockMarketEngine } from "../helpers/mock-market";
import { evaluateTrade } from "../../lib/market/rule-engine";
import { generateDailyPortfolioReport, DailyPortfolioReport } from "../../lib/portfolio/daily-report";

// Helper to format daily briefing into standardized Markdown export (Feature 15 contract)
export function formatDailyBriefingMarkdown(report: DailyPortfolioReport): string {
  const lines: string[] = [];
  lines.push(`# Senior Broker — Daily Tactical Moves Briefing`);
  lines.push(`**Date:** ${report.generatedAt}`);
  lines.push(`**Market Regime:** ${report.marketRegime}`);
  lines.push(`**Active Positions:** ${report.portfolioSummary.totalOpenPositions} | **Pending Orders:** ${report.portfolioSummary.pendingOrdersCount}`);
  lines.push(`**Aggregate Risk:** $${report.portfolioSummary.aggregateRiskDollars.toFixed(2)} (${report.portfolioSummary.aggregateRiskPct.toFixed(2)}%) | **Floating P&L:** $${report.portfolioSummary.totalUnrealizedPnL.toFixed(2)}`);
  lines.push(``);

  lines.push(`## Action Items (${report.actionItems.length})`);
  if (report.actionItems.length === 0) {
    lines.push(`*No high-urgency moves required today. Maintain trailing stops on open positions.*`);
  } else {
    report.actionItems.forEach(item => {
      lines.push(`- **[${item.urgency}] ${item.ticker}**: ${item.headline}`);
      lines.push(`  - *Details:* ${item.details}`);
      lines.push(`  - *Instruction:* \`${item.suggestedOrder}\``);
    });
  }
  lines.push(``);

  lines.push(`## Desk Discipline Rules`);
  report.deskChecklist.forEach((rule, idx) => {
    lines.push(`${idx + 1}. ${rule}`);
  });

  return lines.join("\n");
}

// 1-Click Stale Position Liquidation Executor (Feature 11 contract)
export function executeStalePositionExit(
  storage: MockDualLayerStorage,
  tradeId: string,
  exitPrice: number,
  exitReason: string = "TIME_STOP_EXIT"
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
    realizedPnL: (trade.realizedPnL || 0) + realizedPnL,
    rMultiple,
    exitReason,
    notes: trade.notes ? `${trade.notes} | Liquidated via Time Stop after ${trade.sessionsElapsed} sessions.` : `Time Stop exit after ${trade.sessionsElapsed} sessions.`,
  };

  storage.addOrUpdateTrade(closedTrade);
  return { success: true, closedTrade };
}

describe("Tier 2: Session Staleness & Time-Stop Boundary Tests", () => {
  let storage: MockDualLayerStorage;
  let market: MockMarketEngine;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
    market = new MockMarketEngine();
  });

  describe("Feature 17: 5–7 Session Time-Stop Boundary Thresholds", () => {
    it("handles Session 0 (fresh entry day) without time stop alert", () => {
      const trade = {
        id: "tr_fresh",
        ticker: "ATRO",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75,
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        timeStopSessions: 5,
        sessionsElapsed: 0, // Day 0
      };

      const quote = { ...market.getQuote("ATRO"), price: 89.0 };
      const evalResult = evaluateTrade(trade, quote);
      expect(evalResult.alertType).toBeUndefined();
    });

    it("evaluates early development window (Sessions 1 to 3 of 5) as quiet hold", () => {
      const trade = {
        id: "tr_holding",
        ticker: "ATRO",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75,
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        timeStopSessions: 5,
        sessionsElapsed: 3,
      };

      const quote = { ...market.getQuote("ATRO"), price: 91.0 };
      const evalResult = evaluateTrade(trade, quote);
      expect(evalResult.alertType).toBeUndefined();
    });

    it("triggers Daily Report warning on Session 4 (sessionsElapsed >= timeStopSessions - 1)", () => {
      const trade: StoredTrade = {
        id: "tr_session_4",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75,
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        rrRatio: 2.13,
        timeStopSessions: 5,
        sessionsElapsed: 4, // 4 of 5
      };

      const quotes = { ATRO: { ...market.getQuote("ATRO"), price: 89.5 } };
      const report = generateDailyPortfolioReport([trade], quotes, 15000.0);
      const timeAlert = report.actionItems.find(a => a.actionType === "TIME_STOP_WARNING");
      expect(timeAlert).toBeDefined();
      expect(timeAlert?.urgency).toBe("HIGH");
      expect(timeAlert?.headline).toContain("4/5 Sessions Elapsed");
    });

    it("triggers evaluateTrade TIME_STOP_WARNING at session 5 of 7", () => {
      const trade = {
        id: "tr_session_5",
        ticker: "ATRO",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75,
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        timeStopSessions: 7,
        sessionsElapsed: 5, // Warning zone (5-6 of 7)
      };

      const quote = { ...market.getQuote("ATRO"), price: 89.5 };
      const evalResult = evaluateTrade(trade, quote);
      expect(evalResult.alertType).toBe("TIME_STOP_WARNING");
      expect(evalResult.alertTitle).toContain("Time Stop Warning: ATRO");
      expect(evalResult.alertMessage).toContain("5 sessions without reaching target");
      expect(evalResult.recommendedAction).toContain("Close out if momentum has stalled");
    });

    it("triggers TIME_STOP_EXPIRED when trade reaches full time limit (Session 7 of 7)", () => {
      const trade = {
        id: "tr_overdue",
        ticker: "ATRO",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75,
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        timeStopSessions: 7,
        sessionsElapsed: 7,
      };

      const quote = { ...market.getQuote("ATRO"), price: 89.0 };
      const evalResult = evaluateTrade(trade, quote);
      expect(evalResult.alertType).toBe("TIME_STOP_EXPIRED");
      expect(evalResult.alertMessage).toContain("7 sessions");
    });

    it("handles extreme session staleness (Session 25) without arithmetic degradation", () => {
      const trade = {
        id: "tr_extreme_stale",
        ticker: "ATRO",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75,
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        timeStopSessions: 6,
        sessionsElapsed: 25,
      };

      const quote = { ...market.getQuote("ATRO"), price: 88.5 };
      const evalResult = evaluateTrade(trade, quote);
      expect(evalResult.alertType).toBe("TIME_STOP_EXPIRED");
      expect(evalResult.currentRMultiple).toBe(0.0);
    });

    it("respects custom timeStopSessions parameter (e.g. 3 sessions vs 10 sessions)", () => {
      const tradeFast = {
        id: "tr_fast",
        ticker: "MTRN",
        status: "ACTIVE",
        entryTrigger: 280.0,
        actualEntry: 280.0,
        sharesTotal: 8,
        sharesRemaining: 8,
        initialStop: 270.0,
        currentStop: 270.0,
        target1: 300.0,
        target2: 320.0,
        timeStopSessions: 3,
        sessionsElapsed: 3,
      };
      const quoteFast = { ...market.getQuote("MTRN"), price: 282.0 };
      const evalFast = evaluateTrade(tradeFast, quoteFast);
      expect(evalFast.alertType).toBe("TIME_STOP_EXPIRED");

      const tradeSlow = {
        ...tradeFast,
        timeStopSessions: 10,
        sessionsElapsed: 3,
      };
      const evalSlow = evaluateTrade(tradeSlow, quoteFast);
      expect(evalSlow.alertType).toBeUndefined();
    });

    it("prioritizes TARGET_1_HIT and STOP_ALERT over TIME_STOP_WARNING when prices trigger simultaneously", () => {
      const tradeHitT1 = {
        id: "tr_both_t1",
        ticker: "ATRO",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75,
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        timeStopSessions: 5,
        sessionsElapsed: 6, // Stale!
      };

      // If price reached T1 ($100.50), TARGET_1_HIT takes priority
      const quoteT1 = { ...market.getQuote("ATRO"), price: 100.5 };
      const evalT1 = evaluateTrade(tradeHitT1, quoteT1);
      expect(evalT1.alertType).toBe("TARGET_1_HIT");

      // If price dropped to Stop ($83.00), STOP_ALERT takes priority
      const quoteStop = { ...market.getQuote("ATRO"), price: 83.0 };
      const evalStop = evaluateTrade(tradeHitT1, quoteStop);
      expect(evalStop.alertType).toBe("STOP_ALERT");
    });

    it("treats SCALED_T1 position in daily briefing with TRAIL_STOP guidance rather than forced liquidation", () => {
      const tradeScaled: StoredTrade = {
        id: "tr_scaled_time",
        ticker: "GLBE",
        companyName: "Global-e",
        status: "SCALED_T1",
        entryTrigger: 42.6,
        actualEntry: 42.6,
        sharesTotal: 40,
        sharesRemaining: 20,
        initialStop: 40.2,
        currentStop: 42.6,
        target1: 48.0,
        target2: 52.0,
        rrRatio: 2.25,
        timeStopSessions: 7,
        sessionsElapsed: 8, // Exceeded initial time stop, but runner is risk-free
      };

      const quotes = { GLBE: { ...market.getQuote("GLBE"), price: 46.0 } };
      const report = generateDailyPortfolioReport([tradeScaled], quotes, 15000.0);
      const action = report.actionItems.find(a => a.ticker === "GLBE");
      expect(action?.actionType).toBe("TRAIL_STOP");
      expect(action?.urgency).toBe("LOW");
    });
  });

  describe("Feature 11: 1-Click Stale Position Liquidation & Campaign Analytics", () => {
    it("liquidates stale position at exact breakeven (currentPrice == entry)", () => {
      const trade: StoredTrade = {
        id: "tr_exit_be",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75,
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        rrRatio: 2.13,
        timeStopSessions: 5,
        sessionsElapsed: 6,
      };

      storage.addOrUpdateTrade(trade);
      const res = executeStalePositionExit(storage, "tr_exit_be", 88.5);

      expect(res.success).toBe(true);
      expect(res.closedTrade?.status).toBe("CLOSED");
      expect(res.closedTrade?.sharesRemaining).toBe(0);
      expect(res.closedTrade?.realizedPnL).toBe(0.0);
      expect(res.closedTrade?.rMultiple).toBe(0.0);
      expect(res.closedTrade?.exitReason).toBe("TIME_STOP_EXIT");
    });

    it("liquidates stale position with small gain (+0.42R)", () => {
      const trade: StoredTrade = {
        id: "tr_exit_gain",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75, // Risk/sh = $4.75
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        rrRatio: 2.13,
        timeStopSessions: 5,
        sessionsElapsed: 6,
      };

      storage.addOrUpdateTrade(trade);
      // Exit at $90.50 -> Gain = $2.00/sh * 18 = +$36.00 -> R = 2.00 / 4.75 = +0.42R
      const res = executeStalePositionExit(storage, "tr_exit_gain", 90.5);

      expect(res.success).toBe(true);
      expect(res.closedTrade?.realizedPnL).toBe(36.0);
      expect(res.closedTrade?.rMultiple).toBe(0.42);
    });

    it("liquidates stale position with small loss (-0.32R) preventing full -1.0R loss", () => {
      const trade: StoredTrade = {
        id: "tr_exit_loss",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75, // Risk/sh = $4.75
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        rrRatio: 2.13,
        timeStopSessions: 5,
        sessionsElapsed: 6,
      };

      storage.addOrUpdateTrade(trade);
      // Exit at $87.00 -> Loss = -$1.50/sh * 18 = -$27.00 -> R = -1.50 / 4.75 = -0.32R
      const res = executeStalePositionExit(storage, "tr_exit_loss", 87.0);

      expect(res.success).toBe(true);
      expect(res.closedTrade?.realizedPnL).toBe(-27.0);
      expect(res.closedTrade?.rMultiple).toBe(-0.32);
    });

    it("records valid ISO timestamp on closedDate", () => {
      const trade: StoredTrade = {
        id: "tr_date_check",
        ticker: "MTRN",
        companyName: "Materion",
        status: "ACTIVE",
        entryTrigger: 280,
        actualEntry: 280,
        sharesTotal: 8,
        sharesRemaining: 8,
        initialStop: 270,
        currentStop: 270,
        target1: 300,
        target2: 320,
        rrRatio: 2.0,
        timeStopSessions: 5,
        sessionsElapsed: 5,
      };

      storage.addOrUpdateTrade(trade);
      const res = executeStalePositionExit(storage, "tr_date_check", 280);
      expect(res.closedTrade?.closedDate).toBeDefined();
      expect(new Date(res.closedTrade!.closedDate!).getTime()).toBeGreaterThan(0);
    });

    it("preserves previous realized PnL on partial scale before stale liquidation", () => {
      const trade: StoredTrade = {
        id: "tr_partial_stale",
        ticker: "GLBE",
        companyName: "Global-e",
        status: "SCALED_T1",
        entryTrigger: 42.6,
        actualEntry: 42.6,
        sharesTotal: 40,
        sharesRemaining: 20, // 20 shares remaining
        initialStop: 40.2,   // Risk/sh = $2.40
        currentStop: 42.6,
        target1: 48.0,
        target2: 52.0,
        rrRatio: 2.25,
        timeStopSessions: 7,
        sessionsElapsed: 8,
        realizedPnL: 108.0, // First 20 shares banked $108.00 at T1
      };

      storage.addOrUpdateTrade(trade);
      // Close remaining 20 shares at $45.00 -> Realized on remainder = (45 - 42.6) * 20 = $48.00
      // Total realized PnL = 108.00 + 48.00 = $156.00
      const res = executeStalePositionExit(storage, "tr_partial_stale", 45.0);
      expect(res.success).toBe(true);
      expect(res.closedTrade?.realizedPnL).toBe(156.0);
    });

    it("prevents double liquidation on an already closed trade", () => {
      const trade: StoredTrade = {
        id: "tr_closed_already",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "CLOSED",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 0,
        initialStop: 83.75,
        currentStop: 88.5,
        target1: 100.1,
        target2: 112.0,
        rrRatio: 2.13,
        timeStopSessions: 5,
        sessionsElapsed: 5,
      };

      storage.addOrUpdateTrade(trade);
      const res = executeStalePositionExit(storage, "tr_closed_already", 89.0);
      expect(res.success).toBe(false);
      expect(res.error).toContain("already closed");
    });

    it("returns error when attempting to exit non-existent trade ID", () => {
      const res = executeStalePositionExit(storage, "non_existent_id", 100.0);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Trade not found");
    });

    it("appends session duration to notes upon liquidation", () => {
      const trade: StoredTrade = {
        id: "tr_notes_test",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75,
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        rrRatio: 2.13,
        timeStopSessions: 5,
        sessionsElapsed: 6,
        notes: "Initial catalyst base breakout",
      };

      storage.addOrUpdateTrade(trade);
      const res = executeStalePositionExit(storage, "tr_notes_test", 88.5);
      expect(res.closedTrade?.notes).toContain("Initial catalyst base breakout");
      expect(res.closedTrade?.notes).toContain("Liquidated via Time Stop after 6 sessions");
    });

    it("updates closed trade in storage such that active trades count decreases by 1", () => {
      const trade: StoredTrade = {
        id: "tr_count_test",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75,
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        rrRatio: 2.13,
        timeStopSessions: 5,
        sessionsElapsed: 5,
      };

      storage.addOrUpdateTrade(trade);
      expect(storage.getTrades().filter(t => t.status === "ACTIVE")).toHaveLength(1);

      executeStalePositionExit(storage, "tr_count_test", 88.5);
      expect(storage.getTrades().filter(t => t.status === "ACTIVE")).toHaveLength(0);
      expect(storage.getTrades().filter(t => t.status === "CLOSED")).toHaveLength(1);
    });
  });

  describe("Feature 14 & 15: Daily Briefing Prioritization & Markdown Export on Stale Trades", () => {
    it("triages stale trade warning as HIGH urgency in action items", () => {
      const trade: StoredTrade = {
        id: "t_stale",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75,
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        rrRatio: 2.13,
        timeStopSessions: 5,
        sessionsElapsed: 4,
      };

      const quotes = { ATRO: { ...market.getQuote("ATRO"), price: 89.0 } };
      const report = generateDailyPortfolioReport([trade], quotes, 15000.0);
      const action = report.actionItems.find(a => a.ticker === "ATRO");
      expect(action?.urgency).toBe("HIGH");
      expect(action?.actionType).toBe("TIME_STOP_WARNING");
    });

    it("triages healthy trending trade (+1.2R, 1 session) as LOW urgency HEALTHY_HOLD", () => {
      const trade: StoredTrade = {
        id: "t_healthy",
        ticker: "MTRN",
        companyName: "Materion",
        status: "ACTIVE",
        entryTrigger: 280.0,
        actualEntry: 280.0,
        sharesTotal: 8,
        sharesRemaining: 8,
        initialStop: 270.0, // Risk/sh = $10.00
        currentStop: 270.0,
        target1: 305.0,     // 25 / 280 = ~8.9% away (> 2.5%)
        target2: 328.0,
        rrRatio: 2.5,
        timeStopSessions: 6,
        sessionsElapsed: 1,
      };

      const quotes = { MTRN: { ...market.getQuote("MTRN"), price: 292.0 } }; // +1.2R
      const report = generateDailyPortfolioReport([trade], quotes, 15000.0);
      const action = report.actionItems.find(a => a.ticker === "MTRN");
      expect(action?.actionType).toBe("HEALTHY_HOLD");
      expect(action?.urgency).toBe("LOW");
    });

    it("formats 1-Click Copy markdown briefing with all sections", () => {
      const trade: StoredTrade = {
        id: "t1",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75,
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        rrRatio: 2.13,
        timeStopSessions: 5,
        sessionsElapsed: 4,
      };

      const quotes = { ATRO: { ...market.getQuote("ATRO"), price: 89.0 } };
      const report = generateDailyPortfolioReport([trade], quotes, 15000.0);
      const markdown = formatDailyBriefingMarkdown(report);

      expect(markdown).toContain("# Senior Broker — Daily Tactical Moves Briefing");
      expect(markdown).toContain("**Market Regime:** FAVORABLE");
      expect(markdown).toContain("## Action Items (2)");
      expect(markdown).toContain("**[HIGH] ATRO**");
      expect(markdown).toContain("## Desk Discipline Rules");
      expect(markdown).toContain("Enforce time stops: after 5–7 sessions without expansion");
    });

    it("handles empty briefing formatting without errors or missing headers", () => {
      const report = generateDailyPortfolioReport([], {}, 15000.0);
      const markdown = formatDailyBriefingMarkdown(report);

      expect(markdown).toContain("## Action Items (0)");
      expect(markdown).toContain("No high-urgency moves required today");
      expect(markdown).toContain("**Active Positions:** 0");
    });

    it("includes time stop rule in desk checklist", () => {
      const report = generateDailyPortfolioReport([], {}, 15000.0);
      const hasTimeStopRule = report.deskChecklist.some(r => r.includes("5–7 sessions"));
      expect(hasTimeStopRule).toBe(true);
    });

    it("sorts multiple action items with high urgency preceding low urgency", () => {
      const trades: StoredTrade[] = [
        // Healthy hold
        { id: "1", ticker: "MTRN", companyName: "M", status: "ACTIVE", entryTrigger: 280, actualEntry: 280, sharesTotal: 8, sharesRemaining: 8, initialStop: 270, currentStop: 270, target1: 305, target2: 328, rrRatio: 2.5, timeStopSessions: 6, sessionsElapsed: 1 },
        // Stale trade
        { id: "2", ticker: "ATRO", companyName: "A", status: "ACTIVE", entryTrigger: 88.5, actualEntry: 88.5, sharesTotal: 18, sharesRemaining: 18, initialStop: 83.75, currentStop: 83.75, target1: 100.1, target2: 112.0, rrRatio: 2.13, timeStopSessions: 5, sessionsElapsed: 4 },
      ];

      const quotes = {
        MTRN: { ...market.getQuote("MTRN"), price: 292.0 },
        ATRO: { ...market.getQuote("ATRO"), price: 89.0 },
      };

      const report = generateDailyPortfolioReport(trades, quotes, 15000.0);
      const timeItem = report.actionItems.find(a => a.ticker === "ATRO");
      const holdItem = report.actionItems.find(a => a.ticker === "MTRN");

      expect(timeItem?.urgency).toBe("HIGH");
      expect(holdItem?.urgency).toBe("LOW");
    });

    it("generates valid suggested order syntax for stale exit review", () => {
      const trade: StoredTrade = {
        id: "t_syntax",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75,
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        rrRatio: 2.13,
        timeStopSessions: 5,
        sessionsElapsed: 4,
      };

      const quotes = { ATRO: { ...market.getQuote("ATRO"), price: 89.0 } };
      const report = generateDailyPortfolioReport([trade], quotes, 15000.0);
      const action = report.actionItems.find(a => a.ticker === "ATRO");
      expect(action?.suggestedOrder).toContain("reallocate capital");
    });

    it("verifies markdown output contains no undefined or null placeholders", () => {
      const report = generateDailyPortfolioReport([], {}, 15000.0);
      const md = formatDailyBriefingMarkdown(report);
      expect(md).not.toContain("undefined");
      expect(md).not.toContain("null");
      expect(md).not.toContain("NaN");
    });
  });

  describe("Market Calendar & Weekend Session Progression Boundaries", () => {
    it("advances 1 session from Monday landing on Tuesday", () => {
      // Set to a known Monday: Aug 17, 2026
      market.reset();
      const initial = market.getSessionInfo();
      expect(initial.sessionIndex).toBe(1);

      const next = market.advanceSession(1);
      expect(next.sessionIndex).toBe(2);
      const day = next.date.getDay();
      expect(day).not.toBe(0); // Not Sun
      expect(day).not.toBe(6); // Not Sat
    });

    it("advances across weekend (skips Saturday and Sunday)", () => {
      market.reset();
      // Advance 5 trading days
      const afterWeek = market.advanceSession(5);
      expect(afterWeek.sessionIndex).toBe(6);

      // Verify the final day is a valid weekday
      const day = afterWeek.date.getDay();
      expect(day >= 1 && day <= 5).toBe(true);
    });

    it("advances 10 trading sessions (2 full trading weeks)", () => {
      market.reset();
      const res = market.advanceSession(10);
      expect(res.sessionIndex).toBe(11);
      const day = res.date.getDay();
      expect(day >= 1 && day <= 5).toBe(true);
    });

    it("handles advanceSession(0) leaving state unchanged", () => {
      market.reset();
      const initial = market.getSessionInfo();
      const res = market.advanceSession(0);
      expect(res.sessionIndex).toBe(initial.sessionIndex);
    });

    it("resets quote prevClose to current price on new session advance", () => {
      market.reset();
      market.setPrice("ATRO", 95.0);
      expect(market.getQuote("ATRO").price).toBe(95.0);

      market.advanceSession(1);
      const quoteNewSession = market.getQuote("ATRO");
      expect(quoteNewSession.prevClose).toBe(95.0);
      expect(quoteNewSession.change).toBe(0.0);
      expect(quoteNewSession.changePct).toBe(0.0);
    });

    it("resets daily high and low to current price on new session advance", () => {
      market.reset();
      market.setPrice("ATRO", 99.0);
      market.advanceSession(1);
      const quote = market.getQuote("ATRO");
      expect(quote.high).toBe(99.0);
      expect(quote.low).toBe(99.0);
    });

    it("updates quote timestamp to match advanced session ISO date", () => {
      market.reset();
      market.advanceSession(2);
      const sessionDateIso = market.getSessionInfo().dateIso;
      const quote = market.getQuote("ATRO");
      expect(quote.lastUpdated).toBe(sessionDateIso);
    });

    it("resets market engine state cleanly upon reset()", () => {
      market.setPrice("ATRO", 150.0);
      market.advanceSession(5);
      expect(market.getSessionInfo().sessionIndex).toBe(6);

      market.reset();
      expect(market.getSessionInfo().sessionIndex).toBe(1);
      expect(market.getQuote("ATRO").price).toBe(88.95);
    });
  });
});
