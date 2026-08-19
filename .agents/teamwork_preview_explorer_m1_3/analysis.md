# M1 Unit Testing Strategy & Architectural Analysis

**Author**: Explorer 3 (M1: Core Domain & Dual-Layer Persistence)  
**Target Milestone**: M1 (Core Domain & Dual-Layer Persistence)  
**Date**: 2026-08-19  
**Working Directory**: `C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\teamwork_preview_explorer_m1_3`  

---

## 1. Executive Summary & Problem Boundary

Milestone 1 (M1) establishes the core domain logic and persistence backbone for the **Senior Broker** AI Swing Trading Coach application. The four primary modules under M1 are:
1. **Auto Position Sizer** (`src/lib/portfolio/sizing-calculator.ts`): Institutional 1% risk math on dedicated swing sleeve ($15,000 baseline / $150 risk), buying power limits, cash buffer constraints, lot rounding, fractional shares, and ATR stops.
2. **Trade Management Rule Engine** (`src/lib/market/rule-engine.ts`): 50% T1 scale with automated stop raise to Breakeven, T2 trailing stops, hard stop invalidations, 5–7 session time stops, 3-position sleeve caps, and 2-position sector concentration limits.
3. **Dual-Layer Persistence Engine** (`src/lib/storage/local-store.ts`, `src/lib/storage/sync-manager.ts`): Synchronous browser `localStorage` + resilient asynchronous `IndexedDB` + universal edge memory fallback.
4. **Snapshot Backup & Restore Service** (`src/lib/storage/backup-service.ts`): 1-Click cryptographic snapshot export, atomic import, strict schema validation, checksum verification, and version migrations.

The unit testing strategy in `src/tests/unit/` must provide 100% deterministic, opaque-box test coverage across all boundary conditions, mathematical edge cases, and storage failure modes.

---

## 2. Project Environment & Test Runner Architecture

### 2.1 Codebase & Dependency Inspection
Inspection of `package.json` and `tsconfig.json` yields:
- **Framework & Runtime**: Next.js 16.3.1 (React 19.2.8), TypeScript 5.
- **Module Resolution**: `"moduleResolution": "bundler"` with path mapping `"@/*": ["./src/*"]`.
- **Target**: `"ES2017"`, `"lib": ["dom", "dom.iterable", "esnext"]`.
- **Database / ORM**: Prisma 7.9.1 with `@prisma/adapter-better-sqlite3` and `better-sqlite3`.
- **Cloudflare Edge Readiness**: Compatible with `@opennextjs/cloudflare` and `wrangler`.

### 2.2 Test Runner Ecosystem & Execution Strategy
The test architecture is designed to support multiple execution pathways seamlessly:

1. **Zero-Dependency TSX Runner (`npx tsx src/tests/runner.ts`)**:
   - Executes TypeScript natively without compilation steps or heavy framework overhead.
   - Utilizes universal test assertions (`describe`, `it`, `expect`, `beforeEach`, `afterEach`) implemented in `src/tests/helpers/assertions.ts`.
   - Supports rich matchers: `toBe`, `toEqual`, `toBeCloseTo`, `toBeGreaterThan`, `toBeLessThan`, `toBeGreaterThanOrEqual`, `toBeLessThanOrEqual`, `toBeNull`, `toBeUndefined`, `toBeDefined`, `toBeTruthy`, `toBeFalsy`, `toContain`, `toHaveLength`, `toThrow`, `toMatchObject`.
   - Produces formatted console output with pass/fail counts, execution duration, and exit code `0` (success) or `1` (failure).
   - Configured in `package.json` under `"test": "npx tsx src/tests/runner.ts"`.

2. **Vitest / Jest Native Compatibility**:
   - All unit test suites use standard `describe(name, fn)`, `it(name, fn)`, and `expect(val).matcher()` signatures.
   - If Vitest is invoked (`npx vitest run`), the test files run out-of-the-box with zero modifications.

3. **Node Runtime Polyfill Strategy for Browser APIs**:
   - `localStorage`: In-memory `Storage` mock provided in `src/tests/helpers/mock-storage.ts` or instantiated via `globalThis.localStorage`.
   - `indexedDB`: In-memory `IDBFactory` / `IDBDatabase` mock provided in `src/tests/helpers/mock-storage.ts` or lightweight memory-store adapter.
   - `crypto`: Node 20+ built-in `globalThis.crypto.subtle` / `crypto.createHash` for SHA-256 snapshot checksum validation.

---

## 3. Unit Test Suite 1: Sizing Calculator (`sizing-calculator.test.ts`)

**Target File**: `src/tests/unit/sizing-calculator.test.ts`  
**Module Tested**: `src/lib/portfolio/sizing-calculator.ts`  

