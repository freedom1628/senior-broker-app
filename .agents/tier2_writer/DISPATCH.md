# Task Assignment: Tier 2 Boundary & Corner Case Test Suite (All 32 Features)

## Identity & Scope
- Working directory: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\tier2_writer
- Project Root: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app
- Target Test Files (under `src/tests/tier2_boundaries/`):
  1. `t2_portfolio_bounds.test.ts` — ≥ 32 tests (extreme capital, 0 values, extreme stop distances, sparkline boundaries, sandbox limits)
  2. `t2_risk_limits.test.ts` — ≥ 32 tests (exact 1.000% vs 1.001% risk, $450 sleeve cap boundary, exactly 2 vs 3 sector positions, floating precision)
  3. `t2_session_staleness.test.ts` — ≥ 32 tests (session count boundaries 4, 5, 6, 7 days, stagnation metrics, T1 scale exemptions, weekend skips)
  4. `t2_arbiter_edge.test.ts` — ≥ 32 tests (malformed LLM responses, consensus scoring boundaries 0/1/2/3 models, conflicting signals, missing data)
  5. `t2_storage_backup.test.ts` — ≥ 32 tests (corrupt JSON snapshot payloads, schema version evolution, atomic rollback on validation failure, unicode/XSS strings in notes)

Total Tier 2 Test Count: ≥ 160 tests (≥5 boundary/corner test cases per feature for all 32 inventoried features).

## Specifications & Requirements
- Read `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `TEST_INFRA.md`.
- Use the assertion framework from `src/tests/helpers/assertions.ts` (`describe`, `it`, `expect`).
- Exercise boundary values: just below, at, and just above limits (Boundary Value Analysis), plus invalid and stress inputs.
- Ensure all tests pass reliably and execute fast.
- Verify your tests run with `npx tsx src/tests/runner.ts` and document pass rates in `handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
