## 2026-08-19T20:49:40Z
You are the Worker for Milestone 1 (M1: Core Domain & Dual-Layer Persistence) of the Senior Broker application.
Your working directory: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\teamwork_preview_worker_m1_1
Parent Orchestrator ID: 30038885-cde3-4272-8f01-569f4d0d2fd1
Workspace root: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app

Scope and Reference documents to read before starting:
- ORIGINAL_REQUEST.md: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\ORIGINAL_REQUEST.md
- PROJECT.md: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\PROJECT.md
- SCOPE.md: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\self_sub_orch_m1\SCOPE.md
- Explorer 1 Blueprint (Domain & Rules): C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\teamwork_preview_explorer_m1_1\analysis.md
- Explorer 2 Blueprint (Storage & Backup): C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\teamwork_preview_explorer_m1_2\analysis.md
- Explorer 3 Blueprint (Unit Testing & Architecture): C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\teamwork_preview_explorer_m1_3\analysis.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Assigned Implementation Tasks:
1. Auto Position Sizer (`src/lib/portfolio/sizing-calculator.ts`):
   - Export `calculatePositionSize(input: SizingInput): SizingResult`
   - Calculate exact shares based on 1% Account Risk ($150 risk on default $15,000 capital, configurable)
   - Guardrails: Available cash with 5% buffer, single-position concentration cap (25% default), invalid stop price handling ($Stop >= Entry$ or $Stop <= 0$), ATR-derived fallback stop (2.0x ATR), and dynamic target calculation (Target 1 at 2.0R, Target 2 runner at 3.5R).
2. Trade Management Rule Engine (`src/lib/market/rule-engine.ts`):
   - Extend/refactor with complete lifecycle state machine and portfolio sleeve rules:
     a) `evaluateTradeRules(trade, quote, sessionsElapsed)`:
        - `SCALE_T1`: When price reaches Target 1, scale 50% shares, auto-ratchet stop to Entry (Breakeven).
        - `TARGET_2_HIT`: When price reaches Target 2, close runner.
        - `STOP_LOSS_HIT`: When price hits or breaches stop, trigger immediate close alert (`shouldAutoClose: true`).
        - `TIME_STOP_WARNING` (sessions 5-6 stagnant) / `TIME_STOP_EXPIRED` (session 7+ exit recommendation).
        - `TRAIL_STOP_UPDATE`: Trailing stop adjustment.
     b) `validateProposedTrade(proposed, portfolioState)`: Pre-trade gatekeeper verifying:
        - Max 3 active swing trade positions.
        - Max 3.0% combined open risk ($450 on $15,000 account).
        - Max 2 concurrent positions in the same sector.
3. Storage & Persistence Types & Dual-Layer Persistence Engine:
   - `src/lib/storage/types.ts`: Define all domain interfaces (`Trade`, `Position`, `Signal`, `MarketSnapshot`, `PortfolioState`, `AuditLog`, `JournalEntry`, `UserSettings`).
   - `src/lib/storage/local-store.ts`: Tiered L1 cache + LocalStorage + IndexedDB client store with cross-tab BroadcastChannel reactivity, event subscription bus, and invariant stop loss preservation.
   - `src/lib/prisma.ts`: Update/align in-memory Universal Edge Memory / SQLite fallback store.
4. 1-Click JSON Snapshot Backup / Restore Validation Engine (`src/lib/storage/backup-service.ts`):
   - Complete snapshot generation of portfolio, trades, positions, signals, audit logs, and settings.
   - Deterministic SHA-256 integrity checksum calculation and verification.
   - Schema validation (Zod or robust typed validation) with descriptive error messages.
   - Support `DRY_RUN`, `OVERWRITE`, and `MERGE` (Last-Write-Wins) modes.
5. Comprehensive Unit Test Suite in `src/tests/unit/`:
   - `src/tests/unit/sizing-calculator.test.ts`: test all formulas, risk bounds, cash buffers, zero/negative stops, inverted stops, ATR fallbacks.
   - `src/tests/unit/rule-engine.test.ts`: test T1 50% scale, breakeven stop ratchet, T2 runner, hard stop hit, 5-7 day time stops, 3-trade sleeve cap, 2-sector limiter, 3% risk cap.
   - `src/tests/unit/storage.test.ts`: test LocalStorage fallback, IndexedDB store operations, state serialization roundtrip, and reactive subscriptions.
   - `src/tests/unit/backup-service.test.ts`: test snapshot export format, valid import, corrupt/tampered checksum detection, invalid schema rejection, dry-run diffing, overwrite vs merge.
   - Wire tests into `src/tests/runner.ts` so `npx tsx src/tests/runner.ts` runs all unit tests cleanly.
6. Execution & Verification:
   - Run the unit tests and ensure 100% pass rate.
   - Document commands run and full test output in your handoff report.
