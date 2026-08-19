# Task Assignment: Tier 1 Feature Coverage Test Suite (All 32 Features)

## 2026-08-19T20:49:22Z

## Identity & Scope
- Working directory: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\tier1_writer
- Project Root: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app
- Target Test Files (under `src/tests/tier1_features/`):
  1. `t1_portfolio_core.test.ts` (Features 1, 2, 6, 29) — ≥ 20 tests
  2. `t1_navigation_ui.test.ts` (Features 3, 4, 5, 25) — ≥ 20 tests
  3. `t1_position_rules.test.ts` (Features 7, 8, 9, 10, 11) — ≥ 25 tests
  4. `t1_risk_engine.test.ts` (Features 16, 17, 18, 19) — ≥ 20 tests
  5. `t1_journal_audio.test.ts` (Features 12, 13, 14, 15, 20, 21) — ≥ 30 tests
  6. `t1_screener_ai.test.ts` (Features 22, 23, 24, 26) — ≥ 20 tests
  7. `t1_education_infra.test.ts` (Features 27, 28, 30, 31, 32) — ≥ 25 tests

Total Tier 1 Test Count: ≥ 160 tests (≥5 test cases per feature for all 32 inventoried features).

## Specifications & Requirements
- Read `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `TEST_INFRA.md`.
- Use the assertion framework from `src/tests/helpers/assertions.ts` (`describe`, `it`, `expect`).
- Import domain modules from `src/lib/` or test contracts via mock helpers from `src/tests/helpers/`.
- Ensure each test is opaque-box, deterministic, and tests happy-path feature capabilities in isolation.
- Verify your tests run with `npx tsx src/tests/runner.ts` and ensure all tests pass.
- Document total tests written and pass rates in `handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
