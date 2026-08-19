// Tier 3 Pairwise Combinatorial Integration Test: Backup Export, State Wipe, Atomic Restore & Metric Parity
// Requirements: ORIGINAL_REQUEST §R6.2, §R2.3, §R1.1

import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade, BackupSnapshot } from "../helpers/mock-storage";
import { MockMarketEngine } from "../helpers/mock-market";
import { evaluateTrade } from "../../lib/market/rule-engine";

describe("Tier 3 Pairwise: Backup Snapshot, State Wipe, Atomic Restore & Metric Parity", () => {
  let storage: MockDualLayerStorage;
  let market: MockMarketEngine;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
    market = new MockMarketEngine();
  });

  // Helper to compute closed metrics
  function computeClosedMetrics(trades: StoredTrade[]) {
    const closed = trades.filter(t => t.status === "CLOSED");
    const totalRealizedPnL = Number(closed.reduce((acc, t) => acc + (t.realizedPnL || 0), 0).toFixed(2));
    const winTrades = closed.filter(t => (t.realizedPnL || 0) > 0);
    const winRate = closed.length > 0 ? Number(((winTrades.length / closed.length) * 100).toFixed(1)) : 0;
    const avgRMultiple = closed.length > 0
      ? Number((closed.reduce((acc, t) => acc + (t.rMultiple || 0), 0) / closed.length).toFixed(2))
      : 0;
    return { totalRealizedPnL, winRate, avgRMultiple, totalClosed: closed.length };
  }

  it("1. Builds a comprehensive multi-lifecycle portfolio state in storage", () => {
    // 1. Settings
    storage.saveSettings({
      accountSize: 18000.0,
      riskPerTrade: 1.0,
      maxSleeveRiskPct: 3.0,
      maxSectorPositions: 2,
      deskPasscode: "9876",
      theme: "obsidian",
    });

    // 2. Active Trade
    const activeTrade: StoredTrade = {
      id: "tr_bk_active",
      ticker: "ATRO",
      companyName: "Astronics Corporation",
      status: "ACTIVE",
      setupType: "Base Breakout",
      entryTrigger: 89.20,
      actualEntry: 88.50,
      entryDate: "2026-08-17T14:30:00Z",
      sharesTotal: 27,
      sharesRemaining: 27,
      initialStop: 83.75,
      currentStop: 83.75,
      target1: 100.10,
      target2: 112.00,
      rrRatio: 2.13,
      timeStopSessions: 6,
      sessionsElapsed: 2,
      notes: "High volume breakout hold",
    };

    // 3. Scaled Trade
    const scaledTrade: StoredTrade = {
      id: "tr_bk_scaled",
      ticker: "GLBE",
      companyName: "Global-e Online Ltd.",
      status: "SCALED_T1",
      setupType: "Catalyst Continuation",
      entryTrigger: 42.60,
      actualEntry: 42.60,
      entryDate: "2026-08-15T13:30:00Z",
      sharesTotal: 62,
      sharesRemaining: 31,
      initialStop: 40.20,
      currentStop: 42.60,
      target1: 47.40,
      target2: 51.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 4,
      realizedPnL: 148.80,
      notes: "Scaled 50% at T1, stop at B/E",
    };

    // 4. Pending Trade
    const pendingTrade: StoredTrade = {
      id: "tr_bk_pending",
      ticker: "MTRN",
      companyName: "Materion Corporation",
      status: "PENDING_ENTRY",
      setupType: "Pullback Flag",
      entryTrigger: 282.00,
      sharesTotal: 13,
      sharesRemaining: 13,
      initialStop: 270.50,
      currentStop: 270.50,
      target1: 305.00,
      target2: 328.00,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 0,
      notes: "Watching $282 pivot",
    };

    // 5. Closed Trade
    const closedTrade: StoredTrade = {
      id: "tr_bk_closed",
      ticker: "TWLO",
      companyName: "Twilio Inc.",
      status: "CLOSED",
      setupType: "Breakout",
      entryTrigger: 250.00,
      actualEntry: 250.00,
      entryDate: "2026-08-10T14:30:00Z",
      sharesTotal: 6,
      sharesRemaining: 0,
      initialStop: 225.00,
      currentStop: 250.00,
      target1: 275.00,
      target2: 300.00,
      rrRatio: 2.0,
      timeStopSessions: 5,
      sessionsElapsed: 5,
      closedPrice: 280.00,
      closedDate: "2026-08-15T19:30:00Z",
      realizedPnL: 180.00,
      rMultiple: 1.20,
      exitReason: "TARGET_1_REACHED",
      notes: "Closed full position ahead of earnings",
    };

    storage.saveTrades([activeTrade, scaledTrade, pendingTrade, closedTrade]);

    // 6. Notifications
    storage.addNotification({
      ticker: "ATRO",
      type: "ENTRY_TRIGGERED",
      title: "Entry Trigger Activated: ATRO",
      message: "ATRO crossed $89.20 pivot",
      isRead: true,
    });
    storage.addNotification({
      ticker: "GLBE",
      type: "TARGET_1_HIT",
      title: "Target 1 Hit: GLBE",
      message: "Scaled 50% at $47.40",
      isRead: false,
    });

    const trades = storage.getTrades();
    expect(trades).toHaveLength(4);
    expect(storage.getNotifications()).toHaveLength(2);
    expect(storage.getSettings().accountSize).toBe(18000.0);
  });

  it("2. Exports JSON backup snapshot and verifies schema and metadata compliance", () => {
    // Populate storage
    storage.saveSettings({ accountSize: 15000.0, deskPasscode: "5678" });
    storage.addOrUpdateTrade({
      id: "tr_exp_1",
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
    });

    const snapshot = storage.exportSnapshot();

    expect(snapshot.version).toBe("1.0.0");
    expect(snapshot.appVersion).toBe("Senior Broker 2.0");
    expect(typeof snapshot.exportedAt).toBe("string");
    expect(snapshot.settings.deskPasscode).toBe("5678");
    expect(snapshot.trades).toHaveLength(1);
    expect(snapshot.trades[0].ticker).toBe("ATRO");

    // Verify valid JSON serialization
    const serialized = JSON.stringify(snapshot);
    expect(serialized).toContain('"version":"1.0.0"');
    expect(serialized).toContain('"ticker":"ATRO"');
  });

  it("3. Performs complete state reset and verifies all records are wiped", () => {
    storage.addOrUpdateTrade({
      id: "tr_wipe_1",
      ticker: "ATRO",
      companyName: "Astronics Corporation",
      status: "ACTIVE",
      entryTrigger: 89.20,
      sharesTotal: 27,
      sharesRemaining: 27,
      initialStop: 83.75,
      currentStop: 83.75,
      target1: 100.10,
      target2: 112.00,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 1,
    });
    storage.addNotification({
      ticker: "ATRO",
      type: "ENTRY_TRIGGERED",
      title: "Test",
      message: "Test msg",
      isRead: false,
    });

    expect(storage.getTrades()).toHaveLength(1);
    expect(storage.getNotifications()).toHaveLength(1);

    // Hard Reset
    storage.resetAll();

    expect(storage.getTrades()).toHaveLength(0);
    expect(storage.getNotifications()).toHaveLength(0);
    // Re-seeds default settings
    expect(storage.getSettings().accountSize).toBe(15000.0);
    expect(storage.getSettings().deskPasscode).toBe("1234");
  });

  it("4. Restores exported snapshot atomically from JSON string with full record fidelity", () => {
    const originalTrade: StoredTrade = {
      id: "tr_restore_target",
      ticker: "CRWV",
      companyName: "CoreWeave Inc.",
      status: "SCALED_T1",
      entryTrigger: 92.00,
      actualEntry: 92.00,
      entryDate: "2026-08-18T14:30:00Z",
      sharesTotal: 16,
      sharesRemaining: 8,
      initialStop: 83.00,
      currentStop: 92.00, // Breakeven
      target1: 110.00,
      target2: 130.00,
      rrRatio: 2.0,
      timeStopSessions: 5,
      sessionsElapsed: 3,
      realizedPnL: 144.00,
      notes: "Scaled 8 shares at $110",
    };

    storage.saveSettings({ accountSize: 25000.0, deskPasscode: "4321" });
    storage.addOrUpdateTrade(originalTrade);
    storage.addNotification({
      ticker: "CRWV",
      type: "TARGET_1_HIT",
      title: "T1 Reached",
      message: "CRWV reached $110.00",
      isRead: true,
    });

    const exportedString = JSON.stringify(storage.exportSnapshot());

    // Reset storage
    storage.resetAll();
    expect(storage.getTrades()).toHaveLength(0);

    // Restore from string
    const result = storage.importSnapshot(exportedString);

    expect(result.success).toBe(true);
    expect(result.restoredTradesCount).toBe(1);
    expect(result.restoredNotificationsCount).toBe(1);

    const restoredTrades = storage.getTrades();
    expect(restoredTrades).toHaveLength(1);
    expect(restoredTrades[0].ticker).toBe("CRWV");
    expect(restoredTrades[0].status).toBe("SCALED_T1");
    expect(restoredTrades[0].sharesRemaining).toBe(8);
    expect(restoredTrades[0].currentStop).toBe(92.00);
    expect(restoredTrades[0].realizedPnL).toBe(144.00);
    expect(storage.getSettings().accountSize).toBe(25000.0);
    expect(storage.getSettings().deskPasscode).toBe("4321");
  });

  it("5. Confirms exact metric parity before backup and after restore across all metrics", () => {
    const trade1: StoredTrade = {
      id: "tr_m1",
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
      id: "tr_m2",
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
      id: "tr_m3",
      ticker: "NIQ",
      companyName: "NIQ Global Intelligence",
      status: "CLOSED",
      entryTrigger: 16.25,
      actualEntry: 16.25,
      sharesTotal: 111,
      sharesRemaining: 0,
      initialStop: 14.90,
      currentStop: 14.90,
      target1: 18.95,
      target2: 21.00,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 1,
      realizedPnL: -155.40,
      rMultiple: -1.04,
      exitReason: "HARD_STOP",
    };

    storage.saveTrades([trade1, trade2, trade3]);
    const metricsBefore = computeClosedMetrics(storage.getTrades());

    const snapshot = storage.exportSnapshot();
    storage.resetAll();
    storage.importSnapshot(snapshot);

    const metricsAfter = computeClosedMetrics(storage.getTrades());

    expect(metricsAfter.totalRealizedPnL).toBe(metricsBefore.totalRealizedPnL);
    expect(metricsAfter.winRate).toBe(metricsBefore.winRate);
    expect(metricsAfter.avgRMultiple).toBe(metricsBefore.avgRMultiple);
    expect(metricsAfter.totalClosed).toBe(metricsBefore.totalClosed);
    expect(metricsAfter.totalRealizedPnL).toBe(413.50); // 151.90 + 417.00 - 155.40
    expect(metricsAfter.winRate).toBe(66.7);
    expect(metricsAfter.avgRMultiple).toBe(1.0);
  });

  it("6. Runs Rule Engine evaluations on restored trades against live ticks without state loss", () => {
    const activeTrade: StoredTrade = {
      id: "tr_eval_restored",
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
      sessionsElapsed: 2,
    };

    storage.addOrUpdateTrade(activeTrade);
    const snapshot = storage.exportSnapshot();
    storage.resetAll();
    storage.importSnapshot(snapshot);

    const restoredTrade = storage.getTrades()[0];

    // Live tick reaches Target 1 ($100.25)
    market.setPrice("ATRO", 100.25);
    const evalRes = evaluateTrade(restoredTrade, market.getQuote("ATRO"));

    expect(evalRes.alertType).toBe("TARGET_1_HIT");
    expect(evalRes.currentRMultiple).toBeCloseTo(2.03, 2);
    expect(evalRes.unrealizedPnL).toBeCloseTo(298.35, 1);
  });

  it("7. Rejects corrupted JSON strings with descriptive errors and preserves current state", () => {
    // Current valid state
    storage.addOrUpdateTrade({
      id: "tr_safe",
      ticker: "ATRO",
      companyName: "Astronics Corporation",
      status: "ACTIVE",
      entryTrigger: 89.20,
      sharesTotal: 27,
      sharesRemaining: 27,
      initialStop: 83.75,
      currentStop: 83.75,
      target1: 100.10,
      target2: 112.00,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 0,
    });

    const corruptJson = "{ version: '1.0.0', broken json syntax ...";
    const result = storage.importSnapshot(corruptJson);

    expect(result.success).toBe(false);
    expect(result.error).toContain("JSON parse error");

    // Existing data is untouched
    expect(storage.getTrades()).toHaveLength(1);
    expect(storage.getTrades()[0].ticker).toBe("ATRO");
  });

  it("8. Rejects snapshots missing required schema fields without partial data contamination", () => {
    // 1. Missing version
    const noVersion = { settings: storage.getSettings(), trades: [] };
    const res1 = storage.importSnapshot(noVersion as any);
    expect(res1.success).toBe(false);
    expect(res1.error).toContain("Missing snapshot version");

    // 2. Missing settings
    const noSettings = { version: "1.0.0", trades: [] };
    const res2 = storage.importSnapshot(noSettings as any);
    expect(res2.success).toBe(false);
    expect(res2.error).toContain("Missing or invalid settings");

    // 3. Trades not an array
    const badTrades = { version: "1.0.0", settings: storage.getSettings(), trades: "invalid" };
    const res3 = storage.importSnapshot(badTrades as any);
    expect(res3.success).toBe(false);
    expect(res3.error).toContain("Trades field must be an array");

    // 4. Invalid trade element (missing entry / stop)
    const invalidTradeElement = {
      version: "1.0.0",
      settings: storage.getSettings(),
      trades: [{ id: "bad_trade", ticker: "ATRO" }], // missing entryTrigger, initialStop
    };
    const res4 = storage.importSnapshot(invalidTradeElement as any);
    expect(res4.success).toBe(false);
    expect(res4.error).toContain("Invalid trade item");
  });

  it("9. Queues offline changes and maintains backup export consistency during offline mode", () => {
    storage.setOnline(false);
    expect(storage.isOnline).toBe(false);

    storage.saveSettings({ accountSize: 30000.0 });
    storage.addOrUpdateTrade({
      id: "tr_offline_1",
      ticker: "GLBE",
      companyName: "Global-e Online Ltd.",
      status: "ACTIVE",
      entryTrigger: 42.60,
      sharesTotal: 50,
      sharesRemaining: 50,
      initialStop: 40.20,
      currentStop: 40.20,
      target1: 47.40,
      target2: 51.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 0,
    });

    expect(storage.pendingSyncQueue.length).toBeGreaterThanOrEqual(1);

    // Exporting snapshot while offline includes pending local state
    const snapshot = storage.exportSnapshot();
    expect(snapshot.settings.accountSize).toBe(30000.0);
    expect(snapshot.trades).toHaveLength(1);

    // Come back online
    storage.setOnline(true);
    expect(storage.isOnline).toBe(true);
    expect(storage.pendingSyncQueue).toHaveLength(0);
  });

  it("10. Supports snapshot forward compatibility with optional annotations and meta fields", () => {
    const richSnapshot: BackupSnapshot = {
      version: "1.0.0",
      exportedAt: "2026-08-19T20:00:00Z",
      appVersion: "Senior Broker 2.0",
      settings: storage.getSettings(),
      trades: [
        {
          id: "tr_rich_meta",
          ticker: "ATRO",
          companyName: "Astronics Corporation",
          status: "ACTIVE",
          entryTrigger: 89.20,
          sharesTotal: 27,
          sharesRemaining: 27,
          initialStop: 83.75,
          currentStop: 83.75,
          target1: 100.10,
          target2: 112.00,
          rrRatio: 2.0,
          timeStopSessions: 6,
          sessionsElapsed: 1,
          notes: "Extra notes",
        },
      ],
      notifications: [],
      meta: {
        exportedBy: "Senior Trader",
        environment: "Cloudflare Edge Pages",
        checksum: "sha256-abcdef123456",
      },
    };

    const res = storage.importSnapshot(richSnapshot);
    expect(res.success).toBe(true);
    expect(storage.getTrades()).toHaveLength(1);
    expect(storage.getTrades()[0].ticker).toBe("ATRO");
  });
});
