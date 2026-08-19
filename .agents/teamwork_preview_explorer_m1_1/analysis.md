# Architectural and Technical Blueprint: M1 Core Domain & Sizing/Rule Engine

**Module Scope**: 
- `src/lib/portfolio/sizing-calculator.ts` (Auto Position Sizer & Risk Modeling)
- `src/lib/market/rule-engine.ts` (Trade Management Rule Engine, Exit Triggers, Sleeve & Sector Limits)

---

## 1. Executive Summary & Design Principles

The Senior Broker Swing Trading application is engineered around strict institutional capital preservation rules. The core domain layer under Milestone 1 (M1) provides deterministic, zero-dependency, pure mathematical and algorithmic evaluation of position sizing and trade lifecycle management.

### Key Tenets:
1. **1% Account Risk Baseline**: Default capital is $15,000 ($150 risk budget per trade), fully configurable.
2. **Asymmetric 2:1 and 3.5:1 R:R Ladders**: Target 1 scales 50% to lock profit and move stop to Breakeven ($0 open risk); Target 2 runs with trailing stops.
3. **Multi-Constraint Sizing**: Shares are bounded by risk budget, buying power, cash buffer (e.g. 5%), and max position concentration cap (e.g. 25% of account).
4. **Institutional Portfolio Guardrails**:
   - Max 3 open concurrent swing trades per sleeve.
   - Max 3.0% aggregate sleeve open risk ($450 on $15,000 capital).
   - Max 2 concurrent positions in the same sector.
5. **Time-Stop Discipline**: Session countdown flagging stagnation after 5 sessions and forcing exit after 7 sessions.

---

## 2. Auto Position Sizer (`src/lib/portfolio/sizing-calculator.ts`)

### 2.1 Mathematical Model & Formulas

#### 1. Risk Budget Calculation
$$\text{RiskBudget} = \text{AccountSize} \times \left(\frac{\text{RiskPct}}{100}\right)$$
*Example*: $\$15,000 \times 1\% = \$150.00$.

#### 2. Risk Per Share
$$\text{RiskPerShare} = |\text{EntryPrice} - \text{StopLoss}|$$
*Validation Constraint*: For Long trades, $\text{EntryPrice} > \text{StopLoss} > 0$. If $\text{EntryPrice} \le \text{StopLoss}$, return validation error.

#### 3. Raw Risk-Based Share Count
$$\text{Shares}_{\text{risk}} = \left\lfloor \frac{\text{RiskBudget}}{\text{RiskPerShare}} \right\rfloor$$

#### 4. Buying Power & Capital Allocation Guardrails
To prevent over-leveraging or concentrating the entire account into a single stock with a very tight stop loss, the calculator applies two safety caps:
1. **Available Buying Power with Cash Buffer**:
   $$\text{MaxCapital}_{\text{cash}} = \text{AvailableCash} \times (1 - \text{CashBufferPct})$$
2. **Max Single-Position Capital Cap** (default 25% of total account):
   $$\text{MaxCapital}_{\text{position}} = \text{AccountSize} \times \left(\frac{\text{MaxPositionPct}}{100}\right)$$
3. **Effective Capital Limit**:
   $$\text{EffectiveCapitalLimit} = \min(\text{MaxCapital}_{\text{cash}}, \text{MaxCapital}_{\text{position}})$$
4. **Capital-Capped Shares**:
   $$\text{Shares}_{\text{capital}} = \left\lfloor \frac{\text{EffectiveCapitalLimit}}{\text{EntryPrice}} \right\rfloor$$
5. **Final Share Allocation**:
   $$\text{FinalShares} = \min(\text{Shares}_{\text{risk}}, \text{Shares}_{\text{capital}})$$

#### 5. ATR-Based Dynamic Volatility Stop
When `stopLoss` is omitted:
$$\text{EffectiveStopLoss} = \text{EntryPrice} - (\text{ATR} \times \text{ATRMultiplier})$$
- Default $\text{ATRMultiplier} = 2.0$ (configurable between 1.5 and 3.0).
- Fallback if ATR is unavailable: default 5.0% technical stop ($\text{EntryPrice} \times 0.95$).

