# Scope: Milestone 5 — Investor Learning Center & Cloudflare Deployment

## Architecture & Boundaries
- **Module Ownership**:
  - `src/components/education/*` (LearningCenterView.tsx, StrategyLessonCard.tsx, ScenarioCalculator.tsx, LessonModal.tsx, etc.)
  - `src/lib/education/*` (lesson-data.ts, scenario-math.ts, etc.)
  - `src/components/coach/WhyDrawer.tsx`
  - `tests/unit/education.test.ts`
- **Dependencies & Interop**:
  - Uses types and rules from `src/lib/portfolio/sizing-calculator.ts`, `src/lib/market/rule-engine.ts`, `src/lib/store/*`
  - Ensures clean TypeScript / Next.js compilation for Cloudflare Pages / OpenNext runtime.

## Feature Inventory
| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 27 | 5 Interactive Strategy Lessons | Core interactive modules: 1% Risk Formula, 2:1 R:R & Target Scaling, Time Stops vs Price Stops, Sector Concentration & Sleeve Caps, Market Regime Identification with interactive step-throughs, formula builders, simulations, and quiz checks. | PLANNED |
| 28 | Contextual "Why?" Coach Insights | Expandable drawer/sheet explaining institutional reasoning, risk math, and psychology behind every rule, alert, and coaching recommendation (`src/components/coach/WhyDrawer.tsx`). | PLANNED |
| 29 | Interactive Sizing & Scenario Sandbox | Practice tool for testing stop placements, target multipliers, and sizing before execution with live price ladder visualization, R-multiple simulation, and capital allocation projection (`src/components/education/ScenarioCalculator.tsx`). | PLANNED |
| 32 | Cloudflare OpenNext / Build Compatibility | Strict edge runtime compatibility, no native C++ bindings, `npm run build` exits 0 cleanly with Next.js static/edge compilation. | PLANNED |

## Detailed Technical Requirements
1. **Interactive Lessons**:
   - Lesson 1: The 1% Risk Formula (interactive input for account capital, risk %, entry/stop to visualize position sizing, max loss, and capital survival curve).
   - Lesson 2: Asymmetric 2:1 R:R & Target Scaling (interactive sliders for Win Rate and R:R showing expectancy, 50% scale at T1 simulation, moving stop to B/E, breakeven floor math).
   - Lesson 3: Time Stops vs Price Stops (interactive 5-7 session stagnation simulator showing capital opportunity cost vs waiting for dead breakouts).
   - Lesson 4: Sector Concentration & Sleeve Caps (interactive portfolio heat gauge showing 3% sleeve cap warning and >2 sector concentration flags).
   - Lesson 5: Market Regime Identification (interactive SPY/QQQ 20/50/200 MA toggle and VIX threshold slider showing sizing scale from 1.0x to 0.5x or 0x).
2. **Contextual Why Drawer (`WhyDrawer.tsx`)**:
   - Slide-over / bottom sheet explaining the mathematical foundation, institutional background ("How hedge funds manage risk"), and psychological trap avoided for any rule action (Scale 50%, Time Stop, Risk Overload, Invalidation, Regime Change).
   - Triggerable from anywhere or browsable by rule type.
3. **Scenario Calculator (`ScenarioCalculator.tsx`)**:
   - Complete sandbox with account size input (default $15,000), ticker, entry price, stop loss, Target 1 multiplier (e.g. 2R), Target 2 multiplier (e.g. 3R or custom).
   - Real-time price ladder rendering showing exact Dollar Risk, Share Count, Allocated Capital % of sleeve, Expected Profit at T1 and T2, Breakeven Stop floor.
   - Quick presets for popular setups (Breakout Pullback, VWAP Reversal, Trend Continuation).
4. **Cloudflare Deployment Compatibility**:
   - Ensure zero node-specific breaking dependencies in edge bundles.
   - Verify `npm run build` completes with exit code 0.
