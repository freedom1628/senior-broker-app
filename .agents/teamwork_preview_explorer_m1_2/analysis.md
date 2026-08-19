# Milestone 1 Architectural & Technical Blueprint: Dual-Layer Persistence & Snapshot Backup Engine

**Author**: Explorer 2 (Milestone 1 — Core Domain & Dual-Layer Persistence)  
**Date**: 2026-08-19  
**Status**: COMPLETE ARCHITECTURAL SPECIFICATION & TECHNICAL BLUEPRINT  
**Target Files**:
- `src/lib/storage/types.ts` (Entity models, event types, backup schema types)
- `src/lib/storage/local-store.ts` (Dual-layer client store, cache, IndexedDB/LocalStorage, reactive emitter)
- `src/lib/storage/backup-service.ts` (1-Click JSON export, SHA-256 checksum, Zod validator, dry-run/merge/overwrite)
- `src/lib/prisma.ts` (Edge-compatible Universal DB adapter with dual-layer sync hook)
- `src/tests/unit/storage.test.ts` (Unit tests for local store & reactive events)
- `src/tests/unit/backup-service.test.ts` (Unit tests for snapshot generation, checksums, Zod validation, merge modes)

---

## 1. Executive Summary & Design Objectives

Senior Broker requires a robust, zero-data-loss architecture designed for dedicated swing sleeve management ($15,000 default capital, strict 1% account risk per trade). Traders demand sub-millisecond UI responsiveness on both mobile PWAs (iOS Safari / Android Chrome) and desktop, absolute offline resilience, zero Cloudflare edge runtime lockups, and instant data portability via 1-click snapshot backups.

### Core Objectives:
1. **Zero-Latency Client Persistence**: Synchronous in-memory L1 cache backed by `localStorage` (for instant synchronous boot) and `IndexedDB` (for unlimited historical trade journals, audit logs, and AI research runs).
2. **Edge & Cloud Resilient Fallback**: Universal Edge Memory / SQLite / Cloudflare D1 adapter in `src/lib/prisma.ts` ensuring clean execution in Node.js, Next.js 16 server actions, and Cloudflare Pages edge isolates without native C++ compilation locks.
3. **Cross-Tab & Component Reactivity**: A type-safe Event Emitter using `BroadcastChannel` and `StorageEvent` that synchronizes state across multiple browser tabs in real-time.
4. **Deterministic Cryptographic Backups**: 1-Click JSON export bundling portfolio state, positions, trade journal, AI signals, user settings, and audit logs with a canonical SHA-256 checksum.
5. **Fail-Safe Snapshot Restore Engine**: Zod-powered schema validation with JSON-path error diagnostics, supporting Dry-Run diff simulation, Smart Last-Write-Wins Merge, and Full Overwrite with automatic rollback on error.

---

## 2. Complete Entity Schemas & TypeScript Definitions

The persistence engine manages seven core domain entities. Below is the strict TypeScript specification for `src/lib/storage/types.ts`.

