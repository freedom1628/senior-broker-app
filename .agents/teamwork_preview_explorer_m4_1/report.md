# Milestone 4 Exploration Report: Multi-LLM Screener, Prompt Station & Arbiter Engine

**Date**: August 19, 2026  
**Agent**: Teamwork Preview Explorer M4 1 (`teamwork_preview_explorer_m4_1`)  
**Workspace Root**: `C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app`  
**Milestone Focus**: Milestone 4 — Multi-LLM Screener, Prompt Station & Arbiter Engine (Features 22–26)

---

## 1. Executive Summary

This investigation explores the codebase of **Senior Broker** to prepare for **Milestone 4 (Multi-LLM Screener, Prompt Station & Arbiter Engine)**. The application is built on **Next.js 16 (React 19)**, **TypeScript 5**, **Tailwind CSS v4**, and **Prisma ORM (SQLite / Cloudflare edge compatible)** with dual-layer persistence.

The core AI engine (`src/lib/ai/`) already contains foundational logic for prompt generation (`prompts.ts`), multi-model response parsing (`parser.ts`), consensus arbitration (`arbiter.ts`), and frontier model runners (`runners.ts`). The test suite (`src/tests/runner.ts`) currently runs **28 test files with 529 assertions at a 100% pass rate**, and `npx tsc --noEmit` validates with **0 errors**.

This report maps out existing TypeScript types, persistence stores, UI components, icons, styling systems, and details the exact integration mechanics for **Feature 26: 1-Click Candidate Setup Promotion to Active Trade or Pending Watch Order**.

---

## 2. TypeScript Types & Domain Interfaces

### 2.1 Core Persistence & Domain Types (`src/lib/storage/types.ts`)

| Interface / Type | Purpose & Key Fields |
|---|---|
| `TradeStatus` | `"WATCHLIST" \| "PENDING_ENTRY" \| "ACTIVE" \| "SCALED_T1" \| "CLOSED" \| "CANCELLED" \| "CLOSED_STOP" \| "CLOSED_TARGET" \| "CLOSED_TIME_STOP" \| "CLOSED_MANUAL"` |
| `Trade` | Represents a swing trade campaign. Key fields: `id`, `ticker`, `companyName`, `sector`, `status`, `setupType`, `entryTrigger`, `actualEntry`, `entryDate`, `sharesTotal`, `sharesRemaining`, `initialStop`, `currentStop`, `target1`, `target2`, `rrRatio`, `timeStopSessions`, `sessionsElapsed`, `realizedPnL`, `rMultiple`, `exitReason`, `notes`. |
| `Position` | Derived real-time position extending `Trade` with `currentPrice`, `unrealizedPnL`, `unrealizedPnLPct`, `openRiskDollars`, `openRiskPct`, `currentRMultiple`, `isStale`, `isStopBreakeven`. |
| `Signal` | Candidate trade signal: `id`, `researchRunId`, `ticker`, `companyName`, `setupType`, `entryTrigger`, `entryCondition`, `stopLoss`, `stopRationale`, `target1`, `target2`, `rrRatio`, `timeStopDays`, `positionShares`, `riskAmount`, `catalystDate`, `catalystSummary`, `bearCase`, `score`, `modelSources`, `status` (`"WATCHLIST" \| "PROMOTED" \| "DISMISSED"`). |
| `PortfolioState` | Sleeve state: `dedicatedCapital` ($15,000 default), `allocatedCapital`, `cashAvailable`, `openRiskDollars`, `openRiskPct`, `floatingPnL`, `totalRealizedPnL`, `winRate`, `profitFactor`, `totalTradesCount`, `closedTradesCount`, `avgRMultiple`, `maxOpenPositions` (3), `maxSectorPositions` (2), `maxSleeveRiskPct` (3.0%), `riskPerTradePct` (1.0%). |
| `UserSettings` | User configuration: `accountSize` ($15,000), `riskPerTrade` (1.0%), `maxSleeveRiskPct` (3.0%), `maxOpenPositions` (3), `maxSectorPositions` (2), `deskPasscode`, `audioEnabled`, `theme`. |
| `PortfolioStorageState` | Root snapshot containing `portfolio`, `activeTrades`, `pendingTrades`, `closedTrades`, `journal`, `signals`, `auditLogs`, `settings`, `lastSyncedAt`. |

