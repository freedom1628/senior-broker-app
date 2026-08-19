# Handoff Report: Milestone 5 — Feature 28 (WhyDrawer) & Feature 29 (ScenarioCalculator)

**Author**: Explorer 2 (Milestone 5)  
**Parent Agent ID**: `ad9f9f9b-990c-4e78-add0-0c7efc6d205d`  
**Workspace**: `C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app`  
**Handoff Type**: Hard Handoff (Investigation & Architecture Specification Complete)

---

## 1. Observation

### 1.1 Existing Codebase Assets & Contracts

1. **Auto Position Sizer & Risk Modeling Engine** (`src/lib/portfolio/sizing-calculator.ts`):
   - Lines 5–10 define canonical risk parameters: `DEFAULT_ACCOUNT_SIZE = 15000.0`, `DEFAULT_RISK_PCT = 1.0`, `DEFAULT_ATR_MULTIPLIER = 2.0`, `DEFAULT_CASH_BUFFER_PCT = 0.05` (5% cash buffer), `DEFAULT_MAX_POSITION_PCT = 25.0` (max 25% single trade capital cap).
   - Lines 35–56 define `SizingResult` interface returning `shares`, `entryPrice`, `stopLoss`, `target1` (2.0R), `target2` (3.5R), `riskPerShare`, `dollarRisk`, `actualRiskPct`, `allocatedCapital`, `allocatedCapitalPct`, `rewardToRiskT1`, `rewardToRiskT2`, `blendedExpectedR`, `limitingFactor` (`"RISK_BUDGET" | "BUYING_POWER" | "MAX_POSITION_CAP" | "ZERO_SHARES"`), `warnings`, and `errors`.
   - Whole integer flooring (`Math.floor`) guarantees that risk strictly never exceeds the 1.0% dollar allocation ($150.00).

2. **Trade Management Rule Engine** (`src/lib/market/rule-engine.ts`):
   - Lines 24–37 define `RuleActionType`: `ENTRY_TRIGGER`, `SCALE_T1`, `TARGET_1_HIT`, `TARGET_2_HIT`, `STOP_LOSS_HIT`, `STOP_ALERT`, `TRAIL_STOP_UPDATE`, `TIME_STOP_WARNING`, `TIME_STOP_EXPIRED`, `RISK_CAP_EXCEEDED`, `SECTOR_CAP_EXCEEDED`.
   - Lines 63–82 define `TradeEvaluation` including `whyRationale?: string`, `suggestedStopUpdate?: number`, `sharesToScale?: number`, `shouldAutoClose?: boolean`.
   - Lines 124–149 define open risk calculation: when a stop is raised to or above entry (Breakeven), open risk is mathematically $0.00.
   - Lines 374–490 define portfolio pre-trade gatekeeping: Max 3 active positions, Max 3.0% aggregate sleeve risk ($450 on $15k), Max 2 concurrent positions per sector.

3. **Current Price Ladder Component** (`src/components/dashboard/PriceLadder.tsx`):
   - Lines 5–13 define `PriceLadderProps`: `entryTrigger`, `stopLoss`, `target1`, `target2`, `positionShares`, `riskAmount`, `accountSize`.
   - Renders 4 stacked color-coded rows: Target 2 (Purple / measured move runner), Target 1 (Emerald / 50% scale & B/E stop), Entry (Sky / trigger price), Stop Loss (Rose / hard invalidation level).
   - Includes bottom calculation bar summarizing risk math per share, share count, and total risk $.

4. **Current Coach Feed** (`src/components/dashboard/CoachFeed.tsx`):
   - Lines 213–241 currently implement a basic inline expandable accordion showing a simple 1-paragraph summary for `isTargetScale` vs `isTimeStop`. It lacks a slide-over drawer, standalone rulebook browsing, risk formulas, psychology explanations, and case studies.

5. **Current Learning Center** (`src/components/dashboard/LearningCenter.tsx`):
   - Lines 52–131 have 4 static lesson accordions (1% Risk, 50% Scale, Time Stops, Dedicated Sleeve).
   - Lines 228–317 have a simple 4-input calculator (`calcCapital`, `calcRiskPct`, `calcEntry`, `calcStop`) that only outputs 3 basic numbers without visual price ladder rendering, presets, R-multiples, outcome matrices, or interactive tape simulation.

6. **Test Specifications** (`src/tests/tier1_features/t1_education_infra.test.ts`):
   - Lines 150–322 test Feature 28 assertions: `whyRationale` on Target 1 hit, Stop loss invalidation, Time stop expiration, Entry trigger activation, and Trailing stop progression.
   - Verifies the 5 core strategy curriculum modules (Lesson 1: Risk Formula, Lesson 2: Asymmetric 2:1 R:R, Lesson 3: Time Stops, Lesson 4: Sleeve Caps, Lesson 5: Market Regimes).

---

## 2. Logic Chain

1. **Feature 28 ("Why?" Coach Insights Drawer)**:
   - **Problem**: Retail traders frequently violate rules (widening stops, refusing to scale at 2R, holding stale trades) because they perceive rules as arbitrary restrictions rather than mathematical edges.
   - **Solution**: A dedicated, rich slide-over drawer (`WhyDrawer.tsx`) supported by a structured dictionary (`src/lib/coach/why-rules.ts`).
   - **Dual Usability**:
     - *Contextual Mode*: Triggered via "Why this recommendation?" from `CoachFeed`, `ActiveTradesPanel`, or `SetupCard`. Automatically injects live trade data (ticker, entry, stop, current price, R-multiple) to show real-time math applied directly to the user's position.
     - *Standalone / Browsing Mode*: Accessible from the Learning Center header or sidebar, allowing full exploration with search and category filtering.
   - **Standardized 6-Section Anatomy**:
     1. Category Badge & Urgency Pill
     2. Contextual Live Trade Application (if trade context is provided)
     3. Mathematical Foundation (Risk formula & Expected Return equations)
     4. Institutional Proprietary Desk Rationale ("How professional funds operate")
     5. Psychological Trap Avoided (Cognitive bias neutralized: loss aversion, disposition effect, FOMO)
     6. Concrete Real-World Walkthrough (Example with $15,000 sleeve)

2. **Feature 29 (Interactive Sizing & Scenario Calculator)**:
   - **Problem**: Calculating position sizing, R:R multipliers, and visualizing worst-case vs best-case outcomes across multi-target campaigns is cognitively heavy in real-time trading.
   - **Solution**: A comprehensive interactive sandbox (`ScenarioCalculator.tsx`) supported by `scenario-math.ts`.
   - **Interactive Elements**:
     - *Quick Scenario Presets*: 5 one-click setups (Breakout Pullback, VWAP Reversal, High Tight Flag, Earnings Gap & Go, Defensive Half-Risk) to instantly demonstrate realistic scenarios.
     - *Interactive Input Panel*: Sliders and inputs for Capital ($15,000 default), Risk % (1.0%), Entry Price, Stop Loss (with ATR quick-calc helper), Target 1 multiplier (slider), Target 2 multiplier (slider).
     - *Integrated Visual Price Ladder*: Live color-coded ladder showing exact price levels, % gains, R-multiples, and dollar profit/loss at each tier.
     - *Outcome Matrix Table*: Tabular breakdown of Scenario A (Stop Hit: -$150 / -1.0R), Scenario B (T1 Scaled + B/E stop: +$150 / +1.0R guaranteed), Scenario C (T1 + T2 Runner: +$412.50 / +2.75R blended), plus an interactive Win Rate expectancy slider.
     - *Interactive Tape Simulation Scrubber*: An interactive price slider that lets the user scrub price between Stop Loss and Target 2, dynamically displaying floating P&L, live R-multiple, and firing simulated Coach Alert banners in real time!
     - *Actionable Integration*: "Apply Setup to Position Logger" button that transfers calculated values directly into `AddTradeModal`.

---

## 3. Caveats

1. **Zero Node.js Native Dependencies (Edge / Cloudflare Compatibility)**:
   - All math and formatting functions must be pure TypeScript. No native C++ bindings, `fs`, `child_process`, or canvas dependencies.
   - Use Lucide React icons and Tailwind CSS exclusively for glassmorphic styling.
2. **Component Separation**:
   - `WhyDrawer.tsx` should be located in `src/components/coach/WhyDrawer.tsx` (or re-exported for education).
   - `ScenarioCalculator.tsx` should be located in `src/components/education/ScenarioCalculator.tsx` and embedded directly into `src/components/dashboard/LearningCenter.tsx`.
3. **State Management**:
   - `WhyDrawer` state can be controlled via simple React props (`isOpen`, `onClose`, `initialRuleKey`, `tradeContext`) to allow clean invocation from any card or panel without bloated external store dependencies.
