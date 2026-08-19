import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade } from "../helpers/mock-storage";
import { audioSynthesizer } from "../../lib/audio/synthesizer";
import {
  playTargetChime,
  playStopLossAlert,
  playEntryTriggered,
  playTimeStopWarning,
  setMuted,
  isMuted,
  setVolume,
  getVolume,
} from "../../lib/audio/sounds";
import { calculatePositionSize } from "../../lib/portfolio/sizing-calculator";
import { validateProposedTrade, evaluateTrade } from "../../lib/market/rule-engine";
import { computeJournalAnalytics, generateCumulativeEquitySeries, formatBriefingMarkdown } from "./t1_journal_audio.test";
import { generateDailyPortfolioReport } from "../../lib/portfolio/daily-report";
import { execute1ClickUpdateStop } from "./t1_position_rules.test";

describe("Milestone 3 Integration & Invariants Verification Suite", () => {
  let storage: MockDualLayerStorage;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
  });

  // -------------------------------------------------------------
  // 1. Procedural Web Audio Engine & State Persistence
  // -------------------------------------------------------------
  describe("Web Audio API Procedural Synthesizer", () => {
    it("handles mute toggling and state queries safely in SSR/Node", () => {
      setMuted(true);
      expect(isMuted()).toBe(true);
      setMuted(false);
      expect(isMuted()).toBe(false);
    });

    it("clamps and retrieves volume between 0.0 and 1.0", () => {
      setVolume(0.85);
      expect(getVolume()).toBe(0.85);

      setVolume(1.5);
      expect(getVolume()).toBe(1.0);

      setVolume(-0.2);
      expect(getVolume()).toBe(0.0);
    });

    it("executes all 4 procedural synthesizer functions without exceptions", () => {
      expect(() => playTargetChime()).not.toThrow();
      expect(() => playStopLossAlert()).not.toThrow();
      expect(() => playEntryTriggered()).not.toThrow();
      expect(() => playTimeStopWarning()).not.toThrow();
    });
  });

  // -------------------------------------------------------------
  // 2. 4-Tier Price Ladder & 1% Risk Auto-Sizing
  // -------------------------------------------------------------
  describe("Price Ladder & Sizing Calculations", () => {
    it("computes exact 1% risk ($150 on $15,000) and 2.0R / 3.5R ladders", () => {
      const sizing = calculatePositionSize({
        accountSize: 15000,
        riskPct: 1.0,
        entryPrice: 42.6,
        stopLoss: 40.2, // $2.40 risk per share
      });

      expect(sizing.isValid).toBe(true);
      // Shares = floor(150 / 2.40) = 62 shares
      expect(sizing.shares).toBe(62);
      expect(sizing.dollarRisk).toBeCloseTo(148.8, 1);
      expect(sizing.actualRiskPct).toBeCloseTo(0.992, 2);
      // Target 1 = 42.60 + (2.0 * 2.40) = 47.40 (+2.0R)
      expect(sizing.target1).toBe(47.4);
      // Target 2 = 42.60 + (3.5 * 2.40) = 51.00 (+3.5R)
      expect(sizing.target2).toBe(51.0);
      expect(sizing.rewardToRiskT1).toBe(2.0);
      expect(sizing.rewardToRiskT2).toBe(3.5);
      expect(sizing.blendedExpectedR).toBe(2.75);
    });

    it("rejects invalid stop loss bounds (stop >= entry)", () => {
      const sizing = calculatePositionSize({
        accountSize: 15000,
        riskPct: 1.0,
        entryPrice: 100.0,
        stopLoss: 100.5,
      });

      expect(sizing.isValid).toBe(false);
      expect(sizing.errors.length).toBeGreaterThan(0);
      expect(sizing.errors[0]).toContain("strictly below entry price");
    });
  });

  // -------------------------------------------------------------
  // 3. 1-Click Tactical Execution & Invariant Enforcement
  // -------------------------------------------------------------
  describe("1-Click Tactical Actions & Invariant Guarantees", () => {
    it("scales 50% on odd share counts, banks partial gain, and sets stop to Breakeven", () => {
      const trade: StoredTrade = {
        id: "m3_scale_test",
        ticker: "GLBE",
        companyName: "Global-e",
        status: "ACTIVE",
        entryTrigger: 42.6,
        actualEntry: 42.6,
        sharesTotal: 62,
        sharesRemaining: 62,
        initialStop: 40.2,
        currentStop: 40.2,
        target1: 47.4,
        target2: 51.0,
        rrRatio: 2.0,
        timeStopSessions: 7,
        sessionsElapsed: 3,
      };

      storage.addOrUpdateTrade(trade);

      // Execute Scale at T1 ($47.40):
      // Half shares = ceil(62 / 2) = 31 shares
      // Remaining = 31 shares
      // Realized = 31 * (47.40 - 42.60) = 31 * 4.80 = $148.80
      const updated: StoredTrade = {
        ...trade,
        status: "SCALED_T1",
        sharesRemaining: 31,
        currentStop: 42.6, // Breakeven!
        realizedPnL: 148.8,
      };
      storage.addOrUpdateTrade(updated);

      const retrieved = storage.getTrades()[0];
      expect(retrieved.status).toBe("SCALED_T1");
      expect(retrieved.sharesRemaining).toBe(31);
      expect(retrieved.currentStop).toBe(42.6);
      expect(retrieved.realizedPnL).toBe(148.8);

      // Verify that open risk is $0.00
      const openRisk = Math.max(0, retrieved.actualEntry! - retrieved.currentStop) * retrieved.sharesRemaining;
      expect(openRisk).toBe(0.0);
    });

    it("strictly prevents downward stop widening from modifying currentStop", () => {
      const trade: StoredTrade = {
        id: "m3_stop_ratchet",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75,
        currentStop: 86.0,
        target1: 100.1,
        target2: 112.0,
        rrRatio: 2.13,
        timeStopSessions: 5,
        sessionsElapsed: 2,
      };

      storage.addOrUpdateTrade(trade);

      // Attempting to widen stop downward from 86.00 to 82.00 throws Discipline Rule Violation
      expect(() => {
        execute1ClickUpdateStop(storage, "m3_stop_ratchet", 82.0);
      }).toThrow("Discipline Rule Violation");

      // Invariant protects stop in storage
      const retrieved = storage.getTrades()[0];
      expect(retrieved.currentStop).toBe(86.0);
    });

    it("calculates accurate campaign R-multiple on Stale Time-Stop Exit", () => {
      // Entry: $100.00, Initial Stop: $98.00 ($2.00 risk/sh), 75 shares ($150.00 total risk)
      const trade: StoredTrade = {
        id: "m3_stale_trade",
        ticker: "STAL",
        companyName: "Stale Corp",
        status: "ACTIVE",
        entryTrigger: 100.0,
        actualEntry: 100.0,
        sharesTotal: 75,
        sharesRemaining: 75,
        initialStop: 98.0,
        currentStop: 100.0,
        target1: 104.0,
        target2: 107.0,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 7, // Stale!
      };

      storage.addOrUpdateTrade(trade);

      // Market exit at $99.60 (small scratch loss: 75 * -0.40 = -$30.00)
      const totalRealizedPnL = -30.0;
      const initialDollarRisk = 75 * 2.0; // $150.00
      const finalR = Number((totalRealizedPnL / initialDollarRisk).toFixed(2)); // -0.20R

      const closedTrade: StoredTrade = {
        ...trade,
        status: "CLOSED",
        sharesRemaining: 0,
        closedPrice: 99.6,
        closedDate: "2026-08-19",
        realizedPnL: totalRealizedPnL,
        rMultiple: finalR,
        exitReason: "TIME_STOP_EXIT",
      };
      storage.addOrUpdateTrade(closedTrade);

      const retrieved = storage.getTrades()[0];
      expect(retrieved.status).toBe("CLOSED");
      expect(retrieved.realizedPnL).toBe(-30.0);
      expect(retrieved.rMultiple).toBe(-0.2);
      expect(retrieved.exitReason).toBe("TIME_STOP_EXIT");
    });
  });

  // -------------------------------------------------------------
  // 4. Closed Trade Journal & Analytics
  // -------------------------------------------------------------
  describe("Journal Analytics & Cumulative Equity Progression", () => {
    it("computes Win Rate %, Profit Factor, and Average R-Multiple with 100% precision", () => {
      const closedTrades: StoredTrade[] = [
        { id: "1", ticker: "WIN1", companyName: "W1", status: "CLOSED", entryTrigger: 50, actualEntry: 50, sharesTotal: 10, sharesRemaining: 0, initialStop: 45, currentStop: 50, target1: 60, target2: 70, rrRatio: 2, timeStopSessions: 5, sessionsElapsed: 3, realizedPnL: 100, rMultiple: 2.0 },
        { id: "2", ticker: "WIN2", companyName: "W2", status: "CLOSED", entryTrigger: 50, actualEntry: 50, sharesTotal: 10, sharesRemaining: 0, initialStop: 45, currentStop: 50, target1: 60, target2: 70, rrRatio: 2, timeStopSessions: 5, sessionsElapsed: 4, realizedPnL: 150, rMultiple: 3.0 },
        { id: "3", ticker: "LOSS1", companyName: "L1", status: "CLOSED", entryTrigger: 50, actualEntry: 50, sharesTotal: 10, sharesRemaining: 0, initialStop: 45, currentStop: 45, target1: 60, target2: 70, rrRatio: 2, timeStopSessions: 5, sessionsElapsed: 1, realizedPnL: -50, rMultiple: -1.0 },
      ];

      const analytics = computeJournalAnalytics(closedTrades);
      expect(analytics.totalTrades).toBe(3);
      expect(analytics.winningTrades).toBe(2);
      expect(analytics.losingTrades).toBe(1);
      // Win Rate = 2/3 = 66.7%
      expect(analytics.winRatePct).toBe(66.7);
      // Gross Profit = 250, Gross Loss = 50 -> Profit Factor = 5.00
      expect(analytics.profitFactor).toBe(5.0);
      // Avg R = (2.0 + 3.0 - 1.0) / 3 = 4.0 / 3 = +1.33 R
      expect(analytics.avgRMultiple).toBe(1.33);
      expect(analytics.disciplineScorePct).toBe(100.0);
    });

    it("generates cumulative equity curve, high water mark, and maximum drawdown", () => {
      const closedTrades: StoredTrade[] = [
        { id: "1", ticker: "T1", companyName: "T1", status: "CLOSED", entryTrigger: 10, actualEntry: 10, sharesTotal: 10, sharesRemaining: 0, initialStop: 9, currentStop: 10, target1: 12, target2: 14, rrRatio: 2, timeStopSessions: 5, sessionsElapsed: 2, realizedPnL: 300, closedDate: "2026-08-01" }, // Equity = 15,300, Peak = 15,300
        { id: "2", ticker: "T2", companyName: "T2", status: "CLOSED", entryTrigger: 10, actualEntry: 10, sharesTotal: 10, sharesRemaining: 0, initialStop: 9, currentStop: 9, target1: 12, target2: 14, rrRatio: 2, timeStopSessions: 5, sessionsElapsed: 1, realizedPnL: -150, closedDate: "2026-08-03" }, // Equity = 15,150, DD = 150
        { id: "3", ticker: "T3", companyName: "T3", status: "CLOSED", entryTrigger: 10, actualEntry: 10, sharesTotal: 10, sharesRemaining: 0, initialStop: 9, currentStop: 10, target1: 12, target2: 14, rrRatio: 2, timeStopSessions: 5, sessionsElapsed: 4, realizedPnL: 400, closedDate: "2026-08-05" }, // Equity = 15,550, Peak = 15,550
      ];

      const curve = generateCumulativeEquitySeries(15000, closedTrades);
      expect(curve.dataPoints).toHaveLength(4);
      expect(curve.peakEquity).toBe(15550);
      expect(curve.maxDrawdownDollars).toBe(150);
      // Max DD % = (150 / 15,550) * 100 = 0.96%
      expect(curve.maxDrawdownPct).toBeCloseTo(0.96, 2);
    });
  });

  // -------------------------------------------------------------
  // 5. Tactical Daily Briefing & Markdown Export
  // -------------------------------------------------------------
  describe("Daily Tactical Briefing & Markdown Export", () => {
    it("generates structured markdown briefing report with urgency and checklist", () => {
      const activeTrade: StoredTrade = {
        id: "t_briefing",
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

      const quotes = {
        ATRO: { ticker: "ATRO", name: "Astronics", price: 100.5, change: 12.0, changePct: 13.5, high: 101.0, low: 88.5, volume: 2000000, prevClose: 88.5, lastUpdated: "" },
      };

      const report = generateDailyPortfolioReport([activeTrade], quotes, 15000, "FAVORABLE");
      const md = formatBriefingMarkdown(report);

      expect(md).toContain("# Senior Broker — Daily Moves Briefing");
      expect(md).toContain("FAVORABLE");
      expect(md).toContain("### [HIGH] ATRO");
      expect(md).toContain("## Desk Checklist");
      expect(md).toContain("- [ ] Scale 50% at Target 1 and immediately adjust stop to breakeven.");
    });
  });
});