### 3.1 Interface Contracts
```typescript
export interface SizingParams {
  accountSize: number;          // e.g. 15000 (default swing capital)
  riskPct?: number;             // e.g. 1.0 (default 1% = 0.01)
  entryPrice: number;           // e.g. 100.00
  stopLoss?: number;            // e.g. 95.00
  target1?: number;             // optional custom T1 (defaults to 2:1 R:R)
  target2?: number;             // optional custom T2 (defaults to 4:1 R:R)
  cashAvailable?: number;       // optional buying power limit
  allowFractional?: boolean;    // default false (whole shares)
  roundLot?: boolean;           // default false (e.g. 10-share lots)
  atr?: number;                 // optional ATR for dynamic stop placement
  maxCapitalPctPerTrade?: number; // optional cap, e.g. 33% max capital in single trade
}

export interface SizingResult {
  shares: number;
  allocatedCapital: number;     // shares * entryPrice
  dollarRisk: number;           // shares * (entryPrice - stopLoss)
  actualRiskPct: number;        // (dollarRisk / accountSize) * 100
  riskPerShare: number;         // entryPrice - stopLoss
  target1: number;
  target2: number;
  rewardToRisk: number;         // (target1 - entryPrice) / riskPerShare
  status: "VALID" | "WARNING" | "INVALID";
  warnings: string[];
  errors: string[];
}
```

### 3.2 Detailed Test Specifications & Edge Cases

| # | Test Case Description | Input Parameters | Expected Output | Rationale & Mathematical Proof |
|---|---|---|---|---|
| 1.1 | **Baseline 1% Risk Sizing on $15,000 capital** | `accountSize: 15000`, `riskPct: 1.0`, `entryPrice: 50.00`, `stopLoss: 47.00` | `shares: 50`, `allocatedCapital: 2500`, `dollarRisk: 150.00`, `actualRiskPct: 1.00`, `target1: 56.00`, `target2: 62.00`, `rewardToRisk: 2.0`, `status: "VALID"` | $\text{DollarRisk} = \$15,000 \times 1\% = \$150$. $\text{Risk/Share} = \$50 - \$47 = \$3$. $\text{Shares} = \lfloor 150 / 3 \rfloor = 50$. Capital $= 50 \times 50 = \$2500$ (16.67% of account). |
| 1.2 | **Zero Stop Loss Rejection** | `entryPrice: 100`, `stopLoss: 0`, `accountSize: 15000` | `shares: 0`, `status: "INVALID"`, `errors` contains `"Stop loss must be greater than zero"` | Prevents unhedged infinity-risk orders. |
| 1.3 | **Negative Stop Loss Rejection** | `entryPrice: 50`, `stopLoss: -10`, `accountSize: 15000` | `shares: 0`, `status: "INVALID"`, `errors` contains `"Stop loss must be greater than zero"` | Rejects negative price values. |
| 1.4 | **Stop Loss Greater Than or Equal to Entry (Inverted Stop)** | `entryPrice: 100`, `stopLoss: 105`, `accountSize: 15000` | `shares: 0`, `status: "INVALID"`, `errors` contains `"Stop loss must be strictly below entry price for long trades"` | A long swing setup requires stop loss below entry pivot. |
| 1.5 | **Zero Risk-Per-Share Division Protection** | `entryPrice: 50.00`, `stopLoss: 50.00`, `accountSize: 15000` | `shares: 0`, `status: "INVALID"`, `errors` contains `"Risk per share cannot be zero"` | Prevents `DivisionByZero` (`150 / 0 = Infinity`). |
| 1.6 | **Negligible Risk Spread Clamp ($0.01 tick)** | `entryPrice: 100.00`, `stopLoss: 99.999`, `accountSize: 15000` | Clamped to min tick $0.01 or flags invalid tight stop. Shares capped by buying power. | Protects against micro-tick float anomalies generating millions of shares. |
| 1.7 | **Whole Share Rounding Down (Conservative Risk Floor)** | `accountSize: 15000`, `riskPct: 1.0` ($150), `entryPrice: 45.00`, `stopLoss: 41.50` ($3.50 risk/share) | `shares: 42`, `dollarRisk: 147.00`, `actualRiskPct: 0.98` | Pure math: $150 / 3.5 = 42.857$. Must `Math.floor` to 42 shares so dollar risk ($147.00) NEVER exceeds $150 limit. |
| 1.8 | **Fractional Share Mode** | Same as 1.7 but `allowFractional: true` | `shares: 42.857` (or rounded to 3 decimals), `dollarRisk: 150.00`, `actualRiskPct: 1.00` | When fractional is enabled, exact risk allocation is preserved. |
| 1.9 | **Round Lot Rounding (10-Share Lots)** | `accountSize: 15000`, `riskPct: 1.0`, `entryPrice: 50`, `stopLoss: 46` ($4 risk/share), `roundLot: true` | `shares: 30` (floored from 37.5), `dollarRisk: 120.00` | 37 shares floored to nearest 10-share block = 30 shares. |
| 1.10 | **Buying Power Cap (Tight Stop High Price Scenario)** | `accountSize: 15000`, `riskPct: 1.0` ($150), `entryPrice: 500`, `stopLoss: 499.00` ($1 risk/share), `cashAvailable: 15000` | `shares: 30`, `allocatedCapital: 15000`, `dollarRisk: 30.00`, `status: "WARNING"`, `warnings` contains `"Capped by available cash/buying power"` | Mathematical shares = 150 shares ($75,000 capital, 500% leverage). Capped by available cash $15,000 / $500 = 30 shares. |
| 1.11 | **Single Position Capital Cap (Max 33% Allocation)** | `accountSize: 15000`, `maxCapitalPctPerTrade: 33.33` ($5,000 cap), `entryPrice: 100`, `stopLoss: 99` ($1 risk), `cashAvailable: 15000` | `shares: 50`, `allocatedCapital: 5000`, `dollarRisk: 50.00`, `status: "WARNING"` | Sizing respects maximum single position concentration cap. |
| 1.12 | **Insufficient Cash for 1 Share** | `cashAvailable: 50`, `entryPrice: 100`, `stopLoss: 90` | `shares: 0`, `status: "INVALID"`, `errors` contains `"Insufficient cash available to purchase minimum 1 share"` | Cash ($50) < 1 Share price ($100). |
| 1.13 | **Risk Percentage Scaling (0.5%, 1.5%, 2.0%)** | `accountSize: 15000`, `entry: 100`, `stop: 90` ($10 risk). Test `riskPct: 0.5`, `1.5`, `2.0` | `0.5%`: shares = 7 ($75 risk); `1.5%`: shares = 22 ($220 risk); `2.0%`: shares = 30 ($300 risk) | Linear scaling across risk preferences. |
| 1.14 | **Dynamic ATR Stop Placement** | `entryPrice: 100.00`, `stopLoss: undefined`, `atr: 4.00`, `accountSize: 15000` | `stopLoss: 94.00` (1.5x ATR), `target1: 112.00` (2R), `target2: 124.00` (4R), `shares: 25` | When explicit stop is omitted, automatically computes stop from $1.5 \times \text{ATR} = \$6.00$. |
| 1.15 | **Asymmetric Target 1 & Target 2 Computation** | `entryPrice: 50.00`, `stopLoss: 45.00` ($5 risk) | `target1: 60.00` (+2R = +$10), `target2: 70.00` (+4R = +$20), `rewardToRisk: 2.0` | Public.com swing standard: 2:1 minimum initial target. |

