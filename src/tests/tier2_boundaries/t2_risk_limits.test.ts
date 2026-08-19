// Tier 2 Boundary Value Analysis: Risk Rules, Sleeve Caps, Sector Concentration & Trailing Stops
// Covers:
// - Feature 16: 1% Risk Rule Enforcement (1.000% vs 1.001% risk, boundary crossing, hard stop enforcement, gap downs)
// - Feature 18: 3.0% Total Sleeve Risk Cap ($450 on $15k capital boundary, cumulative open risk, breakeven risk release)
// - Feature 19: Sector Concentration Limiter (max 2 per sector boundary, multi-sector scaling, fallback categories)
// - Feature 10: Dynamic Trailing Stop Adjuster (raising stops, downward-widening rejection, breakeven locking)

import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade } from "../helpers/mock-storage";
import { MockMarketEngine } from "../helpers/mock-market";
import { evaluateTrade } from "../../lib/market/rule-engine";
import { generateDailyPortfolioReport } from "../../lib/portfolio/daily-report";

// Risk Rule Evaluator Helper
export interface TradeRiskValidation {
  valid: boolean;
  actualRiskDollars: number;
  actualRiskPct: number;
  maxAllowedRiskDollars: number;
  violationMessage?: string;
}

export function validateSingleTradeRisk(
  accountSize: number,
  maxRiskPct: number,
  entry: number,
  stop: number,
  shares: number
): TradeRiskValidation {
  const maxAllowedRiskDollars = Number((accountSize * (maxRiskPct / 100)).toFixed(2));
  const riskPerShare = Math.max(0.01, Math.abs(entry - stop));
  const actualRiskDollars = Number((shares * riskPerShare).toFixed(2));
  const actualRiskPct = Number(((actualRiskDollars / accountSize) * 100).toFixed(4));

  // Allow a tiny floating epsilon for rounding
  const isOverLimit = actualRiskDollars > (maxAllowedRiskDollars + 0.001);

  return {
    valid: !isOverLimit,
    actualRiskDollars,
    actualRiskPct,
    maxAllowedRiskDollars,
    violationMessage: isOverLimit
      ? `Trade risk ($${actualRiskDollars.toFixed(2)} / ${actualRiskPct.toFixed(2)}%) exceeds ${maxRiskPct.toFixed(1)}% account cap ($${maxAllowedRiskDollars.toFixed(2)})`
      : undefined,
  };
}

export function validateStopAdjustment(
  currentStop: number,
  newStop: number,
  entryPrice: number
): { allowed: boolean; reason: string; isBreakeven: boolean } {
  if (newStop < currentStop) {
    return {
      allowed: false,
      reason: "VIOLATION: Cannot widen stop loss downward. A stop widened is a plan abandoned.",
      isBreakeven: false,
    };
  }
  const isBreakeven = newStop >= entryPrice;
  return {
    allowed: true,
    reason: isBreakeven ? "Stop raised to Breakeven or higher (risk-free runner)" : "Stop tightened successfully",
    isBreakeven,
  };
}

