# Milestone 4 Architectural Design Report: Multi-LLM Screener, Prompt Station & Arbiter Engine

**Author:** Explorer 3 (Milestone 4 Preview & Architecture)  
**Date:** 2026-08-19  
**Target Milestone:** Milestone 4 (Multi-LLM Screener, Prompt Station & Arbiter)  
**Workspace:** `C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app`  
**Output Target:** `src/components/screener/*`, `src/lib/ai/*`, `src/app/api/research/*`

---

## 1. Executive Summary & Architecture Overview

The Multi-LLM Screener, Prompt Station, and Consensus Arbiter Engine form the institutional intelligence backbone of the Senior Broker application. Designed for managing a dedicated swing trading sleeve ($15,000 default capital / <1% portfolio risk), this system transforms unstructured multi-model AI research (from **Google Gemini 3.7 Flash**, **Anthropic Claude Sonnet 5/Opus/Fable**, and **OpenAI 5.6/o3**) into deterministic, mathematically normalized trade plans with 1-click execution.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                    USER INTERACTION                                    │
│  ┌────────────────────────┐      ┌───────────────────────────┐      ┌───────────────┐  │
│  │ 1-Click Prompt Station │ ---> │ Frontier LLM Web Searches │ ---> │ Raw Reports   │  │
│  │ (Dynamic 4-Step Prompt)│      │ (Gemini, Claude, ChatGPT) │      │ (HTML / Text) │  │
│  └────────────────────────┘      └───────────────────────────┘      └───────┬───────┘  │
└────────────────────────────────────────────────┬────────────────────────────┼──────────┘
                                                 │                            │
                                                 ▼                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              CORE ARBITER & INGESTION PIPELINE                         │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │ 1. Multi-Report Ingestion & Robust Parser (`parser.ts`)                        │   │
│   │    - Regex / HTML / JSON fallback extraction                                   │   │
│   │    - Entity extraction: Ticker, Levels (Entry/Stop/T1/T2), Catalyst, Bear Case │   │
│   └───────────────────────────────────────┬────────────────────────────────────────┘   │
│                                           │                                            │
│                                           ▼                                            │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │ 2. Market Regime Harmonizer (`arbiter.ts`)                                     │   │
│   │    - Reconciles Favorable / Neutral / Hostile verdicts across all models       │   │
│   │    - Synthesizes macro hazard calendar (FOMC, CPI, PPI, jobs reports)          │   │
│   └───────────────────────────────────────┬────────────────────────────────────────┘   │
│                                           │                                            │
│                                           ▼                                            │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │ 3. Cross-Model Deduplication & Conviction Scoring Engine                       │   │
│   │    - Groups by canonical ticker symbol                                         │   │
│   │    - Awards +5.0 bonus points per agreeing model (Consensus Flag)              │   │
│   │    - Harmonizes entry triggers, structural stops, and profit targets           │   │
│   └───────────────────────────────────────┬────────────────────────────────────────┘   │
│                                           │                                            │
│                                           ▼                                            │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │ 4. 1% Account Risk Position Sizer Normalizer (`sizing-calculator.ts`)          │   │
│   │    - Strict 1% risk math ($150 risk on $15k, $1,000 on $100k)                  │   │
│   │    - Shares = floor(Risk Budget / |Entry - Stop|)                              │   │
│   │    - Guardrail enforcement (25% max position capital cap, cash buffers)        │   │
│   │    - Generates 4-Tier Visual Price Ladder data                                 │   │
│   └───────────────────────────────────────┬────────────────────────────────────────┘   │
└───────────────────────────────────────────┼────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PRESENTATION LAYER                                     │
│  ┌───────────────────────┐   ┌───────────────────────────┐   ┌──────────────────────┐  │
│  │ ConsensusArbiterView  │   │ CandidateSetupCard        │   │ VisualPriceLadder    │  │
│  │ (Regime + Matrix View)│   │ (Catalyst, Bear, Actions) │   │ (T2, T1, Entry, Stop)│  │
│  └───────────────────────┘   └─────────────┬─────────────┘   └──────────────────────┘  │
│                                            │                                           │
│                       ┌────────────────────┴───────────────────┐                       │
│                       ▼                                        ▼                       │
│             1-Click "Watch Trigger"                  1-Click "Activate Trade"          │
│             (TradeStatus: PENDING_ENTRY)             (TradeStatus: ACTIVE)             │
│             -> Auto-populates Trade Store            -> Auto-populates Active Position │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Feature 23: 1-Click Standardized Deep Research Prompt Station Design

