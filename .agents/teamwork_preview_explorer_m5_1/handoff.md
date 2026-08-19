# Milestone 5 — Feature 27: Investor Learning Center & 5 Core Interactive Strategy Lessons
**Exploration, Mathematical Specification & Component Architecture Report**
**Author**: Explorer 1 (`teamwork_preview_explorer_m5_1`)
**Target Features**: Feature 27 (5 Interactive Strategy Lessons) & Investor Learning Center View

---

## 1. Observation

### 1.1 Existing Codebase Findings & Direct Citations

1. **Current `LearningCenter.tsx` (`src/components/dashboard/LearningCenter.tsx`)**:
   - Lines 52–131: Contains static text for only 4 basic lessons (1% Golden Risk Rule, 50% Scale, Time Stops vs Price Stops, Dedicated Swing Sleeve). It lacks the 5th core lesson (**Market Regime Identification**), lacks interactive formula builders, has no visual drawdown/expectancy charts, no stagnation timelines, no portfolio heat gauges, and no knowledge check quizzes.
   - Lines 33–51 & 228–317: Features a rudimentary 4-field calculator without scenario presets, price ladder visualization, or multi-target scaling projections.
   - Lines 20–28: Props interface is limited to `{ accountSize: number; riskPerTrade: number; }`.

2. **Main Application Routing & Navigation (`src/app/page.tsx`)**:
   - Lines 53, 509–570: Active tabs include `"COACH" | "POSITIONS" | "SCREENER" | "LEARNING" | "JOURNAL"`. Tab `"LEARNING"` renders `<LearningCenter accountSize={accountSize} riskPerTrade={riskPerTrade} />`.
   - Lines 18–31: All icons are imported from `lucide-react` (e.g. `GraduationCap`, `TrendingUp`, `ShieldCheck`, `Layers`, `Activity`, `Sparkles`, `Clock`).

3. **Core Sizing & Risk Mathematics (`src/lib/portfolio/sizing-calculator.ts`)**:
   - Lines 5–9: Default constants: `DEFAULT_ACCOUNT_SIZE = 15000.0`, `DEFAULT_RISK_PCT = 1.0`, `DEFAULT_ATR_MULTIPLIER = 2.0`, `DEFAULT_MAX_POSITION_PCT = 25.0`.
   - Lines 143–178: Sizing formula: `riskBudget = (accountSize * riskPct) / 100`, `riskPerShare = entry - stopLoss`, `shares = floor(riskBudget / riskPerShare)`.
   - Lines 216–228: Target 1 defaults to $2.0R$ ($entry + 2.0 \times riskPerShare$) and Target 2 defaults to $3.5R$ ($entry + 3.5 \times riskPerShare$).

4. **Rule Engine & Portfolio Sleeve Guardrails (`src/lib/market/rule-engine.ts`)**:
   - Lines 234–256: Recommends scaling 50% shares (`ceil(shares / 2)`) when price reaches Target 1 ($2.0R$) and ratcheting stop loss to Breakeven (`effectiveEntry`).
   - Lines 304–348: Evaluates 5–7 session time stop rules (`sessions >= 5` triggers `TIME_STOP_WARNING`, `sessions >= 6` triggers `TIME_STOP_EXPIRED`).
   - Lines 379–491: Validates portfolio sleeve caps: Maximum 3 active concurrent trades, maximum 3.0% aggregate sleeve open risk ($450 on $15,000 capital), and maximum 2 concurrent positions in the same sector.

5. **Visual Design & CSS Framework**:
   - `package.json` line 36, 44: Tailwind CSS v4 is used with PostCSS.
   - Styling pattern: Dark Obsidian palette (`#07090E`, `#0C101A`, `#0E121D`), semi-transparent borders `border-white/[0.08]`, `backdrop-blur-2xl`, monospace figures `font-mono text-white`, and pill badges (`px-3 py-1 rounded-full text-xs font-semibold`).

6. **Test Infrastructure (`src/tests/runner.ts`)**:
   - Execution command `npm test` runs 28 test suites with 529 assertions, currently passing with 100% success rate.

---

## 2. Logic Chain

