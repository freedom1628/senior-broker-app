# Handoff Report: Milestone 4 (Multi-LLM Screener, Prompt Station & Arbiter Engine)

**Agent:** Explorer 3 (Milestone 4 Preview & Architecture)  
**Parent Conversation ID:** `2112adce-df04-48bb-a8ed-447d346de140`  
**Working Directory:** `C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\teamwork_preview_explorer_m4_3`  
**Status:** Complete (Hard Handoff)

---

## 1. Observation

1. **Workspace & Existing Files:**
   - Milestone scope documented in `.agents/self_sub_orch_m4/SCOPE.md:1-30`.
   - Core prompt definitions currently in `src/lib/ai/prompts.ts:1-60` (`SWING_TRADE_RESEARCH_PROMPT`, `ARBITER_SYNTHESIS_PROMPT`).
   - Multi-model arbiter engine currently in `src/lib/ai/arbiter.ts:1-143` (`synthesizeArbiterPlan`, `MasterSetup`, `MasterArbiterPlan`).
   - Parser regex & heuristic extractor in `src/lib/ai/parser.ts:1-257` (`parseReportContent`, `ParsedCandidate`, `ParsedReport`).
   - Model runner configurations in `src/lib/ai/runners.ts:1-156` (`runModelResearch`, `DEFAULT_LATEST_MODELS`, `CLAUDE_LATEST_MODELS`).
   - Sizing calculator in `src/lib/portfolio/sizing-calculator.ts:1-254` (`calculatePositionSize`, 1% risk math on $15,000 default capital).
   - Rule engine in `src/lib/market/rule-engine.ts:1-510` (`evaluateTrade`, `validateProposedTrade`, portfolio sleeve caps).
   - Domain types in `src/lib/storage/types.ts:1-278` (`Trade`, `Position`, `Signal`, `PortfolioState`).
   - Existing dashboard components in `src/components/dashboard/` (`MultiModelCompare.tsx`, `SetupCard.tsx`, `PriceLadder.tsx`, `ImportModal.tsx`, `ExecutiveTable.tsx`).
   - Main page navigation and trade promotion handler in `src/app/page.tsx:259-298` (`handlePromoteToTrade`).
   - Dedicated Milestone 4 Tier 1 feature tests in `src/tests/tier1_features/t1_screener_ai.test.ts:1-348`.

2. **Test Suite Verification:**
   - Executed `npm test` synchronously.
   - Result: 28 test files executed, 529 assertions evaluated, 529 passed, 0 failed, 0 skipped in 0.65s.
   - `t1_screener_ai.test.ts` passed all 17 feature assertions (Feature 22 frontier ingestion, Feature 23 prompt station, Feature 24 consensus arbiter, Feature 26 candidate promotion).

---

## 2. Logic Chain

1. **Feature 23 (Prompt Station):**
   - The user request requires a standardized 1-click 4-step web search prompt.
   - Step 1 performs the mandatory Market Regime Check (SPY/QQQ vs 20D/50D MAs, market breadth % > 50D MA, VIX level, and 14-day macro hazard calendar for FOMC/CPI/PPI).
   - Step 2 enforces strict liquidity and price filters (NYSE/NASDAQ only, price > $5, ADV > 1M or ADDV > $20M, float < 100M or SP500 liquid, ATR >= 2%, no binary earnings inside holding window).
   - Step 3 specifies candidate research requirements (setup pattern, RS vs SPY, catalyst verification with primary source, crowd positioning, 5-point trade plan with 1% sizing math, and honest bear case).
   - Step 4 defines the 100-point weighted scoring rubric (Setup 30%, RS 25%, R:R 20%, Catalyst 15%, Liquidity 10%).
   - The prompt generator is designed to dynamically accept custom account sizes ($15k default, $100k, etc.), custom risk %, and strategy style presets.

2. **Feature 24 (Consensus Arbiter Engine):**
   - Multi-model research runs from Gemini 3.7 Flash, Claude Sonnet 5, and OpenAI 5.6 are parsed and grouped by canonical ticker symbol (`Map<string, ParsedCandidate[]>`).
   - Market regime consensus is harmonized using risk-averse bias (2 Hostile -> HOSTILE, 1 Hostile + 1 Neutral -> NEUTRAL, 2 Favorable -> FAVORABLE).
   - Multi-model consensus setups receive a deterministic $+5.0$ conviction bonus per agreeing model ($S_{final} = \min(99.0, S_{base} + 5.0 \times (M - 1))$).
   - Position sizing is normalized using the 1% risk formula: $\text{Shares} = \lfloor \text{RiskBudget} / |E - S| \rfloor$ with a 25% single-position capital cap and buying power checks.
   - Visual price ladder metrics are calculated: Target 2 ($+3.5\text{R}$ runner), Target 1 ($+2.0\text{R}$ 50% scale & B/E stop ratchet), Entry trigger, and Hard stop loss ($-1.0\text{R}$ invalidation).

3. **UI Hierarchy (`src/components/screener/*`):**
   - Designed a dedicated module under `src/components/screener/`:
     - `PromptStation.tsx`: Interactive prompt customizer with 1-click clipboard copy and direct links to Gemini, Claude, and ChatGPT.
     - `MultiReportIngestionModal.tsx`: Automated frontier model querying + manual multi-panel paste + real-time regex parsing preview.
     - `ConsensusArbiterView.tsx`: Consensus dashboard with Regime Banner, model filtering pills, grid/table view toggle, and candidate list.
     - `CandidateSetupCard.tsx`: Complete trade setup card with live quotes, integrated price ladder, catalyst breakdown, bear case, and 1-click promotion buttons ("Watch Trigger" -> `PENDING_ENTRY`, "Activate Trade" -> `ACTIVE`).
     - `VisualPriceLadder.tsx`: 4-tier visual ladder rendering execution levels with % distance, R-multiples, and sizing math.
     - `ScreenerTab.tsx` / `index.ts`: Master screener container coordinating state, filters, and store integration.

---

## 3. Caveats

1. **Frontier Model API Keys vs Fallback Simulation:**
   - In production edge runtime environments where user API keys are not yet configured, the system gracefully falls back to calibrated, realistic research snapshots for Gemini 3.7 Flash, Claude Sonnet 5, and OpenAI 5.6 without throwing exceptions.
2. **LLM Output Variance:**
   - Live LLM outputs can vary in markdown/HTML structure. The parser utilizes a resilient multi-tier extraction pipeline (JSON structured data block -> regex pattern matching -> HTML DOM extraction -> token heuristics).

---

## 4. Conclusion

The comprehensive architectural design for Milestone 4 (Features 22, 23, 24, 25, 26) is complete and fully documented in `report.md`. The design guarantees mathematical precision for 1% risk sizing, deterministic consensus scoring (+5 bonus), seamless 1-click trade promotion into active/pending states, and a Public.com-inspired obsidian visual aesthetic.

---

## 5. Verification Method

1. **Design Report Inspection:**
   - Inspect `report.md` in this directory (`C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\teamwork_preview_explorer_m4_3\report.md`).
2. **Automated Test Suite Verification:**
   - Run `npm test` from the workspace root:
     ```powershell
     npm test
     ```
   - Verify that all 28 test suites and 529 assertions (including `src/tests/tier1_features/t1_screener_ai.test.ts`) pass with 100% success rate.
3. **Build Verification:**
   - Run `npm run build` to confirm Next.js TypeScript and bundling integrity.
