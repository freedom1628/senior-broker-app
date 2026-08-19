// Tier 3 Pairwise Combinatorial Integration Test: Sizing Math, Watch Queue, Position Tracking, Rule Engine, 1-Click Scale & Journal
// Requirements: ORIGINAL_REQUEST §R2.1, §R2.2, §R2.3, §R3.1, §R3.3

import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade } from "../helpers/mock-storage";
import { MockMarketEngine } from "../helpers/mock-market";
import { evaluateTrade } from "../../lib/market/rule-engine";
import { generateDailyPortfolioReport } from "../../lib/portfolio/daily-report";

describe("Tier 3 Pairwise: Sizing, Watch Queue, Rules Engine, 1-Click Scale & Journal", () => {
  let storage: MockDualLayerStorage;
  let market: MockMarketEngine;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
    market = new MockMarketEngine();
  });

  it("1. Calculates exact 1% position size on $15,000 sleeve and initializes watch queue order", () => {
    const settings = storage.getSettings();
    expect(settings.accountSize).toBe(15000.0);
    expect(settings.riskPerTrade).toBe(1.0);

    const riskBudget = settings.accountSize * (settings.riskPerTrade / 100); // $150.00
    expect(riskBudget).toBe(150.0);

    // Setup: ATRO breakout watch
    const entryTrigger = 89.20;
    const initialStop = 83.75;
    const riskPerShare = Math.abs(entryTrigger - initialStop); // $5.45
    const calculatedShares = Math.floor(riskBudget / riskPerShare); // floor(150 / 5.45) = 27 shares
    const target1 = Number((entryTrigger + 2.0 * riskPerShare).toFixed(2)); // $100.10 (2:1 R:R)
    const target2 = Number((entryTrigger + 3.5 * riskPerShare).toFixed(2)); // $108.28 (3.5:1 R:R)
    const rrRatio = Number(((target1 - entryTrigger) / riskPerShare).toFixed(2));

    expect(calculatedShares).toBe(27);
    expect(target1).toBe(100.10);
    expect(rrRatio).toBe(2.0);

    const watchOrder: StoredTrade = {
      id: "trade_atro_1",
      ticker: "ATRO",
      companyName: "Astronics Corporation",
      status: "PENDING_ENTRY",
      setupType: "Base Breakout",
      entryTrigger,
      sharesTotal: calculatedShares,
      sharesRemaining: calculatedShares,
      initialStop,
      currentStop: initialStop,
      target1,
      target2,
      rrRatio,
      timeStopSessions: 6,
      sessionsElapsed: 0,
      notes: "Pending 30-min hold above $89.20 pivot",
    };

    storage.addOrUpdateTrade(watchOrder);
    const saved = storage.getTrades();
    expect(saved).toHaveLength(1);
    expect(saved[0].status).toBe("PENDING_ENTRY");
    expect(saved[0].sharesTotal).toBe(27);
  });

  it("2. Evaluates rule engine transition from PENDING_ENTRY to ENTRY_TRIGGERED on price crossover", () => {
    const trade: StoredTrade = {
      id: "trade_atro_1",
      ticker: "ATRO",
      companyName: "Astronics Corporation",
      status: "PENDING_ENTRY",
      entryTrigger: 89.20,
      sharesTotal: 27,
      sharesRemaining: 27,
      initialStop: 83.75,
      currentStop: 83.75,
      target1: 100.10,
      target2: 108.28,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 0,
    };
    storage.addOrUpdateTrade(trade);

    // Below entry trigger ($88.00) -> No alert
    market.setPrice("ATRO", 88.00);
    let evalRes = evaluateTrade(trade, market.getQuote("ATRO"));
    expect(evalRes.alertType).toBeUndefined();

    // Price reaches or crosses trigger ($89.25) -> ENTRY_TRIGGERED alert
    market.setPrice("ATRO", 89.25);
    evalRes = evaluateTrade(trade, market.getQuote("ATRO"));
    expect(evalRes.alertType).toBe("ENTRY_TRIGGERED");
    expect(evalRes.alertTitle).toContain("Entry Trigger Activated");
    expect(evalRes.alertMessage).toContain("ATRO");

    // Execute Fill: promote to ACTIVE
    trade.status = "ACTIVE";
    trade.actualEntry = 89.25;
    trade.entryDate = new Date().toISOString();
    storage.addOrUpdateTrade(trade);

    const updated = storage.getTrades().find(t => t.id === "trade_atro_1");
    expect(updated?.status).toBe("ACTIVE");
    expect(updated?.actualEntry).toBe(89.25);
  });

  it("3. Detects TARGET_1_HIT condition when quote reaches 2:1 R:R level", () => {
    const trade: StoredTrade = {
      id: "trade_glbe_1",
      ticker: "GLBE",
      companyName: "Global-e Online Ltd.",
      status: "ACTIVE",
      entryTrigger: 42.60,
      actualEntry: 42.60,
      sharesTotal: 62, // $150 risk / $2.40 stop dist = 62 shares
      sharesRemaining: 62,
      initialStop: 40.20,
      currentStop: 40.20,
      target1: 47.40, // 2:1 R:R = +$4.80
      target2: 51.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 3,
    };
    storage.addOrUpdateTrade(trade);

    // Price midway ($45.00, +1.0R) -> No Target 1 alert yet
    market.setPrice("GLBE", 45.00);
    let evalRes = evaluateTrade(trade, market.getQuote("GLBE"));
    expect(evalRes.alertType).toBeUndefined();
    expect(evalRes.currentRMultiple).toBe(1.0);
    expect(evalRes.unrealizedPnL).toBeCloseTo(148.80, 1); // 62 shares * $2.40

    // Price touches Target 1 ($47.45, +2.02R) -> TARGET_1_HIT alert
    market.setPrice("GLBE", 47.45);
    evalRes = evaluateTrade(trade, market.getQuote("GLBE"));
    expect(evalRes.alertType).toBe("TARGET_1_HIT");
    expect(evalRes.alertTitle).toContain("TARGET 1 ACHIEVED");
    expect(evalRes.recommendedAction).toContain("Scale out 50%");
    expect(evalRes.recommendedAction).toContain("Breakeven");
  });

  it("4. Executes 1-Click Scale 50%: banks partial profit and raises stop to Breakeven", () => {
    const trade: StoredTrade = {
      id: "trade_glbe_1",
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
      sessionsElapsed: 3,
    };
    storage.addOrUpdateTrade(trade);

    // Midday execution of 1-Click Scale 50% at $47.50
    const fillPrice = 47.50;
    const scaledShares = Math.ceil(trade.sharesTotal / 2); // 31 shares
    const remainingShares = trade.sharesTotal - scaledShares; // 31 shares
    const effectiveEntry = trade.actualEntry || trade.entryTrigger;
    const realizedGain = Number(((fillPrice - effectiveEntry) * scaledShares).toFixed(2)); // (47.50 - 42.60) * 31 = $151.90

    trade.status = "SCALED_T1";
    trade.sharesRemaining = remainingShares;
    trade.currentStop = effectiveEntry; // Raised strictly to Breakeven $42.60
    trade.realizedPnL = realizedGain;
    trade.notes = "1-Click Scale 50% executed at $47.50. Stop moved to Breakeven.";

    storage.addOrUpdateTrade(trade);

    const savedTrade = storage.getTrades().find(t => t.id === "trade_glbe_1");
    expect(savedTrade?.status).toBe("SCALED_T1");
    expect(savedTrade?.sharesRemaining).toBe(31);
    expect(savedTrade?.currentStop).toBe(42.60); // Breakeven
    expect(savedTrade?.realizedPnL).toBe(151.90);
  });

  it("5. Verifies post-scale zero-risk state: breakeven retracement incurs zero dollar loss", () => {
    const trade: StoredTrade = {
      id: "trade_glbe_scaled",
      ticker: "GLBE",
      companyName: "Global-e Online Ltd.",
      status: "SCALED_T1",
      entryTrigger: 42.60,
      actualEntry: 42.60,
      sharesTotal: 62,
      sharesRemaining: 31,
      initialStop: 40.20,
      currentStop: 42.60, // Breakeven stop
      target1: 47.40,
      target2: 51.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 4,
      realizedPnL: 151.90,
    };
    storage.addOrUpdateTrade(trade);

    // Price drops back to breakeven stop ($42.60)
    market.setPrice("GLBE", 42.60);
    const evalRes = evaluateTrade(trade, market.getQuote("GLBE"));

    expect(evalRes.alertType).toBe("STOP_ALERT");
    expect(evalRes.shouldAutoClose).toBe(true);
    expect(evalRes.unrealizedPnL).toBe(0.0); // 0 dollar loss on runner

    // Close remaining shares at breakeven
    const finalLegLoss = (42.60 - 42.60) * trade.sharesRemaining; // $0.00
    const totalCampaignPnL = (trade.realizedPnL || 0) + finalLegLoss;
    const initialRiskBudget = Math.abs(42.60 - 40.20) * trade.sharesTotal; // $148.80
    const campaignR = Number((totalCampaignPnL / initialRiskBudget).toFixed(2));

    trade.status = "CLOSED";
    trade.sharesRemaining = 0;
    trade.closedPrice = 42.60;
    trade.closedDate = new Date().toISOString();
    trade.realizedPnL = totalCampaignPnL;
    trade.rMultiple = campaignR;
    trade.exitReason = "BREAKEVEN_STOP";

    storage.addOrUpdateTrade(trade);

    const closed = storage.getTrades().find(t => t.id === "trade_glbe_scaled");
    expect(closed?.status).toBe("CLOSED");
    expect(closed?.realizedPnL).toBe(151.90);
    expect(closed?.rMultiple).toBeCloseTo(1.02, 2); // Net positive campaign (+1.02R)
  });

  it("6. Evaluates TARGET_2_HIT runner extension and closes full position at maximum target", () => {
    const runnerTrade: StoredTrade = {
      id: "trade_mtrn_runner",
      ticker: "MTRN",
      companyName: "Materion Corporation",
      status: "SCALED_T1",
      entryTrigger: 282.00,
      actualEntry: 282.00,
      sharesTotal: 12,
      sharesRemaining: 6,
      initialStop: 270.50,
      currentStop: 282.00,
      target1: 305.00,
      target2: 328.00,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 4,
      realizedPnL: 138.00, // 6 shares * ($305 - $282) = $138
    };
    storage.addOrUpdateTrade(runnerTrade);

    // Price reaches Target 2 ($328.50)
    market.setPrice("MTRN", 328.50);
    const evalRes = evaluateTrade(runnerTrade, market.getQuote("MTRN"));

    expect(evalRes.alertType).toBe("TARGET_2_HIT");
    expect(evalRes.shouldAutoClose).toBe(true);
    expect(evalRes.alertTitle).toContain("TARGET 2 MAX RUNNER REACHED");

    // Close remaining 6 shares at $328.50
    const runnerGain = (328.50 - 282.00) * 6; // $279.00
    const totalCampaignPnL = (runnerTrade.realizedPnL || 0) + runnerGain; // $138 + $279 = $417.00
    const totalInitialRisk = Math.abs(282.00 - 270.50) * 12; // $138.00
    const campaignR = Number((totalCampaignPnL / totalInitialRisk).toFixed(2)); // $417 / $138 = 3.02R

    runnerTrade.status = "CLOSED";
    runnerTrade.sharesRemaining = 0;
    runnerTrade.closedPrice = 328.50;
    runnerTrade.closedDate = new Date().toISOString();
    runnerTrade.realizedPnL = totalCampaignPnL;
    runnerTrade.rMultiple = campaignR;
    runnerTrade.exitReason = "TARGET_2_REACHED";

    storage.addOrUpdateTrade(runnerTrade);

    const closed = storage.getTrades().find(t => t.id === "trade_mtrn_runner");
    expect(closed?.status).toBe("CLOSED");
    expect(closed?.realizedPnL).toBe(417.00);
    expect(closed?.rMultiple).toBe(3.02);
  });

  it("7. Computes trade journal statistics accurately across multiple closed campaigns", () => {
    const trade1: StoredTrade = {
      id: "tr_c1",
      ticker: "GLBE",
      companyName: "Global-e Online Ltd.",
      status: "CLOSED",
      entryTrigger: 42.60,
      actualEntry: 42.60,
      sharesTotal: 62,
      sharesRemaining: 0,
      initialStop: 40.20,
      currentStop: 42.60,
      target1: 47.40,
      target2: 51.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 4,
      realizedPnL: 151.90,
      rMultiple: 1.02,
      exitReason: "BREAKEVEN_STOP",
    };

    const trade2: StoredTrade = {
      id: "tr_c2",
      ticker: "MTRN",
      companyName: "Materion Corporation",
      status: "CLOSED",
      entryTrigger: 282.00,
      actualEntry: 282.00,
      sharesTotal: 12,
      sharesRemaining: 0,
      initialStop: 270.50,
      currentStop: 282.00,
      target1: 305.00,
      target2: 328.00,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 4,
      realizedPnL: 417.00,
      rMultiple: 3.02,
      exitReason: "TARGET_2_REACHED",
    };

    const trade3: StoredTrade = {
      id: "tr_c3",
      ticker: "TWLO",
      companyName: "Twilio Inc.",
      status: "CLOSED",
      entryTrigger: 250.00,
      actualEntry: 250.00,
      sharesTotal: 6,
      sharesRemaining: 0,
      initialStop: 225.00,
      currentStop: 225.00,
      target1: 275.00,
      target2: 300.00,
      rrRatio: 2.0,
      timeStopSessions: 5,
      sessionsElapsed: 2,
      realizedPnL: -150.00,
      rMultiple: -1.0,
      exitReason: "STOP_LOSS",
    };

    storage.saveTrades([trade1, trade2, trade3]);
    const closed = storage.getTrades().filter(t => t.status === "CLOSED");

    expect(closed).toHaveLength(3);
    const totalPnL = closed.reduce((acc, t) => acc + (t.realizedPnL || 0), 0);
    const winTrades = closed.filter(t => (t.realizedPnL || 0) > 0);
    const winRate = (winTrades.length / closed.length) * 100;
    const avgR = closed.reduce((acc, t) => acc + (t.rMultiple || 0), 0) / closed.length;
    const totalGains = winTrades.reduce((acc, t) => acc + (t.realizedPnL || 0), 0);
    const totalLosses = Math.abs(closed.filter(t => (t.realizedPnL || 0) < 0).reduce((acc, t) => acc + (t.realizedPnL || 0), 0));
    const profitFactor = Number((totalGains / totalLosses).toFixed(2));

    expect(totalPnL).toBe(418.90);
    expect(winRate).toBeCloseTo(66.67, 1);
    expect(avgR).toBeCloseTo(1.01, 2);
    expect(profitFactor).toBe(3.79);
  });

  it("8. Exercises hard stop-loss violation path and logs disciplined loss to journal", () => {
    const losingTrade: StoredTrade = {
      id: "trade_loser",
      ticker: "NIQ",
      companyName: "NIQ Global Intelligence",
      status: "ACTIVE",
      entryTrigger: 16.25,
      actualEntry: 16.25,
      sharesTotal: 111,
      sharesRemaining: 111,
      initialStop: 14.90, // $1.35 risk per share = $149.85 total risk
      currentStop: 14.90,
      target1: 18.95,
      target2: 21.00,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 1,
    };
    storage.addOrUpdateTrade(losingTrade);

    // Sudden adverse move: Price drops to $14.85 (below stop $14.90)
    market.setPrice("NIQ", 14.85);
    const evalRes = evaluateTrade(losingTrade, market.getQuote("NIQ"));

    expect(evalRes.alertType).toBe("STOP_ALERT");
    expect(evalRes.shouldAutoClose).toBe(true);
    expect(evalRes.recommendedAction).toContain("HONOR THE STOP IMMEDIATELY");

    // Close trade immediately at market ($14.85)
    const loss = Number(((14.85 - 16.25) * 111).toFixed(2)); // -$155.40
    const riskAmount = (16.25 - 14.90) * 111; // $149.85
    const rMultiple = Number((loss / riskAmount).toFixed(2)); // -1.04R

    losingTrade.status = "CLOSED";
    losingTrade.sharesRemaining = 0;
    losingTrade.closedPrice = 14.85;
    losingTrade.closedDate = new Date().toISOString();
    losingTrade.realizedPnL = loss;
    losingTrade.rMultiple = rMultiple;
    losingTrade.exitReason = "HARD_STOP_INVALIDATION";

    storage.addOrUpdateTrade(losingTrade);

    const closed = storage.getTrades().find(t => t.id === "trade_loser");
    expect(closed?.status).toBe("CLOSED");
    expect(closed?.realizedPnL).toBe(-155.40);
    expect(closed?.rMultiple).toBe(-1.04);
  });

  it("9. Handles odd share count scaling preserving exact shares and monetary balances", () => {
    const oddTrade: StoredTrade = {
      id: "trade_odd_shares",
      ticker: "CRWV",
      companyName: "CoreWeave Inc.",
      status: "ACTIVE",
      entryTrigger: 92.00,
      actualEntry: 92.00,
      sharesTotal: 17, // 17 shares total (odd number)
      sharesRemaining: 17,
      initialStop: 83.00, // $9.00 risk/share => $153 total risk
      currentStop: 83.00,
      target1: 110.00,
      target2: 130.00,
      rrRatio: 2.0,
      timeStopSessions: 5,
      sessionsElapsed: 2,
    };
    storage.addOrUpdateTrade(oddTrade);

    // Scale 50%: Math.ceil(17 / 2) = 9 shares sold, 8 shares remaining
    const scaledCount = Math.ceil(oddTrade.sharesTotal / 2);
    const remainderCount = oddTrade.sharesTotal - scaledCount;
    expect(scaledCount).toBe(9);
    expect(remainderCount).toBe(8);
    expect(scaledCount + remainderCount).toBe(17);

    const scaleFill = 110.00;
    const partialPnL = (scaleFill - 92.00) * scaledCount; // 9 * $18 = $162.00

    oddTrade.status = "SCALED_T1";
    oddTrade.sharesRemaining = remainderCount;
    oddTrade.currentStop = 92.00;
    oddTrade.realizedPnL = partialPnL;

    storage.addOrUpdateTrade(oddTrade);

    const updated = storage.getTrades().find(t => t.id === "trade_odd_shares");
    expect(updated?.sharesRemaining).toBe(8);
    expect(updated?.realizedPnL).toBe(162.00);
    expect(updated?.currentStop).toBe(92.00);
  });

  it("10. Generates daily portfolio report action triage reflecting dynamic trade lifecycle", () => {
    const active1: StoredTrade = {
      id: "t_report_1",
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
      setupType: "Aerospace & Defense Breakout",
    };

    const scaled2: StoredTrade = {
      id: "t_report_2",
      ticker: "GLBE",
      companyName: "Global-e Online Ltd.",
      status: "SCALED_T1",
      entryTrigger: 42.60,
      actualEntry: 42.60,
      sharesTotal: 62,
      sharesRemaining: 31,
      initialStop: 40.20,
      currentStop: 42.60, // Breakeven
      target1: 47.40,
      target2: 51.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 4,
      setupType: "Technology / E-Commerce",
    };

    market.setPrice("ATRO", 98.20); // At/Above T1 -> TAKE_PROFIT
    market.setPrice("GLBE", 44.50); // Holding runner comfortably below T1 -> TRAIL_STOP

    const report = generateDailyPortfolioReport(
      [active1, scaled2],
      market.getAllQuotes(),
      15000.0,
      "FAVORABLE"
    );

    expect(report.portfolioSummary.totalOpenPositions).toBe(2);
    expect(report.actionItems.length).toBeGreaterThanOrEqual(2);

    // ATRO should trigger High Urgency TAKE_PROFIT
    const atroAction = report.actionItems.find(a => a.ticker === "ATRO");
    expect(atroAction).toBeDefined();
    expect(atroAction?.actionType).toBe("TAKE_PROFIT");
    expect(atroAction?.urgency).toBe("HIGH");

    // GLBE should trigger TRAIL_STOP runner recommendation
    const glbeAction = report.actionItems.find(a => a.ticker === "GLBE");
    expect(glbeAction).toBeDefined();
    expect(glbeAction?.actionType).toBe("TRAIL_STOP");
  });
});