### 2.2 AI & Arbiter Interfaces (`src/lib/ai/parser.ts` & `src/lib/ai/arbiter.ts`)

| Interface / Type | Purpose & Key Fields |
|---|---|
| `ParsedCandidate` | Standardized trade candidate extracted from LLM text/HTML: `ticker`, `companyName`, `setupType`, `entryTrigger`, `entryCondition`, `stopLoss`, `stopRationale`, `target1`, `target2`, `rrRatio`, `timeStopDays`, `positionShares`, `riskAmount`, `catalystDate`, `catalystSummary`, `bearCase`, `score`, `modelSource`. |
| `ParsedReport` | Standardized model report: `marketRegime` (`"FAVORABLE" \| "NEUTRAL" \| "HOSTILE"`), `regimeNotes`, `macroFlags`, `candidates: ParsedCandidate[]`, `rawHtml`. |
| `MasterSetup` | Extends `ParsedCandidate` with multi-model consensus metadata: `consensusCount: number`, `modelsAgreed: string[]`, `isConsensusPick: boolean`, `normalizedShares: number`, `normalizedRisk: number`. |
| `MasterArbiterPlan` | Output of CIO arbiter engine: `marketRegime`, `regimeNotes`, `macroFlags`, `consensusHighlight`, `masterSetups: MasterSetup[]`, `allCandidates: ParsedCandidate[]`, `modelBreakdowns: { gemini?, claude?, chatgpt? }`. |
| `AIModelConfig` | Frontier model configuration identifiers: `geminiModel` (`"gemini-3.7-flash"`), `claudeModel` (`"claude-sonnet-5"`), `openaiModel` (`"gpt-5.6"` / `"o3"`). |

### 2.3 Sizing & Rule Engine Interfaces (`src/lib/portfolio/sizing-calculator.ts` & `src/lib/market/rule-engine.ts`)

| Interface / Type | Purpose & Key Fields |
|---|---|
| `SizingInput` | `accountSize` (default $15,000), `riskPct` (default 1.0%), `entryPrice`, `stopLoss`, `atr`, `atrMultiplier` (2.0x), `target1`, `target2`, `cashAvailable`, `cashBufferPct` (5%), `maxPositionPct` (25%). |
| `SizingResult` | `isValid`, `status`, `shares`, `entryPrice`, `stopLoss`, `target1`, `target2`, `riskPerShare`, `dollarRisk`, `actualRiskPct`, `allocatedCapital`, `rewardToRisk`, `limitingFactor` (`"RISK_BUDGET" \| "BUYING_POWER" \| "MAX_POSITION_CAP"`). |
| `TradeEvaluation` | Result of live quote tick check: `tradeId`, `ticker`, `currentPrice`, `unrealizedPnL`, `unrealizedPnLPct`, `currentRMultiple`, `actionRequired`, `alertType`, `urgency`, `headline`, `orderInstruction`, `whyRationale`, `shouldAutoClose`, `suggestedStopUpdate`, `sharesToScale`. |

### 2.4 Prisma Database Schema (`prisma/schema.prisma`)

- **`User`**: Manages email, account size, risk per trade, API keys (`geminiKey`, `anthropicKey`, `openaiKey`), relations to research runs, trades, notifications.
- **`ResearchRun`**: Stores synthesized run per date, market regime, regime notes, macro flags, raw model reports, and relations to `CandidateSetup[]`.
- **`CandidateSetup`**: Persisted screener candidates with full pricing, R:R, catalyst, bear case, composite score, `modelSources`, status (`"WATCHLIST" | "PROMOTED" | "DISMISSED"`).
- **`Trade`**: Active, pending, scaled, and closed swing trades with real-time stops, targets, shares, P&L, and exit reason.
- **`MarketQuote`** & **`AlertNotification`**: Real-time tape snapshots and in-app coach alert flyouts.

---

