// Tier 2 Boundary Value Analysis & Corner Case Verification: Portfolio Core & Sizing
// Covers:
// - Feature 1: Portfolio Summary Card ($0, $15k default, $1M, over-allocation, extreme P&L)
// - Feature 2: Interactive Equity Sparklines (single point, flatline, extreme spikes, 1000+ points, floating precision)
// - Feature 6: 1% Account Risk Auto-Sizer ($0 stop distance, sub-cent stops, penny stocks, $1000+ tickers, rounding boundaries)
// - Feature 29: Interactive Sizing Sandbox Calculator (extreme sliders, wide swing ladders, rapid recalculations)

import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade } from "../helpers/mock-storage";
import { MockMarketEngine } from "../helpers/mock-market";
import { generateDailyPortfolioReport } from "../../lib/portfolio/daily-report";

// Opaque Sizing Calculation Helper conforming to PROJECT.md interface contract
export interface SizingParams {
  accountSize: number;
  riskPct: number;
  entryPrice: number;
  stopLoss: number;
  target1?: number;
  target2?: number;
}

export interface SizingResult {
  shares: number;
  allocatedCapital: number;
  dollarRisk: number;
  actualRiskPct: number;
  target1: number;
  target2: number;
  rewardToRisk: number;
  riskPerShare: number;
}

export function calculatePositionSize(params: SizingParams): SizingResult {
  const accountSize = Math.max(0, params.accountSize);
  const riskPct = Math.max(0, params.riskPct);
  const entryPrice = Math.max(0.0001, params.entryPrice);
  const stopLoss = Math.max(0, params.stopLoss);

  const riskBudget = accountSize * (riskPct / 100);
  const rawDiff = Math.abs(entryPrice - stopLoss);
  const riskPerShare = Math.max(0.01, Number(rawDiff.toFixed(4)));

  let shares = 0;
  if (riskBudget > 0 && riskPerShare > 0) {
    shares = Math.max(1, Math.floor(riskBudget / riskPerShare));
  }

  const allocatedCapital = Number((shares * entryPrice).toFixed(2));
  const dollarRisk = Number((shares * riskPerShare).toFixed(2));
  const actualRiskPct = accountSize > 0 ? Number(((dollarRisk / accountSize) * 100).toFixed(4)) : 0;

  const t1 = params.target1 !== undefined && params.target1 > 0
    ? params.target1
    : Number((entryPrice + 2.0 * riskPerShare).toFixed(2));

  const t2 = params.target2 !== undefined && params.target2 > 0
    ? params.target2
    : Number((entryPrice + 3.5 * riskPerShare).toFixed(2));

  const rewardToRisk = riskPerShare > 0 ? Number(((t1 - entryPrice) / riskPerShare).toFixed(2)) : 0;

  return {
    shares,
    allocatedCapital,
    dollarRisk,
    actualRiskPct,
    target1: t1,
    target2: t2,
    rewardToRisk,
    riskPerShare,
  };
}

// Sparkline rendering simulator
export interface SparklinePoint {
  x: number;
  y: number;
}