#### 6. Target 1 & Target 2 Computation
- **Target 1 (2.0R)**:
  $$\text{Target1} = \text{EntryPrice} + 2.0 \times \text{RiskPerShare}$$
- **Target 2 (3.5R)**:
  $$\text{Target2} = \text{EntryPrice} + 3.5 \times \text{RiskPerShare}$$
- **Blended Campaign R-Multiple**:
  $$\text{BlendedExpectedR} = (0.5 \times 2.0) + (0.5 \times 3.5) = 2.75\text{R}$$

---

### 2.2 TypeScript Type Definitions & Interface Contract

```typescript
export interface SizingInput {
  accountSize?: number;         // Default $15,000
  riskPct?: number;             // Default 1.0% ($150)
  entryPrice: number;           // Target entry price
  stopLoss?: number;            // Explicit stop loss price
  atr?: number;                 // 14-day Average True Range (optional)
  atrMultiplier?: number;       // Default 2.0x
  target1?: number;             // Optional override for T1
  target2?: number;             // Optional override for T2
  availableCash?: number;       // Defaults to accountSize
  cashBufferPct?: number;       // Default 0.05 (5% cash buffer)
  maxPositionPct?: number;      // Default 25.0 (max 25% account in 1 stock)
}

export interface SizingResult {
  isValid: boolean;
  shares: number;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskPerShare: number;
  dollarRisk: number;
  actualRiskPct: number;
  allocatedCapital: number;
  allocatedCapitalPct: number;
  rewardToRiskT1: number;
  rewardToRiskT2: number;
  blendedExpectedR: number;
  limitingFactor: "RISK_BUDGET" | "BUYING_POWER" | "MAX_POSITION_CAP" | "ZERO_SHARES";
  isAtrDerivedStop: boolean;
  warnings: string[];
  errors: string[];
}
```

---

### 2.3 Concrete Implementation Architecture (`sizing-calculator.ts`)

