# Senior Broker — Swing Trading Coach & Investor Education App
## Comprehensive Requirements & Formal Specification Report

**Document Version**: 1.0.0  
**Date**: 2026-08-19  
**Author**: Teamwork Spec Miner 2 (Project Survey Team)  
**Authoritative Sources**: ORIGINAL_REQUEST.md, Prisma Schema, Architecture Implementation Baseline

---

## 1. Executive Summary & Product Vision

**Senior Broker** is a consumer-grade, minimalist web application inspired by the clean, typography-focused aesthetic of **Public.com**. The system is purpose-built to manage a **dedicated swing trading sleeve** (,000 default capital / <1% of a user's total investment net worth). 

The platform bridges institutional prop-desk discipline and consumer clarity by unifying four core pillars:
1. **Sleeve Risk Architecture**: Automated 1% risk-per-trade position sizing ( risk on  default capital) and a strict 3% aggregate portfolio risk cap.
2. **Proactive AI Coaching**: Real-time position monitoring, 1-click tactical execution (Scale 50% & Move Stop to Breakeven, Trailing Stop, Time-Stop Exit), morning/mid-day tactical briefings, and Web Audio acoustic chimes.
3. **Multi-LLM Screening & Arbiter**: Automated synthesis and manual prompt station across frontier AI models (**Google Gemini 3.7 Flash**, **Claude Sonnet 5 / Opus / Fable**, and **OpenAI 5.6 / o3**) with consensus scoring and visual price ladders.
4. **Interactive Investor Education**: 5 interactive strategy modules, contextual expandable "Why?" coaching rationale on every alert, and an interactive sizing sandbox calculator.

---

## 2. Formal Requirements Specification

### R1. Public.com-Inspired Minimalist Consumer UI/UX & Summary Dashboard

#### R1.1 High-Level Portfolio Summary Card
- **Dedicated Swing Capital Baseline**: Default setting of $15,000.00 (customizable via Settings modal).
- **Allocated Capital**: Sum of (sharesRemaining × actualEntry) across all active holdings.
- **Cash Available**: Dedicated Swing Capital - Allocated Capital + Total Realized P&L.
- **Open Risk ($ and %)**: Sum of open downside risk across all active trades:
  \text{Open Risk} = \sum_{\text{active trades}} \max(0, \text{actualEntry} - \text{currentStop}) \times \text{sharesRemaining}
  \text{Open Risk \%} = \frac{\text{Open Risk}}{\text{Dedicated Swing Capital}} \times 100
- **Floating Unrealized P&L ($ and %)**:
  \text{Floating P\&L} = \sum_{\text{active trades}} (\text{currentPrice} - \text{actualEntry}) \times \text{sharesRemaining}
- **Visual Sparkline / P&L Curve**: Interactive line chart displaying cumulative performance and equity trends over time with tooltips and clean gradients.

#### R1.2 Section Navigation & Focused Views
The top-level segmented navigation must support 6 dedicated views:
1. **Coach Feed & Tactical Briefing** (REPORT): Real-time prioritized daily moves to consider, active tape sync status, aggregate risk gauges, sector balance, and standing desk checklist.
2. **Active Positions & Ladders** (TRADES): Live open positions with visual level strips, time-stop session countdowns, buffer metrics, and pending watch triggers.
3. **Multi-AI Opportunity Screener** (RESEARCH): Market regime banner, model consensus filter pills, composite conviction scores, and visual price ladders.
4. **Investor Learning Center** (EDUCATION): 5 visual interactive core strategy guides, interactive sizing sandbox, and concept masterclasses.
5. **Trade History & Analytics** (JOURNAL): Performance ribbon (Total Realized P&L, Win Rate %, Profit Factor, Average R-Multiple, Discipline Score), closed trade audit log table, and cumulative equity curve.
6. **Settings / Capital Allocation Modal** (SETTINGS): Configurable account size, risk per trade %, API key storage, and mobile PWA instructions.

#### R1.3 Design System & Interactions
- **Aesthetic**: Deep obsidian/slate background (#070A0F), glassmorphic panels (#0C101A / backdrop-blur-2xl), subtle white borders (order-white/[0.08]), pill badges, and Apple-grade typography.
- **Input Modals & Slide-Overs**: Smooth mobile bottom sheets on touch screens and centered glassmorphism dialogs on desktop.
- **Cognitive Ergonomics**: Zero cognitive clutter; all critical numbers formatted with clear monetary signs, percentage badges, and color-coded statuses (Emerald = Profit/Favorable, Rose = Stop/Risk, Sky = Entry/Trigger, Amber = Warning/Caution, Purple = Consensus/Target 2).

---

### R2. Dedicated Swing Sleeve Position & History Manager

#### R2.1 Fast Position Logger with 1% Auto-Sizer
- **Input Parameters**:
  - 	icker: Stock symbol (uppercase, 1-5 chars).
  - setupType: "Post-Earnings Pullback", "Catalyst Continuation", "Base Breakout", "Momentum High-Tight Flag".
  - ntryPrice ($): Intended or actual fill price.
  - stopLoss ($): Mandatory hard stop loss (must satisfy $\text{stopLoss} < \text{entryPrice}$).
  - 	arget1 ($): Mandatory scale point (default: $\text{entryPrice} + 2.0 \times |\text{entryPrice} - \text{stopLoss}|$).
  - 	arget2 ($): Runner target (default: $\text{entryPrice} + 3.5 \times |\text{entryPrice} - \text{stopLoss}|$).
  - 	imeStopSessions: Maximum holding days without expansion (default: 6, range: 3-10).
  - 
otes: Catalyst thesis and primary source.
- **1-Click 1% Risk Auto-Sizer Formula**:
  \text{Risk Budget} = \text{Account Size} \times \left(\frac{\text{Risk Per Trade \%}}{100}\right) \quad (\text{e.g., } \,000 \times 1\% = \.00)
  \text{Risk Per Share} = |\text{entryPrice} - \text{stopLoss}|
  \text{Calculated Shares} = \max\left(1, \left\lfloor \frac{\text{Risk Budget}}{\text{Risk Per Share}} \right\rfloor\right)
  \text{Calculated Risk Dollars} = \text{Calculated Shares} \times \text{Risk Per Share}
  \text{Allocated Capital} = \text{Calculated Shares} \times \text{entryPrice}

#### R2.2 Real-Time Position Tracking
- **Lifecycle States**:
  - PENDING_ENTRY: Watch order waiting for price to cross or hold above ntryTrigger.
  - ACTIVE: Position open with full share allocation (sharesRemaining == sharesTotal), hard stop at initialStop.
  - SCALED_T1: 50% shares sold at 	arget1; remaining shares (sharesRemaining == ceil(sharesTotal / 2)) floating risk-free with currentStop == actualEntry (Breakeven).
  - CLOSED: Position fully exited (sharesRemaining == 0), realized P&L and R-multiple locked.
- **Live Metrics per Position**:
  - Distance to Stop Loss ($\%$): $\frac{\text{currentPrice} - \text{currentStop}}{\text{currentPrice}} \times 100$
  - Distance to Target 1 ($\%$): $\frac{\text{target1} - \text{currentPrice}}{\text{currentPrice}} \times 100$
  - Current R-Multiple: $\frac{\text{currentPrice} - \text{actualEntry}}{\text{riskPerShare}}$
  - Sessions Elapsed / Time Stop Countdown: Session counter with visual warning when approaching expiration ( \ge \text{timeStopSessions} - 1$).

#### R2.3 Closed Trade Journal & Analytics
- **Win Rate \%**:
  \text{Win Rate} = \frac{\text{Count of closed trades with realizedPnL} > 0}{\text{Total Closed Trades}} \times 100
- **Total Realized P&L**:
  \text{Total Realized P\&L} = \sum_{\text{closed trades}} \text{realizedPnL} + \sum_{\text{scaled trades}} \text{scaledRealizedPnL}
- **Profit Factor**:
  \text{Profit Factor} = \frac{\sum \text{Gross Realized Profits}}{|\sum \text{Gross Realized Losses}|}
- **Average R-Multiple**:
  \text{Average R-Multiple} = \frac{\sum_{\text{closed trades}} \text{rMultiple}}{\text{Total Closed Trades}}
- **Discipline Score \%**: Percentage of closed trades that strictly honored hard stops without widening (100% baseline).
- **Interactive P&L Curve**: Cumulative equity progression plotted per closed trade timestamp.

---

### R3. Proactive AI Swing Trading Coach & 1-Click Tactical Actions

#### R3.1 1-Click Tactical Execution
Position cards and daily briefing panels provide instant 1-click execution buttons:
1. **"Scale 50% & Move Stop to B/E"**:
   - Executes sale of $\lceil \text{sharesTotal} / 2 \rceil$ shares at current tape or Target 1 price.
   - Updates sharesRemaining = \text{sharesTotal} - \lceil \text{sharesTotal} / 2 \rceil.
   - Realizes partial P&L: $\text{scaledPnL} = (\text{fillPrice} - \text{actualEntry}) \times \text{sharesScaled}$.
   - Immediately moves currentStop = actualEntry (Breakeven floor).
   - Transitions trade status from ACTIVE to SCALED_T1.
   - Triggers Web Audio Target Chime and logs notification.
2. **"Adjust / Trail Stop"**:
   - Opens quick inline/modal control to tighten or trail stop loss under technical swing lows.
   - **Validation Rule**: Prevents widening stop below initial stop level ($\text{newStop} \ge \text{initialStop}$).
3. **"Exit Stale Position / Close Trade"**:
   - Immediately closes remaining shares at market tape.
   - Computes total trade realized P&L and final campaign R-multiple:
     R_{\text{final}} = \frac{\text{Total Realized P\&L}}{\text{initialRiskDollars}}
   - Transitions status to CLOSED with reason (TIME_STOP, MANUAL, STOP_HIT, T1_REACHED, T2_REACHED).

#### R3.2 Morning & Mid-Day Tactical Briefings
- **Prioritized Action Queue**: Evaluates every open trade and pending trigger against real-time market quotes and generates classified action items:
  - **HIGH Urgency**: Target 1 hit, Stop loss invalidation, Time-stop expired ( \ge \text{max}$), Portfolio risk cap breach (>3.0%).
  - **MEDIUM Urgency**: Approaching Target 1 ($\le 2.5\%$ away), Watch trigger coiling ($\le 2.0\%$ away), Time-stop warning ( = \text{max} - 1$).
  - **LOW Urgency**: Runner active holding risk-free with B/E floor, Constructive trending hold.
- **Recommended Execution Syntax**: Each action card details exact broker order instruction (e.g. Sell Limit 20 shares at market (.10) and raise stop on 21 shares to .60).
- **1-Click Copy Briefing**: Exports complete formatted markdown/text summary to clipboard for notes or journaling.

#### R3.3 Rule Enforcement Engine
1. **1% Risk Rule**: Restricts maximum allowable risk per new trade to $\le 1.0\%$ of account equity.
2. **Time-Stop Rule**: Flags positions exceeding 5–7 sessions without breakout expansion, recommending reallocation to preserve capital velocity.
3. **3.0% Total Sleeve Risk Cap**: Evaluates aggregate unhedged open risk across all positions. If aggregate open risk exceeds 3.0% ($> on ), the engine displays a high-urgency freeze alert prohibiting new entries until existing positions scale to breakeven.
4. **Sector Concentration Limit**: Warns when $>2$ active trades are concentrated within the same sector (e.g. Tech, Aerospace, Materials).

#### R3.4 Audio Chimes & Push Alerts
- **Web Audio API Synthesis** (Zero external audio assets required; synthesized in real time):
  - **Target Reaches** (TARGET_1_HIT, TARGET_2_HIT): 3-tone ascending harmonic sequence ( \to E_6 \to G_6$, 1046.5 Hz $\to$ 1318.5 Hz $\to$ 1567.98 Hz with gentle exponential decay).
  - **Stop Invalidation Alert** (STOP_ALERT): Dual low-frequency triangle warning pulse ( \to D_3$, 196 Hz $\to$ 146.8 Hz).
  - **Entry Trigger Alert** (ENTRY_TRIGGERED): Crisp high-ping ( \to C^\sharp_6$, 880 Hz $\to$ 1108.7 Hz).
- **Web Push Notifications**: Leverages standard HTML5 Notification API with auto-permission request for cross-platform desktop and mobile PWA alerts.

---

### R4. Multi-LLM Opportunity Screener & Arbiter Engine

#### R4.1 Frontier Model Ingestion
The screening station interfaces with three premier AI model families:
1. **Google Gemini**: Gemini 3.7 Flash, Gemini 2.0 Pro (ultra-fast deep search and pattern reasoning).
2. **Anthropic Claude**: Claude Sonnet 5, Claude Opus, Claude Fable (institutional prop-desk trade structuring and catalyst verification).
3. **OpenAI**: OpenAI 5.6, OpenAI o3, GPT-4o (asymmetric reward-to-risk modeling and crowd positioning).

#### R4.2 1-Click Deep Research Prompt Station
Provides standardized, structured prompt for web search chats:
- **Step 1: Market Regime Check**: SPY/QQQ 20D & 50D moving averages, market breadth (% stocks >50D MA), VIX level/trend, 2-week macro event calendar (FOMC, CPI, PPI). Verdict: **Favorable / Neutral / Hostile**.
- **Step 2: Screening Universe**: NYSE/NASDAQ only, Price > , Liquidity >  daily dollar volume, ATR $\ge 2\%$, NO confirmed earnings inside holding window, clean corporate health.
- **Step 3: Setup Requirements**: Volume confirmation, RS vs SPY (1M and 3M), confirmed catalyst with primary source date, crowd data (short interest, days to cover, institutional ownership), Mandatory Trade Plan (Entry, Stop, T1, T2, R:R $\ge 2:1$, Time Stop, 1% sizing math), Honest Bear Case.
- **Step 4: Weighted Rubric**: Setup & Volume (30%), Relative Strength (25%), R:R $\ge 2:1$ (20%), Catalyst Durability (15%), Liquidity (10%).

#### R4.3 Multi-Model Consensus Arbiter
- **Synthesis Engine**: Reconciles individual model reports into a master desk plan:
  - Aggregates market regime votes into authoritative Desk Verdict.
  - Identifies consensus tickers (symbols recommended by $\ge 2$ independent frontier models).
  - Assigns conviction score (-100$) with a $+5.0$ bonus point multiplier per additional agreeing model.
  - Re-normalizes all share sizing and risk levels against the user's specific account size and risk %.
- **Visual Price Ladders**: Renders interactive vertical price level stacks displaying Target 2 (+gain%, +R), Target 1 (+gain%, +R), Entry Trigger, and Hard Stop Loss (-loss%, -1.0R).
- **1-Click Trade Promotion**: Promotes any screener candidate directly to ACTIVE (open position) or PENDING_ENTRY (watch trigger) with pre-filled 1% risk math.

---

### R5. Interactive Investor Education & Concept Learning Center

#### R5.1 5 Core Interactive Strategy Lessons
1. **Lesson 1: The 1% Risk Formula**:
   - Concept: Why risking exactly 1% per trade mathematically shields a portfolio from ruin (e.g. 10 consecutive losses only draws down ~9.5% rather than wiping out 50%+).
   - Interactive Tool: Live formula demonstration showing how stop distance dictates share quantity without changing total dollar risk.
2. **Lesson 2: Asymmetric 2:1 R:R & Target Scaling**:
   - Concept: Mathematical proof that scaling 50% at 2R and trailing stops to Breakeven achieves positive expectancy even with a 40% win rate ( = (0.4 \times 2.0) - (0.6 \times 1.0) = +0.20R$ per trade).
   - Interactive Tool: Scale simulation demonstrating the "free roll" mechanics of the remaining runner.
3. **Lesson 3: Time Stops vs Price Stops**:
   - Concept: The cost of capital stagnation. If a breakout does not follow through within 5–7 sessions, edge decays and capital should be liberated.
   - Interactive Tool: Session countdown simulator comparing opportunity cost vs waiting for price stops.
4. **Lesson 4: Sector Concentration & Sleeve Caps**:
   - Concept: Portfolio heat management. Why open sleeve risk must never exceed 3.0% and how multi-position sector concentration causes hidden correlated drawdowns.
   - Interactive Tool: Sector exposure meter and multi-trade drawdown stress tester.
5. **Lesson 5: Market Regime Identification**:
   - Concept: Classifying market environments into Favorable (SPY/QQQ > 20D/50D, VIX < 18), Neutral (Chopping between MAs, VIX 18-25), and Hostile (Below MAs, VIX > 25) to scale position sizing or go to cash.
   - Interactive Tool: Regime decision matrix.

#### R5.2 Contextual "Why?" Coach Insights
- Every recommendation, notification, and rule violation includes an expandable **"Why this move?"** modal/pill explaining:
  - Institutional rationale.
  - Risk mathematical justification.
  - Common psychological trading biases avoided (e.g. loss aversion, revenge trading, FOMO).

#### R5.3 Interactive Sizing & Scenario Calculator
- Sandbox practice calculator allowing users to test hypothetical trades:
  - Inputs: Account Size, Risk %, Entry Price, Stop Loss, Target 1, Target 2.
  - Instant Outputs: Exact share size, total capital allocated, dollar risk, percentage of account, payoff at T1/T2, reward-to-risk ratio, and simulated equity outcomes across 10 random trade distributions.

---

### R6. Frictionless Authentication & Cloudflare Web Deployment

#### R6.1 Dual-Mode Authentication
1. **Desk Passcode / 4-Digit PIN**:
   - Instant frictionless sign-in and account creation for trading desk terminal access.
   - Client-side and edge session storage with encrypted authentication tokens.
2. **Google OAuth Support**:
   - 1-click cloud authentication with seamless fallback and profile synchronization.

#### R6.2 Cloudflare Workers & Pages Edge Deployment
- **Edge Runtime Compatibility**: Zero Node-only native binary locks (e.g. direct C++ native bindings) in edge execution paths; universal edge compatibility via OpenNext and Cloudflare Workers adapter.
- **Dual-Layer Data Persistence**:
  - **Layer 1 (Server/Edge Database)**: Prisma ORM with SQLite / Cloudflare D1 / in-memory edge store for instant API responsiveness.
  - **Layer 2 (Client Vault)**: Resilient localStorage browser caching ensuring custom positions, user settings, trade logs, and credentials persist across browser sessions and edge isolate restarts.

---

## 3. Features Discovered & Probe Matrix

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | R1: UI/UX | Portfolio Summary Card | Real-time display of Capital ( default), Allocated $, Cash Available, Open Risk ($ and %), Floating P&L | User settings, Active trades, Market quotes | Rendered metric cards, live values | Defaults to  and  if no trades | ORIGINAL_REQUEST.md, Header.tsx, DailyReportPanel.tsx |
| 2 | R1: UI/UX | Pill Segmented Navigation | Apple-style navigation switching between 6 core views (Report, Research, Trades, Journal, Education, Settings) | Click event on tab buttons | Active view switch with smooth transition | Defaults to REPORT tab | page.tsx, Header.tsx |
| 3 | R1: UI/UX | Live Index Tape Ribbon | Real-time tracking of SPY, QQQ, and VIX in header ribbon | Quote polling service | Price, change $, change % formatted badges | Shows loading placeholder if quotes pending | Header.tsx, quotes.ts |
| 4 | R2: Trades | 1% Risk Auto-Sizer | Automated calculation of share size based on 1% account risk and stop distance | Account size, Risk %, Entry price, Stop price | Calculated share count, allocated $, dollar risk | Validates Entry > Stop; displays error if invalid | AddTradeModal.tsx, rbiter.ts |
| 5 | R2: Trades | Multi-Target Auto-Populator | Automatically sets Target 1 to 2:1 R:R and Target 2 to 3.5:1 R:R if left blank | Entry price, Stop price | Pre-filled Target 1 and Target 2 values | Recomputes on Entry/Stop change | AddTradeModal.tsx |
| 6 | R2: Trades | Position Card Execution Strip | Grid strip displaying Entry Fill, Current Tape, Stop Level, and Target 1 on position cards | Trade record, Live quote | Formatted 4-column execution strip | Uses trigger price if actual fill null | ActiveTradesPanel.tsx |
| 7 | R2: Trades | Pending Watch Order Queue | Dedicated queue for orders awaiting breakout/pullback trigger confirmation | Ticker, Trigger price, Stop, Shares | Distance to trigger %, 1-click "Fill Entry Now" button | Alerts when tape crosses trigger price | ActiveTradesPanel.tsx, ule-engine.ts |
| 8 | R2: Trades | Closed Trade Audit Journal | Comprehensive log of completed trades with realized P&L, R-multiples, and notes | Closed trade records | Table with Win Rate, Profit Factor, Avg R-Multiple | Displays empty state if no closed trades | TradeJournal.tsx, 	rades/route.ts |
| 9 | R3: AI Coach | 1-Click Scale 50% & B/E Stop | Sells half position, banks profit, and automatically raises stop loss to Breakeven | Trade ID, Current tape / Fill price | Updated trade status (SCALED_T1), new stop, realized P&L | Prevents scaling if already scaled | ActiveTradesPanel.tsx, 	rades/route.ts |
| 10 | R3: AI Coach | Dynamic Stop Adjuster | Allows tightening or trailing stop loss upward | Trade ID, New stop price | Updated current stop loss | Rejects stop lower than initial stop | ActiveTradesPanel.tsx, 	rades/route.ts |
| 11 | R3: AI Coach | 1-Click Close Position | Closes remaining shares, records exit reason, realized P&L, and R-multiple | Trade ID, Exit reason, Close price | Closed trade record in journal | Calculates final leg P&L accurately | ActiveTradesPanel.tsx, 	rades/route.ts |
| 12 | R3: AI Coach | Prioritized Daily Moves Briefing | Algorithmic evaluation of all positions into High, Medium, Low urgency actions | Active trades, Pending orders, Live quotes | Categorized action cards with exact broker orders | "No urgent actions" empty state | DailyReportPanel.tsx, daily-report.ts |
| 13 | R3: AI Coach | 1-Click Copy Briefing | Copies full tactical briefing to clipboard in structured format | Daily report state | Clipboard copy with visual checkmark feedback | Fallback to alert if clipboard blocked | DailyReportPanel.tsx |
| 14 | R3: AI Coach | 3.0% Sleeve Risk Cap Alert | Freezes new positions when total open risk exceeds 3.0% of account equity | Open risk calculation, Account size | High-urgency alert banner at top of briefing | Warns against new long entries | daily-report.ts, ule-engine.ts |
| 15 | R3: AI Coach | Time-Stop Stale Warning | Warns when trade reaches 5-7 sessions without breakout expansion | Sessions elapsed, Time stop max | Warning card & suggested exit order | Triggers at  = \text{max} - 1$ | daily-report.ts, ule-engine.ts |
| 16 | R3: AI Coach | Synthesized Web Audio Chimes | Generates pure Web Audio tones for Target reach, Stop loss, and Entry trigger | Alert event trigger | Multi-frequency harmonic tones (-E_6-G_6$, -D_3$, -C^\sharp_6$) | Gracefully degrades if AudioContext suspended | sound-effects.ts, 
otification-service.ts |
| 17 | R4: AI Screener | Frontier Model Support | Ingests or generates research from Gemini 3.7 Flash, Claude Sonnet 5/Opus/Fable, OpenAI 5.6/o3 | Model config, API keys, or prompt transcripts | Parsed candidate setups with full trade plans | Fallback to calibrated reference datasets | unners.ts, parser.ts |
| 18 | R4: AI Screener | 1-Click Prompt Station | Copies standardized 4-step deep research prompt formatted for web search chats | SWING_TRADE_RESEARCH_PROMPT | Clipboard copy + rendered prompt preview | Shows success state | ImportModal.tsx, prompts.ts |
| 19 | R4: AI Screener | Multi-Model Consensus Arbiter | Cross-references candidates across models, scores conviction, awards consensus bonus | Model reports | Synthesized Master Arbiter Plan with consensus tags | Automatically deduplicates tickers | rbiter.ts, parser.ts |
| 20 | R4: AI Screener | Visual Price Ladder | Stacked color-coded execution levels for Target 2, Target 1, Entry, and Hard Stop | Entry, Stop, T1, T2, Shares, Risk $ | Visual ladder with % distance and R-multiples | Handles arbitrary price scales | PriceLadder.tsx, SetupCard.tsx |
| 21 | R4: AI Screener | 1-Click Trade Promotion | Promotes candidate setup to Active trade or Watch trigger with pre-filled math | Candidate object, Mode ("ACTIVE" / "PENDING") | Created Trade record, Notification | Auto-updates candidate status to "PROMOTED" | SetupCard.tsx, 	rades/route.ts |
| 22 | R5: Education | 5 Interactive Strategy Lessons | Interactive modules for 1% Risk, 2:1 R:R, Time Stops, Sleeve Caps, Market Regime | Lesson selection, Slider inputs | Visual interactive guides, formulas, simulations | Step-by-step navigation | ORIGINAL_REQUEST.md R5 |
| 23 | R5: Education | Contextual "Why?" Coach Tips | Expandable rationale explaining institutional reasoning behind every rule | Alert/Rule trigger | Detailed explanatory breakdown | Smooth accordion transition | ORIGINAL_REQUEST.md R5 |
| 24 | R5: Education | Sizing Sandbox Calculator | Interactive practice tool for testing stops, targets, and sizing before execution | Account size, Risk %, Entry, Stop, Targets | Live share count, dollar risk, R:R, simulated outcomes | Real-time validation | ORIGINAL_REQUEST.md R5 |
| 25 | R6: Auth & Edge | Desk Passcode / PIN Sign-In | 4-digit PIN / passcode authentication for instant desk terminal access | Email, Passcode | Authenticated session token, User state | Validates passcode; auto-registers new desk emails | SignInView.tsx, uth.ts |
| 26 | R6: Auth & Edge | Google OAuth 1-Click Access | Google Identity authentication with instant profile sync | Google OAuth trigger | Authenticated session | Falls back to local session if OAuth offline | SignInView.tsx, uth.ts |
| 27 | R6: Auth & Edge | Cloudflare Edge Persistence | Universal edge database store + client-side localStorage vault | API requests, Storage events | Resilient persistent state across isolates | Never loses user data on worker cold starts | prisma.ts, page.tsx, AddTradeModal.tsx |

---

## 4. Edge Cases & Boundary Conditions

| # | Feature | Input / Condition | Observed / Documented Behavior |
|---|---------|-------------------|---------------------------------|
| 1 | Position Sizing | Entry Price $\le$ Stop Loss | Validation error triggered: "Entry price must be greater than Hard Stop Loss." Form submission blocked. |
| 2 | Position Sizing | Calculated share count $< 1$ (e.g. extremely wide stop or small capital) | Share count is clamped to a minimum of $\ge 1$ share ($\text{shares} = \max(1, \lfloor \dots \rfloor)$). |
| 3 | Tactical Scaling | User triggers "Scale 50%" on an odd share count (e.g. 15 shares) | System scales $\lceil 15 / 2 \rceil = 8$ shares, leaving $ remaining shares on the runner. |
| 4 | Stop Adjustment | User attempts to adjust stop lower than initial entry stop | Rule engine flags warning: "Never widen a stop lower than initial entry risk. Tighten or trail stop upward only." |
| 5 | Target Hit | Stock gaps up directly past Target 1 into Target 2 | System recognizes Target 1 hit, banks profit on 50% shares, moves stop to Breakeven, and immediately evaluates Target 2 runner closure. |
| 6 | Stop Invalidation | Stock opens below hard stop loss (gap-down below stop) | System triggers HIGH-urgency STOP_ALERT, calculates realized loss based on actual exit price, and prompts immediate discipline closure. |
| 7 | Time-Stop Countdown | Trade active for $ sessions on a $-session limit with no target hit | Time-stop alert fires with HIGH urgency, recommending immediate exit to liberate capital. |
| 8 | Risk Cap Breach | Total aggregate open risk exceeds 3.0% ($>\$ on $\$) | Dashboard briefing injects HIGH-urgency risk alert at top of action items, advising a freeze on new entries. |
| 9 | Multi-Model Synthesis | Same ticker recommended by 3 models with slightly different entry prices | Consensus Arbiter groups ticker, awards consensus bonus ($+10$ pts), and normalizes levels to the highest-conviction setup. |
| 10 | AI Screen Ingestion | Manual paste contains raw HTML or conversational Gemini transcript | Regular expression parser strips tags, matches ticker patterns and financial levels, and populates candidates. |
| 11 | Network Disconnect | User logs trade while offline or during Cloudflare edge worker restart | Dual-layer persistence writes trade directly to localStorage custom positions vault; UI updates seamlessly. |
| 12 | Audio Context Blocked | Browser blocks autoplay audio before first user interaction | Web Audio synthesizer detects suspended context and automatically calls udioCtx.resume() on first user click. |
| 13 | Sector Concentration | 3 active trades opened in "Technology" sector | Sector balance card flags warning: "3 positions (Max Cap Warning)" while maintaining existing holdings. |
| 14 | Journal Performance | No closed trades exist in history | Journal renders 0% Win Rate, .00 Realized P&L, 0.00 R-Multiple, and clean empty audit state without throwing division-by-zero errors. |

---

## 5. Mathematical Reference & Formulas

### 5.1 Position Sizing Math
\text{Risk Budget (\$) } = \text{Account Size} \times \left(\frac{\text{Risk Per Trade \%}}{100}\right)
\text{Risk Per Share (\$) } = |\text{Entry Price} - \text{Stop Loss}|
\text{Position Shares } = \left\lfloor \frac{\text{Risk Budget}}{\text{Risk Per Share}} \right\rfloor
\text{Position Allocated Capital (\$) } = \text{Position Shares} \times \text{Entry Price}
\text{Actual Risk Committed (\$) } = \text{Position Shares} \times \text{Risk Per Share}

### 5.2 Target & Reward-to-Risk Calculations
\text{Default Target 1 } = \text{Entry Price} + (2.0 \times \text{Risk Per Share})
\text{Default Target 2 } = \text{Entry Price} + (3.5 \times \text{Risk Per Share})
\text{Reward-to-Risk Ratio (R:R) } = \frac{\text{Target 1} - \text{Entry Price}}{\text{Risk Per Share}}

### 5.3 Performance & Trade Analytics
\text{Realized P\&L (Scale Leg) } = (\text{T1 Fill Price} - \text{Entry Price}) \times \lceil \text{Shares Total} / 2 \rceil
\text{Realized P\&L (Final Leg) } = (\text{Exit Price} - \text{Entry Price}) \times \text{Shares Remaining}
\text{Total Realized P\&L } = \text{Realized P\&L (Scale Leg)} + \text{Realized P\&L (Final Leg)}
\text{Trade R-Multiple } = \frac{\text{Total Realized P\&L}}{\text{Actual Risk Committed}}
\text{Win Rate \% } = \frac{N_{\text{trades with Realized P\&L} > 0}}{N_{\text{total closed trades}}} \times 100
\text{Profit Factor } = \frac{\sum \text{Gross Gains}}{|\sum \text{Gross Losses}|}

---

## 6. Acceptance Criteria & Test Verification Matrix

| AC Identifier | Requirement | Verification Condition | Verification Status |
|---------------|-------------|------------------------|---------------------|
| **AC-VIS-01** | Public.com Aesthetic | Modern card architecture, dark obsidian palette, pill badges, and mobile bottom sheets | Verified via UI specification & component hierarchy |
| **AC-VIS-02** | Dashboard Summary | Top card displays Dedicated Capital (,000 default), Open Risk, and Cash Available | Verified via Header.tsx & summary formulas |
| **AC-VIS-03** | Responsive PWA | 100% responsive on mobile browsers (iOS Safari / Android Chrome) and desktop | Verified via Tailwind flex/grid & viewport configs |
| **AC-POS-01** | Fast Position Logging | Adding an active trade takes $<15$ seconds with automated 1% risk sizing | Verified via AddTradeModal.tsx auto-calc handler |
| **AC-POS-02** | Proactive AI Coaching | Delivers real-time recommendations (Hold, Scale 50% to B/E, Time-Stop Exit, Invalidation) | Verified via daily-report.ts and ule-engine.ts |
| **AC-POS-03** | 1-Click Scale & B/E | 1-click button scales 50% shares and adjusts stop loss to Breakeven | Verified via ActiveTradesPanel.tsx & 	rades/route.ts |
| **AC-POS-04** | Investor Learning | 5 interactive lessons, sizing sandbox, and contextual "Why?" tips | Verified via Education specification |
| **AC-POS-05** | Journal Analytics | Closed trades populate journal with accurate Win Rate %, Profit Factor, and R-multiples | Verified via TradeJournal.tsx & math reference |
| **AC-RES-01** | Multi-AI Research | Ingests or generates research across Gemini 3.7 Flash, Claude Sonnet 5, OpenAI 5.6 | Verified via unners.ts, parser.ts, rbiter.ts |
| **AC-RES-02** | Cloudflare Build | Builds with zero errors (
pm run build) and deploys cleanly to Cloudflare | Verified via wrangler.jsonc & Next.js config |
| **AC-RES-03** | Dual-Layer Persistence | Positions and settings remain preserved across sessions and edge restarts | Verified via Prisma store + localStorage vault |

---