---

## 4. Unit Test Suite 2: Trade Management Rule Engine (`rule-engine.test.ts`)

**Target File**: `src/tests/unit/rule-engine.test.ts`  
**Module Tested**: `src/lib/market/rule-engine.ts`  

### 4.1 Interface Contracts
```typescript
export interface Trade {
  id: string;
  ticker: string;
  sector?: string;
  status: "PENDING_ENTRY" | "ACTIVE" | "SCALED_T1" | "CLOSED_STOP" | "CLOSED_TARGET" | "CLOSED_TIME_STOP" | "CLOSED_MANUAL";
  entryTrigger: number;
  actualEntry?: number | null;
  sharesTotal: number;
  sharesRemaining: number;
  initialStop: number;
  currentStop: number;
  target1: number;
  target2: number;
  timeStopSessions: number;
  sessionsElapsed: number;
  openedAt?: string;
  closedAt?: string;
  realizedPnL?: number;
}

export interface RuleEvaluationResult {
  tradeId: string;
  ticker: string;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  currentRMultiple: number;
  alertType?: "ENTRY_TRIGGERED" | "STOP_ALERT" | "TARGET_1_HIT" | "TARGET_2_HIT" | "TIME_STOP_WARNING" | "TIME_STOP_EXPIRED";
  alertTitle?: string;
  alertMessage?: string;
  recommendedAction?: string;
  shouldAutoClose?: boolean;
  orderInstruction?: string;
  whyRationale?: string;
}

export interface PortfolioRuleCheckResult {
  canOpen: boolean;
  rejectionReason?: string;
  currentActiveCount: number;
  currentSectorCount: number;
  aggregateRiskDollars: number;
  aggregateRiskPct: number;
  warnings: string[];
}
```

### 4.2 Detailed Test Specifications & Edge Cases

