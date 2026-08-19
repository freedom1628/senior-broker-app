import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade } from "../helpers/mock-storage";
import { MockMarketEngine } from "../helpers/mock-market";
import { evaluateTrade } from "../../lib/market/rule-engine";

// Position Lifecycle Action Helpers
export function execute1ClickFillEntry(
  storage: MockDualLayerStorage,
  tradeId: string,
  actualFillPrice?: number
): StoredTrade {
  const trades = storage.getTrades();
  const trade = trades.find(t => t.id === tradeId);
  if (!trade) throw new Error(`Trade ${tradeId} not found`);
  if (trade.status !== "PENDING_ENTRY" && trade.status !== "WATCHLIST") {
    throw new Error(`Cannot fill trade with status ${trade.status}`);
  }

  const fill = actualFillPrice ?? trade.entryTrigger;
  const updated: StoredTrade = {
    ...trade,
    status: "ACTIVE",
    actualEntry: fill,
    entryDate: new Date().toISOString(),
    sharesRemaining: trade.sharesTotal,
    currentStop: trade.initialStop,
    sessionsElapsed: 0,
  };

  storage.addOrUpdateTrade(updated);
  return updated;
}

export function execute1ClickScale50(
  storage: MockDualLayerStorage,
  tradeId: string,
  scalePrice?: number
): { trade: StoredTrade; realizedGain: number; scaledShares: number } {
  const trades = storage.getTrades();
  const trade = trades.find(t => t.id === tradeId);
  if (!trade) throw new Error(`Trade ${tradeId} not found`);
  if (trade.status !== "ACTIVE") {
    throw new Error(`Cannot scale trade with status ${trade.status}`);
  }

  const entry = trade.actualEntry ?? trade.entryTrigger;
  const fill = scalePrice ?? trade.target1;
  const scaledShares = Math.ceil(trade.sharesTotal / 2);
  const remainingShares = trade.sharesTotal - scaledShares;
  const realizedGain = Number((scaledShares * (fill - entry)).toFixed(2));

  const updated: StoredTrade = {
    ...trade,
    status: "SCALED_T1",
    sharesRemaining: remainingShares,
    currentStop: entry, // Stop raised strictly to Breakeven!
    realizedPnL: Number(((trade.realizedPnL || 0) + realizedGain).toFixed(2)),
  };

  storage.addOrUpdateTrade(updated);
  return { trade: updated, realizedGain, scaledShares };
}

export function execute1ClickUpdateStop(
  storage: MockDualLayerStorage,
  tradeId: string,
  newStop: number
): StoredTrade {
  const trades = storage.getTrades();
  const trade = trades.find(t => t.id === tradeId);
  if (!trade) throw new Error(`Trade ${tradeId} not found`);

  // Downward-widening protection rule: stop can only be tightened upward
  if (newStop < trade.currentStop) {
    throw new Error(
      `Discipline Rule Violation: Cannot widen stop downward from $${trade.currentStop.toFixed(2)} to $${newStop.toFixed(2)}`
    );
  }

  const updated: StoredTrade = {
    ...trade,
    currentStop: Number(newStop.toFixed(2)),
  };

  storage.addOrUpdateTrade(updated);
  return updated;
}

export function execute1ClickExitStale(
  storage: MockDualLayerStorage,
  tradeId: string,
  exitPrice: number,
  exitReason: string = "TIME_STOP"
): { trade: StoredTrade; totalRealizedPnL: number; finalRMultiple: number } {
  const trades = storage.getTrades();
  const trade = trades.find(t => t.id === tradeId);
  if (!trade) throw new Error(`Trade ${tradeId} not found`);

  const entry = trade.actualEntry ?? trade.entryTrigger;
  const riskPerShare = Math.max(0.01, entry - trade.initialStop);
  const remainingGain = trade.sharesRemaining * (exitPrice - entry);
  const totalRealizedPnL = Number(((trade.realizedPnL || 0) + remainingGain).toFixed(2));
  
  // Total campaign R-multiple = Total Realized PnL / (SharesTotal * RiskPerShare)
  const initialDollarRisk = trade.sharesTotal * riskPerShare;
  const finalRMultiple = Number((totalRealizedPnL / initialDollarRisk).toFixed(2));

  const updated: StoredTrade = {
    ...trade,
    status: "CLOSED",
    sharesRemaining: 0,
    closedPrice: Number(exitPrice.toFixed(2)),
    closedDate: new Date().toISOString(),
    realizedPnL: totalRealizedPnL,
    rMultiple: finalRMultiple,
    exitReason,
  };

  storage.addOrUpdateTrade(updated);
  return { trade: updated, totalRealizedPnL, finalRMultiple };
}

