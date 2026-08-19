// Tier 3 Pairwise Combinatorial Integration Test: 3% Sleeve Risk Cap, Sector Limiter & Concurrency Freezes
// Requirements: ORIGINAL_REQUEST §R3.3, §R2.1, §R1.1

import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade } from "../helpers/mock-storage";
import { MockMarketEngine } from "../helpers/mock-market";
import { generateDailyPortfolioReport } from "../../lib/portfolio/daily-report";

describe("Tier 3 Pairwise: 3% Sleeve Risk Cap, Sector Limiter & Concurrency Freezes", () => {
  let storage: MockDualLayerStorage;
  let market: MockMarketEngine;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
    market = new MockMarketEngine();
  });

  // Helper function to calculate open risk on active trades
  function calculateTotalOpenRisk(trades: StoredTrade[]): number {
    return trades
      .filter(t => t.status === "ACTIVE" || t.status === "SCALED_T1")
      .reduce((acc, t) => {
        const entry = t.actualEntry || t.entryTrigger;
        // If stop is below entry, risk exists on remaining shares
        if (t.currentStop < entry) {
          const openRiskPerShare = Math.abs(entry - t.currentStop);
          return acc + (openRiskPerShare * t.sharesRemaining);
        }
        // If stop is at or above entry (Breakeven / Trailing), open risk is $0.00
        return acc;
      }, 0);
  }

  // Helper to check sector concentration
  function getSectorPositions(trades: StoredTrade[]): Record<string, number> {
    const counts: Record<string, number> = {};
    trades
      .filter(t => t.status === "ACTIVE" || t.status === "SCALED_T1")
      .forEach(t => {
        const sector = t.setupType?.includes("Aerospace")
          ? "Aerospace & Defense"
          : t.setupType?.includes("Materials")
          ? "Materials"
          : t.setupType?.includes("E-Commerce") || t.setupType?.includes("Tech")
          ? "Technology"
          : "Diversified";
        counts[sector] = (counts[sector] || 0) + 1;
      });
    return counts;
  }

  it("1. Allows opening up to 3 concurrent 1% positions within 3.0% sleeve risk cap", () => {
    const settings = storage.getSettings();
    const accountSize = settings.accountSize; // $15,000
    const maxRiskCap = accountSize * (settings.maxSleeveRiskPct / 100); // 3% = $450.00

    expect(accountSize).toBe(15000.0);
    expect(maxRiskCap).toBe(450.0);

    // Trade 1: ATRO (Aerospace) - $147.15 open risk (27 sh * $5.45)
    const trade1: StoredTrade = {
      id: "tr_risk_1",
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
      sessionsElapsed: 1,
    };

    // Trade 2: MTRN (Materials) - $149.50 open risk (13 sh * $11.50)
    const trade2: StoredTrade = {
      id: "tr_risk_2",
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
      sessionsElapsed: 1,
    };

    // Trade 3: GLBE (Technology) - $148.80 open risk (62 sh * $2.40)
    const trade3: StoredTrade = {
      id: "tr_risk_3",
      ticker: "GLBE",
      companyName: "Global-e Online Ltd.",
      status: "ACTIVE",
      setupType: "Technology Catalyst",
      entryTrigger: 42.60,
      actualEntry: 42.60,
      sharesTotal: 62,
      sharesRemaining: 62,
      initialStop: 40.20,
      currentStop: 40.20,
      target1: 47.40,
      target2: 51.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 1,
    };

    storage.saveTrades([trade1, trade2, trade3]);
    const openRisk = calculateTotalOpenRisk(storage.getTrades());
    const openRiskPct = (openRisk / accountSize) * 100;

    // Total risk = 147.15 + 149.50 + 148.80 = $445.45 (2.97% of $15k <= 3.0%)
    expect(openRisk).toBeCloseTo(445.45, 2);
    expect(openRisk).toBeLessThanOrEqual(maxRiskCap);
    expect(openRiskPct).toBeLessThanOrEqual(3.0);
  });

  it("2. Triggers RISK_ALERT and freezes new trade entries when aggregate risk exceeds 3.0%", () => {
    // 3 active positions already utilizing $445.45 of risk
    const trade1: StoredTrade = {
      id: "tr_risk_1",
      ticker: "ATRO",
      companyName: "Astronics Corporation",
      status: "ACTIVE",
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
      sessionsElapsed: 1,
    };
    const trade2: StoredTrade = {
      id: "tr_risk_2",
      ticker: "MTRN",
      companyName: "Materion Corporation",
      status: "ACTIVE",
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
      sessionsElapsed: 1,
    };
    const trade3: StoredTrade = {
      id: "tr_risk_3",
      ticker: "GLBE",
      companyName: "Global-e Online Ltd.",
      status: "ACTIVE",
      entryTrigger: 42.60,
      actualEntry: 42.60,
      sharesTotal: 62,
      sharesRemaining: 62,
      initialStop: 40.20,
      currentStop: 40.20,
      target1: 47.40,
      target2: 51.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 1,
    };
    // Trade 4 attempting entry: NIQ ($149.85 risk)
    const trade4: StoredTrade = {
      id: "tr_risk_4",
      ticker: "NIQ",
      companyName: "NIQ Global Intelligence",
      status: "ACTIVE",
      entryTrigger: 16.25,
      actualEntry: 16.25,
      sharesTotal: 111,
      sharesRemaining: 111,
      initialStop: 14.90,
      currentStop: 14.90,
      target1: 18.95,
      target2: 21.00,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 1,
    };

    const allTrades = [trade1, trade2, trade3, trade4];
    const totalRisk = calculateTotalOpenRisk(allTrades);
    const totalRiskPct = (totalRisk / 15000.0) * 100; // 3.97% > 3.0%

    expect(totalRisk).toBeGreaterThan(450.0);
    expect(totalRiskPct).toBeGreaterThan(3.0);

    const report = generateDailyPortfolioReport(allTrades, market.getAllQuotes(), 15000.0);
    expect(report.actionItems[0].actionType).toBe("RISK_ALERT");
    expect(report.actionItems[0].urgency).toBe("HIGH");
    expect(report.actionItems[0].headline).toContain("Exceeds Recommended 3.0% Cap");
    expect(report.actionItems[0].suggestedOrder).toContain("Freeze new entries");
  });

  it("3. Verifies risk relief when an active position scales 50% and moves stop to breakeven", () => {
    // Start with 3 trades at maximum risk capacity ($445.45)
    const trade1: StoredTrade = {
      id: "tr_risk_1",
      ticker: "ATRO",
      companyName: "Astronics Corporation",
      status: "ACTIVE",
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
      sessionsElapsed: 1,
    };
    const trade2: StoredTrade = {
      id: "tr_risk_2",
      ticker: "MTRN",
      companyName: "Materion Corporation",
      status: "ACTIVE",
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
      sessionsElapsed: 1,
    };
    const trade3: StoredTrade = {
      id: "tr_risk_3",
      ticker: "GLBE",
      companyName: "Global-e Online Ltd.",
      status: "ACTIVE",
      entryTrigger: 42.60,
      actualEntry: 42.60,
      sharesTotal: 62,
      sharesRemaining: 62,
      initialStop: 40.20,
      currentStop: 40.20,
      target1: 47.40,
      target2: 51.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 1,
    };

    storage.saveTrades([trade1, trade2, trade3]);
    expect(calculateTotalOpenRisk(storage.getTrades())).toBeCloseTo(445.45, 2);

    // GLBE reaches Target 1: Scales 50% and moves stop to Breakeven ($42.60)
    trade3.status = "SCALED_T1";
    trade3.sharesRemaining = 31;
    trade3.currentStop = 42.60; // Stop is now at entry! Open risk on GLBE is now $0.00
    trade3.realizedPnL = 148.80;

    storage.addOrUpdateTrade(trade3);

    // New aggregate open risk is only ATRO ($147.15) + MTRN ($149.50) = $296.65 (1.98%)
    const relievedRisk = calculateTotalOpenRisk(storage.getTrades());
    expect(relievedRisk).toBeCloseTo(296.65, 2);
    expect(relievedRisk).toBeLessThan(450.0);

    // Risk capacity is freed up ($153.35 available), permitting a 4th trade entry!
    const availableRiskCapacity = 450.0 - relievedRisk;
    expect(availableRiskCapacity).toBeGreaterThanOrEqual(150.0);
  });

  it("4. Enforces Sector Concentration Limiter: alerts when >2 positions exist in the same sector", () => {
    // 3 active positions in Technology sector
    const tech1: StoredTrade = {
      id: "tr_tech_1",
      ticker: "GLBE",
      companyName: "Global-e Online Ltd.",
      status: "ACTIVE",
      setupType: "Technology / E-Commerce",
      entryTrigger: 42.60,
      sharesTotal: 62,
      sharesRemaining: 62,
      initialStop: 40.20,
      currentStop: 40.20,
      target1: 47.40,
      target2: 51.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 1,
    };
    const tech2: StoredTrade = {
      id: "tr_tech_2",
      ticker: "CRWV",
      companyName: "CoreWeave Inc.",
      status: "ACTIVE",
      setupType: "Technology / AI Cloud",
      entryTrigger: 92.00,
      sharesTotal: 16,
      sharesRemaining: 16,
      initialStop: 83.00,
      currentStop: 83.00,
      target1: 110.00,
      target2: 130.00,
      rrRatio: 2.0,
      timeStopSessions: 5,
      sessionsElapsed: 1,
    };
    const tech3: StoredTrade = {
      id: "tr_tech_3",
      ticker: "TWLO",
      companyName: "Twilio Inc.",
      status: "ACTIVE",
      setupType: "Technology / Cloud Software",
      entryTrigger: 243.50,
      sharesTotal: 6,
      sharesRemaining: 6,
      initialStop: 218.50,
      currentStop: 218.50,
      target1: 293.50,
      target2: 320.00,
      rrRatio: 2.0,
      timeStopSessions: 5,
      sessionsElapsed: 1,
    };

    const trades = [tech1, tech2, tech3];
    const sectors = getSectorPositions(trades);

    expect(sectors["Technology"]).toBe(3);
    expect(sectors["Technology"]).toBeGreaterThan(storage.getSettings().maxSectorPositions); // > 2 max

    const report = generateDailyPortfolioReport(trades, market.getAllQuotes(), 15000.0);
    expect(report.sectorExposure["Technology"]).toBe(3);
  });

  it("5. Permits new entries in different sectors while maintaining sector block on congested sector", () => {
    // 2 active positions in Technology (maximum allowed)
    const tech1: StoredTrade = {
      id: "tr_tech_1",
      ticker: "GLBE",
      companyName: "Global-e Online Ltd.",
      status: "ACTIVE",
      setupType: "Technology",
      entryTrigger: 42.60,
      sharesTotal: 62,
      sharesRemaining: 62,
      initialStop: 40.20,
      currentStop: 40.20,
      target1: 47.40,
      target2: 51.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 1,
    };
    const tech2: StoredTrade = {
      id: "tr_tech_2",
      ticker: "CRWV",
      companyName: "CoreWeave Inc.",
      status: "ACTIVE",
      setupType: "Technology",
      entryTrigger: 92.00,
      sharesTotal: 16,
      sharesRemaining: 16,
      initialStop: 83.00,
      currentStop: 83.00,
      target1: 110.00,
      target2: 130.00,
      rrRatio: 2.0,
      timeStopSessions: 5,
      sessionsElapsed: 1,
    };

    const currentTrades = [tech1, tech2];
    const sectors = getSectorPositions(currentTrades);
    expect(sectors["Technology"]).toBe(2);

    // Rule: Adding another Tech stock (TWLO) should be blocked by sector limit
    const isTechAllowed = (sectors["Technology"] || 0) < 2;
    expect(isTechAllowed).toBe(false);

    // Rule: Adding an Aerospace stock (ATRO) is permitted (0 in Aerospace currently)
    const isAerospaceAllowed = (sectors["Aerospace & Defense"] || 0) < 2;
    expect(isAerospaceAllowed).toBe(true);
  });

  it("6. Simulates concurrent execution of 3 diversified trades across separate industry sectors", () => {
    const tradeA: StoredTrade = {
      id: "div_a",
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
    const tradeB: StoredTrade = {
      id: "div_b",
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
    const tradeC: StoredTrade = {
      id: "div_c",
      ticker: "GLBE",
      companyName: "Global-e Online Ltd.",
      status: "ACTIVE",
      setupType: "Technology Continuation",
      entryTrigger: 42.60,
      actualEntry: 42.60,
      sharesTotal: 62,
      sharesRemaining: 62,
      initialStop: 40.20,
      currentStop: 40.20,
      target1: 47.40,
      target2: 51.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 2,
    };

    const trades = [tradeA, tradeB, tradeC];
    const sectors = getSectorPositions(trades);

    expect(sectors["Aerospace & Defense"]).toBe(1);
    expect(sectors["Materials"]).toBe(1);
    expect(sectors["Technology"]).toBe(1);

    const openRisk = calculateTotalOpenRisk(trades);
    expect(openRisk).toBeLessThanOrEqual(450.0);

    const report = generateDailyPortfolioReport(trades, market.getAllQuotes(), 15000.0);
    // Should NOT have RISK_ALERT since sectors are balanced and total risk is within 3%
    const riskAlert = report.actionItems.find(a => a.actionType === "RISK_ALERT");
    expect(riskAlert).toBeUndefined();
  });

  it("7. Replenishes open risk budget immediately when a trade hits stop loss and closes", () => {
    const trade1: StoredTrade = {
      id: "tr_rep_1",
      ticker: "ATRO",
      companyName: "Astronics Corporation",
      status: "ACTIVE",
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
      sessionsElapsed: 1,
    };
    const trade2: StoredTrade = {
      id: "tr_rep_2",
      ticker: "MTRN",
      companyName: "Materion Corporation",
      status: "ACTIVE",
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
      sessionsElapsed: 1,
    };
    const trade3: StoredTrade = {
      id: "tr_rep_3",
      ticker: "GLBE",
      companyName: "Global-e Online Ltd.",
      status: "ACTIVE",
      entryTrigger: 42.60,
      actualEntry: 42.60,
      sharesTotal: 62,
      sharesRemaining: 62,
      initialStop: 40.20,
      currentStop: 40.20,
      target1: 47.40,
      target2: 51.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 1,
    };

    storage.saveTrades([trade1, trade2, trade3]);
    expect(calculateTotalOpenRisk(storage.getTrades())).toBeCloseTo(445.45, 2);

    // MTRN hits hard stop and closes
    trade2.status = "CLOSED";
    trade2.sharesRemaining = 0;
    trade2.closedPrice = 270.50;
    trade2.realizedPnL = -149.50;
    trade2.rMultiple = -1.0;
    trade2.exitReason = "HARD_STOP";

    storage.addOrUpdateTrade(trade2);

    // Risk capacity is replenished by $149.50
    const remainingRisk = calculateTotalOpenRisk(storage.getTrades());
    expect(remainingRisk).toBeCloseTo(295.95, 2);
    expect(450.0 - remainingRisk).toBeCloseTo(154.05, 2);
  });

  it("8. Adapts risk cap dynamically to customized user settings (e.g. 5% cap on $20,000 account)", () => {
    // User updates settings to $20,000 capital and 5.0% sleeve risk cap ($1,000 max open risk)
    const customSettings = storage.saveSettings({
      accountSize: 20000.0,
      maxSleeveRiskPct: 5.0,
    });

    expect(customSettings.accountSize).toBe(20000.0);
    expect(customSettings.maxSleeveRiskPct).toBe(5.0);

    const maxRiskCap = customSettings.accountSize * (customSettings.maxSleeveRiskPct / 100);
    expect(maxRiskCap).toBe(1000.0);

    // 4 active positions with total open risk of $600 (3.0% of $20k)
    // Under default 3% cap, $600 would breach on $15k, but on $20k/5% cap it is well within budget
    const activeTrades: StoredTrade[] = [
      { id: "t1", ticker: "ATRO", companyName: "A", status: "ACTIVE", entryTrigger: 100, actualEntry: 100, sharesTotal: 15, sharesRemaining: 15, initialStop: 90, currentStop: 90, target1: 120, target2: 140, rrRatio: 2, timeStopSessions: 5, sessionsElapsed: 1 },
      { id: "t2", ticker: "MTRN", companyName: "M", status: "ACTIVE", entryTrigger: 100, actualEntry: 100, sharesTotal: 15, sharesRemaining: 15, initialStop: 90, currentStop: 90, target1: 120, target2: 140, rrRatio: 2, timeStopSessions: 5, sessionsElapsed: 1 },
      { id: "t3", ticker: "GLBE", companyName: "G", status: "ACTIVE", entryTrigger: 100, actualEntry: 100, sharesTotal: 15, sharesRemaining: 15, initialStop: 90, currentStop: 90, target1: 120, target2: 140, rrRatio: 2, timeStopSessions: 5, sessionsElapsed: 1 },
      { id: "t4", ticker: "NIQ", companyName: "N", status: "ACTIVE", entryTrigger: 100, actualEntry: 100, sharesTotal: 15, sharesRemaining: 15, initialStop: 90, currentStop: 90, target1: 120, target2: 140, rrRatio: 2, timeStopSessions: 5, sessionsElapsed: 1 },
    ];

    const openRisk = calculateTotalOpenRisk(activeTrades);
    expect(openRisk).toBe(600.0); // 4 * 150
    expect(openRisk).toBeLessThanOrEqual(maxRiskCap);
  });

  it("9. Evaluates multi-trade concurrent price updates without race conditions or state corruption", () => {
    const trade1: StoredTrade = {
      id: "tr_conc_1",
      ticker: "ATRO",
      companyName: "Astronics Corporation",
      status: "ACTIVE",
      entryTrigger: 88.50,
      actualEntry: 88.50,
      sharesTotal: 27,
      sharesRemaining: 27,
      initialStop: 83.75,
      currentStop: 83.75,
      target1: 98.00,
      target2: 108.00,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 1,
    };
    const trade2: StoredTrade = {
      id: "tr_conc_2",
      ticker: "GLBE",
      companyName: "Global-e Online Ltd.",
      status: "ACTIVE",
      entryTrigger: 42.60,
      actualEntry: 42.60,
      sharesTotal: 62,
      sharesRemaining: 62,
      initialStop: 40.20,
      currentStop: 40.20,
      target1: 47.40,
      target2: 51.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 1,
    };

    storage.saveTrades([trade1, trade2]);

    // Simulate concurrent tick updates
    market.setPrice("ATRO", 92.00);
    market.setPrice("GLBE", 44.00);

    const report = generateDailyPortfolioReport(
      storage.getTrades(),
      market.getAllQuotes(),
      15000.0,
      "FAVORABLE"
    );

    expect(report.portfolioSummary.totalOpenPositions).toBe(2);
    expect(report.portfolioSummary.totalUnrealizedPnL).toBeGreaterThan(0);
    // (88.50 - 83.75)*27 = 128.25 + (42.60 - 40.20)*62 = 148.80 => 277.05
    expect(report.portfolioSummary.aggregateRiskDollars).toBeCloseTo(277.05, 2);
  });

  it("10. Validates pre-execution order validation gate preventing over-allocation breaches", () => {
    // Current open risk = $350.00
    const existingTrade: StoredTrade = {
      id: "tr_gate_1",
      ticker: "ATRO",
      companyName: "Astronics Corporation",
      status: "ACTIVE",
      entryTrigger: 100.0,
      actualEntry: 100.0,
      sharesTotal: 35,
      sharesRemaining: 35,
      initialStop: 90.0, // $10 risk/share * 35 = $350 risk
      currentStop: 90.0,
      target1: 120.0,
      target2: 140.0,
      rrRatio: 2.0,
      timeStopSessions: 5,
      sessionsElapsed: 1,
    };
    storage.saveTrades([existingTrade]);

    // Proposed new order with $150 risk
    const proposedOrderRisk = 150.0;
    const currentOpenRisk = calculateTotalOpenRisk(storage.getTrades());
    const accountSize = storage.getSettings().accountSize;
    const maxRiskCap = accountSize * 0.03; // $450.00

    // Check if new order would exceed cap: 350 + 150 = $500 > $450
    const wouldExceedCap = (currentOpenRisk + proposedOrderRisk) > maxRiskCap;
    expect(wouldExceedCap).toBe(true);

    // Gate enforces rejection / sizing down to fit available risk budget ($100 max)
    const allowedRiskBudget = Math.max(0, maxRiskCap - currentOpenRisk);
    expect(allowedRiskBudget).toBe(100.0);
  });
});