| # | Test Case Description | Scenario / Setup | Expected Outcome | Verification Details |
|---|---|---|---|---|
| 2.1 | **Target 1 (T1) Hit — 50% Scale Recommendation** | Active trade: Entry $100, Stop $95, T1 $110, Shares 100. Price ticks to $110.00. | `alertType: "TARGET_1_HIT"`, recommendedAction scales 50 shares, suggests stop move to $100.00. | Realized P&L calculation: $50 \times (\$110 - \$100) = +\$500$. |
| 2.2 | **Transition from ACTIVE to SCALED_T1 & Breakeven Stop** | Execute T1 scale on trade. Apply stop adjustment. | Status becomes `SCALED_T1`, `sharesRemaining` = 50, `currentStop` = $100.00, open dollar risk = $0.00. | Verifies position is transformed into a risk-free runner. |
| 2.3 | **Target 2 (T2) Full Extension Exit** | Trade in `SCALED_T1` status. T2 = $120.00. Price ticks to $120.00. | `alertType: "TARGET_2_HIT"`, `shouldAutoClose: true`, recommendedAction closes remaining 50 shares. | Final campaign P&L: $\$500 (\text{T1}) + 50 \times (\$120 - \$100) = +\$1500$. Overall campaign R-multiple: $+3.0\text{R}$. |
| 2.4 | **T2 Trailing Stop Progression (Upward-Only Ratchet)** | `SCALED_T1` trade. Current stop at B/E $100. Price reaches $115. Swing low forms at $108. | Suggested trailing stop adjusts to $108. Attempting to lower stop to $98 is rejected. | Current stop can ONLY move in direction of trade profit (never widen). |
| 2.5 | **Hard Stop-Loss Invalidation Trigger** | Active trade: Entry $100, Stop $95. Current price drops to $95.00 (or $94.80). | `alertType: "STOP_ALERT"`, `shouldAutoClose: true`, `urgency: "HIGH"`, R-multiple: -1.0R. | Rationale: "HONOR THE STOP IMMEDIATELY. Close remaining position. Never average down into a loser." |
| 2.6 | **Slippage on Hard Stop Execution** | Entry $100, Stop $95. Price gaps down to $93.50 on open. | `alertType: "STOP_ALERT"`, Realized P&L reflects $93.50 exit, R-multiple = $-1.30\text{R}$. | Correctly accounts for market gap without crashing calculations. |
| 2.7 | **Time Stop Stale Warning (Session 5 of 6)** | Active trade: `timeStopSessions: 6`, `sessionsElapsed: 5`. Price stagnates near $100.50. | `alertType: "TIME_STOP_WARNING"`, `urgency: "MEDIUM"` | Alert warns setup is losing freshness (5/6 sessions elapsed). |
| 2.8 | **Time Stop Expired (Session 6 of 6)** | Active trade: `timeStopSessions: 6`, `sessionsElapsed: 6`. Price still below T1. | `alertType: "TIME_STOP_EXPIRED"`, `shouldAutoClose: true` (or prompt exit) | Prompts capital reallocation after 6 sessions of dead money. |
| 2.9 | **Portfolio Sleeve 3-Position Cap Rejection** | Portfolio has 3 active trades (AAPL, MSFT, NVDA). User attempts to open 4th trade (GOOGL). | `canOpen: false`, `rejectionReason: "Sleeve position limit reached: Maximum 3 active concurrent swing trades allowed"`. | Pending watch orders do NOT count until filled. Closed trades do NOT count. |
| 2.10 | **Portfolio Sleeve Unfreezing Upon Exit** | 3 active trades. 1 trade is closed (stopped out or target hit). Active count = 2. | `canOpen: true` for next proposed trade. | Dynamic position slot release verified. |
| 2.11 | **Sector Concentration 2-Position Cap Rejection** | 2 active trades in "Technology" sector (NVDA, AMD). User attempts to open 3rd tech trade (INTC). | `canOpen: false`, `rejectionReason: "Sector concentration limit exceeded: Maximum 2 concurrent positions allowed in Technology sector"`. | Diversification constraint enforced. |
| 2.12 | **Sector Concentration Cross-Sector Allowed** | 2 active trades in "Technology". User attempts to open trade in "Healthcare" (LLY). | `canOpen: true`, `currentSectorCount: 0`. | Unrelated sector passes smoothly. |
| 2.13 | **Aggregate Sleeve Risk 3.0% Cap Freeze** | Account $15k (3% cap = $450). Trades: T1 open risk $150, T2 open risk $150, T3 open risk $150 (Total = $450). | Attempting to open trade adding $100 risk -> `canOpen: false`, flags risk cap violation. | Prevents portfolio-level ruin. |
| 2.14 | **Risk Capacity Release on Breakeven Move** | 3 active trades ($450 total risk). Trade 1 reaches T1 and stop is raised to B/E ($0 risk). Aggregate risk = $300 (2.0%). | New trade with $150 risk is now permissible (`canOpen: true`). | Stop adjustment to breakeven mathematically frees up risk capacity. |

---

## 5. Unit Test Suite 3: Dual-Layer Storage & Sync (`storage.test.ts`)

**Target File**: `src/tests/unit/storage.test.ts`  
**Modules Tested**: `src/lib/storage/local-store.ts`, `src/lib/storage/sync-manager.ts`  

