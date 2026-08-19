# Task Assignment: Tier 3 Cross-Feature & Tier 4 Real-World Application Test Suites

## Identity & Scope
- Working directory: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\tier3_tier4_writer
- Project Root: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app
- Target Test Files:
  - **Tier 3 Pairwise Combinations** (`src/tests/tier3_pairwise/`):
    1. `t3_sizing_and_rules.test.ts` — ≥ 8 tests (Sizer -> Watch Queue -> Active Position -> Rule Engine -> 1-Click Scale -> Breakeven Stop -> Journal)
    2. `t3_arbiter_to_trade.test.ts` — ≥ 8 tests (Arbiter Consensus -> Candidate Promotion -> Sizing Math -> Active Trade -> Price Ladder)
    3. `t3_risk_cap_conflicts.test.ts` — ≥ 8 tests (3% Sleeve Cap + Sector Limiter + Multi-Trade Concurrency & Freezes)
    4. `t3_backup_and_state.test.ts` — ≥ 8 tests (Active State -> JSON Snapshot Export -> State Reset -> Atomic Restore -> Exact Metric Match)
    *Tier 3 Total: ≥ 32 tests.*

  - **Tier 4 Real-World Workload Scenarios** (`src/tests/tier4_real_world/`):
    1. `t4_morning_routine.test.ts` — ≥ 4 full user journeys (PIN Auth -> Morning Briefing -> Copy Markdown -> Screener Consensus -> Candidate Promotion -> Pending Queue)
    2. `t4_midday_management.test.ts` — ≥ 4 full user journeys (Live Quote Surge -> Target 1 Trigger -> Audio Chime -> 1-Click Scale 50% -> Breakeven Stop -> Zero Risk)
    3. `t4_campaign_lifecycle.test.ts` — ≥ 4 full multi-day campaigns (LLM Ingestion -> 1% Risk Size -> Day 1-3 Hold -> T1 Scale 50% -> Trailing Stop -> T2 Runner Exit -> +2.5R Journal Record)
    4. `t4_stale_exit_discipline.test.ts` — ≥ 4 full discipline scenarios (Breakout Stagnation -> Day 5 Warning -> Day 7 Time-Stop Trigger -> 1-Click Stale Exit -> Analytics Discipline Score Update)
    *Tier 4 Total: ≥ 16 tests.*

Total Test Count across Tiers 3 & 4: ≥ 48 comprehensive end-to-end integration & scenario tests.

## Specifications & Requirements
- Read `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `TEST_INFRA.md`.
- Use the assertion framework from `src/tests/helpers/assertions.ts`.
- Simulate realistic sequences of user actions, state transitions, market ticks, and persistence cycles.
- Verify tests execute cleanly with `npx tsx src/tests/runner.ts` and document pass rates in `handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