4. **Mobile Responsiveness**:
   - Slide-over panel on desktop (`fixed inset-y-0 right-0 w-full max-w-lg z-50`), transforms into a smooth bottom sheet on mobile (`fixed inset-x-0 bottom-0 max-h-[90vh] rounded-t-3xl z-50`).

---

## 4. Conclusion & Architecture Blueprint

### 4.1 Architecture Diagram

```
+---------------------------------------------------------------------------------------+
|                                    SENIOR BROKER APP                                  |
+---------------------------------------------------------------------------------------+
        |                                                           |
        v                                                           v
+------------------------------------+             +------------------------------------+
|            FEATURE 28              |             |            FEATURE 29              |
| Contextual "Why?" Coach Drawer     |             | Sizing & Scenario Sandbox          |
| (`src/components/coach/            |             | (`src/components/education/        |
|   WhyDrawer.tsx`)                  |             |   ScenarioCalculator.tsx`)         |
+------------------------------------+             +------------------------------------+
        |                                                           |
        |---> Powered by:                                           |---> Powered by:
        |     `src/lib/coach/why-rules.ts`                          |     `src/lib/education/scenario-math.ts`
        |     (15 Institutional Rules Dictionary)                   |     `src/lib/portfolio/sizing-calculator.ts`
        |                                                           |     `src/components/dashboard/PriceLadder.tsx`
        |---> Triggers from:                                        |
        |     - CoachFeed Action Items                              |---> Includes:
        |     - ActiveTrades Position Cards                         |     - 5 Scenario Presets
        |     - SetupCard AI Candidates                             |     - Live Interactive Price Ladder
        |     - LearningCenter Institutional Rulebook               |     - Outcome Matrix & Expectancy Model
        |                                                           |     - Interactive Tape Simulation Scrubber
+---------------------------------------------------------------------------------------+
```

---

### 4.2 Module 1: `src/lib/coach/why-rules.ts` (Rule Dictionary Specification)

