# E2E Test Infra: Senior Broker — Swing Trading Coach & Investor Education Overhaul

## Test Philosophy
- **Opaque-box & Requirement-driven**: Derived directly from `ORIGINAL_REQUEST.md` and `PROJECT.md` specifications rather than internal module implementations.
- **Methodology**: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.
- **Independence**: Tests exercise the application via opaque interfaces (HTTP/API contracts, UI state transformations, business logic calculators, rule engine evaluations, multi-model arbiter scoring, sound synthesizers, and end-to-end user journeys) with zero internal coupling.
- **Zero Native Dependencies**: Test runner and harnesses are 100% pure TypeScript/ESM compatible with Node.js and Cloudflare Workers/Pages edge runtimes (e.g., lightweight test harness and Vitest-compatible runner).

---

## Feature Inventory & Tier Mapping (All 32 Features)

| # | Feature Name | Requirement Source | Tier 1 (Coverage ≥5) | Tier 2 (Boundary ≥5) | Tier 3 (Pairwise) | Tier 4 (Scenario) |
|---|--------------|--------------------|:--------------------:|:--------------------:|:-----------------:|:-----------------:|
| 1 | Portfolio Summary Card | ORIGINAL_REQUEST §R1.1 | 5 tests | 5 tests | ✓ | ✓ |
| 2 | Interactive Equity Sparklines | ORIGINAL_REQUEST §R1.1 | 5 tests | 5 tests | ✓ | ✓ |
| 3 | 6-View Pill Segmented Navigation | ORIGINAL_REQUEST §R1.2 | 5 tests | 5 tests | ✓ | ✓ |
| 4 | Public.com Minimalist Dark UI | ORIGINAL_REQUEST §R1.3 | 5 tests | 5 tests | ✓ | ✓ |
| 5 | Dual-Mode Authentication (PIN + OAuth) | ORIGINAL_REQUEST §R6.1 | 5 tests | 5 tests | ✓ | ✓ |
| 6 | 1% Account Risk Auto-Sizer ($15k / $150) | ORIGINAL_REQUEST §R2.1 | 5 tests | 5 tests | ✓ | ✓ |
| 7 | Real-Time Position Tracking | ORIGINAL_REQUEST §R2.2 | 5 tests | 5 tests | ✓ | ✓ |
| 8 | Pending Watch Order Queue | ORIGINAL_REQUEST §R2.2 | 5 tests | 5 tests | ✓ | ✓ |
| 9 | 1-Click Scale 50% & Move Stop to B/E | ORIGINAL_REQUEST §R3.1 | 5 tests | 5 tests | ✓ | ✓ |
| 10 | Dynamic Trailing Stop Adjuster | ORIGINAL_REQUEST §R3.1 | 5 tests | 5 tests | ✓ | ✓ |
| 11 | 1-Click Exit Stale Position | ORIGINAL_REQUEST §R3.1 | 5 tests | 5 tests | ✓ | ✓ |
| 12 | Closed Trade Journal & Analytics | ORIGINAL_REQUEST §R2.3 | 5 tests | 5 tests | ✓ | ✓ |
| 13 | Interactive Journal Equity Curve | ORIGINAL_REQUEST §R2.3 | 5 tests | 5 tests | ✓ | ✓ |
| 14 | Prioritized Daily Moves Briefing | ORIGINAL_REQUEST §R3.2 | 5 tests | 5 tests | ✓ | ✓ |
| 15 | 1-Click Copy Briefing | ORIGINAL_REQUEST §R3.2 | 5 tests | 5 tests | ✓ | ✓ |
| 16 | 1% Risk Rule Enforcement | ORIGINAL_REQUEST §R3.3 | 5 tests | 5 tests | ✓ | ✓ |
| 17 | 5–7 Session Time-Stop Rule | ORIGINAL_REQUEST §R3.3 | 5 tests | 5 tests | ✓ | ✓ |
| 18 | 3.0% Total Sleeve Risk Cap ($450) | ORIGINAL_REQUEST §R3.3 | 5 tests | 5 tests | ✓ | ✓ |
| 19 | Sector Concentration Limiter (Max 2) | ORIGINAL_REQUEST §R3.3 | 5 tests | 5 tests | ✓ | ✓ |
| 20 | Zero-Dependency Web Audio Chimes | ORIGINAL_REQUEST §R3.4 | 5 tests | 5 tests | ✓ | ✓ |
| 21 | Web Push & Toast Notifications | ORIGINAL_REQUEST §R3.4 | 5 tests | 5 tests | ✓ | ✓ |
| 22 | Multi-LLM Frontier Ingestion | ORIGINAL_REQUEST §R4.1 | 5 tests | 5 tests | ✓ | ✓ |
| 23 | 1-Click Research Prompt Station | ORIGINAL_REQUEST §R4.2 | 5 tests | 5 tests | ✓ | ✓ |
| 24 | Multi-Model Consensus Arbiter | ORIGINAL_REQUEST §R4.3 | 5 tests | 5 tests | ✓ | ✓ |
| 25 | Visual 4-Tier Price Ladders | ORIGINAL_REQUEST §R4.3 | 5 tests | 5 tests | ✓ | ✓ |
| 26 | 1-Click Candidate Promotion | ORIGINAL_REQUEST §R4.3 | 5 tests | 5 tests | ✓ | ✓ |
| 27 | 5 Interactive Strategy Lessons | ORIGINAL_REQUEST §R5.1 | 5 tests | 5 tests | ✓ | ✓ |
| 28 | Contextual "Why?" Coach Insights | ORIGINAL_REQUEST §R5.2 | 5 tests | 5 tests | ✓ | ✓ |
| 29 | Interactive Sizing Sandbox Calculator | ORIGINAL_REQUEST §R5.3 | 5 tests | 5 tests | ✓ | ✓ |
| 30 | Dual-Layer Persistence & Local Storage | ORIGINAL_REQUEST §R6.2 | 5 tests | 5 tests | ✓ | ✓ |
| 31 | 1-Click JSON Snapshot Backup/Restore | ORIGINAL_REQUEST §R6.2 | 5 tests | 5 tests | ✓ | ✓ |
| 32 | Cloudflare Workers & Pages Compatibility | ORIGINAL_REQUEST §R6.2 | 5 tests | 5 tests | ✓ | ✓ |

