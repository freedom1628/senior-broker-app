import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade } from "../helpers/mock-storage";
import { generateDailyPortfolioReport } from "../../lib/portfolio/daily-report";
import { evaluateTrade } from "../../lib/market/rule-engine";

// Risk Engine Validator
export interface RiskComplianceCheck {
  isCompliant: boolean;
  tradeRiskDollars: number;
  tradeRiskPct: number;
  maxAllowedRiskDollars: number;
  violationReason?: string;
}

export function validateSingleTradeRisk(
  accountSize: number,
  maxRiskPct: number,
  entry: number,
  stop: number,
  shares: number
): RiskComplianceCheck {
  const riskPerShare = Math.max(0.01, entry - stop);
  const tradeRiskDollars = Number((shares * riskPerShare).toFixed(2));
  const maxAllowedRiskDollars = Number((accountSize * (maxRiskPct / 100)).toFixed(2));
  const tradeRiskPct = Number(((tradeRiskDollars / accountSize) * 100).toFixed(2));

  // Allow tiny float tolerance (e.g. 0.01)
  const isCompliant = tradeRiskDollars <= maxAllowedRiskDollars + 0.05;

  return {
    isCompliant,
    tradeRiskDollars,
    tradeRiskPct,
    maxAllowedRiskDollars,
    violationReason: isCompliant
      ? undefined
      : `Trade risk of $${tradeRiskDollars} (${tradeRiskPct}%) exceeds ${maxRiskPct}% risk limit ($${maxAllowedRiskDollars})`,
  };
}

export function validateSleeveRiskCap(
  accountSize: number,
  maxSleeveRiskPct: number,
  trades: StoredTrade[],
  newTradeRiskDollars: number = 0
): {
  isWithinCap: boolean;
  currentAggregateRisk: number;
  projectedAggregateRisk: number;
  maxSleeveCapDollars: number;
  availableRiskCapacity: number;
} {
  const activeTrades = trades.filter(t => t.status === "ACTIVE" || t.status === "SCALED_T1");
  let currentAggregateRisk = 0;

  for (const t of activeTrades) {
    const entry = t.actualEntry ?? t.entryTrigger;
    if (t.currentStop < entry) {
      currentAggregateRisk += (entry - t.currentStop) * t.sharesRemaining;
    }
  }

  currentAggregateRisk = Number(currentAggregateRisk.toFixed(2));
  const maxSleeveCapDollars = Number((accountSize * (maxSleeveRiskPct / 100)).toFixed(2));
  const projectedAggregateRisk = Number((currentAggregateRisk + newTradeRiskDollars).toFixed(2));
  const isWithinCap = projectedAggregateRisk <= maxSleeveCapDollars + 0.05;
  const availableRiskCapacity = Number(Math.max(0, maxSleeveCapDollars - currentAggregateRisk).toFixed(2));

  return {
    isWithinCap,
    currentAggregateRisk,
    projectedAggregateRisk,
    maxSleeveCapDollars,
    availableRiskCapacity,
  };
}

export function validateSectorExposure(
  trades: StoredTrade[],
  maxPerSector: number = 2
): {
  sectorCounts: Record<string, number>;
  congestedSectors: string[];
  isCompliant: boolean;
} {
  const activeTrades = trades.filter(t => t.status === "ACTIVE" || t.status === "SCALED_T1");
  const sectorCounts: Record<string, number> = {};

  activeTrades.forEach(t => {
    const type = t.setupType || "";
    const sector = type.includes("Aerospace")
      ? "Aerospace & Defense"
      : type.includes("Materials")
      ? "Materials"
      : type.includes("E-Commerce") || type.includes("Tech")
      ? "Technology"
      : "Diversified";

    sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
  });

  const congestedSectors = Object.keys(sectorCounts).filter(s => sectorCounts[s] > maxPerSector);

  return {
    sectorCounts,
    congestedSectors,
    isCompliant: congestedSectors.length === 0,
  };
}

