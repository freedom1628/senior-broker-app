// Verification test suite for Test Infrastructure, Assertion Framework, Mock Storage, and Mock Market

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade } from "../helpers/mock-storage";
import { MockMarketEngine } from "../helpers/mock-market";

describe("Test Infrastructure & Assertion Framework", () => {
  let hookCounter = 0;

  beforeAll(() => {
    hookCounter += 10;
  });

  beforeEach(() => {
    hookCounter += 1;
  });

  afterEach(() => {
    // Teardown
  });

  afterAll(() => {
    // Suite complete
  });

  it("evaluates strict equality (toBe and not.toBe)", () => {
    expect(42).toBe(42);
    expect("hello").toBe("hello");
    expect(true).toBe(true);
    expect(null).toBe(null);
    expect(undefined).toBe(undefined);

    expect(42).not.toBe(43);
    expect("hello").not.toBe("world");
    expect(true).not.toBe(false);
  });

  it("evaluates deep equality (toEqual and not.toEqual)", () => {
    const objA = { ticker: "ATRO", risk: 150, levels: [88.5, 95.0, 100.0] };
    const objB = { ticker: "ATRO", risk: 150, levels: [88.5, 95.0, 100.0] };
    const objC = { ticker: "ATRO", risk: 150, levels: [88.5, 95.0, 102.0] };

    expect(objA).toEqual(objB);
    expect(objA).not.toEqual(objC);

    const mapA = new Map([["key1", 100]]);
    const mapB = new Map([["key1", 100]]);
    expect(mapA).toEqual(mapB);

    const setA = new Set([1, 2, 3]);
    const setB = new Set([1, 2, 3]);
    expect(setA).toEqual(setB);
  });

  it("evaluates floating point precision (toBeCloseTo)", () => {
    const calculatedR = 0.1 + 0.2;
    expect(calculatedR).toBeCloseTo(0.3, 2);
    expect(150.004).toBeCloseTo(150.0, 2);
    expect(150.5).not.toBeCloseTo(150.0, 1);
  });

  it("evaluates comparisons (gt, lt, gte, lte)", () => {
    expect(100).toBeGreaterThan(50);
    expect(50).toBeLessThan(100);
    expect(100).toBeGreaterThanOrEqual(100);
    expect(100).toBeGreaterThanOrEqual(99);
    expect(50).toBeLessThanOrEqual(50);
    expect(50).toBeLessThanOrEqual(51);

    expect(50).not.toBeGreaterThan(100);
    expect(100).not.toBeLessThan(50);
  });

  it("evaluates null, undefined, defined, truthy, falsy", () => {
    expect(null).toBeNull();
    expect(undefined).not.toBeNull();

    expect(undefined).toBeUndefined();
    expect(null).not.toBeUndefined();

    expect("value").toBeDefined();
    expect(0).toBeDefined();
    expect(false).toBeDefined();

    expect(1).toBeTruthy();
    expect("yes").toBeTruthy();
    expect({}).toBeTruthy();

    expect(0).toBeFalsy();
    expect("").toBeFalsy();
    expect(null).toBeFalsy();
  });

  it("evaluates container matching and lengths (toContain, toHaveLength)", () => {
    expect(["ATRO", "MTRN", "GLBE"]).toContain("MTRN");
    expect(["ATRO", "MTRN"]).not.toContain("TWLO");
    expect("Swing Trading Coach").toContain("Trading");
    expect("Swing Trading Coach").not.toContain("Forex");

    expect([1, 2, 3, 4]).toHaveLength(4);
    expect("Senior Broker").toHaveLength(13);
    expect(new Set(["A", "B"])).toHaveLength(2);
  });

  it("evaluates object subset matching (toMatchObject)", () => {
    const fullTrade = {
      id: "tr_1",
      ticker: "ATRO",
      entry: 88.5,
      stop: 83.75,
      shares: 18,
      status: "ACTIVE",
      tags: ["breakout", "earnings"],
    };

    expect(fullTrade).toMatchObject({
      ticker: "ATRO",
      entry: 88.5,
      status: "ACTIVE",
    });

    expect(fullTrade).not.toMatchObject({
      ticker: "GLBE",
    });
  });

  it("evaluates exception handling (toThrow and not.toThrow)", () => {
    const invalidAction = () => {
      throw new Error("Risk cap of 3.0% exceeded");
    };
    const validAction = () => {
      return 150;
    };

    expect(invalidAction).toThrow();
    expect(invalidAction).toThrow("Risk cap");
    expect(invalidAction).toThrow(/3\.0%/);
    expect(validAction).not.toThrow();
  });

  it("supports asynchronous test execution and promise matchers", async () => {
    const asyncFetch = async () => {
      return { ticker: "ATRO", price: 88.95 };
    };

    const data = await asyncFetch();
    expect(data.ticker).toBe("ATRO");
    expect(data.price).toBeGreaterThan(80);

    const failingPromise = async () => {
      throw new Error("Network timeout");
    };

    await expect(failingPromise).rejects("Network timeout");
    await expect(asyncFetch).resolves();
  });

  it("executes lifecycle hooks in proper order", () => {
    // beforeAll added 10, each beforeEach added 1
    expect(hookCounter).toBeGreaterThanOrEqual(11);
  });
});