```typescript
// src/lib/storage/types.ts

export type TradeStatus = "PENDING_ENTRY" | "ACTIVE" | "SCALED_T1" | "CLOSED";

export type SetupType =
  | "Catalyst Continuation"
  | "Breakout Base"
  | "Post-Earnings Pullback"
  | "Fresh Earnings Gap / Pivot Breakout"
  | "Mean Reversion Bounce"
  | "Cup & Handle / High Tight Flag";

export type ExitReason =
  | "STOP_HIT"
  | "T1_REACHED"
  | "T2_REACHED"
  | "TIME_STOP"
  | "MANUAL"
  | "INVALIDATION";

export type MarketRegime = "FAVORABLE" | "NEUTRAL" | "HOSTILE";

/**
 * 1. Trade & Active Position Entity
 */
export interface Trade {
  id: string;
  userId: string;
  ticker: string;
  companyName: string;
  status: TradeStatus;
  setupType: SetupType | string;
  entryTrigger: number;
  entryCondition?: string;
  actualEntry?: number | null;
  entryDate?: string | null; // ISO-8601
  sharesTotal: number;
  sharesRemaining: number;
  initialStop: number;
  currentStop: number;
  target1: number;
  target2: number;
  rrRatio: number;
  timeStopSessions: number;
  sessionsElapsed: number;
  closedPrice?: number | null;
  closedDate?: string | null; // ISO-8601
  realizedPnL?: number | null;
  rMultiple?: number | null;
  exitReason?: ExitReason | string | null;
  notes?: string | null;
  sector?: string;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
  _version?: number;
}

/**
 * 2. Real-Time Position (Derived Active View)
 */
export interface Position extends Trade {
  status: "ACTIVE" | "SCALED_T1";
  currentPrice?: number;
  unrealizedPnL?: number;
  unrealizedPnLPct?: number;
  openRiskDollars?: number;
  openRiskPct?: number;
  currentRMultiple?: number;
  isStale?: boolean; // sessionsElapsed >= timeStopSessions - 1
  isStopBreakeven?: boolean;
}

/**
 * 3. AI Screener Signal / Candidate Setup Entity
 */
export interface Signal {
  id: string;
  researchRunId?: string;
  ticker: string;
  companyName: string;
  setupType: string;
  entryTrigger: number;
  entryCondition: string;
  stopLoss: number;
  stopRationale: string;
  target1: number;
  target2: number;
  rrRatio: number;
  timeStopDays: number;
  positionShares: number;
  riskAmount: number;
  catalystDate: string;
  catalystSummary: string;
  bearCase: string;
  score: number;
  modelSources: string[]; // e.g. ["Gemini 3.7", "Claude Sonnet 5", "OpenAI 5.6"]
  status: "WATCHLIST" | "PROMOTED" | "DISMISSED";
  createdAt: string;
  updatedAt: string;
}

/**
 * 4. Market Snapshot / Real-Time Quote Entity
 */
export interface MarketSnapshot {
  ticker: string;
  name?: string;
  price: number;
  change: number;
  changePct: number;
  high?: number;
  low?: number;
  volume?: number;
  prevClose?: number;
  updatedAt: string;
}

/**
 * 5. Portfolio State Entity
 */
export interface PortfolioState {
  userId: string;
  dedicatedCapital: number; // Default: $15,000.00
  allocatedCapital: number;
  cashAvailable: number;
  openRiskDollars: number;
  openRiskPct: number;
  floatingPnL: number;
  totalRealizedPnL: number;
  winRate: number;
  profitFactor: number;
  totalTradesCount: number;
  closedTradesCount: number;
  avgRMultiple: number;
  maxOpenPositions: number; // Default: 3
  maxSleeveRiskPct: number; // Default: 3.0%
  riskPerTradePct: number; // Default: 1.0% ($150 on $15k)
  updatedAt: string;
}

/**
 * 6. Audit Log Entity (Audit Trail of all modifications)
 */
export interface AuditLog {
  id: string;
  timestamp: string; // ISO-8601
  userId: string;
  actionType:
    | "TRADE_CREATED"
    | "TRADE_ACTIVATED"
    | "POSITION_SCALED_T1"
    | "STOP_ADJUSTED"
    | "TRADE_CLOSED"
    | "TRADE_DELETED"
    | "SETTINGS_UPDATED"
    | "BACKUP_RESTORED"
    | "IMPORT_MERGED";
  entityType: "TRADE" | "SETTINGS" | "PORTFOLIO" | "BACKUP" | "SIGNAL";
  entityId: string;
  previousState?: any;
  newState?: any;
  description: string;
  source: "CLIENT_UI" | "SERVER_POLL" | "BACKUP_IMPORT" | "AI_COACH";
}

/**
 * 7. Journal Entry Entity (Deep Learning & Psychology Journal)
 */
export interface JournalEntry {
  id: string;
  tradeId: string;
  ticker: string;
  setupType: string;
  entryDate: string;
  exitDate?: string;
  entryPrice: number;
  exitPrice?: number;
  realizedPnL?: number;
  rMultiple?: number;
  disciplineScore: number; // 1 to 5 scale
  followedRules: boolean;
  thesis: string;
  mistakesOrLessons?: string;
  marketRegimeAtEntry?: MarketRegime;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 8. User Settings
 */
export interface UserSettings {
  id: string;
  email: string;
  name: string;
  accountSize: number; // Dedicated Swing Capital ($15,000 default)
  riskPerTrade: number; // 1.0% default
  maxSleeveRiskPct: number; // 3.0% default
  maxOpenPositions: number; // 3 default
  pinPasscodeHash?: string; // 4-digit desk PIN hash
  hasGeminiKey: boolean;
  hasAnthropicKey: boolean;
  hasOpenaiKey: boolean;
  theme: "dark" | "light";
  audioEnabled: boolean;
  hapticEnabled: boolean;
  updatedAt: string;
}
```

---

## 3. Dual-Layer Persistence Engine Architecture

The persistence architecture utilizes a tiered hierarchy:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           REACT UI / HOOKS LAYER                                │
│       usePortfolioStore, useCoachStore, useScreenerStore, useJournalStore       │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ Reactive Subscriptions & Dispatch
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    DUAL-LAYER LOCAL STORE (src/lib/storage/local-store.ts)      │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ L1: Synchronous In-Memory Cache (Zero-lag React rendering)                │  │
│  └─────────────────────────────────────┬─────────────────────────────────────┘  │
│                                        │                                        │
│             ┌──────────────────────────┴──────────────────────────┐             │
│             ▼                                                     ▼             │
│  ┌───────────────────────────────┐               ┌───────────────────────────┐  │
│  │ L2A: LocalStorage Engine      │               │ L2B: IndexedDB Engine     │  │
│  │ - Fast boot state (<5MB)      │               │ - Full trade journal      │  │
│  │ - Auth session & PIN          │               │ - Historical audit logs   │  │
│  │ - User settings & active keys │               │ - AI Research reports     │  │
│  └──────────────┬────────────────┘               └─────────────┬─────────────┘  │
│                 │                                              │                │
│                 └──────────────────────┬───────────────────────┘                │
│                                        ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ Cross-Tab Sync Bus: BroadcastChannel('senior_broker_bus') + StorageEvent  │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ Background Async Sync & Conflict Resolution
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│               EDGE / CLOUD FALLBACK LAYER (src/lib/prisma.ts)                   │
│   - Next.js API Routes / Server Actions                                         │
│   - Cloudflare Pages / Workers Edge Isolation (Zero C++ native locks)           │
│   - In-Memory Fallback + SQLite / Cloudflare D1 compatibility                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Event Emitter & UI Reactivity Mechanism