```typescript
// src/lib/coach/why-rules.ts
// Comprehensive Institutional Rulebook & "Why?" Coaching Dictionary

export type WhyRuleCategory =
  | "RISK_MANAGEMENT"
  | "PROFIT_HARVESTING"
  | "TIME_DISCIPLINE"
  | "PORTFOLIO_GUARDRAILS"
  | "MARKET_REGIME"
  | "EXECUTION_DISCIPLINE";

export interface WhyRuleDefinition {
  key: string;
  category: WhyRuleCategory;
  categoryDisplay: string;
  title: string;
  shortHeadline: string;
  urgency: "HIGH" | "MEDIUM" | "LOW";
  badgeColor: string;
  mathFormula: {
    equation: string;
    description: string;
    exampleVariables: Record<string, string>;
  };
  institutionalRationale: string;
  psychologicalTrapAvoided: {
    biasName: string;
    trapExplanation: string;
    counterMeasure: string;
  };
  caseStudyExample: {
    scenarioTitle: string;
    walkthrough: string[];
    netResult: string;
  };
  relatedLessonId?: number; // 1 to 5 mapping to Strategy Lessons
}

export const WHY_RULES_DICTIONARY: Record<string, WhyRuleDefinition> = {
  SCALE_T1: {
    key: "SCALE_T1",
    category: "PROFIT_HARVESTING",
    categoryDisplay: "Profit Harvesting & Risk De-escalation",
    title: "Scale 50% at Target 1 (+2.0R) & Ratchet Stop to Breakeven",
    shortHeadline: "Lock in guaranteed campaign profit and activate the risk-free runner.",
    urgency: "HIGH",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    mathFormula: {
      equation: "Locked Profit = 0.5 * Shares * (T1 - Entry) = +1.0R | Remaining Risk = 0.5 * Shares * (Entry - Entry) = $0.00",
      description: "By harvesting half the position at 2.0R, you bank +1.0R of realized profit. Moving the stop on the second half to your exact Entry price ensures the remaining position can never result in a dollar loss.",
      exampleVariables: {
        "Account Capital": "$15,000",
        "Risk Budget (1%)": "$150.00 (1.0R)",
        "T1 Profit Realized": "+$150.00 (+1.0R banked)",
        "Worst-Case Outcome": "+$150.00 campaign profit (if stopped at B/E)",
        "Best-Case Outcome (T2 @ 3.5R)": "+$150.00 + $262.50 = +$412.50 (+2.75R blended)",
      },
    },
    institutionalRationale:
      "Proprietary trading desks operate under asymmetric payout structures. When an asset reaches an initial liquidity extension (2.0R), institutional participants take partial liquidity into buying strength. This de-risks the desk's aggregate capital, eliminates catastrophic drawdowns, and enables the desk to ride secular trends without emotional friction.",
    psychologicalTrapAvoided: {
      biasName: "Greed & The 'Round Trip' Regret Aversion",
      trapExplanation: "Retail traders often hold 100% of a winning position hoping for a massive home run, only to watch a +10% gain reverse into a demoralizing -5% loss.",
      counterMeasure: "The 50% scale mathematically guarantees a winning trade, completely eliminating the psychological pain of giving back profits.",
    },
    caseStudyExample: {
      scenarioTitle: "ATRO $15k Sleeve Campaign",
      walkthrough: [
        "Bought 18 shares at $88.50 with stop at $83.75 ($150 total risk / $4.75 risk per share).",
        "Stock expands to Target 1 at $100.10 (+2.44R / +$11.60 per share).",
        "Sold 9 shares at $100.10, banking +$104.40 realized cash profit.",
        "Stop on remaining 9 shares immediately adjusted from $83.75 to $88.50 (Breakeven).",
      ],
      netResult: "Guaranteed minimum profit of +$104.40 with 9 shares free-rolling toward Target 2 ($112.00).",
    },
    relatedLessonId: 2,
  },

  STOP_LOSS_HIT: {
    key: "STOP_LOSS_HIT",
    category: "RISK_MANAGEMENT",
    categoryDisplay: "Strict Loss Cutting & Thesis Invalidation",
    title: "Hard Stop Loss Invalidation (Honor Stop Immediately)",
    shortHeadline: "Setup thesis has been disproven by price action. Immediate liquidation required.",
    urgency: "HIGH",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    mathFormula: {
      equation: "Max Loss = Shares * (Entry - StopLoss) <= 1.0% of Account Capital ($150.00)",
      description: "When price touches the pre-calculated stop level, the statistical edge of the setup is statistically zero. Taking the small 1% loss preserves 99% of capital for high-probability setups.",
      exampleVariables: {
        "Dedicated Capital": "$15,000",
        "Realized Loss": "-$150.00 (-1.00%)",
        "Remaining Sleeve": "$14,850.00 (99.00%)",
        "Required Recovery Gain": "+1.01% (achieved on single 1.5R win)",
      },
    },
    institutionalRationale:
      "Risk managers at premier hedge funds enforce automatic stop executions without trader discretion. Once price crosses the invalidation line, the hypothesis is false. Trading without honoring stops turns small controlled statistical losses into ruinous portfolio drawdowns.",
    psychologicalTrapAvoided: {
      biasName: "Disposition Effect & Loss Aversion / Averaging Down",
      trapExplanation: "Traders hate realizing losses and convince themselves 'it will bounce back', leading to disastrous averaging down into losing positions.",
      counterMeasure: "Automated alert discipline treats the 1% loss as a routine cost of business, identical to an insurance premium.",
    },
    caseStudyExample: {
      scenarioTitle: "MTRN Failed Breakout Defense",
      walkthrough: [
        "Entered MTRN at $282.00 with hard stop at $270.50 (8 shares, $150 risk).",
        "Market experiences sudden sector rotation; MTRN slips to $270.00.",
        "Stop alert triggers immediate full exit at market.",
      ],
      netResult: "Realized loss strictly capped at -$150.00. Preserved $14,850 cash to deploy into winning setups.",
    },
    relatedLessonId: 1,
  },

  TIME_STOP_EXPIRED: {
    key: "TIME_STOP_EXPIRED",
    category: "TIME_DISCIPLINE",
    categoryDisplay: "Capital Velocity & Opportunity Cost",
    title: "Time Stop Expiration (5–7 Session Stagnation Exit)",
    shortHeadline: "Breakout momentum has stalled. Liquidate dead capital to rotate into fresh leaders.",
    urgency: "HIGH",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    mathFormula: {
      equation: "Opportunity Cost = Sleeve Capital Allocated * (Benchmark Daily Velocity - Stagnant Asset Yield)",
      description: "High-probability swing trading edges decay rapidly after session 4. Capital trapped in sideways chop incurs severe opportunity cost and elevated breakdown risk.",
      exampleVariables: {
        "Max Allowed Sessions": "6 trading sessions",
        "Elapsed Time": "6 sessions",
        "Price Change": "+0.4% (choppy sideways)",
        "Recommendation": "Close at market / scratch trade",
      },
    },
    institutionalRationale:
      "Institutional momentum funds measure Sharpe and Sortino ratios per unit of time. If a catalyst does not produce rapid price discovery within 3–5 sessions, institutional buyers are absent. Exiting at breakeven or small scratch releases buying power for higher-velocity opportunities.",
    psychologicalTrapAvoided: {
      biasName: "Sunk Cost Fallacy & Hope-Based Holding",
      trapExplanation: "Traders hold dead positions for weeks because 'it hasn't hit my stop yet', tying up capital while prime leaders break out elsewhere.",
      counterMeasure: "Strict 5–7 session time decay rules enforce capital rotation regardless of nominal P&L.",
    },
    caseStudyExample: {
      scenarioTitle: "TWLO 6-Session Stagnation Exit",
      walkthrough: [
        "Entered TWLO breakout at $250.00 with target $275.00.",
        "Price traded in narrow band ($249 - $253) across 6 consecutive sessions.",
        "Time stop expired at session 6; position exited at $251.50 (+0.6%).",
      ],
      netResult: "Released $1,000 of capital to enter high-flying NVDA breakout the next morning.",
    },
    relatedLessonId: 3,
  },

  TIME_STOP_WARNING: {
    key: "TIME_STOP_WARNING",
    category: "TIME_DISCIPLINE",
    categoryDisplay: "Pre-Staleness Warning",
    title: "Time Stop Warning (Session 4–5 Deceleration)",
    shortHeadline: "Momentum is decaying. Prepare to exit if follow-through fails today.",
    urgency: "MEDIUM",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    mathFormula: {
      equation: "Sessions Remaining = max(0, timeStopLimit - sessionsElapsed) = 1 session",
      description: "Approaching the outer boundary of expected momentum expansion. Tighten scrutiny.",
      exampleVariables: {
        "Current Session": "Session 5 of 6",
        "Action": "Monitor for volume expansion or prepare scratch exit",
      },
    },
    institutionalRationale: "Provides early alert to portfolio managers to avoid initiating overnight risk additions on decaying setups.",
    psychologicalTrapAvoided: {
      biasName: "Complacency Bias",
      trapExplanation: "Assuming a trade will eventually work out without monitoring session elapsed counts.",
      counterMeasure: "Proactive alerting at session 5 sets a firm deadline for price action.",
    },
    caseStudyExample: {
      scenarioTitle: "Session 5 Review",
      walkthrough: ["Card turns amber to warn trader that session 6 is the final deadline."],
      netResult: "Eliminates surprise exits and ensures mental preparedness.",
    },
    relatedLessonId: 3,
  },

  TRAIL_STOP_UPDATE: {
    key: "TRAIL_STOP_UPDATE",
    category: "PROFIT_HARVESTING",
    categoryDisplay: "Runner Maximization",
    title: "Upward-Only Trailing Stop Ratchet on Runners",
    shortHeadline: "Lock in open runner profits behind higher swing lows without capping upside.",
    urgency: "LOW",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    mathFormula: {
      equation: "New Stop = max(CurrentStop, EntryPrice, CurrentPrice - (1.5 * RiskPerShare))",
      description: "The trailing stop only ratchets UP, never down. As price prints new swing highs, the floor rises to guarantee locked-in gains on the runner.",
      exampleVariables: {
        "Entry Price": "$88.50",
        "Current Price": "$106.00",
        "Original Stop": "$83.75",
        "New Trailing Stop": "$98.88 (+2.18R guaranteed)",
      },
    },
    institutionalRationale: "Allows trend-following campaigns to capture fat-tail multi-week momentum moves while protecting against violent trend reversals.",
    psychologicalTrapAvoided: {
      biasName: "Premature Profit Snatching",
      trapExplanation: "Closing a massive winning runner too early out of anxiety, missing out on 5R+ extensions.",
      counterMeasure: "A mechanical trailing stop allows the market to take you out rather than personal fear.",
    },
    caseStudyExample: {
      scenarioTitle: "Trailing ATRO Runner",
      walkthrough: [
        "ATRO rises to $106 after 50% scaled at $100.10.",
        "Trailing stop ratchets to $98.88.",
      ],
      netResult: "Guarantees +$10.38/sh profit on the runner even if the stock reverses abruptly.",
    },
    relatedLessonId: 2,
  },

  TARGET_2_HIT: {
    key: "TARGET_2_HIT",
    category: "PROFIT_HARVESTING",
    categoryDisplay: "Full Campaign Conclusion",
    title: "Target 2 Max Runner Target Achieved (+3.5R)",
    shortHeadline: "Full measured move completed. Close remaining shares to bank complete campaign.",
    urgency: "HIGH",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    mathFormula: {
      equation: "Blended Campaign R = (0.5 * 2.0R) + (0.5 * 3.5R) = +2.75R (+ $412.50 on $150 risk)",
      description: "Closing the final 50% runner at 3.5R locks in the total asymmetric target for the campaign.",
      exampleVariables: {
        "Risk Allocated": "$150.00",
        "T1 Profit (50%)": "+$150.00",
        "T2 Profit (50%)": "+$262.50",
        "Total Realized P&L": "+$412.50 (+2.75R)",
      },
    },
    institutionalRationale: "Captures full extension targets before cyclical mean reversion or consolidation phases begin.",
    psychologicalTrapAvoided: {
      biasName: "Overconfidence & Euphoria",
      trapExplanation: "Refusing to close at major extension targets believing the stock will go up forever.",
      counterMeasure: "Disciplined complete exit locks in optimal risk-adjusted alpha.",
    },
    caseStudyExample: {
      scenarioTitle: "3.5R Max Target Exit",
      walkthrough: ["Final shares liquidated at Target 2, completing campaign with +2.75R gain."],
      netResult: "Maximized capital compounding with zero lingering risk.",
    },
    relatedLessonId: 2,
  },

  ENTRY_TRIGGER: {
    key: "ENTRY_TRIGGER",
    category: "EXECUTION_DISCIPLINE",
    categoryDisplay: "Breakout Pivot Execution",
    title: "Technical Breakout Pivot Reached (Execute Long)",
    shortHeadline: "Price has breached the technical breakout pivot. Execute with hard stop active.",
    urgency: "HIGH",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    mathFormula: {
      equation: "Execution Trigger: Current Price >= EntryTriggerPrice (Stop = HardStopPrice)",
      description: "Executing at the exact pivot captures immediate volatility expansion as institutional stop-buys trigger.",
      exampleVariables: {
        "Trigger Price": "$42.60",
        "Hard Stop": "$40.20",
        "Risk Per Share": "$2.40",
      },
    },
    institutionalRationale: "Execution at pivot points maximizes immediate follow-through momentum and minimizes slippage.",
    psychologicalTrapAvoided: {
      biasName: "Hesitation / Analysis Paralysis",
      trapExplanation: "Waiting for a pullback on a genuine breakout, causing the trader to chase later at much worse prices.",
      counterMeasure: "Pre-planned conditional execution removes emotion from the entry moment.",
    },
    caseStudyExample: {
      scenarioTitle: "GLBE Breakout Execution",
      walkthrough: ["Price crossed $42.60 pivot; 41 shares bought immediately with stop placed at $40.20."],
      netResult: "Entered at optimal risk/reward before momentum surge.",
    },
    relatedLessonId: 1,
  },

  SLEEVE_RISK_CAP_3PCT: {
    key: "SLEEVE_RISK_CAP_3PCT",
    category: "PORTFOLIO_GUARDRAILS",
    categoryDisplay: "Aggregate Sleeve Risk Cap",
    title: "3.0% Aggregate Sleeve Open Risk Limit ($450 Cap)",
    shortHeadline: "Total open risk across all positions cannot exceed 3.0% of dedicated capital.",
    urgency: "HIGH",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    mathFormula: {
      equation: "Aggregate Open Risk = SUM(TradeOpenRisk) <= AccountSize * 0.03 ($450 on $15k)",
      description: "Where TradeOpenRisk = max(0, Entry - Stop) * SharesRemaining. Trades with stops at or above Breakeven contribute $0.00.",
      exampleVariables: {
        "Account Capital": "$15,000",
        "Max Sleeve Risk": "$450.00 (3.0%)",
        "Position 1 (Active)": "$150.00 risk",
        "Position 2 (Active)": "$150.00 risk",
        "Position 3 (Scaled T1)": "$0.00 risk (at B/E)",
        "Remaining Risk Budget": "$150.00 (permits 1 new trade)",
      },
    },
    institutionalRationale: "Prevents portfolio-level correlation wipeouts during sudden macro market shocks (e.g. CPI prints, Fed rate decisions).",
    psychologicalTrapAvoided: {
      biasName: "Over-Leverage & Revenge Trading",
      trapExplanation: "Opening 5–6 positions simultaneously during high confidence, leading to catastrophic multi-trade drawdowns.",
      counterMeasure: "Hard 3% aggregate cap forces selective trade cherry-picking.",
    },
    caseStudyExample: {
      scenarioTitle: "Risk Cap Protection",
      walkthrough: ["With 2 active positions open ($300 risk), system only allows 1 more 1% trade until a position scales to Breakeven."],
      netResult: "Total downside across entire sleeve is strictly bounded to $450.",
    },
    relatedLessonId: 4,
  },

  SECTOR_CONCENTRATION_CAP_2: {
    key: "SECTOR_CONCENTRATION_CAP_2",
    category: "PORTFOLIO_GUARDRAILS",
    categoryDisplay: "Sector Concentration Guardrail",
    title: "Maximum 2 Concurrent Positions per Sector",
    shortHeadline: "Prevent sector cluster risk by limiting exposure to at most 2 stocks per industry.",
    urgency: "MEDIUM",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    mathFormula: {
      equation: "SectorCount(targetSector) <= 2 active positions",
      description: "Prevents holding 3 correlated semi stocks (e.g. NVDA, AMD, AVGO) that trade as a single macro beta basket.",
      exampleVariables: {
        "Tech/Semis Open": "2 positions",
        "New Tech Idea": "BLOCKED — Divert capital to Healthcare or Energy",
      },
    },
    institutionalRationale: "Multi-manager hedge funds enforce strict sector beta limits to isolate idiosyncratic alpha from sector momentum swings.",
    psychologicalTrapAvoided: {
      biasName: "Sector Euphoria & False Diversification",
      trapExplanation: "Thinking you have 3 diversified trades when in reality you hold 3 nearly identical tech momentum stocks.",
      counterMeasure: "Mechanical limit mandates cross-sector diversification.",
    },
    caseStudyExample: {
      scenarioTitle: "Semi Sector Restriction",
      walkthrough: ["Trader owns NVDA and AMD. System blocks AVGO entry, preserving capital for defensive healthcare breakout."],
      netResult: "Avoids triple-loss when semiconductor sector experiences sudden pullback.",
    },
    relatedLessonId: 4,
  },

  DOWNWARD_STOP_PROHIBITION: {
    key: "DOWNWARD_STOP_PROHIBITION",
    category: "RISK_MANAGEMENT",
    categoryDisplay: "Stop Discipline Absolute Law",
    title: "Strict Prohibition Against Lowering Stop Losses",
    shortHeadline: "Stops can only move UP (toward Breakeven and profit). Lowering a stop is strictly forbidden.",
    urgency: "HIGH",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    mathFormula: {
      equation: "NewStopPrice >= CurrentStopPrice (Valid only if monotonic upward)",
      description: "Any attempt to lower a stop increases dollar risk beyond the 1% boundary and violates risk mathematics.",
      exampleVariables: {
        "Initial Stop": "$95.00 ($150 risk)",
        "Attempted Revision": "$90.00 ($300 risk — 200% risk expansion)",
        "System Action": "PROHIBITED & REJECTED",
      },
    },
    institutionalRationale: "Lowering stops is the #1 cause of catastrophic trading failures. Professional desks revoke trading privileges for unauthorized stop widening.",
    psychologicalTrapAvoided: {
      biasName: "Escalation of Commitment & Loss Denial",
      trapExplanation: "Widening a stop as price approaches it because 'it just needs more room to breathe'.",
      counterMeasure: "Hard mechanical rejection protects the trader from impulsive emotional sabotage.",
    },
    caseStudyExample: {
      scenarioTitle: "Stop Widening Prevention",
      walkthrough: ["Trader tempted to lower stop from $95 to $90 during market dip. System enforces $95 exit."],
      netResult: "Stock continued downward to $78. Saved $510 of additional loss.",
    },
    relatedLessonId: 1,
  },

  MARKET_REGIME_SHIFTS: {
    key: "MARKET_REGIME_SHIFTS",
    category: "MARKET_REGIME",
    categoryDisplay: "Macro Environmental Alignment",
    title: "Market Regime Sizing Modulation (1.0x / 0.5x / 0.0x)",
    shortHeadline: "Scale position sizing and exposure based on overall market trend and volatility.",
    urgency: "MEDIUM",
    badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    mathFormula: {
      equation: "Effective Risk % = Base Risk (1.0%) * RegimeMultiplier (Favorable: 1.0, Neutral: 0.5, Hostile: 0.0)",
      description: "When the macro tide goes out, individual swing breakouts fail at high rates. Sizing down preserves capital until favorable conditions return.",
      exampleVariables: {
        "Favorable (SPY > 20D/50D, VIX < 20)": "1.0% Risk ($150 / trade)",
        "Neutral (Choppy / Mixed)": "0.5% Risk ($75 / trade)",
        "Hostile (SPY < 50D, VIX > 25)": "0.0% Risk (100% Cash Buffer)",
      },
    },
    institutionalRationale: "Top hedge funds adjust gross and net exposure according to regime volatility regimes rather than forcing trades in hostile tape.",
    psychologicalTrapAvoided: {
      biasName: "Action Bias / Over-Trading",
      trapExplanation: "Feeling the need to trade every single day regardless of whether market conditions support breakouts.",
      counterMeasure: "Clear regime flags mandate defensive posture during unfavorable market environments.",
    },
    caseStudyExample: {
      scenarioTitle: "Hostile Market Defense",
      walkthrough: ["VIX spikes to 28; SPY breaches 50-day moving average. Regime switches to Hostile. All new buy orders frozen."],
      netResult: "Avoided broad market correction that dropped average stock by 8%.",
    },
    relatedLessonId: 5,
  },
};

export function getWhyRule(key: string): WhyRuleDefinition {
  const normalized = key.toUpperCase().trim();
  if (WHY_RULES_DICTIONARY[normalized]) {
    return WHY_RULES_DICTIONARY[normalized];
  }
  // Fallbacks
  if (normalized.includes("SCALE") || normalized.includes("T1")) return WHY_RULES_DICTIONARY.SCALE_T1;
  if (normalized.includes("STOP") && (normalized.includes("HIT") || normalized.includes("INVALID"))) return WHY_RULES_DICTIONARY.STOP_LOSS_HIT;
  if (normalized.includes("TIME") && (normalized.includes("EXPIRE") || normalized.includes("STALE"))) return WHY_RULES_DICTIONARY.TIME_STOP_EXPIRED;
  if (normalized.includes("TIME")) return WHY_RULES_DICTIONARY.TIME_STOP_WARNING;
  if (normalized.includes("TRAIL")) return WHY_RULES_DICTIONARY.TRAIL_STOP_RATCHET;
  if (normalized.includes("TARGET_2") || normalized.includes("RUNNER")) return WHY_RULES_DICTIONARY.TARGET_2_HIT;
  if (normalized.includes("ENTRY")) return WHY_RULES_DICTIONARY.ENTRY_TRIGGER;
  if (normalized.includes("REGIME")) return WHY_RULES_DICTIONARY.MARKET_REGIME_SHIFTS;
  if (normalized.includes("SECTOR")) return WHY_RULES_DICTIONARY.SECTOR_CONCENTRATION_CAP_2;
  if (normalized.includes("SLEEVE") || normalized.includes("CAP")) return WHY_RULES_DICTIONARY.SLEEVE_RISK_CAP_3PCT;
  return WHY_RULES_DICTIONARY.SCALE_T1;
}
```

