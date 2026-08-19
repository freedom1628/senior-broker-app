import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade } from "../helpers/mock-storage";
import { MockMarketEngine } from "../helpers/mock-market";
import { generateDailyPortfolioReport } from "../../lib/portfolio/daily-report";

// Helper model for Portfolio Summary Card & Sizing Math
export interface PortfolioSummaryMetrics {
  dedicatedCapital: number;
  allocatedCapital: number;
  cashAvailable: number;
  openRiskDollars: number;
  openRiskPct: number;
  floatingPnL: number;
  floatingPnLPct: number;
  activePositionsCount: number;
}

export function computePortfolioSummary(
  dedicatedCapital: number,
  trades: StoredTrade[],
  quotes: Record<string, { price: number }>
): PortfolioSummaryMetrics {
  const activeTrades = trades.filter(t => t.status === "ACTIVE" || t.status === "SCALED_T1");
  
  let allocatedCapital = 0;
  let openRiskDollars = 0;
  let floatingPnL = 0;

  for (const trade of activeTrades) {
    const sym = trade.ticker.toUpperCase();
    const currentPrice = quotes[sym]?.price ?? trade.actualEntry ?? trade.entryTrigger;
    const entry = trade.actualEntry ?? trade.entryTrigger;
    const shares = trade.sharesRemaining;

    allocatedCapital += entry * shares;
    floatingPnL += (currentPrice - entry) * shares;

    // Open risk is strictly based on current stop distance if stop is below entry
    if (trade.currentStop < entry) {
      openRiskDollars += (entry - trade.currentStop) * shares;
    }
  }

  const cashAvailable = dedicatedCapital - allocatedCapital;
  const openRiskPct = dedicatedCapital > 0 ? (openRiskDollars / dedicatedCapital) * 100 : 0;
  const floatingPnLPct = dedicatedCapital > 0 ? (floatingPnL / dedicatedCapital) * 100 : 0;

  return {
    dedicatedCapital: Number(dedicatedCapital.toFixed(2)),
    allocatedCapital: Number(allocatedCapital.toFixed(2)),
    cashAvailable: Number(cashAvailable.toFixed(2)),
    openRiskDollars: Number(openRiskDollars.toFixed(2)),
    openRiskPct: Number(openRiskPct.toFixed(2)),
    floatingPnL: Number(floatingPnL.toFixed(2)),
    floatingPnLPct: Number(floatingPnLPct.toFixed(2)),
    activePositionsCount: activeTrades.length,
  };
}

export function calculate1PercentSizing(params: {
  accountSize: number;
  riskPct?: number;
  entryPrice: number;
  stopLoss: number;
}) {
  const { accountSize, riskPct = 1.0, entryPrice, stopLoss } = params;
  if (entryPrice <= stopLoss || entryPrice <= 0 || stopLoss <= 0) {
    throw new Error("Invalid price parameters: entryPrice must be strictly greater than stopLoss");
  }
  const riskBudget = accountSize * (riskPct / 100);
  const riskPerShare = entryPrice - stopLoss;
  const shares = Math.max(1, Math.floor(riskBudget / riskPerShare));
  const allocatedCapital = Number((shares * entryPrice).toFixed(2));
  const dollarRisk = Number((shares * riskPerShare).toFixed(2));
  const actualRiskPct = Number(((dollarRisk / accountSize) * 100).toFixed(2));

  return {
    shares,
    allocatedCapital,
    dollarRisk,
    actualRiskPct,
    riskBudget,
    riskPerShare: Number(riskPerShare.toFixed(2)),
  };
}

export function calculateSandboxScenario(params: {
  accountSize: number;
  riskPct: number;
  entryPrice: number;
  stopLoss: number;
  target1?: number;
  target2?: number;
}) {
  const sizing = calculate1PercentSizing(params);
  const riskPerShare = params.entryPrice - params.stopLoss;
  const target1 = params.target1 ?? Number((params.entryPrice + 2.0 * riskPerShare).toFixed(2));
  const target2 = params.target2 ?? Number((params.entryPrice + 3.5 * riskPerShare).toFixed(2));

  const rrTarget1 = Number(((target1 - params.entryPrice) / riskPerShare).toFixed(2));
  const rrTarget2 = Number(((target2 - params.entryPrice) / riskPerShare).toFixed(2));

  const t1ScaleShares = Math.ceil(sizing.shares / 2);
  const t2RunnerShares = sizing.shares - t1ScaleShares;

  const t1RealizedProfit = Number((t1ScaleShares * (target1 - params.entryPrice)).toFixed(2));
  const t2RealizedProfit = Number((t2RunnerShares * (target2 - params.entryPrice)).toFixed(2));
  const totalCampaignProfit = Number((t1RealizedProfit + t2RealizedProfit).toFixed(2));

  return {
    ...sizing,
    target1,
    target2,
    rrTarget1,
    rrTarget2,
    t1ScaleShares,
    t2RunnerShares,
    t1RealizedProfit,
    t2RealizedProfit,
    totalCampaignProfit,
  };
}