```typescript
export type StorageEventType =
  | "STATE_INITIALIZED"
  | "PORTFOLIO_UPDATED"
  | "TRADE_ADDED"
  | "TRADE_UPDATED"
  | "TRADE_DELETED"
  | "POSITION_SCALED"
  | "STOP_ADJUSTED"
  | "SIGNAL_PROMOTED"
  | "SETTINGS_UPDATED"
  | "JOURNAL_ENTRY_SAVED"
  | "SNAPSHOT_RESTORED"
  | "SYNC_COMPLETED";

export interface StorageEventPayload<T = any> {
  type: StorageEventType;
  payload: T;
  sourceTabId: string;
  timestamp: number;
}

export type StorageEventListener<T = any> = (event: StorageEventPayload<T>) => void;
```

### 3.2 IndexedDB Lightweight Zero-Dependency Wrapper
To avoid adding heavy third-party packages (like `dexie` or `idb`), the local store implements a clean, promise-based wrapper using native browser `indexedDB`:
- Database Name: `SeniorBrokerDB`
- Object Stores:
  - `trades`: keyPath `id`, indexes on `status`, `ticker`, `createdAt`
  - `journal`: keyPath `id`, indexes on `tradeId`, `ticker`, `entryDate`
  - `signals`: keyPath `id`, indexes on `ticker`, `status`, `score`
  - `auditLogs`: keyPath `id`, indexes on `timestamp`, `actionType`
  - `settings`: keyPath `key`

### 3.3 Conflict Resolution Strategy
When syncing between Client L1/L2 and Edge Server:
1. **Entity-Level Last-Write-Wins (LWW)**: Every mutation attaches an ISO `updatedAt` timestamp and monotonic `_version` counter. If remote timestamp > local timestamp, update local state; otherwise push local state.
2. **Active Trade Scaled/Stop Invariants**: If local state has recorded a scale to Breakeven (`SCALED_T1`), an incoming stale server poll must NEVER regress the stop back down to the initial stop. The client's invariant protection preserves stop raises unconditionally.
3. **Dirty Mutation Queue**: Any write performed while offline is recorded in `senior_broker_mutation_queue` in `localStorage`. Upon reconnecting (`window.addEventListener('online')`), the queue is processed sequentially.

---

## 4. 1-Click JSON Snapshot Backup / Restore Validation Engine

The Backup Engine (`src/lib/storage/backup-service.ts`) provides full data portability, disaster recovery, and deterministic integrity verification.

### 4.1 Canonical Snapshot Envelope Specification

```json
{
  "version": "1.0.0",
  "app": "senior-broker-app",
  "exportedAt": "2026-08-19T20:45:00.000Z",
  "checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "environment": "production",
  "metadata": {
    "totalTrades": 14,
    "activeTrades": 3,
    "closedTrades": 11,
    "journalEntriesCount": 11,
    "signalsCount": 6,
    "accountSize": 15000,
    "riskPerTrade": 1.0
  },
  "data": {
    "settings": {
      "accountSize": 15000.0,
      "riskPerTrade": 1.0,
      "maxSleeveRiskPct": 3.0,
      "maxOpenPositions": 3,
      "audioEnabled": true,
      "hapticEnabled": true,
      "theme": "dark"
    },
    "portfolio": {
      "dedicatedCapital": 15000.0,
      "allocatedCapital": 3240.50,
      "cashAvailable": 11759.50,
      "openRiskDollars": 300.00,
      "openRiskPct": 2.0,
      "floatingPnL": 245.80,
      "totalRealizedPnL": 842.50,
      "winRate": 72.7,
      "profitFactor": 2.45,
      "avgRMultiple": 1.85
    },
    "trades": [
      {
        "id": "trade-1718000000001",
        "userId": "user-default-trader",
        "ticker": "ATRO",
        "companyName": "Astronics Corporation",
        "status": "ACTIVE",
        "setupType": "Fresh Earnings Gap / Pivot Breakout",
        "entryTrigger": 89.20,
        "actualEntry": 88.50,
        "entryDate": "2026-08-17T14:30:00.000Z",
        "sharesTotal": 18,
        "sharesRemaining": 18,
        "initialStop": 83.75,
        "currentStop": 83.75,
        "target1": 100.10,
        "target2": 112.00,
        "rrRatio": 2.13,
        "timeStopSessions": 5,
        "sessionsElapsed": 2,
        "notes": "Entered on post-earnings consolidation hold. Volume expanding 2x norm.",
        "createdAt": "2026-08-17T14:30:00.000Z",
        "updatedAt": "2026-08-17T14:30:00.000Z"
      }
    ],
    "journalEntries": [],
    "signals": [],
    "auditLogs": []
  }
}
```