### 2.1 Bridging Requirements to Concrete Design
To transform the static `LearningCenter.tsx` into a world-class, institutional-grade educational hub (Feature 27), the system requires:
1. **Full 5-Lesson Curriculum**:
   - Lesson 1: *The 1% Golden Risk Formula & Capital Preservation*
   - Lesson 2: *Asymmetric 2:1 R:R & Target Scaling (The Free-Roll Mechanism)*
   - Lesson 3: *Time Stops vs Price Stops (Opportunity Cost & Compounding Velocity)*
   - Lesson 4: *Sector Concentration & Portfolio Sleeve Caps*
   - Lesson 5: *Market Regime Identification (The Step 1 Market Gate)*
2. **Interactive Simulation Widgets**: Every lesson must embed a dedicated interactive widget that lets the user manipulate variables (e.g. entry/stop prices, win rates, session counts, sector allocations, MA/VIX indicators) and observe the resulting mathematical behavior in real time.
3. **Structured Data Model (`lesson-data.ts`)**: Decouples educational content, LaTeX/equations, key takeaways, deep-dive breakdowns, interactive widget configurations, and quiz checks from the React rendering layer.
4. **Public.com-Grade Component Hierarchy**:
   - `LearningCenterView.tsx`: Main view with hero progress summary, category filters, tab switcher, and lesson grid.
   - `StrategyLessonCard.tsx`: Compact cards displaying category tags, read times, completion status checkmarks, key formula previews, and "Open Lesson" triggers.
   - `LessonViewerModal.tsx`: Comprehensive modal presenting the full lesson breakdown, interactive simulator, institutional background, and interactive knowledge check quiz.

---

### 2.2 Detailed Mathematical Specifications for the 5 Lessons

#### Lesson 1: The 1% Golden Risk Formula & Capital Preservation
- **Core Formula**:
  $$\text{Risk Budget (\$)} = \text{Account Capital} \times \frac{\text{Risk \%}}{100}$$
  $$\text{Risk Per Share (\$)} = \lvert \text{Entry Price} - \text{Hard Stop Loss} \rvert$$
  $$\text{Position Shares} = \left\lfloor \frac{\text{Risk Budget}}{\text{Risk Per Share}} \right\rfloor$$
  $$\text{Total Capital Allocated (\$)} = \text{Shares} \times \text{Entry Price}$$
  $$\text{Sleeve Capital Allocation \%} = \frac{\text{Total Capital Allocated}}{\text{Account Capital}} \times 100$$
- **Capital Drawdown & Recovery Mathematics**:
  - Account capital remaining after $n$ consecutive losses with risk fraction $r = \text{Risk \%} / 100$:
    $$\text{Account Remaining \%} = (1 - r)^n \times 100$$
    $$\text{Drawdown \%} = 100 - \text{Account Remaining \%}$$
    $$\text{Required Gain to Recover \%} = \left(\frac{1}{1 - \text{Drawdown \%}/100} - 1\right) \times 100$$
  - **Mathematical Proof Table**:
    | Risk % per Trade | 5 Consecutive Losses (Drawdown) | Required Recovery Gain | 10 Consecutive Losses (Drawdown) | Required Recovery Gain |
    |:---:|:---:|:---:|:---:|:---:|
    | **1.0% (Senior Broker)** | **-4.90%** | **+5.15%** | **-9.56%** | **+10.57%** |
    | 2.0% | -9.61% | +10.63% | -18.29% | +22.39% |
    | 5.0% | -22.62% | +29.23% | -40.13% | +67.02% |
    | 10.0% | -40.95% | +69.35% | -65.13% | +186.79% |
    | 20.0% | -67.23% | +205.18% | -89.26% | +831.33% |
- **Interactive Simulator**:
  - Dynamic sliders for Account Size ($5k–$100k, default $15k), Risk % (0.5%–5%), Entry Price ($10–$500), Stop Loss ($5–$490).
  - Real-time output cards: Shares, Dollar Risk, Capital Allocated %, Max Drawdown vs Consecutive Losses comparison chart.
- **Quiz Check**:
  - Question: *"If your swing sleeve has $15,000 capital and you identify a breakout on NVDA at $120.00 with a hard stop loss at $114.00 ($6.00/share risk), how many shares should you buy under the 1% Golden Risk Rule?"*
  - Choices: `A) 100 shares`, `B) 25 shares`, `C) 50 shares`, `D) 12 shares`
  - Correct: `B) 25 shares` ($15,000 \times 1\% = \$150$ risk budget; $\$150 \div \$6.00 = 25$ shares).

---

