## 2026-08-19T21:27:51Z
You are Explorer 3 for Milestone 4 (Multi-LLM Screener, Prompt Station & Arbiter).
Working directory: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\teamwork_preview_explorer_m4_3
Workspace root: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app
Original request: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\ORIGINAL_REQUEST.md
Project plan: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\PROJECT.md
Scope document: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\self_sub_orch_m4\SCOPE.md

Tasks:
1. Design the 1-Click Standardized Deep Research Prompt Station (Feature 23): formatted 4-step web search prompt with regime check, liquidity filters (e.g. ADV > 1M, float < 100M or SP500 liquid), 1% sizing math, R:R >= 2:1, time stop (e.g. 3-5 days for swing or intraday), and response scoring rubric.
2. Design the Multi-Model Consensus Arbiter Engine (Feature 24):
   - Harmonizes desk market regime across models.
   - Deduplicates candidate tickers across models.
   - Computes consensus conviction score with +5 bonus per agreeing model.
   - Normalizes 1% risk sizing math based on equity and stop distance (max $1,000 risk on $100k account).
   - Generates visual price ladder data (Entry, Stop Loss, Target 1, Target 2, R:R, risk percentage, profit potential).
3. Design the UI component hierarchy in `src/components/screener/*` (PromptStation, MultiReportIngestionModal, ConsensusArbiterView, CandidateSetupCard, VisualPriceLadder, ScreenerTab).
4. Output your detailed design to C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\teamwork_preview_explorer_m4_3\report.md and send a message back.