### 5.1 Interface Contracts
```typescript
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface PortfolioStorageState {
  portfolio: {
    totalCapital: number;
    cashBalance: number;
    riskPerTradePct: number;
  };
  activeTrades: Trade[];
  pendingTrades: Trade[];
  closedTrades: Trade[];
  settings: Record<string, any>;
  lastSyncedAt: string;
}

export type StorageEventListener = (newState: PortfolioStorageState) => void;
```

### 5.2 Detailed Test Specifications & Edge Cases

| # | Test Case Description | Scenario / Setup | Expected Outcome | Verification Details |
|---|---|---|---|---|
| 3.1 | **Synchronous LocalStorage Save and Load** | Save `PortfolioStorageState` with active trades and capital $15,000. Read back. | Read object matches saved state completely. | Verifies fast cold-boot synchronous storage layer. |
| 3.2 | **LocalStorage QuotaExceededError Fallback** | Mock `localStorage.setItem` throwing `QuotaExceededError`. | System logs warning, automatically falls back to in-memory/IndexedDB store without throwing unhandled exception. | Application remains responsive and functional under storage quota exhaustion. |
| 3.3 | **IndexedDB Async Object Store CRUD** | Write trade records to IndexedDB `trades` store, read by ID, update status to `SCALED_T1`, delete record. | All async CRUD operations succeed and return consistent state. | Validates IndexedDB store operations. |
| 3.4 | **Dual-Layer Write-Through Synchronization** | Call `saveState(state)`. | State is written immediately to `localStorage` AND queued/persisted to `IndexedDB`. | Ensures zero latency on UI render plus durability against browser cache evictions. |
| 3.5 | **Complex State Roundtrip Serialization** | State containing Date objects, floats (`150.75`), nested arrays of trades with null fields. | Serialized to JSON, parsed back, dates reconstituted, float precision intact (no floating point epsilon distortion). | Verifies complete fidelity across serialization boundaries. |
| 3.6 | **Corrupted LocalStorage Auto-Recovery** | `localStorage.getItem` returns corrupted string `"{ bad json [ }"` | System catches parse error, logs warning, initializes default state, and attempts restoration from IndexedDB. | Prevents app-crashing White Screen of Death on corrupted local storage. |
| 3.7 | **Subscription & Listener Event Dispatch** | Register 2 listener functions with `subscribe(fn)`. Mutate state via `updateTrade()`. | Both listener callbacks are executed with the updated `PortfolioStorageState`. | Validates reactive state propagation across components. |
| 3.8 | **Unsubscribe Cleanup (Memory Leak Prevention)** | Unsubscribe listener 1 via returned disposer function. Mutate state again. | Only listener 2 is executed; listener 1 receives 0 invocations. | Verifies no dangling listener references remain. |
| 3.9 | **Multi-Tab Storage Synchronization Hook** | Trigger simulated `window.dispatchEvent(new StorageEvent("storage", { key: "senior_broker_state", ... }))`. | Sync manager catches event, updates active memory cache, and notifies active subscribers. | Supports multi-tab consistency. |

---

## 6. Unit Test Suite 4: Backup Service (`backup-service.test.ts`)

**Target File**: `src/tests/unit/backup-service.test.ts`  
**Module Tested**: `src/lib/storage/backup-service.ts`  

### 6.1 Interface Contracts & Snapshot Schema
```typescript
export interface BackupSnapshot {
  version: number;              // Current schema version: 1
  app: "senior-broker-app";     // App identifier
  exportedAt: string;           // ISO 8601 UTC timestamp
  checksum: string;             // SHA-256 hex digest of data payload
  data: {
    portfolio: {
      totalCapital: number;
      cashBalance: number;
      riskPerTradePct: number;
      maxOpenPositions: number;
      maxSectorPositions: number;
      sleeveRiskCapPct: number;
    };
    activeTrades: Trade[];
    pendingTrades: Trade[];
    closedTrades: Trade[];
    settings: Record<string, any>;
  };
}

export interface RestoreResult {
  success: boolean;
  restoredAt?: string;
  versionRestored?: number;
  recordCounts?: {
    activeTrades: number;
    pendingTrades: number;
    closedTrades: number;
  };
  error?: string;
}
```

### 6.2 Detailed Test Specifications & Edge Cases