#### Lesson 2: Asymmetric 2:1 R:R & Target Scaling (The "Free Roll" Engine)
- **Core Formula**:
  - **Expectancy Equation**:
    $$\text{Expectancy per Trade (R)} = (W \times \text{Avg Win R}) - ((1 - W) \times \text{Avg Loss R})$$
    where $W = \text{Win Rate \%} / 100$, $\text{Avg Loss R} = 1.0R$.
  - **The 50% Scale & Breakeven Floor Mechanics**:
    - Initial position $= N$ shares. Total initial risk $= 1.0R = \$150$.
    - When Price reaches Target 1 ($2.0R$ gain): Sell $0.5N$ shares $\rightarrow$ Bank $+1.0R$ guaranteed profit.
    - Stop on remaining $0.5N$ shares is adjusted upward to Entry Price ($0.0R$ downside risk).
    - **Scenario A (Runner stopped at Breakeven)**: Runner P&L $= \$0.00$. Net Campaign Return $= +1.0R$ ($+\$150$).
    - **Scenario B (Runner reaches Target 2 at 3.5R)**: Runner P&L $= 0.5 \times 3.5R = +1.75R$. Net Campaign Return $= +1.0R + 1.75R = +2.75R$ ($+\$412.50$).
    - **Scenario C (Pre-T1 Stop Loss Hit)**: Loss $= -1.0R$ ($-\$150$).
    - **Guaranteed Profit Floor**: Once T1 triggers, the minimum campaign outcome is $+1.0R$ banked with zero capital risk remaining!
- **Expectancy Comparison**:
  - At a 40% Win Rate with 2.75R average win and 1.0R loss:
    $$\text{Expectancy} = (0.40 \times 2.75R) - (0.60 \times 1.0R) = 1.10R - 0.60R = +0.50R \text{ per trade!}$$
  - Over 50 trades, a 40% win rate yields $+25.0R$ net profit ($+\$3,750$ on a $\$15,000$ sleeve).
- **Interactive Simulator**:
  - Sliders for Win Rate (20%–80%) and Average Target Multiplier (1.5R–5.0R).
  - Visual 3-Stage Step-Through (Entry $\rightarrow$ Target 1 Hit + Stop to B/E $\rightarrow$ Runner Exit).
  - Live 50-Trade Simulated PnL Equity Curve.
- **Quiz Check**:
  - Question: *"Why does the Senior Broker strategy strictly mandate selling 50% of your position at Target 1 (2.0R) and ratcheting the stop loss to Breakeven?"*
  - Choices: `A) It guarantees at least +1.0R profit while giving the remaining half a risk-free ride to Target 2`, `B) It minimizes broker commissions`, `C) It prevents the stock from being shorted`, `D) It reduces the account tax bracket`
  - Correct: `A`

---

#### Lesson 3: Time Stops vs Price Stops (Opportunity Cost & Compounding Velocity)
- **Core Formula**:
  - **Catalyst Momentum Decay & Stagnation**:
    - Institutional breakout momentum typically delivers directional follow-through within 3 to 5 trading sessions.
    - If a stock consolidates sideways without expansion after 5 sessions, the setup thesis has weakened.
  - **Capital Compounding Velocity**:
    $$\text{Annualized Capital Velocity} = \left(1 + \frac{\text{Avg Return per Campaign}}{\text{Avg Holding Period (Sessions)}}\right)^{\frac{252}{\text{Avg Holding Period}}} - 1$$
  - **Opportunity Cost of Dead Money**:
    - $\$5,000$ locked in a flat position for 15 sessions $= \$0$ return.
    - $\$5,000$ rotated into two 5-session winning breakouts ($+4.0\%$) $= \$5,000 \times 1.04 \times 1.04 = \$5,408$ ($+\$408$ gain).
- **Interactive Simulator**:
  - Interactive Session Counter (Days 1 to 10) with candle chart visualizer.
  - Compares the stagnant asset value vs rotation into fresh screener setups over time.
- **Quiz Check**:
  - Question: *"A stock you bought on a catalyst breakout has moved sideways for 7 consecutive sessions without hitting your stop loss or target. What is the institutional rationale for closing the trade?"*
  - Choices: `A) A 7-day hold triggers an automatic margin call`, `B) Institutional follow-through momentum has stalled; exiting frees capital from dead money to deploy into higher-velocity setups`, `C) Hard stop losses expire after 5 days`, `D) The company must report earnings next week`
  - Correct: `B`

---