### 2.1 Prompt Engineering Philosophy & System Prompt
The Prompt Station generates a self-contained, rigorously constrained prompt designed to force frontier reasoning LLMs (Gemini 3.7 Flash, Claude 3.7 Sonnet / Claude Sonnet 5, OpenAI 5.6 / o3) to act as institutional proprietary swing traders.

#### Complete Formatted Prompt Template (`SWING_TRADE_RESEARCH_PROMPT`)

```markdown
# Swing Trade Deep Research Prompt — Sector-Agnostic, Long-Only Shares

Act as a senior swing-trading strategist at a proprietary trading desk. Your task is to research current live market conditions and identify the **top 3 swing trade opportunities** — long-only, shares-only, any sector — and deliver findings as a **single, polished, self-contained HTML report**. Every recommendation must be a complete trade plan, not just a stock pick: a trade without a defined entry, stop, and target is not a trade.

## Trader Profile (Fixed Desk Constraints)
- **Direction:** Long only. No shorts, no options, no leveraged margin.
- **Holding window:** 3 days to 4 weeks (3 to 7 trading sessions typical). The technical setup dictates the exit, not the calendar.
- **Setup styles:**
  1. Momentum / Base Breakouts: Stocks emerging from >3-week consolidation bases on expanding volume (>1.5x 50-day average).
  2. Post-Earnings Catalyst Continuation (PEAD): Fresh, confirmed positive catalyst (earnings beat + raised guidance, major contract, FDA approval, analyst upgrade cycle) in early innings. Do NOT recommend holding through an upcoming binary event.
  3. First Pullback / Bull Flag: Controlled 2 to 4-day pullback to rising 20-day EMA on decreasing volume.
  4. High-Tight Flag: Momentum leaders holding tight consolidation in upper 20% of range following explosive advance.
- **Risk Rule:** Strict 1.0% account risk per trade (${dollarRisk} risk on ${accountSize} dedicated capital). Every setup must specify exact share sizing derived from the stop distance.

## Step 1 — Market Regime Check (Do this FIRST, report it prominently)
Assess whether macro and broad market conditions favor long swing trades:
- Trend of SPY and QQQ vs. their 20-day EMA and 50-day SMA.
- Market Breadth: % of stocks above 50-day SMA (>60% favorable, <40% hostile), Net Advance/Decline line.
- Volatility Regime: CBOE VIX level (<18 favorable, 18–24 neutral, >25 hostile) and short-term trajectory.
- Macro Hazard Calendar: Scheduled high-impact macro events within the next 14 days (FOMC rate decisions/minutes, CPI, PPI, Core PCE, Non-Farm Payrolls).
- State an authoritative verdict: **Favorable / Neutral / Hostile**.

## Step 2 — Screening Universe & Liquidity Filters
Only consider stocks meeting ALL of the following criteria:
- **Exchange:** NYSE or NASDAQ only (strictly zero OTC / pink sheets / penny stocks).
- **Price:** Above $5.00 per share (prevents sub-penny microcap manipulation).
- **Liquidity:** Average Daily Volume (ADV) > 1,000,000 shares OR Average Daily Dollar Volume (ADDV) > $20,000,000.
- **Float Structure:** Float < 100M shares (for high-velocity momentum) OR S&P 500 / Russell 1000 highly liquid institutional leader.
- **Volatility Expansion:** 14-day Average True Range (ATR) of at least ~2.0% of share price (guarantees sufficient swing expansion room).
- **Earnings Calendar Rule:** NO confirmed earnings report inside the expected holding window (minimum 10 trading days clearance).
- **Solvency:** No active going-concern warnings, delisting notices, SEC fraud investigations, or halted trading status.

## Step 3 — Research Requirements Per Candidate Setup
For each of the top 3 candidate setups, provide the complete dossier:
1. **Technical Pattern & Volume Confirmation:** Describe base structure (e.g. 4-week cup-and-handle, ascending triangle, 20D EMA test), breakout pivot, and volume expansion ratio.
2. **Relative Strength (RS):** 1-month and 3-month RS performance vs. SPY / QQQ benchmark.
3. **Fundamental Catalyst:** Exact announcement date, primary source verification (SEC 8-K, 10-Q, official press release), and headline metrics (Revenue beat %, EPS beat %, guidance revision %, backlog growth).
4. **Market Structure & Positioning:** Short interest (% of float), Days-to-Cover (DTC), Institutional ownership %, Distance above 50-day SMA.
5. **Mandatory 5-Point Trade Plan:**
   - **Entry Trigger:** Exact price and trigger condition (e.g., "Buy-stop on 30-min candle close above $89.20 pivot").
   - **Hard Invalidation Stop:** Exact price and technical rationale (e.g., "$83.75 — below catalyst gap-open support and 20-day EMA").
   - **Target 1 (T1):** Exact price delivering >= 2.0:1 Reward-to-Risk (Take 50% profit and ratchet stop to Breakeven).
   - **Target 2 (T2):** Exact price delivering >= 3.5:1 Reward-to-Risk (Measured move / full runner exit).
   - **Time Stop Limit:** Maximum sessions (3 to 7 sessions) before liquidating stagnant positions.
   - **Position Sizing Math:** For ${accountSize} account risking ${riskPercent}% (${dollarRisk} max risk):
     - Risk Per Share = Entry Trigger - Hard Stop
     - Position Shares = floor(${dollarRisk} / Risk Per Share)
     - Total Position Capital = Position Shares * Entry Trigger
6. **The Honest Bear Case:** Detail the top 2-3 specific failure modes (e.g. overhead supply, valuation stretch, sector rotation headwinds, market pullbacks).

## Step 4 — Weighted Selection & Scoring Rubric (100-Point Scale)
Every candidate setup is evaluated on this strict 100-point rubric:
- **Setup Quality & Base Cleanliness (30%):** Tight consolidation, clear horizontal resistance, volume surge >150% ADV.
- **Relative Strength vs. SPY/QQQ (25%):** Making new relative highs while broad market consolidates.
- **Asymmetric Risk/Reward >= 2:1 (20%):** Mathematical R:R to Target 1 >= 2.0:1 based on hard stop distance.
- **Catalyst Durability (15%):** Secular multi-quarter driver (e.g. raised full-year guidance) vs. one-off headline noise.
- **Liquidity & Clean Exit (10%):** Tight bid/ask spread (<0.10%), institutional sponsorship, zero liquidity traps.

## Structured Output Schema (Required HTML & JSON Format)
Deliver your response formatted with HTML markup containing:
- `<section id="regime">` with Verdict (**FAVORABLE / NEUTRAL / HOSTILE**), Regime Notes, and Macro Hazard Calendar.
- For each setup, an `<article class="trade-setup" data-ticker="TICKER">` with clean `<h3>`, `<p class="levels">`, `<p class="catalyst">`, and `<p class="bear-case">`.
- Include a closing `<script type="application/json" id="structured-data">` containing valid JSON adhering to the CandidateSetup schema.
```

