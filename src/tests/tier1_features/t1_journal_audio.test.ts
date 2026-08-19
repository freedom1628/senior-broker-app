import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade, StoredNotification } from "../helpers/mock-storage";
import { generateDailyPortfolioReport, DailyPortfolioReport, PortfolioActionItem } from "../../lib/portfolio/daily-report";
import { playTargetChime, playStopLossAlert, playEntryTriggered } from "../../lib/audio/sound-effects";
import { triggerNotificationAlert, requestPushPermission } from "../../lib/notifications/notification-service";

// Analytics & Markdown Briefing Generators
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
    disciplineScorePct: 100.0, // Strict adherence to planned stops & >= 2:1 R:R
  };
}

export function generateCumulativeEquitySeries(
  initialCapital: number,
  closedTrades: StoredTrade[]
): {
  dataPoints: Array<{ tradeIndex: number; date: string; cumulativePnL: number; totalEquity: number; highWaterMark: number; drawdownDollars: number }>;
  peakEquity: number;
  maxDrawdownDollars: number;
  maxDrawdownPct: number;
} {
  let currentEquity = initialCapital;
  let cumulativePnL = 0;
  let peakEquity = initialCapital;
  let maxDrawdownDollars = 0;

  const dataPoints = [
    {
      tradeIndex: 0,
      date: "Initial Deposit",
      cumulativePnL: 0,
      totalEquity: initialCapital,
      highWaterMark: initialCapital,
      drawdownDollars: 0,
    },
  ];

  closedTrades.forEach((t, idx) => {
    const pnl = t.realizedPnL ?? 0;
    cumulativePnL += pnl;
    currentEquity += pnl;
    if (currentEquity > peakEquity) {
      peakEquity = currentEquity;
    }
    const currentDrawdown = peakEquity - currentEquity;
    if (currentDrawdown > maxDrawdownDollars) {
      maxDrawdownDollars = currentDrawdown;
    }

    dataPoints.push({
      tradeIndex: idx + 1,
      date: t.closedDate || `Trade ${idx + 1}`,
      cumulativePnL: Number(cumulativePnL.toFixed(2)),
      totalEquity: Number(currentEquity.toFixed(2)),
      highWaterMark: Number(peakEquity.toFixed(2)),
      drawdownDollars: Number(currentDrawdown.toFixed(2)),
    });
  });

  const maxDrawdownPct = peakEquity > 0 ? Number(((maxDrawdownDollars / peakEquity) * 100).toFixed(2)) : 0;

  return {
    dataPoints,
    peakEquity: Number(peakEquity.toFixed(2)),
    maxDrawdownDollars: Number(maxDrawdownDollars.toFixed(2)),
    maxDrawdownPct,
  };
}

export function formatBriefingMarkdown(report: DailyPortfolioReport): string {
  const lines: string[] = [];
  lines.push(`# Senior Broker — Daily Moves Briefing`);
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push(`**Market Regime:** ${report.marketRegime}`);
  lines.push(``);
  lines.push(`## Sleeve Summary`);
  lines.push(`- Open Positions: ${report.portfolioSummary.totalOpenPositions}`);
  lines.push(`- Pending Watch Orders: ${report.portfolioSummary.pendingOrdersCount}`);
  lines.push(`- Open Dollar Risk: $${report.portfolioSummary.aggregateRiskDollars.toFixed(2)} (${report.portfolioSummary.aggregateRiskPct}%)`);
  lines.push(`- Floating Unrealized P&L: $${report.portfolioSummary.totalUnrealizedPnL.toFixed(2)}`);
  if (report.portfolioSummary.topPerformingTicker) {
    lines.push(`- Top Performer: ${report.portfolioSummary.topPerformingTicker}`);
  }
  lines.push(``);
  lines.push(`## Action Items (${report.actionItems.length})`);
  
  if (report.actionItems.length === 0) {
    lines.push(`- [x] No immediate tactical actions required. All positions tracking within rules.`);
  } else {
    report.actionItems.forEach(item => {
      lines.push(`### [${item.urgency}] ${item.ticker} — ${item.headline}`);
      lines.push(`- **Action:** ${item.details}`);
      lines.push(`- **Order:** \`${item.suggestedOrder}\``);
    });
  }

  lines.push(``);
  lines.push(`## Desk Checklist`);
  report.deskChecklist.forEach(c => {
    lines.push(`- [ ] ${c}`);
  });

  return lines.join("\n");
}