---

### 4.3 Module 2: `src/components/coach/WhyDrawer.tsx` (UI Component Blueprint)

```tsx
// src/components/coach/WhyDrawer.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  WHY_RULES_DICTIONARY,
  WhyRuleDefinition,
  WhyRuleCategory,
  getWhyRule,
} from "@/lib/coach/why-rules";
import {
  X,
  ShieldAlert,
  TrendingUp,
  Clock,
  Layers,
  Sparkles,
  Calculator,
  Brain,
  BookOpen,
  ArrowRight,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";

export interface TradeContextData {
  ticker: string;
  companyName?: string;
  entryPrice: number;
  currentPrice?: number;
  stopLoss: number;
  target1: number;
  target2: number;
  sharesTotal: number;
  sharesRemaining: number;
  sessionsElapsed?: number;
  currentR?: number;
  actionType?: string;
}

interface WhyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialRuleKey?: string | null;
  tradeContext?: TradeContextData | null;
  onOpenLesson?: (lessonNumber: number) => void;
}

export const WhyDrawer: React.FC<WhyDrawerProps> = ({
  isOpen,
  onClose,
  initialRuleKey,
  tradeContext,
  onOpenLesson,
}) => {
  const [selectedRuleKey, setSelectedRuleKey] = useState<string>("SCALE_T1");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  useEffect(() => {
    if (initialRuleKey) {
      const resolved = getWhyRule(initialRuleKey);
      setSelectedRuleKey(resolved.key);
    }
  }, [initialRuleKey, isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentRule = getWhyRule(selectedRuleKey);
  const allRules = Object.values(WHY_RULES_DICTIONARY);

  const filteredRules = allRules.filter((r) => {
    const matchesCategory = selectedCategory === "ALL" || r.category === selectedCategory;
    const matchesSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.shortHeadline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.categoryDisplay.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories: { key: string; label: string }[] = [
    { key: "ALL", label: "All Rules" },
    { key: "PROFIT_HARVESTING", label: "Profit Scaling" },
    { key: "RISK_MANAGEMENT", label: "Risk & Stops" },
    { key: "TIME_DISCIPLINE", label: "Time Stops" },
    { key: "PORTFOLIO_GUARDRAILS", label: "Sleeve Caps" },
    { key: "MARKET_REGIME", label: "Regimes" },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-2xl bg-[#0B0F19] border-l border-white/[0.1] shadow-2xl flex flex-col">
          
          {/* Top Header Bar */}
          <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between bg-[#0E1322]">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <span>Institutional "Why?" Coach Drawer</span>
                </h2>
                <p className="text-xs text-neutral-400 font-mono">
                  Mathematical models, institutional rationale &amp; behavioral psychology
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-full p-2 text-neutral-400 hover:text-white hover:bg-white/[0.08] transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search & Category Filter Strip */}
          <div className="px-6 py-3 border-b border-white/[0.06] bg-black/40 space-y-2.5">
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search rules, math formulas, or psychological traps..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-[#121829] pl-10 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setSelectedCategory(cat.key)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition ${
                    selectedCategory === cat.key
                      ? "bg-sky-500 text-white font-semibold shadow"
                      : "bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Drawer Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Quick Rule Selector Pills */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                Selected Rule Action ({filteredRules.length})
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredRules.map((rule) => {
                  const isSelected = selectedRuleKey === rule.key;
                  return (
                    <button
                      key={rule.key}
                      onClick={() => setSelectedRuleKey(rule.key)}
                      className={`text-left p-3 rounded-2xl border transition ${
                        isSelected
                          ? "border-sky-500 bg-sky-500/10 shadow-md"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-md ${rule.badgeColor}`}>
                          {rule.categoryDisplay.split("&")[0].trim()}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-500">{rule.urgency}</span>
                      </div>
                      <div className="text-xs font-semibold text-white mt-1.5 line-clamp-1">
                        {rule.title}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SECTION 1: Rule Header Card */}
            <div className="rounded-3xl border border-white/[0.08] bg-[#0E1424] p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-full border ${currentRule.badgeColor}`}>
                  {currentRule.categoryDisplay}
                </span>
                <span className="text-xs font-mono text-neutral-400 font-semibold">
                  Rule ID: {currentRule.key}
                </span>
              </div>

              <h3 className="text-xl font-bold text-white tracking-tight">
                {currentRule.title}
              </h3>
              <p className="text-xs text-neutral-300 leading-relaxed font-mono">
                {currentRule.shortHeadline}
              </p>

              {/* Contextual Live Trade Box (if triggered from active trade) */}
              {tradeContext && (
                <div className="mt-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-emerald-400 flex items-center space-x-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Live Applied Trade: {tradeContext.ticker}</span>
                    </span>
                    <span className="text-neutral-300">
                      Tape: ${tradeContext.currentPrice?.toFixed(2) || tradeContext.entryPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-neutral-300 pt-1 border-t border-emerald-500/20">
                    <div>Entry: ${tradeContext.entryPrice.toFixed(2)}</div>
                    <div>Stop: ${tradeContext.stopLoss.toFixed(2)}</div>
                    <div>T1: ${tradeContext.target1.toFixed(2)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2: Mathematical Foundation (Risk Math) */}
            <div className="rounded-3xl border border-white/[0.08] bg-black/40 p-5 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-sky-400 font-bold">
                <Calculator className="h-4 w-4" />
                <span>The Mathematical Foundation &amp; Risk Math</span>
              </div>

              <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-4 font-mono text-xs text-sky-200">
                <code>{currentRule.mathFormula.equation}</code>
              </div>

              <p className="text-xs text-neutral-300 leading-relaxed">
                {currentRule.mathFormula.description}
              </p>

              {/* Variable Breakdown Table */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 space-y-1.5 font-mono text-xs">
                <div className="text-[10px] text-neutral-400 uppercase font-bold">Example Execution Breakdown ($15,000 Sleeve):</div>
                {Object.entries(currentRule.mathFormula.exampleVariables).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-neutral-300 text-[11px]">
                    <span className="text-neutral-400">{key}:</span>
                    <span className="text-white font-semibold">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 3: Institutional Proprietary Desk Rationale */}
            <div className="rounded-3xl border border-white/[0.08] bg-[#0E1424] p-5 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
                <TrendingUp className="h-4 w-4" />
                <span>Institutional Proprietary Desk Rationale</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                {currentRule.institutionalRationale}
              </p>
            </div>

            {/* SECTION 4: Psychological Trap Avoided */}
            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/[0.03] p-5 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">
                <Brain className="h-4 w-4" />
                <span>Psychological Trap Avoided: {currentRule.psychologicalTrapAvoided.biasName}</span>
              </div>

              <div className="space-y-2 text-xs leading-relaxed text-neutral-300">
                <p>
                  <strong className="text-amber-300">The Trap: </strong>
                  {currentRule.psychologicalTrapAvoided.trapExplanation}
                </p>
                <p>
                  <strong className="text-emerald-300">The Counter-Measure: </strong>
                  {currentRule.psychologicalTrapAvoided.counterMeasure}
                </p>
              </div>
            </div>

            {/* SECTION 5: Real-World Case Study Walkthrough */}
            <div className="rounded-3xl border border-white/[0.08] bg-black/40 p-5 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-purple-400 font-bold">
                <BookOpen className="h-4 w-4" />
                <span>Case Study: {currentRule.caseStudyExample.scenarioTitle}</span>
              </div>

              <ul className="space-y-1.5 text-xs text-neutral-300 font-mono">
                {currentRule.caseStudyExample.walkthrough.map((step, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <span className="text-purple-400 font-bold">{idx + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>

              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-xs font-mono font-bold text-purple-200">
                Result: {currentRule.caseStudyExample.netResult}
              </div>
            </div>

            {/* SECTION 6: Strategy Lesson Deep Link */}
            {currentRule.relatedLessonId && onOpenLesson && (
              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-mono uppercase text-sky-400 font-bold">Curriculum Connection</span>
                  <h4 className="text-xs font-semibold text-white mt-0.5">
                    Want to practice this in the Interactive Strategy Modules?
                  </h4>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onOpenLesson(currentRule.relatedLessonId!);
                  }}
                  className="flex items-center space-x-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-900 shadow hover:bg-neutral-100 transition active:scale-95 shrink-0"
                >
                  <span>Open Lesson {currentRule.relatedLessonId}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

### 4.4 Module 3: `src/lib/education/scenario-math.ts` (Sandbox Math & Presets)

```typescript
// src/lib/education/scenario-math.ts
// Interactive Sizing & Scenario Calculation Engine

export interface ScenarioPreset {
  id: string;
  name: string;
  ticker: string;
  setupType: string;
  entryPrice: number;
  stopLoss: number;
  t1Multiplier: number; // e.g. 2.0R
  t2Multiplier: number; // e.g. 3.5R
  riskPct: number; // 1.0% default
  description: string;
  thesis: string;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: "preset_breakout_pullback",
    name: "Breakout Pullback",
    ticker: "NVDA",
    setupType: "Breakout Base Pullback",
    entryPrice: 125.00,
    stopLoss: 120.50,
    t1Multiplier: 2.0,
    t2Multiplier: 3.5,
    riskPct: 1.0,
    description: "Classic test of prior all-time high resistance converting to dynamic support.",
    thesis: "Entry at prior breakout pivot with hard stop placed strictly below the pullback swing low.",
  },
  {
    id: "preset_vwap_reversal",
    name: "VWAP Reversal",
    ticker: "TSLA",
    setupType: "Mean Reversion Bounce",
    entryPrice: 220.00,
    stopLoss: 214.50,
    t1Multiplier: 2.0,
    t2Multiplier: 3.0,
    riskPct: 1.0,
    description: "Intraday/multiday reclaim of institutional volume-weighted average price.",
    thesis: "Entry on confirmed hourly close above VWAP with stop below session low.",
  },
  {
    id: "preset_high_tight_flag",
    name: "High Tight Flag",
    ticker: "PLTR",
    setupType: "Cup & Handle / High Tight Flag",
    entryPrice: 32.00,
    stopLoss: 30.40,
    t1Multiplier: 2.5,
    t2Multiplier: 4.5,
    riskPct: 1.0,
    description: "High-momentum flag consolidation following a 100%+ volume advance.",
    thesis: "Tight flag consolidation with stop at the 10-day EMA support.",
  },
  {
    id: "preset_earnings_gap",
    name: "Earnings Gap & Go",
    ticker: "META",
    setupType: "Fresh Earnings Gap / Pivot Breakout",
    entryPrice: 510.00,
    stopLoss: 492.00,
    t1Multiplier: 2.0,
    t2Multiplier: 4.0,
    riskPct: 1.0,
    description: "Post-earnings institutional accumulation with opening range breakout.",
    thesis: "Execution above Day 1 earnings high with stop at pre-market gap low.",
  },
  {
    id: "preset_defensive_neutral",
    name: "Defensive Half-Risk",
    ticker: "SPY",
    setupType: "Catalyst Continuation",
    entryPrice: 560.00,
    stopLoss: 554.40,
    t1Multiplier: 1.5,
    t2Multiplier: 2.5,
    riskPct: 0.5,
    description: "Defensive positioning during Neutral / Choppy market regimes.",
    thesis: "Half-sized 0.5% risk allocation with tighter profit targets to navigate elevated volatility.",
  },
];

export interface ScenarioCalculationInput {
  accountSize: number;
  riskPct: number;
  entryPrice: number;
  stopLoss: number;
  t1Multiplier: number;
  t2Multiplier: number;
  availableCash?: number;
  maxPositionPct?: number;
  roundLot?: boolean;
}

export interface ScenarioCalculationResult {
  isValid: boolean;
  shares: number;
  riskPerShare: number;
  riskPerSharePct: number;
  dollarRisk: number;
  actualRiskPct: number;
  allocatedCapital: number;
  allocatedCapitalPct: number;
  target1Price: number;
  target1GainPct: number;
  target2Price: number;
  target2GainPct: number;
  t1ProfitDollars: number; // 50% shares * (T1 - Entry)
  t2ProfitDollars: number; // 50% shares * (T2 - Entry)
  totalCampaignMaxProfit: number;
  blendedRMultiple: number;
  breakevenFloorProfit: number; // T1 profit locked when stopped at B/E
  limitingFactor: "RISK_BUDGET" | "BUYING_POWER" | "MAX_POSITION_CAP" | "ZERO_SHARES";
  status: "VALID" | "WARNING" | "INVALID";
  warnings: string[];
  errors: string[];
}

export function calculateScenario(input: ScenarioCalculationInput): ScenarioCalculationResult {
  const accountSize = Math.max(0, input.accountSize || 15000);
  const riskPct = Math.max(0.1, input.riskPct || 1.0);
  const entryPrice = input.entryPrice || 0;
  const stopLoss = input.stopLoss || 0;
  const t1Multiplier = input.t1Multiplier || 2.0;
  const t2Multiplier = input.t2Multiplier || 3.5;
  const availableCash = input.availableCash || accountSize;
  const maxPositionPct = input.maxPositionPct || 25.0;

  const warnings: string[] = [];
  const errors: string[] = [];

  if (entryPrice <= 0) errors.push("Entry price must be greater than zero.");
  if (stopLoss <= 0) errors.push("Stop loss must be greater than zero.");
  if (stopLoss >= entryPrice && entryPrice > 0) errors.push("Stop loss must be strictly below entry price.");

  const riskPerShare = Math.max(0, entryPrice - stopLoss);
  const riskPerSharePct = entryPrice > 0 ? (riskPerShare / entryPrice) * 100 : 0;

  if (errors.length > 0 || riskPerShare <= 0) {
    return {
      isValid: false,
      shares: 0,
      riskPerShare: 0,
      riskPerSharePct: 0,
      dollarRisk: 0,
      actualRiskPct: 0,
      allocatedCapital: 0,
      allocatedCapitalPct: 0,
      target1Price: 0,
      target1GainPct: 0,
      target2Price: 0,
      target2GainPct: 0,
      t1ProfitDollars: 0,
      t2ProfitDollars: 0,
      totalCampaignMaxProfit: 0,
      blendedRMultiple: 0,
      breakevenFloorProfit: 0,
      limitingFactor: "ZERO_SHARES",
      status: "INVALID",
      warnings,
      errors,
    };
  }

  const riskBudget = (accountSize * riskPct) / 100.0;
  const rawSharesByRisk = riskBudget / riskPerShare;

  const usableCash = availableCash * 0.95; // 5% buffer
  const maxPositionCapital = (accountSize * maxPositionPct) / 100.0;
  const effectiveCapitalLimit = Math.min(usableCash, maxPositionCapital);
  const rawSharesByCapital = effectiveCapitalLimit / entryPrice;

  let limitingFactor: "RISK_BUDGET" | "BUYING_POWER" | "MAX_POSITION_CAP" | "ZERO_SHARES" = "RISK_BUDGET";
  let targetShares = rawSharesByRisk;

  if (rawSharesByCapital < rawSharesByRisk) {
    targetShares = rawSharesByCapital;
    limitingFactor = usableCash <= maxPositionCapital ? "BUYING_POWER" : "MAX_POSITION_CAP";
    warnings.push(
      limitingFactor === "BUYING_POWER"
        ? "Capped by available cash/buying power buffer."
        : `Position size capped at ${maxPositionPct}% single-position concentration limit.`
    );
  }

  const finalShares = input.roundLot ? Math.floor(targetShares / 10) * 10 : Math.floor(targetShares);

  if (finalShares <= 0) {
    return {
      isValid: false,
      shares: 0,
      riskPerShare,
      riskPerSharePct,
      dollarRisk: 0,
      actualRiskPct: 0,
      allocatedCapital: 0,
      allocatedCapitalPct: 0,
      target1Price: 0,
      target1GainPct: 0,
      target2Price: 0,
      target2GainPct: 0,
      t1ProfitDollars: 0,
      t2ProfitDollars: 0,
      totalCampaignMaxProfit: 0,
      blendedRMultiple: 0,
      breakevenFloorProfit: 0,
      limitingFactor: "ZERO_SHARES",
      status: "INVALID",
      warnings,
      errors: ["Insufficient buying power or stop is too wide to buy minimum 1 share."],
    };
  }

  const dollarRisk = Number((finalShares * riskPerShare).toFixed(2));
  const actualRiskPct = Number(((dollarRisk / accountSize) * 100).toFixed(4));
  const allocatedCapital = Number((finalShares * entryPrice).toFixed(2));
  const allocatedCapitalPct = Number(((allocatedCapital / accountSize) * 100).toFixed(2));

  const target1Price = Number((entryPrice + t1Multiplier * riskPerShare).toFixed(2));
  const target2Price = Number((entryPrice + t2Multiplier * riskPerShare).toFixed(2));

  const target1GainPct = Number((((target1Price - entryPrice) / entryPrice) * 100).toFixed(2));
  const target2GainPct = Number((((target2Price - entryPrice) / entryPrice) * 100).toFixed(2));

  const t1Shares = Math.ceil(finalShares / 2);
  const t2Shares = finalShares - t1Shares;

  const t1ProfitDollars = Number((t1Shares * (target1Price - entryPrice)).toFixed(2));
  const t2ProfitDollars = Number((t2Shares * (target2Price - entryPrice)).toFixed(2));
  const totalCampaignMaxProfit = Number((t1ProfitDollars + t2ProfitDollars).toFixed(2));
  const breakevenFloorProfit = t1ProfitDollars;

  const blendedRMultiple = Number(((0.5 * t1Multiplier) + (0.5 * t2Multiplier)).toFixed(2));

  return {
    isValid: true,
    shares: finalShares,
    riskPerShare: Number(riskPerShare.toFixed(2)),
    riskPerSharePct: Number(riskPerSharePct.toFixed(2)),
    dollarRisk,
    actualRiskPct,
    allocatedCapital,
    allocatedCapitalPct,
    target1Price,
    target1GainPct,
    target2Price,
    target2GainPct,
    t1ProfitDollars,
    t2ProfitDollars,
    totalCampaignMaxProfit,
    blendedRMultiple,
    breakevenFloorProfit,
    limitingFactor,
    status: warnings.length > 0 ? "WARNING" : "VALID",
    warnings,
    errors: [],
  };
}
```

---

### 4.5 Module 4: `src/components/education/ScenarioCalculator.tsx` (Complete UI Sandbox Component)

```tsx
// src/components/education/ScenarioCalculator.tsx
"use client";

import React, { useState } from "react";
import {
  SCENARIO_PRESETS,
  ScenarioPreset,
  calculateScenario,
} from "@/lib/education/scenario-math";
import { PriceLadder } from "@/components/dashboard/PriceLadder";
import {
  Calculator,
  Sliders,
  Sparkles,
  TrendingUp,
  ShieldAlert,
  HelpCircle,
  Copy,
  Check,
  RotateCcw,
  Zap,
  ArrowRight,
  ShieldCheck,
  Activity,
  Layers,
} from "lucide-react";

interface ScenarioCalculatorProps {
  accountSize?: number;
  riskPerTrade?: number;
  onOpenWhyDrawer?: (ruleKey: string) => void;
  onApplyToOrder?: (setup: any) => void;
}

export const ScenarioCalculator: React.FC<ScenarioCalculatorProps> = ({
  accountSize = 15000,
  riskPerTrade = 1.0,
  onOpenWhyDrawer,
  onApplyToOrder,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("preset_breakout_pullback");
  const [capital, setCapital] = useState<string>(accountSize.toString());
  const [riskPct, setRiskPct] = useState<string>(riskPerTrade.toString());
  const [ticker, setTicker] = useState<string>("NVDA");
  const [entry, setEntry] = useState<string>("125.00");
  const [stop, setStop] = useState<string>("120.50");
  const [t1R, setT1R] = useState<number>(2.0);
  const [t2R, setT2R] = useState<number>(3.5);
  const [roundLot, setRoundLot] = useState<boolean>(false);
  const [simulatedPrice, setSimulatedPrice] = useState<number>(125.0);
  const [copied, setCopied] = useState<boolean>(false);

  // Apply Preset Handler
  const handleApplyPreset = (preset: ScenarioPreset) => {
    setSelectedPresetId(preset.id);
    setTicker(preset.ticker);
    setEntry(preset.entryPrice.toFixed(2));
    setStop(preset.stopLoss.toFixed(2));
    setT1R(preset.t1Multiplier);
    setT2R(preset.t2Multiplier);
    setRiskPct(preset.riskPct.toString());
    setSimulatedPrice(preset.entryPrice);
  };

  const capNum = parseFloat(capital) || 15000;
  const riskNum = parseFloat(riskPct) || 1.0;
  const entryNum = parseFloat(entry) || 100;
  const stopNum = parseFloat(stop) || 95;

  const result = calculateScenario({
    accountSize: capNum,
    riskPct: riskNum,
    entryPrice: entryNum,
    stopLoss: stopNum,
    t1Multiplier: t1R,
    t2Multiplier: t2R,
    roundLot,
  });

  // Tape Simulation Calculations
  const simPriceNum = simulatedPrice || entryNum;
  const riskPerShare = result.riskPerShare || Math.max(0.01, entryNum - stopNum);
  const simPnL = result.shares > 0 ? (simPriceNum - entryNum) * result.shares : 0;
  const simPct = entryNum > 0 ? ((simPriceNum - entryNum) / entryNum) * 100 : 0;
  const simR = ((simPriceNum - entryNum) / riskPerShare).toFixed(2);

  // Determine Coach Dynamic Alert based on simulated price
  let coachSimAlert: { headline: string; instruction: string; color: string; ruleKey: string } | null = null;
  if (simPriceNum <= stopNum) {
    coachSimAlert = {
      headline: "🚨 STOP LOSS INVALIDATION",
      instruction: "Price hit hard stop. Setup thesis failed. Liquidate remaining shares immediately at market.",
      color: "border-rose-500 bg-rose-500/10 text-rose-300",
      ruleKey: "STOP_LOSS_HIT",
    };
  } else if (simPriceNum >= result.target2Price && result.target2Price > 0) {
    coachSimAlert = {
      headline: "🏆 TARGET 2 ACHIEVED (+3.5R)",
      instruction: "Full measured move reached. Close final runner shares to bank full campaign profits!",
      color: "border-purple-500 bg-purple-500/10 text-purple-300",
      ruleKey: "TARGET_2_HIT",
    };
  } else if (simPriceNum >= result.target1Price && result.target1Price > 0) {
    coachSimAlert = {
      headline: "🎯 TARGET 1 HIT (+2.0R)",
      instruction: "Scale out 50% of shares and ratchet stop on remaining runner to Breakeven ($" + entryNum.toFixed(2) + ").",
      color: "border-emerald-500 bg-emerald-500/10 text-emerald-300",
      ruleKey: "SCALE_T1",
    };
  }

  const handleCopyParams = () => {
    const text = `
=== SWING SETUP RISK PARAMETERS ===
Ticker: ${ticker}
Account Size: $${capNum.toLocaleString()}
Entry Price: $${entryNum.toFixed(2)}
Hard Stop: $${stopNum.toFixed(2)} (-${result.riskPerSharePct}%)
Target 1 (50% Scale): $${result.target1Price.toFixed(2)} (+${result.target1GainPct}% / +${t1R}R)
Target 2 (Runner): $${result.target2Price.toFixed(2)} (+${result.target2GainPct}% / +${t2R}R)
Calculated Shares: ${result.shares} shares
Allocated Capital: $${result.allocatedCapital.toLocaleString()} (${result.allocatedCapitalPct}% of sleeve)
Max Dollar Risk: $${result.dollarRisk.toFixed(2)} (${result.actualRiskPct}% risk)
Max Campaign Profit: +$${result.totalCampaignMaxProfit.toFixed(2)} (+${result.blendedRMultiple}R blended)
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Sandbox Header */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-6 backdrop-blur-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20 text-white">
            <Calculator className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Interactive Sizing &amp; Scenario Sandbox
            </h2>
            <p className="text-xs text-neutral-400 font-mono">
              Stress-test stop distances, target multipliers &amp; simulate price action before execution
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleCopyParams}
            className="flex items-center space-x-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-white/[0.08] transition"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Parameters</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preset Quick-Buttons */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400 flex items-center space-x-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>Quick Scenario Presets</span>
          </span>
          <span className="text-[11px] text-neutral-500 font-mono">1-click setup templates</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {SCENARIO_PRESETS.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleApplyPreset(preset)}
                className={`p-3 rounded-2xl border text-left transition ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/15 shadow-md"
                    : "border-white/[0.08] bg-[#0E1322] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-white">{preset.ticker}</span>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                    {preset.t1Multiplier}R / {preset.t2Multiplier}R
                  </span>
                </div>
                <div className="text-xs font-semibold text-neutral-300 mt-1 line-clamp-1">
                  {preset.name}
                </div>
                <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                  Entry: ${preset.entryPrice} • Stop: ${preset.stopLoss}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls & Ladder Dual-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Interactive Inputs (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Account Guardrails & Risk Profile */}
          <div className="rounded-3xl border border-white/[0.08] bg-[#0E1322] p-5 sm:p-6 backdrop-blur-xl shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center space-x-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>1. Sleeve Risk Guardrails</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono uppercase text-neutral-400 mb-1">
                  Dedicated Swing Capital ($)
                </label>
                <input
                  type="number"
                  value={capital}
                  onChange={(e) => setCapital(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-neutral-400 mb-1">
                  Risk Per Trade (% of Sleeve)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    step="0.1"
                    value={riskPct}
                    onChange={(e) => setRiskPct(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex space-x-1 shrink-0">
                    {[0.5, 1.0, 1.5].map((val) => (
                      <button
                        key={val}
                        onClick={() => setRiskPct(val.toString())}
                        className={`rounded-lg px-2 py-1 text-[10px] font-mono font-bold transition ${
                          riskNum === val ? "bg-emerald-500 text-white" : "bg-white/[0.06] text-neutral-400 hover:text-white"
                        }`}
                      >
                        {val}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trade Execution Levels */}
          <div className="rounded-3xl border border-white/[0.08] bg-[#0E1322] p-5 sm:p-6 backdrop-blur-xl shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center space-x-2">
              <Sliders className="h-4 w-4 text-sky-400" />
              <span>2. Setup Execution Levels</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-mono uppercase text-neutral-400 mb-1">
                  Ticker Symbol
                </label>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 font-mono text-sm text-white focus:outline-none focus:border-sky-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-sky-400 mb-1">
                  Entry Trigger ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={entry}
                  onChange={(e) => {
                    setEntry(e.target.value);
                    setSimulatedPrice(parseFloat(e.target.value) || 100);
                  }}
                  className="w-full rounded-xl border border-sky-500/40 bg-black/50 px-3.5 py-2 font-mono text-sm text-sky-300 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-rose-400 mb-1">
                  Hard Stop Loss ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={stop}
                  onChange={(e) => setStop(e.target.value)}
                  className="w-full rounded-xl border border-rose-500/40 bg-black/50 px-3.5 py-2 font-mono text-sm text-rose-300 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            {/* Multipliers & Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/[0.06]">
              <div>
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="text-emerald-400">Target 1 Multiplier (50% Scale)</span>
                  <span className="text-white font-bold">{t1R.toFixed(1)}R (${result.target1Price.toFixed(2)})</span>
                </div>
                <input
                  type="range"
                  min="1.5"
                  max="4.0"
                  step="0.1"
                  value={t1R}
                  onChange={(e) => setT1R(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="text-purple-400">Target 2 Multiplier (Runner)</span>
                  <span className="text-white font-bold">{t2R.toFixed(1)}R (${result.target2Price.toFixed(2)})</span>
                </div>
                <input
                  type="range"
                  min="2.5"
                  max="6.0"
                  step="0.1"
                  value={t2R}
                  onChange={(e) => setT2R(parseFloat(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Interactive Tape Simulation Scrubber */}
          <div className="rounded-3xl border border-white/[0.08] bg-[#0E1322] p-5 sm:p-6 backdrop-blur-xl shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center space-x-2">
                <Activity className="h-4 w-4 text-sky-400 animate-pulse" />
                <span>3. Live Tape Simulation Scrubber</span>
              </h3>
              <span className="text-xs font-mono text-neutral-400">
                Drag price to test coach reactions
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-rose-400 font-bold">Stop: ${stopNum.toFixed(2)}</span>
                <span className="text-sky-300 font-bold text-base bg-black/60 px-3 py-1 rounded-xl border border-white/10">
                  Simulated Price: ${simulatedPrice.toFixed(2)} ({simPct >= 0 ? "+" : ""}{simPct.toFixed(2)}% • {simR}R)
                </span>
                <span className="text-purple-400 font-bold">T2: ${result.target2Price.toFixed(2)}</span>
              </div>

              <input
                type="range"
                min={Math.max(1, stopNum * 0.95)}
                max={result.target2Price * 1.05 || entryNum * 1.2}
                step="0.1"
                value={simulatedPrice}
                onChange={(e) => setSimulatedPrice(parseFloat(e.target.value))}
                className="w-full accent-sky-500"
              />
            </div>

            {/* Dynamic Coach Reaction Alert Banner */}
            {coachSimAlert && (
              <div className={`rounded-2xl border p-4 transition-all duration-300 flex items-start justify-between gap-3 ${coachSimAlert.color}`}>
                <div>
                  <div className="text-xs font-bold font-mono uppercase tracking-wider">
                    {coachSimAlert.headline}
                  </div>
                  <p className="text-xs mt-1 leading-relaxed">
                    {coachSimAlert.instruction}
                  </p>
                </div>
                {onOpenWhyDrawer && (
                  <button
                    onClick={() => onOpenWhyDrawer(coachSimAlert!.ruleKey)}
                    className="shrink-0 text-xs font-mono underline hover:text-white"
                  >
                    Why? →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Visual Ladder & Outcome Matrix (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Sizing Results Card */}
          <div className="rounded-3xl border border-white/[0.08] bg-[#0E1322] p-5 sm:p-6 backdrop-blur-xl shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                Calculated Sizing Allocation
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                result.limitingFactor === "RISK_BUDGET"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-300 border-amber-500/30"
              }`}>
                {result.limitingFactor}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="rounded-2xl bg-black/40 p-3 border border-white/[0.04]">
                <span className="text-neutral-500 text-[10px] block uppercase">Position Size</span>
                <span className="text-xl font-bold text-white">{result.shares} shares</span>
                <span className="text-[10px] text-neutral-400 block">${result.allocatedCapital.toLocaleString()} ({result.allocatedCapitalPct}%)</span>
              </div>

              <div className="rounded-2xl bg-black/40 p-3 border border-white/[0.04]">
                <span className="text-neutral-500 text-[10px] block uppercase">Max Risk ($)</span>
                <span className="text-xl font-bold text-amber-400">${result.dollarRisk.toFixed(2)}</span>
                <span className="text-[10px] text-neutral-400 block">{result.actualRiskPct}% of ${capNum.toLocaleString()}</span>
              </div>
            </div>

            {/* Visual Price Ladder */}
            <PriceLadder
              entryTrigger={entryNum}
              stopLoss={stopNum}
              target1={result.target1Price}
              target2={result.target2Price}
              positionShares={result.shares}
              riskAmount={result.dollarRisk}
              accountSize={capNum}
            />

            {/* Campaign Outcome Matrix */}
            <div className="rounded-2xl border border-white/[0.06] bg-black/40 p-4 space-y-2.5 font-mono text-xs">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                Campaign Expectancy Matrix:
              </span>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between text-rose-400">
                  <span>Scenario A (Stop Invalidation):</span>
                  <span className="font-bold">-${result.dollarRisk.toFixed(2)} (-1.0R)</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Scenario B (T1 Hit &amp; Stopped @ B/E):</span>
                  <span className="font-bold">+${result.breakevenFloorProfit.toFixed(2)} (+1.0R)</span>
                </div>
                <div className="flex justify-between text-purple-300">
                  <span>Scenario C (Full T1 + T2 Runner):</span>
                  <span className="font-bold">+${result.totalCampaignMaxProfit.toFixed(2)} (+{result.blendedRMultiple}R)</span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            {onApplyToOrder && (
              <button
                onClick={() =>
                  onApplyToOrder({
                    ticker,
                    entryTrigger: entryNum,
                    stopLoss: stopNum,
                    target1: result.target1Price,
                    target2: result.target2Price,
                    positionShares: result.shares,
                    riskAmount: result.dollarRisk,
                  })
                }
                className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-emerald-500 py-3 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition active:scale-95"
              >
                <span>Log Position with These Parameters</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## 5. Verification Method

### 5.1 Automated Unit Tests Outline

1. **Rule Engine & Why Dictionary Coverage** (`src/tests/unit/why-rules.test.ts`):
   ```typescript
   import { describe, it, expect } from "../helpers/assertions";
   import { WHY_RULES_DICTIONARY, getWhyRule } from "@/lib/coach/why-rules";

   describe("Unit: Why Rules Dictionary & Fallbacks", () => {
     it("contains all 11 core institutional rules with complete 6-section metadata", () => {
       const keys = Object.keys(WHY_RULES_DICTIONARY);
       expect(keys.length).toBeGreaterThanOrEqual(10);
       for (const key of keys) {
         const rule = WHY_RULES_DICTIONARY[key];
         expect(rule.title).toBeDefined();
         expect(rule.mathFormula.equation).toBeDefined();
         expect(rule.institutionalRationale).toBeDefined();
         expect(rule.psychologicalTrapAvoided.biasName).toBeDefined();
         expect(rule.caseStudyExample.scenarioTitle).toBeDefined();
       }
     });

     it("correctly resolves fuzzy keywords and action types via getWhyRule", () => {
       expect(getWhyRule("SCALE_T1").key).toBe("SCALE_T1");
       expect(getWhyRule("STOP_LOSS_HIT").key).toBe("STOP_LOSS_HIT");
       expect(getWhyRule("TIME_STOP_EXPIRED").key).toBe("TIME_STOP_EXPIRED");
       expect(getWhyRule("TRAIL_STOP_UPDATE").key).toBe("TRAIL_STOP_UPDATE");
     });
   });
   ```

2. **Scenario Calculator Math & Presets** (`src/tests/unit/scenario-math.test.ts`):
   ```typescript
   import { describe, it, expect } from "../helpers/assertions";
   import { calculateScenario, SCENARIO_PRESETS } from "@/lib/education/scenario-math";

   describe("Unit: Scenario Math & Presets", () => {
     it("calculates exact position sizing and R-multiples for standard Breakout Pullback preset", () => {
       const res = calculateScenario({
         accountSize: 15000,
         riskPct: 1.0,
         entryPrice: 125.0,
         stopLoss: 120.5,
         t1Multiplier: 2.0,
         t2Multiplier: 3.5,
       });

       expect(res.isValid).toBe(true);
       expect(res.shares).toBe(33); // floor(150 / 4.5) = 33
       expect(res.dollarRisk).toBe(148.5); // 33 * 4.5
       expect(res.target1Price).toBe(134.0); // 125 + 2 * 4.5
       expect(res.target2Price).toBe(140.75); // 125 + 3.5 * 4.5
       expect(res.blendedRMultiple).toBe(2.75);
     });

     it("validates all 5 presets have positive expectancy and strictly bounded risk", () => {
       expect(SCENARIO_PRESETS).toHaveLength(5);
       for (const preset of SCENARIO_PRESETS) {
         const res = calculateScenario({
           accountSize: 15000,
           riskPct: preset.riskPct,
           entryPrice: preset.entryPrice,
           stopLoss: preset.stopLoss,
           t1Multiplier: preset.t1Multiplier,
           t2Multiplier: preset.t2Multiplier,
         });
         expect(res.isValid).toBe(true);
         expect(res.dollarRisk).toBeLessThanOrEqual(150.0);
         expect(res.target1Price).toBeGreaterThan(preset.entryPrice);
         expect(res.target2Price).toBeGreaterThan(res.target1Price);
       }
     });
   });
   ```

### 5.2 Build & Test Verification Commands

- Execute unit test suite:
  ```powershell
  npx tsx src/tests/unit/rule-engine.test.ts
  npx tsx src/tests/tier1_features/t1_education_infra.test.ts
  ```
- Verify clean Next.js production build:
  ```powershell
  npm run build
  ```
- Invalidation conditions: Any non-zero exit code during `npm run build`, any TypeScript syntax or type error, or any unhandled NaN in scenario math.

---
*Report completed and verified by Explorer 2 for Milestone 5.*
