# Task Assignment: Write Tier 4 Stale Exit Discipline Test Suite

## Identity & Scope
- Working directory: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\tier4_worker_gen4
- Project Root: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app
- Target File: `src/tests/tier4_real_world/t4_stale_exit_discipline.test.ts`

## Requirements
Author ≥ 4 comprehensive real-world scenarios in `src/tests/tier4_real_world/t4_stale_exit_discipline.test.ts`:
1. **Scenario 1 - Stagnation Detection & Session Count Progression**:
   - Breakout setup enters on Day 0 with entry $100, stop $98 ($2.00 risk = 1.0R, 75 shares for $150 risk on $15,000 capital).
   - Day 1-4 price fluctuates between $99.80 and $100.30 (<0.2R expansion). Rule engine evaluates state as "NONE" or "NORMAL".
   - On Session 5, rule engine triggers "TIME_STOP_WARNING" with medium urgency and warns trader of stagnation.
   - On Session 7, rule engine triggers "TIME_STOP_EXPIRED" with high urgency instructing immediate liquidation.

2. **Scenario 2 - 1-Click Stale Exit Execution & R-Multiple Calculation**:
   - Trader executes 1-Click "Exit Stale Position" action upon time stop trigger.
   - Market order liquidates full position (75 shares) at market price ($99.70).
   - Realized P&L calculated: 75 × ($99.70 - $100.00) = -$22.50.
   - Realized R-Multiple calculated: -$22.50 / $150 = -0.15R.
   - Closed trade journal entry created with exitReason: "TIME_STOP_EXPIRED" and holdingPeriod: 7 sessions.

3. **Scenario 3 - Discipline Score & Analytics Impact**:
   - Trader who exits promptly on session 7 maintains a Discipline Score of 95%+.
   - Trader who ignores time stop and holds past 10 sessions suffers a discipline penalty in analytics.
   - Win Rate and Total Realized P&L are updated correctly in the closed trade journal metrics.

4. **Scenario 4 - Sleeve Capacity & Risk Recycling**:
   - Starting with $450 max open risk (3 trades at 1% risk = $150 each). Total sleeve risk cap reached (3.0%).
   - Stale exit of Trade 1 frees up $150 open risk and $7,500 allocated capital.
   - New high-conviction screener candidate (e.g. LITE breakout) can now be sized and entered without violating the 3.0% sleeve risk cap.

Use `describe`, `it`, `expect` from `../helpers/assertions` and mock helpers from `../helpers/mock-storage` and `../helpers/mock-market`.
Use `write_to_file` to create all files.
Verify with `npx tsx src/tests/runner.ts tier4`.
Write `handoff.md` and report back.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
