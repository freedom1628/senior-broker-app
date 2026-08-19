// Unit Test Suite 3: Dual-Layer Persistence & Synchronization Engine
// Tests L1 In-Memory Cache, LocalStorage Fallbacks, Invariant Stop Protections, and Subscriptions

import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { LocalStoreService, InMemoryStorageAdapter } from "@/lib/storage/local-store";
import { Trade, UserSettings } from "@/lib/storage/types";

describe("Unit: Dual-Layer Persistence & Synchronization", () => {
  let store: LocalStoreService;
  let mockAdapter: InMemoryStorageAdapter;

  beforeEach(() => {
    mockAdapter = new InMemoryStorageAdapter();
    store = new LocalStoreService(mockAdapter);
  });

  it("1. initializes with default $15,000 swing sleeve settings", () => {
    const settings = store.getSettings();
    expect(settings.accountSize).toBe(15000.0);
    expect(settings.riskPerTrade).toBe(1.0);
    expect(settings.maxSleeveRiskPct).toBe(3.0);
    expect(settings.maxOpenPositions).toBe(3);
    expect(settings.maxSectorPositions).toBe(2);
  });

  it("2. saves and retrieves trade records atomically", () => {
    const trade: Trade = {
      id: "trade-test-1",
      ticker: "ATRO",
      companyName: "Astronics",
      status: "ACTIVE",
      entryTrigger: 89.2,
      actualEntry: 89.2,
      sharesTotal: 27,
      sharesRemaining: 27,
      initialStop: 83.75,
      currentStop: 83.75,
      target1: 100.1,
      target2: 108.28,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 1,
    };

    store.saveTrade(trade);
    const retrieved = store.getTrade("trade-test-1");
    expect(retrieved).toBeDefined();
    expect(retrieved?.ticker).toBe("ATRO");
    expect(retrieved?.status).toBe("ACTIVE");
    expect(retrieved?.sharesTotal).toBe(27);

    const allTrades = store.getTrades();
    expect(allTrades).toHaveLength(1);
    expect(allTrades[0].id).toBe("trade-test-1");
  });

  it("3. updates and persists user settings changes", () => {
    const updated = store.saveSettings({
      accountSize: 25000.0,
      riskPerTrade: 1.5,
    });

    expect(updated.accountSize).toBe(25000.0);
    expect(updated.riskPerTrade).toBe(1.5);

    const freshRead = store.getSettings();
    expect(freshRead.accountSize).toBe(25000.0);
    expect(freshRead.riskPerTrade).toBe(1.5);
  });

  it("4. preserves invariant: SCALED_T1 trade status is never regressed to ACTIVE", () => {
    const trade: Trade = {
      id: "trade-scaled-1",
      ticker: "AAPL",
      companyName: "Apple Inc.",
      status: "SCALED_T1",
      entryTrigger: 100.0,
      actualEntry: 100.0,
      sharesTotal: 50,
      sharesRemaining: 25,
      initialStop: 95.0,
      currentStop: 100.0, // Breakeven
      target1: 110.0,
      target2: 120.0,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 3,
    };

    store.saveTrade(trade);

    // Attempt to overwrite with stale status "ACTIVE"
    const staleTrade = { ...trade, status: "ACTIVE" as const };
    store.saveTrade(staleTrade);

    const check = store.getTrade("trade-scaled-1");
    expect(check?.status).toBe("SCALED_T1");
  });

  it("5. preserves invariant: stop loss can never be widened downwards", () => {
    const trade: Trade = {
      id: "trade-stop-lock",
      ticker: "NVDA",
      companyName: "NVIDIA",
      status: "ACTIVE",
      entryTrigger: 120.0,
      actualEntry: 120.0,
      sharesTotal: 30,
      sharesRemaining: 30,
      initialStop: 114.0,
      currentStop: 118.0, // Tightened stop
      target1: 132.0,
      target2: 144.0,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 1,
    };

    store.saveTrade(trade);

    // Attempt to widen stop down to 112.0
    const widenedTrade = { ...trade, currentStop: 112.0 };
    store.saveTrade(widenedTrade);

    const check = store.getTrade("trade-stop-lock");
    expect(check?.currentStop).toBe(118.0); // Stop remains at 118.0
  });

  it("6. notifies active subscribers upon trade mutations", () => {
    let notifiedCount = 0;
    let lastEventData: any = null;

    const unsubscribe = store.subscribe((typeOrState: any, payload?: any) => {
      notifiedCount++;
      lastEventData = payload || typeOrState;
    });

    const trade: Trade = {
      id: "trade-sub-test",
      ticker: "MSFT",
      companyName: "Microsoft",
      status: "ACTIVE",
      entryTrigger: 400.0,
      actualEntry: 400.0,
      sharesTotal: 10,
      sharesRemaining: 10,
      initialStop: 385.0,
      currentStop: 385.0,
      target1: 430.0,
      target2: 460.0,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 0,
    };

    store.saveTrade(trade);
    expect(notifiedCount).toBeGreaterThanOrEqual(1);

    // Unsubscribe and verify no further callbacks
    unsubscribe();
    const prevCount = notifiedCount;
    store.saveTrade({ ...trade, currentStop: 390.0 });
    expect(notifiedCount).toBe(prevCount);
  });

  it("7. records and retrieves journal entries with discipline scores", () => {
    const journal = {
      id: "journal-1",
      tradeId: "trade-1",
      ticker: "ATRO",
      setupType: "Base Breakout",
      entryDate: new Date().toISOString(),
      entryPrice: 89.2,
      exitPrice: 100.1,
      realizedPnL: 294.3,
      rMultiple: 2.0,
      disciplineScore: 5,
      followedRules: true,
      thesis: "High relative strength and earnings gap consolidation hold.",
    };

    store.saveJournalEntry(journal);
    const list = store.getJournal();
    expect(list).toHaveLength(1);
    expect(list[0].ticker).toBe("ATRO");
    expect(list[0].disciplineScore).toBe(5);
  });

  it("8. logs audit trail events accurately", () => {
    store.addAuditLog({
      actionType: "TRADE_CREATED",
      entityType: "TRADE",
      entityId: "trade-1",
      description: "Opened new swing trade ATRO 27 shares",
      source: "CLIENT_UI",
    });

    const logs = store.getAuditLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].actionType).toBe("TRADE_CREATED");
    expect(logs[0].description).toContain("ATRO");
  });

  it("9. executes unified state load and save roundtrip without data loss", async () => {
    const state = {
      portfolio: {
        dedicatedCapital: 15000,
        allocatedCapital: 2500,
        cashAvailable: 12500,
        openRiskDollars: 150,
        openRiskPct: 1.0,
        floatingPnL: 50,
        totalRealizedPnL: 500,
        winRate: 75.0,
        profitFactor: 2.5,
        totalTradesCount: 4,
        closedTradesCount: 3,
        avgRMultiple: 1.8,
        maxOpenPositions: 3,
        maxSectorPositions: 2,
        maxSleeveRiskPct: 3.0,
        riskPerTradePct: 1.0,
        updatedAt: new Date().toISOString(),
      },
      activeTrades: [
        {
          id: "trade-a",
          ticker: "AAPL",
          companyName: "Apple",
          status: "ACTIVE" as const,
          entryTrigger: 100,
          actualEntry: 100,
          sharesTotal: 10,
          sharesRemaining: 10,
          initialStop: 95,
          currentStop: 95,
          target1: 110,
          target2: 120,
          rrRatio: 2.0,
          timeStopSessions: 6,
          sessionsElapsed: 1,
        },
      ],
      pendingTrades: [],
      closedTrades: [],
      settings: {
        accountSize: 15000,
        riskPerTrade: 1.0,
        maxSleeveRiskPct: 3.0,
        maxOpenPositions: 3,
      },
    };

    await store.saveState(state as any);
    const loaded = await store.loadState();

    expect(loaded.portfolio.dedicatedCapital).toBe(15000);
    expect(loaded.activeTrades).toHaveLength(1);
    expect(loaded.activeTrades[0].ticker).toBe("AAPL");
  });

  it("10. handles storage quota exceeded errors gracefully without unhandled exceptions", () => {
    const throwingAdapter: any = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError: storage full");
      },
      removeItem: () => {},
      clear: () => {},
    };

    const resilientStore = new LocalStoreService(throwingAdapter);
    let error: any = null;
    try {
      resilientStore.saveSettings({ accountSize: 20000 });
    } catch (e) {
      error = e;
    }

    expect(error).toBeNull(); // Did not throw unhandled error
    expect(resilientStore.getSettings().accountSize).toBe(20000); // In-memory cache still holds state
  });
});
