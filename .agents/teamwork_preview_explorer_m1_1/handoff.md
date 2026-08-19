# Handoff Report: M1 Domain & Rule Engine Architecture (Explorer 1)

## 1. Observation
- **Scope & Requirements**:
  - `ORIGINAL_REQUEST.md:20-32`: Specifies 1% account risk model ($150 on $15,000 baseline), 1-click tactical actions ("Scale 50% & Move Stop to Breakeven", "Update Trailing Stop", "Exit Stale Position"), 5–7 session time stop rule, and 3% total sleeve risk cap.
  - `PROJECT.md:62, 72-75`: Lists Feature 6 (1% Account Risk Auto-Sizer), Feature 16 (1% Risk Rule Enforcement), Feature 17 (5–7 Session Time-Stop Rule), Feature 18 (3.0% Total Sleeve Risk Cap), and Feature 19 (Sector Concentration Limiter).
  - `SCOPE.md:17-23`: Maps M1 ownership to `src/lib/portfolio/sizing-calculator.ts` and `src/lib/market/rule-engine.ts`.
- **Existing Codebase State**:
  - `src/lib/market/rule-engine.ts:1-144`: Currently implements basic `evaluateTrade` handling `ENTRY_TRIGGERED`, `STOP_ALERT`, `TARGET_1_HIT`, `TARGET_2_HIT`, and `TIME_STOP_WARNING`, but lacks:
    1. Pre-trade portfolio sleeve capacity limits (max 3 concurrent open trades).
    2. Aggregate open sleeve risk limit calculation (max 3.0% / $450 on $15,000).
    3. Sector concentration limiter (max 2 concurrent positions per sector).
    4. Dynamic trailing stop calculation (ATR / swing low / ratchet).
    5. Two-tier time-stop classification (Session 5–6 Warning vs Session 7+ Expired).
  - `src/lib/portfolio/sizing-calculator.ts`: Currently missing from `src/lib/portfolio/` (only `daily-report.ts` exists). Sizing logic is ad-hoc inside `AddTradeModal.tsx:38-60`.
  - `TEST_INFRA.md:13-46, 53-83`: Outlines test runner layout across `t1_portfolio_core.test.ts`, `t1_risk_engine.test.ts`, and boundary tests in `t2_portfolio_bounds.test.ts` and `t2_risk_limits.test.ts`.

---

## 2. Logic Chain
1. **From Missing Sizing Module to Dedicated Service**:
   - `AddTradeModal.tsx:46-49` implements `calculatedShares = Math.floor(riskBudget / riskPerShare)` locally. Without a shared `sizing-calculator.ts`, other components (e.g. Screener candidate promotion, Scenario Sandbox, API endpoints) duplicate logic or fail boundary checks (e.g., tight stops creating huge position allocations without buying power caps).
   - *Inference*: `src/lib/portfolio/sizing-calculator.ts` must provide `calculatePositionSize(input: SizingInput): SizingResult` with guardrails for 1% risk ($150 on $15k), cash buffer (5%), single-position cap (25%), ATR-derived stops (2.0x ATR fallback), and 2.0R / 3.5R target calculations.

2. **From Rule Engine Gaps to Complete Lifecycle State Machine**:
   - `rule-engine.ts` currently provides single-trade evaluations but does not enforce portfolio-level sleeve rules (max 3 trades, 3% aggregate risk cap, max 2 per sector) or dynamic trailing stops on runners.
   - *Inference*: `rule-engine.ts` must be extended with:
     a) `evaluateTradeRules(trade, quote, sessionsElapsed)`: Evaluates `SCALE_T1` (50% scale + breakeven stop), `TARGET_2_HIT` (close runner), `TRAIL_STOP_UPDATE` (ratchet stop), `STOP_LOSS_HIT` (hard stop invalidation), and `TIME_STOP_WARNING` (5–6 sessions) / `TIME_STOP_EXPIRED` (7+ sessions).
     b) `validateProposedTrade(proposed, portfolioState)`: Pre-trade gatekeeper verifying $\le 3$ active positions, $\le 3.0\%$ aggregate sleeve risk, and $\le 2$ positions in the same sector.

3. **From Persistence & UI Integration to Unified Types**:
   - The Prisma schema (`prisma/schema.prisma:68-97`) defines `Trade` with fields `status` (`ACTIVE`, `SCALED_T1`, `CLOSED`), `sharesTotal`, `sharesRemaining`, `initialStop`, `currentStop`, `target1`, `target2`, `timeStopSessions`, and `sessionsElapsed`.
   - *Inference*: The TypeScript interfaces designed in `analysis.md` map 1:1 with Prisma models and UI components (`ActiveTradesPanel`, `AddTradeModal`, `DailyReportPanel`), ensuring seamless integration across M1, M2, and M3.

---

## 3. Caveats
- No caveats regarding mathematical formulas or business rules.
- Note on Sector Classification: If ticker sector is not explicitly specified in the trade object, the rule engine falls back to setup style parsing or a default `"Diversified"` category to avoid blocking valid orders.
- Note on Open Risk for Scaled Trades: When a trade hits Target 1 and its stop is moved to or above the entry price ($CurrentStop \ge Entry$), its open dollar risk is evaluated as $\$0.00$, freeing up the 1% risk budget for subsequent candidate entries.

---

## 4. Conclusion
The technical design and architectural specifications for `sizing-calculator.ts` and `rule-engine.ts` are fully defined in `analysis.md`. The implementer can immediately build:
1. `src/lib/portfolio/sizing-calculator.ts` following the specification in Section 2.
2. `src/lib/market/rule-engine.ts` following the specification in Section 3.
3. Unit tests targeting all 32 feature requirements and boundary conditions.

---

## 5. Verification Method
1. **Inspect Blueprint**:
   - View `C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\teamwork_preview_explorer_m1_1\analysis.md`.
2. **Formula Verification**:
   - 1% Risk on $15,000 = $150. Entry $50.00, Stop $48.00 $\implies$ Risk/share = $2.00 $\implies$ Shares = 75 ($3,750 allocated, 25% of account, exactly $150 risk).
   - Target 1 (2.0R) = $54.00, Target 2 (3.5R) = $57.00.
   - Sizing cap: Entry $100.00, Stop $99.99 $\implies$ Risk/share = $0.01 $\implies$ Raw shares = 15,000 ($1.5M). Max position cap (25% = $3,750) caps shares to 37 shares.
3. **Rule Trigger Verification**:
   - Price $\ge 54.00 \implies$ `SCALE_T1`, scales 38 shares (50%), raises stop to $50.00 (Breakeven).
   - Session count = 5 $\implies$ `TIME_STOP_WARNING`. Session count = 7 $\implies$ `TIME_STOP_EXPIRED`.
   - 3 active positions open + attempt 4th $\implies$ `validateProposedTrade` returns `isAllowed: false` (Max 3 open trades).