```typescript
export const DEFAULT_ACCOUNT_SIZE = 15000;
export const DEFAULT_RISK_PCT = 1.0;
export const DEFAULT_ATR_MULTIPLIER = 2.0;
export const DEFAULT_CASH_BUFFER_PCT = 0.05;
export const DEFAULT_MAX_POSITION_PCT = 25.0;

export function calculatePositionSize(input: SizingInput): SizingResult {
  const accountSize = Math.max(0, input.accountSize ?? DEFAULT_ACCOUNT_SIZE);
  const riskPct = Math.max(0, input.riskPct ?? DEFAULT_RISK_PCT);
  const cashBufferPct = input.cashBufferPct ?? DEFAULT_CASH_BUFFER_PCT;
  const maxPositionPct = input.maxPositionPct ?? DEFAULT_MAX_POSITION_PCT;
  const availableCash = input.availableCash ?? accountSize;
  const entryPrice = input.entryPrice;

  const warnings: string[] = [];
  const errors: string[] = [];

  // Validation
  if (accountSize <= 0) {
    errors.push("Account size must be greater than zero.");
  }
  if (entryPrice <= 0 || isNaN(entryPrice)) {
    errors.push("Entry price must be a positive number.");
  }

  let stopLoss = input.stopLoss;
  let isAtrDerivedStop = false;

  if (stopLoss === undefined || isNaN(stopLoss)) {
    if (input.atr && input.atr > 0) {
      const multiplier = input.atrMultiplier ?? DEFAULT_ATR_MULTIPLIER;
      stopLoss = Number((entryPrice - (input.atr * multiplier)).toFixed(2));
      isAtrDerivedStop = true;
    } else {
      // 5% default technical pivot stop
      stopLoss = Number((entryPrice * 0.95).toFixed(2));
      warnings.push("Stop loss not provided; defaulted to 5% below entry.");
    }
  }

  if (stopLoss <= 0) {
    errors.push("Stop loss must be greater than zero.");
  }
  if (stopLoss >= entryPrice) {
    errors.push("Stop loss must be strictly below entry price for long positions.");
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      shares: 0,
      entryPrice,
      stopLoss: stopLoss || 0,
      target1: 0,
      target2: 0,
      riskPerShare: 0,
      dollarRisk: 0,
      actualRiskPct: 0,
      allocatedCapital: 0,
      allocatedCapitalPct: 0,
      rewardToRiskT1: 0,
      rewardToRiskT2: 0,
      blendedExpectedR: 0,
      limitingFactor: "ZERO_SHARES",
      isAtrDerivedStop,
      warnings,
      errors,
    };
  }

  const riskBudget = (accountSize * riskPct) / 100;
  const riskPerShare = Number((entryPrice - stopLoss!).toFixed(2));
  const sharesByRisk = Math.floor(riskBudget / riskPerShare);

  // Capital limitations
  const usableCash = Math.max(0, availableCash * (1 - cashBufferPct));
  const maxPositionCapital = (accountSize * maxPositionPct) / 100;
  const effectiveCapitalLimit = Math.min(usableCash, maxPositionCapital);
  const sharesByCapital = Math.floor(effectiveCapitalLimit / entryPrice);

  let shares = sharesByRisk;
  let limitingFactor: SizingResult["limitingFactor"] = "RISK_BUDGET";

  if (sharesByCapital < sharesByRisk) {
    shares = Math.max(0, sharesByCapital);
    limitingFactor = usableCash < maxPositionCapital ? "BUYING_POWER" : "MAX_POSITION_CAP";
    warnings.push(`Position size capped at ${shares} shares due to ${limitingFactor === "BUYING_POWER" ? "available cash buffer" : "25% max position limit"}.`);
  }

  if (shares === 0) {
    limitingFactor = "ZERO_SHARES";
    warnings.push("Calculated shares is 0. Entry price or risk per share exceeds allocated budget.");
  }

  const dollarRisk = Number((shares * riskPerShare).toFixed(2));
  const actualRiskPct = accountSize > 0 ? Number(((dollarRisk / accountSize) * 100).toFixed(2)) : 0;
  const allocatedCapital = Number((shares * entryPrice).toFixed(2));
  const allocatedCapitalPct = accountSize > 0 ? Number(((allocatedCapital / accountSize) * 100).toFixed(2)) : 0;

  const target1 = input.target1 ?? Number((entryPrice + (2.0 * riskPerShare)).toFixed(2));
  const target2 = input.target2 ?? Number((entryPrice + (3.5 * riskPerShare)).toFixed(2));
  const rewardToRiskT1 = Number(((target1 - entryPrice) / riskPerShare).toFixed(2));
  const rewardToRiskT2 = Number(((target2 - entryPrice) / riskPerShare).toFixed(2));
  const blendedExpectedR = Number(((0.5 * rewardToRiskT1) + (0.5 * rewardToRiskT2)).toFixed(2));

  return {
    isValid: true,
    shares,
    entryPrice,
    stopLoss: stopLoss!,
    target1,
    target2,
    riskPerShare,
    dollarRisk,
    actualRiskPct,
    allocatedCapital,
    allocatedCapitalPct,
    rewardToRiskT1,
    rewardToRiskT2,
    blendedExpectedR,
    limitingFactor,
    isAtrDerivedStop,
    warnings,
    errors: [],
  };
}
```

---

## 3. Trade Management Rule Engine (`src/lib/market/rule-engine.ts`)

### 3.1 Core Rules & Architectural Logic

The Rule Engine operates on two primary levels:
1. **Position-Level Evaluation**: Continuous evaluation of active/pending trades against live market quotes and session counts.
2. **Portfolio-Level Evaluation**: Pre-trade order validation enforcing sleeve risk caps, max trade counts, and sector concentration.

