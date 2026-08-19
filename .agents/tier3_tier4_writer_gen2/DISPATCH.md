# Task Assignment: Tier 3 & Tier 4 Test Suite Completion (Gen 2 Replacement)

## Context & Handover Point
- Your predecessor `tier3_tier4_writer` (conv ID `b9d19c7d-1bf0-4367-aa9a-f2dedb19befc`) wrote:
  - `src/tests/tier3_pairwise/t3_arbiter_to_trade.test.ts` (done)
  - `src/tests/tier3_pairwise/t3_backup_and_state.test.ts` (done)
  - `src/tests/tier3_pairwise/t3_risk_cap_conflicts.test.ts` (done)
  - `src/tests/tier3_pairwise/t3_sizing_and_rules.test.ts` (done)
  - `src/tests/tier4_real_world/t4_campaign_lifecycle.test.ts` (done)
  - `src/tests/tier4_real_world/t4_midday_management.test.ts` (done)
  - `src/tests/tier4_real_world/t4_morning_routine.test.ts` (done)
- Missing file:
  - `src/tests/tier4_real_world/t4_stale_exit_discipline.test.ts` (≥4 realistic end-to-end scenarios covering breakout stagnation, day 5 time-stop warning, day 7 time-stop expiration, 1-click stale exit liquidation, and discipline score update in journal).

## Identity & Scope
- Working directory: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\tier3_tier4_writer_gen2
- Project Root: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app

## Instructions
1. Implement `src/tests/tier4_real_world/t4_stale_exit_discipline.test.ts` using `describe`/`it`/`expect` from `../helpers/assertions` and mock helpers.
2. Run `npx tsx src/tests/runner.ts` to verify all Tier 3 and Tier 4 tests pass without errors.
3. Write `handoff.md` in your working directory and send a completion message to the parent orchestrator.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