| # | Test Case Description | Scenario / Setup | Expected Outcome | Verification Details |
|---|---|---|---|---|
| 4.1 | **Snapshot Export Structure & Metadata** | Export state with 2 active trades, 1 pending trade, 5 closed trades. | Exported JSON contains `version: 1`, `app: "senior-broker-app"`, valid ISO `exportedAt`, 64-char SHA-256 `checksum`, and complete `data` object. | Validates complete snapshot format contract. |
| 4.2 | **Valid Snapshot Import & Full Atomic Restoration** | Export valid snapshot. Clear storage. Import exported JSON string. | `RestoreResult.success: true`, `recordCounts: { activeTrades: 2, pendingTrades: 1, closedTrades: 5 }`. Storage state is fully restored. | Verifies lossless 1-click snapshot restore. |
| 4.3 | **Malformed JSON String Rejection** | Call `importBackupSnapshot("{ corrupted json string ...")` | `success: false`, `error: "Malformed JSON string: Unable to parse snapshot"`. Storage state remains untouched. | Prevents crash on corrupted file uploads. |
| 4.4 | **Invalid Schema Root Rejection (Missing App ID or Data)** | Pass valid JSON missing `"app"` or with `app: "other-broker-app"`. | `success: false`, `error: "Invalid snapshot: Incompatible application identifier"`. | Prevents importing foreign JSON files. |
| 4.5 | **Field-Level Type Validation Failure** | Snapshot with `portfolio.totalCapital: "fifteen thousand"` (string instead of number) or negative shares. | `success: false`, `error: "Validation error: portfolio.totalCapital must be a positive number"`. | Protects application integrity from bad data types. |
| 4.6 | **Cryptographic Checksum Verification (Tamper Detection)** | Take valid export JSON. Modify `data.portfolio.totalCapital` from 15000 to 50000 without updating `checksum`. Pass to import. | `success: false`, `error: "Checksum verification failed: Snapshot data has been altered or corrupted"`. | Ensures backup data integrity and detects tampering/file corruption. |
| 4.7 | **Atomic Rollback on Import Failure** | Existing state has 3 trades. Attempt import with invalid snapshot that fails mid-validation. | `success: false`. Existing 3 trades in storage remain completely intact. | Guarantee: zero partial writes or half-restored states. |
| 4.8 | **Legacy Version Schema Migration (v0 -> v1)** | Import a legacy v0 snapshot (which lacked `sleeveRiskCapPct` and `timeStopSessions` on trades). | Migration runner detects `version: 0`, automatically applies schema transforms (injects `sleeveRiskCapPct: 3.0`, defaults trade `timeStopSessions: 6`), upgrades to version 1, and restores successfully. | Verifies forward/backward compatibility as features evolve. |
| 4.9 | **Unsupported Future Version Rejection** | Snapshot with `version: 99`. | `success: false`, `error: "Unsupported snapshot version (v99). Please update Senior Broker to restore this backup."` | Prevents newer format downgrade crashes. |

---

## 7. Concrete Test Implementation Code Blueprint

To enable the Worker agent to implement the 4 test suites rapidly and flawlessly, below are the structural blueprints for each test file:

### 7.1 Blueprint: `src/tests/unit/sizing-calculator.test.ts`
```typescript
import { describe, it, expect } from "../helpers/assertions";
import { calculatePositionSize } from "@/lib/portfolio/sizing-calculator";

describe("Unit: Sizing Calculator (1% Account Risk Model)", () => {
  it("calculates exact 1% risk position size on $15,000 baseline", () => {
    const res = calculatePositionSize({
      accountSize: 15000,
      riskPct: 1.0,
      entryPrice: 50.0,
      stopLoss: 47.0,
    });
    expect(res.shares).toBe(50);
    expect(res.allocatedCapital).toBe(2500);
    expect(res.dollarRisk).toBe(150);
    expect(res.actualRiskPct).toBe(1.0);
    expect(res.target1).toBe(56.0);
    expect(res.target2).toBe(62.0);
    expect(res.rewardToRisk).toBe(2.0);
    expect(res.status).toBe("VALID");
  });

  it("rejects stop loss equal to or above entry price", () => {
    const res = calculatePositionSize({
      accountSize: 15000,
      entryPrice: 100.0,
      stopLoss: 100.0,
    });
    expect(res.status).toBe("INVALID");
    expect(res.shares).toBe(0);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it("rejects zero or negative stop loss", () => {
    const res = calculatePositionSize({
      accountSize: 15000,
      entryPrice: 100.0,
      stopLoss: -5.0,
    });
    expect(res.status).toBe("INVALID");
    expect(res.shares).toBe(0);
  });

  it("caps shares when tight stop exceeds available buying power", () => {
    const res = calculatePositionSize({
      accountSize: 15000,
      riskPct: 1.0,
      entryPrice: 500.0,
      stopLoss: 499.0,
      cashAvailable: 15000,
    });
    // Mathematical shares: 150 shares = $75,000. Capped at $15,000 / $500 = 30 shares
    expect(res.shares).toBe(30);
    expect(res.allocatedCapital).toBe(15000);
    expect(res.dollarRisk).toBe(30.0);
    expect(res.status).toBe("WARNING");
  });

  it("floors fractional shares to integer when allowFractional is false", () => {
    const res = calculatePositionSize({
      accountSize: 15000,
      riskPct: 1.0,
      entryPrice: 45.0,
      stopLoss: 41.5, // risk/share = $3.50 -> 150 / 3.5 = 42.857
      allowFractional: false,
    });
    expect(res.shares).toBe(42);
    expect(res.dollarRisk).toBeLessThanOrEqual(150);
  });

  it("computes dynamic stop loss using ATR when stop is omitted", () => {
    const res = calculatePositionSize({
      accountSize: 15000,
      entryPrice: 100.0,
      atr: 4.0,
    });
    // Stop = 100 - (1.5 * 4) = 94.00, Risk/share = 6.00 -> 150 / 6 = 25 shares
    expect(res.riskPerShare).toBe(6.0);
    expect(res.shares).toBe(25);
    expect(res.target1).toBe(112.0);
  });
});
```

