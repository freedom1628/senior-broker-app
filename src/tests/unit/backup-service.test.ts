// Unit Test Suite 4: 1-Click JSON Snapshot Backup & Restore Engine
// Tests Export Generation, SHA-256 Verification, Zod/Schema Validation, Dry-Run, Overwrite, Merge, and Legacy Migrations

import { describe, it, expect, beforeEach } from "../helpers/assertions";
import {
  generateBackupSnapshot,
  validateBackupSnapshot,
  restoreBackupSnapshot,
  computePayloadChecksum,
  canonicalJsonStringify,
  BackupService,
} from "@/lib/storage/backup-service";
import { LocalStoreService, InMemoryStorageAdapter } from "@/lib/storage/local-store";
import { Trade } from "@/lib/storage/types";

describe("Unit: Snapshot Backup & Restore Validation Engine", () => {
  let store: LocalStoreService;
  let service: BackupService;

  beforeEach(() => {
    store = new LocalStoreService(new InMemoryStorageAdapter());
    service = new BackupService(store);
  });

  it("1. generates a complete backup snapshot with 64-character SHA-256 checksum", async () => {
    const trade: Trade = {
      id: "trade-snap-1",
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

    const snapshot = await service.exportSnapshot();
    expect(snapshot.version).toBe(1);
    expect(snapshot.app).toBe("senior-broker-app");
    expect(typeof snapshot.checksum).toBe("string");
    expect(snapshot.checksum.length).toBe(64); // Hex SHA-256 length
    expect(snapshot.metadata?.totalTrades).toBe(1);
    expect(snapshot.metadata?.accountSize).toBe(15000.0);
    expect(snapshot.data.trades).toHaveLength(1);
    expect(snapshot.data.trades[0].ticker).toBe("ATRO");
  });

  it("2. produces deterministic canonical JSON serialization regardless of key order", () => {
    const objA = { b: 2, a: 1, nested: { y: "hello", x: [3, 2, 1] } };
    const objB = { nested: { x: [3, 2, 1], y: "hello" }, a: 1, b: 2 };

    const strA = canonicalJsonStringify(objA);
    const strB = canonicalJsonStringify(objB);

    expect(strA).toBe(strB);
  });

  it("3. imports and atomically restores valid snapshot in OVERWRITE mode", async () => {
    const exportData = await service.exportSnapshot();
    const jsonString = JSON.stringify(exportData);

    // Clear store
    store.clearAll();
    expect(store.getTrades()).toHaveLength(0);

    // Restore
    const res = await service.importSnapshot(jsonString, "OVERWRITE");
    expect(res.success).toBe(true);
    expect(res.mode).toBe("OVERWRITE");
    expect(res.recordCounts).toBeDefined();
  });

  it("4. detects tampered data and rejects snapshot with invalid checksum", async () => {
    const validSnapshot = await service.exportSnapshot();

    // Tamper with data without recalculating checksum
    const tampered = {
      ...validSnapshot,
      data: {
        ...validSnapshot.data,
        settings: {
          ...validSnapshot.data.settings,
          accountSize: 999999.0, // Tampered value
        },
      },
    };

    const res = await validateBackupSnapshot(tampered);
    expect(res.isValid).toBe(false);
    expect(res.checksumValid).toBe(false);
    expect(res.errors.some((e) => e.message.includes("Checksum verification failed"))).toBe(true);
  });

  it("5. rejects malformed JSON string syntax", async () => {
    const res = await validateBackupSnapshot("{ invalid: json syntax [ }");
    expect(res.isValid).toBe(false);
    expect(res.errors[0].message).toContain("Malformed JSON");
  });

  it("6. rejects snapshot with incompatible application identifier", async () => {
    const foreignSnapshot = {
      version: 1,
      app: "other-crypto-broker-app",
      data: { trades: [] },
    };

    const res = await validateBackupSnapshot(foreignSnapshot);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.message.includes("Incompatible application identifier"))).toBe(true);
  });

  it("7. rejects snapshot with invalid data types in portfolio block", async () => {
    const badSnapshot = {
      version: 1,
      app: "senior-broker-app",
      data: {
        portfolio: {
          totalCapital: "fifteen thousand", // Bad type
        },
        trades: [],
      },
    };

    const res = await validateBackupSnapshot(badSnapshot);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.message.includes("must be a positive number"))).toBe(true);
  });

  it("8. performs DRY_RUN diffing preview without mutating existing storage", async () => {
    // Current store has 1 trade (AAPL)
    store.saveTrade({
      id: "trade-aapl",
      ticker: "AAPL",
      companyName: "Apple",
      status: "ACTIVE",
      entryTrigger: 100,
      sharesTotal: 10,
      sharesRemaining: 10,
      initialStop: 95,
      currentStop: 95,
      target1: 110,
      target2: 120,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 1,
      createdAt: "2026-08-10T10:00:00Z",
      updatedAt: "2026-08-10T10:00:00Z",
    });

    // Incoming snapshot has AAPL (newer timestamp) and NVDA (brand new)
    const incomingPayload = {
      version: 1,
      app: "senior-broker-app",
      data: {
        trades: [
          {
            id: "trade-aapl",
            ticker: "AAPL",
            companyName: "Apple",
            status: "SCALED_T1",
            entryTrigger: 100,
            sharesTotal: 10,
            sharesRemaining: 5,
            initialStop: 95,
            currentStop: 100,
            target1: 110,
            target2: 120,
            rrRatio: 2.0,
            timeStopSessions: 6,
            sessionsElapsed: 2,
            createdAt: "2026-08-10T10:00:00Z",
            updatedAt: "2026-08-18T10:00:00Z", // Newer
          },
          {
            id: "trade-nvda",
            ticker: "NVDA",
            companyName: "NVIDIA",
            status: "ACTIVE",
            entryTrigger: 120,
            sharesTotal: 20,
            sharesRemaining: 20,
            initialStop: 114,
            currentStop: 114,
            target1: 132,
            target2: 144,
            rrRatio: 2.0,
            timeStopSessions: 6,
            sessionsElapsed: 0,
            createdAt: "2026-08-18T10:00:00Z",
          },
        ],
      },
    };

    const dryRunRes = await service.importSnapshot(incomingPayload, "DRY_RUN");
    expect(dryRunRes.success).toBe(true);
    expect(dryRunRes.mode).toBe("DRY_RUN");
    expect(dryRunRes.stats?.tradesCreated).toBe(1); // NVDA
    expect(dryRunRes.stats?.tradesUpdated).toBe(1); // AAPL

    // Verify storage was NOT modified during dry-run
    const activeTrades = store.getTrades();
    expect(activeTrades).toHaveLength(1);
    expect(activeTrades[0].id).toBe("trade-aapl");
    expect(activeTrades[0].status).toBe("ACTIVE");
  });

  it("9. executes MERGE mode using Last-Write-Wins and leaves newer local records untouched", async () => {
    // Local trade AAPL has recent update (2026-08-19)
    store.saveTrade({
      id: "trade-aapl",
      ticker: "AAPL",
      companyName: "Apple",
      status: "SCALED_T1",
      entryTrigger: 100,
      sharesTotal: 10,
      sharesRemaining: 5,
      initialStop: 95,
      currentStop: 100,
      target1: 110,
      target2: 120,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 3,
      updatedAt: "2026-08-19T12:00:00Z", // Very new local update
    });

    // Incoming snapshot has older AAPL (2026-08-15) and new TSLA trade
    const incomingPayload = {
      version: 1,
      app: "senior-broker-app",
      data: {
        trades: [
          {
            id: "trade-aapl",
            ticker: "AAPL",
            companyName: "Apple",
            status: "ACTIVE",
            entryTrigger: 100,
            sharesTotal: 10,
            sharesRemaining: 10,
            initialStop: 95,
            currentStop: 95,
            target1: 110,
            target2: 120,
            rrRatio: 2.0,
            timeStopSessions: 6,
            sessionsElapsed: 1,
            updatedAt: "2026-08-15T10:00:00Z", // Older
          },
          {
            id: "trade-tsla",
            ticker: "TSLA",
            companyName: "Tesla",
            status: "ACTIVE",
            entryTrigger: 200,
            sharesTotal: 15,
            sharesRemaining: 15,
            initialStop: 190,
            currentStop: 190,
            target1: 220,
            target2: 240,
            rrRatio: 2.0,
            timeStopSessions: 6,
            sessionsElapsed: 0,
            updatedAt: "2026-08-18T10:00:00Z",
          },
        ],
      },
    };

    const mergeRes = await service.importSnapshot(incomingPayload, "MERGE");
    expect(mergeRes.success).toBe(true);

    const mergedTrades = store.getTrades();
    expect(mergedTrades).toHaveLength(2); // AAPL and TSLA

    // Local newer AAPL remains untouched (status SCALED_T1)
    const aapl = store.getTrade("trade-aapl");
    expect(aapl?.status).toBe("SCALED_T1");
    expect(aapl?.currentStop).toBe(100);

    // New TSLA is imported
    const tsla = store.getTrade("trade-tsla");
    expect(tsla).toBeDefined();
    expect(tsla?.ticker).toBe("TSLA");
  });

  it("10. migrates legacy v0 snapshots to schema version 1.0.0", async () => {
    const legacySnapshot = {
      version: 0,
      app: "senior-broker-app",
      data: {
        portfolio: {
          dedicatedCapital: 10000.0,
          allocatedCapital: 2000.0,
          cashAvailable: 8000.0,
        },
        trades: [
          {
            id: "leg-1",
            ticker: "PLTR",
            companyName: "Palantir",
            status: "ACTIVE",
            entryTrigger: 25.0,
            sharesTotal: 100,
            initialStop: 23.5,
            currentStop: 23.5,
            target1: 28.0,
            target2: 30.25,
            rrRatio: 2.0,
          },
        ],
      },
    };

    const validation = await validateBackupSnapshot(legacySnapshot);
    expect(validation.isValid).toBe(true);
    expect(validation.versionRestored).toBe(1);
    expect(validation.warnings.some((w) => w.includes("Migrating legacy v0"))).toBe(true);

    const res = await service.importSnapshot(legacySnapshot, "OVERWRITE");
    expect(res.success).toBe(true);
    expect(res.versionRestored).toBe(1);

    const importedTrade = store.getTrade("leg-1");
    expect(importedTrade?.timeStopSessions).toBe(6); // default injected
    expect(importedTrade?.sharesRemaining).toBe(100);
  });

  it("11. rejects unsupported future versions (e.g. version 99)", async () => {
    const futureSnapshot = {
      version: 99,
      app: "senior-broker-app",
      data: { trades: [] },
    };

    const validation = await validateBackupSnapshot(futureSnapshot);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.message.includes("Unsupported snapshot version"))).toBe(true);
  });
});