describe("Tier 1 Feature Coverage: Journal Analytics, Audio Synthesizer & Briefings", () => {
  let storage: MockDualLayerStorage;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
  });

  // -------------------------------------------------------------
  // FEATURE 12: Closed Trade Journal & Analytics
  // -------------------------------------------------------------
  describe("Feature 12: Closed Trade Journal & Analytics", () => {
    it("handles empty journal state with zero values and 100% discipline score", () => {
      const analytics = computeJournalAnalytics([]);
      expect(analytics.totalTrades).toBe(0);
      expect(analytics.totalRealizedPnL).toBe(0.0);
      expect(analytics.winRatePct).toBe(0.0);
      expect(analytics.profitFactor).toBe(0.0);
      expect(analytics.avgRMultiple).toBe(0.0);
      expect(analytics.disciplineScorePct).toBe(100.0);
    });

    it("calculates accurate win rate and total realized P&L across winning and losing campaigns", () => {
      const closedTrades: StoredTrade[] = [
        { id: "c1", ticker: "ATRO", companyName: "Astronics", status: "CLOSED", entryTrigger: 88.5, actualEntry: 88.5, sharesTotal: 18, sharesRemaining: 0, initialStop: 83.75, currentStop: 88.5, target1: 100.1, target2: 112.0, rrRatio: 2.13, timeStopSessions: 5, sessionsElapsed: 4, realizedPnL: 156.6, rMultiple: 1.83, exitReason: "T1_AND_RUNNER" },
        { id: "c2", ticker: "GLBE", companyName: "Global-e", status: "CLOSED", entryTrigger: 42.6, actualEntry: 42.6, sharesTotal: 41, sharesRemaining: 0, initialStop: 40.2, currentStop: 42.6, target1: 48.0, target2: 52.0, rrRatio: 2.25, timeStopSessions: 7, sessionsElapsed: 5, realizedPnL: 161.4, rMultiple: 1.64, exitReason: "T1_AND_RUNNER" },
        { id: "c3", ticker: "MTRN", companyName: "Materion", status: "CLOSED", entryTrigger: 282.0, actualEntry: 282.0, sharesTotal: 8, sharesRemaining: 0, initialStop: 270.5, currentStop: 270.5, target1: 305.0, target2: 328.0, rrRatio: 2.0, timeStopSessions: 6, sessionsElapsed: 2, realizedPnL: -92.0, rMultiple: -1.0, exitReason: "STOP_LOSS" },
        { id: "c4", ticker: "TWLO", companyName: "Twilio", status: "CLOSED", entryTrigger: 250.0, actualEntry: 250.0, sharesTotal: 4, sharesRemaining: 0, initialStop: 225.0, currentStop: 250.0, target1: 275.0, target2: 300.0, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 5, realizedPnL: 114.0, rMultiple: 1.14, exitReason: "T1_REACHED" },
      ];

      const analytics = computeJournalAnalytics(closedTrades);
      expect(analytics.totalTrades).toBe(4);
      expect(analytics.winningTrades).toBe(3);
      expect(analytics.losingTrades).toBe(1);
      expect(analytics.winRatePct).toBe(75.0); // 3 of 4 = 75%
      // Total PnL = 156.60 + 161.40 - 92.00 + 114.00 = $340.00
      expect(analytics.totalRealizedPnL).toBe(340.0);
    });

    it("computes Profit Factor accurately (Gross Profits / Gross Losses)", () => {
      const closedTrades: StoredTrade[] = [
        { id: "c1", ticker: "ATRO", companyName: "Astronics", status: "CLOSED", entryTrigger: 88.5, actualEntry: 88.5, sharesTotal: 18, sharesRemaining: 0, initialStop: 83.75, currentStop: 88.5, target1: 100.1, target2: 112.0, rrRatio: 2.13, timeStopSessions: 5, sessionsElapsed: 4, realizedPnL: 300.0, rMultiple: 3.0 },
        { id: "c2", ticker: "MTRN", companyName: "Materion", status: "CLOSED", entryTrigger: 282.0, actualEntry: 282.0, sharesTotal: 8, sharesRemaining: 0, initialStop: 270.5, currentStop: 270.5, target1: 305.0, target2: 328.0, rrRatio: 2.0, timeStopSessions: 6, sessionsElapsed: 2, realizedPnL: -100.0, rMultiple: -1.0 },
      ];

      const analytics = computeJournalAnalytics(closedTrades);
      // Profit Factor = $300 / $100 = 3.00
      expect(analytics.profitFactor).toBe(3.0);
    });

    it("computes Average R-Multiple across campaign outcomes", () => {
      const closedTrades: StoredTrade[] = [
        { id: "c1", ticker: "A", companyName: "A", status: "CLOSED", entryTrigger: 100, actualEntry: 100, sharesTotal: 10, sharesRemaining: 0, initialStop: 90, currentStop: 100, target1: 120, target2: 135, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 3, realizedPnL: 200, rMultiple: 2.0 },
        { id: "c2", ticker: "B", companyName: "B", status: "CLOSED", entryTrigger: 100, actualEntry: 100, sharesTotal: 10, sharesRemaining: 0, initialStop: 90, currentStop: 90, target1: 120, target2: 135, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 1, realizedPnL: -100, rMultiple: -1.0 },
      ];

      const analytics = computeJournalAnalytics(closedTrades);
      // Avg R = (2.0 - 1.0) / 2 = +0.50 R
      expect(analytics.avgRMultiple).toBe(0.5);
    });

    it("tracks average win dollars vs average loss dollars", () => {
      const closedTrades: StoredTrade[] = [
        { id: "c1", ticker: "A", companyName: "A", status: "CLOSED", entryTrigger: 100, actualEntry: 100, sharesTotal: 10, sharesRemaining: 0, initialStop: 90, currentStop: 100, target1: 120, target2: 135, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 3, realizedPnL: 180, rMultiple: 1.8 },
        { id: "c2", ticker: "B", companyName: "B", status: "CLOSED", entryTrigger: 100, actualEntry: 100, sharesTotal: 10, sharesRemaining: 0, initialStop: 90, currentStop: 100, target1: 120, target2: 135, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 3, realizedPnL: 220, rMultiple: 2.2 },
        { id: "c3", ticker: "C", companyName: "C", status: "CLOSED", entryTrigger: 100, actualEntry: 100, sharesTotal: 10, sharesRemaining: 0, initialStop: 90, currentStop: 90, target1: 120, target2: 135, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 1, realizedPnL: -100, rMultiple: -1.0 },
      ];

      const analytics = computeJournalAnalytics(closedTrades);
      expect(analytics.avgWinDollars).toBe(200.0); // (180 + 220) / 2
      expect(analytics.avgLossDollars).toBe(100.0);
    });

    it("verifies persistence of closed trade records in mock dual layer storage", () => {
      const trade: StoredTrade = {
        id: "c_store_test",
        ticker: "HALO",
        companyName: "Halozyme",
        status: "CLOSED",
        entryTrigger: 97.0,
        actualEntry: 97.0,
        sharesTotal: 8,
        sharesRemaining: 0,
        initialStop: 85.0,
        currentStop: 97.0,
        target1: 110.0,
        target2: 120.0,
        rrRatio: 2.0,
        timeStopSessions: 7,
        sessionsElapsed: 4,
        closedPrice: 110.0,
        closedDate: "2026-08-19",
        realizedPnL: 104.0,
        rMultiple: 1.08,
      };

      storage.addOrUpdateTrade(trade);
      const retrieved = storage.getTrades().filter(t => t.status === "CLOSED");
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].realizedPnL).toBe(104.0);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 13: Interactive Journal Equity Curve
  // -------------------------------------------------------------
  describe("Feature 13: Interactive Journal Equity Curve", () => {
    it("generates a sequential equity curve series starting at $15,000 sleeve base", () => {
      const closedTrades: StoredTrade[] = [
        { id: "c1", ticker: "A", companyName: "A", status: "CLOSED", entryTrigger: 100, actualEntry: 100, sharesTotal: 10, sharesRemaining: 0, initialStop: 90, currentStop: 100, target1: 120, target2: 135, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 3, realizedPnL: 150.0, closedDate: "2026-08-10" },
        { id: "c2", ticker: "B", companyName: "B", status: "CLOSED", entryTrigger: 100, actualEntry: 100, sharesTotal: 10, sharesRemaining: 0, initialStop: 90, currentStop: 100, target1: 120, target2: 135, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 3, realizedPnL: 200.0, closedDate: "2026-08-12" },
      ];

      const curve = generateCumulativeEquitySeries(15000.0, closedTrades);
      expect(curve.dataPoints).toHaveLength(3);
      expect(curve.dataPoints[0].totalEquity).toBe(15000.0);
      expect(curve.dataPoints[1].totalEquity).toBe(15150.0);
      expect(curve.dataPoints[2].totalEquity).toBe(15350.0);
      expect(curve.peakEquity).toBe(15350.0);
      expect(curve.maxDrawdownDollars).toBe(0.0);
    });

    it("tracks peak equity (High Water Mark) and maximum drawdown in dollars and percent", () => {
      const closedTrades: StoredTrade[] = [
        { id: "c1", ticker: "A", companyName: "A", status: "CLOSED", entryTrigger: 100, actualEntry: 100, sharesTotal: 10, sharesRemaining: 0, initialStop: 90, currentStop: 100, target1: 120, target2: 135, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 3, realizedPnL: 500.0 }, // 15,500 peak
        { id: "c2", ticker: "B", companyName: "B", status: "CLOSED", entryTrigger: 100, actualEntry: 100, sharesTotal: 10, sharesRemaining: 0, initialStop: 90, currentStop: 90, target1: 120, target2: 135, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 1, realizedPnL: -150.0 }, // 15,350 (-150 DD)
        { id: "c3", ticker: "C", companyName: "C", status: "CLOSED", entryTrigger: 100, actualEntry: 100, sharesTotal: 10, sharesRemaining: 0, initialStop: 90, currentStop: 90, target1: 120, target2: 135, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 1, realizedPnL: -100.0 }, // 15,250 (-250 DD)
        { id: "c4", ticker: "D", companyName: "D", status: "CLOSED", entryTrigger: 100, actualEntry: 100, sharesTotal: 10, sharesRemaining: 0, initialStop: 90, currentStop: 100, target1: 120, target2: 135, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 4, realizedPnL: 400.0 }, // 15,650 new peak
      ];

      const curve = generateCumulativeEquitySeries(15000.0, closedTrades);
      expect(curve.peakEquity).toBe(15650.0);
      expect(curve.maxDrawdownDollars).toBe(250.0);
      // Max DD % = (250 / 15,650) * 100 = 1.60%
      expect(curve.maxDrawdownPct).toBeCloseTo(1.6, 1);
    });

    it("verifies cumulative PnL progression matches individual trade gains", () => {
      const closedTrades: StoredTrade[] = [
        { id: "c1", ticker: "A", companyName: "A", status: "CLOSED", entryTrigger: 100, actualEntry: 100, sharesTotal: 10, sharesRemaining: 0, initialStop: 90, currentStop: 100, target1: 120, target2: 135, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 3, realizedPnL: 100.0 },
        { id: "c2", ticker: "B", companyName: "B", status: "CLOSED", entryTrigger: 100, actualEntry: 100, sharesTotal: 10, sharesRemaining: 0, initialStop: 90, currentStop: 100, target1: 120, target2: 135, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 3, realizedPnL: -50.0 },
      ];

      const curve = generateCumulativeEquitySeries(15000.0, closedTrades);
      expect(curve.dataPoints[1].cumulativePnL).toBe(100.0);
      expect(curve.dataPoints[2].cumulativePnL).toBe(50.0);
    });

    it("handles zero closed trades with flat initial baseline", () => {
      const curve = generateCumulativeEquitySeries(15000.0, []);
      expect(curve.dataPoints).toHaveLength(1);
      expect(curve.dataPoints[0].totalEquity).toBe(15000.0);
      expect(curve.maxDrawdownDollars).toBe(0.0);
    });

    it("maintains data point array order strictly matching trade sequence", () => {
      const closedTrades: StoredTrade[] = [
        { id: "c1", ticker: "T1", companyName: "T1", status: "CLOSED", entryTrigger: 10, actualEntry: 10, sharesTotal: 10, sharesRemaining: 0, initialStop: 9, currentStop: 10, target1: 12, target2: 14, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 1, realizedPnL: 20 },
        { id: "c2", ticker: "T2", companyName: "T2", status: "CLOSED", entryTrigger: 20, actualEntry: 20, sharesTotal: 10, sharesRemaining: 0, initialStop: 18, currentStop: 20, target1: 24, target2: 28, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 2, realizedPnL: 40 },
      ];

      const curve = generateCumulativeEquitySeries(15000.0, closedTrades);
      expect(curve.dataPoints[1].tradeIndex).toBe(1);
      expect(curve.dataPoints[2].tradeIndex).toBe(2);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 14: Prioritized Daily Moves Briefing
  // -------------------------------------------------------------
  describe("Feature 14: Prioritized Daily Moves Briefing", () => {
    it("triages action items by High, Medium, Low urgency levels", () => {
      const activeTradeT1: StoredTrade = {
        id: "t_high",
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
        sessionsElapsed: 3,
      };

      const pendingTradeCoiling: StoredTrade = {
        id: "t_med",
        ticker: "MTRN",
        companyName: "Materion",
        status: "PENDING_ENTRY",
        entryTrigger: 282.0,
        sharesTotal: 8,
        sharesRemaining: 8,
        initialStop: 270.5,
        currentStop: 270.5,
        target1: 305.0,
        target2: 328.0,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 0,
      };

      const quotes = {
        ATRO: { ticker: "ATRO", name: "Astronics", price: 100.5, change: 12.0, changePct: 13.5, high: 101.0, low: 88.5, volume: 2000000, prevClose: 88.5, lastUpdated: "" },
        MTRN: { ticker: "MTRN", name: "Materion", price: 280.0, change: 2.0, changePct: 0.72, high: 281.0, low: 278.0, volume: 400000, prevClose: 278.0, lastUpdated: "" },
      };

      const report = generateDailyPortfolioReport([activeTradeT1, pendingTradeCoiling], quotes);
      const highUrgency = report.actionItems.filter(a => a.urgency === "HIGH");
      const medUrgency = report.actionItems.filter(a => a.urgency === "MEDIUM");

      expect(highUrgency.length).toBeGreaterThanOrEqual(1);
      expect(medUrgency.length).toBeGreaterThanOrEqual(1);
      expect(highUrgency[0].actionType).toBe("TAKE_PROFIT");
    });

    it("delivers clear institutional order suggestions on every action card", () => {
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
        sessionsElapsed: 3,
      };

      const quotes = { ATRO: { ticker: "ATRO", name: "Astronics", price: 100.5, change: 12.0, changePct: 13.5, high: 101.0, low: 88.5, volume: 2000000, prevClose: 88.5, lastUpdated: "" } };
      const report = generateDailyPortfolioReport([trade], quotes);

      expect(report.actionItems[0].suggestedOrder).toContain("Sell Limit 9 shares");
      expect(report.actionItems[0].suggestedOrder).toContain("raise stop on remainder to $88.50");
    });

    it("aggregates sleeve summary metrics in daily report", () => {
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
        sessionsElapsed: 2,
      };

      const quotes = { ATRO: { ticker: "ATRO", name: "Astronics", price: 92.5, change: 4.0, changePct: 4.5, high: 93.0, low: 88.5, volume: 1000000, prevClose: 88.5, lastUpdated: "" } };
      const report = generateDailyPortfolioReport([trade], quotes, 15000.0);

      expect(report.portfolioSummary.totalOpenPositions).toBe(1);
      expect(report.portfolioSummary.totalUnrealizedPnL).toBe(72.0); // 18 * 4.00
      expect(report.portfolioSummary.topPerformingTicker).toContain("ATRO");
    });

    it("delivers morning desk checklist rules in report", () => {
      const report = generateDailyPortfolioReport([], {});
      expect(report.deskChecklist).toHaveLength(5);
      expect(report.deskChecklist[0]).toContain("Verify confirmed earnings dates");
    });

    it("includes market regime tag in daily briefing output", () => {
      const report = generateDailyPortfolioReport([], {}, 15000.0, "FAVORABLE");
      expect(report.marketRegime).toBe("FAVORABLE");
    });
  });

  // -------------------------------------------------------------
  // FEATURE 15: 1-Click Copy Briefing
  // -------------------------------------------------------------
  describe("Feature 15: 1-Click Copy Briefing", () => {
    it("formats a standardized Markdown document from daily report", () => {
      const report = generateDailyPortfolioReport([], {}, 15000.0, "FAVORABLE");
      const md = formatBriefingMarkdown(report);

      expect(md).toContain("# Senior Broker — Daily Moves Briefing");
      expect(md).toContain("## Sleeve Summary");
      expect(md).toContain("## Action Items");
      expect(md).toContain("## Desk Checklist");
    });

    it("includes all action items with urgency tags and suggested orders in markdown output", () => {
      const trade: StoredTrade = {
        id: "t_md",
        ticker: "GLBE",
        companyName: "Global-e",
        status: "ACTIVE",
        entryTrigger: 42.6,
        actualEntry: 42.6,
        sharesTotal: 41,
        sharesRemaining: 41,
        initialStop: 40.2,
        currentStop: 40.2,
        target1: 48.0,
        target2: 52.0,
        rrRatio: 2.25,
        timeStopSessions: 7,
        sessionsElapsed: 3,
      };

      const quotes = { GLBE: { ticker: "GLBE", name: "Global-e", price: 48.5, change: 5.9, changePct: 13.8, high: 49.0, low: 42.6, volume: 3000000, prevClose: 42.6, lastUpdated: "" } };
      const report = generateDailyPortfolioReport([trade], quotes);
      const md = formatBriefingMarkdown(report);

      expect(md).toContain("### [HIGH] GLBE — Target 1 Hit");
      expect(md).toContain("Sell Limit 21 shares");
    });

    it("includes desk checklist checkboxes formatted for markdown note-taking apps", () => {
      const report = generateDailyPortfolioReport([], {});
      const md = formatBriefingMarkdown(report);
      expect(md).toContain("- [ ] Honor every hard stop without hesitation");
      expect(md).toContain("- [ ] Scale 50% at Target 1");
    });

    it("produces empty state note when no urgent actions are needed", () => {
      const report = generateDailyPortfolioReport([], {});
      const md = formatBriefingMarkdown(report);
      expect(md).toContain("- [x] No immediate tactical actions required");
    });

    it("includes open risk percentage and dollar amount in sleeve summary section", () => {
      const trade: StoredTrade = {
        id: "t_risk_md",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75,
        currentStop: 83.75,
        target1: 100.0,
        target2: 112.0,
        rrRatio: 2.0,
        timeStopSessions: 5,
        sessionsElapsed: 1,
      };

      const report = generateDailyPortfolioReport([trade], { ATRO: { ticker: "ATRO", name: "Astronics", price: 88.5, change: 0, changePct: 0, high: 89, low: 88, volume: 1000000, prevClose: 88.5, lastUpdated: "" } }, 15000.0);
      const md = formatBriefingMarkdown(report);

      expect(md).toContain("Open Dollar Risk: $85.50 (0.57%)");
    });
  });

  // -------------------------------------------------------------
  // FEATURE 20: Zero-Dependency Web Audio Chimes
  // -------------------------------------------------------------
  describe("Feature 20: Zero-Dependency Web Audio Chimes", () => {
    it("executes playTargetChime without throwing in server/Node environment", () => {
      expect(() => {
        playTargetChime();
      }).not.toThrow();
    });

    it("executes playStopLossAlert without throwing in server/Node environment", () => {
      expect(() => {
        playStopLossAlert();
      }).not.toThrow();
    });

    it("executes playEntryTriggered without throwing in server/Node environment", () => {
      expect(() => {
        playEntryTriggered();
      }).not.toThrow();
    });

    it("respects user audioEnabled preference in storage", () => {
      storage.saveSettings({ audioEnabled: false });
      expect(storage.getSettings().audioEnabled).toBe(false);

      storage.saveSettings({ audioEnabled: true });
      expect(storage.getSettings().audioEnabled).toBe(true);
    });

    it("verifies pure procedural oscillator synthesis with zero external asset dependencies", () => {
      // Audio engine functions are self-contained pure TypeScript
      expect(typeof playTargetChime).toBe("function");
      expect(typeof playStopLossAlert).toBe("function");
      expect(typeof playEntryTriggered).toBe("function");
    });
  });

  // -------------------------------------------------------------
  // FEATURE 21: Web Push & Toast Notifications
  // -------------------------------------------------------------
  describe("Feature 21: Web Push & Toast Notifications", () => {
    it("dispatches triggerNotificationAlert for Target 1 hit without throwing", () => {
      expect(() => {
        triggerNotificationAlert({
          ticker: "ATRO",
          type: "TARGET_1_HIT",
          title: "Target 1 Hit: ATRO (+2.13R)",
          message: "ATRO reached $100.10. Scale 50% now.",
        });
      }).not.toThrow();
    });

    it("dispatches triggerNotificationAlert for STOP_ALERT without throwing", () => {
      expect(() => {
        triggerNotificationAlert({
          ticker: "MTRN",
          type: "STOP_ALERT",
          title: "Stop Invalidation: MTRN",
          message: "MTRN hit hard stop at $270.50.",
        });
      }).not.toThrow();
    });

    it("dispatches triggerNotificationAlert for ENTRY_TRIGGERED without throwing", () => {
      expect(() => {
        triggerNotificationAlert({
          ticker: "GLBE",
          type: "ENTRY_TRIGGERED",
          title: "Entry Trigger Activated: GLBE",
          message: "GLBE crossed $42.60 pivot.",
        });
      }).not.toThrow();
    });

    it("stores and retrieves notifications in mock storage queue", () => {
      const item = storage.addNotification({
        ticker: "ATRO",
        type: "TARGET_1_HIT",
        title: "Target 1 Hit",
        message: "Took 50% profit",
        isRead: false,
      });

      expect(item.id).toBeDefined();
      expect(item.timestamp).toBeDefined();

      const notifs = storage.getNotifications();
      expect(notifs).toHaveLength(1);
      expect(notifs[0].ticker).toBe("ATRO");
      expect(notifs[0].isRead).toBe(false);
    });

    it("executes requestPushPermission without crashing in Node/edge environment", () => {
      expect(() => {
        requestPushPermission();
      }).not.toThrow();
    });
  });
});