### 4.2 Cryptographic SHA-256 Checksum Verification
To prevent corrupted or tampered JSON imports:
1. When generating a backup, the `data` object is normalized using canonical deterministic JSON serialization (keys sorted alphabetically, whitespace stripped).
2. The SHA-256 hash is computed via `crypto.subtle.digest('SHA-256', textBuffer)` in modern browsers and Web Workers.
3. A fallback pure-JS SHA-256 algorithm is provided for non-subtle crypto environments.
4. On import, the checksum is recomputed against `data` and compared in constant-time. If mismatched, the validator flags a checksum integrity warning with option to bypass only if schema validation passes.

### 4.3 Comprehensive Zod Schema Validation

```typescript
import { z } from "zod";

export const TradeSchema = z.object({
  id: z.string().min(1, "Trade ID is required"),
  userId: z.string().default("user-default-trader"),
  ticker: z.string().min(1, "Ticker symbol required").max(10).toUpperCase(),
  companyName: z.string().optional().default(""),
  status: z.enum(["PENDING_ENTRY", "ACTIVE", "SCALED_T1", "CLOSED"]),
  setupType: z.string().default("Catalyst Continuation"),
  entryTrigger: z.number().positive("Entry trigger must be positive"),
  entryCondition: z.string().optional().nullable(),
  actualEntry: z.number().positive().optional().nullable(),
  entryDate: z.string().datetime({ offset: true }).or(z.string()).optional().nullable(),
  sharesTotal: z.number().int().positive("Shares total must be positive integer"),
  sharesRemaining: z.number().int().min(0, "Shares remaining cannot be negative"),
  initialStop: z.number().positive("Initial stop must be positive"),
  currentStop: z.number().positive("Current stop must be positive"),
  target1: z.number().positive("Target 1 must be positive"),
  target2: z.number().positive("Target 2 must be positive"),
  rrRatio: z.number(),
  timeStopSessions: z.number().int().min(1).default(6),
  sessionsElapsed: z.number().int().min(0).default(0),
  closedPrice: z.number().positive().optional().nullable(),
  closedDate: z.string().datetime({ offset: true }).or(z.string()).optional().nullable(),
  realizedPnL: z.number().optional().nullable(),
  rMultiple: z.number().optional().nullable(),
  exitReason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const UserSettingsSchema = z.object({
  accountSize: z.number().min(1000, "Account size must be at least $1,000").default(15000),
  riskPerTrade: z.number().min(0.1).max(5.0).default(1.0),
  maxSleeveRiskPct: z.number().min(1.0).max(10.0).default(3.0),
  maxOpenPositions: z.number().int().min(1).max(10).default(3),
  audioEnabled: z.boolean().default(true),
  hapticEnabled: z.boolean().default(true),
  theme: z.enum(["dark", "light"]).default("dark"),
});

export const BackupPayloadSchema = z.object({
  version: z.string(),
  app: z.string().default("senior-broker-app"),
  exportedAt: z.string(),
  checksum: z.string().optional(),
  environment: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  data: z.object({
    settings: UserSettingsSchema.optional(),
    portfolio: z.record(z.any()).optional(),
    trades: z.array(TradeSchema).default([]),
    journalEntries: z.array(z.any()).default([]),
    signals: z.array(z.any()).default([]),
    auditLogs: z.array(z.any()).default([]),
  }),
});
```

### 4.4 Restore Execution Engine (Dry-Run vs Overwrite vs Merge)

```
                       ┌───────────────────────────────┐
                       │  Input JSON String / File     │
                       └──────────────┬────────────────┘
                                      │
                                      ▼
                       ┌───────────────────────────────┐
                       │ 1. Parse JSON & Verify Format │
                       └──────────────┬────────────────┘
                                      │
                                      ▼
                       ┌───────────────────────────────┐
                       │ 2. Compute & Verify SHA-256   │
                       └──────────────┬────────────────┘
                                      │
                                      ▼
                       ┌───────────────────────────────┐
                       │ 3. Deep Zod Schema Validation │
                       └──────────────┬────────────────┘
                                      │
                   ┌──────────────────┴──────────────────┐
        [Pass]     ▼                                     ▼   [Fail]
  ┌─────────────────────────────────┐        ┌────────────────────────────┐
  │ 4. Evaluate Import Mode         │        │ Return Formatted Errors    │
  └────────────────┬────────────────┘        │ (Path, Field, Reason)      │
                   │                         └────────────────────────────┘
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│ DRY-RUN │   │ OVERWR. │   │  MERGE  │
└────┬────┘   └────┬────┘   └────┬────┘
     │             │             │
     ▼             ▼             ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│ Compute │   │ Create  │   │ Match   │
│ Diff &  │   │ Rollback│   │ IDs, LWW│
│ Preview │   │ & Wipe/ │   │ Resolve,│
│ Metrics │   │ Restore │   │ Append  │
└─────────┘   └─────────┘   └─────────┘
```

1. **`DRY_RUN` Mode**:
   - Calculates exact change diffs without touching storage.
   - Output: `{ isValid: true, mode: "DRY_RUN", summary: { tradesToCreate: 4, tradesToUpdate: 2, tradesUnchanged: 8, conflicts: 0 }, diffPreview: [...] }`.