```
+-------------------------------------------------------------------------------+
|                             RULE ENGINE FLOW                                  |
+-------------------------------------------------------------------------------+
| 1. Pre-Trade Sizing & Sleeve Evaluation:                                      |
|    - Active trade count < 3                                                   |
|    - Aggregate sleeve open risk <= 3.0% ($450 / $15k)                          |
|    - Sector concentration < 2 open trades                                     |
|                                                                               |
| 2. Active Trade Lifecycle Monitoring:                                         |
|    - Is CurrentPrice <= CurrentStop?                                          |
|      --> STOP_LOSS / INVALIDATION (Urgency: HIGH, honor stop immediately)      |
|    - Is Status == "ACTIVE" and CurrentPrice >= Target1?                       |
|      --> SCALE_T1 (Urgency: HIGH, Scale 50%, Move stop to Breakeven)           |
|    - Is Status == "SCALED_T1" and CurrentPrice >= Target2?                    |
|      --> TARGET_2_HIT (Urgency: HIGH, Close remaining runner, bank max R)     |
|    - Is Status == "SCALED_T1" and Trailing Stop Triggered?                    |
|      --> TRAIL_STOP_UPDATE (Ratchet stop up, never widen)                     |
|    - Is SessionsElapsed >= 5 and Status == "ACTIVE"?                          |
|      --> TIME_STOP_WARNING (5-6 sessions) / TIME_STOP_EXPIRED (7+ sessions)   |
+-------------------------------------------------------------------------------+
```

---

### 3.2 TypeScript Type Definitions & Interfaces

```typescript
export type TradeStatus = "PENDING_ENTRY" | "ACTIVE" | "SCALED_T1" | "CLOSED";

export type RuleActionType =
  | "NONE"
  | "ENTRY_TRIGGER"
  | "SCALE_T1"
  | "TARGET_2_HIT"
  | "STOP_LOSS_HIT"
  | "TRAIL_STOP_UPDATE"
  | "TIME_STOP_WARNING"
  | "TIME_STOP_EXPIRED"
  | "RISK_CAP_EXCEEDED"
  | "SECTOR_CAP_EXCEEDED";

export type UrgencyLevel = "LOW" | "MEDIUM" | "HIGH";

export interface TradePosition {
  id: string;
  ticker: string;
  companyName: string;
  sector?: string;
  status: TradeStatus;
  setupType: string;
  entryTrigger: number;
  actualEntry?: number | null;
  entryDate?: string | Date | null;
  sharesTotal: number;
  sharesRemaining: number;
  initialStop: number;
  currentStop: number;
  target1: number;
  target2: number;
  rrRatio: number;
  timeStopSessions: number;
  sessionsElapsed: number;
  highestPriceSinceT1?: number;
  closedPrice?: number | null;
  closedDate?: string | Date | null;
  realizedPnL?: number | null;
  rMultiple?: number | null;
  exitReason?: string | null;
  notes?: string | null;
}

export interface RuleEvaluationResult {
  tradeId: string;
  ticker: string;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  currentRMultiple: number;
  actionRequired: RuleActionType;
  urgency: UrgencyLevel;
  headline: string;
  orderInstruction: string;
  whyRationale: string;
  shouldAutoClose?: boolean;
  suggestedStopUpdate?: number;
  sharesToScale?: number;
}

export interface PortfolioState {
  accountSize: number;
  riskPerTradePct: number;
  maxSleeveRiskPct: number;       // Default 3.0%
  maxOpenTrades: number;          // Default 3
  maxSectorPositions: number;     // Default 2
  trades: TradePosition[];
}

export interface PreTradeValidationResult {
  isAllowed: boolean;
  blockReason?: string;
  warnings: string[];
  currentOpenRiskDollars: number;
  currentOpenRiskPct: number;
  projectedOpenRiskDollars: number;
  projectedOpenRiskPct: number;
  activeTradeCount: number;
  sectorCount: number;
}
```

---

### 3.3 Rule Engine Detailed Logic Specifications

#### 1. Target 1 Scale & Breakeven Stop
- **Trigger**: `status === "ACTIVE" && currentPrice >= trade.target1`
- **Shares to Scale**: $\lceil \text{sharesTotal} / 2 \rceil$
- **Stop Update**: Set `currentStop = effectiveEntry` ($0 open risk).
- **Execution Payload**:
  - `actionRequired: "SCALE_T1"`
  - `urgency: "HIGH"`
  - `sharesToScale: Math.ceil(trade.sharesTotal / 2)`
  - `suggestedStopUpdate: effectiveEntry`
  - `whyRationale`: *"Target 1 (2.0R) achieved. In swing trading, scaling 50% guarantees a profitable campaign (+1.0R banked) and raising the stop on the runner to Breakeven eliminates all risk of turning a winning trade into a loser."*