### 2.2 Dynamic Prompt Customizer Engine
The Prompt Station allows users to dynamically configure parameters before copying or running:
1. **Account Size ($A$):** $15,000 (default swing sleeve), $25,000 (PDT baseline), $50,000, $100,000, or Custom.
2. **Risk Percentage ($R_{pct}$):** 0.5% (Conservative), 1.0% (Standard Desk Rule), 1.5% (Aggressive).
3. **Strategy Style Presets:**
   - *Momentum Breakout*: 3–5 session holding window, ADV > 1.5M, RS > SPY.
   - *Post-Earnings PEAD Continuation*: 5–7 session holding window, beat + raise catalyst, 10-day earnings clearance.
   - *First Pullback to 20D EMA*: 3–5 session window, controlled low-volume retest, 2.5:1 R:R target.
   - *High-Tight Flag*: 2–4 session window, ATR > 3.5%, float < 50M.
4. **Frontier Model Targets:**
   - Google Gemini 3.7 Flash
   - Anthropic Claude (Claude Sonnet 5, Claude Opus, Claude Fable)
   - OpenAI (OpenAI 5.6, OpenAI o3, GPT-4o)

---

## 3. Feature 24: Multi-Model Consensus Arbiter Engine Design

### 3.1 Mathematical Formulation & Data Flow
The Consensus Arbiter Engine takes $N$ independent research reports ($N \ge 1$), harmonizes market regimes, cross-references and deduplicates candidate setups, computes multi-model conviction bonuses, normalizes position sizing to exact account parameters, and derives visual price ladder metrics.