### 7.2 Blueprint: `src/tests/unit/rule-engine.test.ts`
```typescript
import { describe, it, expect } from "../helpers/assertions";
import { evaluateTrade, evaluatePortfolioRules } from "@/lib/market/rule-engine";

describe("Unit: Trade Management Rule Engine", () => {
  it("recommends 50% scale and breakeven stop when Target 1 is touched", () => {
    const trade = {
      id: "trade-1",
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
    const evalRes = evaluateTrade(trade, { price: 110.5, change: 10.5, changePercent: 10.5 });
    expect(evalRes.alertType).toBe("TARGET_1_HIT");
    expect(evalRes.recommendedAction).toContain("Scale out 50%");
    expect(evalRes.recommendedAction).toContain("Breakeven");
  });

  it("flags high urgency stop alert when price hits or breaches hard stop", () => {
    const trade = {
      id: "trade-2",
      ticker: "NVDA",
      status: "ACTIVE" as const,
      entryTrigger: 120.0,
      actualEntry: 120.0,
      sharesTotal: 50,
      sharesRemaining: 50,
      initialStop: 114.0,
      currentStop: 114.0,
      target1: 132.0,
      target2: 144.0,
      timeStopSessions: 6,
      sessionsElapsed: 1,
    };
    const evalRes = evaluateTrade(trade, { price: 113.8, change: -6.2, changePercent: -5.1 });
    expect(evalRes.alertType).toBe("STOP_ALERT");
    expect(evalRes.shouldAutoClose).toBe(true);
  });

  it("enforces 5-7 session time stop warning when momentum stalls", () => {
    const trade = {
      id: "trade-3",
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
      sessionsElapsed: 6,
    };
    const evalRes = evaluateTrade(trade, { price: 402.0, change: 2.0, changePercent: 0.5 });
    expect(evalRes.alertType).toBe("TIME_STOP_WARNING");
  });

  it("rejects 4th active trade when sleeve 3-position cap is reached", () => {
    const activeTrades = [
      { id: "1", ticker: "AAPL", status: "ACTIVE", sector: "Tech", sharesRemaining: 10, currentStop: 95, entryTrigger: 100 },
      { id: "2", ticker: "NVDA", status: "ACTIVE", sector: "Tech", sharesRemaining: 10, currentStop: 95, entryTrigger: 100 },
      { id: "3", ticker: "AMZN", status: "ACTIVE", sector: "Consumer", sharesRemaining: 10, currentStop: 95, entryTrigger: 100 },
    ] as any;
    const ruleRes = evaluatePortfolioRules(activeTrades, { ticker: "MSFT", sector: "Tech", riskDollars: 150 });
    expect(ruleRes.canOpen).toBe(false);
    expect(ruleRes.rejectionReason).toContain("Maximum 3 active concurrent swing trades");
  });

  it("rejects 3rd position in the same sector (max 2 sector cap)", () => {
    const activeTrades = [
      { id: "1", ticker: "NVDA", status: "ACTIVE", sector: "Tech", sharesRemaining: 10, currentStop: 95, entryTrigger: 100 },
      { id: "2", ticker: "AMD", status: "ACTIVE", sector: "Tech", sharesRemaining: 10, currentStop: 95, entryTrigger: 100 },
    ] as any;
    const ruleRes = evaluatePortfolioRules(activeTrades, { ticker: "QCOM", sector: "Tech", riskDollars: 150 });
    expect(ruleRes.canOpen).toBe(false);
    expect(ruleRes.rejectionReason).toContain("Maximum 2 concurrent positions allowed in Tech");
  });
});
```

