# Project: Senior Broker — Swing Trading Coach & Investor Education Overhaul

## Architecture
- **Framework & Runtime**: Next.js 16 (React 19), TypeScript 5, Tailwind CSS v4, Cloudflare Pages/Workers edge runtime compatibility.
- **Persistence & Storage**: Dual-Layer Persistence (Synchronous LocalStorage + IndexedDB client layer + Universal Edge Prisma Memory/D1 store + 1-Click JSON Snapshot Export/Import).
- **Audio Engine**: Native Web Audio API Synthesizer (pure procedural oscillators, zero external audio asset dependencies).
- **Multi-LLM Intelligence**: Modular prompt station & arbiter engine ingesting Google Gemini 3.7 Flash, Claude Sonnet 5/Opus/Fable, and OpenAI 5.6/o3 with mathematical consensus conviction scoring.
- **Visual Design**: Public.com-inspired minimalist dark obsidian aesthetic, pill badges, interactive sparklines, and smooth mobile bottom sheets.

## Code Layout
```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── market/quotes/route.ts
│   │   ├── market/poll/route.ts
│   │   ├── notifications/route.ts
│   │   ├── portfolio/daily-report/route.ts
│   │   ├── research/current/route.ts
│   │   ├── research/run/route.ts
│   │   ├── trades/route.ts
│   │   └── user/settings/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── auth/ (SignInView.tsx, PinPadModal.tsx)
│   ├── coach/ (TacticalBriefingPanel.tsx, CoachActionCard.tsx, WhyDrawer.tsx)
│   ├── dashboard/ (PortfolioSummaryCard.tsx, SparklineChart.tsx, PriceLadder.tsx)
│   ├── education/ (LearningCenterView.tsx, StrategyLessonCard.tsx, ScenarioCalculator.tsx)
│   ├── journal/ (TradeJournal.tsx, PnLCurveChart.tsx, MetricsRibbon.tsx)
│   ├── layout/ (Header.tsx, TabNavigation.tsx, MobileBottomSheet.tsx)
│   ├── positions/ (ActiveTradesPanel.tsx, AddTradeModal.tsx, TacticalActionButtons.tsx)
│   ├── screener/ (MultiModelCompare.tsx, PromptStationModal.tsx, ImportModal.tsx, SetupCard.tsx)
│   └── settings/ (SettingsModal.tsx, BackupModal.tsx)
├── lib/
│   ├── ai/ (arbiter.ts, parser.ts, prompts.ts, runners.ts)
│   ├── audio/ (sound-effects.ts)
│   ├── auth/ (auth-service.ts)
│   ├── education/ (lesson-data.ts)
│   ├── market/ (quotes.ts, rule-engine.ts)
│   ├── notifications/ (notification-service.ts)
│   ├── portfolio/ (daily-report.ts, sizing-calculator.ts)
│   ├── storage/ (local-store.ts, backup-service.ts, sync-manager.ts)
│   ├── store/ (usePortfolioStore.ts, useCoachStore.ts, useScreenerStore.ts, useEducationStore.ts)
│   ├── prisma.ts
│   └── seed-data.ts
└── tests/
    ├── unit/ (sizing, rules, arbiter, parser, audio, backup tests)
    └── e2e/ (auth, position logger, 1-click actions, education, research tests)
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Portfolio Summary Card | Displays Dedicated Capital ($15,000 default), Allocated Capital, Cash Available, Open Risk ($ and %), Floating P&L | M2 | R1.1 |
| 2 | Interactive Equity Sparklines | Responsive sparkline/chart visualizing intraday & cumulative sleeve equity curve | M2 | R1.1 |
| 3 | 6-View Pill Segmented Navigation | Seamless switching: Coach Feed, Active Positions, Screener, Education, Journal, Settings | M2 | R1.2 |
| 4 | Public.com Minimalist Dark UI | Obsidian background, glassmorphism, pill badges, mobile bottom sheets, zero cognitive clutter | M2 | R1.3 |
| 5 | Dual-Mode Authentication | 4-Digit PIN / Desk Passcode + Google OAuth 1-click access | M2 | R6.1 |
| 6 | 1% Account Risk Auto-Sizer | 1-click automatic share sizing ($150 risk on $15k capital) based on entry and hard stop | M1 | R2.1 |
| 7 | Real-Time Position Tracking | Tracks entry price, current price, shares, hard stop, Target 1, Target 2, holding days | M3 | R2.2 |
| 8 | Pending Watch Order Queue | Manages breakout/pullback watch triggers with 1-click "Fill Entry Now" | M3 | R2.2 |
| 9 | 1-Click Scale 50% & Move Stop to B/E | Sells 50% shares at market/T1, locks partial profit, and automatically raises stop to entry | M3 | R3.1 |
| 10 | Dynamic Trailing Stop Adjuster | Tightens or trails stop loss under swing lows with downward-widening protection | M3 | R3.1 |
| 11 | 1-Click Exit Stale Position | Liquidates remaining shares at market, calculates final campaign R-multiple and logs exit reason | M3 | R3.1 |
| 12 | Closed Trade Journal & Analytics | Tracks Win Rate %, Realized P&L, Profit Factor, Average R-Multiple, and Discipline Score | M3 | R2.3 |
| 13 | Interactive Journal Equity Curve | Visual cumulative P&L progression across closed trade history | M3 | R2.3 |
| 14 | Prioritized Daily Moves Briefing | Morning & Mid-Day tactical action items triaged by High, Medium, Low urgency | M3 | R3.2 |
| 15 | 1-Click Copy Briefing | Standardized markdown export of daily briefing for note-taking and journaling | M3 | R3.2 |
| 16 | 1% Risk Rule Enforcement | Rejects or warns on any trade exceeding 1% account risk | M1 | R3.3 |
| 17 | 5–7 Session Time-Stop Rule | Flags positions stagnating for 5-7 sessions without breakout expansion | M1 | R3.3 |
| 18 | 3.0% Total Sleeve Risk Cap | Enforces aggregate open risk limit ($450 on $15k), freezing new entries when exceeded | M1 | R3.3 |
| 19 | Sector Concentration Limiter | Warns when >2 active positions reside in the same industry sector | M1 | R3.3 |
| 20 | Zero-Dependency Web Audio Chimes | Procedural Web Audio tones for Target reach (C6-E6-G6), Stop alert (G3-D3), Entry ping (A5-C#6) | M3 | R3.4 |
| 21 | Web Push & Toast Notifications | Real-time push alerts and in-app toast flyouts on rule triggers | M3 | R3.4 |
| 22 | Multi-LLM Frontier Ingestion | Ingests or generates deep research from Gemini 3.7 Flash, Claude Sonnet 5, and OpenAI 5.6 | M4 | R4.1 |
| 23 | 1-Click Research Prompt Station | Standardized 4-step web search chat prompt copy for deep swing setup discovery | M4 | R4.2 |
| 24 | Multi-Model Consensus Arbiter | Cross-references tickers, harmonizes market regime, awards +5 bonus pts per agreeing model | M4 | R4.3 |
| 25 | Visual 4-Tier Price Ladders | Stacked execution levels (T2, T1, Entry, Stop) with % distance and R-multiples | M4 | R4.3 |
| 26 | 1-Click Candidate Promotion | Promotes screener setups directly to Active or Pending trades with pre-filled 1% sizing math | M4 | R4.3 |
| 27 | 5 Interactive Strategy Lessons | Core modules: 1% Risk Formula, 2:1 R:R & Target Scaling, Time Stops, Sleeve Caps, Market Regimes | M5 | R5.1 |
| 28 | Contextual "Why?" Coach Insights | Expandable institutional and mathematical rationale explaining every recommendation | M5 | R5.2 |
| 29 | Interactive Sizing Sandbox Calculator | Practice tool for testing stops, targets, and sizing with real-time price ladder updates | M5 | R5.3 |
| 30 | Dual-Layer Persistence & Local Storage | Universal edge memory/D1 store + browser localStorage/IndexedDB ensuring zero data loss | M1 | R6.2 |
| 31 | 1-Click JSON Snapshot Backup/Restore | Full data export and atomic restore schema validator | M1 | R6.2 |
| 32 | Cloudflare Workers & Pages Compatibility | Zero native Node C++ locks, 100% clean OpenNext build (`npm run build`) | M5 | R6.2 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core Domain & Persistence | Sizing math ($15k default, 1% risk), Rule Engine, Dual-Layer Storage, Backup Service | none | DONE |
| M2 | Public.com UI Shell & Dashboard | 6-View Navigation, Portfolio Summary Card ($15k default), Sparkline, Dual Auth | M1 | IN_PROGRESS |
| M3 | Positions, Actions & Web Audio | 15s Position Logger, 1-Click Moves (Scale 50%, B/E stop), Journal Analytics, Web Audio Chimes | M1, M2 | PLANNED |
| M4 | Multi-LLM Screener & Arbiter | Frontier Models (Gemini 3.7, Claude Sonnet 5, OpenAI 5.6), Prompt Station, Consensus Arbiter | M1, M3 | PLANNED |
| M5 | Education Center & Cloudflare Deploy | 5 Strategy Lessons, "Why?" Coach Insights, Sizing Calculator, Build & Deployment Validation | M1, M2, M3 | PLANNED |
| Final | E2E Verification & Hardening | Pass 100% E2E tests (Tiers 1-4) + Adversarial Coverage Hardening (Tier 5) | M1-M5, E2E Track | PLANNED |

## Interface Contracts
### `src/lib/portfolio/sizing-calculator.ts`
- `calculatePositionSize(params: { accountSize: number, riskPct: number, entryPrice: number, stopLoss: number, target1?: number, target2?: number }): SizingResult`
- Output: `{ shares: number, allocatedCapital: number, dollarRisk: number, actualRiskPct: number, target1: number, target2: number, rewardToRisk: number }`

### `src/lib/market/rule-engine.ts`
- `evaluateTradeRules(trade: Trade, currentQuote: number, sessionsElapsed: number): RuleEvaluationResult`
- Output: `{ actionRequired: "NONE" | "SCALE_T1" | "TARGET_2" | "STOP_LOSS" | "TIME_STOP_WARNING" | "TIME_STOP_EXPIRED", urgency: "LOW" | "MEDIUM" | "HIGH", orderInstruction: string, whyRationale: string }`

### `src/lib/ai/arbiter.ts`
- `arbitrateResearchRuns(runs: ModelReport[], accountSize: number, riskPct: number): MasterArbiterPlan`
- Output: `{ deskRegime: "FAVORABLE" | "NEUTRAL" | "HOSTILE", consensusCandidates: MasterSetup[], individualCandidates: MasterSetup[] }`

### `src/lib/audio/sound-effects.ts`
- `playTargetChime(): void` (C6 -> E6 -> G6 -> C7 ascending harmonic arpeggio)
- `playStopLossAlert(): void` (G3 -> D3 -> A2 descending pulse)
- `playEntryTriggered(): void` (A5 -> C#6 bell ping)
- `playTimeStopWarning(): void` (F#5 -> D5 gentle chime)