#### Lesson 4: Sector Concentration & Portfolio Sleeve Caps
- **Core Formula**:
  - **Aggregate Sleeve Open Risk Formula**:
    $$\text{Aggregate Sleeve Open Risk (\$)} = \sum_{i=1}^{k} \text{Max}(0, (\text{Entry}_i - \text{Current Stop}_i) \times \text{Shares}_i)$$
    $$\text{Aggregate Sleeve Open Risk \%} = \frac{\text{Aggregate Sleeve Open Risk (\$) }}{\text{Account Capital}} \times 100 \le 3.0\%$$
    ($\$450.00$ maximum risk on a $\$15,000.00$ account).
  - **Sector Concentration Guardrail**:
    $$\text{Concurrent Positions in Same Sector} \le 2$$
    $$\text{Total Active Concurrent Trades} \le 3$$
  - **Systemic Correlation Risk**:
    - Holding 3 technology stocks with correlation $\rho \approx 0.85$ means a single macro tech shock (e.g. rate hike or export restrictions) stops out all 3 trades simultaneously, triggering an instant 3% sleeve drawdown.
- **Interactive Simulator**:
  - 3 Position Slot Builders (Ticker, Sector dropdown, Dollar Risk).
  - Dynamic Portfolio Heat Gauge (0.0% to 5.0% dial with Green/Amber/Red zones).
  - Instant warning pill alerts when Sector $>2$ or Total Risk $>3.0\%$.
- **Quiz Check**:
  - Question: *"You have 2 open swing positions in Semiconductor stocks (totaling 2.0% open risk). A 3rd high-conviction semiconductor breakout appears. What does the Senior Broker rule engine enforce?"*
  - Choices: `A) Rejects or warns against adding the 3rd semiconductor trade to prevent correlated sector risk, keeping max positions per sector at 2`, `B) Forces you to double your account size`, `C) Automatically converts the trades to short positions`, `D) Sells all existing positions at market`
  - Correct: `A`

---

#### Lesson 5: Market Regime Identification (The Step 1 Market Gate)
- **Core Formula**:
  - **Desk Regime Indicator Matrix**:
    | Desk Regime | S&P 500 (SPY) / Nasdaq (QQQ) Trend Alignment | CBOE VIX Level | Sizing Multiplier | Execution Rule |
    |:---:|:---:|:---:|:---:|:---:|
    | **FAVORABLE** | $\text{Price} > \text{SMA}_{20} > \text{SMA}_{50} > \text{SMA}_{200}$ | $\text{VIX} < 18.0$ | **1.0x (100% Risk)** | Standard 1.0% risk per trade ($150 on $15k), up to 3 positions. |
    | **NEUTRAL** | $\text{Price}$ between $\text{SMA}_{20}$ & $\text{SMA}_{50}$, or mixed MA slope | $18.0 \le \text{VIX} \le 25.0$ | **0.5x (50% Risk)** | Cut risk to 0.5% ($75 on $15k), tighten stops, selective high-conviction only. |
    | **HOSTILE** | $\text{Price} < \text{SMA}_{200}$ or downward death cross | $\text{VIX} > 25.0$ | **0.0x (100% Cash)** | Freeze new swing breakout buys; hold existing trades only if stop at Breakeven. |
  - **Dynamic Sizing Scale Equation**:
    $$\text{Adjusted Risk Budget (\$)} = (\text{Account Capital} \times 0.01) \times \text{Regime Multiplier}$$
    $$\text{Adjusted Position Shares} = \left\lfloor \frac{\text{Adjusted Risk Budget}}{\lvert \text{Entry} - \text{Stop} \rvert} \right\rfloor$$
- **Interactive Simulator**:
  - MA Alignment selector (Bullish Stacked, Choppy/Neutral, Bearish Below 200MA).
  - Interactive VIX Slider ($10$ to $50$).
  - Live Desk Regime Badge update (FAVORABLE, NEUTRAL, HOSTILE) and Position Sizing Multiplier display ($1.0\text{x} \rightarrow 0.5\text{x} \rightarrow 0.0\text{x}$).
- **Quiz Check**:
  - Question: *"During a market correction where SPY drops below its 200-day moving average and VIX rises to 29.5, what is the Senior Broker AI Coach's recommended sizing scale?"*
  - Choices: `A) 2.0x (Aggressively buy the dip)`, `B) 1.0x (Normal trade sizing)`, `C) 0.0x / Cash Defense (Freeze new swing buys; preserve capital)`, `D) 0.75x`
  - Correct: `C`