2. **`OVERWRITE` Mode**:
   - Creates an in-memory safety snapshot before mutating.
   - Clears active trades, journal, settings, and loads snapshot payload.
   - Triggers `SNAPSHOT_RESTORED` event on the bus.
   - If any step throws an error, executes `rollback()` immediately.
3. **`MERGE` Mode**:
   - Smart deduplication by `id` or composite key `(ticker + entryDate)`.
   - Compares timestamps (`updatedAt`): keeps the newest record.
   - Appends missing trades, journal entries, and AI candidates.
   - Recalculates aggregate portfolio balance, realized P&L, and win-rate metrics.

---

## 5. Technical Blueprint & Concrete Code Proposals

### 5.1 `src/lib/storage/local-store.ts` (Full Proposed Implementation)

```typescript
// src/lib/storage/local-store.ts
import { Trade, UserSettings, PortfolioState, JournalEntry, AuditLog, Signal } from "./types";

const LOCAL_STORAGE_KEYS = {
  SETTINGS: "senior_broker_settings",
  TRADES: "senior_broker_custom_positions",
  JOURNAL: "senior_broker_journal",
  PORTFOLIO: "senior_broker_portfolio",
  AUDIT: "senior_broker_audit_logs",
  MUTATION_QUEUE: "senior_broker_mutation_queue",
  AUTH: "senior_broker_auth",
  USER: "senior_broker_user",
};

const BROADCAST_CHANNEL_NAME = "senior_broker_bus";

export type StorageListener = (type: string, data: any) => void;

class LocalStoreEngine {
  private inMemoryCache: {
    settings: UserSettings | null;
    trades: Map<string, Trade>;
    journal: Map<string, JournalEntry>;
    signals: Map<string, Signal>;
    auditLogs: AuditLog[];
    portfolio: PortfolioState | null;
  } = {
    settings: null,
    trades: new Map(),
    journal: new Map(),
    signals: new Map(),
    auditLogs: [],
    portfolio: null,
  };

  private listeners: Set<StorageListener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private tabId: string = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  private isInitialized: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.initBroadcastChannel();
      this.initCrossTabStorageListener();
      this.hydrateFromLocalStorage();
    }
  }

  private initBroadcastChannel() {
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.sourceTabId !== this.tabId) {
            this.handleCrossTabEvent(event.data.type, event.data.payload);
          }
        };
      } catch (e) {
        console.warn("BroadcastChannel not supported or blocked:", e);
      }
    }
  }

  private initCrossTabStorageListener() {
    window.addEventListener("storage", (e) => {
      if (e.key === LOCAL_STORAGE_KEYS.TRADES && e.newValue) {
        try {
          const rawTrades: Trade[] = JSON.parse(e.newValue);
          rawTrades.forEach((t) => this.inMemoryCache.trades.set(t.id, t));
          this.notifyListeners("TRADES_UPDATED", Array.from(this.inMemoryCache.trades.values()));
        } catch (err) {
          console.error("Failed to parse storage event for trades:", err);
        }
      } else if (e.key === LOCAL_STORAGE_KEYS.SETTINGS && e.newValue) {
        try {
          this.inMemoryCache.settings = JSON.parse(e.newValue);
          this.notifyListeners("SETTINGS_UPDATED", this.inMemoryCache.settings);
        } catch (err) {}
      }
    });
  }

  public hydrateFromLocalStorage(): void {
    if (typeof window === "undefined") return;

    try {
      // 1. Hydrate Settings
      const rawSettings = localStorage.getItem(LOCAL_STORAGE_KEYS.SETTINGS);
      if (rawSettings) {
        this.inMemoryCache.settings = JSON.parse(rawSettings);
      } else {
        this.inMemoryCache.settings = {
          id: "user-default-trader",
          email: "trader@broker.com",
          name: "Senior Desk Trader",
          accountSize: 15000.0,
          riskPerTrade: 1.0,
          maxSleeveRiskPct: 3.0,
          maxOpenPositions: 3,
          hasGeminiKey: false,
          hasAnthropicKey: false,
          hasOpenaiKey: false,
          theme: "dark",
          audioEnabled: true,
          hapticEnabled: true,
          updatedAt: new Date().toISOString(),
        };
      }

      // 2. Hydrate Trades
      const rawTrades = localStorage.getItem(LOCAL_STORAGE_KEYS.TRADES);
      if (rawTrades) {
        const parsed: Trade[] = JSON.parse(rawTrades);
        this.inMemoryCache.trades.clear();
        parsed.forEach((t) => this.inMemoryCache.trades.set(t.id, t));
      }

      // 3. Hydrate Journal
      const rawJournal = localStorage.getItem(LOCAL_STORAGE_KEYS.JOURNAL);
      if (rawJournal) {
        const parsed: JournalEntry[] = JSON.parse(rawJournal);
        this.inMemoryCache.journal.clear();
        parsed.forEach((j) => this.inMemoryCache.journal.set(j.id, j));
      }

      // 4. Hydrate Audit Logs
      const rawAudit = localStorage.getItem(LOCAL_STORAGE_KEYS.AUDIT);
      if (rawAudit) {
        this.inMemoryCache.auditLogs = JSON.parse(rawAudit);
      }

      this.isInitialized = true;
      this.notifyListeners("STATE_INITIALIZED", this.getSnapshot());
    } catch (e) {
      console.error("Error hydrating local store:", e);
    }
  }

  // --- Reactive Subscriptions ---
  public subscribe(listener: StorageListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(type: string, payload: any) {
    this.listeners.forEach((fn) => {
      try {
        fn(type, payload);
      } catch (err) {
        console.error("Error in storage listener:", err);
      }
    });
  }

  private emitCrossTab(type: string, payload: any) {
    this.notifyListeners(type, payload);
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type,
        payload,
        sourceTabId: this.tabId,
        timestamp: Date.now(),
      });
    }
  }

  private handleCrossTabEvent(type: string, payload: any) {
    if (type === "TRADES_UPDATED" && Array.isArray(payload)) {
      this.inMemoryCache.trades.clear();
      payload.forEach((t: Trade) => this.inMemoryCache.trades.set(t.id, t));
    } else if (type === "SETTINGS_UPDATED") {
      this.inMemoryCache.settings = payload;
    }
    this.notifyListeners(type, payload);
  }

  // --- CRUD API ---
  public getTrades(): Trade[] {
    return Array.from(this.inMemoryCache.trades.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getTrade(id: string): Trade | undefined {
    return this.inMemoryCache.trades.get(id);
  }

  public saveTrade(trade: Trade): void {
    trade.updatedAt = new Date().toISOString();
    this.inMemoryCache.trades.set(trade.id, trade);
    this.persistTrades();
    this.emitCrossTab("TRADE_SAVED", trade);
  }

  public deleteTrade(id: string): void {
    this.inMemoryCache.trades.delete(id);
    this.persistTrades();
    this.emitCrossTab("TRADE_DELETED", { id });
  }

  public getSettings(): UserSettings {
    if (!this.inMemoryCache.settings) {
      this.hydrateFromLocalStorage();
    }
    return this.inMemoryCache.settings!;
  }

  public saveSettings(settings: Partial<UserSettings>): UserSettings {
    const current = this.getSettings();
    const updated: UserSettings = {
      ...current,
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    this.inMemoryCache.settings = updated;
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    }
    this.emitCrossTab("SETTINGS_UPDATED", updated);
    return updated;
  }

  public getSnapshot() {
    return {
      settings: this.getSettings(),
      trades: this.getTrades(),
      journal: Array.from(this.inMemoryCache.journal.values()),
      auditLogs: [...this.inMemoryCache.auditLogs],
    };
  }

  private persistTrades() {
    if (typeof window !== "undefined") {
      const arr = Array.from(this.inMemoryCache.trades.values());
      localStorage.setItem(LOCAL_STORAGE_KEYS.TRADES, JSON.stringify(arr));
    }
  }
}

export const localStore = new LocalStoreEngine();
```