## 3. Zustand & Storage Stores Mapping

### 3.1 Persistence Architecture
State management in Senior Broker is built on a **Dual-Layer Persistence Engine** (`LocalStoreService` at `src/lib/storage/local-store.ts` and `usePortfolioStore` / custom React hooks in `src/app/page.tsx`):

1. **L1 In-Memory Cache**: Zero-latency React render state (Map-based index for trades, journal entries, signals, settings).
2. **L2A Synchronous LocalStorage**: Instant cold-boot hydration (`senior_broker_custom_positions`, `senior_broker_settings`, `senior_broker_portfolio`, `senior_broker_journal`).
3. **L2B Prisma / SQLite Storage**: Server-side durable relational store for research runs, candidate setups, and multi-session audit logs.
4. **Cross-Tab Reactivity Bus**: `BroadcastChannel('senior_broker_bus')` + `window.addEventListener('storage')` to sync position updates, stop modifications, and candidate promotions in real-time across tabs.

### 3.2 Invariant Stop Loss Preservation
The store strictly protects trade invariants:
- **Upward-Only Stop Ratchet**: `saveTrade()` rejects any downward stop widening: `if (existing.currentStop > updatedTrade.currentStop) updatedTrade.currentStop = existing.currentStop;`
- **Non-Regressive Scaled Status**: Trades in `SCALED_T1` status cannot regress back to `ACTIVE`.

### 3.3 Event Subscriptions
`localStore.subscribe((event, type) => ...)` dispatches events:
`"STATE_INITIALIZED"`, `"TRADE_SAVED"`, `"TRADE_DELETED"`, `"TRADES_UPDATED"`, `"POSITION_SCALED"`, `"STOP_ADJUSTED"`, `"SIGNAL_PROMOTED"`, `"SETTINGS_UPDATED"`, `"JOURNAL_ENTRY_SAVED"`.

---

## 4. UI Components, Icons & Styling Patterns

### 4.1 Styling & Theme System (Public.com Obsidian Dark Aesthetic)
The app uses **Tailwind CSS v4** with a dark, high-contrast palette:
- **Background Obsidian Tokens**: `#070A0F` (base root), `#0C101A` (card surface), `#0E121D` / `#0E131F` (pill bars, modal surfaces), `black/40` to `black/70` (inner metric strips).
- **Borders & Glassmorphism**: `border border-white/[0.08]`, `backdrop-blur-2xl`, `shadow-xl`.
- **Typography & Font Monospace**: Sans for body typography; `font-mono` for all prices, tickers, shares, percentages, and session counters.
- **Color Coding**:
  - **Sky Blue (`text-sky-400`, `bg-sky-500/20`)**: Breakout trigger levels, entry conditions, AI coach feed.
  - **Emerald Green (`text-emerald-400`, `bg-emerald-500/20`)**: Target 1 levels, realized/unrealized profit, active trades, high conviction scores.
  - **Purple (`text-purple-400`, `bg-purple-500/20`)**: Target 2 runner extension, multi-model consensus badges (`CONSENSUS PICK`).
  - **Rose / Red (`text-rose-400`, `bg-rose-500/20`)**: Hard stop loss levels, invalidation warnings, negative P&L.
  - **Amber / Yellow (`text-amber-400`, `bg-amber-500/20`)**: Time stop counters (session 5–7), macro risk warnings.
  - **Frontier Model Badges**:
    - Gemini: `bg-indigo-500/20 text-indigo-300 border-indigo-500/30`
    - Claude: `bg-amber-500/20 text-amber-300 border-amber-500/30`
    - OpenAI: `bg-emerald-500/20 text-emerald-300 border-emerald-500/30`

### 4.2 Lucide Icons Inventory
Icons imported from `lucide-react`:
- `Sparkles`, `Layers`, `Cpu`, `CheckCircle`, `CheckCircle2`, `TrendingUp`, `Clock`, `ShieldAlert`, `ShieldCheck`, `ArrowRight`, `ChevronDown`, `ChevronUp`, `RefreshCw`, `X`, `Check`, `Copy`, `Key`, `ChevronRight`, `AlertTriangle`, `Percent`, `XCircle`, `Edit2`, `DollarSign`, `BookOpen`, `FileText`, `Activity`, `LogOut`, `Plus`, `GraduationCap`, `ListOrdered`.