```
                         ┌─────────────────────────────────┐
                         │ Model Reports Array:            │
                         │ [Gemini 3.7, Claude 5, O5.6...] │
                         └────────────────┬────────────────┘
                                          │
                                          ▼
                         ┌─────────────────────────────────┐
                         │ Market Regime Consensus Voting  │
                         │ (Defensive Bias Rule)           │
                         └────────────────┬────────────────┘
                                          │
                                          ▼
                         ┌─────────────────────────────────┐
                         │ Canonical Ticker Grouping:      │
                         │ Map<Ticker, Candidate[]>        │
                         └────────────────┬────────────────┘
                                          │
                                          ▼
                         ┌─────────────────────────────────┐
                         │ Conviction Score Calculation:   │
                         │ Score = Base + 5.0 * (M - 1)    │
                         └────────────────┬────────────────┘
                                          │
                                          ▼
                         ┌─────────────────────────────────┐
                         │ 1% Risk Sizing Normalization:   │
                         │ Shares = floor(Risk / |E - S|)  │
                         │ Caps: Buying Power & 25% Sleeve │
                         └────────────────┬────────────────┘
                                          │
                                          ▼
                         ┌─────────────────────────────────┐
                         │ Visual Price Ladder Generation  │
                         │ (T2, T1, Entry, Stop, R-Mults)  │
                         └────────────────┬────────────────┘
                                          │
                                          ▼
                         ┌─────────────────────────────────┐
                         │ MasterArbiterPlan Output        │
                         │ (Sorted: Consensus first, Score)│
                         └─────────────────────────────────┘
```

### 3.2 Desk Market Regime Harmonization Algorithm
Given individual model regime verdicts $V_m \in \{\text{FAVORABLE}, \text{NEUTRAL}, \text{HOSTILE}\}$:

$$\text{Count}(V) = \sum_{m=1}^N \mathbf{1}(V_m = V)$$

**Institutional Risk-Averse Bias Logic:**
1. **Hostile Dominance:** If $\text{Count}(\text{HOSTILE}) \ge 2$, Desk Regime $\leftarrow \text{HOSTILE}$.
2. **Defensive Precaution:** If $\text{Count}(\text{HOSTILE}) == 1 \land \text{Count}(\text{NEUTRAL}) \ge 1$, Desk Regime $\leftarrow \text{NEUTRAL}$.
3. **Neutral Consolidation:** If $\text{Count}(\text{NEUTRAL}) \ge 2$, Desk Regime $\leftarrow \text{NEUTRAL}$.
4. **Favorable Expansion:** If $\text{Count}(\text{FAVORABLE}) \ge 2 \land \text{Count}(\text{HOSTILE}) == 0$, Desk Regime $\leftarrow \text{FAVORABLE}$.
5. **Fallback:** If $N == 1$, Desk Regime $\leftarrow V_1$.

### 3.3 Candidate Ticker Deduplication & Level Reconciliation
When multiple models recommend the same ticker (e.g. `ATRO` recommended by both Gemini and Claude):
1. **Canonical Ticker Key:** `const key = candidate.ticker.trim().toUpperCase()`.
2. **Model Agreement Set:** `modelsAgreed = Array.from(new Set(candidates.map(c => c.modelSource)))`.
3. **Consensus Count:** $M = |\text{modelsAgreed}|$.
4. **Consensus Flag:** $\text{isConsensusPick} = (M \ge 2)$.
5. **Level Harmonization:**
   - *Primary Entry Trigger ($E$):* Taken from the highest-scoring model or weighted average:
     $$E = \text{primaryCandidate.entryTrigger}$$
   - *Hard Stop Loss ($S$):* For long trades, the most technically conservative stop is maintained:
     $$S = \max(S_1, S_2, \dots, S_M) \quad \text{such that } S < E$$
     This guarantees risk distance $|E - S|$ is never widened arbitrarily.
   - *Target 1 ($T_1$):* Adjusted to ensure minimum 2.0:1 R:R:
     $$T_1 = \max(\text{primaryCandidate.target1}, E + 2.0 \times (E - S))$$
   - *Target 2 ($T_2$):*
     $$T_2 = \max(\text{primaryCandidate.target2}, E + 3.5 \times (E - S))$$

