// Adversarial Verification Suite: Dual-Layer Persistence & Backup/Restore Engine
// Milestone 1 (M1) Empirical Challenger Verification

import { describe, it, expect, beforeEach } from "../helpers/assertions";
import {
  LocalStoreService,
  InMemoryStorageAdapter,
  DEFAULT_USER_SETTINGS,
  DEFAULT_PORTFOLIO_STATE,
} from "../../lib/storage/local-store";
import {
  generateBackupSnapshot,
  validateBackupSnapshot,
  restoreBackupSnapshot,
  computePayloadChecksum,
  canonicalJsonStringify,
  BackupService,
  BackupSnapshotEnvelope,
} from "../../lib/storage/backup-service";
import { Trade, StorageAdapter, UserSettings, PortfolioState } from "../../lib/storage/types";

class FaultyStorageAdapter implements StorageAdapter {
  public memory = new Map<string, string>();
  public shouldFailSetItem: boolean = false;
  public shouldFailGetItem: boolean = false;
  public shouldFailRemoveItem: boolean = false;
  public shouldFailClear: boolean = false;
  public quotaLimitBytes: number = Infinity;

  getItem(key: string): string | null {
    if (this.shouldFailGetItem) {
      throw new Error("DOMException: Failed to read from storage");
    }
    return this.memory.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.shouldFailSetItem) {
      const quotaErr = new Error("DOMException: QuotaExceededError - The quota has been exceeded.");
      quotaErr.name = "QuotaExceededError";
      throw quotaErr;
    }
    const currentSize = Array.from(this.memory.values()).reduce((acc, v) => acc + v.length, 0);
    if (currentSize + value.length > this.quotaLimitBytes) {
      const quotaErr = new Error("DOMException: QuotaExceededError - The quota has been exceeded.");
      quotaErr.name = "QuotaExceededError";
      throw quotaErr;
    }
    this.memory.set(key, String(value));
  }

  removeItem(key: string): void {
    if (this.shouldFailRemoveItem) {
      throw new Error("DOMException: Failed to remove item from storage");
    }
    this.memory.delete(key);
  }

  clear(): void {
    if (this.shouldFailClear) {
      throw new Error("DOMException: Failed to clear storage");
    }
    this.memory.clear();
  }
}