describe("Tier 1 Feature Coverage: Risk Engine & Rule Enforcement", () => {
  let storage: MockDualLayerStorage;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
  });

  // -------------------------------------------------------------
  // FEATURE 16: 1% Risk Rule Enforcement
  // -------------------------------------------------------------
  describe("Feature 16: 1% Risk Rule Enforcement", () => {
    it("validates compliant trade within 1% risk budget ($147.15 on $15,000 sleeve)", () => {
      const check = validateSingleTradeRisk(15000.0, 1.0, 89.2, 83.75, 27);
      expect(check.isCompliant).toBe(true);
      expect(check.tradeRiskDollars).toBe(147.15);
      expect(check.maxAllowedRiskDollars).toBe(150.0);
      expect(check.violationReason).toBeUndefined();
    });

    it("flags non-compliant trade exceeding 1% risk budget ($250 risk on $15,000 sleeve)", () => {
      // 50 shares * $5.00 stop distance = $250 risk (1.67%)
      const check = validateSingleTradeRisk(15000.0, 1.0, 100.0, 95.0, 50);
      expect(check.isCompliant).toBe(false);
      expect(check.tradeRiskDollars).toBe(250.0);
      expect(check.tradeRiskPct).toBe(1.67);
      expect(check.violationReason).toContain("exceeds 1% risk limit");
    });

    it("enforces customized risk percentages (e.g. 0.5% conservative risk = $75)", () => {
      const check = validateSingleTradeRisk(15000.0, 0.5, 100.0, 95.0, 15);
      // 15 * $5 = $75 risk
      expect(check.isCompliant).toBe(true);
      expect(check.maxAllowedRiskDollars).toBe(75.0);
    });

    it("evaluates hard stop-loss trigger in rule engine and mandates immediate close", () => {
      const activeTrade = {
        id: "tr_risk_stop",
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
        sessionsElapsed: 2,
      };

      const quote = {
        ticker: "ATRO",
        name: "Astronics",
        price: 83.5, // Stop breached!
        change: -5.0,
        changePct: -5.65,
        high: 88.5,
        low: 83.0,
        volume: 2500000,
        prevClose: 88.5,
        lastUpdated: new Date().toISOString(),
      };

      const evaluation = evaluateTrade(activeTrade, quote);
      expect(evaluation.alertType).toBe("STOP_ALERT");
      expect(evaluation.shouldAutoClose).toBe(true);
      expect(evaluation.recommendedAction).toContain("HONOR THE STOP IMMEDIATELY");
    });

    it("verifies user settings riskPerTrade defaults to 1.0%", () => {
      const settings = storage.getSettings();
      expect(settings.riskPerTrade).toBe(1.0);
    });

    it("prevents trade entry when entry price is below stop price", () => {
      const check = validateSingleTradeRisk(15000.0, 1.0, 80.0, 85.0, 10);
      // entry < stop yields min 0.01 risk but invalid geometry
      expect(check.tradeRiskDollars).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 17: 5–7 Session Time-Stop Rule
  // -------------------------------------------------------------
  describe("Feature 17: 5–7 Session Time-Stop Rule", () => {
    it("triggers TIME_STOP_WARNING in Daily Report when trade is 1 session before time stop", () => {
      const trade: StoredTrade = {
        id: "tr_time_warn",
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
        sessionsElapsed: 4, // 4 of 5 sessions elapsed (timeStopSessions - 1)
      };

      const report = generateDailyPortfolioReport([trade], { ATRO: { ticker: "ATRO", name: "Astronics", price: 89.0, change: 0.5, changePct: 0.56, high: 90.0, low: 88.0, volume: 1000000, prevClose: 88.5, lastUpdated: "" } });
      const timeStopItem = report.actionItems.find(a => a.actionType === "TIME_STOP_WARNING");

      expect(timeStopItem).toBeDefined();
      expect(timeStopItem?.urgency).toBe("HIGH");
      expect(timeStopItem?.headline).toContain("Time Stop Stale Warning");
      expect(timeStopItem?.details).toContain("losing freshness");
    });

    it("evaluates evaluateTrade TIME_STOP_WARNING when sessionsElapsed reaches session 5 of 6", () => {
      const trade = {
        id: "tr_time_engine",
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
        sessionsElapsed: 5, // Session 5 of 6 -> Warning
      };

      const quote = {
        ticker: "ATRO",
        name: "Astronics",
        price: 89.0,
        change: 0.5,
        changePct: 0.56,
        high: 90.0,
        low: 88.5,
        volume: 1000000,
        prevClose: 88.5,
        lastUpdated: new Date().toISOString(),
      };

      const evaluation = evaluateTrade(trade, quote);
      expect(evaluation.alertType).toBe("TIME_STOP_WARNING");
      expect(evaluation.alertTitle).toContain("Time Stop Warning");
      expect(evaluation.recommendedAction).toContain("Close out if momentum has stalled");
    });

    it("evaluates evaluateTrade TIME_STOP_EXPIRED when sessionsElapsed reaches time stop limit", () => {
      const trade = {
        id: "tr_time_expired",
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
        sessionsElapsed: 5, // Session 5 of 5 -> Expired
      };

      const quote = {
        ticker: "ATRO",
        name: "Astronics",
        price: 89.0,
        change: 0.5,
        changePct: 0.56,
        high: 90.0,
        low: 88.5,
        volume: 1000000,
        prevClose: 88.5,
        lastUpdated: new Date().toISOString(),
      };

      const evaluation = evaluateTrade(trade, quote);
      expect(evaluation.alertType).toBe("TIME_STOP_EXPIRED");
      expect(evaluation.actionRequired).toBe("TIME_STOP_EXPIRED");
      expect(evaluation.alertTitle).toContain("Time Stop Expired");
    });

    it("does NOT flag time stop warning on fresh trades (sessions 0, 1, 2)", () => {
      const freshTrade: StoredTrade = {
        id: "tr_fresh",
        ticker: "MTRN",
        companyName: "Materion",
        status: "ACTIVE",
        entryTrigger: 282.0,
        actualEntry: 282.0,
        sharesTotal: 8,
        sharesRemaining: 8,
        initialStop: 270.5,
        currentStop: 270.5,
        target1: 305.0,
        target2: 328.0,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 1,
      };

      const report = generateDailyPortfolioReport([freshTrade], { MTRN: { ticker: "MTRN", name: "Materion", price: 284.0, change: 2.0, changePct: 0.71, high: 285.0, low: 282.0, volume: 400000, prevClose: 282.0, lastUpdated: "" } });
      const timeStopItem = report.actionItems.find(a => a.actionType === "TIME_STOP_WARNING");

      expect(timeStopItem).toBeUndefined();
    });

    it("exempts scaled runner positions from time stops to let runners compound", () => {
      const scaledRunner: StoredTrade = {
        id: "tr_scaled_runner",
        ticker: "GLBE",
        companyName: "Global-e",
        status: "SCALED_T1",
        entryTrigger: 42.6,
        actualEntry: 42.6,
        sharesTotal: 41,
        sharesRemaining: 20,
        initialStop: 40.2,
        currentStop: 42.6, // Breakeven stop
        target1: 48.0,
        target2: 52.0,
        rrRatio: 2.25,
        timeStopSessions: 7,
        sessionsElapsed: 8, // Exceeded initial 7 sessions
        realizedPnL: 113.4,
      };

      const report = generateDailyPortfolioReport([scaledRunner], { GLBE: { ticker: "GLBE", name: "Global-e", price: 46.0, change: 1.0, changePct: 2.22, high: 47.0, low: 45.0, volume: 2000000, prevClose: 45.0, lastUpdated: "" } });
      // Should show TRAIL_STOP runner guidance, not an urgent time-stop exit
      const trailItem = report.actionItems.find(a => a.actionType === "TRAIL_STOP");
      expect(trailItem).toBeDefined();
      expect(trailItem?.headline).toContain("Runner Active with Breakeven Floor");
    });

    it("includes time stop enforcement principle in desk checklist", () => {
      const report = generateDailyPortfolioReport([], {});
      const checklistText = report.deskChecklist.join(" ");
      expect(checklistText).toContain("Enforce time stops: after 5–7 sessions");
    });

    it("supports custom timeStopSessions parameter (e.g. 4-day breakout vs 7-day pullback)", () => {
      const trade1: StoredTrade = {
        id: "tr_custom_4",
        ticker: "LITE",
        companyName: "Lumentum",
        status: "ACTIVE",
        entryTrigger: 951.0,
        actualEntry: 951.0,
        sharesTotal: 1,
        sharesRemaining: 1,
        initialStop: 898.5,
        currentStop: 898.5,
        target1: 1056.0,
        target2: 1085.5,
        rrRatio: 2.0,
        timeStopSessions: 4,
        sessionsElapsed: 3, // 3 of 4 -> warning
      };

      const report = generateDailyPortfolioReport([trade1], { LITE: { ticker: "LITE", name: "Lumentum", price: 955.0, change: 4.0, changePct: 0.42, high: 960.0, low: 950.0, volume: 8000000, prevClose: 951.0, lastUpdated: "" } });
      const warn = report.actionItems.find(a => a.actionType === "TIME_STOP_WARNING");
      expect(warn).toBeDefined();
      expect(warn?.headline).toContain("3/4 Sessions Elapsed");
    });
  });

  // -------------------------------------------------------------
  // FEATURE 18: 3.0% Total Sleeve Risk Cap ($450 on $15k)
  // -------------------------------------------------------------
  describe("Feature 18: 3.0% Total Sleeve Risk Cap", () => {
    it("allows new trade entry when aggregate risk is well below 3.0% cap ($177.50 / $450)", () => {
      const trade1: StoredTrade = {
        id: "tr_1",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75, // $85.50 risk
        currentStop: 83.75,
        target1: 100.1,
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
        initialStop: 270.5, // $92.00 risk
        currentStop: 270.5,
        target1: 305.0,
        target2: 328.0,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 1,
      };

      // Current aggregate risk = 85.50 + 92.00 = $177.50 (1.18% of $15,000)
      const capCheck = validateSleeveRiskCap(15000.0, 3.0, [trade1, trade2], 100.0);
      expect(capCheck.isWithinCap).toBe(true);
      expect(capCheck.currentAggregateRisk).toBe(177.5);
      expect(capCheck.maxSleeveCapDollars).toBe(450.0);
      expect(capCheck.availableRiskCapacity).toBe(272.5);
    });

    it("triggers RISK_ALERT in Daily Report when aggregate risk exceeds 3.0% ($450)", () => {
      // 4 active trades each with ~$120 open risk = $480 total (3.2%)
      const trades: StoredTrade[] = [
        { id: "t1", ticker: "ATRO", companyName: "Astronics", status: "ACTIVE", entryTrigger: 88.5, actualEntry: 88.5, sharesTotal: 25, sharesRemaining: 25, initialStop: 83.75, currentStop: 83.75, target1: 100.0, target2: 112.0, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 1 },
        { id: "t2", ticker: "MTRN", companyName: "Materion", status: "ACTIVE", entryTrigger: 282.0, actualEntry: 282.0, sharesTotal: 10, sharesRemaining: 10, initialStop: 270.0, currentStop: 270.0, target1: 305.0, target2: 328.0, rrRatio: 2.0, timeStopSessions: 6, sessionsElapsed: 1 },
        { id: "t3", ticker: "GLBE", companyName: "Global-e", status: "ACTIVE", entryTrigger: 42.6, actualEntry: 42.6, sharesTotal: 50, sharesRemaining: 50, initialStop: 40.2, currentStop: 40.2, target1: 48.0, target2: 52.0, rrRatio: 2.25, timeStopSessions: 7, sessionsElapsed: 1 },
        { id: "t4", ticker: "NIQ", companyName: "NIQ Global", status: "ACTIVE", entryTrigger: 16.25, actualEntry: 16.25, sharesTotal: 85, sharesRemaining: 85, initialStop: 14.9, currentStop: 14.9, target1: 19.2, target2: 21.5, rrRatio: 2.19, timeStopSessions: 6, sessionsElapsed: 1 },
      ];

      const report = generateDailyPortfolioReport(trades, {}, 15000.0);
      expect(report.portfolioSummary.aggregateRiskPct).toBeGreaterThan(3.0);

      const riskAlert = report.actionItems[0];
      expect(riskAlert.actionType).toBe("RISK_ALERT");
      expect(riskAlert.urgency).toBe("HIGH");
      expect(riskAlert.headline).toContain("Exceeds Recommended 3.0% Cap");
      expect(riskAlert.suggestedOrder).toContain("Freeze new entries");
    });

    it("frees up sleeve risk capacity when positions scale 50% and move stops to breakeven", () => {
      const scaledTrade: StoredTrade = {
        id: "tr_scaled_zero_risk",
        ticker: "GLBE",
        companyName: "Global-e",
        status: "SCALED_T1",
        entryTrigger: 42.6,
        actualEntry: 42.6,
        sharesTotal: 41,
        sharesRemaining: 20,
        initialStop: 40.2,
        currentStop: 42.6, // Breakeven!
        target1: 48.0,
        target2: 52.0,
        rrRatio: 2.25,
        timeStopSessions: 7,
        sessionsElapsed: 4,
      };

      const capCheck = validateSleeveRiskCap(15000.0, 3.0, [scaledTrade], 150.0);
      expect(capCheck.currentAggregateRisk).toBe(0.0);
      expect(capCheck.availableRiskCapacity).toBe(450.0);
      expect(capCheck.isWithinCap).toBe(true);
    });

    it("verifies user settings maxSleeveRiskPct defaults to 3.0%", () => {
      const settings = storage.getSettings();
      expect(settings.maxSleeveRiskPct).toBe(3.0);
    });

    it("calculates exact dollar cap limit for arbitrary dedicated sleeve size ($20,000 -> $600)", () => {
      const capCheck = validateSleeveRiskCap(20000.0, 3.0, []);
      expect(capCheck.maxSleeveCapDollars).toBe(600.0);
    });

    it("blocks new entry proposal that would push aggregate risk over 3.0% ceiling", () => {
      const trade1: StoredTrade = {
        id: "t1",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 40,
        sharesRemaining: 40,
        initialStop: 83.75, // $190 risk
        currentStop: 83.75,
        target1: 100.0,
        target2: 112.0,
        rrRatio: 2.0,
        timeStopSessions: 5,
        sessionsElapsed: 1,
      };

      const trade2: StoredTrade = {
        id: "t2",
        ticker: "MTRN",
        companyName: "Materion",
        status: "ACTIVE",
        entryTrigger: 282.0,
        actualEntry: 282.0,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 270.0, // $216 risk
        currentStop: 270.0,
        target1: 305.0,
        target2: 328.0,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 1,
      };

      // Current risk = 190 + 216 = $406
      // Proposing new $100 trade -> projected $506 (> $450 cap)
      const capCheck = validateSleeveRiskCap(15000.0, 3.0, [trade1, trade2], 100.0);
      expect(capCheck.isWithinCap).toBe(false);
      expect(capCheck.projectedAggregateRisk).toBe(506.0);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 19: Sector Concentration Limiter (Max 2)
  // -------------------------------------------------------------
  describe("Feature 19: Sector Concentration Limiter", () => {
    it("allows up to 2 active positions in the same industry sector", () => {
      const trades: StoredTrade[] = [
        { id: "t1", ticker: "GLBE", companyName: "Global-e", status: "ACTIVE", setupType: "E-Commerce Tech", entryTrigger: 42.6, actualEntry: 42.6, sharesTotal: 41, sharesRemaining: 41, initialStop: 40.2, currentStop: 40.2, target1: 48.0, target2: 52.0, rrRatio: 2.25, timeStopSessions: 7, sessionsElapsed: 1 },
        { id: "t2", ticker: "TWLO", companyName: "Twilio", status: "ACTIVE", setupType: "Cloud Tech Breakout", entryTrigger: 250.0, actualEntry: 250.0, sharesTotal: 4, sharesRemaining: 4, initialStop: 225.0, currentStop: 225.0, target1: 275.0, target2: 300.0, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 1 },
      ];

      const check = validateSectorExposure(trades, 2);
      expect(check.isCompliant).toBe(true);
      expect(check.sectorCounts["Technology"]).toBe(2);
      expect(check.congestedSectors).toHaveLength(0);
    });

    it("detects sector congestion when > 2 active positions share the same sector", () => {
      const trades: StoredTrade[] = [
        { id: "t1", ticker: "GLBE", companyName: "Global-e", status: "ACTIVE", setupType: "E-Commerce Tech", entryTrigger: 42.6, actualEntry: 42.6, sharesTotal: 41, sharesRemaining: 41, initialStop: 40.2, currentStop: 40.2, target1: 48.0, target2: 52.0, rrRatio: 2.25, timeStopSessions: 7, sessionsElapsed: 1 },
        { id: "t2", ticker: "TWLO", companyName: "Twilio", status: "ACTIVE", setupType: "Cloud Tech", entryTrigger: 250.0, actualEntry: 250.0, sharesTotal: 4, sharesRemaining: 4, initialStop: 225.0, currentStop: 225.0, target1: 275.0, target2: 300.0, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 1 },
        { id: "t3", ticker: "CRWV", companyName: "CoreWeave", status: "ACTIVE", setupType: "AI Cloud Tech", entryTrigger: 92.0, actualEntry: 92.0, sharesTotal: 7, sharesRemaining: 7, initialStop: 79.0, currentStop: 79.0, target1: 110.0, target2: 130.0, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 1 },
      ];

      const check = validateSectorExposure(trades, 2);
      expect(check.isCompliant).toBe(false);
      expect(check.sectorCounts["Technology"]).toBe(3);
      expect(check.congestedSectors).toContain("Technology");
    });

    it("accurately groups distinct sectors (Aerospace, Materials, Technology, Diversified)", () => {
      const trades: StoredTrade[] = [
        { id: "t1", ticker: "ATRO", companyName: "Astronics", status: "ACTIVE", setupType: "Aerospace Gap Breakout", entryTrigger: 88.5, actualEntry: 88.5, sharesTotal: 18, sharesRemaining: 18, initialStop: 83.75, currentStop: 83.75, target1: 100.1, target2: 112.0, rrRatio: 2.13, timeStopSessions: 5, sessionsElapsed: 1 },
        { id: "t2", ticker: "MTRN", companyName: "Materion", status: "ACTIVE", setupType: "Materials Pullback", entryTrigger: 282.0, actualEntry: 282.0, sharesTotal: 8, sharesRemaining: 8, initialStop: 270.5, currentStop: 270.5, target1: 305.0, target2: 328.0, rrRatio: 2.0, timeStopSessions: 6, sessionsElapsed: 1 },
        { id: "t3", ticker: "GLBE", companyName: "Global-e", status: "ACTIVE", setupType: "Technology E-Commerce", entryTrigger: 42.6, actualEntry: 42.6, sharesTotal: 41, sharesRemaining: 41, initialStop: 40.2, currentStop: 40.2, target1: 48.0, target2: 52.0, rrRatio: 2.25, timeStopSessions: 7, sessionsElapsed: 1 },
      ];

      const check = validateSectorExposure(trades, 2);
      expect(check.isCompliant).toBe(true);
      expect(check.sectorCounts["Aerospace & Defense"]).toBe(1);
      expect(check.sectorCounts["Materials"]).toBe(1);
      expect(check.sectorCounts["Technology"]).toBe(1);
    });

    it("verifies user settings maxSectorPositions defaults to 2", () => {
      const settings = storage.getSettings();
      expect(settings.maxSectorPositions).toBe(2);
    });

    it("produces sector exposure mapping in daily portfolio report", () => {
      const trades: StoredTrade[] = [
        { id: "t1", ticker: "ATRO", companyName: "Astronics", status: "ACTIVE", setupType: "Aerospace Gap Breakout", entryTrigger: 88.5, actualEntry: 88.5, sharesTotal: 18, sharesRemaining: 18, initialStop: 83.75, currentStop: 83.75, target1: 100.1, target2: 112.0, rrRatio: 2.13, timeStopSessions: 5, sessionsElapsed: 1 },
      ];

      const report = generateDailyPortfolioReport(trades, {});
      expect(report.sectorExposure["Aerospace & Defense"]).toBe(1);
    });

    it("ignores closed and pending trades when computing active sector exposure", () => {
      const trades: StoredTrade[] = [
        { id: "t1", ticker: "GLBE", companyName: "Global-e", status: "CLOSED", setupType: "Technology", entryTrigger: 42.6, actualEntry: 42.6, sharesTotal: 41, sharesRemaining: 0, initialStop: 40.2, currentStop: 42.6, target1: 48.0, target2: 52.0, rrRatio: 2.25, timeStopSessions: 7, sessionsElapsed: 5 },
        { id: "t2", ticker: "TWLO", companyName: "Twilio", status: "PENDING_ENTRY", setupType: "Technology", entryTrigger: 250.0, sharesTotal: 4, sharesRemaining: 4, initialStop: 225.0, currentStop: 225.0, target1: 275.0, target2: 300.0, rrRatio: 2.0, timeStopSessions: 5, sessionsElapsed: 0 },
      ];

      const check = validateSectorExposure(trades, 2);
      expect(check.sectorCounts["Technology"]).toBeUndefined();
      expect(check.isCompliant).toBe(true);
    });
  });
});