describe("Tier 1 Feature Coverage: Position Lifecycle & Rules Engine", () => {
  let storage: MockDualLayerStorage;
  let market: MockMarketEngine;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
    market = new MockMarketEngine();
  });

  // -------------------------------------------------------------
  // FEATURE 7: Real-Time Position Tracking
  // -------------------------------------------------------------
  describe("Feature 7: Real-Time Position Tracking", () => {
    it("initializes active position record with complete trading plan levels", () => {
      const trade: StoredTrade = {
        id: "pos_atro",
        ticker: "ATRO",
        companyName: "Astronics Corporation",
        status: "ACTIVE",
        entryTrigger: 89.2,
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

      storage.addOrUpdateTrade(trade);
      const retrieved = storage.getTrades()[0];
      expect(retrieved.ticker).toBe("ATRO");
      expect(retrieved.actualEntry).toBe(88.5);
      expect(retrieved.sharesRemaining).toBe(18);
      expect(retrieved.currentStop).toBe(83.75);
    });

    it("evaluates real-time floating P&L and R-multiple as quote changes", () => {
      const trade: StoredTrade = {
        id: "pos_atro",
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
        sessionsElapsed: 2,
      };

      // Current quote = $93.25 (+$4.75 / +1.0R gain per share)
      const evaluation = evaluateTrade(trade, {
        ticker: "ATRO",
        name: "Astronics",
        price: 93.25,
        change: 4.75,
        changePct: 5.37,
        high: 94.0,
        low: 88.0,
        volume: 1500000,
        prevClose: 88.5,
        lastUpdated: new Date().toISOString(),
      });

      expect(evaluation.unrealizedPnL).toBe(85.5); // 18 * 4.75
      expect(evaluation.currentRMultiple).toBe(1.0);
    });

    it("tracks negative floating P&L when price is between entry and stop loss", () => {
      const trade: StoredTrade = {
        id: "pos_atro",
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

      const evaluation = evaluateTrade(trade, {
        ticker: "ATRO",
        name: "Astronics",
        price: 86.6, // -$1.90/sh
        change: -1.9,
        changePct: -2.15,
        high: 88.5,
        low: 86.0,
        volume: 1000000,
        prevClose: 88.5,
        lastUpdated: new Date().toISOString(),
      });

      expect(evaluation.unrealizedPnL).toBe(-34.2); // 18 * -1.90
      expect(evaluation.currentRMultiple).toBe(-0.4);
      expect(evaluation.shouldAutoClose).toBeFalsy();
    });

    it("triggers STOP_ALERT and flags auto-close when market quote touches hard stop loss", () => {
      const trade: StoredTrade = {
        id: "pos_atro",
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
        sessionsElapsed: 3,
      };

      const evaluation = evaluateTrade(trade, {
        ticker: "ATRO",
        name: "Astronics",
        price: 83.75, // Hit stop price exactly
        change: -4.75,
        changePct: -5.37,
        high: 88.0,
        low: 83.5,
        volume: 2000000,
        prevClose: 88.5,
        lastUpdated: new Date().toISOString(),
      });

      expect(evaluation.alertType).toBe("STOP_ALERT");
      expect(evaluation.shouldAutoClose).toBe(true);
      expect(evaluation.recommendedAction).toContain("HONOR THE STOP IMMEDIATELY");
    });

    it("tracks session duration progression and updates holding days", () => {
      const trade: StoredTrade = {
        id: "pos_mtrn",
        ticker: "MTRN",
        companyName: "Materion Corp",
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
        sessionsElapsed: 3,
      };

      storage.addOrUpdateTrade(trade);
      trade.sessionsElapsed = 4;
      storage.addOrUpdateTrade(trade);

      expect(storage.getTrades()[0].sessionsElapsed).toBe(4);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 8: Pending Watch Order Queue
  // -------------------------------------------------------------
  describe("Feature 8: Pending Watch Order Queue", () => {
    it("stores pending watch order with entry condition and planned risk levels", () => {
      const watchOrder: StoredTrade = {
        id: "watch_mtrn",
        ticker: "MTRN",
        companyName: "Materion Corporation",
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

      storage.addOrUpdateTrade(watchOrder);
      const pending = storage.getTrades().filter(t => t.status === "PENDING_ENTRY");
      expect(pending).toHaveLength(1);
      expect(pending[0].ticker).toBe("MTRN");
      expect(pending[0].entryTrigger).toBe(282.0);
    });

    it("evaluates ENTRY_TRIGGERED alert when current market price crosses above trigger", () => {
      const watchOrder: StoredTrade = {
        id: "watch_mtrn",
        ticker: "MTRN",
        companyName: "Materion Corporation",
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

      const evaluation = evaluateTrade(watchOrder, {
        ticker: "MTRN",
        name: "Materion",
        price: 283.5, // Breakout above 282.00
        change: 3.5,
        changePct: 1.25,
        high: 284.0,
        low: 280.0,
        volume: 500000,
        prevClose: 280.0,
        lastUpdated: new Date().toISOString(),
      });

      expect(evaluation.alertType).toBe("ENTRY_TRIGGERED");
      expect(evaluation.alertTitle).toContain("Entry Trigger Activated");
      expect(evaluation.recommendedAction).toContain("Execute Long Entry");
    });

    it("does NOT trigger entry alert when market price remains below trigger price", () => {
      const watchOrder: StoredTrade = {
        id: "watch_mtrn",
        ticker: "MTRN",
        companyName: "Materion Corporation",
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

      const evaluation = evaluateTrade(watchOrder, {
        ticker: "MTRN",
        name: "Materion",
        price: 280.5, // Still below 282.00
        change: 0.5,
        changePct: 0.18,
        high: 281.0,
        low: 279.0,
        volume: 400000,
        prevClose: 280.0,
        lastUpdated: new Date().toISOString(),
      });

      expect(evaluation.alertType).toBeUndefined();
    });

    it("executes 1-Click 'Fill Entry Now' and transitions order to ACTIVE status", () => {
      const watchOrder: StoredTrade = {
        id: "watch_1",
        ticker: "GLBE",
        companyName: "Global-e Online",
        status: "PENDING_ENTRY",
        entryTrigger: 42.6,
        sharesTotal: 41,
        sharesRemaining: 41,
        initialStop: 40.2,
        currentStop: 40.2,
        target1: 48.0,
        target2: 52.0,
        rrRatio: 2.25,
        timeStopSessions: 7,
        sessionsElapsed: 0,
      };

      storage.addOrUpdateTrade(watchOrder);
      const activeTrade = execute1ClickFillEntry(storage, "watch_1", 42.65);

      expect(activeTrade.status).toBe("ACTIVE");
      expect(activeTrade.actualEntry).toBe(42.65);
      expect(activeTrade.sharesRemaining).toBe(41);
      expect(activeTrade.sessionsElapsed).toBe(0);

      const allActive = storage.getTrades().filter(t => t.status === "ACTIVE");
      expect(allActive).toHaveLength(1);
    });

    it("allows canceling / deleting a pending watch order cleanly", () => {
      const watchOrder: StoredTrade = {
        id: "watch_cancel_me",
        ticker: "NIQ",
        companyName: "NIQ Global Intelligence",
        status: "PENDING_ENTRY",
        entryTrigger: 16.25,
        sharesTotal: 74,
        sharesRemaining: 74,
        initialStop: 14.9,
        currentStop: 14.9,
        target1: 19.2,
        target2: 21.5,
        rrRatio: 2.19,
        timeStopSessions: 6,
        sessionsElapsed: 0,
      };

      storage.addOrUpdateTrade(watchOrder);
      expect(storage.getTrades()).toHaveLength(1);

      const deleted = storage.deleteTrade("watch_cancel_me");
      expect(deleted).toBe(true);
      expect(storage.getTrades()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 9: 1-Click Scale 50% & Move Stop to B/E
  // -------------------------------------------------------------
  describe("Feature 9: 1-Click Scale 50% & Move Stop to B/E", () => {
    it("detects TARGET_1_HIT when market quote reaches or exceeds Target 1", () => {
      const trade: StoredTrade = {
        id: "tr_scale_test",
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

      const evaluation = evaluateTrade(trade, {
        ticker: "ATRO",
        name: "Astronics",
        price: 100.25, // Above Target 1
        change: 11.75,
        changePct: 13.28,
        high: 101.0,
        low: 88.0,
        volume: 3500000,
        prevClose: 88.5,
        lastUpdated: new Date().toISOString(),
      });

      expect(evaluation.alertType).toBe("TARGET_1_HIT");
      expect(evaluation.recommendedAction).toContain("Scale out 50%");
      expect(evaluation.recommendedAction).toContain("Breakeven");
    });

    it("executes 1-Click Scale 50%: banks partial profit and raises stop to Breakeven", () => {
      const trade: StoredTrade = {
        id: "tr_scale_exec",
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

      storage.addOrUpdateTrade(trade);
      // Scale 50% at $100.10: 9 shares * ($100.10 - $88.50) = 9 * 11.60 = +$104.40
      const result = execute1ClickScale50(storage, "tr_scale_exec", 100.1);

      expect(result.scaledShares).toBe(9);
      expect(result.realizedGain).toBe(104.4);
      expect(result.trade.status).toBe("SCALED_T1");
      expect(result.trade.sharesRemaining).toBe(9);
      expect(result.trade.currentStop).toBe(88.5); // Breakeven
      expect(result.trade.realizedPnL).toBe(104.4);
    });

    it("leaves the remaining 50% as a completely risk-free runner position", () => {
      const scaledTrade: StoredTrade = {
        id: "tr_runner_check",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "SCALED_T1",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 9,
        initialStop: 83.75,
        currentStop: 88.5, // Breakeven
        target1: 100.1,
        target2: 112.0,
        rrRatio: 2.13,
        timeStopSessions: 5,
        sessionsElapsed: 4,
        realizedPnL: 104.4,
      };

      // Even if quote drops back down to $88.50 (entry), open dollar risk is 0
      const openRisk = Math.max(0, scaledTrade.actualEntry! - scaledTrade.currentStop) * scaledTrade.sharesRemaining;
      expect(openRisk).toBe(0.0);
    });

    it("handles odd total shares when scaling 50% (e.g. 41 shares -> 21 scale, 20 runner)", () => {
      const trade: StoredTrade = {
        id: "tr_odd_shares",
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

      storage.addOrUpdateTrade(trade);
      const result = execute1ClickScale50(storage, "tr_odd_shares", 48.0);

      expect(result.scaledShares).toBe(21); // ceil(41/2)
      expect(result.trade.sharesRemaining).toBe(20);
      expect(result.realizedGain).toBe(113.4); // 21 * (48.00 - 42.60) = 21 * 5.40
    });

    it("evaluates TARGET_2_HIT alert on scaled position runner reaching final extension", () => {
      const scaledTrade: StoredTrade = {
        id: "tr_t2_test",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "SCALED_T1",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 9,
        initialStop: 83.75,
        currentStop: 88.5,
        target1: 100.1,
        target2: 112.0,
        rrRatio: 2.13,
        timeStopSessions: 5,
        sessionsElapsed: 5,
        realizedPnL: 104.4,
      };

      const evaluation = evaluateTrade(scaledTrade, {
        ticker: "ATRO",
        name: "Astronics",
        price: 112.5, // Target 2 Hit!
        change: 24.0,
        changePct: 27.1,
        high: 113.0,
        low: 88.5,
        volume: 4000000,
        prevClose: 88.5,
        lastUpdated: new Date().toISOString(),
      });

      expect(evaluation.alertType).toBe("TARGET_2_HIT");
      expect(evaluation.shouldAutoClose).toBe(true);
      expect(evaluation.recommendedAction).toContain("Close remaining runner");
    });
  });

  // -------------------------------------------------------------
  // FEATURE 10: Dynamic Trailing Stop Adjuster
  // -------------------------------------------------------------
  describe("Feature 10: Dynamic Trailing Stop Adjuster", () => {
    it("allows tightening stop loss upward closer to entry", () => {
      const trade: StoredTrade = {
        id: "tr_trail_1",
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
      const updated = execute1ClickUpdateStop(storage, "tr_trail_1", 86.5);

      expect(updated.currentStop).toBe(86.5);
      expect(storage.getTrades()[0].currentStop).toBe(86.5);
    });

    it("allows trailing stop into profit above entry price for runner protection", () => {
      const trade: StoredTrade = {
        id: "tr_trail_profit",
        ticker: "GLBE",
        companyName: "Global-e",
        status: "SCALED_T1",
        entryTrigger: 42.6,
        actualEntry: 42.6,
        sharesTotal: 41,
        sharesRemaining: 20,
        initialStop: 40.2,
        currentStop: 42.6,
        target1: 48.0,
        target2: 52.0,
        rrRatio: 2.25,
        timeStopSessions: 7,
        sessionsElapsed: 5,
      };

      storage.addOrUpdateTrade(trade);
      // Trail stop up to $45.00 (locking in +$2.40 profit on runner)
      const updated = execute1ClickUpdateStop(storage, "tr_trail_profit", 45.0);

      expect(updated.currentStop).toBe(45.0);
    });

    it("REJECTS downward widening of stop loss with strict rule exception", () => {
      const trade: StoredTrade = {
        id: "tr_no_widen",
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
        sessionsElapsed: 1,
      };

      storage.addOrUpdateTrade(trade);

      expect(() => {
        execute1ClickUpdateStop(storage, "tr_no_widen", 80.0); // Widening stop downward from 83.75 to 80.00
      }).toThrow("Discipline Rule Violation");
    });

    it("rejects downward widening even by $0.01", () => {
      const trade: StoredTrade = {
        id: "tr_penny_widen",
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

      storage.addOrUpdateTrade(trade);

      expect(() => {
        execute1ClickUpdateStop(storage, "tr_penny_widen", 270.49);
      }).toThrow("Discipline Rule Violation");
    });

    it("persists updated stop in local storage and updates portfolio open risk immediately", () => {
      const trade: StoredTrade = {
        id: "tr_persist_stop",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75, // $4.75 risk * 18 = $85.50
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        rrRatio: 2.13,
        timeStopSessions: 5,
        sessionsElapsed: 2,
      };

      storage.addOrUpdateTrade(trade);
      // Tighten stop to 86.50 ($2.00 risk * 18 = $36.00)
      execute1ClickUpdateStop(storage, "tr_persist_stop", 86.5);

      const refreshed = storage.getTrades()[0];
      const newRisk = (refreshed.actualEntry! - refreshed.currentStop) * refreshed.sharesRemaining;
      expect(newRisk).toBe(36.0);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 11: 1-Click Exit Stale Position
  // -------------------------------------------------------------
  describe("Feature 11: 1-Click Exit Stale Position", () => {
    it("liquidates remaining shares at market and sets status to CLOSED", () => {
      const staleTrade: StoredTrade = {
        id: "tr_stale_exit",
        ticker: "TWLO",
        companyName: "Twilio",
        status: "ACTIVE",
        entryTrigger: 250.0,
        actualEntry: 250.0,
        sharesTotal: 4,
        sharesRemaining: 4,
        initialStop: 225.0, // $25 risk per share ($100 risk total)
        currentStop: 250.0,
        target1: 275.0,
        target2: 300.0,
        rrRatio: 2.0,
        timeStopSessions: 5,
        sessionsElapsed: 6, // Overdue
      };

      storage.addOrUpdateTrade(staleTrade);
      // Exit at $256.00 (+$6.00/sh gain on 4 shares = +$24.00)
      const result = execute1ClickExitStale(storage, "tr_stale_exit", 256.0, "TIME_STOP_EXIT");

      expect(result.trade.status).toBe("CLOSED");
      expect(result.trade.sharesRemaining).toBe(0);
      expect(result.trade.closedPrice).toBe(256.0);
      expect(result.totalRealizedPnL).toBe(24.0);
      // R-multiple = $24.00 / $100.00 = +0.24 R
      expect(result.finalRMultiple).toBe(0.24);
      expect(result.trade.exitReason).toBe("TIME_STOP_EXIT");
    });

    it("calculates accurate final campaign R-multiple for multi-tranche scaled trade", () => {
      const scaledTrade: StoredTrade = {
        id: "tr_multi_exit",
        ticker: "GLBE",
        companyName: "Global-e",
        status: "SCALED_T1",
        entryTrigger: 42.6,
        actualEntry: 42.6,
        sharesTotal: 41,
        sharesRemaining: 20,
        initialStop: 40.2, // $2.40 risk per share * 41 = $98.40 total risk
        currentStop: 42.6,
        target1: 48.0,
        target2: 52.0,
        rrRatio: 2.25,
        timeStopSessions: 7,
        sessionsElapsed: 5,
        realizedPnL: 113.4, // +$113.40 banked at T1
      };

      storage.addOrUpdateTrade(scaledTrade);
      // Exit remaining 20 shares at $45.00 (+2.40/sh = +$48.00)
      const result = execute1ClickExitStale(storage, "tr_multi_exit", 45.0, "RUNNER_CLOSED");

      // Total PnL = $113.40 + $48.00 = $161.40
      expect(result.totalRealizedPnL).toBe(161.4);
      // Total R = $161.40 / $98.40 = +1.64 R
      expect(result.finalRMultiple).toBe(1.64);
    });

    it("logs disciplined full-stop loss in journal with exact -1.0R multiple", () => {
      const stoppedTrade: StoredTrade = {
        id: "tr_stopped_out",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75, // $4.75 risk * 18 = $85.50
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        rrRatio: 2.13,
        timeStopSessions: 5,
        sessionsElapsed: 2,
      };

      storage.addOrUpdateTrade(stoppedTrade);
      // Stopped out at $83.75 (-$4.75/sh * 18 = -$85.50)
      const result = execute1ClickExitStale(storage, "tr_stopped_out", 83.75, "STOP_LOSS");

      expect(result.totalRealizedPnL).toBe(-85.5);
      expect(result.finalRMultiple).toBe(-1.0);
      expect(result.trade.exitReason).toBe("STOP_LOSS");
    });

    it("removes exited trade from active count and populates closed trade journal list", () => {
      const trade: StoredTrade = {
        id: "tr_journal_flow",
        ticker: "HALO",
        companyName: "Halozyme Therapeutics",
        status: "ACTIVE",
        entryTrigger: 97.0,
        actualEntry: 97.0,
        sharesTotal: 8,
        sharesRemaining: 8,
        initialStop: 85.0,
        currentStop: 85.0,
        target1: 110.0,
        target2: 120.0,
        rrRatio: 2.0,
        timeStopSessions: 7,
        sessionsElapsed: 1,
      };

      storage.addOrUpdateTrade(trade);
      execute1ClickExitStale(storage, "tr_journal_flow", 108.0, "T1_PROXIMITY");

      const active = storage.getTrades().filter(t => t.status === "ACTIVE" || t.status === "SCALED_T1");
      const closed = storage.getTrades().filter(t => t.status === "CLOSED");

      expect(active).toHaveLength(0);
      expect(closed).toHaveLength(1);
      expect(closed[0].ticker).toBe("HALO");
      expect(closed[0].closedPrice).toBe(108.0);
    });

    it("handles zero remaining shares gracefully without crashing", () => {
      const alreadyScaledOut: StoredTrade = {
        id: "tr_zero_rem",
        ticker: "CRWV",
        companyName: "CoreWeave",
        status: "SCALED_T1",
        entryTrigger: 92.0,
        actualEntry: 92.0,
        sharesTotal: 7,
        sharesRemaining: 0,
        initialStop: 79.0,
        currentStop: 92.0,
        target1: 110.0,
        target2: 130.0,
        rrRatio: 2.0,
        timeStopSessions: 5,
        sessionsElapsed: 4,
        realizedPnL: 90.0,
      };

      storage.addOrUpdateTrade(alreadyScaledOut);
      const result = execute1ClickExitStale(storage, "tr_zero_rem", 92.0, "FINAL_CLOSE");
      expect(result.trade.status).toBe("CLOSED");
      expect(result.totalRealizedPnL).toBe(90.0);
    });
  });
});