describe("Dual-Layer Persistence Simulator", () => {
  let storage: MockDualLayerStorage;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
  });

  it("initializes with default $15,000 swing sleeve parameters", () => {
    const settings = storage.getSettings();
    expect(settings.accountSize).toBe(15000.0);
    expect(settings.riskPerTrade).toBe(1.0);
    expect(settings.maxSleeveRiskPct).toBe(3.0);
    expect(settings.maxSectorPositions).toBe(2);
    expect(settings.deskPasscode).toBe("1234");
  });

  it("saves and retrieves trade records atomically", () => {
    const trade: StoredTrade = {
      id: "tr_test_1",
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
      sessionsElapsed: 2,
    };

    storage.addOrUpdateTrade(trade);
    const trades = storage.getTrades();
    expect(trades).toHaveLength(1);
    expect(trades[0].ticker).toBe("ATRO");
    expect(trades[0].sharesRemaining).toBe(18);

    // Update trade (e.g. scale 50% & move stop to breakeven)
    trade.status = "SCALED_T1";
    trade.sharesRemaining = 9;
    trade.currentStop = 88.5; // Breakeven
    trade.realizedPnL = 104.4;

    storage.addOrUpdateTrade(trade);
    const updatedTrades = storage.getTrades();
    expect(updatedTrades).toHaveLength(1);
    expect(updatedTrades[0].status).toBe("SCALED_T1");
    expect(updatedTrades[0].sharesRemaining).toBe(9);
    expect(updatedTrades[0].currentStop).toBe(88.5);
  });

  it("handles offline queued mutations and flushes on reconnection", () => {
    storage.setOnline(false);
    storage.saveSettings({ accountSize: 20000.0 });

    expect(storage.isOnline).toBe(false);
    expect(storage.pendingSyncQueue).toHaveLength(1);

    storage.setOnline(true);
    expect(storage.isOnline).toBe(true);
    expect(storage.pendingSyncQueue).toHaveLength(0);
    expect(storage.getSettings().accountSize).toBe(20000.0);
  });

  it("exports and imports valid JSON snapshots", () => {
    storage.addOrUpdateTrade({
      id: "tr_snapshot_test",
      ticker: "MTRN",
      companyName: "Materion Corporation",
      status: "ACTIVE",
      entryTrigger: 282.0,
      sharesTotal: 8,
      sharesRemaining: 8,
      initialStop: 270.5,
      currentStop: 270.5,
      target1: 305.0,
      target2: 328.0,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 1,
    });

    const snapshot = storage.exportSnapshot();
    expect(snapshot.version).toBe("1.0.0");
    expect(snapshot.trades).toHaveLength(1);
    expect(snapshot.trades[0].ticker).toBe("MTRN");

    // Wipe state
    storage.resetAll();
    expect(storage.getTrades()).toHaveLength(0);

    // Restore state
    const result = storage.importSnapshot(snapshot);
    expect(result.success).toBe(true);
    expect(result.restoredTradesCount).toBe(1);
    expect(storage.getTrades()).toHaveLength(1);
    expect(storage.getTrades()[0].ticker).toBe("MTRN");
  });

  it("rejects corrupted snapshot payloads with descriptive error", () => {
    const corruptSnapshot = "{ invalid json payload";
    const result = storage.importSnapshot(corruptSnapshot);
    expect(result.success).toBe(false);
    expect(result.error).toContain("JSON parse error");

    const malformedObject = { version: "1.0.0", settings: null, trades: "not-an-array" };
    const result2 = storage.importSnapshot(malformedObject as any);
    expect(result2.success).toBe(false);
    expect(result2.error).toContain("Missing or invalid settings");
  });
});

describe("Mock Market Engine & Session Progression", () => {
  let market: MockMarketEngine;

  beforeEach(() => {
    market = new MockMarketEngine();
  });

  it("provides live quotes for core swing trading candidates", () => {
    const quote = market.getQuote("ATRO");
    expect(quote.ticker).toBe("ATRO");
    expect(quote.price).toBe(88.95);
    expect(quote.volume).toBeGreaterThan(1000000);

    const spy = market.getQuote("SPY");
    expect(spy.price).toBeGreaterThan(700);
  });

  it("dispatches live tick events on price updates", () => {
    let receivedTick: any = null;
    const unsubscribe = market.subscribeTicks(tick => {
      receivedTick = tick;
    });

    market.setPrice("ATRO", 95.5);
    expect(receivedTick).not.toBeNull();
    expect(receivedTick.ticker).toBe("ATRO");
    expect(receivedTick.price).toBe(95.5);

    unsubscribe();
    market.setPrice("ATRO", 98.0);
    // Unsubscribed, so receivedTick should still be 95.5
    expect(receivedTick.price).toBe(95.5);
  });

  it("simulates breakout and gap-down moves correctly", () => {
    const breakoutHistory = market.simulateBreakout("ATRO", 100.0, 4);
    expect(breakoutHistory).toHaveLength(4);
    expect(market.getQuote("ATRO").price).toBe(100.0);

    const gapQuote = market.simulateGapDown("ATRO", 10); // 10% gap down
    expect(gapQuote.price).toBe(90.0);
  });

  it("advances trading sessions while skipping weekends", () => {
    const initial = market.getSessionInfo();
    expect(initial.sessionIndex).toBe(1);

    const advanced = market.advanceSession(5); // 5 trading sessions
    expect(advanced.sessionIndex).toBe(6);

    const advancedDate = market.getSessionInfo().date;
    const dayOfWeek = advancedDate.getDay();
    expect(dayOfWeek).not.toBe(0); // Not Sunday
    expect(dayOfWeek).not.toBe(6); // Not Saturday
  });
});
