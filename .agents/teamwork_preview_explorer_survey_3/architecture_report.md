# Senior Broker: Architectural Blueprint & Test Planning Report

**Document Status**: FINAL  
**Author**: Explorer 3 (System Architect & Test Planner)  
**Target Environment**: Next.js 16 (React 19), Cloudflare Workers / Pages (@opennextjs/cloudflare), Prisma / D1 Edge Engine, TypeScript 5  
**Workspace Root**: `C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app`

---

## 1. Executive Summary & Architectural Vision

The **Senior Broker** application is an institutional-grade, consumer-friendly Swing Trading Coach, Portfolio Risk Intelligence, and Investor Learning platform inspired by the minimalist elegance and speed of **Public.com**. 

The application is engineered specifically around managing a **dedicated swing trading sleeve** ($15,000 default / <1% of total portfolio capital) with ruthless risk discipline:
1. **The 1% Hard Risk Rule**: Never risk more than 1% of the sleeve ($150 on a $15k account) on any single setup.
2. **Asymmetric 2:1 R:R & 50% Scaling**: Require at least 2:1 reward-to-risk to Target 1; scale out 50% at Target 1 and immediately raise stop to Breakeven (guaranteeing a risk-free campaign).
3. **Time-Stop Invalidation**: Enforce a 5–7 session time stop to liquidate stale positions and recycle capital.
4. **Aggregate Risk Cap**: Strict 3% sleeve risk cap across all open positions with sector concentration limits (max 2 positions per sector).
5. **Multi-LLM Consensus Screening**: Cross-reference independent research from **Google Gemini 3.7 Flash**, **Claude (Sonnet 5 / Opus / Fable)**, and **OpenAI 5.6 / o3** through an automated CIO Arbiter.
6. **Zero-Dependency Native Audio Engine**: Synthesize harmonic Web Audio API chimes directly in the browser for target fills, stop loss warnings, and entry triggers.
7. **Dual-Layer Edge & Local Persistence**: Provide instantaneous offline responsiveness via LocalStorage/IndexedDB with seamless synchronization to Cloudflare Workers / D1 and 1-click JSON backup export/import.

---

## 2. Module Architecture Boundaries & Directory Structure

To ensure maintainability, testability, and edge compatibility, the application adopts a **Domain-Driven Modular Architecture**. Business logic (risk math, rule evaluations, multi-LLM consensus, audio synthesis) is strictly decoupled from UI presentation components.