### 3.4 Consensus Conviction Scoring Math (+5.0 Bonus Rule)
To reward multi-model verification without artificially exceeding the 100-point ceiling:

$$\text{BaseScore} = \text{primaryCandidate.score}$$

$$\text{ConsensusBonus} = \begin{cases} 5.0 \times (M - 1) & \text{if } M \ge 2 \\ 0.0 & \text{if } M = 1 \end{cases}$$

$$\text{FinalScore} = \min(99.0, \text{round}(\text{BaseScore} + \text{ConsensusBonus}, 1))$$

*Example:*
- `ATRO` baseline score from Claude = $91.8$.
- Gemini also selects `ATRO` ($M = 2$).
- Consensus Bonus $= 5.0 \times (2 - 1) = +5.0$.
- Final Score $= \min(99.0, 91.8 + 5.0) = \mathbf{96.8}$.

### 3.5 1% Risk Sizing Math & Portfolio Guardrails
For dedicated capital $A$ (default $15,000.00$) and risk per trade $R_{pct}$ (default $1.0\%$):

1. **Dollar Risk Budget:**
   $$\text{RiskBudget} = A \times \left(\frac{R_{pct}}{100}\right) = \$15,000 \times 0.01 = \mathbf{\$150.00}$$
   *(Or for a $100,000 account: $\$100,000 \times 0.01 = \mathbf{\$1,000.00}$)*

2. **Risk Per Share:**
   $$\text{RiskPerShare} = \max(0.01, E - S)$$

3. **Raw Risk Shares:**
   $$\text{RawShares} = \frac{\text{RiskBudget}}{\text{RiskPerShare}}$$

4. **Single-Position Capital Concentration Cap (25% Sleeve Cap):**
   $$\text{MaxPositionCapital} = A \times 0.25 = \$15,000 \times 0.25 = \mathbf{\$3,750.00}$$
   $$\text{CapitalCappedShares} = \frac{\text{MaxPositionCapital}}{E}$$

5. **Normalized Share Count:**
   $$\text{NormalizedShares} = \max(1, \lfloor \min(\text{RawShares}, \text{CapitalCappedShares}) \rfloor)$$

6. **Normalized Dollar Risk & Actual Risk %:**
   $$\text{NormalizedRisk} = \text{round}(\text{NormalizedShares} \times \text{RiskPerShare}, 2)$$
   $$\text{ActualRiskPct} = \text{round}\left(\frac{\text{NormalizedRisk}}{A} \times 100, 4\right)$$

### 3.6 Visual Price Ladder Metrics Formulation
For each finalist setup, the arbiter calculates exact price ladder display metrics:

| Ladder Step | Price Level | Distance % | R-Multiple | Execution Action | Profit / Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Target 2 (Runner)** | $T_2$ | $+\frac{T_2 - E}{E} \times 100\%$ | $+ \frac{T_2 - E}{\text{RiskPerShare}}\text{R}$ (typ. $+3.5\text{R}$) | Close Remaining 50% | $+ (\text{Shares} - \lceil\text{Shares}/2\rceil) \times (T_2 - E)$ |
| **Target 1 (Scale 50%)** | $T_1$ | $+\frac{T_1 - E}{E} \times 100\%$ | $+ \frac{T_1 - E}{\text{RiskPerShare}}\text{R}$ (typ. $+2.0\text{R}$) | Sell 50% & Ratchet Stop to B/E | $+ \lceil\text{Shares}/2\rceil \times (T_1 - E)$ |
| **Entry Trigger** | $E$ | $0.0\%$ (Pivot) | $0.0\text{R}$ | Buy Execution Trigger | Total Capital: $\text{Shares} \times E$ |
| **Hard Stop Loss** | $S$ | $-\frac{E - S}{E} \times 100\%$ | $-1.00\text{R}$ | Immediate Market Invalidation | $-\text{NormalizedRisk}$ ($1.0\%$ of sleeve) |

---

## 4. UI Component Hierarchy in `src/components/screener/*`

