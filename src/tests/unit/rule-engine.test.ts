// Unit Test Suite 2: Trade Management Rule Engine & Portfolio Sleeve Guardrails
// Tests Lifecycle State Machine, 1-Click Scale & Breakeven, Trailing Stops, Time Stops, and Pre-Trade Limits

import { describe, it, expect } from "../helpers/assertions";
import {
  evaluateTrade,
  evaluateTradeRules,
  validateProposedTrade,
  evaluatePortfolioRules,
  calculateTradeOpenRisk,
  calculateAggregateOpenRisk,
} from "@/lib/market/rule-engine";

describe("Unit: Trade Management Rule Engine", () => {
  it("1. activates PENDING_ENTRY breakout trigger when price touches or crosses entry", () => {
    const trade = {
      id: "trade-atro",
      ticker: "ATRO",
      status: "PENDING_ENTRY" as const,
      entryTrigger: 89.2,
      sharesTotal: 27,
      sharesRemaining: 27,
      initialStop: 83.75,
      currentStop: 83.75,
      target1: 100.1,
      target2: 108.28,
      timeStopSessions: 6,
      sessionsElapsed: 0,
    };

    // Below entry: no alert
    const belowRes = evaluateTrade(trade, 88.5);
    expect(belowRes.actionRequired).toBe("NONE");
    expect(belowRes.alertType).toBeUndefined();

    // At or above entry: ENTRY_TRIGGERED
    const triggerRes = evaluateTrade(trade, 89.25);
    expect(triggerRes.actionRequired).toBe("ENTRY_TRIGGER");
    expect(triggerRes.alertType).toBe("ENTRY_TRIGGERED");
    expect(triggerRes.urgency).toBe("HIGH");
    expect(triggerRes.orderInstruction).toContain("BUY 27 shares");
  });

  it("2. recommends 50% scale and breakeven stop ratchet when Target 1 is reached", () => {
    const trade = {
      id: "trade-aapl",
      ticker: "AAPL",
      status: "ACTIVE" as const,
      entryTrigger: 100.0,
      actualEntry: 100.0,
      sharesTotal: 100,
      sharesRemaining: 100,
      initialStop: 95.0,
      currentStop: 95.0,
      target1: 110.0,
      target2: 120.0,
      timeStopSessions: 6,
      sessionsElapsed: 2,
    };

    const evalRes = evaluateTrade(trade, { price: 110.5, change: 10.5, changePct: 10.5 });
    expect(evalRes.actionRequired).toBe("SCALE_T1");
    expect(evalRes.alertType).toBe("TARGET_1_HIT");
    expect(evalRes.urgency).toBe("HIGH");
    expect(evalRes.sharesToScale).toBe(50);
    expect(evalRes.suggestedStopUpdate).toBe(100.0); // Breakeven
    expect(evalRes.recommendedAction).toContain("Scale out 50%");
    expect(evalRes.recommendedAction).toContain("Breakeven");
    expect(evalRes.unrealizedPnL).toBe(1050.0);
  });

  it("3. handles odd total share counts correctly on 50% scale (ceil floor balance)", () => {
    const trade = {
      id: "trade-odd",
      ticker: "NVDA",
      status: "ACTIVE" as const,
      entryTrigger: 120.0,
      actualEntry: 120.0,
      sharesTotal: 27, // odd count
      sharesRemaining: 27,
      initialStop: 114.0,
      currentStop: 114.0,
      target1: 132.0,
      target2: 144.0,
      timeStopSessions: 6,
      sessionsElapsed: 1,
    };

    const evalRes = evaluateTradeRules(trade, 132.5);
    expect(evalRes.sharesToScale).toBe(14); // ceil(27 / 2)
    expect(evalRes.suggestedStopUpdate).toBe(120.0);
  });

  it("4. triggers TARGET_2_HIT to close full runner at maximum target extension", () => {
    const trade = {
      id: "trade-runner",
      ticker: "AAPL",
      status: "SCALED_T1" as const,
      entryTrigger: 100.0,
      actualEntry: 100.0,
      sharesTotal: 100,
      sharesRemaining: 50,
      initialStop: 95.0,
      currentStop: 100.0, // at B/E
      target1: 110.0,
      target2: 120.0,
      timeStopSessions: 6,
      sessionsElapsed: 4,
    };

    const evalRes = evaluateTrade(trade, 120.5);
    expect(evalRes.actionRequired).toBe("TARGET_2_HIT");
    expect(evalRes.alertType).toBe("TARGET_2_HIT");
    expect(evalRes.shouldAutoClose).toBe(true);
    expect(evalRes.urgency).toBe("HIGH");
    expect(evalRes.orderInstruction).toContain("SELL remaining 50 shares");
  });

  it("5. triggers STOP_ALERT on hard stop invalidation with immediate close recommendation", () => {
    const trade = {
      id: "trade-stop",
      ticker: "AMD",
      status: "ACTIVE" as const,
      entryTrigger: 150.0,
      actualEntry: 150.0,
      sharesTotal: 20,
      sharesRemaining: 20,
      initialStop: 142.5,
      currentStop: 142.5,
      target1: 165.0,
      target2: 176.25,
      timeStopSessions: 6,
      sessionsElapsed: 1,
    };

    // Exactly at stop price
    const exactStopRes = evaluateTrade(trade, 142.5);
    expect(exactStopRes.actionRequired).toBe("STOP_LOSS_HIT");
    expect(exactStopRes.alertType).toBe("STOP_ALERT");
    expect(exactStopRes.shouldAutoClose).toBe(true);
    expect(exactStopRes.urgency).toBe("HIGH");
    expect(exactStopRes.recommendedAction).toContain("HONOR THE STOP IMMEDIATELY");

    // Slippage gap-down below stop
    const slippageRes = evaluateTrade(trade, 140.0);
    expect(slippageRes.actionRequired).toBe("STOP_LOSS_HIT");
    expect(slippageRes.shouldAutoClose).toBe(true);
    expect(slippageRes.currentRMultiple).toBeLessThan(-1.0);
  });

  it("6. suggests dynamic trailing stop upward ratchet for SCALED_T1 runners", () => {
    const trade = {
      id: "trade-trail",
      ticker: "TSLA",
      status: "SCALED_T1" as const,
      entryTrigger: 200.0,
      actualEntry: 200.0,
      sharesTotal: 50,
      sharesRemaining: 25,
      initialStop: 190.0,
      currentStop: 200.0, // Breakeven
      target1: 220.0,
      target2: 240.0,
      timeStopSessions: 6,
      sessionsElapsed: 3,
    };

    // Price advances to $225 (risk/share = $10 -> trail candidate = 225 - 15 = 210)
    const trailRes = evaluateTrade(trade, 225.0);
    expect(trailRes.actionRequired).toBe("TRAIL_STOP_UPDATE");
    expect(trailRes.suggestedStopUpdate).toBe(210.0);
    expect(trailRes.suggestedStopUpdate).toBeGreaterThan(trade.currentStop);
  });

  it("7. triggers TIME_STOP_WARNING on session 5-6 stagnation", () => {
    const trade = {
      id: "trade-time",
      ticker: "MSFT",
      status: "ACTIVE" as const,
      entryTrigger: 400.0,
      actualEntry: 400.0,
      sharesTotal: 10,
      sharesRemaining: 10,
      initialStop: 385.0,
      currentStop: 385.0,
      target1: 430.0,
      target2: 460.0,
      timeStopSessions: 6,
      sessionsElapsed: 5, // session 5 of 6
    };

    const evalRes = evaluateTrade(trade, 402.0);
    expect(evalRes.actionRequired).toBe("TIME_STOP_WARNING");
    expect(evalRes.alertType).toBe("TIME_STOP_WARNING");
    expect(evalRes.urgency).toBe("MEDIUM");
    expect(evalRes.alertTitle).toContain("Time Stop Warning");
  });

  it("8. triggers TIME_STOP_EXPIRED on session 7+ stale trade exit", () => {
    const trade = {
      id: "trade-expired",
      ticker: "MSFT",
      status: "ACTIVE" as const,
      entryTrigger: 400.0,
      actualEntry: 400.0,
      sharesTotal: 10,
      sharesRemaining: 10,
      initialStop: 385.0,
      currentStop: 385.0,
      target1: 430.0,
      target2: 460.0,
      timeStopSessions: 6,
      sessionsElapsed: 7, // session 7
    };

    const evalRes = evaluateTrade(trade, 401.0);
    expect(evalRes.actionRequired).toBe("TIME_STOP_EXPIRED");
    expect(evalRes.alertType).toBe("TIME_STOP_EXPIRED");
    expect(evalRes.urgency).toBe("HIGH");
    expect(evalRes.recommendedAction).toContain("Liquidate position at market");
  });

  it("9. enforces max 3 active concurrent swing trades sleeve cap", () => {
    const activeTrades = [
      { id: "1", ticker: "AAPL", status: "ACTIVE", sector: "Tech", sharesRemaining: 10, initialStop: 95, currentStop: 95, entryTrigger: 100 },
      { id: "2", ticker: "NVDA", status: "ACTIVE", sector: "Semis", sharesRemaining: 10, initialStop: 95, currentStop: 95, entryTrigger: 100 },
      { id: "3", ticker: "AMZN", status: "SCALED_T1", sector: "Consumer", sharesRemaining: 10, initialStop: 95, currentStop: 100, entryTrigger: 100 },
    ] as any;

    const res = evaluatePortfolioRules(activeTrades, { ticker: "GOOGL", sector: "Tech", riskDollars: 150 });
    expect(res.canOpen).toBe(false);
    expect(res.isAllowed).toBe(false);
    expect(res.rejectionReason).toContain("Maximum 3 active concurrent swing trades");
    expect(res.currentActiveCount).toBe(3);
  });

  it("10. unlocks position capacity when a trade is closed", () => {
    const trades = [
      { id: "1", ticker: "AAPL", status: "ACTIVE", sector: "Tech", sharesRemaining: 10, initialStop: 95, currentStop: 95, entryTrigger: 100 },
      { id: "2", ticker: "NVDA", status: "CLOSED", sector: "Semis", sharesRemaining: 0, initialStop: 95, currentStop: 95, entryTrigger: 100 },
      { id: "3", ticker: "AMZN", status: "ACTIVE", sector: "Consumer", sharesRemaining: 10, initialStop: 95, currentStop: 100, entryTrigger: 100 },
    ] as any;

    const res = evaluatePortfolioRules(trades, { ticker: "GOOGL", sector: "Tech", riskDollars: 100 });
    expect(res.canOpen).toBe(true);
    expect(res.currentActiveCount).toBe(2);
  });

  it("11. rejects 3rd position in the same sector (max 2 sector concentration limit)", () => {
    const activeTrades = [
      { id: "1", ticker: "NVDA", status: "ACTIVE", sector: "Technology", sharesRemaining: 10, initialStop: 95, currentStop: 95, entryTrigger: 100 },
      { id: "2", ticker: "AMD", status: "ACTIVE", sector: "Technology", sharesRemaining: 10, initialStop: 95, currentStop: 95, entryTrigger: 100 },
    ] as any;

    const res = evaluatePortfolioRules(activeTrades, { ticker: "QCOM", sector: "Technology", riskDollars: 100 });
    expect(res.canOpen).toBe(false);
    expect(res.rejectionReason).toContain("Maximum 2 concurrent positions allowed in Technology");
    expect(res.currentSectorCount).toBe(2);
  });

  it("12. permits opening trade in different sector when under concentration limit", () => {
    const activeTrades = [
      { id: "1", ticker: "NVDA", status: "ACTIVE", sector: "Technology", sharesRemaining: 10, initialStop: 95, currentStop: 95, entryTrigger: 100 },
      { id: "2", ticker: "AMD", status: "ACTIVE", sector: "Technology", sharesRemaining: 10, initialStop: 95, currentStop: 95, entryTrigger: 100 },
    ] as any;

    const res = evaluatePortfolioRules(activeTrades, { ticker: "LLY", sector: "Healthcare", riskDollars: 100 });
    expect(res.canOpen).toBe(true);
    expect(res.currentSectorCount).toBe(0);
  });

  it("13. enforces 3.0% aggregate sleeve open risk cap ($450 on $15,000 capital)", () => {
    // 2 active trades totaling $350 open risk. Proposing 3rd trade with $150 risk ($500 total > $450 limit).
    const activeTrades = [
      { id: "1", ticker: "T1", status: "ACTIVE", sector: "SectorA", actualEntry: 100, currentStop: 80, sharesRemaining: 10 }, // $200 risk
      { id: "2", ticker: "T2", status: "ACTIVE", sector: "SectorB", actualEntry: 50, currentStop: 35, sharesRemaining: 10 }, // $150 risk
    ] as any;

    expect(calculateAggregateOpenRisk(activeTrades)).toBe(350.0);

    const res = evaluatePortfolioRules(activeTrades, { ticker: "T3", sector: "SectorC", riskDollars: 150 });
    expect(res.canOpen).toBe(false);
    expect(res.rejectionReason).toContain("Aggregate sleeve open risk limit exceeded");
    expect(res.projectedOpenRiskDollars).toBe(500.0);
  });

  it("14. recognizes that breakeven stops contribute $0 open risk, releasing risk capacity", () => {
    // Trade 1 has stop raised to entry (Breakeven) -> $0 risk. Trade 2 has $150 risk. Total open risk = $150.
    const activeTrades = [
      { id: "1", ticker: "T1", status: "SCALED_T1", sector: "SectorA", actualEntry: 100, currentStop: 100, sharesRemaining: 10 }, // $0 risk
      { id: "2", ticker: "T2", status: "ACTIVE", sector: "SectorB", actualEntry: 50, currentStop: 35, sharesRemaining: 10 }, // $150 risk
    ] as any;

    expect(calculateTradeOpenRisk(activeTrades[0])).toBe(0.0);
    expect(calculateAggregateOpenRisk(activeTrades)).toBe(150.0);

    // Can safely open new trade with $150 risk (Total becomes $300 <= $450 limit)
    const res = evaluatePortfolioRules(activeTrades, { ticker: "T3", sector: "SectorC", riskDollars: 150 });
    expect(res.canOpen).toBe(true);
    expect(res.projectedOpenRiskDollars).toBe(300.0);
  });
});