```
senior-broker-app/
├── prisma/
│   ├── schema.prisma                  # Prisma data models (User, Trade, ResearchRun, CandidateSetup, Alert)
├── public/                            # Static icons, manifest, PWA assets
├── src/
│   ├── app/                           # Next.js App Router
│   │   ├── api/                       # Edge-compatible API Route Handlers
│   │   │   ├── auth/[...nextauth]/    # NextAuth credentials / Google OAuth
│   │   │   ├── market/                # Market quotes & trigger polling
│   │   │   │   ├── quotes/route.ts
│   │   │   │   └── poll/route.ts
│   │   │   ├── notifications/route.ts # Alert notifications endpoint
│   │   │   ├── portfolio/             # Daily tactical briefing generator
│   │   │   │   └── daily-report/route.ts
│   │   │   ├── research/              # Multi-model research run & current endpoints
│   │   │   │   ├── current/route.ts
│   │   │   │   └── run/route.ts
│   │   │   ├── trades/route.ts        # Trade CRUD & 1-click tactical mutations
│   │   │   └── user/settings/route.ts # Capital sizing, risk %, API keys
│   │   ├── globals.css                # Tailwind CSS v4 & theme variables
│   │   ├── layout.tsx                 # Root layout & providers
│   │   └── page.tsx                   # Main SPA container & view coordinator
│   │
│   ├── components/                    # UI Component Hierarchy (Public.com Minimalist Design)
│   │   ├── auth/
│   │   │   ├── SignInView.tsx         # Dual-mode PIN / Google OAuth sign-in screen
│   │   │   └── PinPadModal.tsx        # 4-digit quick PIN unlock modal
│   │   ├── coach/                     # R3. AI Coach & Tactical Feed
│   │   │   ├── TacticalBriefingPanel.tsx # Morning/Mid-day briefing & 1-click copy
│   │   │   ├── CoachActionCard.tsx    # 1-Click execution cards (Scale 50%, Trail Stop, Exit)
│   │   │   └── WhyDrawer.tsx          # Institutional rationale explanation slide-over
│   │   ├── dashboard/                 # R1. Summary Dashboard & Sleeve Cards
│   │   │   ├── PortfolioSummaryCard.tsx # $15k Sleeve card (Allocated, Cash, Risk $, P&L sparkline)
│   │   │   ├── SparklineChart.tsx     # Lightweight canvas/SVG equity sparkline
│   │   │   ├── RegimeBanner.tsx       # Desk market regime status & macro flags
│   │   │   ├── ExecutiveTable.tsx     # Compact summary matrix of setups
│   │   │   ├── PriceLadder.tsx        # Visual 4-tier price ladder (T2, T1, Entry, Stop)
│   │   │   └── NotificationCenter.tsx # Push & in-app alert flyout
│   │   ├── education/                 # R5. Investor Learning Center
│   │   │   ├── LearningCenterView.tsx # Master education tab container
│   │   │   ├── StrategyLessonCard.tsx # Interactive visual guides (1% formula, 2:1 R:R, time stops)
│   │   │   ├── ScenarioCalculator.tsx # Interactive position sizing & stop placement simulator
│   │   │   └── LessonContentModal.tsx # Deep-dive lesson breakdown with quiz check
│   │   ├── journal/                   # R2. Trade Journal & Analytics
│   │   │   ├── TradeJournal.tsx       # Closed trades table with notes & filters
│   │   │   ├── PnLCurveChart.tsx      # Recharts cumulative P&L equity curve
│   │   │   └── MetricsRibbon.tsx      # Win Rate %, Realized P&L, Profit Factor, Avg R
│   │   ├── layout/
│   │   │   ├── Header.tsx             # Top navigation bar, ticker tape, quick actions
│   │   │   ├── TabNavigation.tsx      # 6-view pill segmented control
│   │   │   └── MobileBottomSheet.tsx  # Smooth mobile bottom drawer for modals
│   │   ├── positions/                 # R2. Active Positions & Logging
│   │   │   ├── ActiveTradesPanel.tsx  # Active positions & pending orders list
│   │   │   ├── AddTradeModal.tsx      # 15-second fast position logger with 1% auto-sizer
│   │   │   └── TacticalActionButtons.tsx # 1-Click scale / trail / exit buttons
│   │   ├── screener/                  # R4. Multi-LLM Screener & Arbiter
│   │   │   ├── MultiModelCompare.tsx  # Model comparison tab (Gemini vs Claude vs OpenAI)
│   │   │   ├── PromptStationModal.tsx # 1-Click standardized deep research prompt copy
│   │   │   ├── ImportModal.tsx        # AI report ingestion & runner modal
│   │   │   └── SetupCard.tsx          # High-conviction candidate card with consensus badge
│   │   └── settings/
│   │       ├── SettingsModal.tsx      # Capital allocation ($15k default), risk %, API keys
│   │       └── BackupModal.tsx        # 1-Click JSON export / import backup manager
│   │
│   ├── lib/                           # Domain Services & Business Logic (Pure TS)
│   │   ├── ai/                        # Multi-LLM Arbiter & Parser Engine
│   │   │   ├── arbiter.ts             # CIO consensus engine & scoring algorithm
│   │   │   ├── parser.ts              # Robust JSON & regex HTML report parser
│   │   │   ├── prompts.ts             # Standardized deep research & arbiter prompts
│   │   │   └── runners.ts             # Direct API callers (Gemini 3.7, Claude, OpenAI)
│   │   ├── audio/                     # Web Audio API Synthesizer
│   │   │   └── sound-effects.ts       # Zero-dependency harmonic chimes & alert tones
│   │   ├── auth/
│   │   │   └── auth-service.ts        # PIN / Desk passcode hashing & session tokens
│   │   ├── education/                 # Strategy lessons repository & scenario calculator math
│   │   │   └── lesson-data.ts
│   │   ├── market/                    # Market Quotes & Rule Evaluation Engine
│   │   │   ├── quotes.ts              # Live & simulated price quote provider
│   │   │   └── rule-engine.ts         # Invalidation, T1 trigger, trailing stop, time-stop checks
│   │   ├── notifications/
│   │   │   └── notification-service.ts# Web Audio + Web Push trigger coordinator
│   │   ├── portfolio/                 # Portfolio Intelligence & Sizing Math
│   │   │   ├── daily-report.ts        # Tactical moves briefing generator
│   │   │   └── sizing-calculator.ts   # 1% risk math & position sizing formulas
│   │   ├── storage/                   # Dual-Layer Persistence Engine
│   │   │   ├── local-store.ts         # LocalStorage & IndexedDB synchronous client layer
│   │   │   ├── sync-manager.ts        # Bidirectional sync & conflict resolution (LWW)
│   │   │   └── backup-service.ts      # Full JSON snapshot exporter & validator
│   │   ├── store/                     # State Management Store (Zustand)
│   │   │   ├── usePortfolioStore.ts   # Positions, closed trades, sleeve balance, risk metrics
│   │   │   ├── useCoachStore.ts       # Daily briefing, notifications, alerts
│   │   │   ├── useScreenerStore.ts    # Research runs, candidate setups, consensus picks
│   │   │   └── useSettingsStore.ts    # Capital, risk %, sound toggles, auth session
│   │   ├── prisma.ts                  # Universal Edge & Node-compatible Memory/D1 Store
│   │   └── seed-data.ts               # Default $15k portfolio, realistic swing trades & setups
│   │
│   └── tests/                         # Automated Test Suite (Unit, Integration & E2E)
│       ├── setup.ts                   # Vitest & Testing Library configuration
│       ├── unit/
│       │   ├── sizing-calculator.test.ts # 1% risk math & position sizing equation tests
│       │   ├── rule-engine.test.ts       # Target 1, Target 2, hard stop, time-stop rule tests
│       │   ├── arbiter.test.ts           # Multi-LLM consensus scoring algorithm tests
│       │   ├── parser.test.ts            # AI report parsing & regex fallback tests
│       │   ├── audio-synthesizer.test.ts # Web Audio node creation & scheduling tests
│       │   └── backup-service.test.ts    # JSON export/import backup validation tests
│       └── e2e/
│           ├── auth-flow.spec.ts         # PIN & Google sign-in verification
│           ├── position-logger.spec.ts   # 15-second trade entry & 1% auto-sizer verification
│           ├── tactical-actions.spec.ts  # 1-click scale 50% & breakeven stop verification
│           └── learning-center.spec.ts   # Interactive lessons & scenario calculator verification
│
├── open-next.config.ts                # OpenNext Cloudflare deployment config
├── wrangler.jsonc                     # Cloudflare Pages / Workers configuration
└── package.json                       # Scripts, dependencies, and build commands
```