---

## Test Architecture & Directory Layout

```
src/tests/
├── runner.ts                     # Standalone CLI test harness & runner (npm test / tsx)
├── helpers/
│   ├── assertions.ts            # Opaque assertion library & colorized test reporting
│   ├── mock-storage.ts          # Pure memory dual-layer persistence simulator
│   └── mock-market.ts           # Realistic price feed & session progression simulator
├── tier1_features/
│   ├── t1_portfolio_core.test.ts # F1 (Portfolio Summary), F2 (Sparkline), F6 (Sizer), F29 (Sandbox)
│   ├── t1_navigation_ui.test.ts  # F3 (6 Views), F4 (Public Dark UI), F5 (Auth), F25 (Ladders)
│   ├── t1_position_rules.test.ts # F7 (Tracking), F8 (Queue), F9 (Scale 50%), F10 (Trailing), F11 (Exit)
│   ├── t1_risk_engine.test.ts    # F16 (1% Rule), F17 (Time Stop), F18 (Sleeve Cap), F19 (Sector Limit)
│   ├── t1_journal_audio.test.ts  # F12 (Journal), F13 (Curve), F14 (Briefing), F15 (Copy), F20 (Audio), F21 (Toasts)
│   ├── t1_screener_ai.test.ts    # F22 (Ingestion), F23 (Prompt Station), F24 (Arbiter), F26 (Promotion)
│   └── t1_education_infra.test.ts# F27 (Lessons), F28 (Why Coach), F30 (Dual Storage), F31 (Backup), F32 (Cloudflare)
├── tier2_boundaries/
│   ├── t2_portfolio_bounds.test.ts # Extreme balances, 0 capital, massive stops, floating PnL jumps
│   ├── t2_risk_limits.test.ts      # Exact 1.0001% risk, 0% risk, negative stops, gap-down opens
│   ├── t2_session_staleness.test.ts# Exactly 5, 6, 7 sessions, weekend gaps, stale halts
│   ├── t2_arbiter_edge.test.ts     # Conflicting tickers, 0-conviction, malformed LLM outputs
│   └── t2_storage_backup.test.ts   # Corrupt JSON snapshots, missing fields, schema evolution
├── tier3_pairwise/
│   ├── t3_sizing_and_rules.test.ts # 1% Sizer -> Queue -> Active -> 50% Scale -> Journal
│   ├── t3_arbiter_to_trade.test.ts # Screener Consensus -> Candidate Promotion -> Sizing -> Execution
│   ├── t3_risk_cap_conflicts.test.ts# 3% Cap + Sector Limiter + Multi-Trade Concurrency
│   └── t3_backup_and_state.test.ts # Active Campaigns -> Backup Export -> State Wipe -> Atomic Restore
└── tier4_real_world/
    ├── t4_morning_routine.test.ts  # Complete morning workflow: Briefing -> Prompts -> Sizing -> Queue
    ├── t4_midday_management.test.ts# Midday management: Price jump -> 1-Click Scale -> Trailing stop
    ├── t4_campaign_lifecycle.test.ts# Full trade campaign from Screener to 2.8R Journal Entry
    └── t4_stale_exit_discipline.test.ts # Stale trade discipline: Time stop triggered -> Exit -> Analytics
```

---

## Execution Commands & Pass/Fail Semantics

- **Primary Command**: `npm test` or `npx tsx src/tests/runner.ts`
- **Exit Code Semantics**:
  - `0`: 100% of all test assertions across Tiers 1-4 passed cleanly.
  - `1`: One or more test assertions failed, with detailed failure diffs and feature identifiers printed.
- **Coverage Goal**:
  - Tier 1: 160 test cases (5 per feature × 32 features)
  - Tier 2: 160 boundary test cases (5 per feature × 32 features)
  - Tier 3: 32 cross-feature integration test cases
  - Tier 4: 16 end-to-end real-world user scenario test cases
  - **Total**: ≥ 368 automated test cases.