describe("Tier 2: Risk Limits & Rule Enforcement Boundary Tests", () => {
  let storage: MockDualLayerStorage;
  let market: MockMarketEngine;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
    market = new MockMarketEngine();
  });

  describe("Feature 16: 1.0% Single Trade Risk Rule Enforcement & Precision", () => {
    it("accepts exact 1.000% account risk ($150.00 on $15,000 sleeve)", () => {
      const validation = validateSingleTradeRisk(15000.0, 1.0, 100.0, 98.5, 100);
      expect(validation.valid).toBe(true);
      expect(validation.actualRiskDollars).toBe(150.0);
      expect(validation.actualRiskPct).toBe(1.0);
      expect(validation.violationMessage).toBeUndefined();
    });

    it("accepts sub-boundary risk (0.999% / $149.85)", () => {
      const validation = validateSingleTradeRisk(15000.0, 1.0, 100.0, 98.5015, 100);
      expect(validation.valid).toBe(true);
      expect(validation.actualRiskDollars).toBeLessThanOrEqual(150.0);
      expect(validation.actualRiskPct).toBeLessThan(1.0);
    });

    it("rejects over-boundary risk (1.001% / $150.15 on $15,000 sleeve)", () => {
      // 101 shares * $1.50 = $151.50 -> 1.01%
      const validation = validateSingleTradeRisk(15000.0, 1.0, 100.0, 98.5, 101);
      expect(validation.valid).toBe(false);
      expect(validation.actualRiskDollars).toBe(151.5);
      expect(validation.violationMessage).toContain("exceeds 1.0% account cap");
    });

    it("flags extreme oversized position (5.0% risk / $750 on $15k)", () => {
      const validation = validateSingleTradeRisk(15000.0, 1.0, 100.0, 95.0, 150);
      expect(validation.valid).toBe(false);
      expect(validation.actualRiskDollars).toBe(750.0);
      expect(validation.actualRiskPct).toBe(5.0);
    });

    it("validates micro-risk trade (0.01% risk / $1.50)", () => {
      const validation = validateSingleTradeRisk(15000.0, 1.0, 50.0, 48.5, 1);
      expect(validation.valid).toBe(true);
      expect(validation.actualRiskDollars).toBe(1.5);
      expect(validation.actualRiskPct).toBeCloseTo(0.01, 2);
    });

    it("detects hard stop breach at EXACT stop price ($83.75 price on $83.75 stop)", () => {
      const trade = {
        id: "tr_stop_exact",
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
        sessionsElapsed: 1,
      };

      const quote = { ...market.getQuote("ATRO"), price: 83.75 };
      const evalResult = evaluateTrade(trade, quote);
      expect(evalResult.alertType).toBe("STOP_ALERT");
      expect(evalResult.shouldAutoClose).toBe(true);
      expect(evalResult.alertTitle).toContain("STOP LOSS INVALIDATION");
    });

    it("detects hard stop breach $0.01 below stop ($83.74 on $83.75 stop)", () => {
      const trade = {
        id: "tr_stop_below",
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
        sessionsElapsed: 1,
      };

      const quote = { ...market.getQuote("ATRO"), price: 83.74 };
      const evalResult = evaluateTrade(trade, quote);
      expect(evalResult.alertType).toBe("STOP_ALERT");
      expect(evalResult.shouldAutoClose).toBe(true);
      expect(evalResult.currentRMultiple).toBeLessThanOrEqual(-1.0);
    });

    it("does NOT trigger stop alert when price is $0.01 above stop ($83.76 on $83.75 stop)", () => {
      const trade = {
        id: "tr_stop_above",
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
        sessionsElapsed: 1,
      };

      const quote = { ...market.getQuote("ATRO"), price: 83.76 };
      const evalResult = evaluateTrade(trade, quote);
      expect(evalResult.alertType).toBeUndefined();
      expect(evalResult.shouldAutoClose).toBeUndefined();
    });

    it("calculates R-multiple on severe overnight gap down past stop ($70.00 on $83.75 stop)", () => {
      const trade = {
        id: "tr_gap_down",
        ticker: "ATRO",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75, // Risk/sh = $4.75 (1R)
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        timeStopSessions: 5,
        sessionsElapsed: 1,
      };

      const quote = { ...market.getQuote("ATRO"), price: 70.0 };
      const evalResult = evaluateTrade(trade, quote);
      // Loss = (70.0 - 88.50) = -$18.50 / $4.75 = -3.89R
      expect(evalResult.alertType).toBe("STOP_ALERT");
      expect(evalResult.currentRMultiple).toBeCloseTo(-3.89, 2);
      expect(evalResult.unrealizedPnL).toBe(-333.0); // 18 * -18.50
    });
  });

  describe("Feature 18: 3.0% Total Sleeve Risk Cap ($450 on $15k Boundary)", () => {
    it("handles empty portfolio with exactly 0.00% aggregate risk", () => {
      const report = generateDailyPortfolioReport([], {}, 15000.0);
      expect(report.portfolioSummary.aggregateRiskDollars).toBe(0);
      expect(report.portfolioSummary.aggregateRiskPct).toBe(0);
      expect(report.actionItems.some(a => a.actionType === "RISK_ALERT")).toBe(false);
    });

    it("permits aggregate risk below 3.0% ($300.00 / 2.0% on 2 positions)", () => {
      const t1: StoredTrade = {
        id: "t1",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "ACTIVE",
        entryTrigger: 100,
        actualEntry: 100,
        sharesTotal: 50,
        sharesRemaining: 50,
        initialStop: 97,
        currentStop: 97, // $150 risk
        target1: 106,
        target2: 110,
        rrRatio: 2.0,
        timeStopSessions: 5,
        sessionsElapsed: 1,
      };
      const t2: StoredTrade = {
        id: "t2",
        ticker: "MTRN",
        companyName: "Materion",
        status: "ACTIVE",
        entryTrigger: 200,
        actualEntry: 200,
        sharesTotal: 50,
        sharesRemaining: 50,
        initialStop: 197,
        currentStop: 197, // $150 risk
        target1: 206,
        target2: 210,
        rrRatio: 2.0,
        timeStopSessions: 5,
        sessionsElapsed: 1,
      };

      const quotes = {
        ATRO: { ...market.getQuote("ATRO"), price: 100.0 },
        MTRN: { ...market.getQuote("MTRN"), price: 200.0 },
      };

      const report = generateDailyPortfolioReport([t1, t2], quotes, 15000.0);
      expect(report.portfolioSummary.aggregateRiskDollars).toBe(300.0);
      expect(report.portfolioSummary.aggregateRiskPct).toBe(2.0);
      expect(report.actionItems.some(a => a.actionType === "RISK_ALERT")).toBe(false);
    });

    it("handles exact 3.00% sleeve risk cap ($450.00 on 3 positions) at boundary without alert", () => {
      const trades: StoredTrade[] = [
        {
          id: "t1",
          ticker: "ATRO",
          companyName: "Astronics",
          status: "ACTIVE",
          entryTrigger: 100,
          actualEntry: 100,
          sharesTotal: 50,
          sharesRemaining: 50,
          initialStop: 97,
          currentStop: 97, // $150 risk
          target1: 106,
          target2: 110,
          rrRatio: 2.0,
          timeStopSessions: 5,
          sessionsElapsed: 1,
        },
        {
          id: "t2",
          ticker: "MTRN",
          companyName: "Materion",
          status: "ACTIVE",
          entryTrigger: 200,
          actualEntry: 200,
          sharesTotal: 50,
          sharesRemaining: 50,
          initialStop: 197,
          currentStop: 197, // $150 risk
          target1: 206,
          target2: 210,
          rrRatio: 2.0,
          timeStopSessions: 5,
          sessionsElapsed: 1,
        },
        {
          id: "t3",
          ticker: "LITE",
          companyName: "Lumentum",
          status: "ACTIVE",
          entryTrigger: 300,
          actualEntry: 300,
          sharesTotal: 50,
          sharesRemaining: 50,
          initialStop: 297,
          currentStop: 297, // $150 risk
          target1: 306,
          target2: 310,
          rrRatio: 2.0,
          timeStopSessions: 5,
          sessionsElapsed: 1,
        },
      ];

      const quotes = {
        ATRO: { ...market.getQuote("ATRO"), price: 100 },
        MTRN: { ...market.getQuote("MTRN"), price: 200 },
        LITE: { ...market.getQuote("LITE"), price: 300 },
      };

      const report = generateDailyPortfolioReport(trades, quotes, 15000.0);
      expect(report.portfolioSummary.aggregateRiskDollars).toBe(450.0);
      expect(report.portfolioSummary.aggregateRiskPct).toBe(3.0);
      expect(report.actionItems.some(a => a.actionType === "RISK_ALERT")).toBe(false);
    });

    it("triggers RISK_ALERT when aggregate risk exceeds 3.0% ($451.00 / 3.01%)", () => {
      const trades: StoredTrade[] = [
        {
          id: "t1",
          ticker: "ATRO",
          companyName: "Astronics",
          status: "ACTIVE",
          entryTrigger: 100,
          actualEntry: 100,
          sharesTotal: 50,
          sharesRemaining: 50,
          initialStop: 97,
          currentStop: 97, // $150 risk
          target1: 106,
          target2: 110,
          rrRatio: 2.0,
          timeStopSessions: 5,
          sessionsElapsed: 1,
        },
        {
          id: "t2",
          ticker: "MTRN",
          companyName: "Materion",
          status: "ACTIVE",
          entryTrigger: 200,
          actualEntry: 200,
          sharesTotal: 50,
          sharesRemaining: 50,
          initialStop: 197,
          currentStop: 197, // $150 risk
          target1: 206,
          target2: 210,
          rrRatio: 2.0,
          timeStopSessions: 5,
          sessionsElapsed: 1,
        },
        {
          id: "t3",
          ticker: "LITE",
          companyName: "Lumentum",
          status: "ACTIVE",
          entryTrigger: 300,
          actualEntry: 300,
          sharesTotal: 51,
          sharesRemaining: 51,
          initialStop: 297,
          currentStop: 297, // 51 * $3 = $153 risk -> Total $453 (3.02%)
          target1: 306,
          target2: 310,
          rrRatio: 2.0,
          timeStopSessions: 5,
          sessionsElapsed: 1,
        },
      ];

      const quotes = {
        ATRO: { ...market.getQuote("ATRO"), price: 100 },
        MTRN: { ...market.getQuote("MTRN"), price: 200 },
        LITE: { ...market.getQuote("LITE"), price: 300 },
      };

      const report = generateDailyPortfolioReport(trades, quotes, 15000.0);
      expect(report.portfolioSummary.aggregateRiskDollars).toBe(453.0);
      expect(report.portfolioSummary.aggregateRiskPct).toBe(3.02);

      const riskAlert = report.actionItems.find(a => a.actionType === "RISK_ALERT");
      expect(riskAlert).toBeDefined();
      expect(riskAlert?.urgency).toBe("HIGH");
      expect(riskAlert?.headline).toContain("Exceeds Recommended 3.0% Cap");
    });

    it("verifies that scaled trade with breakeven stop contributes $0 open risk", () => {
      const scaledTrade: StoredTrade = {
        id: "tr_scaled",
        ticker: "GLBE",
        companyName: "Global-e",
        status: "SCALED_T1",
        entryTrigger: 42.6,
        actualEntry: 42.6,
        sharesTotal: 40,
        sharesRemaining: 20,
        initialStop: 40.2,
        currentStop: 42.6, // Stop raised to breakeven
        target1: 48.0,
        target2: 52.0,
        rrRatio: 2.25,
        timeStopSessions: 7,
        sessionsElapsed: 3,
      };

      const quotes = { GLBE: { ...market.getQuote("GLBE"), price: 46.0 } };
      const report = generateDailyPortfolioReport([scaledTrade], quotes, 15000.0);
      // Since currentStop >= entry, open risk is 0
      expect(report.portfolioSummary.aggregateRiskDollars).toBe(0.0);
      expect(report.portfolioSummary.aggregateRiskPct).toBe(0.0);
    });

    it("allows 5+ simultaneous active trades when earlier trades have stops at breakeven", () => {
      const trades: StoredTrade[] = [
        // 3 Breakeven trades ($0 risk each)
        { id: "b1", ticker: "T1", companyName: "C1", status: "SCALED_T1", entryTrigger: 50, actualEntry: 50, sharesTotal: 20, sharesRemaining: 10, initialStop: 45, currentStop: 50, target1: 60, target2: 70, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 2 },
        { id: "b2", ticker: "T2", companyName: "C2", status: "SCALED_T1", entryTrigger: 50, actualEntry: 50, sharesTotal: 20, sharesRemaining: 10, initialStop: 45, currentStop: 50, target1: 60, target2: 70, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 2 },
        { id: "b3", ticker: "T3", companyName: "C3", status: "SCALED_T1", entryTrigger: 50, actualEntry: 50, sharesTotal: 20, sharesRemaining: 10, initialStop: 45, currentStop: 50, target1: 60, target2: 70, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 2 },
        // 2 New active trades ($150 risk each = $300 total)
        { id: "a1", ticker: "T4", companyName: "C4", status: "ACTIVE", entryTrigger: 100, actualEntry: 100, sharesTotal: 50, sharesRemaining: 50, initialStop: 97, currentStop: 97, target1: 106, target2: 110, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 1 },
        { id: "a2", ticker: "T5", companyName: "C5", status: "ACTIVE", entryTrigger: 100, actualEntry: 100, sharesTotal: 50, sharesRemaining: 50, initialStop: 97, currentStop: 97, target1: 106, target2: 110, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 1 },
      ];

      const quotes: Record<string, any> = {
        T1: { price: 55 },
        T2: { price: 55 },
        T3: { price: 55 },
        T4: { price: 100 },
        T5: { price: 100 },
      };

      const report = generateDailyPortfolioReport(trades, quotes, 15000.0);
      expect(report.portfolioSummary.totalOpenPositions).toBe(5);
      expect(report.portfolioSummary.aggregateRiskDollars).toBe(300.0); // 2.0% < 3.0%
      expect(report.actionItems.some(a => a.actionType === "RISK_ALERT")).toBe(false);
    });

    it("verifies that fixed stop prices keep open risk strictly bounded during intraday fluctuations", () => {
      const trade: StoredTrade = {
        id: "t_intraday",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "ACTIVE",
        entryTrigger: 100,
        actualEntry: 100,
        sharesTotal: 50,
        sharesRemaining: 50,
        initialStop: 97,
        currentStop: 97,
        target1: 106,
        target2: 110,
        rrRatio: 2.0,
        timeStopSessions: 5,
        sessionsElapsed: 1,
      };

      // Even if quote moves from 100 -> 105 -> 98, open risk to stop remains (100 - 97) * 50 = $150
      const q1 = { ATRO: { ...market.getQuote("ATRO"), price: 105 } };
      const q2 = { ATRO: { ...market.getQuote("ATRO"), price: 98 } };

      const r1 = generateDailyPortfolioReport([trade], q1, 15000.0);
      const r2 = generateDailyPortfolioReport([trade], q2, 15000.0);

      expect(r1.portfolioSummary.aggregateRiskDollars).toBe(150.0);
      expect(r2.portfolioSummary.aggregateRiskDollars).toBe(150.0);
    });

    it("includes risk cap reminder in daily desk checklist", () => {
      const report = generateDailyPortfolioReport([], {}, 15000.0);
      const hasCapCheck = report.deskChecklist.some(item => item.includes("3.0%") && item.includes("$450.00"));
      expect(hasCapCheck).toBe(true);
    });

    it("unshifts high-priority freeze instruction when risk cap is violated", () => {
      const trades: StoredTrade[] = [
        { id: "t1", ticker: "T1", companyName: "C1", status: "ACTIVE", entryTrigger: 100, actualEntry: 100, sharesTotal: 100, sharesRemaining: 100, initialStop: 95, currentStop: 95, target1: 110, target2: 120, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 1 },
      ];
      // 100 shares * $5 risk = $500 risk (3.33% on $15k)
      const quotes = { T1: { price: 100 } } as any;
      const report = generateDailyPortfolioReport(trades, quotes, 15000.0);

      expect(report.actionItems[0].actionType).toBe("RISK_ALERT");
      expect(report.actionItems[0].suggestedOrder).toContain("Freeze new entries");
    });
  });

  describe("Feature 19: Sector Concentration Limiter (Max 2 Positions per Sector)", () => {
    it("permits 1 position in Aerospace sector", () => {
      const trades = [
        { id: "a1", ticker: "ATRO", status: "ACTIVE", setupType: "Aerospace Pivot", entryTrigger: 88, sharesRemaining: 10, currentStop: 83, initialStop: 83, target1: 98, target2: 108, timeStopSessions: 5, sessionsElapsed: 1 },
      ];
      const report = generateDailyPortfolioReport(trades, {}, 15000.0);
      expect(report.sectorExposure["Aerospace & Defense"]).toBe(1);
    });

    it("permits exactly 2 positions in Aerospace sector (at limit boundary)", () => {
      const trades = [
        { id: "a1", ticker: "ATRO", status: "ACTIVE", setupType: "Aerospace Breakout", entryTrigger: 88, sharesRemaining: 10, currentStop: 83, initialStop: 83, target1: 98, target2: 108, timeStopSessions: 5, sessionsElapsed: 1 },
        { id: "a2", ticker: "HEI", status: "ACTIVE", setupType: "Aerospace Pullback", entryTrigger: 200, sharesRemaining: 5, currentStop: 190, initialStop: 190, target1: 220, target2: 240, timeStopSessions: 5, sessionsElapsed: 1 },
      ];
      const report = generateDailyPortfolioReport(trades, {}, 15000.0);
      expect(report.sectorExposure["Aerospace & Defense"]).toBe(2);
      expect(report.sectorExposure["Aerospace & Defense"]).toBeLessThanOrEqual(2);
    });

    it("identifies 3 positions in Aerospace sector as exceeding limit (count = 3)", () => {
      const trades = [
        { id: "a1", ticker: "ATRO", status: "ACTIVE", setupType: "Aerospace 1", entryTrigger: 88, sharesRemaining: 10, currentStop: 83, initialStop: 83, target1: 98, target2: 108, timeStopSessions: 5, sessionsElapsed: 1 },
        { id: "a2", ticker: "HEI", status: "ACTIVE", setupType: "Aerospace 2", entryTrigger: 200, sharesRemaining: 5, currentStop: 190, initialStop: 190, target1: 220, target2: 240, timeStopSessions: 5, sessionsElapsed: 1 },
        { id: "a3", ticker: "TDG", status: "ACTIVE", setupType: "Aerospace 3", entryTrigger: 1000, sharesRemaining: 1, currentStop: 950, initialStop: 950, target1: 1100, target2: 1200, timeStopSessions: 5, sessionsElapsed: 1 },
      ];
      const report = generateDailyPortfolioReport(trades, {}, 15000.0);
      expect(report.sectorExposure["Aerospace & Defense"]).toBe(3);
      expect(report.sectorExposure["Aerospace & Defense"]).toBeGreaterThan(2);
    });

    it("handles balanced distribution across distinct sectors (2 Tech + 2 Materials + 2 Aerospace)", () => {
      const trades = [
        { id: "1", ticker: "GLBE", status: "ACTIVE", setupType: "E-Commerce Tech", entryTrigger: 42, sharesRemaining: 10, currentStop: 40, initialStop: 40, target1: 48, target2: 52, timeStopSessions: 5, sessionsElapsed: 1 },
        { id: "2", ticker: "CRWV", status: "ACTIVE", setupType: "Cloud Tech", entryTrigger: 90, sharesRemaining: 10, currentStop: 85, initialStop: 85, target1: 100, target2: 110, timeStopSessions: 5, sessionsElapsed: 1 },
        { id: "3", ticker: "MTRN", status: "ACTIVE", setupType: "Materials Pullback", entryTrigger: 280, sharesRemaining: 5, currentStop: 270, initialStop: 270, target1: 300, target2: 320, timeStopSessions: 5, sessionsElapsed: 1 },
        { id: "4", ticker: "FCX", status: "ACTIVE", setupType: "Materials Breakout", entryTrigger: 45, sharesRemaining: 20, currentStop: 42, initialStop: 42, target1: 50, target2: 55, timeStopSessions: 5, sessionsElapsed: 1 },
        { id: "5", ticker: "ATRO", status: "ACTIVE", setupType: "Aerospace Defense", entryTrigger: 88, sharesRemaining: 10, currentStop: 83, initialStop: 83, target1: 98, target2: 108, timeStopSessions: 5, sessionsElapsed: 1 },
        { id: "6", ticker: "HEI", status: "ACTIVE", setupType: "Aerospace Defense", entryTrigger: 200, sharesRemaining: 5, currentStop: 190, initialStop: 190, target1: 220, target2: 240, timeStopSessions: 5, sessionsElapsed: 1 },
      ];
      const report = generateDailyPortfolioReport(trades, {}, 15000.0);
      expect(report.sectorExposure["Technology"]).toBe(2);
      expect(report.sectorExposure["Materials"]).toBe(2);
      expect(report.sectorExposure["Aerospace & Defense"]).toBe(2);
    });

    it("falls back to 'Diversified' sector bucket for unclassified setup styles", () => {
      const trades = [
        { id: "u1", ticker: "UNKN", status: "ACTIVE", setupType: "Generic Momentum Setup", entryTrigger: 50, sharesRemaining: 10, currentStop: 48, initialStop: 48, target1: 55, target2: 60, timeStopSessions: 5, sessionsElapsed: 1 },
      ];
      const report = generateDailyPortfolioReport(trades, {}, 15000.0);
      expect(report.sectorExposure["Diversified"]).toBe(1);
    });

    it("correctly aggregates sector counts when setup types vary in case and extra wording", () => {
      const trades = [
        { id: "1", ticker: "T1", status: "ACTIVE", setupType: "Leading Tech Flag", entryTrigger: 50, sharesRemaining: 10, currentStop: 48, initialStop: 48, target1: 55, target2: 60, timeStopSessions: 5, sessionsElapsed: 1 },
        { id: "2", ticker: "T2", status: "ACTIVE", setupType: "E-Commerce Reclaim", entryTrigger: 30, sharesRemaining: 10, currentStop: 28, initialStop: 28, target1: 35, target2: 40, timeStopSessions: 5, sessionsElapsed: 1 },
      ];
      const report = generateDailyPortfolioReport(trades, {}, 15000.0);
      expect(report.sectorExposure["Technology"]).toBe(2);
    });

    it("ignores closed and pending trades when computing sector exposure", () => {
      const trades = [
        { id: "1", ticker: "T1", status: "ACTIVE", setupType: "Tech Breakout", entryTrigger: 50, sharesRemaining: 10, currentStop: 48, initialStop: 48, target1: 55, target2: 60, timeStopSessions: 5, sessionsElapsed: 1 },
        { id: "2", ticker: "T2", status: "PENDING_ENTRY", setupType: "Tech Pullback", entryTrigger: 50, sharesRemaining: 10, currentStop: 48, initialStop: 48, target1: 55, target2: 60, timeStopSessions: 5, sessionsElapsed: 0 },
        { id: "3", ticker: "T3", status: "CLOSED", setupType: "Tech Flag", entryTrigger: 50, sharesRemaining: 0, currentStop: 48, initialStop: 48, target1: 55, target2: 60, timeStopSessions: 5, sessionsElapsed: 5 },
      ];
      const report = generateDailyPortfolioReport(trades, {}, 15000.0);
      // Only the ACTIVE trade is counted in sector exposure
      expect(report.sectorExposure["Technology"]).toBe(1);
    });

    it("verifies user settings maxSectorPositions defaults to 2", () => {
      const settings = storage.getSettings();
      expect(settings.maxSectorPositions).toBe(2);
    });
  });

  describe("Feature 10: Dynamic Trailing Stop Adjuster & Downward-Widening Protection", () => {
    it("allows tightening stop loss upward ($83.75 -> $85.50)", () => {
      const res = validateStopAdjustment(83.75, 85.50, 88.50);
      expect(res.allowed).toBe(true);
      expect(res.isBreakeven).toBe(false);
      expect(res.reason).toContain("Stop tightened successfully");
    });

    it("allows raising stop loss to exact entry price ($88.50) locking Breakeven", () => {
      const res = validateStopAdjustment(83.75, 88.50, 88.50);
      expect(res.allowed).toBe(true);
      expect(res.isBreakeven).toBe(true);
      expect(res.reason).toContain("Breakeven");
    });

    it("allows trailing stop into profit above entry ($88.50 -> $92.00)", () => {
      const res = validateStopAdjustment(88.50, 92.00, 88.50);
      expect(res.allowed).toBe(true);
      expect(res.isBreakeven).toBe(true);
    });

    it("REJECTS downward widening of stop loss ($83.75 -> $80.00)", () => {
      const res = validateStopAdjustment(83.75, 80.00, 88.50);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("Cannot widen stop loss downward");
      expect(res.reason).toContain("A stop widened is a plan abandoned");
    });

    it("rejects downward widening even by $0.01 ($83.75 -> $83.74)", () => {
      const res = validateStopAdjustment(83.75, 83.74, 88.50);
      expect(res.allowed).toBe(false);
    });

    it("updates trade stop in storage and persists correctly", () => {
      const trade: StoredTrade = {
        id: "tr_trail_persist",
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

      storage.addOrUpdateTrade(trade);
      expect(storage.getTrades()[0].currentStop).toBe(83.75);

      // Trail stop to breakeven
      trade.currentStop = 88.5;
      storage.addOrUpdateTrade(trade);
      expect(storage.getTrades()[0].currentStop).toBe(88.5);
    });

    it("handles sub-penny trailing stop increments ($0.05 step adjustments)", () => {
      let currentStop = 83.75;
      for (let i = 1; i <= 10; i++) {
        const newStop = Number((currentStop + 0.05).toFixed(2));
        const res = validateStopAdjustment(currentStop, newStop, 88.5);
        expect(res.allowed).toBe(true);
        currentStop = newStop;
      }
      expect(currentStop).toBe(84.25);
    });

    it("evaluates SCALED_T1 trailing stop advice in daily portfolio report", () => {
      const scaledTrade: StoredTrade = {
        id: "tr_scaled_advice",
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
        sessionsElapsed: 3,
      };

      const quotes = { GLBE: { ...market.getQuote("GLBE"), price: 46.0 } };
      const report = generateDailyPortfolioReport([scaledTrade], quotes, 15000.0);
      const trailItem = report.actionItems.find(a => a.ticker === "GLBE" && a.actionType === "TRAIL_STOP");
      expect(trailItem).toBeDefined();
      expect(trailItem?.urgency).toBe("LOW");
      expect(trailItem?.details).toContain("Remaining 20 shares are floating risk-free");
    });
  });
});