---

## 3. Dual-Layer Persistence Strategy

To ensure zero data loss while supporting both offline local execution and Cloudflare edge deployment, the app uses a **Dual-Layer Active Persistence Strategy**:

```
+-------------------------------------------------------------------------+
|                              CLIENT TIER                                |
|                                                                         |
|   [ Zustand Reactive Stores ]                                           |
|               ▲                                                         |
|               │ (Instant sync on state change)                          |
|               ▼                                                         |
|   +-----------------------------------------------------------------+   |
|   | Local Storage                                                   |   |
|   | • senior_broker_auth (Session tokens & PIN verification)        |   |
|   | • senior_broker_settings (Account size $15k, Risk 1%, Sound ON) |   |
|   | • senior_broker_custom_positions (Offline custom trades)        |   |
|   | • senior_broker_active_tab (Current navigation view)            |   |
|   +-----------------------------------------------------------------+   |
|   | IndexedDB Store ('senior_broker_db')                            |   |
|   | • raw_llm_transcripts (Gemini, Claude, ChatGPT full outputs)   |   |
|   | • closed_trades_archive (Complete historical audit journal)     |   |
|   | • market_tick_history (Intraday quote snapshots for charts)     |   |
|   +-----------------------------------------------------------------+   |
+-------------------------------------------------------------------------+
                                    ▲
                                    │ Bidirectional Sync (LWW Protocol)
                                    ▼
+-------------------------------------------------------------------------+
|                        EDGE / SERVER TIER                               |
|                                                                         |
|   Next.js API Handlers (/api/trades, /api/research, /api/user/settings) |
|                                   │                                     |
|                                   ▼                                     |
|   Universal Edge Database Provider (`prisma.ts`)                        |
|   • Production Cloudflare: Cloudflare D1 SQL Database / KV Store        |
|   • Node Development: Better-SQLite3 (`dev.db`)                         |
|   • Fallback Edge Runtime: Global In-Memory Persistent Store            |
+-------------------------------------------------------------------------+
                                    ▲
                                    │
                                    ▼
+-------------------------------------------------------------------------+
|                        EXPORT / IMPORT BACKUP                           |
|   • 1-Click JSON Snapshot: { version: "1.0", exportedAt, user,         |
|                             positions, closedTrades, research, notes }  |
|   • Instant Restore: Schema validation + atomic database rehydration   |
+-------------------------------------------------------------------------+
```

### 3.1 Persistence Layers Specification

1. **Layer 1: Client-Side Immediate Cache (LocalStorage + IndexedDB)**
   - **LocalStorage**: Synchronous key-value storage used for instant state rehydration on app launch (auth session, user settings, active tab, audio mute preferences).
   - **IndexedDB**: High-capacity structured storage for heavy payloads (raw HTML/Markdown LLM transcripts, full multi-year closed trade history, intraday sparkline price series).
2. **Layer 2: Universal Edge Database (Prisma / D1 / MemoryStore)**
   - Unified API interface via `src/lib/prisma.ts`.
   - In Cloudflare Workers environment, requests run on the edge isolate without Node native binary dependencies (`better-sqlite3`), using memory store or Cloudflare D1 bindings.
   - In local Node.js environment, persists to SQLite `dev.db`.
3. **Synchronization & Conflict Resolution**:
   - **Optimistic UI Updates**: State updates locally first; background fetch calls propagate changes to `/api/trades`.
   - **Last-Write-Wins (LWW)**: All trade mutations carry an `updatedAt` ISO timestamp. If network reconnects, latest timestamp overwrites stale records.
   - **Offline Mode**: If offline, mutations queue in LocalStorage and replay automatically upon `window.addEventListener('online')`.
