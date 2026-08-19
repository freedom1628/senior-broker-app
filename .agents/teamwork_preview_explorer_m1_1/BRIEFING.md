# BRIEFING — 2026-08-19T20:48:00Z

## Mission
Investigate and produce an architectural and technical blueprint for Auto Position Sizer (`sizing-calculator.ts`) and Trade Management Rule Engine (`rule-engine.ts`) under M1.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, architect
- Working directory: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\teamwork_preview_explorer_m1_1
- Original parent: 30038885-cde3-4272-8f01-569f4d0d2fd1
- Milestone: M1 - Core Domain & Dual-Layer Persistence

## 🔒 Key Constraints
- Read-only investigation — do NOT implement directly in src/
- Follow 1% Account Risk model, cash buffer, margin checks, ATR-based sizing
- Model Target 1 scale (50% + breakeven stop), Target 2 runner (trailing stop), hard stop, time stop (5-7 sessions), portfolio sleeve limits (max 3 trades / 3% risk), sector concentration limiter (max 2 positions/sector)
- Produce `analysis.md`, `handoff.md`, `progress.md`

## Current Parent
- Conversation ID: 30038885-cde3-4272-8f01-569f4d0d2fd1
- Updated: 2026-08-19T20:48:00Z

## Investigation State
- **Explored paths**: `ORIGINAL_REQUEST.md`, `PROJECT.md`, `SCOPE.md`, `TEST_INFRA.md`, `src/lib/market/rule-engine.ts`, `src/lib/portfolio/daily-report.ts`, `src/components/dashboard/AddTradeModal.tsx`, `src/components/dashboard/ActiveTradesPanel.tsx`, `src/app/api/trades/route.ts`, `prisma/schema.prisma`
- **Key findings**: 
  - Complete mathematical model specified for 1% risk auto-sizing with buying power, cash buffer, single-position cap, and ATR fallback.
  - Complete rule engine specification covering 50% T1 scale + breakeven stop, T2 runner with dynamic trailing stop, hard stop invalidation, 5–7 session time stop, sleeve limits (max 3 open trades / 3% risk cap), and sector limiter (max 2 per sector).
- **Unexplored areas**: None for M1 sizing & rule engine blueprint.

## Key Decisions Made
- Authored comprehensive `analysis.md` with complete TypeScript interfaces, function contracts, math formulas, and edge case matrix.
- Authored self-contained 5-component `handoff.md`.

## Artifact Index
- `DISPATCH.md` — incoming dispatch record
- `BRIEFING.md` — persistent memory
- `progress.md` — liveness heartbeat
- `analysis.md` — detailed technical blueprint for `sizing-calculator.ts` and `rule-engine.ts`
- `handoff.md` — self-contained handoff report