```
src/components/screener/
├── ScreenerTab.tsx                 # Main container coordinating state, filters, modals, and store integration
├── PromptStation.tsx               # Interactive 4-step prompt station & 1-click clipboard copy
├── MultiReportIngestionModal.tsx   # Ingestion modal supporting automated frontier models & multi-panel paste
├── ConsensusArbiterView.tsx        # Multi-model consensus dashboard with regime banner & matrix/card views
├── CandidateSetupCard.tsx          # High-conviction setup card with live quotes, catalyst, bear case & 1-click promo
├── VisualPriceLadder.tsx           # 4-tier visual execution ladder (T2, T1, Entry, Stop) with R:R and sizing
└── index.ts                        # Module exports barrel
```

### 4.1 `PromptStation.tsx`
- **Purpose:** Interactive prompt generator providing 1-click clipboard copy of the standardized 4-step Deep Research prompt formatted for Gemini 3.7 Flash, Claude Sonnet 5, and OpenAI 5.6 web search chats.
- **Props Interface:**
  ```typescript
  export interface PromptStationProps {
    accountSize?: number;
    riskPercent?: number;
    isOpen?: boolean;
    onClose?: () => void;
    onLaunchModel?: (model: "gemini" | "claude" | "chatgpt") => void;
  }
  ```
- **Key Features & UX:**
  1. *Dynamic Parameter Customizers:* Account size selector ($15k default, $25k, $50k, $100k, custom), risk percentage (0.5% to 2.0%), strategy style presets (Breakout, PEAD, Pullback, High-Tight Flag).
  2. *Frontier Model Selection Pills:* Google Gemini 3.7 Flash, Claude Sonnet 5 / Opus / Fable, OpenAI 5.6 / o3.
  3. *1-Click Copy with Animated Feedback:* Large CTA button copying markdown prompt with green checkmark animation and procedural Web Audio click ping.
  4. *Collapsible Live Prompt Preview:* Clean code preview box with syntax highlighting.
  5. *Direct Deep Links:* One-click buttons to open `gemini.google.com`, `claude.ai`, and `chatgpt.com` in new browser tabs.

### 4.2 `MultiReportIngestionModal.tsx`
- **Purpose:** Ingests research outputs from frontier models via automated API execution or manual paste, parsing raw reports with real-time heuristic validation before synthesizing the Master Arbiter Plan.
- **Props Interface:**
  ```typescript
  export interface MultiReportIngestionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onResearchCompleted: (plan: MasterArbiterPlan) => void;
    accountSize?: number;
    riskPercent?: number;
  }
  ```
- **Key Features & UX:**
  1. *Three-Tab Segmented Workflow:*
     - `Automated Run`: Select models (Gemini 3.7 Flash, Claude Sonnet 5, OpenAI 5.6), click "Execute Multi-AI Deep Research", with multi-step animated progress indicators.
     - `Manual Multi-Paste`: Tabbed textareas for Gemini Chat, Claude Report, and ChatGPT text/HTML, plus a Universal Single-Paste area.
     - `Prompt Station`: Embedded prompt viewer with 1-click copy.
  2. *Live Heuristic Format Detection:* Real-time regex validation detecting recognized tickers (`ATRO`, `MTRN`, `GLBE`, `CRWV`, `NIQ`, `LITE`, etc.), regime keywords (`FAVORABLE`, `NEUTRAL`, `HOSTILE`), and trade levels.
  3. *Error & Warning Banner:* Explains parsing status, fallback strategies, and missing fields.
  4. *Deterministic Persistence:* Saves `ResearchRun` and `CandidateSetup` records to Prisma DB and synchronous LocalStorage vault.

### 4.3 `ConsensusArbiterView.tsx`
- **Purpose:** Central intelligence view rendering the harmonized Desk Market Regime Banner, aggregate consensus metrics, model filtering controls, and candidate setups.
- **Props Interface:**
  ```typescript
  export interface ConsensusArbiterViewProps {
    arbiterPlan: MasterArbiterPlan | null;
    marketQuotes: Record<string, any>;
    onPromoteToTrade: (setup: MasterSetup, mode: "PENDING_ENTRY" | "ACTIVE") => void;
    onOpenPromptStation: () => void;
    onOpenIngestModal: () => void;
    accountSize?: number;
    riskPercent?: number;
  }
  ```
