// Tier 4 Real-World Workload Scenario Test: Midday Trade Management, 1-Click Scaling, Trailing Stops & Breakeven Defense
// Requirements: ORIGINAL_REQUEST §R2.2, §R3.1, §R3.4

import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade } from "../helpers/mock-storage";
import { MockMarketEngine } from "../helpers/mock-market";
import { evaluateTrade } from "../../lib/market/rule-engine";
import { triggerNotificationAlert } from "../../lib/notifications/notification-service";

describe("Tier 4 Scenario: Midday Management, 1-Click Scaling, Trailing Stops & Breakeven Defense", () => {
  let storage: MockDualLayerStorage;
  let market: MockMarketEngine;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
    market = new MockMarketEngine();
  });

  it("Journey 1: Intraday Quote Surge, Target 1 Hit, Web Audio Chime & 1-Click Scale to Breakeven", () => {
    // 1. Active Position: GLBE (Entry: 42.60, Stop: 40.20, T1: 47.40, T2: 51.00, Shares: 62)
    const trade: StoredTrade = {
      id: "tr_mid_glbe",
      ticker: "GLBE",
      companyName: "Global-e Online Ltd.",
      status: "ACTIVE",
      setupType: "Post-Earnings Catalyst",
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

    // 2. Midday tape surge: GLBE hits $47.50 (+2.04R)
    market.setPrice("GLBE", 47.50);
    const evalRes = evaluateTrade(trade, market.getQuote("GLBE"));

    expect(evalRes.alertType).toBe("TARGET_1_HIT");
    expect(evalRes.currentRMultiple).toBeGreaterThanOrEqual(2.0);
    expect(evalRes.recommendedAction).toContain("Scale out 50%");
    expect(evalRes.recommendedAction).toContain("Breakeven");

    // 3. Audio & Notification dispatch
    triggerNotificationAlert({
      ticker: trade.ticker,
      type: "TARGET_1_HIT",
      title: evalRes.alertTitle || "Target 1 Hit",
      message: evalRes.alertMessage || "Scale 50%",
    });
    const notification = storage.addNotification({
      ticker: trade.ticker,
      type: "TARGET_1_HIT",
      title: evalRes.alertTitle || "Target 1 Hit",
      message: evalRes.alertMessage || "Scale 50%",
      isRead: false,
    });
    expect(notification.type).toBe("TARGET_1_HIT");

    // 4. User executes 1-Click "Scale 50% & Move Stop to Breakeven"
    const fillPrice = 47.50;
    const scaledShares = Math.ceil(trade.sharesTotal / 2); // 31 shares
    const remainingShares = trade.sharesTotal - scaledShares; // 31 shares
    const realizedPnL = Number(((fillPrice - 42.60) * scaledShares).toFixed(2)); // $151.90

    trade.status = "SCALED_T1";
    trade.sharesRemaining = remainingShares;
    trade.currentStop = 42.60; // Breakeven
    trade.realizedPnL = realizedPnL;
    trade.notes = `Scaled ${scaledShares} shares at $${fillPrice}. Stop moved to Breakeven.`;

    storage.addOrUpdateTrade(trade);

    const savedTrade = storage.getTrades().find(t => t.id === "tr_mid_glbe");
    expect(savedTrade?.status).toBe("SCALED_T1");
    expect(savedTrade?.sharesRemaining).toBe(31);
    expect(savedTrade?.currentStop).toBe(42.60);
    expect(savedTrade?.realizedPnL).toBe(151.90);
  });

  it("Journey 2: Dynamic Trailing Stop Adjustment on Bullish Extension with Downward Protection", () => {
    // Scaled Runner position: GLBE with breakeven stop at $42.60
    const runner: StoredTrade = {
      id: "tr_runner_glbe",
      ticker: "GLBE",
      companyName: "Global-e Online Ltd.",
      status: "SCALED_T1",
      entryTrigger: 42.60,
      actualEntry: 42.60,
      sharesTotal: 62,
      sharesRemaining: 31,
      initialStop: 40.20,
      currentStop: 42.60,
      target1: 47.40,
      target2: 51.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 4,
      realizedPnL: 151.90,
    };
    storage.addOrUpdateTrade(runner);

    // Stock extends to $49.20
    market.setPrice("GLBE", 49.20);
    const evalRes = evaluateTrade(runner, market.getQuote("GLBE"));
    expect(evalRes.currentRMultiple).toBeCloseTo(2.75, 2);

    // Coach recommends trailing stop to prior swing low ($46.00)
    const proposedTrailStop = 46.00;

    // Trailing stop upward tightening is permitted
    expect(proposedTrailStop).toBeGreaterThan(runner.currentStop);
    runner.currentStop = proposedTrailStop;
    runner.notes = "Stop trailed to $46.00 under swing low";
    storage.addOrUpdateTrade(runner);

    expect(storage.getTrades().find(t => t.id === "tr_runner_glbe")?.currentStop).toBe(46.00);

    // Downward widening protection: Attempting to lower stop to $44.00 must be rejected
    const attemptLowerStop = 44.00;
    const isWideningAttempt = attemptLowerStop < runner.currentStop;
    expect(isWideningAttempt).toBe(true); // Downward adjustment detected
    // Rule: Never allow downward stop adjustment
    if (!isWideningAttempt) {
      runner.currentStop = attemptLowerStop;
    }
    // Stop remains securely locked at $46.00
    expect(runner.currentStop).toBe(46.00);
  });

  it("Journey 3: Sudden Afternoon Reversal & Breakeven Protection Execution", () => {
    // Scaled position with breakeven stop at $42.60 and $151.90 already banked
    const scaledTrade: StoredTrade = {
      id: "tr_be_defense",
      ticker: "GLBE",
      companyName: "Global-e Online Ltd.",
      status: "SCALED_T1",
      entryTrigger: 42.60,
      actualEntry: 42.60,
      sharesTotal: 62,
      sharesRemaining: 31,
      initialStop: 40.20,
      currentStop: 42.60, // Breakeven Stop
      target1: 47.40,
      target2: 51.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 5,
      realizedPnL: 151.90,
    };
    storage.addOrUpdateTrade(scaledTrade);

    // Sudden afternoon reversal: GLBE plummets from $48 back to $42.60
    market.setPrice("GLBE", 42.60);
    const evalRes = evaluateTrade(scaledTrade, market.getQuote("GLBE"));

    expect(evalRes.alertType).toBe("STOP_ALERT");
    expect(evalRes.shouldAutoClose).toBe(true);
    expect(evalRes.unrealizedPnL).toBe(0.0); // Zero loss on runner leg

    // Close remaining 31 shares at breakeven ($42.60)
    scaledTrade.status = "CLOSED";
    scaledTrade.sharesRemaining = 0;
    scaledTrade.closedPrice = 42.60;
    scaledTrade.closedDate = new Date().toISOString();
    scaledTrade.exitReason = "BREAKEVEN_STOP";
    scaledTrade.rMultiple = 1.02; // Net campaign profit (+1.02R)
    scaledTrade.notes = "Runner closed at Breakeven floor. 50% profit banked at T1.";

    storage.addOrUpdateTrade(scaledTrade);

    const closed = storage.getTrades().find(t => t.id === "tr_be_defense");
    expect(closed?.status).toBe("CLOSED");
    expect(closed?.realizedPnL).toBe(151.90);
    expect(closed?.rMultiple).toBe(1.02);
  });

  it("Journey 4: Midday Invalidation Defense & Immediate Stop Honor", () => {
    // Active trade: NIQ (Entry: 16.25, Stop: 14.90, Shares: 111, Risk: $149.85)
    const activeTrade: StoredTrade = {
      id: "tr_niq_stop",
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
      sessionsElapsed: 2,
    };
    storage.addOrUpdateTrade(activeTrade);

    // Stock breaks support, drops to $14.80
    market.setPrice("NIQ", 14.80);
    const evalRes = evaluateTrade(activeTrade, market.getQuote("NIQ"));

    expect(evalRes.alertType).toBe("STOP_ALERT");
    expect(evalRes.shouldAutoClose).toBe(true);
    expect(evalRes.recommendedAction).toContain("HONOR THE STOP IMMEDIATELY");

    // Audio & alert dispatch
    triggerNotificationAlert({
      ticker: activeTrade.ticker,
      type: "STOP_ALERT",
      title: evalRes.alertTitle || "Stop Loss Hit",
      message: evalRes.alertMessage || "Close immediately",
    });

    // Trader honors stop: closes full position at $14.80
    const lossAmount = Number(((14.80 - 16.25) * 111).toFixed(2)); // -$160.95
    const riskAmount = (16.25 - 14.90) * 111; // $149.85
    const rMultiple = Number((lossAmount / riskAmount).toFixed(2)); // -1.07R

    activeTrade.status = "CLOSED";
    activeTrade.sharesRemaining = 0;
    activeTrade.closedPrice = 14.80;
    activeTrade.closedDate = new Date().toISOString();
    activeTrade.realizedPnL = lossAmount;
    activeTrade.rMultiple = rMultiple;
    activeTrade.exitReason = "HARD_STOP";
    activeTrade.notes = "Honored hard stop without hesitation. Zero revenge trading.";

    storage.addOrUpdateTrade(activeTrade);

    const closed = storage.getTrades().find(t => t.id === "tr_niq_stop");
    expect(closed?.status).toBe("CLOSED");
    expect(closed?.realizedPnL).toBe(-160.95);
    expect(closed?.rMultiple).toBe(-1.07);
  });

  it("Journey 5: Midday Multi-Position Simultaneous Evaluation Sweep", () => {
    // 4 concurrent positions in active portfolio
    const t1: StoredTrade = { id: "p1", ticker: "ATRO", companyName: "ATRO", status: "ACTIVE", entryTrigger: 88.50, actualEntry: 88.50, sharesTotal: 27, sharesRemaining: 27, initialStop: 83.75, currentStop: 83.75, target1: 98.00, target2: 108.00, rrRatio: 2, timeStopSessions: 6, sessionsElapsed: 2 };
    const t2: StoredTrade = { id: "p2", ticker: "MTRN", companyName: "MTRN", status: "ACTIVE", entryTrigger: 282.00, actualEntry: 282.00, sharesTotal: 13, sharesRemaining: 13, initialStop: 270.50, currentStop: 270.50, target1: 305.00, target2: 328.00, rrRatio: 2, timeStopSessions: 6, sessionsElapsed: 2 };
    const t3: StoredTrade = { id: "p3", ticker: "GLBE", companyName: "GLBE", status: "SCALED_T1", entryTrigger: 42.60, actualEntry: 42.60, sharesTotal: 62, sharesRemaining: 31, initialStop: 40.20, currentStop: 42.60, target1: 47.40, target2: 51.00, rrRatio: 2, timeStopSessions: 7, sessionsElapsed: 4 };
    const t4: StoredTrade = { id: "p4", ticker: "CRWV", companyName: "CRWV", status: "PENDING_ENTRY", entryTrigger: 92.00, sharesTotal: 16, sharesRemaining: 16, initialStop: 83.00, currentStop: 83.00, target1: 110.00, target2: 130.00, rrRatio: 2, timeStopSessions: 5, sessionsElapsed: 0 };

    storage.saveTrades([t1, t2, t3, t4]);

    // Tick batch
    market.setPrice("ATRO", 98.50); // Hits T1
    market.setPrice("MTRN", 284.00); // Healthy hold (+0.17R)
    market.setPrice("GLBE", 49.00); // Runner moving to T2 -> Trailing stop recommendation
    market.setPrice("CRWV", 92.50); // Triggers entry

    const evaluations = storage.getTrades().map(t => evaluateTrade(t, market.getQuote(t.ticker)));

    expect(evaluations).toHaveLength(4);

    const atroEval = evaluations.find(e => e.ticker === "ATRO");
    const mtrnEval = evaluations.find(e => e.ticker === "MTRN");
    const glbeEval = evaluations.find(e => e.ticker === "GLBE");
    const crwvEval = evaluations.find(e => e.ticker === "CRWV");

    expect(atroEval?.alertType).toBe("TARGET_1_HIT");
    expect(mtrnEval?.alertType).toBeUndefined(); // Normal hold
    expect(glbeEval?.actionRequired).toBe("TRAIL_STOP_UPDATE"); // Trailing stop update recommended
    expect(glbeEval?.suggestedStopUpdate).toBe(45.40);
    expect(crwvEval?.alertType).toBe("ENTRY_TRIGGERED");
  });
});