---

### 2.3 Component Architecture & TypeScript Data Models

```
src/
├── lib/
│   └── education/
│       └── lesson-data.ts        <-- Core data model, 5 lesson definitions, quizzes & formulas
└── components/
    └── education/
        ├── LearningCenterView.tsx   <-- Top-level tab view with progress bar, filter pills & lesson grid
        ├── StrategyLessonCard.tsx   <-- Individual Public.com lesson card with completion status & metrics
        └── LessonViewerModal.tsx    <-- Deep dive interactive modal with live widgets & quiz check
```

#### TypeScript Data Contract (`src/lib/education/lesson-data.ts`):
```typescript
export type LessonCategory = "RISK_MANAGEMENT" | "PROFIT_TAKING" | "CAPITAL_EFFICIENCY" | "PORTFOLIO_DEFENSE" | "MARKET_TIMING";
export type InteractiveWidgetType = "RISK_CALCULATOR" | "EXPECTANCY_SCALER" | "TIME_STOP_SIMULATOR" | "HEAT_GAUGE" | "REGIME_MATRIX";

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface DeepDiveSection {
  heading: string;
  paragraphs: string[];
  institutionalContext?: string;
  mathProofTable?: {
    headers: string[];
    rows: string[][];
  };
}

export interface StrategyLesson {
  id: string;
  order: number;
  title: string;
  shortTitle: string;
  subtitle: string;
  tag: string;
  category: LessonCategory;
  readTimeMinutes: number;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  iconName: string;
  accentColor: string; // e.g. emerald, sky, amber, purple, rose
  summary: string;
  keyTakeaways: string[];
  formula: {
    name: string;
    equation: string;
    variables: { symbol: string; meaning: string }[];
    explanation: string;
  };
  deepDive: DeepDiveSection[];
  widgetType: InteractiveWidgetType;
  quiz: QuizQuestion;
}
```

---

## 3. Caveats

1. **Client-Side Progress Storage**: Lesson completion tracking (quiz completions and read status) will be stored in `localStorage` under `"senior_broker_completed_lessons"` as a JSON string array of lesson IDs (`string[]`). This ensures persistence across page reloads without requiring extra database migrations.
2. **Scenario Sandbox Interoperability**: Feature 29 (`ScenarioCalculator.tsx`) is designed to sit alongside Feature 27 in `LearningCenterView.tsx` under a seamless 2-tab segmented control (`"Core Lessons"` vs `"Position Sizing Sandbox"`).
3. **OpenNext / Cloudflare Edge Compatibility**: All mathematical formulas and interactive widgets use pure JavaScript/TypeScript calculations without Node.js native bindings (like `fs` or `crypto`), ensuring 100% build compatibility with `@opennextjs/cloudflare`.

---

## 4. Conclusion

The specification for Feature 27 provides:
1. **Precise Mathematical Models**: All 5 core lessons have complete formal equations for position sizing, drawdown recovery, 2:1 R:R expectancy, time-stop compounding drag, portfolio heat caps, and market regime dynamic sizing.
2. **5 Interactive Learning Widgets**: Designed with sliders, real-time formula computation, and visual graphs for maximum student engagement.
3. **Robust Data Structure**: A strongly typed `lesson-data.ts` containing the complete institutional curriculum, formula proofs, and self-checking quizzes.
4. **Seamless UI Integration**: Clean modular components (`LearningCenterView.tsx`, `StrategyLessonCard.tsx`, `LessonViewerModal.tsx`) matching Public.com's dark obsidian aesthetic and integrating cleanly into `src/app/page.tsx`.

---

## 5. Verification Method

### 5.1 Independent Test Suite Verification
1. **Automated Unit Tests**: Create `src/tests/unit/education.test.ts` to verify:
   - All 5 lessons are defined with non-empty titles, summaries, key takeaways, formulas, deep-dive sections, and quizzes.
   - All quiz `correctIndex` values are within `[0, options.length - 1]`.
   - Math calculation functions (1% sizer, drawdown formula, expectancy equation, sleeve heat, and regime multipliers) produce mathematically exact results across boundary conditions.
2. **Execution Command**:
   ```pwsh
   npm test
   ```
   *Expected Result*: All tests pass with 0 errors.

3. **Build Integrity Check**:
   ```pwsh
   npm run build
   ```
   *Expected Result*: Clean Next.js static / edge bundle generation with exit code 0.