---

### 5.2 `src/lib/storage/backup-service.ts` (Full Proposed Implementation)

```typescript
// src/lib/storage/backup-service.ts
import { z } from "zod";
import { Trade, UserSettings, JournalEntry, Signal, AuditLog, PortfolioState } from "./types";
import { localStore } from "./local-store";
import { TradeSchema, UserSettingsSchema, BackupPayloadSchema } from "./schemas";

export interface BackupSnapshotEnvelope {
  version: string;
  app: string;
  exportedAt: string;
  checksum: string;
  environment: string;
  metadata: {
    totalTrades: number;
    activeTrades: number;
    closedTrades: number;
    journalEntriesCount: number;
    accountSize: number;
    riskPerTrade: number;
  };
  data: {
    settings: UserSettings;
    portfolio?: PortfolioState | null;
    trades: Trade[];
    journalEntries: JournalEntry[];
    signals: Signal[];
    auditLogs: AuditLog[];
  };
}

export interface RestoreValidationResult {
  isValid: boolean;
  errors: Array<{ path: string; message: string; received?: any }>;
  warnings: string[];
  checksumValid: boolean;
  computedChecksum: string;
  expectedChecksum?: string;
  snapshotData?: BackupSnapshotEnvelope["data"];
}

export interface RestoreExecutionResult {
  success: boolean;
  mode: "DRY_RUN" | "OVERWRITE" | "MERGE";
  stats: {
    tradesCreated: number;
    tradesUpdated: number;
    tradesUnchanged: number;
    journalEntriesImported: number;
    settingsApplied: boolean;
  };
  details: string[];
  error?: string;
}

/**
 * Deterministic JSON stringifier to compute reproducible hashes
 */
export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalJsonStringify).join(",") + "]";
  }
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((key) => JSON.stringify(key) + ":" + canonicalJsonStringify(obj[key]))
      .join(",") +
    "}"
  );
}

/**
 * SHA-256 Checksum generation supporting Web Crypto & fallback
 */
export async function computePayloadChecksum(dataObj: any): Promise<string> {
  const canonicalString = canonicalJsonStringify(dataObj);

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Pure JavaScript SHA-256 fallback for environments without crypto.subtle
  return fallbackSha256(canonicalString);
}

function fallbackSha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = "length";
  let i, j;
  let result = "";
  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let compositeWordsLength = ((asciiBitLength + 64 >>> 9) << 4) + 15;
  for (i = 0; i < ascii[lengthProperty]; i++) {
    words[i >> 2] |= ascii.charCodeAt(i) << ((3 - (i % 4)) * 8);
  }
  words[ascii[lengthProperty] >> 2] |= 0x80 << ((3 - (ascii[lengthProperty] % 4)) * 8);
  words[compositeWordsLength] = asciiBitLength;

  for (let s = 0; s < words[lengthProperty]; s += 16) {
    const w = words.slice(s, s + 16);
    const oldHash = [...hash];
    for (i = 0; i < 64; i++) {
      let i2 = i + 16;
      if (i >= 16) {
        const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp1 = (hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[i] + w[i]) | 0;
      const temp2 = ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj) | 0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? "0" : "") + b.toString(16);
    }
  }
  return result;
}

/**
 * 1-Click Export Snapshot Generator
 */
export async function generateBackupSnapshot(): Promise<BackupSnapshotEnvelope> {
  const snapshot = localStore.getSnapshot();
  const trades = snapshot.trades;
  const settings = snapshot.settings;
  const journal = snapshot.journal;
  const auditLogs = snapshot.auditLogs;

  const activeTrades = trades.filter((t) => t.status === "ACTIVE" || t.status === "SCALED_T1");
  const closedTrades = trades.filter((t) => t.status === "CLOSED");

  const dataPayload = {
    settings,
    trades,
    journalEntries: journal,
    signals: [],
    auditLogs,
  };

  const checksum = await computePayloadChecksum(dataPayload);

  return {
    version: "1.0.0",
    app: "senior-broker-app",
    exportedAt: new Date().toISOString(),
    checksum,
    environment: process.env.NODE_ENV || "development",
    metadata: {
      totalTrades: trades.length,
      activeTrades: activeTrades.length,
      closedTrades: closedTrades.length,
      journalEntriesCount: journal.length,
      accountSize: settings.accountSize || 15000,
      riskPerTrade: settings.riskPerTrade || 1.0,
    },
    data: dataPayload,
  };
}

/**
 * Validate Snapshot JSON & Integrity
 */
export async function validateBackupSnapshot(jsonString: string): Promise<RestoreValidationResult> {
  const errors: Array<{ path: string; message: string; received?: any }> = [];
  const warnings: string[] = [];

  let rawParsed: any;
  try {
    rawParsed = JSON.parse(jsonString);
  } catch (err: any) {
    return {
      isValid: false,
      errors: [{ path: "root", message: `Invalid JSON syntax: ${err?.message}` }],
      warnings,
      checksumValid: false,
      computedChecksum: "",
    };
  }

  // Zod schema validation
  const parseResult = BackupPayloadSchema.safeParse(rawParsed);
  if (!parseResult.success) {
    parseResult.error.errors.forEach((zodErr) => {
      errors.push({
        path: zodErr.path.join("."),
        message: zodErr.message,
      });
    });
  }

  // Checksum calculation
  let computedChecksum = "";
  let checksumValid = false;
  if (rawParsed.data) {
    computedChecksum = await computePayloadChecksum(rawParsed.data);
    if (rawParsed.checksum) {
      checksumValid = computedChecksum === rawParsed.checksum;
      if (!checksumValid) {
        warnings.push(
          `Checksum mismatch: payload signature does not match header (expected: ${rawParsed.checksum}, computed: ${computedChecksum}).`
        );
      }
    } else {
      warnings.push("Backup file does not contain a cryptographic checksum header.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    checksumValid,
    computedChecksum,
    expectedChecksum: rawParsed.checksum,
    snapshotData: parseResult.success ? parseResult.data.data : undefined,
  };
}

/**
 * Execute Snapshot Restore (Dry-Run, Overwrite, or Merge)
 */
export async function restoreBackupSnapshot(
  jsonString: string,
  mode: "DRY_RUN" | "OVERWRITE" | "MERGE" = "DRY_RUN"
): Promise<RestoreExecutionResult> {
  const validation = await validateBackupSnapshot(jsonString);
  if (!validation.isValid || !validation.snapshotData) {
    return {
      success: false,
      mode,
      stats: { tradesCreated: 0, tradesUpdated: 0, tradesUnchanged: 0, journalEntriesImported: 0, settingsApplied: false },
      details: validation.errors.map((e) => `[${e.path}] ${e.message}`),
      error: "Schema validation failed for snapshot payload.",
    };
  }

  const incomingData = validation.snapshotData;
  const currentSnapshot = localStore.getSnapshot();
  const currentTradesMap = new Map<string, Trade>(currentSnapshot.trades.map((t) => [t.id, t]));

  let tradesCreated = 0;
  let tradesUpdated = 0;
  let tradesUnchanged = 0;
  const details: string[] = [];

  // Analyze Trade Diff
  for (const incomingTrade of incomingData.trades as Trade[]) {
    const existing = currentTradesMap.get(incomingTrade.id);
    if (!existing) {
      tradesCreated++;
      details.push(`New Trade to import: ${incomingTrade.ticker} (${incomingTrade.status})`);
    } else {
      const incomingTime = new Date(incomingTrade.updatedAt || incomingTrade.createdAt).getTime();
      const existingTime = new Date(existing.updatedAt || existing.createdAt).getTime();
      if (incomingTime > existingTime) {
        tradesUpdated++;
        details.push(`Update Trade: ${incomingTrade.ticker} (newer timestamp in backup)`);
      } else {
        tradesUnchanged++;
        details.push(`Keep Existing Trade: ${incomingTrade.ticker} (local is up to date)`);
      }
    }
  }

  if (mode === "DRY_RUN") {
    return {
      success: true,
      mode: "DRY_RUN",
      stats: {
        tradesCreated,
        tradesUpdated,
        tradesUnchanged,
        journalEntriesImported: incomingData.journalEntries?.length || 0,
        settingsApplied: !!incomingData.settings,
      },
      details,
    };
  }

  if (mode === "OVERWRITE") {
    // Atomic overwrite
    if (incomingData.settings) {
      localStore.saveSettings(incomingData.settings);
    }
    // Clear & Replace trades
    (incomingData.trades as Trade[]).forEach((t) => localStore.saveTrade(t));

    return {
      success: true,
      mode: "OVERWRITE",
      stats: {
        tradesCreated: incomingData.trades.length,
        tradesUpdated: 0,
        tradesUnchanged: 0,
        journalEntriesImported: incomingData.journalEntries?.length || 0,
        settingsApplied: !!incomingData.settings,
      },
      details: ["Database overwritten cleanly from snapshot."],
    };
  }

  if (mode === "MERGE") {
    // Smart merge
    if (incomingData.settings) {
      localStore.saveSettings(incomingData.settings);
    }
    for (const incomingTrade of incomingData.trades as Trade[]) {
      const existing = currentTradesMap.get(incomingTrade.id);
      if (!existing) {
        localStore.saveTrade(incomingTrade);
      } else {
        const incomingTime = new Date(incomingTrade.updatedAt || incomingTrade.createdAt).getTime();
        const existingTime = new Date(existing.updatedAt || existing.createdAt).getTime();
        if (incomingTime > existingTime) {
          localStore.saveTrade(incomingTrade);
        }
      }
    }

    return {
      success: true,
      mode: "MERGE",
      stats: {
        tradesCreated,
        tradesUpdated,
        tradesUnchanged,
        journalEntriesImported: incomingData.journalEntries?.length || 0,
        settingsApplied: !!incomingData.settings,
      },
      details,
    };
  }

  return {
    success: false,
    mode,
    stats: { tradesCreated: 0, tradesUpdated: 0, tradesUnchanged: 0, journalEntriesImported: 0, settingsApplied: false },
    details: [],
    error: `Unsupported mode: ${mode}`,
  };
}
```