export interface SparklinePoint {
  index: number;
  equity: number;
  changeDollars: number;
  changePct: number;
}

export function generateEquitySparkline(
  startingBalance: number,
  pnlDeltas: number[]
): {
  points: SparklinePoint[];
  minEquity: number;
  maxEquity: number;
  netChange: number;
  isPositive: boolean;
} {
  let current = startingBalance;
  const points: SparklinePoint[] = [
    { index: 0, equity: current, changeDollars: 0, changePct: 0 },
  ];

  let minEquity = current;
  let maxEquity = current;

  pnlDeltas.forEach((delta, i) => {
    current += delta;
    if (current < minEquity) minEquity = current;
    if (current > maxEquity) maxEquity = current;
    points.push({
      index: i + 1,
      equity: Number(current.toFixed(2)),
      changeDollars: Number((current - startingBalance).toFixed(2)),
      changePct: Number((((current - startingBalance) / startingBalance) * 100).toFixed(2)),
    });
  });

  const netChange = Number((current - startingBalance).toFixed(2));

  return {
    points,
    minEquity: Number(minEquity.toFixed(2)),
    maxEquity: Number(maxEquity.toFixed(2)),
    netChange,
    isPositive: netChange >= 0,
  };
}

describe("Tier 1 Feature Coverage: Portfolio Core & Sizing", () => {
  let storage: MockDualLayerStorage;
  let market: MockMarketEngine;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
    market = new MockMarketEngine();
  });

  // -------------------------------------------------------------
  // FEATURE 1: Portfolio Summary Card ($15k default, risk, P&L)
  // -------------------------------------------------------------
  describe("Feature 1: Portfolio Summary Card", () => {
    it("initializes with default $15,000 dedicated swing sleeve and zero open risk", () => {
      const settings = storage.getSettings();
      expect(settings.accountSize).toBe(15000.0);

      const summary = computePortfolioSummary(settings.accountSize, [], market.getAllQuotes());
      expect(summary.dedicatedCapital).toBe(15000.0);
      expect(summary.allocatedCapital).toBe(0.0);
      expect(summary.cashAvailable).toBe(15000.0);
      expect(summary.openRiskDollars).toBe(0.0);
      expect(summary.openRiskPct).toBe(0.0);
      expect(summary.floatingPnL).toBe(0.0);
      expect(summary.activePositionsCount).toBe(0);
    });

    it("calculates allocated capital and available cash when positions are active", () => {
      const trade1: StoredTrade = {
        id: "tr_atro",
        ticker: "ATRO",
        companyName: "Astronics Corp",
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
        sessionsElapsed: 1,
      };

      storage.addOrUpdateTrade(trade1);
      const quotes = { ATRO: { price: 88.5 } };
      const summary = computePortfolioSummary(15000.0, storage.getTrades(), quotes);

      // Allocated: 18 shares * $88.50 = $1,593.00
      expect(summary.allocatedCapital).toBe(1593.0);
      expect(summary.cashAvailable).toBe(13407.0);
      expect(summary.activePositionsCount).toBe(1);
    });

    it("computes open risk dollars and percentage against dedicated capital", () => {
      const trade1: StoredTrade = {
        id: "tr_atro",
        ticker: "ATRO",
        companyName: "Astronics Corp",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75, // $4.75 risk per share
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        rrRatio: 2.13,
        timeStopSessions: 5,
        sessionsElapsed: 1,
      };

      storage.addOrUpdateTrade(trade1);
      const summary = computePortfolioSummary(15000.0, storage.getTrades(), { ATRO: { price: 88.5 } });

      // Open risk = 18 * ($88.50 - $83.75) = 18 * $4.75 = $85.50
      expect(summary.openRiskDollars).toBe(85.5);
      // Risk % = (85.50 / 15000) * 100 = 0.57%
      expect(summary.openRiskPct).toBe(0.57);
    });

    it("tracks floating unrealized P&L in real-time as market quotes change", () => {
      const trade1: StoredTrade = {
        id: "tr_atro",
        ticker: "ATRO",
        companyName: "Astronics Corp",
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

      storage.addOrUpdateTrade(trade1);
      // Price increases from 88.50 to 92.50 (+4.00 per share)
      const quotes = { ATRO: { price: 92.5 } };
      const summary = computePortfolioSummary(15000.0, storage.getTrades(), quotes);

      // Floating P&L = 18 * ($92.50 - $88.50) = 18 * 4.00 = +$72.00
      expect(summary.floatingPnL).toBe(72.0);
      expect(summary.floatingPnLPct).toBe(0.48);
    });

    it("eliminates open risk on scaled positions when stop is moved to breakeven", () => {
      const scaledTrade: StoredTrade = {
        id: "tr_glbe",
        ticker: "GLBE",
        companyName: "Global-e Online",
        status: "SCALED_T1",
        entryTrigger: 42.6,
        actualEntry: 42.6,
        sharesTotal: 41,
        sharesRemaining: 21,
        initialStop: 40.2,
        currentStop: 42.6, // Stop raised to Breakeven!
        target1: 48.0,
        target2: 52.0,
        rrRatio: 2.25,
        timeStopSessions: 7,
        sessionsElapsed: 4,
        realizedPnL: 113.4,
      };

      storage.addOrUpdateTrade(scaledTrade);
      const summary = computePortfolioSummary(15000.0, storage.getTrades(), { GLBE: { price: 46.0 } });

      // Because currentStop == actualEntry (42.60), open risk is $0.00
      expect(summary.openRiskDollars).toBe(0.0);
      expect(summary.openRiskPct).toBe(0.0);
      // Floating P&L on remaining 21 shares at $46.00 = 21 * (46.00 - 42.60) = 21 * 3.40 = $71.40
      expect(summary.floatingPnL).toBe(71.4);
    });

    it("aggregates multiple active and scaled trades correctly into single dashboard view", () => {
      const trade1: StoredTrade = {
        id: "tr_1",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75, // $4.75 risk * 18 = $85.50
        currentStop: 83.75,
        target1: 100.0,
        target2: 112.0,
        rrRatio: 2.13,
        timeStopSessions: 5,
        sessionsElapsed: 1,
      };

      const trade2: StoredTrade = {
        id: "tr_2",
        ticker: "MTRN",
        companyName: "Materion",
        status: "ACTIVE",
        entryTrigger: 282.0,
        actualEntry: 282.0,
        sharesTotal: 8,
        sharesRemaining: 8,
        initialStop: 270.5, // $11.50 risk * 8 = $92.00
        currentStop: 270.5,
        target1: 305.0,
        target2: 328.0,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 1,
      };

      storage.addOrUpdateTrade(trade1);
      storage.addOrUpdateTrade(trade2);

      const quotes = {
        ATRO: { price: 90.0 }, // +1.50 * 18 = +$27.00
        MTRN: { price: 280.0 }, // -2.00 * 8 = -$16.00
      };

      const summary = computePortfolioSummary(15000.0, storage.getTrades(), quotes);
      expect(summary.activePositionsCount).toBe(2);
      expect(summary.openRiskDollars).toBe(177.5); // 85.50 + 92.00
      expect(summary.openRiskPct).toBe(1.18);
      expect(summary.floatingPnL).toBe(11.0); // +27 - 16
    });
  });

  // -------------------------------------------------------------
  // FEATURE 2: Interactive Equity Sparklines
  // -------------------------------------------------------------
  describe("Feature 2: Interactive Equity Sparklines", () => {
    it("generates an initial baseline sparkline with single starting point", () => {
      const sparkline = generateEquitySparkline(15000.0, []);
      expect(sparkline.points).toHaveLength(1);
      expect(sparkline.points[0].equity).toBe(15000.0);
      expect(sparkline.netChange).toBe(0.0);
      expect(sparkline.isPositive).toBe(true);
    });

    it("tracks upward trajectory and positive color indicator on winning trade sequence", () => {
      const deltas = [104.4, 98.2, 120.0];
      const sparkline = generateEquitySparkline(15000.0, deltas);

      expect(sparkline.points).toHaveLength(4);
      expect(sparkline.points[3].equity).toBe(15322.6);
      expect(sparkline.netChange).toBe(322.6);
      expect(sparkline.isPositive).toBe(true);
      expect(sparkline.maxEquity).toBe(15322.6);
      expect(sparkline.minEquity).toBe(15000.0);
    });

    it("tracks downward drawdown and negative color indicator on losing trade sequence", () => {
      const deltas = [-100.0, -85.5, -92.0];
      const sparkline = generateEquitySparkline(15000.0, deltas);

      expect(sparkline.points).toHaveLength(4);
      expect(sparkline.points[3].equity).toBe(14722.5);
      expect(sparkline.netChange).toBe(-277.5);
      expect(sparkline.isPositive).toBe(false);
      expect(sparkline.minEquity).toBe(14722.5);
    });

    it("accurately computes percentage returns relative to starting capital", () => {
      const deltas = [150.0]; // +1% on 15,000
      const sparkline = generateEquitySparkline(15000.0, deltas);

      expect(sparkline.points[1].changePct).toBe(1.0);
      expect(sparkline.points[1].changeDollars).toBe(150.0);
    });

    it("handles volatile multi-campaign swings with both peaks and troughs", () => {
      const deltas = [200.0, -150.0, 350.0, -50.0, 100.0];
      const sparkline = generateEquitySparkline(15000.0, deltas);

      expect(sparkline.points).toHaveLength(6);
      expect(sparkline.maxEquity).toBe(15450.0); // 15000 + 200 - 150 + 350 - 50 + 100 = 15450
      expect(sparkline.minEquity).toBe(15000.0);
      expect(sparkline.netChange).toBe(450.0);
      expect(sparkline.isPositive).toBe(true);
    });

    it("verifies sparkline coordinates remain finite and bounded for zero balance change", () => {
      const deltas = [0, 0, 0];
      const sparkline = generateEquitySparkline(15000.0, deltas);
      expect(sparkline.minEquity).toBe(15000.0);
      expect(sparkline.maxEquity).toBe(15000.0);
      expect(sparkline.netChange).toBe(0.0);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 6: 1% Account Risk Auto-Sizer ($15k / $150)
  // -------------------------------------------------------------
  describe("Feature 6: 1% Account Risk Auto-Sizer", () => {
    it("allocates exactly $150 risk on $15,000 default dedicated capital", () => {
      // Entry $89.20, Stop $83.75 -> $5.45 risk per share
      // $150 / 5.45 = 27.52 -> floor = 27 shares
      const result = calculate1PercentSizing({
        accountSize: 15000.0,
        riskPct: 1.0,
        entryPrice: 89.2,
        stopLoss: 83.75,
      });

      expect(result.riskBudget).toBe(150.0);
      expect(result.riskPerShare).toBe(5.45);
      expect(result.shares).toBe(27);
      expect(result.dollarRisk).toBe(147.15); // 27 * 5.45
      expect(result.dollarRisk).toBeLessThanOrEqual(150.0);
      expect(result.actualRiskPct).toBeLessThanOrEqual(1.0);
    });

    it("adjusts share count proportionally when account capital changes", () => {
      // $10,000 account -> $100 risk budget
      const result10k = calculate1PercentSizing({
        accountSize: 10000.0,
        entryPrice: 89.2,
        stopLoss: 83.75,
      });
      // 100 / 5.45 = 18.34 -> 18 shares
      expect(result10k.shares).toBe(18);
      expect(result10k.dollarRisk).toBe(98.1);

      // $25,000 account -> $250 risk budget
      const result25k = calculate1PercentSizing({
        accountSize: 25000.0,
        entryPrice: 89.2,
        stopLoss: 83.75,
      });
      // 250 / 5.45 = 45.87 -> 45 shares
      expect(result25k.shares).toBe(45);
      expect(result25k.dollarRisk).toBe(245.25);
    });

    it("handles tight stop loss setups with higher share counts", () => {
      // Entry $42.60, Stop $40.20 -> $2.40 risk per share
      // $150 / 2.40 = 62.5 -> 62 shares
      const result = calculate1PercentSizing({
        accountSize: 15000.0,
        entryPrice: 42.6,
        stopLoss: 40.2,
      });

      expect(result.riskPerShare).toBe(2.4);
      expect(result.shares).toBe(62);
      expect(result.dollarRisk).toBe(148.8);
      expect(result.allocatedCapital).toBe(2641.2);
    });

    it("handles wide stop loss or high dollar stocks while enforcing minimum 1 share", () => {
      // Entry $951.00, Stop $898.50 -> $52.50 risk per share
      // $150 / 52.50 = 2.85 -> 2 shares
      const result = calculate1PercentSizing({
        accountSize: 15000.0,
        entryPrice: 951.0,
        stopLoss: 898.5,
      });

      expect(result.shares).toBe(2);
      expect(result.dollarRisk).toBe(105.0);
    });

    it("throws a descriptive error if entry price is less than or equal to stop loss", () => {
      expect(() => {
        calculate1PercentSizing({
          accountSize: 15000.0,
          entryPrice: 80.0,
          stopLoss: 85.0, // Invalid stop above entry for long swing
        });
      }).toThrow("entryPrice must be strictly greater than stopLoss");
    });

    it("throws if prices are non-positive", () => {
      expect(() => {
        calculate1PercentSizing({
          accountSize: 15000.0,
          entryPrice: 0,
          stopLoss: -10,
        });
      }).toThrow("Invalid price parameters");
    });
  });

  // -------------------------------------------------------------
  // FEATURE 29: Interactive Sizing Sandbox Calculator
  // -------------------------------------------------------------
  describe("Feature 29: Interactive Sizing Sandbox Calculator", () => {
    it("automatically derives Target 1 at 2.0:1 R:R and Target 2 at 3.5:1 R:R", () => {
      // Entry $100.00, Stop $90.00 -> $10 risk
      // T1 = 100 + 2 * 10 = $120.00
      // T2 = 100 + 3.5 * 10 = $135.00
      const scenario = calculateSandboxScenario({
        accountSize: 15000.0,
        riskPct: 1.0,
        entryPrice: 100.0,
        stopLoss: 90.0,
      });

      expect(scenario.shares).toBe(15); // 150 / 10 = 15
      expect(scenario.target1).toBe(120.0);
      expect(scenario.target2).toBe(135.0);
      expect(scenario.rrTarget1).toBe(2.0);
      expect(scenario.rrTarget2).toBe(3.5);
    });

    it("splits position into 50% scale at T1 and 50% runner at T2", () => {
      const scenario = calculateSandboxScenario({
        accountSize: 15000.0,
        riskPct: 1.0,
        entryPrice: 100.0,
        stopLoss: 90.0,
      });

      // 15 total shares -> 8 scale at T1, 7 runner at T2
      expect(scenario.t1ScaleShares).toBe(8);
      expect(scenario.t2RunnerShares).toBe(7);
      expect(scenario.t1ScaleShares + scenario.t2RunnerShares).toBe(15);
    });

    it("projects exact realized campaign profits across both execution tiers", () => {
      const scenario = calculateSandboxScenario({
        accountSize: 15000.0,
        riskPct: 1.0,
        entryPrice: 100.0,
        stopLoss: 90.0,
      });

      // T1 gain = 8 shares * ($120 - $100) = $160.00
      expect(scenario.t1RealizedProfit).toBe(160.0);
      // T2 gain = 7 shares * ($135 - $100) = $245.00
      expect(scenario.t2RealizedProfit).toBe(245.0);
      // Total campaign profit = $160 + $245 = $405.00
      expect(scenario.totalCampaignProfit).toBe(405.0);
    });

    it("supports custom manual Target 1 and Target 2 price levels", () => {
      const scenario = calculateSandboxScenario({
        accountSize: 15000.0,
        riskPct: 1.0,
        entryPrice: 88.5,
        stopLoss: 83.75, // $4.75 risk
        target1: 100.1, // Custom T1
        target2: 112.0, // Custom T2
      });

      // R:R T1 = (100.10 - 88.50) / 4.75 = 11.60 / 4.75 = 2.44
      expect(scenario.rrTarget1).toBe(2.44);
      // R:R T2 = (112.00 - 88.50) / 4.75 = 23.50 / 4.75 = 4.95
      expect(scenario.rrTarget2).toBe(4.95);
      expect(scenario.totalCampaignProfit).toBeGreaterThan(0);
    });

    it("calculates total allocated capital correctly for the sandbox order", () => {
      const scenario = calculateSandboxScenario({
        accountSize: 15000.0,
        riskPct: 1.0,
        entryPrice: 282.0,
        stopLoss: 270.5, // $11.50 risk -> 150 / 11.50 = 13.04 -> 13 shares
      });

      expect(scenario.shares).toBe(13);
      expect(scenario.allocatedCapital).toBe(3666.0); // 13 * 282
      expect(scenario.dollarRisk).toBe(149.5);
    });
  });
});
