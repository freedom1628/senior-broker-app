# Handoff Report: M1 Unit Testing Strategy & Architecture

**Agent**: Explorer 3 (`teamwork_preview_explorer_m1_3`)  
**Target Milestone**: M1 (Core Domain & Dual-Layer Persistence)  
**Parent Orchestrator ID**: `30038885-cde3-4272-8f01-569f4d0d2fd1`  
**Date**: 2026-08-19  

---

## 1. Observation

1. **Project Dependencies and Config**:
   - Inspected `C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\package.json` (lines 1–48): Project runs on Next.js 16.3.1 (React 19.2.8), TypeScript 5, Prisma 7.9.1 with `@prisma/adapter-better-sqlite3`. Currently no dedicated test runner is configured in `scripts`.
   - Inspected `C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\tsconfig.json` (lines 1–35): Path alias `"@/*": ["./src/*"]` is configured, target `"ES2017"`, module resolution `"bundler"`.
2. **Existing Domain Code**:
   - `src/lib/market/rule-engine.ts` (lines 17–143) contains initial logic for `evaluateTrade` handling `PENDING_ENTRY`, `STOP_ALERT` (`currentPrice <= trade.currentStop`), `TARGET_1_HIT` (`currentPrice >= trade.target1`), `TARGET_2_HIT` (`currentPrice >= trade.target2`), and `TIME_STOP_WARNING` (`sessionsElapsed >= timeStopSessions`).
   - `src/lib/portfolio/daily-report.ts` (lines 30–216) handles aggregate risk calculation (`aggregateRiskPct > 3.0` risk alert) and sector exposure count.
3. **Test Infrastructure Alignment**:
   - Inspected `.agents/test_infra_worker/DISPATCH.md` (lines 1–30): Confirmed test runner architecture uses `npx tsx src/tests/runner.ts` and helper assertions in `src/tests/helpers/assertions.ts` (`describe`, `it`, `expect`, `beforeEach`, `afterEach`, `runSuite`, `mock-storage.ts`, `mock-market.ts`).
4. **Scope & Inventory Requirements**:
   - Inspected `.agents/self_sub_orch_m1/SCOPE.md` (lines 1–46) and `PROJECT.md` (lines 54–89, 100–118): Defines 4 target unit test suites in `src/tests/unit/`:
     - `src/tests/unit/sizing-calculator.test.ts`
     - `src/tests/unit/rule-engine.test.ts`
     - `src/tests/unit/storage.test.ts`
     - `src/tests/unit/backup-service.test.ts`

---

## 2. Logic Chain

1. **Step 1 (Test Runner & Environment)**: From Observation 1 & 3, the project uses TypeScript 5 with Next.js 16. Setting up a lightweight, zero-dependency runner via `npx tsx src/tests/runner.ts` using Node's native ESM and TSX avoids bundler / Jest-ESM transpilation friction, while using standard Vitest/Jest test signatures (`describe`, `it`, `expect`) ensures 100% interoperability with Vitest.
2. **Step 2 (Sizing Math Verification)**: From Observation 4, the 1% risk rule on a $15,000 baseline requires $150 risk per trade ($\lfloor 150 / (Entry - Stop) \rfloor$). Mathematically, whenever $Stop \ge Entry$ or $Stop \le 0$, the function must return status `"INVALID"` to prevent division by zero or negative share counts. Furthermore, tight stops with high share counts must be capped at available buying power ($Cash / Entry$), emitting a warning.
3. **Step 3 (Rule Engine Verification)**: From Observation 2 & 4, the rule engine must strictly verify state transitions: touching T1 recommends scaling 50% and automatically raising stop to Entry; reaching T2 triggers full exit; crossing stop triggers high-urgency stop invalidation (`shouldAutoClose: true`); 5–7 stagnant sessions trigger time stops; and portfolio-level rules must reject entries exceeding 3 active positions, 2 sector positions, or 3.0% total sleeve risk ($450 on $15k).
4. **Step 4 (Dual-Layer Persistence Verification)**: From Observation 4, browser state must be preserved across sessions. Tests must verify synchronous LocalStorage reads/writes, graceful fallback on `QuotaExceededError`, IndexedDB asynchronous object store operations, state roundtrip integrity (Date parsing, float precision), and reactive subscriber event dispatch.
5. **Step 5 (Backup & Restore Verification)**: From Observation 4, backup export/import must be protected by SHA-256 checksums, reject invalid schemas or foreign app JSONs, provide atomic restoration rollback, and support schema migration from legacy v0 snapshots to v1.

---

## 3. Caveats

1. **Mock Environment Dependencies**: In a pure Node.js runtime without a browser DOM, `localStorage` and `indexedDB` must be mocked using `src/tests/helpers/mock-storage.ts` or in-memory equivalents during unit test execution.
2. **Realized Slippage**: Market gaps on stop executions may yield R-multiples slightly worse than -1.0R (e.g. -1.3R), which the test assertions must accommodate without assuming exact zero-slippage fills on gaps.
3. **Worker Implementation Scope**: This report is a read-only architecture and test specification blueprint. Actual file creation of `src/tests/unit/*.test.ts` is dispatched to the M1 Worker agent.

---

## 4. Conclusion

The testing strategy for Milestone 1 is fully specified with $\ge 40$ test cases across four test suites (`sizing-calculator.test.ts`, `rule-engine.test.ts`, `storage.test.ts`, `backup-service.test.ts`). All boundary conditions (zero/negative stops, lot rounding, buying power caps, 5-7 day time stops, 3-trade sleeve caps, 2-sector limits, 3% risk caps, LocalStorage fallback, schema validation, checksum verification, and version migration) have formal specifications, expected outputs, and ready-to-use TypeScript code blueprints documented in `analysis.md`.

---

## 5. Verification Method

To independently verify the test specifications and runner execution:
1. **Inspect Analysis Blueprint**:
   - Check `C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\teamwork_preview_explorer_m1_3\analysis.md`
2. **Execute Unit Tests (once implemented by Worker)**:
   ```bash
   # Execute full test suite
   npx tsx src/tests/runner.ts

   # Execute individual unit test files
   npx tsx src/tests/unit/sizing-calculator.test.ts
   npx tsx src/tests/unit/rule-engine.test.ts
   npx tsx src/tests/unit/storage.test.ts
   npx tsx src/tests/unit/backup-service.test.ts
   ```
3. **Pass Invalidation Conditions**:
   - Any test failure in `src/tests/unit/` (failed assertions > 0).
   - Any unhandled exception or crash during runner execution.
   - Sizing calculator allowing $Stop \ge Entry$ or exceeding 1% max dollar risk.
   - Rule engine allowing 4th concurrent position or 3rd position in same sector.