#### 2. Target 2 Runner Management & Trailing Stops
- **Trigger A (T2 Full Extension)**: `status === "SCALED_T1" && currentPrice >= trade.target2`
  - `actionRequired: "TARGET_2_HIT"`
  - `urgency: "HIGH"`
  - `shouldAutoClose: true`
  - `whyRationale`: *"Full campaign extension target (3.5R) touched. Close remaining 50% runner position to capture maximum asymmetric gains."*
- **Trigger B (Dynamic Trailing Stop)**:
  - If `status === "SCALED_T1"` and `currentPrice < trade.target2`:
  - Trailing Stop Calculation:
    $$\text{TrailCandidate} = \max(\text{effectiveEntry}, \text{currentPrice} - (1.5 \times \text{riskPerShare}))$$
  - Ratchet rule: `suggestedStop = Math.max(trade.currentStop, TrailCandidate)`.
  - If `suggestedStop > trade.currentStop`:
    - `actionRequired: "TRAIL_STOP_UPDATE"`
    - `urgency: "LOW"`
    - `suggestedStopUpdate: suggestedStop`

#### 3. Hard Stop Loss Invalidation
- **Trigger**: `(status === "ACTIVE" || status === "SCALED_T1") && currentPrice <= trade.currentStop`
- **Action**: `STOP_LOSS_HIT`
- **Urgency**: `HIGH`
- **AutoClose**: `true`
- **Why Rationale**: *"Hard stop price hit. The initial setup thesis has been invalidated by price action. Immediate exit is mandatory to protect capital."*

#### 4. 5–7 Session Time-Stop Rule
- **Trigger A (Session 5–6 Warning)**: `status === "ACTIVE" && trade.sessionsElapsed >= 5 && trade.sessionsElapsed < 7`
  - `actionRequired: "TIME_STOP_WARNING"`
  - `urgency: "MEDIUM"`
  - `whyRationale`: *"Position has been open for 5–6 sessions without reaching Target 1. Swing catalysts typically deliver momentum within 3–5 sessions. Capital is stagnating."*
- **Trigger B (Session 7+ Expired)**: `status === "ACTIVE" && trade.sessionsElapsed >= 7`
  - `actionRequired: "TIME_STOP_EXPIRED"`
  - `urgency: "HIGH"`
  - `whyRationale`: *"Time stop of 7 sessions has expired without technical expansion. Liquidate position at market to free up risk budget for fresher, high-conviction setups."*

#### 5. Pre-Trade Portfolio Guardrails (Sleeve & Sector Limits)
- Function: `validateProposedTrade(proposed: { ticker: string, sector: string, dollarRisk: number }, portfolio: PortfolioState): PreTradeValidationResult`
- **Check 1 (Max Open Trades)**: Active trades (`ACTIVE` + `SCALED_T1`) $\ge 3$ $\implies$ Block trade.
- **Check 2 (Sleeve Risk Cap 3.0%)**:
  - Compute current open risk across all positions:
    $$\text{OpenRisk}_i = \begin{cases} (\text{actualEntry} - \text{currentStop}) \times \text{sharesRemaining} & \text{if } \text{currentStop} < \text{actualEntry} \\ 0 & \text{if } \text{currentStop} \ge \text{actualEntry (B/E)} \end{cases}$$
  - If $\text{CurrentOpenRisk} + \text{ProposedRisk} > \text{AccountSize} \times 3.0\%$ $\implies$ Block trade.
- **Check 3 (Sector Concentration Limiter)**:
  - If existing active positions in `proposed.sector` $\ge 2$ $\implies$ Block trade or issue strict warning.

---

## 4. Edge Cases & Boundary Conditions Matrix