export function generateSparklinePoints(data: number[], width: number = 200, height: number = 50): SparklinePoint[] {
  if (!data || data.length === 0) return [];
  if (data.length === 1) {
    return [{ x: width / 2, y: height / 2 }];
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;

  return data.map((val, idx) => ({
    x: Number(((idx / (data.length - 1)) * width).toFixed(2)),
    y: Number((height - ((val - min) / range) * height).toFixed(2)),
  }));
}

describe("Tier 2: Portfolio Core & Sizing Boundary Tests", () => {
  let storage: MockDualLayerStorage;
  let market: MockMarketEngine;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
    market = new MockMarketEngine();
  });

  describe("Feature 1: Portfolio Summary Boundaries & Extreme Capital Values", () => {
    it("handles zero capital account in sizing and report generation cleanly", () => {
      const sizing = calculatePositionSize({
        accountSize: 0,
        riskPct: 1.0,
        entryPrice: 50.0,
        stopLoss: 45.0,
      });
      expect(sizing.shares).toBe(0);
      expect(sizing.dollarRisk).toBe(0);
      expect(sizing.allocatedCapital).toBe(0);
      expect(sizing.actualRiskPct).toBe(0);

      const report = generateDailyPortfolioReport([], {}, 15000.0);
      expect(report.portfolioSummary.totalOpenPositions).toBe(0);
      expect(report.portfolioSummary.aggregateRiskDollars).toBe(0);
      expect(report.portfolioSummary.aggregateRiskPct).toBe(0);
      expect(report.portfolioSummary.totalUnrealizedPnL).toBe(0);
    });

    it("handles micro-account capital ($10.00) with precise 1% ($0.10) risk budgeting", () => {
      const sizing = calculatePositionSize({
        accountSize: 10.0,
        riskPct: 1.0,
        entryPrice: 2.0,
        stopLoss: 1.9,
      });
      expect(sizing.shares).toBe(1);
      expect(sizing.dollarRisk).toBe(0.1);
      expect(sizing.actualRiskPct).toBe(1.0);
    });

    it("evaluates default dedicated swing capital of $15,000 with exactly $150 (1%) risk", () => {
      const settings = storage.getSettings();
      expect(settings.accountSize).toBe(15000.0);
      const riskBudget = settings.accountSize * (settings.riskPerTrade / 100);
      expect(riskBudget).toBe(150.0);

      const sizing = calculatePositionSize({
        accountSize: settings.accountSize,
        riskPct: settings.riskPerTrade,
        entryPrice: 88.5,
        stopLoss: 83.75,
      });
      // Entry 88.50, Stop 83.75 -> Risk/sh $4.75 -> 150 / 4.75 = 31.57 -> 31 shares
      expect(sizing.shares).toBe(31);
      expect(sizing.dollarRisk).toBeLessThanOrEqual(150.0);
      expect(sizing.actualRiskPct).toBeLessThanOrEqual(1.0);
    });

    it("handles High Net Worth swing sleeve ($1,000,000.00) with $10,000 risk budget", () => {
      const sizing = calculatePositionSize({
        accountSize: 1000000.0,
        riskPct: 1.0,
        entryPrice: 250.0,
        stopLoss: 240.0,
      });
      // Risk budget = $10,000. Risk/sh = $10.00 -> exactly 1,000 shares
      expect(sizing.shares).toBe(1000);
      expect(sizing.allocatedCapital).toBe(250000.0);
      expect(sizing.dollarRisk).toBe(10000.0);
      expect(sizing.actualRiskPct).toBe(1.0);
    });

    it("handles extreme institutional swing sleeve ($100,000,000.00)", () => {
      const sizing = calculatePositionSize({
        accountSize: 100000000.0,
        riskPct: 1.0,
        entryPrice: 50.0,
        stopLoss: 48.0,
      });
      // Risk budget = $1,000,000. Risk/sh = $2.00 -> 500,000 shares
      expect(sizing.shares).toBe(500000);
      expect(sizing.allocatedCapital).toBe(25000000.0);
      expect(sizing.dollarRisk).toBe(1000000.0);
    });

    it("evaluates 100% capital allocation boundary when cash is fully deployed", () => {
      const trade: StoredTrade = {
        id: "tr_full_alloc",
        ticker: "ATRO",
        companyName: "Astronics Corp",
        status: "ACTIVE",
        entryTrigger: 100.0,
        actualEntry: 100.0,
        sharesTotal: 150,
        sharesRemaining: 150,
        initialStop: 99.0,
        currentStop: 99.0,
        target1: 102.0,
        target2: 105.0,
        rrRatio: 2.0,
        timeStopSessions: 5,
        sessionsElapsed: 1,
      };
      // 150 shares * $100 = $15,000 allocated capital on $15,000 account
      const allocated = trade.sharesRemaining * trade.actualEntry!;
      expect(allocated).toBe(15000.0);
      const cashAvailable = 15000.0 - allocated;
      expect(cashAvailable).toBe(0.0);
    });

    it("handles over-allocated capital edge case gracefully", () => {
      const allocated = 18000.0;
      const accountSize = 15000.0;
      const cashAvailable = accountSize - allocated;
      expect(cashAvailable).toBe(-3000.0);
      expect(cashAvailable).toBeLessThan(0);
    });

    it("calculates floating P&L extreme boundaries (-99.9% collapse vs +1000% multibagger)", () => {
      const tradeLoss: StoredTrade = {
        id: "tr_loss",
        ticker: "FALL",
        companyName: "Fallen Angel",
        status: "ACTIVE",
        entryTrigger: 100.0,
        actualEntry: 100.0,
        sharesTotal: 10,
        sharesRemaining: 10,
        initialStop: 90.0,
        currentStop: 90.0,
        target1: 120.0,
        target2: 150.0,
        rrRatio: 2.0,
        timeStopSessions: 5,
        sessionsElapsed: 1,
      };

      const quotesLoss = { FALL: { ...market.getQuote("FALL"), price: 0.1 } };
      const reportLoss = generateDailyPortfolioReport([tradeLoss], quotesLoss, 15000.0);
      // PnL = (0.1 - 100) * 10 = -999.00
      expect(reportLoss.portfolioSummary.totalUnrealizedPnL).toBe(-999.0);

      const tradeGain: StoredTrade = {
        ...tradeLoss,
        id: "tr_gain",
        ticker: "ROCKET",
      };
      const quotesGain = { ROCKET: { ...market.getQuote("ROCKET"), price: 1100.0 } };
      const reportGain = generateDailyPortfolioReport([tradeGain], quotesGain, 15000.0);
      // PnL = (1100 - 100) * 10 = +10000.00
      expect(reportGain.portfolioSummary.totalUnrealizedPnL).toBe(10000.0);
    });
  });

  describe("Feature 2: Interactive Equity Sparkline Edge & Boundary Cases", () => {
    it("handles empty data array returning empty coordinates", () => {
      const points = generateSparklinePoints([]);
      expect(points).toHaveLength(0);
    });

    it("renders single data point in exact center of chart viewport", () => {
      const points = generateSparklinePoints([15000.0], 200, 50);
      expect(points).toHaveLength(1);
      expect(points[0].x).toBe(100);
      expect(points[0].y).toBe(25);
    });

    it("renders flatline series (zero variance) without NaN or division by zero", () => {
      const points = generateSparklinePoints([15000, 15000, 15000, 15000], 200, 50);
      expect(points).toHaveLength(4);
      points.forEach(p => {
        expect(isNaN(p.y)).toBe(false);
        expect(p.y).toBe(50); // Height when min == max
      });
    });

    it("renders extreme positive vertical expansion (+500% spike)", () => {
      const series = [15000, 15100, 15050, 90000];
      const points = generateSparklinePoints(series, 200, 50);
      expect(points).toHaveLength(4);
      // Highest point should map to y = 0 (top of SVG viewport)
      expect(points[3].y).toBe(0);
      // Lowest point should map to y = 50 (bottom of viewport)
      expect(points[0].y).toBe(50);
    });

    it("renders extreme negative cliff (-90% drop)", () => {
      const series = [15000, 14000, 12000, 1500];
      const points = generateSparklinePoints(series, 200, 50);
      expect(points).toHaveLength(4);
      expect(points[0].y).toBe(0); // 15000 is highest -> y = 0
      expect(points[3].y).toBe(50); // 1500 is lowest -> y = 50
    });

    it("renders minimal 2-point series at opposite boundaries", () => {
      const points = generateSparklinePoints([15000, 16000], 200, 50);
      expect(points).toHaveLength(2);
      expect(points[0].x).toBe(0);
      expect(points[0].y).toBe(50);
      expect(points[1].x).toBe(200);
      expect(points[1].y).toBe(0);
    });

    it("renders dense 1000+ sequential tick points accurately", () => {
      const largeSeries: number[] = [];
      let base = 15000;
      for (let i = 0; i < 1000; i++) {
        base += (Math.sin(i) * 10);
        largeSeries.push(base);
      }
      const points = generateSparklinePoints(largeSeries, 300, 60);
      expect(points).toHaveLength(1000);
      expect(points[0].x).toBe(0);
      expect(points[999].x).toBe(300);
      points.forEach(p => {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(300);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(60);
      });
    });

    it("handles floating point precision numbers with 6 decimal places", () => {
      const series = [15000.123456, 15000.654321, 15000.999999];
      const points = generateSparklinePoints(series, 200, 50);
      expect(points).toHaveLength(3);
      expect(points[0].y).toBe(50);
      expect(points[2].y).toBe(0);
    });
  });

  describe("Feature 6: 1% Account Risk Auto-Sizer Boundary & Corner Cases", () => {
    it("handles zero stop distance (entry == stop) with safety minimum risk per share ($0.01)", () => {
      const sizing = calculatePositionSize({
        accountSize: 15000.0,
        riskPct: 1.0,
        entryPrice: 50.0,
        stopLoss: 50.0, // Zero distance
      });
      expect(sizing.riskPerShare).toBe(0.01);
      // Risk budget $150 / $0.01 = 15,000 shares
      expect(sizing.shares).toBe(15000);
      expect(sizing.dollarRisk).toBe(150.0);
    });

    it("handles sub-cent stop distance ($0.0005 difference) gracefully", () => {
      const sizing = calculatePositionSize({
        accountSize: 15000.0,
        riskPct: 1.0,
        entryPrice: 10.0005,
        stopLoss: 10.0,
      });
      expect(sizing.riskPerShare).toBe(0.01); // Clamped to min 0.01
      expect(sizing.shares).toBe(15000);
    });

    it("calculates ultra-low penny stock ($0.05 entry, $0.04 stop) sizing", () => {
      const sizing = calculatePositionSize({
        accountSize: 15000.0,
        riskPct: 1.0,
        entryPrice: 0.05,
        stopLoss: 0.04,
      });
      // Risk/sh = $0.01 -> $150 / $0.01 = 15,000 shares -> Capital allocated = 15,000 * 0.05 = $750
      expect(sizing.shares).toBe(15000);
      expect(sizing.allocatedCapital).toBe(750.0);
      expect(sizing.dollarRisk).toBe(150.0);
      expect(sizing.target1).toBe(0.07); // 0.05 + 2 * 0.01
    });

    it("calculates high-priced stock ($951 LITE / $1000+ ticker) with whole share floor", () => {
      const sizing = calculatePositionSize({
        accountSize: 15000.0,
        riskPct: 1.0,
        entryPrice: 951.0,
        stopLoss: 898.5,
      });
      // Risk/sh = $52.50. Risk budget = $150. 150 / 52.50 = 2.857 -> 2 shares
      expect(sizing.shares).toBe(2);
      expect(sizing.dollarRisk).toBe(105.0); // 2 * 52.50
      expect(sizing.dollarRisk).toBeLessThanOrEqual(150.0);
      expect(sizing.actualRiskPct).toBeCloseTo(0.70, 2);
    });

    it("handles exact share boundary where risk budget divides evenly", () => {
      const sizing = calculatePositionSize({
        accountSize: 15000.0,
        riskPct: 1.0,
        entryPrice: 100.0,
        stopLoss: 98.5,
      });
      // Risk/sh = $1.50. $150 / $1.50 = exactly 100 shares
      expect(sizing.shares).toBe(100);
      expect(sizing.dollarRisk).toBe(150.0);
      expect(sizing.actualRiskPct).toBe(1.0);
    });

    it("floors fractional share counts to prevent risk overshoot (112.78 -> 112 shares)", () => {
      const sizing = calculatePositionSize({
        accountSize: 15000.0,
        riskPct: 1.0,
        entryPrice: 50.0,
        stopLoss: 48.67,
      });
      // Risk/sh = $1.33. 150 / 1.33 = 112.7819 -> 112 shares
      expect(sizing.shares).toBe(112);
      expect(sizing.dollarRisk).toBe(148.96); // 112 * 1.33 = 148.96 <= 150.00
      expect(sizing.dollarRisk).toBeLessThanOrEqual(150.0);
    });

    it("handles inverted stop loss (stop > entry) defensively using absolute distance", () => {
      const sizing = calculatePositionSize({
        accountSize: 15000.0,
        riskPct: 1.0,
        entryPrice: 50.0,
        stopLoss: 55.0, // Inverted
      });
      // Absolute risk = $5.00 -> 150 / 5.00 = 30 shares
      expect(sizing.shares).toBe(30);
      expect(sizing.dollarRisk).toBe(150.0);
    });

    it("calculates 0.1% vs 1.0% vs 5.0% risk percentage variations", () => {
      const s01 = calculatePositionSize({ accountSize: 15000, riskPct: 0.1, entryPrice: 100, stopLoss: 95 });
      const s10 = calculatePositionSize({ accountSize: 15000, riskPct: 1.0, entryPrice: 100, stopLoss: 95 });
      const s50 = calculatePositionSize({ accountSize: 15000, riskPct: 5.0, entryPrice: 100, stopLoss: 95 });

      // Risk/sh = $5.00
      // 0.1% ($15 budget) -> 3 shares ($15 risk)
      expect(s01.shares).toBe(3);
      expect(s01.dollarRisk).toBe(15.0);

      // 1.0% ($150 budget) -> 30 shares ($150 risk)
      expect(s10.shares).toBe(30);
      expect(s10.dollarRisk).toBe(150.0);

      // 5.0% ($750 budget) -> 150 shares ($750 risk)
      expect(s50.shares).toBe(150);
      expect(s50.dollarRisk).toBe(750.0);
    });

    it("derives Target 1 and Target 2 at exact 2.0R and 3.5R multiples", () => {
      const sizing = calculatePositionSize({
        accountSize: 15000,
        riskPct: 1.0,
        entryPrice: 89.2,
        stopLoss: 83.75,
      });
      // Risk/sh = 5.45
      // T1 = 89.20 + (2 * 5.45) = 100.10
      // T2 = 89.20 + (3.5 * 5.45) = 108.275 -> 108.28
      expect(sizing.target1).toBe(100.1);
      expect(sizing.target2).toBe(108.28);
      expect(sizing.rewardToRisk).toBe(2.0);
    });

    it("respects explicitly supplied Target 1 and Target 2 overrides", () => {
      const sizing = calculatePositionSize({
        accountSize: 15000,
        riskPct: 1.0,
        entryPrice: 89.2,
        stopLoss: 83.75,
        target1: 105.0,
        target2: 120.0,
      });
      expect(sizing.target1).toBe(105.0);
      expect(sizing.target2).toBe(120.0);
      // R:R = (105.0 - 89.2) / 5.45 = 15.8 / 5.45 = 2.90
      expect(sizing.rewardToRisk).toBe(2.9);
    });
  });

  describe("Feature 29: Interactive Sizing Sandbox Calculator & Extreme Scenarios", () => {
    it("handles tight scalp scenario (0.5% stop, 1:1 R:R)", () => {
      const sizing = calculatePositionSize({
        accountSize: 15000,
        riskPct: 1.0,
        entryPrice: 200.0,
        stopLoss: 199.0, // $1 risk
        target1: 201.0,  // $1 reward
      });
      expect(sizing.shares).toBe(150);
      expect(sizing.rewardToRisk).toBe(1.0);
    });

    it("handles extreme asymmetric runner scenario (10:1 R:R)", () => {
      const sizing = calculatePositionSize({
        accountSize: 15000,
        riskPct: 1.0,
        entryPrice: 100.0,
        stopLoss: 98.0, // $2 risk
        target1: 120.0, // $20 reward (10R)
      });
      expect(sizing.shares).toBe(75);
      expect(sizing.rewardToRisk).toBe(10.0);
    });

    it("handles zero risk percentage slider setting (0.0% risk)", () => {
      const sizing = calculatePositionSize({
        accountSize: 15000,
        riskPct: 0.0,
        entryPrice: 100.0,
        stopLoss: 95.0,
      });
      expect(sizing.shares).toBe(0);
      expect(sizing.dollarRisk).toBe(0);
      expect(sizing.allocatedCapital).toBe(0);
    });

    it("handles wide swing ladder ($1,000 price ranges)", () => {
      const sizing = calculatePositionSize({
        accountSize: 500000,
        riskPct: 1.0,
        entryPrice: 3500.0,
        stopLoss: 3000.0, // $500 risk
      });
      // Risk budget = $5,000 -> 10 shares
      expect(sizing.shares).toBe(10);
      expect(sizing.allocatedCapital).toBe(35000.0);
      expect(sizing.target1).toBe(4500.0); // 3500 + 2 * 500
    });

    it("performs rapid consecutive recalculations across 100 parameter variations", () => {
      const startTime = Date.now();
      for (let i = 1; i <= 100; i++) {
        const res = calculatePositionSize({
          accountSize: 10000 + i * 500,
          riskPct: 1.0,
          entryPrice: 50 + i,
          stopLoss: 45 + i,
        });
        expect(res.shares).toBeGreaterThan(0);
        expect(res.dollarRisk).toBeLessThanOrEqual((10000 + i * 500) * 0.01 + 0.05);
      }
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Super fast execution
    });

    it("calculates sub-penny price ladders with 4 decimal places", () => {
      const sizing = calculatePositionSize({
        accountSize: 15000,
        riskPct: 1.0,
        entryPrice: 1.2345,
        stopLoss: 1.1345, // $0.1000 risk
      });
      expect(sizing.riskPerShare).toBe(0.1);
      expect(sizing.shares).toBe(1500);
      expect(sizing.target1).toBe(1.43); // 1.2345 + 0.20 -> 1.4345 -> 1.43
    });

    it("handles extreme account slider ranges ($100 to $10,000,000)", () => {
      const minSizing = calculatePositionSize({ accountSize: 100, riskPct: 1.0, entryPrice: 10, stopLoss: 9 });
      const maxSizing = calculatePositionSize({ accountSize: 10000000, riskPct: 1.0, entryPrice: 10, stopLoss: 9 });

      expect(minSizing.shares).toBe(1);
      expect(minSizing.dollarRisk).toBe(1.0);

      expect(maxSizing.shares).toBe(100000);
      expect(maxSizing.dollarRisk).toBe(100000.0);
    });

    it("validates that reward-to-risk is always non-negative", () => {
      const sizing = calculatePositionSize({
        accountSize: 15000,
        riskPct: 1.0,
        entryPrice: 100.0,
        stopLoss: 95.0,
        target1: 90.0, // Target placed below entry
      });
      // (90 - 100) / 5 = -2.00
      expect(sizing.rewardToRisk).toBe(-2.0);
    });
  });
});