4. **1-Click Backup Export & Import**:
   - Standardized JSON schema export containing:
     - User profile & settings ($15,000 account, 1% risk per trade).
     - Active & pending swing positions with entry, stops, and targets.
     - Full closed trade history with R-multiples and realized P&L.
     - Multi-model research runs and master arbiter plans.
   - Import engine performs structural schema validation before atomic restore.

---

## 4. State Management Architecture

The application requires low-latency reactivity across market quote polling, Web Audio synthesis, 1-click tactical mutations, and multi-model research ingestion without causing full React re-render cascades.

### 4.1 Comparison & Architectural Choice: Zustand

| Requirement | React Context | Redux Toolkit | Zustand | Custom Store |
| :--- | :--- | :--- | :--- | :--- |
| **Bundle Impact** | 0 kB (Built-in) | ~12 kB (Heavy) | **< 1.8 kB (Minimal)** | ~0.5 kB (Custom) |
| **Out-of-React Access** | ❌ Difficult (Hooks only) | ✅ Via `store.dispatch` | **✅ Via `useStore.getState()`** | ✅ Direct |
| **Partial Re-renders** | ❌ Causes subtree re-render | ✅ Selector-based | **✅ Fine-grained Selectors** | ⚠️ Needs listener math |
| **Persistence Middleware** | ❌ Manual boilerplate | ⚠️ Requires redux-persist | **✅ Built-in `persist()`** | ❌ Manual |
| **Async Polling / Audio** | ⚠️ Complex in effects | ⚠️ Redux Thunk/Saga | **✅ Seamless async actions** | ⚠️ High boilerplate |

**Selection**: **Zustand** (or zero-dependency lightweight custom reactive store following the exact same selector contract).

### 4.2 State Slice Architecture

```typescript
// Slices definition
interface PortfolioSlice {
  accountSize: number; // Default: $15,000
  riskPerTrade: number; // Default: 1.0% ($150)
  maxSleeveRiskPct: number; // Default: 3.0% ($450)
  activeTrades: Trade[];
  pendingTrades: Trade[];
  closedTrades: Trade[];
  marketQuotes: Record<string, QuoteData>;
  isPolling: boolean;
  
  // Sizing Math Selectors
  allocatedCapital: () => number;
  cashAvailable: () => number;
  totalOpenRiskDollars: () => number;
  totalOpenRiskPct: () => number;
  totalUnrealizedPnL: () => number;
  
  // Tactical Actions
  scaleTradeT1: (tradeId: string, fillPrice?: number) => Promise<void>;
  updateTradeStop: (tradeId: string, newStop: number) => Promise<void>;
  closeTrade: (tradeId: string, reason: string, closePrice?: number) => Promise<void>;
  addTrade: (tradeData: NewTradeInput) => Promise<void>;
}

interface CoachSlice {
  dailyReport: DailyPortfolioReport | null;
  notifications: AppNotification[];
  unreadAlertsCount: number;
  soundEnabled: boolean;
  loadDailyReport: () => Promise<void>;
  pollMarketData: () => Promise<void>;
  markAllNotificationsRead: () => void;
  toggleSound: () => void;
}

interface ScreenerSlice {
  researchRun: ResearchRun | null;
  candidates: MasterSetup[];
  selectedModelFilter: "ALL" | "CONSENSUS" | "Gemini" | "Claude" | "ChatGPT";
  isResearchRunning: boolean;
  runMultiModelResearch: (customTranscript?: string) => Promise<void>;
}

interface EducationSlice {
  completedLessons: string[];
  activeLessonId: string | null;
  calculatorState: {
    accountSize: number;
    riskPct: number;
    entryPrice: number;
    stopLossPrice: number;
    target1Price: number;
    target2Price: number;
  };
  markLessonComplete: (lessonId: string) => void;
  updateCalculator: (params: Partial<EducationSlice["calculatorState"]>) => void;
}
```

---

## 5. Web Audio API Synthesizer Engine (Zero-Dependency)

To ensure instantaneous acoustic feedback without relying on external `.mp3` or `.wav` assets (which introduce network latency, 404 risks, or CORS issues), Senior Broker implements a **Pure Web Audio API Synthesizer** generating custom harmonic waveforms on demand.

### 5.1 Acoustic Signatures & Waveform Specifications

1. **Target Reach Celebration (`playTargetChime`)**:
   - **Pattern**: Ascending Major Triad Arpeggio with Shimmer Overtones.
   - **Notes**: $C_6$ ($1046.50\text{ Hz}$) $\rightarrow$ $E_6$ ($1318.51\text{ Hz}$) $\rightarrow$ $G_6$ ($1567.98\text{ Hz}$) $\rightarrow$ $C_7$ ($2093.00\text{ Hz}$).
   - **Waveform**: Pure `sine` wave with subtle 2nd harmonic overtone.
   - **ADSR Envelope**: $40\text{ms}$ linear attack, $600\text{ms}$ exponential decay down to $0.001$ gain.
   - **Psychological Effect**: Clean, uplifting confirmation of profit taking.