- **Key Features & UX:**
  1. *Harmonized Market Regime Banner:*
     - Regime Pill Badge (`FAVORABLE` emerald, `NEUTRAL` amber, `HOSTILE` rose).
     - Macro Hazard Radar (upcoming FOMC, CPI, PPI, jobs prints).
     - Index Technical Breadth (SPY/QQQ vs 20D/50D MAs, % stocks > 50D MA, VIX level).
     - Arbiter Executive Synthesis note.
  2. *Segmented Model Filter Pills (Apple/Public.com Style):*
     - `Master Arbiter Plan (All N)`
     - `Consensus Picks Only (K)` (Purple glowing badge)
     - `Gemini 3.7 Flash` (Indigo badge)
     - `Claude Sonnet 5 / Opus` (Amber badge)
     - `OpenAI 5.6` (Emerald badge)
  3. *View Mode Switcher:* Toggle between `Setup Cards (2-Column Grid)` and `Executive Summary Table (Matrix View)`.
  4. *Quick Action Toolbar:* "Run / Ingest Research", "Open Prompt Station", "Copy Markdown Briefing".

### 4.4 `CandidateSetupCard.tsx`
- **Purpose:** Rich interactive card displaying the candidate setup's complete trade dossier, live price quote, visual price ladder, catalyst analysis, bear case risks, and 1-click promotion triggers.
- **Props Interface:**
  ```typescript
  export interface CandidateSetupCardProps {
    setup: MasterSetup;
    liveQuote?: {
      price: number;
      change: number;
      changePct: number;
      high?: number;
      low?: number;
      volume?: number;
    };
    onPromoteToTrade: (setup: MasterSetup, mode: "PENDING_ENTRY" | "ACTIVE") => void;
    accountSize?: number;
    riskPercent?: number;
  }
  ```
- **Key Features & UX:**
  1. *Header:* Ticker (large mono bold), Company Name, Setup Style Pill, Model Attribution Badges, and Consensus Pick Pill with `+5 BONUS` score.
  2. *Live Quote & Composite Conviction Pill:* Real-time quote with green/red % change, and glowing Score pill (e.g. `96.8 / 100`).
  3. *Integrated `VisualPriceLadder`:* Embedded 4-tier visual ladder.
  4. *Trigger Condition Box:* Sky-blue bordered box with execution condition.
  5. *Dual Fundamental & Risk Analysis:*
     - *Catalyst Box (Emerald tint):* Exact date, headline metrics, primary source verification.
     - *The Honest Bear Case (Rose tint):* Structural failure modes, overhead supply, macro risks.
  6. *Footer & 1-Click Action Buttons:*
     - Time Stop Sessions Badge (`Max 5 sessions`).
     - `Watch Trigger ($XX.XX)`: Promotes to `PENDING_ENTRY` watch order in trade store.
     - `Activate Trade ($XX.XX)`: Promotes immediately to `ACTIVE` position with pre-filled 1% sizing math, plays Web Audio ping, and navigates to Positions tab.

### 4.5 `VisualPriceLadder.tsx`
- **Purpose:** Minimalist visual price ladder rendering the 4 key execution levels with percentage distances, R-multiples, and share sizing breakdown.
- **Props Interface:**
  ```typescript
  export interface VisualPriceLadderProps {
    entryTrigger: number;
    stopLoss: number;
    target1: number;
    target2: number;
    positionShares: number;
    riskAmount: number;
    accountSize?: number;
    currentPrice?: number;
    compact?: boolean;
  }
  ```
- **Visual Design (Obsidian & Accent Tints):**
  - **Target 2 (Runner):** Purple tinted row (`+X.X%`, `+3.50R`, measured move).
  - **Target 1 (Scale 50%):** Emerald tinted row (`+X.X%`, `+2.00R`, scale 50% & B/E stop ratchet).
  - **Entry Trigger:** Sky-blue tinted row (execution pivot level).
  - **Hard Stop Loss:** Rose tinted row (`-X.X%`, `-1.00R`, strict invalidation level).
  - **Sizing Breakdown Bar:** Risk per share (`$X.XX/sh`), Shares count (`N shares`), Total Risk (`$150.00`, 1.0% of `$15,000`).

### 4.6 `ScreenerTab.tsx` / `index.ts`
- **Purpose:** Top-level container component for the Screener view, managing research fetching, modal open/close states, market quote subscription, search filtering, and trade promotion routing.
- **Props Interface:**
  ```typescript
  export interface ScreenerTabProps {
    accountSize: number;
    riskPerTrade: number;
    marketQuotes: Record<string, any>;
    onPromoteToTrade: (setup: MasterSetup | any, mode: "PENDING_ENTRY" | "ACTIVE") => void;
    onOpenAddTrade: () => void;
  }
  ```

