# Task Assignment: Test Infrastructure & Runner Setup

## Identity & Scope
- Working directory: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\test_infra_worker
- Project Root: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app
- Target Output Files:
  - `src/tests/runner.ts`
  - `src/tests/helpers/assertions.ts`
  - `src/tests/helpers/mock-storage.ts`
  - `src/tests/helpers/mock-market.ts`
  - `package.json` (add `"test": "npx tsx src/tests/runner.ts"`)

## Specifications
1. Read `ORIGINAL_REQUEST.md` (C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\ORIGINAL_REQUEST.md), `PROJECT.md`, and `TEST_INFRA.md`.
2. Build `src/tests/helpers/assertions.ts`:
   - Full suite of assertion functions (`describe`, `it`, `test`, `expect`, `beforeEach`, `afterEach`, `runSuite`).
   - Rich matchers: `toBe`, `toEqual`, `toBeCloseTo`, `toBeGreaterThan`, `toBeLessThan`, `toBeGreaterThanOrEqual`, `toBeLessThanOrEqual`, `toBeNull`, `toBeUndefined`, `toBeDefined`, `toBeTruthy`, `toBeFalsy`, `toContain`, `toHaveLength`, `toThrow`, `toMatchObject`.
   - Support both synchronous and asynchronous test functions.
   - Aggregate test results (passed, failed, skipped, duration).
3. Build `src/tests/helpers/mock-storage.ts`:
   - In-memory mock implementing Dual-Layer Persistence contracts (Local storage + Sync state).
4. Build `src/tests/helpers/mock-market.ts`:
   - Mock market quote generator, price tick stream, and session progression emulator.
5. Build `src/tests/runner.ts`:
   - CLI test runner that recursively scans `src/tests/` for `*.test.ts` (excluding runner/helpers), dynamically imports and executes each test suite, color-formats summary outputs per Tier, and exits with code 0 on 100% pass, or code 1 on failure.
6. Verify by running `npx tsx src/tests/runner.ts` and report results in `handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