2. **Stop Loss Invalidation / Danger Alert (`playStopLossAlert`)**:
   - **Pattern**: Dual Low-Frequency Descending Pulse with Sub-Bass Warning.
   - **Notes**: $G_3$ ($196.00\text{ Hz}$) sweeping downward to $D_3$ ($146.83\text{ Hz}$) $\rightarrow$ Second pulse at $A_2$ ($110.00\text{ Hz}$).
   - **Waveform**: `triangle` layered with soft `sawtooth` passed through a low-pass filter ($800\text{ Hz}$).
   - **ADSR Envelope**: $30\text{ms}$ attack, $400\text{ms}$ rapid decay.
   - **Psychological Effect**: Unambiguous, urgent, disciplined reminder to exit immediately.

3. **Entry Trigger / Order Filled Ping (`playEntryTriggered`)**:
   - **Pattern**: High-Fidelity Bell Ding.
   - **Notes**: $A_5$ ($880.00\text{ Hz}$) transitioning to $C\#_6$ ($1108.73\text{ Hz}$).
   - **Waveform**: High-resonance `sine` with fast decay ($350\text{ms}$).
   - **Psychological Effect**: Crisp operational execution feedback.

4. **Time-Stop Stale Warning (`playTimeStopWarning`)**:
   - **Pattern**: Subtle Dual Neutral Chime ($F\#_5$ $739.99\text{ Hz} \rightarrow D_5$ $587.33\text{ Hz}$).
   - **Waveform**: Soft `sine` wave with gentle $500\text{ms}$ fade.

### 5.2 Autoplay Policy & AudioContext Lifecycle

```typescript
// src/lib/audio/sound-effects.ts
class SynthesizerEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public unlockAudioOnUserInteraction() {
    if (typeof window === "undefined") return;
    const unlock = () => {
      const ctx = this.getContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume();
      }
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("senior_broker_sound_muted", String(muted));
    }
  }
}
```

---

## 6. Multi-LLM Screener & Arbiter Engine

The **Opportunity Screener** leverages three distinct frontier AI model families:
- **Google Gemini 3.7 Flash**: High-speed live web search, catalyst discovery, volume analysis.
- **Anthropic Claude (Sonnet 5 / Opus / Fable)**: Deep market microstructure analysis, relative strength evaluation, sector rotation dynamics.
- **OpenAI 5.6 / o3**: Quantitative scenario stress-testing, risk/reward validation, macroeconomic regime analysis.

### 6.1 Standardized Prompt Station & Ingestion Pipeline

1. **Standardized Prompt Station**: Provides a 1-click clipboard copy of the institutional swing research prompt formatted for web search chats (specifying long-only, 1% risk math, 2:1 R:R to Target 1, 5-7 session time stop, and no upcoming earnings).
2. **Multi-Report Ingestion**: Accepts raw HTML, Markdown, or JSON from all 3 models via direct API calls (when keys are configured) or manual paste in the Import Modal.
3. **Robust Fallback Parser**: Combines structured JSON parsing with regex pattern extractors for tickers, triggers, stops, targets, R:R ratios, catalysts, and regime assessments.

### 6.2 Mathematical Consensus Scoring Algorithm

```
                  +--------------------------+
                  |  Gemini 3.7 Flash Report |
                  +------------+-------------+
                               |
                  +------------+-------------+
                  |  Claude Sonnet 5 Report  |
                  +------------+-------------+
                               |
                  +------------+-------------+
                  |   OpenAI 5.6 / o3 Report |
                  +------------+-------------+
                               │
                               ▼
        +──────────────────────────────────────────────+
        |         MASTER CIO ARBITER ENGINE            |
        |                                              |
        | 1. Market Regime Consensus Harmonization     |
        | 2. Candidate Normalization & Deduplication   |
        | 3. Strict 1% Risk Sizing Math Computation   |
        | 4. Multi-Model Conviction Scoring Formula    |
        +──────────────────────┬───────────────────────+
                               │
                               ▼
                +──────────────────────────────+
                |    MASTER ARBITER PLAN       |
                | • Unified Regime (FAVORABLE) |
                | • Consensus Picks (Bonus +5) |
                | • Visual Price Ladders       |
                +──────────────────────────────+
```

#### Consensus Algorithm Formulation:

1. **Desk Regime Harmonization**:
   Let $R_m \in \{\text{FAVORABLE}, \text{NEUTRAL}, \text{HOSTILE}\}$ be the regime vote of model $m \in \{1, \dots, M\}$.
   $$\text{Final Regime} = \begin{cases} 
   \text{HOSTILE} & \text{if } \sum \mathbb{I}(R_m = \text{HOSTILE}) \ge 2 \\
   \text{NEUTRAL} & \text{if } \sum \mathbb{I}(R_m = \text{NEUTRAL}) \ge 2 \\
   \text{FAVORABLE} & \text{otherwise}
   \end{cases}$$
   - When **HOSTILE**, maximum sleeve open risk is reduced from $3.0\%$ to $1.5\%$.

2. **Position Sizing Math (Dedicated $15,000 Sleeve)**:
   For each candidate ticker $i$:
   $$\text{Risk Budget} = \text{Account Size} \times \left(\frac{\text{Risk Percent}}{100}\right) = \$15,000 \times 1\% = \$150.00$$
   $$\text{Risk Per Share} = \max(0.01, |\text{Entry Trigger}_i - \text{Stop Loss}_i|)$$
   $$\text{Shares}_i = \left\lfloor \frac{\text{Risk Budget}}{\text{Risk Per Share}} \right\rfloor$$
   $$\text{Allocated Capital}_i = \text{Shares}_i \times \text{Entry Trigger}_i$$
   $$\text{Reward Per Share}_i = |\text{Target 1}_i - \text{Entry Trigger}_i|$$
   $$\text{RR Ratio}_i = \frac{\text{Reward Per Share}_i}{\text{Risk Per Share}_i} \quad (\text{Strict Rule: Must be } \ge 2.0)$$

3. **Composite Conviction Score**:
   $$\text{Base Score}_i = \frac{1}{|M_i|} \sum_{m \in M_i} \text{Score}_{i, m}$$
   $$\text{Consensus Multiplier} = 1.0 + 0.08 \times (|M_i| - 1)$$
   $$\text{Consensus Bonus} = \begin{cases} 5.0 \times (|M_i| - 1) & \text{if } |M_i| > 1 \\ 0 & \text{otherwise} \end{cases}$$
   $$\text{Composite Score}_i = \min\left(99.0, \text{Base Score}_i \times \text{Consensus Multiplier} + \text{Consensus Bonus}\right)$$

---

## 7. Interactive Investor Education & Learning Center

The **Investor Learning Center (R5)** provides structured, interactive educational content paired with contextual "Why?" coach insights and an interactive scenario calculator.

### 7.1 Core Strategy Lessons

| # | Lesson Title | Key Concepts & Interactive Elements |
| :--- | :--- | :--- |
| **L1** | **The 1% Risk Formula** | Math of capital preservation. Interactive formula builder demonstrating how widening stops reduces share size, while keeping dollar risk constant at $150. |
| **L2** | **Asymmetric 2:1 R:R & Target Scaling** | Why scaling 50% at Target 1 and moving the remaining 50% stop to Breakeven mathematically eliminates negative outcomes on running trades. |
| **L3** | **Time Stops vs. Price Stops** | Opportunity cost of stagnant capital. Why holding a consolidation setup beyond 5–7 sessions deteriorates win rate and ties up sleeve liquidity. |
| **L4** | **Sector Caps & Sleeve Risk** | Managing portfolio heat. Why no single sector should hold $>2$ positions and why total open risk must stay under 3% of the sleeve ($450). |
| **L5** | **Market Regime Identification** | Assessing index health (SPY/QQQ 20D/50D MAs, market breadth >60%, VIX < 18) before allocating swing capital. |

### 7.2 Contextual "Why?" Coach Insights

Every tactical recommendation (e.g. "Scale 50% & Move Stop to Breakeven") includes an expandable **"Why this move?"** bottom sheet / popover detailing:
- **Institutional Mechanism**: Why market makers fade extended moves into prior resistance.
- **Risk Math Justification**: How banking 1.0R on half the position pays for any future slippage.
- **Historical Backtest Context**: How trailing stops outperform fixed targets in trending market regimes.

### 7.3 Interactive Sizing & Scenario Calculator

A dedicated sandbox where users can test prospective trades before order placement:
- Inputs: Account Size (default $15,000), Risk % (default 1.0%), Entry Price, Stop Loss, Target 1, Target 2.
- Outputs: Calculated Shares, Capital Required, Dollar Risk, R:R Ratio, P&L at Target 1, P&L at Target 2, Maximum Loss at Stop.
- Visuals: Live interactive Price Ladder updating in real time as sliders move.

---

## 8. Testing Strategy & Test Architecture

To ensure total system stability, continuous verification, and rapid regression testing in both local Node.js and Cloudflare CI/CD pipelines, Senior Broker implements a dual **Vitest + Playwright** test architecture.

```
                    +--------------------------------+
                    |       SENIOR BROKER APP        |
                    +---------------+----------------+
                                    |
            +-----------------------+-----------------------+
            |                                               |
            ▼                                               ▼
+───────────────────────────────+               +───────────────────────────────+
|      VITEST UNIT SUITE        |               |      PLAYWRIGHT E2E SUITE     |
| (Execution: < 2.5 seconds)    |               | (Cross-Browser & Mobile PWA)  |
+───────────────────────────────+               +───────────────────────────────+
| • 1% Risk Sizing Math         |               | • Dual-Mode Auth (PIN/Google) |
| • Rule Engine Invalidation    |               | • 15-Second Trade Entry Flow  |
| • Arbiter Consensus Algorithm |               | • 1-Click Scale & Breakeven   |
| • AI Report Parsing (Gemini,  |               | • Learning Center Calculator  |
|   Claude, OpenAI)             |               | • JSON Export/Import Backup   |
| • Web Audio Waveform Synthesis|               | • Web Push & Notification Fly |
| • Dual-Layer Sync & LWW       |               |                               |
+───────────────────────────────+               +───────────────────────────────+
```

### 8.1 Unit & Integration Test Architecture (Vitest)

Vitest is selected for its instantaneous execution, native TypeScript / ESM support, and zero-configuration compatibility with Next.js 16 and React 19.

#### Test Suites Coverage:
1. `src/tests/unit/sizing-calculator.test.ts`:
   - Validates $15,000 account at 1% risk computes exactly $150 risk budget.
   - Validates share rounding logic (`Math.floor`) preventing fractional share over-allocation.
   - Tests boundary conditions ($0.01 stop distance, zero price, inverted stop/entry).
2. `src/tests/unit/rule-engine.test.ts`:
   - Tests `PENDING_ENTRY` $\rightarrow$ `ENTRY_TRIGGERED` when quote $\ge$ trigger.
   - Tests `ACTIVE` $\rightarrow$ `STOP_ALERT` when quote $\le$ stop loss (verifying `shouldAutoClose: true`).
   - Tests `ACTIVE` $\rightarrow$ `TARGET_1_HIT` when quote $\ge$ target 1 (verifying 50% scale recommendation).
   - Tests `SCALED_T1` $\rightarrow$ `TARGET_2_HIT` when quote $\ge$ target 2.
   - Tests `TIME_STOP_WARNING` when `sessionsElapsed >= timeStopSessions`.
3. `src/tests/unit/arbiter.test.ts`:
   - Validates consensus bonus (+5.0 points per matching model).
   - Verifies regime voting logic (2 Hostile = HOSTILE regime; 2 Neutral = NEUTRAL).
   - Confirms sorting puts multi-model consensus picks at rank 1.
4. `src/tests/unit/parser.test.ts`:
   - Tests JSON extraction from fenced code blocks (` ```json `).
   - Tests regex fallback parser extracting tickers, prices, and catalysts from raw text.
5. `src/tests/unit/backup-service.test.ts`:
   - Tests serialization of active trades, closed trades, and settings into backup JSON.
   - Tests validation failure on corrupt or missing fields.
   - Tests atomic restoration without mutating unrelated state.

### 8.2 End-to-End Test Architecture (Playwright)

Playwright simulates real user workflows across Desktop (Chromium, Firefox, WebKit) and Mobile Emulation (iPhone 15 / Android Chrome):
- **E2E 1: Authentication & Onboarding**: Verifies PIN entry, Google 1-click fallback, and instant desk unlocking.
- **E2E 2: 15-Second Position Logging**: Opens Add Position modal, enters ticker "NVDA", entry $120.00, stop $115.00, verifies 1% risk auto-sizes to 30 shares ($150 risk), saves position, and verifies it appears in Active Positions.
- **E2E 3: 1-Click Tactical Execution**: Clicks "Scale 50% & Move Stop to Breakeven", verifies trade transitions to `SCALED_T1`, shares reduce by 50%, and stop automatically raises to entry price.
- **E2E 4: Learning Center Interaction**: Navigates to Learning Center, opens Scenario Calculator, drags stop loss slider, and verifies Price Ladder levels update dynamically.
- **E2E 5: Backup Export & Import**: Exports backup file, deletes a position, imports backup file, and verifies position is restored.

---

## 9. Proposed Milestone Breakdown & Dependency Graph

A structured 5-milestone roadmap designed for clear verification at each stage:

```
[ M1: Core Domain, State & Persistence ]
                   │
                   ▼
[ M2: Minimalist Public.com Navigation & Sleeve Dashboard ]
                   │
                   ▼
[ M3: Position Management, 1-Click Actions & Web Audio ]
                   │
                   ▼
[ M4: Multi-LLM Screener, Prompt Station & Arbiter ]
                   │
                   ▼
[ M5: Learning Center, E2E Test Suite & Cloudflare Deploy ]
```

### Milestone Specifications

#### Milestone 1 (M1): Core Domain Models, Dual-Layer Persistence & State Engine
- **Objective**: Establish the foundation types, sizing math, rule evaluation engine, universal edge Prisma memory/D1 store, LocalStorage/IndexedDB sync manager, and Zustand state store.
- **Deliverables**:
  - `src/lib/portfolio/sizing-calculator.ts` ($15k default, 1% risk math).
  - `src/lib/market/rule-engine.ts` (T1, T2, stop invalidation, time stop).
  - `src/lib/storage/local-store.ts` & `backup-service.ts`.
  - `src/lib/store/usePortfolioStore.ts`.
  - Unit test suite `sizing-calculator.test.ts` & `rule-engine.test.ts`.
- **Contract / Verification**: Vitest passes 100% on sizing formulas and rule state transitions.

#### Milestone 2 (M2): Minimalist Public.com Navigation Shell & Summary Dashboard
- **Objective**: Build the Public.com-inspired user interface shell with 6 focused views, high-level Dedicated Swing Sleeve Card ($15,000 default), cash/risk breakdown, floating P&L sparkline, and dual-mode PIN/Google authentication.
- **Deliverables**:
  - `src/components/layout/Header.tsx`, `TabNavigation.tsx`, `MobileBottomSheet.tsx`.
  - `src/components/dashboard/PortfolioSummaryCard.tsx` & `SparklineChart.tsx`.
  - `src/components/auth/SignInView.tsx` & `PinPadModal.tsx`.
  - Responsive layout for desktop and mobile PWA.
- **Contract / Verification**: UI renders with 0 errors; PIN unlock transitions to dashboard showing $15,000 sleeve balance and $150 (1%) risk allocation.

#### Milestone 3 (M3): Position Manager, 1-Click Tactical Actions & Web Audio Engine
- **Objective**: Implement fast position logger (under 15s entry), real-time trade tracker, visual Price Ladders, 1-click tactical actions ("Scale 50% & Move Stop to Breakeven", "Trail Stop", "Exit"), closed trade journal with P&L curve, and zero-dependency Web Audio API synthesizer chimes.
- **Deliverables**:
  - `src/components/positions/ActiveTradesPanel.tsx` & `AddTradeModal.tsx`.
  - `src/components/positions/TacticalActionButtons.tsx`.
  - `src/components/dashboard/PriceLadder.tsx`.
  - `src/components/journal/TradeJournal.tsx` & `PnLCurveChart.tsx`.
  - `src/lib/audio/sound-effects.ts` (pure Web Audio synthesizer).
- **Contract / Verification**: Clicking "Scale 50%" updates trade in place, recalculates risk, plays ascending major triad chime, and raises stop to breakeven.

#### Milestone 4 (M4): Multi-LLM Screener, Prompt Station & Consensus Arbiter
- **Objective**: Deploy the daily research hub supporting Gemini 3.7 Flash, Claude Sonnet 5/Opus/Fable, and OpenAI 5.6/o3 with 1-click Prompt Station, multi-model ingestion modal, regex fallback parser, consensus scoring algorithm, and candidate setup cards with consensus badges.
- **Deliverables**:
  - `src/lib/ai/prompts.ts`, `parser.ts`, `arbiter.ts`, `runners.ts`.
  - `src/components/screener/PromptStationModal.tsx`, `ImportModal.tsx`, `MultiModelCompare.tsx`, `SetupCard.tsx`.
  - 1-click promotion of candidate setups to active/pending trades.
- **Contract / Verification**: Synthesizing 3 model outputs correctly groups matching tickers (e.g. ATRO), applies consensus score bonus, and generates 4-tier price ladders.

#### Milestone 5 (M5): Investor Learning Center, E2E Test Suite & Cloudflare Deployment
- **Objective**: Implement the 5 interactive strategy lessons, contextual "Why?" coach insights, interactive sizing & scenario calculator, full Playwright E2E test suite, and Cloudflare Pages / Workers deployment verification (`npm run build` and `npm run cf:build`).
- **Deliverables**:
  - `src/components/education/LearningCenterView.tsx`, `StrategyLessonCard.tsx`, `ScenarioCalculator.tsx`.
  - `src/components/coach/WhyDrawer.tsx`.
  - Playwright test specs (`auth-flow.spec.ts`, `position-logger.spec.ts`, `tactical-actions.spec.ts`).
  - Cloudflare deployment validation with zero TypeScript/lint errors.
- **Contract / Verification**: `npm run build` exits 0; E2E tests pass cleanly across desktop and mobile viewports.

---

## 10. Architectural Risk Assessment & Mitigation Matrix

| Risk Factor | Impact | Likelihood | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Web Audio Autoplay Block** | High | Medium | Implement user interaction unlock listener (`click`, `touchstart`) on the first user interaction to seamlessly resume `AudioContext`. |
| **Cloudflare Edge Isolate Limits** | High | Low | Pure JS/TS implementation without native Node C++ bindings (`better-sqlite3` isolated to dev, Universal MemoryStore/D1 in production). |
| **LLM Output Format Variability** | Medium | Medium | Dual parsing pipeline: structured JSON parser primary, supplemented with regex pattern extractors for tickers, numbers, and catalysts. |
| **Data Loss on Browser Storage Clear** | High | Low | Dual-layer persistence (LocalStorage + IndexedDB + API Store) + 1-Click JSON Backup Export / Restore feature. |
| **Position Sizing Math Rounding Errors** | Medium | Low | Use strict `Math.floor` on share sizing and enforce `Math.max(0.01, |Entry - Stop|)` to prevent division by zero or fractional over-allocation. |

---

## 11. Conclusion

This architecture delivers a **production-grade, resilient, and blazing-fast** swing trading platform that perfectly captures the minimalist Public.com consumer experience while embedding institutional prop-desk risk management. Every component is designed to be fully testable, edge-deployable to Cloudflare, and resilient against data loss.