### 7.3 Blueprint: `src/tests/unit/storage.test.ts`
```typescript
import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockStorageAdapter } from "../helpers/mock-storage";
import { LocalStoreService } from "@/lib/storage/local-store";

describe("Unit: Dual-Layer Persistence & Synchronization", () => {
  let store: LocalStoreService;
  let mockStorage: MockStorageAdapter;

  beforeEach(() => {
    mockStorage = new MockStorageAdapter();
    store = new LocalStoreService(mockStorage);
  });

  it("saves and retrieves complete portfolio state synchronously", async () => {
    const testState = {
      portfolio: { totalCapital: 15000, cashBalance: 12500, riskPerTradePct: 1.0 },
      activeTrades: [{ id: "t1", ticker: "AAPL", sharesTotal: 50 }],
      pendingTrades: [],
      closedTrades: [],
      settings: { soundEnabled: true },
      lastSyncedAt: new Date().toISOString(),
    };
    await store.saveState(testState as any);
    const loaded = await store.loadState();
    expect(loaded.portfolio.totalCapital).toBe(15000);
    expect(loaded.activeTrades.length).toBe(1);
    expect(loaded.activeTrades[0].ticker).toBe("AAPL");
  });

  it("notifies active subscribers when state is updated", async () => {
    let callCount = 0;
    let receivedState: any = null;
    const unsub = store.subscribe((state) => {
      callCount++;
      receivedState = state;
    });

    await store.updatePortfolio({ totalCapital: 16000, cashBalance: 13500, riskPerTradePct: 1.0 });
    expect(callCount).toBe(1);
    expect(receivedState.portfolio.totalCapital).toBe(16000);

    unsub();
    await store.updatePortfolio({ totalCapital: 17000, cashBalance: 14500, riskPerTradePct: 1.0 });
    expect(callCount).toBe(1); // No second call after unsubscribe
  });

  it("gracefully falls back when primary storage throws quota exception", async () => {
    mockStorage.setQuotaExceeded(true);
    // Should not throw, should fall back cleanly
    let error: any = null;
    try {
      await store.saveState({ portfolio: { totalCapital: 15000 } } as any);
    } catch (e) {
      error = e;
    }
    expect(error).toBeNull();
  });
});
```

### 7.4 Blueprint: `src/tests/unit/backup-service.test.ts`
```typescript
import { describe, it, expect } from "../helpers/assertions";
import { BackupService } from "@/lib/storage/backup-service";

describe("Unit: Snapshot Backup & Restore Engine", () => {
  const service = new BackupService();

  it("exports valid snapshot with SHA-256 checksum and metadata", async () => {
    const snapshot = await service.exportSnapshot();
    expect(snapshot.version).toBe(1);
    expect(snapshot.app).toBe("senior-broker-app");
    expect(typeof snapshot.checksum).toBe("string");
    expect(snapshot.checksum.length).toBe(64); // Hex SHA-256 length
    expect(snapshot.data).toBeDefined();
  });

  it("imports and atomically restores valid snapshot", async () => {
    const snapshot = await service.exportSnapshot();
    const jsonString = JSON.stringify(snapshot);
    const result = await service.importSnapshot(jsonString);
    expect(result.success).toBe(true);
    expect(result.recordCounts).toBeDefined();
  });

  it("rejects snapshot with corrupted checksum / tampered data", async () => {
    const snapshot = await service.exportSnapshot();
    // Tamper with data without updating checksum
    snapshot.data.portfolio.totalCapital = 999999;
    const jsonString = JSON.stringify(snapshot);
    const result = await service.importSnapshot(jsonString);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Checksum");
  });

  it("rejects malformed JSON and non-schema files", async () => {
    const result1 = await service.importSnapshot("{ not valid json");
    expect(result1.success).toBe(false);

    const result2 = await service.importSnapshot(JSON.stringify({ app: "unknown-app", version: 1 }));
    expect(result2.success).toBe(false);
  });

  it("migrates legacy v0 snapshots to current schema", async () => {
    const legacySnapshot = {
      version: 0,
      app: "senior-broker-app",
      data: {
        portfolio: { totalCapital: 10000, cashBalance: 10000, riskPerTradePct: 1.0 },
        activeTrades: [{ id: "leg1", ticker: "TSLA", sharesTotal: 20 }],
        closedTrades: [],
      },
    };
    const result = await service.importSnapshot(JSON.stringify(legacySnapshot));
    expect(result.success).toBe(true);
    expect(result.versionRestored).toBe(1);
  });
});
```

---

## 8. Verification & Test Execution Strategy

### 8.1 Step-by-Step Test Execution Commands
1. **Run Full Test Suite**:
   ```bash
   npx tsx src/tests/runner.ts
   # or once configured in package.json:
   npm test
   ```

2. **Run Individual Unit Test Suites**:
   ```bash
   npx tsx src/tests/unit/sizing-calculator.test.ts
   npx tsx src/tests/unit/rule-engine.test.ts
   npx tsx src/tests/unit/storage.test.ts
   npx tsx src/tests/unit/backup-service.test.ts
   ```

3. **Alternative Vitest Execution**:
   ```bash
   npx vitest run src/tests/unit/
   ```

### 8.2 Pass Criteria for Milestone 1 Unit Tests
- All 4 unit test suites must be present in `src/tests/unit/`.
- Minimum test count per file:
  - `sizing-calculator.test.ts`: $\ge 12$ tests
  - `rule-engine.test.ts`: $\ge 12$ tests
  - `storage.test.ts`: $\ge 8$ tests
  - `backup-service.test.ts`: $\ge 8$ tests
  - Total M1 unit test count: $\ge 40$ rigorous assertions.
- Zero failures (`0 failed`), exit code `0`.
- Execution duration $< 1.0\text{s}$ total.