### 4.3 Existing Dashboard & Screener Components
- `src/components/dashboard/MultiModelCompare.tsx`: Top model filter segmented pill control (`Master Arbiter Plan`, `Consensus Setups`, `Gemini 3.7 Flash`, `Claude`, `OpenAI 5.6`) + View mode toggle (`Setup Cards` vs `Summary Matrix`).
- `src/components/dashboard/SetupCard.tsx`: Individual candidate setup card displaying ticker, company, setup type pill, AI badges, composite conviction score, visual price ladder, trigger condition, catalyst summary, bear case, time stop session count, and action buttons.
- `src/components/dashboard/PriceLadder.tsx`: 4-tier visual execution ladder displaying stacked rows for Target 2 (Runner), Target 1 (50% scale & B/E stop), Entry trigger, and Hard Stop loss, with % distance and R-multiples.
- `src/components/dashboard/ExecutiveTable.tsx`: Summary matrix of all candidates with sorting by score, R:R, and 1-click select.
- `src/components/dashboard/RegimeBanner.tsx`: Top market regime consensus status banner (`FAVORABLE`, `NEUTRAL`, `HOSTILE`) with macro flags and CIO synthesis summary.
- `src/components/dashboard/ImportModal.tsx`: Multi-AI modal supporting automated multi-model execution, manual pasting of Gemini chat/Claude reports, and 1-click prompt copying.

### 4.4 Target Milestone 4 Component Modularization
As specified in `SCOPE.md`, Milestone 4 will organize screener components into `src/components/screener/`:
```
src/components/screener/
├── PromptStation.tsx            # Interactive prompt builder & 1-click clipboard copy
├── MultiReportIngestionModal.tsx # Multi-model paste modal with real-time format detection & preview
├── ConsensusArbiterView.tsx     # Multi-model consensus dashboard with +5 conviction badges & regime check
├── CandidateSetupCard.tsx       # Detailed setup card with 1% sizing, R:R, price ladder, and 1-click promotion
├── VisualPriceLadder.tsx        # 4-tier price ladder (T2, T1, Entry, Stop) with % distance & R-multiples
├── ScreenerTab.tsx              # Main Screener container integrating all subcomponents
└── index.ts                     # Clean barrel export
```

---

## 5. Feature 26: 1-Click Candidate Setup Promotion Interface

### 5.1 Promotion Workflow & Data Flow
When a user clicks **"Activate Trade"** or **"Watch Trigger"** on any candidate card:

```
[CandidateSetupCard / SetupCard]
       │
       ├── Mode: "ACTIVE" ─────────────► POST /api/trades (status: "ACTIVE", actualEntry = trigger)
       │                                     │
       └── Mode: "PENDING_ENTRY" ──────► POST /api/trades (status: "PENDING_ENTRY", actualEntry = null)
                                             │
                                             ▼
                                    [Prisma Database]
                                  - trade.create()
                                  - candidateSetup.update(status: "PROMOTED")
                                  - alertNotification.create(ENTRY_TRIGGERED)
                                             │
                                             ▼
                                    [LocalStoreService]
                                  - saveTrade(trade) [Stop ratchet invariant checked]
                                  - emitCrossTab("TRADE_SAVED")
                                             │
                                             ▼
                                  [ActiveTradesPanel / Watch Queue]
                                  - Real-time quote polling & coach evaluations
```

### 5.2 Sizing Math Normalization ($15,000 Capital Baseline)
1. **Risk Budget**: `accountSize * (riskPct / 100)` = `$15,000 * 1.0% = $150.00`.
2. **Risk Per Share**: `|entryTrigger - stopLoss|` (e.g. for ATRO: `$89.20 - $83.75 = $5.45`).
3. **Shares Allocated**: `Math.floor(riskBudget / riskPerShare)` = `Math.floor($150 / $5.45) = 27 shares`.
4. **Total Dollar Risk**: `27 * $5.45 = $147.15` (strictly `<= $150.00`).
5. **Capital Allocated**: `27 * $89.20 = $2,408.40` (`16.06%` of sleeve capital, within the 25% max position limit).