| Scenario | Input Condition | Expected Engine Behavior |
|---|---|---|
| **Inverted Stop** | `entryPrice = 100`, `stopLoss = 105` | `isValid: false`, error: "Stop loss must be strictly below entry price" |
| **Zero / Negative Entry** | `entryPrice = 0` or `-50` | `isValid: false`, error: "Entry price must be a positive number" |
| **Zero Account Capital** | `accountSize = 0` | `isValid: false`, `shares: 0`, error: "Account size must be greater than zero" |
| **Micro-Stop Overflow** | `entryPrice = 100`, `stopLoss = 99.99` | Sizing capped by `maxPositionPct` (25% capital = $3,750 / $100 = 37 shares, not 15,000 shares) |
| **Exact T1 Hit** | `currentPrice === target1` | Emits `SCALE_T1`, scales 50% shares, moves stop to exact entry price |
| **Gap-Down Open Below Stop** | `stopLoss = 95`, `currentPrice = 90` | Emits `STOP_LOSS_HIT` (HIGH urgency), logs actual exit at $90, calculates accurate negative R-multiple |
| **Scaled Runner Stop Move** | Stop already at Breakeven | Sleeve open risk for this trade is calculated as $0.00, unlocking risk capacity for a new position |
| **Session 5 vs Session 7** | `sessionsElapsed = 5` vs `7` | Session 5 triggers `TIME_STOP_WARNING` (MEDIUM); Session 7 triggers `TIME_STOP_EXPIRED` (HIGH) |
| **3rd Position in Same Sector** | Tech positions = NVDA, PLTR; Proposing AMD | Blocked with `SECTOR_CAP_EXCEEDED` ("Max 2 concurrent positions in Technology") |
| **4th Position in Sleeve** | 3 active positions already open | Blocked with `RISK_CAP_EXCEEDED` ("Max 3 open trades per sleeve reached") |

---

## 5. Integration Architecture with Other M1 & UI Modules

```
+--------------------------------------------------------------------------+
|                       INTEGRATION TOUCHPOINTS                            |
+--------------------------------------------------------------------------+
| 1. Prisma & DB:                                                          |
|    - Trade model fields: actualEntry, currentStop, target1, target2,     |
|      timeStopSessions, sessionsElapsed, sharesRemaining.                 |
|                                                                          |
| 2. Dual-Layer Storage (local-store.ts):                                  |
|    - Synchronizes trade state between IndexedDB/LocalStorage and backend.|
|                                                                          |
| 3. AddTradeModal & ScenarioCalculator (M2/M5):                           |
|    - Uses calculatePositionSize() for real-time 1-click auto-sizing.     |
|                                                                          |
| 4. ActiveTradesPanel & TacticalBriefingPanel (M2/M3):                    |
|    - Runs evaluateTradeRules() on every quote tick to trigger buttons:   |
|      "Scale 50% & Move to B/E", "Update Stop", "Exit Stale Position".    |
|                                                                          |
| 5. Web Audio Engine (sound-effects.ts):                                  |
|    - SCALE_T1 / TARGET_2_HIT -> playTargetChime() (C6-E6-G6-C7)          |
|    - STOP_LOSS_HIT -> playStopLossAlert() (G3-D3-A2)                     |
|    - ENTRY_TRIGGER -> playEntryTriggered() (A5-C#6)                      |
|    - TIME_STOP_WARNING -> playTimeStopWarning() (F#5-D5)                 |
+--------------------------------------------------------------------------+
```

---

## 6. Implementation Readiness & Verification Plan

1. **Unit Test Suite Specifications**:
   - `src/tests/tier1_features/t1_portfolio_core.test.ts`: Test 1% sizer math, buying power caps, ATR stop derivations.
   - `src/tests/tier1_features/t1_risk_engine.test.ts`: Test rule engine triggers (T1 scale, B/E stop, T2 runner, hard stop, 5-7 session time stop, sleeve risk cap, sector limiter).
   - `src/tests/tier2_boundaries/t2_portfolio_bounds.test.ts`: Test zero balance, inverted stops, penny gaps.
2. **Build Verification**:
   - Ensure pure TypeScript without external runtime dependencies (100% Cloudflare Workers / Edge / Browser compatible).