---

## 5. Data Contracts & TypeScript Schemas

### 5.1 `src/lib/ai/types.ts`

```typescript
export type MarketRegimeType = "FAVORABLE" | "NEUTRAL" | "HOSTILE";

export interface AIFrontierModel {
  id: string;
  name: string;
  provider: "gemini" | "claude" | "openai";
  description: string;
  isLatest: boolean;
}

export interface ParsedCandidate {
  id?: string;
  ticker: string;
  companyName: string;
  setupType: string;
  entryTrigger: number;
  entryCondition: string;
  stopLoss: number;
  stopRationale: string;
  target1: number;
  target2: number;
  rrRatio: number;
  timeStopDays: number;
  positionShares: number;
  riskAmount: number;
  catalystDate: string;
  catalystSummary: string;
  bearCase: string;
  score: number;
  modelSource: string;
}

export interface ParsedReport {
  marketRegime: MarketRegimeType;
  regimeNotes: string;
  macroFlags: string;
  candidates: ParsedCandidate[];
  rawHtml?: string;
  rawText?: string;
  timestamp?: string;
}

export interface MasterSetup extends ParsedCandidate {
  consensusCount: number;
  modelsAgreed: string[];
  isConsensusPick: boolean;
  normalizedShares: number;
  normalizedRisk: number;
  allocatedCapital?: number;
  actualRiskPct?: number;
}

export interface MasterArbiterPlan {
  id?: string;
  marketRegime: MarketRegimeType;
  regimeNotes: string;
  macroFlags: string;
  consensusHighlight: string;
  masterSetups: MasterSetup[];
  allCandidates: ParsedCandidate[];
  modelBreakdowns: {
    gemini?: ParsedReport;
    claude?: ParsedReport;
    chatgpt?: ParsedReport;
  };
  generatedAt?: string;
}
```

### 5.2 API Routes Specification

1. **`POST /api/research/run`**:
   - Accepts `{ mode: "automated" | "manual", geminiModel?, claudeModel?, openaiModel?, manualText?, geminiText?, claudeText?, chatgptText? }`.
   - Calls `runModelResearch()` or parses manual texts via `parseReportContent()`.
   - Executes `synthesizeArbiterPlan(geminiParsed, claudeParsed, chatgptParsed, user.accountSize, user.riskPerTrade)`.
   - Persists `ResearchRun` and `CandidateSetup` records to Prisma SQLite / D1 database.
   - Returns `{ success: true, researchRunId, arbiterPlan }`.

2. **`GET /api/research/current`**:
   - Returns the latest active `ResearchRun` with its associated `CandidateSetup` entities and current user sizing preferences.

3. **`GET /api/research/sample`**:
   - Returns rich, calibrated sample research runs for Google Gemini 3.7 Flash, Claude Sonnet 5, and OpenAI 5.6 for instant offline demo and automated verification.

---

## 6. Implementation & Verification Roadmap for M4 Builder

| Phase | Component / Module | Tasks & Deliverables | Acceptance Criteria |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Types & Prompts (`src/lib/ai/*`) | Create `types.ts`, enhance `prompts.ts` with dynamic generator, update `arbiter.ts` and `parser.ts`. | 100% type coverage, all math formulas adhere to 1% risk rule. |
| **Phase 2** | UI Components (`src/components/screener/*`) | Build `PromptStation.tsx`, `MultiReportIngestionModal.tsx`, `ConsensusArbiterView.tsx`, `CandidateSetupCard.tsx`, `VisualPriceLadder.tsx`, `ScreenerTab.tsx`, `index.ts`. | Obsidian UI styling, responsive mobile bottom sheets, interactive pills. |
| **Phase 3** | App Integration (`src/app/page.tsx`) | Connect `ScreenerTab` into main 5-view navigation, wiring 1-click promotion handlers to trade store and Web Audio chimes. | Seamless 1-click candidate promotion to Active/Pending trades. |
| **Phase 4** | Automated Test Verification | Run test suite `npm test` verifying Tier 1 Screener AI tests (`t1_screener_ai.test.ts`), unit tests, and build check `npm run build`. | 529+ tests passing with 0 failures, zero build errors. |

---
*End of Design Report — Explorer 3 (Milestone 4)*
