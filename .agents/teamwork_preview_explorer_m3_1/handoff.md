# Handoff Report: Milestone 3 Explorer 1 (Position Manager, Fast Entry & Visual Price Ladder)

## 1. Observation

1. **Scope & Inventory Definition**:
   - `SCOPE.md` lines 7–14 define Features 7, 8, 9, 10, 11:
     - Feature 7: Fast Position & Watch Order Entry (<15s flow, 1-click 1% account risk auto-sizing, 4-tier price ladder auto-calc: Stop, Target 1 50% scale, Target 2 runner).
     - Feature 8: Active Position Table & Card View (real-time tracking, entry, live price, share count, hard stop, T1/T2, holding sessions count, conviction/thesis, live P&L in $ and R-multiples).
     - Feature 9: Pending Watch Order Queue (pre-staged orders with condition triggers and 1-click "Fill Entry Now").
     - Feature 10: 1-Click Tactical Actions (Scale 50% & B/E stop, Update Trailing Stop, Exit Stale Position).
     - Feature 11: Visual 4-Tier Price Ladder (Target 2, Target 1, Current Price, Entry, Hard Stop relative bar/ladder visualization).
2. **Existing Domain Schemas & Invariant Guards**:
   - In `src/lib/storage/types.ts`:
     - `Trade` (lines 39–69) supports all required fields: `entryTrigger`, `actualEntry`, `sharesTotal`, `sharesRemaining`, `initialStop`, `currentStop`, `target1`, `target2`, `rrRatio`, `timeStopSessions`, `sessionsElapsed`, `realizedPnL`, `rMultiple`, `exitReason`, `notes`.
     - `Position` (lines 74–85) derives floating metrics: `unrealizedPnL`, `unrealizedPnLPct`, `openRiskDollars`, `openRiskPct`, `currentRMultiple`, `isStale`, `isStopBreakeven`.
     - `PortfolioState` (lines 134–155) establishes the $15,000 dedicated capital default with 1% risk per trade ($150) and 3.0% sleeve risk cap ($450).
   - In `src/lib/storage/local-store.ts` lines 348–358:
     - Invariant enforcement: `if (existing.status === "SCALED_T1" && updatedTrade.status === "ACTIVE") updatedTrade.status = "SCALED_T1"`
     - Downward stop widening rejection: `if (existing.currentStop > updatedTrade.currentStop) updatedTrade.currentStop = existing.currentStop`
3. **Existing Sizing & Rule Calculation Engines**:
   - `src/lib/portfolio/sizing-calculator.ts` (lines 62–253): `calculatePositionSize` computes exact whole shares from 1% risk budget ($150 on $15k), checks buying power, caps at 25% single-stock limit, auto-derives Target 1 (+2.0R) and Target 2 (+3.5R), and returns blended expected return (+2.75R).
   - `src/lib/market/rule-engine.ts`:
     - `evaluateTrade` (lines 162–360): State machine covering `ENTRY_TRIGGER`, `STOP_LOSS_HIT`, `SCALE_T1`, `TARGET_2_HIT`, `TRAIL_STOP_UPDATE`, `TIME_STOP_WARNING` (sessions >= 5), `TIME_STOP_EXPIRED` (sessions >= 6).
     - `validateProposedTrade` (lines 379–491): Enforces max 3 active trades, max 2 sector positions, and max 3.0% aggregate sleeve risk.