describe("Adversarial Verification: Dual-Layer Persistence & Backup/Restore Engine", () => {
  let faultyAdapter: FaultyStorageAdapter;
  let store: LocalStoreService;
  let backupService: BackupService;

  beforeEach(() => {
    faultyAdapter = new FaultyStorageAdapter();
    store = new LocalStoreService(faultyAdapter);
    backupService = new BackupService(store);
  });

  describe("Adversarial 1: Corrupted Payloads, Malformed Checksums & Boundary Inputs", () => {
    it("rejects non-object and primitive root values (null, numbers, strings, arrays, booleans)", async () => {
      const primitives = [null, undefined, 12345, "just a string", true, false, [1, 2, 3]];
      for (const val of primitives) {
        const res = await validateBackupSnapshot(val as any);
        expect(res.isValid).toBe(false);
        expect(res.errors.length).toBeGreaterThan(0);
      }
    });

    it("rejects truncated or severely malformed JSON strings", async () => {
      const malformedJsonStrings = [
        "",
        "   ",
        "{",
        "{\"version\": 1,",
        "{\"version\": 1, \"app\": \"senior-broker-app\", \"data\": {",
        "undefined",
        "NaN",
        "<xml><payload></payload></xml>",
        "{\"version\": 1, \"checksum\": [1,2,3]}",
      ];

      for (const str of malformedJsonStrings) {
        const res = await validateBackupSnapshot(str);
        expect(res.isValid).toBe(false);
        expect(res.errors.length).toBeGreaterThan(0);
      }
    });

    it("rejects snapshot with missing or incompatible app identifier", async () => {
      const badApps = [
        { version: 1, app: "", data: { trades: [] } },
        { version: 1, app: "senior-trader-clone", data: { trades: [] } },
        { version: 1, app: 12345, data: { trades: [] } },
        { version: 1, data: { trades: [] } },
      ];

      for (const payload of badApps) {
        const res = await validateBackupSnapshot(payload);
        expect(res.isValid).toBe(false);
        expect(res.errors.some((e) => e.path === "app")).toBe(true);
      }
    });

    it("rejects snapshot with unsupported future or negative versions", async () => {
      const badVersions = [
        { version: 11, app: "senior-broker-app", data: { trades: [] } },
        { version: 999, app: "senior-broker-app", data: { trades: [] } },
        { app: "senior-broker-app", data: { trades: [] } },
      ];

      for (const payload of badVersions) {
        const res = await validateBackupSnapshot(payload);
        expect(res.isValid).toBe(false);
        expect(res.errors.some((e) => e.path === "version")).toBe(true);
      }
    });

    it("detects tampered payload with altered numbers, swapped tickers, or modified stops", async () => {
      const trade: Trade = {
        id: "t-valid-1",
        ticker: "NVDA",
        companyName: "NVIDIA",
        status: "ACTIVE",
        entryTrigger: 120,
        sharesTotal: 25,
        sharesRemaining: 25,
        initialStop: 114,
        currentStop: 114,
        target1: 132,
        target2: 144,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 0,
      };
      store.saveTrade(trade);

      const validSnapshot = await backupService.exportSnapshot();
      expect(validSnapshot.checksum.length).toBe(64);

      const tamperedA = JSON.parse(JSON.stringify(validSnapshot));
      tamperedA.data.settings.accountSize = 1000000;
      const resA = await validateBackupSnapshot(tamperedA);
      expect(resA.isValid).toBe(false);
      expect(resA.checksumValid).toBe(false);

      const tamperedB = JSON.parse(JSON.stringify(validSnapshot));
      tamperedB.data.trades[0].ticker = "MALICIOUS";
      const resB = await validateBackupSnapshot(tamperedB);
      expect(resB.isValid).toBe(false);
      expect(resB.checksumValid).toBe(false);

      const tamperedC = JSON.parse(JSON.stringify(validSnapshot));
      tamperedC.data.trades.push({
        id: "t-injected",
        ticker: "GHOST",
        companyName: "Ghost",
        status: "ACTIVE",
        entryTrigger: 50,
        sharesTotal: 10,
        sharesRemaining: 10,
        initialStop: 45,
        currentStop: 45,
        target1: 60,
        target2: 70,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 0,
      });
      const resC = await validateBackupSnapshot(tamperedC);
      expect(resC.isValid).toBe(false);
      expect(resC.checksumValid).toBe(false);
    });

    it("rejects snapshot with corrupted or malformed checksum string format", async () => {
      const validSnapshot = await backupService.exportSnapshot();
      const badChecksums = [
        "bad-checksum",
        "12345",
        "ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ",
        "0000000000000000000000000000000000000000000000000000000000000000",
      ];

      for (const cs of badChecksums) {
        const payload = { ...validSnapshot, checksum: cs };
        const res = await validateBackupSnapshot(payload);
        expect(res.isValid).toBe(false);
        expect(res.checksumValid).toBe(false);
      }
    });

    it("validates deep trade schema: rejects missing id, missing ticker, or invalid initialStop", async () => {
      const invalidTrades = [
        { ticker: "AAPL", initialStop: 100 },
        { id: "t1", initialStop: 100 },
        { id: "t2", ticker: "AAPL", initialStop: "invalid-stop" },
        { id: 12345, ticker: "AAPL", initialStop: 100 },
        { id: "t3", ticker: 9999, initialStop: 100 },
      ];

      for (let i = 0; i < invalidTrades.length; i++) {
        const payload = {
          version: 1,
          app: "senior-broker-app",
          data: {
            trades: [invalidTrades[i]],
          },
        };
        const res = await validateBackupSnapshot(payload);
        expect(res.isValid).toBe(false);
        expect(res.errors.length).toBeGreaterThan(0);
      }
    });

    it("validates deep portfolio schema: rejects negative capital and invalid types", async () => {
      const badPortfolios = [
        { totalCapital: -1000 },
        { totalCapital: "ten thousand" },
        { dedicatedCapital: -500 },
        { dedicatedCapital: null },
      ];

      for (const p of badPortfolios) {
        const payload = {
          version: 1,
          app: "senior-broker-app",
          data: {
            portfolio: p,
            trades: [],
          },
        };
        const res = await validateBackupSnapshot(payload);
        expect(res.isValid).toBe(false);
        expect(res.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Adversarial 2: Prototype Pollution & Injection Resistance", () => {
    it("safely ingests JSON with __proto__, constructor, and prototype properties without poisoning Object.prototype", async () => {
      const maliciousJson = JSON.stringify({
        version: 1,
        app: "senior-broker-app",
        __proto__: {
          isAdmin: true,
          polluted: "YES",
        },
        data: {
          settings: {
            accountSize: 15000,
            __proto__: { rootAccess: true },
            constructor: { prototype: { hacked: true } },
          },
          trades: [
            {
              id: "trade-poison-1",
              ticker: "EVIL",
              companyName: "Evil Corp",
              status: "ACTIVE",
              entryTrigger: 100,
              sharesTotal: 10,
              sharesRemaining: 10,
              initialStop: 90,
              currentStop: 90,
              target1: 120,
              target2: 140,
              rrRatio: 2.0,
              timeStopSessions: 6,
              sessionsElapsed: 0,
              __proto__: { isVulnerable: true },
            },
          ],
        },
      });

      const res = await backupService.importSnapshot(maliciousJson, "OVERWRITE");
      expect(res.success).toBe(true);

      const cleanObj: any = {};
      expect(cleanObj.isAdmin).toBeUndefined();
      expect(cleanObj.polluted).toBeUndefined();
      expect(cleanObj.rootAccess).toBeUndefined();
      expect(cleanObj.hacked).toBeUndefined();
      expect(cleanObj.isVulnerable).toBeUndefined();

      const trade = store.getTrade("trade-poison-1");
      expect(trade).toBeDefined();
      expect(trade?.ticker).toBe("EVIL");
    });

    it("safely stores and restores extreme XSS, Unicode, emoji, and control character strings in trade notes", async () => {
      const adversarialStrings = [
        "<script>alert(document.cookie)</script>",
        "<img src=x onerror=alert('xss')>",
        "'; DROP TABLE trades; --",
        "\u0000\u0001\u0002\u0003\u0004\u001f",
        "🚀💰📈 Multi-line \n \r \t formatting ñáéíóú 中文 日本語 한국어 العربية",
        "A".repeat(50000),
      ];

      for (let i = 0; i < adversarialStrings.length; i++) {
        const t: Trade = {
          id: `trade-xss-${i}`,
          ticker: `SYM${i}`,
          companyName: `Company ${i}`,
          status: "ACTIVE",
          entryTrigger: 50 + i,
          sharesTotal: 10,
          sharesRemaining: 10,
          initialStop: 45 + i,
          currentStop: 45 + i,
          target1: 60 + i,
          target2: 70 + i,
          rrRatio: 2.0,
          timeStopSessions: 6,
          sessionsElapsed: 0,
          notes: adversarialStrings[i],
        };
        store.saveTrade(t);
      }

      expect(store.getTrades()).toHaveLength(adversarialStrings.length);

      const snapshot = await backupService.exportSnapshot();
      expect(snapshot.checksum.length).toBe(64);

      const newStore = new LocalStoreService(new InMemoryStorageAdapter());
      const newBackup = new BackupService(newStore);
      const restoreRes = await newBackup.importSnapshot(snapshot, "OVERWRITE");

      expect(restoreRes.success).toBe(true);
      expect(newStore.getTrades()).toHaveLength(adversarialStrings.length);

      const largeTrade = newStore.getTrade(`trade-xss-${adversarialStrings.length - 1}`);
      expect(largeTrade?.notes).toBe("A".repeat(50000));
    });
  });

  describe("Adversarial 3: Storage Quota Overflow & Storage Engine Failure Resilience", () => {
    it("continues functioning via L1 in-memory cache when localStorage.setItem throws QuotaExceededError", () => {
      faultyAdapter.shouldFailSetItem = true;

      expect(() => {
        store.saveSettings({ accountSize: 20000.0 });
      }).not.toThrow();

      expect(() => {
        store.saveTrade({
          id: "trade-quota-1",
          ticker: "TSLA",
          companyName: "Tesla",
          status: "ACTIVE",
          entryTrigger: 200,
          sharesTotal: 10,
          sharesRemaining: 10,
          initialStop: 190,
          currentStop: 190,
          target1: 220,
          target2: 240,
          rrRatio: 2.0,
          timeStopSessions: 6,
          sessionsElapsed: 0,
        });
      }).not.toThrow();

      expect(() => {
        store.updatePortfolio({ floatingPnL: 350.0 });
      }).not.toThrow();

      expect(() => {
        store.addAuditLog({
          actionType: "TRADE_CREATED",
          entityType: "TRADE",
          entityId: "trade-quota-1",
          description: "Trade created under quota error",
          source: "CLIENT_UI",
        });
      }).not.toThrow();

      expect(store.getSettings().accountSize).toBe(20000.0);
      expect(store.getTrade("trade-quota-1")?.ticker).toBe("TSLA");
      expect(store.getPortfolio().floatingPnL).toBe(350.0);
      expect(store.getAuditLogs().length).toBeGreaterThan(0);
    });

    it("recovers gracefully from QuotaExceededError when space becomes available", () => {
      faultyAdapter.quotaLimitBytes = 300;

      store.saveTrade({
        id: "trade-big-1",
        ticker: "NVDA",
        companyName: "NVIDIA Corporation Long Name Holding",
        status: "ACTIVE",
        entryTrigger: 100,
        sharesTotal: 50,
        sharesRemaining: 50,
        initialStop: 90,
        currentStop: 90,
        target1: 120,
        target2: 140,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 1,
        notes: "Initial entry notes for swing setup testing quota recovery",
      });

      expect(store.getTrades()).toHaveLength(1);

      faultyAdapter.quotaLimitBytes = Infinity;

      store.saveTrade({
        id: "trade-big-2",
        ticker: "AAPL",
        companyName: "Apple",
        status: "ACTIVE",
        entryTrigger: 150,
        sharesTotal: 20,
        sharesRemaining: 20,
        initialStop: 140,
        currentStop: 140,
        target1: 170,
        target2: 190,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 0,
      });

      const persistedRaw = faultyAdapter.getItem("senior_broker_custom_positions");
      expect(persistedRaw).toBeDefined();
      const parsed = JSON.parse(persistedRaw!);
      expect(parsed).toHaveLength(2);
    });

    it("handles StorageAdapter throwing on clear() during clearAll() without crashing", () => {
      faultyAdapter.shouldFailClear = true;
      expect(() => {
        store.clearAll();
      }).not.toThrow();

      expect(store.getTrades()).toHaveLength(0);
      expect(store.getSettings().accountSize).toBe(15000.0);
    });
  });

  describe("Adversarial 4: Stop-Loss Regression Prevention & State Machine Invariants", () => {
    it("REJECTS downward stop-loss widening attempt on ACTIVE trade", () => {
      const initialTrade: Trade = {
        id: "trade-stop-defense",
        ticker: "AMD",
        companyName: "Advanced Micro Devices",
        status: "ACTIVE",
        entryTrigger: 100,
        sharesTotal: 10,
        sharesRemaining: 10,
        initialStop: 90,
        currentStop: 95,
        target1: 120,
        target2: 140,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 2,
      };
      store.saveTrade(initialTrade);

      const maliciousUpdate: Trade = {
        ...initialTrade,
        currentStop: 85,
        updatedAt: new Date().toISOString(),
      };
      const result = store.saveTrade(maliciousUpdate);

      expect(result.currentStop).toBe(95);
      expect(store.getTrade("trade-stop-defense")?.currentStop).toBe(95);
    });

    it("PERMITS upward stop-loss tightening (ratchet rule)", () => {
      const trade: Trade = {
        id: "trade-stop-tighten",
        ticker: "AMD",
        companyName: "Advanced Micro Devices",
        status: "ACTIVE",
        entryTrigger: 100,
        sharesTotal: 10,
        sharesRemaining: 10,
        initialStop: 90,
        currentStop: 90,
        target1: 120,
        target2: 140,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 1,
      };
      store.saveTrade(trade);

      const tightened1 = store.saveTrade({ ...trade, currentStop: 95 });
      expect(tightened1.currentStop).toBe(95);

      const tightened2 = store.saveTrade({ ...trade, currentStop: 100 });
      expect(tightened2.currentStop).toBe(100);

      const tightened3 = store.saveTrade({ ...trade, currentStop: 105 });
      expect(tightened3.currentStop).toBe(105);

      const rejectedLower = store.saveTrade({ ...trade, currentStop: 102 });
      expect(rejectedLower.currentStop).toBe(105);
    });

    it("PREVENTS status regression from SCALED_T1 back to ACTIVE", () => {
      const scaledTrade: Trade = {
        id: "trade-scaled-defense",
        ticker: "MSFT",
        companyName: "Microsoft",
        status: "SCALED_T1",
        entryTrigger: 400,
        sharesTotal: 10,
        sharesRemaining: 5,
        initialStop: 380,
        currentStop: 400,
        target1: 440,
        target2: 480,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 3,
      };
      store.saveTrade(scaledTrade);
      expect(store.getTrade("trade-scaled-defense")?.status).toBe("SCALED_T1");

      const regressionAttempt: Trade = {
        ...scaledTrade,
        status: "ACTIVE",
        sharesRemaining: 10,
        currentStop: 380,
      };

      const result = store.saveTrade(regressionAttempt);

      expect(result.status).toBe("SCALED_T1");
      expect(result.currentStop).toBe(400);
      expect(store.getTrade("trade-scaled-defense")?.status).toBe("SCALED_T1");
      expect(store.getTrade("trade-scaled-defense")?.currentStop).toBe(400);
    });

    it("protects against stop regression during MERGE restore with stale or spoofed incoming snapshot", async () => {
      store.saveTrade({
        id: "trade-msft-sync",
        ticker: "MSFT",
        companyName: "Microsoft",
        status: "SCALED_T1",
        entryTrigger: 400,
        sharesTotal: 10,
        sharesRemaining: 5,
        initialStop: 380,
        currentStop: 400,
        target1: 440,
        target2: 480,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 3,
        updatedAt: "2026-08-19T12:00:00Z",
      });

      const staleSnapshot = {
        version: 1,
        app: "senior-broker-app",
        data: {
          trades: [
            {
              id: "trade-msft-sync",
              ticker: "MSFT",
              companyName: "Microsoft",
              status: "ACTIVE",
              entryTrigger: 400,
              sharesTotal: 10,
              sharesRemaining: 10,
              initialStop: 380,
              currentStop: 380,
              target1: 440,
              target2: 480,
              rrRatio: 2.0,
              timeStopSessions: 6,
              sessionsElapsed: 1,
              updatedAt: "2026-08-19T08:00:00Z",
            },
          ],
        },
      };

      const mergeRes = await backupService.importSnapshot(staleSnapshot, "MERGE");
      expect(mergeRes.success).toBe(true);
      expect(mergeRes.stats?.tradesUnchanged).toBe(1);

      const msft = store.getTrade("trade-msft-sync");
      expect(msft?.status).toBe("SCALED_T1");
      expect(msft?.currentStop).toBe(400);
      expect(msft?.sharesRemaining).toBe(5);

      const spoofedFutureSnapshot = {
        version: 1,
        app: "senior-broker-app",
        data: {
          trades: [
            {
              id: "trade-msft-sync",
              ticker: "MSFT",
              companyName: "Microsoft",
              status: "ACTIVE",
              entryTrigger: 400,
              sharesTotal: 10,
              sharesRemaining: 10,
              initialStop: 380,
              currentStop: 380,
              target1: 440,
              target2: 480,
              rrRatio: 2.0,
              timeStopSessions: 6,
              sessionsElapsed: 1,
              updatedAt: "2099-01-01T00:00:00Z",
            },
          ],
        },
      };

      const spoofRes = await backupService.importSnapshot(spoofedFutureSnapshot, "MERGE");
      expect(spoofRes.success).toBe(true);

      const msftAfterSpoof = store.getTrade("trade-msft-sync");
      expect(msftAfterSpoof?.status).toBe("SCALED_T1");
      expect(msftAfterSpoof?.currentStop).toBe(400);
    });
  });

  describe("Adversarial 5: Multi-Instance Conflict Resolution (DRY_RUN vs OVERWRITE vs MERGE)", () => {
    it("executes DRY_RUN with 100% zero side-effects on local data", async () => {
      store.saveTrade({
        id: "tr-1",
        ticker: "AAPL",
        companyName: "Apple",
        status: "ACTIVE",
        entryTrigger: 100,
        sharesTotal: 10,
        sharesRemaining: 10,
        initialStop: 90,
        currentStop: 90,
        target1: 120,
        target2: 140,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 1,
      });

      store.saveSettings({ accountSize: 18000.0 });

      const incomingPayload = {
        version: 1,
        app: "senior-broker-app",
        data: {
          settings: {
            accountSize: 99000.0,
          },
          trades: [
            {
              id: "tr-1",
              ticker: "AAPL",
              companyName: "Apple Inc",
              status: "SCALED_T1",
              entryTrigger: 100,
              sharesTotal: 10,
              sharesRemaining: 5,
              initialStop: 90,
              currentStop: 100,
              target1: 120,
              target2: 140,
              rrRatio: 2.0,
              timeStopSessions: 6,
              sessionsElapsed: 2,
              updatedAt: "2099-01-01T00:00:00Z",
            },
            {
              id: "tr-2",
              ticker: "GOOGL",
              companyName: "Alphabet",
              status: "ACTIVE",
              entryTrigger: 150,
              sharesTotal: 15,
              sharesRemaining: 15,
              initialStop: 140,
              currentStop: 140,
              target1: 170,
              target2: 190,
              rrRatio: 2.0,
              timeStopSessions: 6,
              sessionsElapsed: 0,
            },
          ],
        },
      };

      const dryRunRes = await backupService.importSnapshot(incomingPayload, "DRY_RUN");
      expect(dryRunRes.success).toBe(true);
      expect(dryRunRes.mode).toBe("DRY_RUN");
      expect(dryRunRes.stats?.tradesCreated).toBe(1);
      expect(dryRunRes.stats?.tradesUpdated).toBe(1);
      expect(dryRunRes.stats?.settingsApplied).toBe(true);

      expect(store.getSettings().accountSize).toBe(18000.0);
      expect(store.getTrades()).toHaveLength(1);
      expect(store.getTrade("tr-1")?.status).toBe("ACTIVE");
      expect(store.getTrade("tr-2")).toBeUndefined();
    });

    it("executes OVERWRITE mode completely resetting previous records and restoring incoming snapshot", async () => {
      store.saveTrade({
        id: "old-1",
        ticker: "OLD1",
        companyName: "Old 1",
        status: "ACTIVE",
        entryTrigger: 10,
        sharesTotal: 10,
        sharesRemaining: 10,
        initialStop: 9,
        currentStop: 9,
        target1: 12,
        target2: 14,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 0,
      });

      const overwritePayload = {
        version: 1,
        app: "senior-broker-app",
        data: {
          settings: { accountSize: 25000.0, riskPerTrade: 1.5, maxOpenPositions: 4 },
          trades: [
            {
              id: "new-1",
              ticker: "NEW1",
              companyName: "New 1",
              status: "ACTIVE",
              entryTrigger: 50,
              sharesTotal: 20,
              sharesRemaining: 20,
              initialStop: 45,
              currentStop: 45,
              target1: 60,
              target2: 70,
              rrRatio: 2.0,
              timeStopSessions: 6,
              sessionsElapsed: 0,
            },
          ],
        },
      };

      const overwriteRes = await backupService.importSnapshot(overwritePayload, "OVERWRITE");
      expect(overwriteRes.success).toBe(true);
      expect(overwriteRes.mode).toBe("OVERWRITE");

      expect(store.getTrade("old-1")).toBeUndefined();
      expect(store.getTrades()).toHaveLength(1);
      expect(store.getTrade("new-1")?.ticker).toBe("NEW1");
      expect(store.getSettings().accountSize).toBe(25000.0);
    });

    it("handles missing or invalid timestamps in MERGE mode without throwing errors", async () => {
      store.saveTrade({
        id: "tr-no-time",
        ticker: "TEST",
        companyName: "Test Corp",
        status: "ACTIVE",
        entryTrigger: 100,
        sharesTotal: 10,
        sharesRemaining: 10,
        initialStop: 90,
        currentStop: 90,
        target1: 120,
        target2: 140,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 0,
      });

      const payloadWithMalformedDates = {
        version: 1,
        app: "senior-broker-app",
        data: {
          trades: [
            {
              id: "tr-no-time",
              ticker: "TEST",
              companyName: "Test Corp",
              status: "ACTIVE",
              entryTrigger: 100,
              sharesTotal: 10,
              sharesRemaining: 10,
              initialStop: 90,
              currentStop: 90,
              target1: 120,
              target2: 140,
              rrRatio: 2.0,
              timeStopSessions: 6,
              sessionsElapsed: 0,
              updatedAt: "not-a-valid-date-string",
            },
          ],
        },
      };

      const res = await backupService.importSnapshot(payloadWithMalformedDates, "MERGE");
      expect(res.success).toBe(true);
    });
  });

  describe("Adversarial 6: Subscription & Cross-Tab Notification Resilience", () => {
    it("handles error-throwing subscribers without terminating notifications for other subscribers", () => {
      let listenerBExecuted = false;

      store.subscribe(() => {
        throw new Error("Malicious / crashed subscriber");
      });

      store.subscribe((type: any, data: any) => {
        if (type === "TRADE_SAVED") {
          listenerBExecuted = true;
        }
      });

      expect(() => {
        store.saveTrade({
          id: "tr-sub-test",
          ticker: "SUB",
          companyName: "Subscriber Corp",
          status: "ACTIVE",
          entryTrigger: 50,
          sharesTotal: 10,
          sharesRemaining: 10,
          initialStop: 45,
          currentStop: 45,
          target1: 60,
          target2: 70,
          rrRatio: 2.0,
          timeStopSessions: 6,
          sessionsElapsed: 0,
        });
      }).not.toThrow();

      expect(listenerBExecuted).toBe(true);
    });
  });
});