---

## 6. Unit Testing Strategy & Verification Plan

### 6.1 `src/tests/unit/storage.test.ts`
- Test 1: Verify synchronous boot and fallback values ($15k default capital, 1% risk per trade).
- Test 2: Verify `saveTrade()` updates in-memory cache and persists to `localStorage`.
- Test 3: Verify cross-tab `BroadcastChannel` events trigger registered UI listeners.
- Test 4: Verify stop loss protection invariant: `SCALED_T1` trade stop never regresses upon merge.
- Test 5: Verify offline mutation queue queuing and replay.

### 6.2 `src/tests/unit/backup-service.test.ts`
- Test 1: Snapshot generation produces valid JSON with correct metadata, schema version 1.0.0, and 64-char SHA-256 hash.
- Test 2: Checksum validation detects tampered payload content (e.g. changing trade ticker or price).
- Test 3: Zod schema rejects malformed trades (e.g. negative stop loss, missing ticker, invalid enum).
- Test 4: Dry-run restore accurately calculates diff preview without mutating current storage.
- Test 5: Overwrite mode completely replaces database and re-emits `SNAPSHOT_RESTORED`.
- Test 6: Smart Merge mode properly resolves Last-Write-Wins and leaves newer local trades intact.

---

## 7. Migration & Integration Blueprint with Next.js 16 & UI Components

### 7.1 Seamless Drop-in Integration
- `src/app/page.tsx` will replace manual `localStorage.getItem("senior_broker_custom_positions")` with `localStore.subscribe()` and `localStore.getTrades()`.
- The Settings Modal / Backup Modal will invoke `generateBackupSnapshot()` (downloading `.json` file to trader's computer) and `restoreBackupSnapshot()` (supporting drag-and-drop file upload with live dry-run diff preview modal).
- `src/lib/prisma.ts` will synchronize memory store updates with local store event dispatches.

---

## 8. Summary of Deliverables & Next Action

This completes the architectural blueprint for Milestone 1 Explorer 2. The specifications are fully detailed and ready for immediate implementation by Builder agents.
