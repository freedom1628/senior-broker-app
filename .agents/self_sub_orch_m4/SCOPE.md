# Scope: Milestone 4 (Multi-LLM Screener, Prompt Station & Arbiter Engine)

## Architecture
- `src/lib/ai/types.ts`: Model definitions (Gemini 3.7 Flash, Claude Sonnet 5/Opus/Fable, OpenAI 5.6/o3), candidate trade setup interfaces, consensus arbiter data structures, parsing schemas.
- `src/lib/ai/prompts.ts`: 1-Click standardized Deep Research prompt generator (4-step research prompt: regime check, liquidity filters, 1% risk sizing, R:R >= 2:1, time stops, structured JSON/markdown response rubric).
- `src/lib/ai/parser.ts`: Robust multi-format LLM response parser (JSON parser with fallback regex/markdown extractor for messy LLM outputs).
- `src/lib/ai/arbiter.ts`: Consensus Arbiter Engine (harmonize market regime, deduplicate candidates across multiple models, +5 conviction bonus per agreeing model, normalize 1% risk sizing math, compute price ladder metrics).
- `src/app/api/research/ingest/route.ts` & `src/app/api/research/sample/route.ts`: API routes for ingesting raw research reports and providing rich sample multi-model reports.
- `src/components/screener/*`:
  - `PromptStation.tsx`: Interactive prompt builder & 1-click clipboard copy for frontier models.
  - `MultiReportIngestionModal.tsx`: Modal for pasting reports from multiple LLMs with real-time parse feedback and format detection.
  - `ConsensusArbiterView.tsx`: Multi-model consensus dashboard showing agreed setups, agreement badges (+5 conviction), regime consensus, visual price ladders.
  - `CandidateSetupCard.tsx`: Detailed trade setup card with R:R, 1% sizing, rationale, agreeing models, and 1-click "Promote to Active" / "Add to Watchlist" action buttons.
  - `VisualPriceLadder.tsx`: Visual price ladder component showing Stop, Entry, T1, T2, and current price levels.
  - `ScreenerTab.tsx` / `index.ts`: Main screener container integrating Prompt Station, Ingestion Modal, Consensus Arbiter, and Filterable Candidate list.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 22 | Frontier Model Ingestion | Support Gemini 3.7 Flash, Claude Sonnet 5/Opus/Fable, OpenAI 5.6/o3 schemas and mock/real data feeds | M4 | ORIGINAL_REQUEST |
| 23 | Deep Research Prompt Station | 1-Click 4-step web search prompt with regime check, liquidity filters, 1% sizing, R:R >= 2:1, time stops | M4 | ORIGINAL_REQUEST |
| 24 | Consensus Arbiter Engine | Multi-model consensus, regime harmonization, ticker deduplication, +5 score per agreeing model, 1% sizing normalization, price ladders | M4 | ORIGINAL_REQUEST |
| 25 | Ingestion Modal & Parser | Robust JSON + regex markdown/HTML fallback parser for pasting raw outputs from frontier models | M4 | ORIGINAL_REQUEST |
| 26 | 1-Click Setup Promotion | Promote candidate setups directly to Active trade or Pending watch order via trade store | M4 | ORIGINAL_REQUEST |

## Code Layout Ownership
- `src/components/screener/*`
- `src/lib/ai/*`
- `src/app/api/research/*`