### 5.3 Promotion Modes & State Properties

| Field | `"ACTIVE"` Promotion | `"PENDING_ENTRY"` Promotion |
|---|---|---|
| `status` | `"ACTIVE"` | `"PENDING_ENTRY"` |
| `actualEntry` | Populated with entry price (`candidate.entryTrigger` or custom fill) | `null` / `undefined` |
| `entryDate` | Current ISO timestamp (`new Date().toISOString()`) | `null` / `undefined` |
| `sharesTotal` & `sharesRemaining` | Calculated 1% risk shares (`candidate.positionShares` or `normalizedShares`) | Same |
| `initialStop` & `currentStop` | Hard stop loss from candidate plan | Same |
| `target1` & `target2` | Derived 2.0R and 3.5R+ targets | Same |
| `timeStopSessions` | Preserved from candidate (`candidate.timeStopDays`, default 6) | Same |
| `notes` | Preserves catalyst date, catalyst summary, and bear case | Same |
| UI Navigation | Automatically sets `activeTab("POSITIONS")` and triggers audio chime | Sets `activeTab("POSITIONS")` with pending order in watch queue |

---

## 6. Dependencies, TypeScript Config & Verification Status

### 6.1 Dependency Inventory (`package.json`)
- **Framework & Core**: `next@16.3.1`, `react@19.2.8`, `react-dom@19.2.8`, `typescript@5`
- **Database & Persistence**: `@prisma/client@^7.9.1`, `@prisma/adapter-better-sqlite3@^7.9.1`, `better-sqlite3@^13.0.3`
- **Styling**: `tailwindcss@^4`, `@tailwindcss/postcss@^4`, `clsx@^2.1.1`, `tailwind-merge@^3.6.0`
- **Icons & Charts**: `lucide-react@^1.33.0`, `recharts@^3.10.1`, `canvas-confetti@^1.9.4`
- **AI SDKs**: `@anthropic-ai/sdk@^0.119.0`, `@google/genai@^2.17.1`, `openai@^7.5.0`
- **Auth**: `next-auth@^4.24.15`
- **Edge Deployment**: `@opennextjs/cloudflare@^1.20.2`, `wrangler@^4.124.0`

### 6.2 TypeScript Compilation Check
Ran `npx tsc --noEmit`:
- **Result**: `0` errors. Clean type validation across all source and test files.

### 6.3 Automated Test Suite Check
Ran `npm test` (`npx tsx src/tests/runner.ts`):
- **Discovered Files**: 28 test files
- **Total Assertions**: 529 assertions
- **Passed**: 529 passed (100% success rate)
- **Failed**: 0 failed
- **Execution Time**: 0.81s

---

## 7. Recommendations for Milestone 4 Implementers

1. **Modularize AI Types**: Create `src/lib/ai/types.ts` exporting centralized schemas for `FrontierModelId`, `ParsedCandidate`, `ParsedReport`, `MasterSetup`, `MasterArbiterPlan`, and `IngestionRequest`.
2. **Implement API Routes**: Add `src/app/api/research/ingest/route.ts` (accepting raw multi-LLM text for parsing/storage) and `src/app/api/research/sample/route.ts` (supplying rich Gemini 3.7 / Claude Sonnet 5 / OpenAI 5.6 mock reports).
3. **Build `src/components/screener/*`**: Create the dedicated screener folder containing `PromptStation.tsx`, `MultiReportIngestionModal.tsx`, `ConsensusArbiterView.tsx`, `CandidateSetupCard.tsx`, `VisualPriceLadder.tsx`, and `ScreenerTab.tsx`, ensuring Public.com dark theme styling and responsive layout.
4. **Ensure Backward Compatibility**: Ensure existing test files (`t1_screener_ai.test.ts`, `t2_arbiter_edge.test.ts`, `t3_arbiter_to_trade.test.ts`) continue to pass without regression.
