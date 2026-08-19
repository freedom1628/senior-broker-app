# Task Assignment: Complete Tier 4 Stale Exit Discipline Test Suite

## Context & Files Present
- Project Root: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app
- Target: Create `src/tests/tier4_real_world/t4_stale_exit_discipline.test.ts`
- Already present in `src/tests/tier3_pairwise/`:
  - `t3_arbiter_to_trade.test.ts`
  - `t3_backup_and_state.test.ts`
  - `t3_risk_cap_conflicts.test.ts`
  - `t3_sizing_and_rules.test.ts`
- Already present in `src/tests/tier4_real_world/`:
  - `t4_campaign_lifecycle.test.ts`
  - `t4_midday_management.test.ts`
  - `t4_morning_routine.test.ts`

## Requirements for `t4_stale_exit_discipline.test.ts`
- Author ≥ 4 comprehensive real-world scenarios:
  1. Breakout setup enters on Day 0 -> Stagnates with <0.2R movement for 4 sessions -> Evaluator reports NORMAL -> Session 5 triggers TIME_STOP_WARNING -> Session 7 triggers TIME_STOP_EXPIRED.
  2. Trader executes 1-Click "Exit Stale Position" upon time stop expiration -> Remaining shares sold at market -> Realized R-multiple calculated (-0.15R) -> Journal logs exit reason "TIME_STOP_EXPIRED".
  3. Trader discipline scoring: Exiting promptly on time stop expiration maintains high Discipline Score (≥90%), whereas ignoring time stop decreases discipline score.
  4. Capital & Sleeve capacity recycling: Stale exit immediately frees up allocated capital and sleeve open risk cap ($150 risk unlocked), allowing new high-conviction candidate to be queued.
- Use `describe`, `it`, `expect` from `../helpers/assertions` and mock helpers from `../helpers/mock-storage` and `../helpers/mock-market`.
- Run `npx tsx src/tests/runner.ts` to verify all test suites pass.
- Write `handoff.md` and report back.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