4. **Existing Audio Synthesizer**:
   - `src/lib/audio/sound-effects.ts` (lines 19–117): Native Web Audio API oscillators implementing `playTargetChime()` (C6->E6->G6), `playStopLossAlert()` (G3->D3), and `playEntryTriggered()` (A5->C#6).
5. **Existing UI Components & Location**:
   - `src/components/dashboard/ActiveTradesPanel.tsx` (lines 1–305) currently renders basic cards for active positions and a list for pending orders.
   - `src/components/dashboard/AddTradeModal.tsx` (lines 1–378) has basic form inputs and auto-sizing on button click.
   - `src/components/dashboard/PriceLadder.tsx` (lines 1–127) renders static stacked level boxes.
6. **Test Suite Status**:
   - Executing `npx tsx src/tests/runner.ts` results in **529 passing assertions across 28 test files in 0.78s (0 failures, 100% pass rate)**.

---

## 2. Logic Chain

1. **From Scope & Code Audit to Component Architecture**:
   - Observation 1 & 5 show that while foundational UI components exist in `src/components/dashboard/`, they need enhancement to satisfy the full requirements of Milestone 3:
     - `AddTradeModal` needs dynamic reactive auto-calculation as user types (rather than only on manual button click), fast presets (<15s flow), pre-trade guardrail checks, and embedded price ladder preview.
     - `ActiveTradesPanel` needs a dual-view toggle (Visual Obsidian Cards vs Dense Executive Spreadsheet Table), embedded mini price ladder progress markers, real-time open risk gauges ($0 for B/E), and 1-click "Exit Stale Position" actions for session counts $\ge 5$.
     - `PriceLadder` needs proportional vertical bar geometry, dynamic tape price needle, and compact/card mode.
2. **From Interface Contracts to Sizing & Execution Accuracy**:
   - Observations 2 & 3 show that `calculatePositionSize`, `evaluateTrade`, and `validateProposedTrade` already contain complete and mathematically verified algorithms.
   - Therefore, the UI components should directly integrate these verified library functions rather than duplicating math logic.
3. **From Invariant Protections to User Flow Integrity**:
   - Observation 2 shows that `localStore` strictly rejects downward stop widening and status regression from `SCALED_T1` to `ACTIVE`.
   - The UI modals and buttons must surface these validation rules directly to the user (e.g., instant error feedback if adjusting stop lower than current stop).
4. **From File Organization to Project Layout Compliance**:
   - `PROJECT.md` specifies `src/components/positions/*` for position management components.
   - To maintain compatibility with existing imports in `src/app/page.tsx` while adhering to the layout, primary components should reside in `src/components/positions/` with clean re-exports in `src/components/dashboard/`.

---

## 3. Caveats

1. **No External Live Brokerage Execution**: Order entry and tactical moves operate on the local paper trading / swing sleeve persistence layer (dual-layer LocalStore + Prisma Edge memory). Live broker routing (e.g. Alpaca/Interactive Brokers) is out of scope.
2. **Market Quotes Polling**: Live tape prices are provided by the simulated/edge quote engine (`/api/market/quotes` and `/api/market/poll`) which polls every 15 seconds.
3. **Audio Context User Gesture Requirement**: Browsers require a user interaction (click) before `AudioContext` can play sound. `getAudioContext()` automatically handles `.resume()`.

---

## 4. Conclusion

The domain types, persistence schemas, risk calculators, rule engine, and audio synthesizer are 100% in place, fully operational, and verified with 529 passing tests. The complete technical architecture for Milestone 3 has been designed and documented in `analysis.md`:
1. **Fast Position & Watch Order Entry**: Dynamic reactive 1% auto-sizing, <15s UX flow with quick presets, live 4-tier ladder preview, and pre-trade sleeve guardrails check.
2. **Active Position Manager (Card & Table Dual View)**: Real-time tape tracking, P&L in $ and %, current R-multiples, 5–7 session countdown, open risk gauge, and 1-click tactical execution (Scale 50% to B/E, Upward Trailing Stop, Exit Stale Position).
3. **Pending Watch Order Queue**: Breakout/pullback condition monitoring, proximity gauge (% to trigger), alert pulsing, and 1-click "Fill Entry Now".
4. **Visual 4-Tier Price Ladder**: Proportional stacked levels (T2, T1, Tape, Entry, Stop), dynamic quote needle marker, and R-multiple badges.

The architecture is ready for implementation by the coding engineers.

---

## 5. Verification Method

### Test Commands to Run:
```powershell
# Run the complete test suite runner
npx tsx src/tests/runner.ts

# Run position rules and lifecycle tests
npx tsx src/tests/runner.ts t1_position_rules.test.ts

# Run price ladder and UI navigation tests
npx tsx src/tests/runner.ts t1_navigation_ui.test.ts

# Run sizing calculator unit tests
npx tsx src/tests/runner.ts sizing-calculator.test.ts
```

### Key Invalidation Conditions to Check:
1. Stop loss cannot be widened lower than existing stop (`Discipline Rule Violation`).
2. Sizing on $15,000 capital with 1% risk must allocate exactly $150 risk budget.
3. Scaling 50% on Target 1 must set `currentStop` strictly equal to `actualEntry` (Breakeven) and transition status to `SCALED_T1`.
4. Max 3 active positions limit must block entry of a 4th active trade.
5. All 529 tests must continue to pass with zero failures.
