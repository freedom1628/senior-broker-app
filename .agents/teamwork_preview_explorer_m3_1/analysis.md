# Technical Architecture & Implementation Blueprint: Milestone 3 (Position Manager, Fast Entry & Visual Price Ladder)

## 1. Executive Summary & Scope Overview

Milestone 3 delivers the complete execution and position management engine for the Senior Broker swing trading application. This milestone bridges pre-trade research and tactical trade execution, ensuring institutional-grade risk management ($15,000 capital default, strict 1.0% risk per trade, 3.0% sleeve risk cap, max 3 open positions, 5–7 session time stops) with a consumer-grade Public.com-inspired user experience.

### Core Feature Scope Covered:
1. **Feature 7 (Fast Position & Watch Order Entry)**: <15s UX flow, 1-click 1% account risk auto-sizing ($150 risk on $15k), 4-tier price ladder auto-calculation (Stop, Target 1 at 2.0R, Target 2 at 3.5R, Blended Expected R of 2.75R).
2. **Feature 8 (Active Position Table & Card Dual View)**: Real-time tracking of entry fill, live tape price, share counts, hard stop, Target 1/2, holding sessions count (1–7), conviction/thesis, floating P&L in $ and %, current R-multiple, and open risk gauge.
3. **Feature 9 (Pending Watch Order Queue)**: Pre-staged breakout and pullback watch triggers with live distance-to-trigger metrics, real-time alert evaluation, and 1-click "Fill Entry Now" transition.
4. **Feature 10 (1-Click Tactical Actions)**:
   - *"Scale 50% & Move Stop to Breakeven"*: Sells half position, banks realized gain, locks stop to entry price, triggers C6-E6-G6 target chime.
   - *"Update Trailing Stop"*: Strict upward-only stop ratcheting with instant rejection if lower than current stop.
   - *"Exit Stale Position"*: 1-click market liquidation when session count reaches 5–7 sessions with automatic reason tagging and campaign R-multiple calculation.
5. **Feature 11 / 25 (Visual 4-Tier Price Ladder)**: Proportional stacked execution levels (Target 2, Target 1, Current Tape, Entry, Stop Loss) with live quote needles, % distance, and R-multiples.

---

## 2. Current Codebase Audit & Gap Analysis

### 2.1 Existing Domain Types & Schemas (`src/lib/storage/types.ts`)
- **`Trade`**: Fully defined with `id`, `ticker`, `companyName`, `status` (`ACTIVE`, `PENDING_ENTRY`, `SCALED_T1`, `CLOSED`, etc.), `entryTrigger`, `actualEntry`, `entryDate`, `sharesTotal`, `sharesRemaining`, `initialStop`, `currentStop`, `target1`, `target2`, `rrRatio`, `timeStopSessions`, `sessionsElapsed`, `realizedPnL`, `rMultiple`, `exitReason`, `notes`.
- **`Position`**: Derived interface with `unrealizedPnL`, `unrealizedPnLPct`, `openRiskDollars`, `openRiskPct`, `currentRMultiple`, `isStale`, `isStopBreakeven`.
- **`PortfolioState`**: Tracks `dedicatedCapital` ($15,000), `allocatedCapital`, `cashAvailable`, `openRiskDollars`, `openRiskPct`, `floatingPnL`, `totalRealizedPnL`, `winRate`, `profitFactor`, `avgRMultiple`.
- **`AuditLog` & `StorageEventPayload`**: Audit trails and cross-tab storage broadcast events.

### 2.2 Existing Sizing, Rules & Audio Engines
- `src/lib/portfolio/sizing-calculator.ts`: Complete implementation of `calculatePositionSize(input: SizingInput): SizingResult` enforcing 1% risk ($150 on $15k), cash buffers, single-position concentration caps (25%), ATR stops, and whole-share flooring.
- `src/lib/market/rule-engine.ts`: Complete implementation of `evaluateTrade`, `evaluateTradeRules`, and `validateProposedTrade` enforcing sleeve position caps (3), sleeve risk cap (3.0%), sector limits (2), T1 scale triggers, stop invalidation auto-close flags, and 5–7 session time stops.
- `src/lib/audio/sound-effects.ts`: Web Audio API synthesizer implementing `playTargetChime()` (C6-E6-G6), `playStopLossAlert()` (G3-D3), and `playEntryTriggered()` (A5-C#6).
- `src/lib/storage/local-store.ts`: Dual-layer persistence with in-memory L1 cache, LocalStorage L2, and invariant protections (status never regresses from `SCALED_T1` to `ACTIVE`; stop loss can never be widened downwards).

### 2.3 Gap Analysis & Enhancement Matrix

| Module / Component | Current Implementation | Missing / Needed Enhancements | Target Implementation |
|---|---|---|---|
| **Add Trade Modal** | `src/components/dashboard/AddTradeModal.tsx` | - Requires manual button click for sizing<br>- Lacks real-time 4-tier ladder preview<br>- Lacks live pre-trade guardrails check<br>- Lacks quick-fill ATR / % stop presets | `src/components/positions/AddTradeModal.tsx`<br>- Dynamic auto-calc as user types<br>- Embedded interactive 4-tier price ladder<br>- Pre-trade risk validator banner<br>- Fast presets (<15s flow) |
| **Active Positions View** | `src/components/dashboard/ActiveTradesPanel.tsx` (Card only) | - No Table / Spreadsheet view toggle<br>- No embedded mini price ladder on cards<br>- No open risk gauge per position<br>- No sound trigger on 1-click scale<br>- No "Exit Stale Position" button for session >= 5 | `src/components/positions/ActiveTradesPanel.tsx`<br>- Dual View (Obsidian Cards vs Executive Table)<br>- Embedded mini price progress needle<br>- Real-time open risk pill ($0 for B/E)<br>- Full sound effect & toast integration<br>- 1-Click "Exit Stale Position" with tag |
| **Pending Watch Queue** | Nested list inside `ActiveTradesPanel.tsx` | - Basic text list<br>- Lacks visual breakout proximity bar<br>- Lacks edit modal before activation | `src/components/positions/PendingWatchQueue.tsx`<br>- Dedicated proximity gauge (% to trigger)<br>- Pulsing trigger alert state<br>- 1-Click "Fill Entry Now" with instant audio ping |
| **Visual Price Ladder** | `src/components/dashboard/PriceLadder.tsx` | - Static 4 boxes<br>- No live quote indicator / needle<br>- No compact mode for cards<br>- Hardcoded $10,000 default (should be $15,000) | `src/components/dashboard/PriceLadder.tsx`<br>- Proportional vertical bar geometry<br>- Dynamic current tape needle marker<br>- Dual variant (Full Modal vs Compact Card)<br>- $15,000 baseline with R-multiple badges |
| **Component Organization** | Flat in `src/components/dashboard/` | Does not conform to modular `src/components/positions/` structure in `PROJECT.md` | Modular layout under `src/components/positions/` with backwards-compatible re-exports in `src/components/dashboard/` |

---

## 3. Module 1: Fast Position & Watch Order Entry Architecture

### 3.1 UX Flow & <15-Second Completion Blueprint
To guarantee a <15-second entry flow without cognitive friction:
1. **Auto-Focus & Input Masking**: Auto-focus on `Ticker` input with uppercase conversion.
2. **Setup Presets**: One-click setup style selection pills (`Post-Earnings Pullback`, `Catalyst Continuation`, `Base Breakout`, `High-Tight Flag`).
3. **Quick Stop Presets**:
   - `5.0% Technical Pivot Stop`: Sets `stopLoss = Number((entryPrice * 0.95).toFixed(2))`.
   - `8.0% Maximum Swing Stop`: Sets `stopLoss = Number((entryPrice * 0.92).toFixed(2))`.
   - `2.0x ATR Volatility Stop`: If ATR is available, sets `stopLoss = Number((entryPrice - (2.0 * atr)).toFixed(2))`.
4. **Real-Time Reactive Sizing Engine**:
   - Triggers `calculatePositionSize` immediately on any change to `entryPrice`, `stopLoss`, or `accountSize`.
   - Populates `shares`, `target1` (+2.0R), `target2` (+3.5R), `allocatedCapital`, and `dollarRisk` ($150 / 1.0%).
   - Displays limiting factor badge: `RISK_BUDGET` (standard), `BUYING_POWER` (cash buffer limit), or `MAX_POSITION_CAP` (25% cap).
5. **Live Pre-Trade Guardrails Gatekeeper**:
   - Evaluates `validateProposedTrade` in real time.
   - Shows clean visual status:
     - 🟢 **Allowed**: "Within 1% Risk ($150) & 3% Sleeve Cap ($450)".
     - 🟡 **Warning**: "High sector concentration (2nd position in Sector)".
     - 🔴 **Blocked**: "Sleeve limit reached: Maximum 3 active concurrent trades allowed" or "Sleeve risk cap exceeded: Total risk > 3.0%".
6. **One-Click Submission**:
   - Primary button: "Log Active Position" or "Stage Watch Trigger".
   - Supports `Enter` key shortcut for instant submission.

### 3.2 Sizing & Price Ladder Auto-Calculation Math

$$\text{Risk Per Share} = |\text{Entry Price} - \text{Stop Loss}|$$

$$\text{Risk Budget} = \text{Account Size} \times \left(\frac{\text{Risk Pct}}{100}\right) = \$15,000 \times 0.01 = \$150.00$$

$$\text{Target Shares (Risk-Based)} = \left\lfloor \frac{\text{Risk Budget}}{\text{Risk Per Share}} \right\rfloor$$

$$\text{Target 1 (50\% Scale)} = \text{Entry Price} + (2.0 \times \text{Risk Per Share}) \quad (+2.0\text{R})$$

$$\text{Target 2 (Runner Extension)} = \text{Entry Price} + (3.5 \times \text{Risk Per Share}) \quad (+3.5\text{R})$$

$$\text{Blended Expected R} = (0.5 \times 2.0\text{R}) + (0.5 \times 3.5\text{R}) = +2.75\text{R}$$

$$\text{Allocated Capital} = \text{Shares} \times \text{Entry Price}$$

$$\text{Dollar Risk} = \text{Shares} \times \text{Risk Per Share}$$

### 3.3 AddTradeModal Component Specification

```typescript
export interface AddTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTradeAdded: () => void;
  accountSize?: number; // Default: $15,000.00
  riskPerTrade?: number; // Default: 1.0% ($150.00)
  availableCash?: number; // Default: accountSize
  activeTrades?: Trade[]; // For pre-trade sleeve guardrails validation
  initialCandidate?: Signal | Partial<Trade>; // Pre-filled from Screener candidate promotion
}
```

#### State Architecture:
- `ticker`: string (uppercase)
- `companyName`: string
- `sector`: string
- `status`: `"ACTIVE"` | `"PENDING_ENTRY"`
- `setupType`: SetupType
- `entryPrice`: string (numeric string)
- `stopLoss`: string (numeric string)
- `target1`: string
- `target2`: string
- `shares`: string (auto-calculated or manually overridden)
- `timeStopSessions`: number (default: 6)
- `notes`: string
- `autoSizeEnabled`: boolean (default: true)
- `sizingResult`: SizingResult | null
- `guardrailCheck`: PortfolioRuleCheckResult | null

---

## 4. Module 2: Active Position Manager (Card & Table Dual View) Architecture

### 4.1 Dual View Modes
1. **Public.com Obsidian Card View**:
   - Grid layout (1 col on mobile, 2 cols on desktop/tablet).
   - Glassmorphism background (`bg-[#0C101A]/80`, `backdrop-blur-2xl`, `border-white/[0.08]`).
   - High-contrast typography with monospace execution numbers.
   - Embedded compact Visual Price Ladder showing tape needle between Stop and T2.
   - Quick 1-click tactical action button row.
2. **Executive Spreadsheet Table View**:
   - Dense, high-information-density table for multi-position tracking.
   - Sortable columns: Ticker, Status, Entry/Tape, Stop/T1, Shares, Floating P&L ($ / %), Current R, Session Countdown, Open Risk, Quick Actions.
   - Sticky header and row hover highlights.

### 4.2 Real-Time Metrics & Field Derivations
For each active trade $T$ and live quote $Q$:
- $\text{Effective Entry} = T.\text{actualEntry} \mathbin{||} T.\text{entryTrigger}$
- $\text{Risk Per Share} = \max(0.01, \text{Effective Entry} - T.\text{initialStop})$
- $\text{Remaining Shares} = T.\text{sharesRemaining} > 0 \ ? \ T.\text{sharesRemaining} : T.\text{sharesTotal}$
- $\text{Unrealized P\&L} = (Q.\text{price} - \text{Effective Entry}) \times \text{Remaining Shares}$
- $\text{Unrealized P\&L \%} = \left(\frac{Q.\text{price} - \text{Effective Entry}}{\text{Effective Entry}}\right) \times 100$
- $\text{Current R-Multiple} = \frac{Q.\text{price} - \text{Effective Entry}}{\text{Risk Per Share}}$
- $\text{Open Dollar Risk} = \begin{cases} 0.00 & \text{if } T.\text{currentStop} \ge \text{Effective Entry} \text{ (Breakeven Locked)} \\ (\text{Effective Entry} - T.\text{currentStop}) \times \text{Remaining Shares} & \text{otherwise} \end{cases}$
- $\text{Time Stop Progress} = \text{Session } T.\text{sessionsElapsed} \text{ of } T.\text{timeStopSessions}$
  - Sessions 1–3: 🟢 Normal
  - Sessions 4–5: 🟡 Stagnation Warning
  - Sessions 6+: 🔴 Time Stop Expired / Stale Exit Recommended

### 4.3 1-Click Tactical Actions Execution Engine

#### Action A: "Scale 50% at Target 1 & Move Stop to Breakeven"
- **Trigger**: User clicks button or price reaches $T.\text{target1}$.
- **Calculations**:
  - $\text{Scale Shares} = \lceil T.\text{sharesTotal} / 2 \rceil$
  - $\text{Runner Shares} = T.\text{sharesTotal} - \text{Scale Shares}$
  - $\text{Realized Gain} = \text{Scale Shares} \times (Q.\text{price} - \text{Effective Entry})$
- **Mutations**:
  - $T.\text{status} \leftarrow \text{"SCALED\_T1"}$
  - $T.\text{sharesRemaining} \leftarrow \text{Runner Shares}$
  - $T.\text{currentStop} \leftarrow \text{Effective Entry}$ (Strict Breakeven)
  - $T.\text{realizedPnL} \leftarrow (T.\text{realizedPnL} \mathbin{||} 0) + \text{Realized Gain}$
- **Audio Feedback**: Calls `playTargetChime()` (C6-E6-G6 ascending chime).
- **Toast Feedback**: "Scaled 50% on {TICKER}: Banked +${Realized Gain}. Stop raised to Breakeven (${Effective Entry})."
- **Invariant**: Status is locked to `SCALED_T1`; currentStop cannot be lowered below Breakeven.

#### Action B: "Update Trailing Stop"
- **Trigger**: User opens Adjust Stop modal/popover.
- **Validation**:
  - If $\text{New Stop} < T.\text{currentStop}$: Reject immediately with message: *"Discipline Rule Violation: Cannot widen stop downward from \${currentStop} to \${newStop}"*.
  - If $\text{New Stop} \ge \text{Effective Entry}$: Stop is in profit territory.
- **Mutations**:
  - $T.\text{currentStop} \leftarrow \text{New Stop}$
  - Re-evaluates open risk immediately.

#### Action C: "Exit Stale Position" (Time Stop Discipline)
- **Trigger**: Position in Session $\ge 5$ with stalled momentum.
- **Calculations**:
  - $\text{Remaining Gain} = \text{Remaining Shares} \times (Q.\text{price} - \text{Effective Entry})$
  - $\text{Total Campaign P\&L} = (T.\text{realizedPnL} \mathbin{||} 0) + \text{Remaining Gain}$
  - $\text{Initial Dollar Risk} = T.\text{sharesTotal} \times \text{Risk Per Share}$
  - $\text{Campaign R-Multiple} = \text{Total Campaign P\&L} / \text{Initial Dollar Risk}$
- **Mutations**:
  - $T.\text{status} \leftarrow \text{"CLOSED"}$
  - $T.\text{sharesRemaining} \leftarrow 0$
  - $T.\text{closedPrice} \leftarrow Q.\text{price}$
  - $T.\text{closedDate} \leftarrow \text{new Date().toISOString()}$
  - $T.\text{realizedPnL} \leftarrow \text{Total Campaign P\&L}$
  - $T.\text{rMultiple} \leftarrow \text{Campaign R-Multiple}$
  - $T.\text{exitReason} \leftarrow \text{"TIME\_STOP\_EXIT"}$
- **Audit & Journal**: Automatically populates `JournalEntry` and updates portfolio win rate and metrics ribbon.

### 4.4 ActiveTradesPanel Component Specification

```typescript
export interface ActiveTradesPanelProps {
  activeTrades: Trade[];
  pendingTrades: Trade[];
  marketQuotes: Record<string, MarketSnapshot | QuoteData>;
  accountSize?: number;
  onScaleT1: (tradeId: string, fillPrice?: number) => void;
  onUpdateStop: (tradeId: string, newStop: number) => void;
  onCloseTrade: (tradeId: string, exitReason: string, closePrice?: number) => void;
  onActivatePending: (tradeId: string, fillPrice?: number) => void;
  onDeleteTrade: (tradeId: string) => void;
  onOpenAddTrade?: () => void;
}
```

---

## 5. Module 3: Pending Watch Order Queue Architecture

### 5.1 Pre-Staged Breakout & Pullback Order Management
Pending watch orders represent trading setups that have clear technical trigger levels (e.g., breakout pivot above resistance) but are not yet active:
- Orders are stored with `status: "PENDING_ENTRY"` or `"WATCHLIST"`.
- All position sizing parameters (`sharesTotal`, `initialStop`, `target1`, `target2`, `rrRatio`) are pre-calculated using the 1% risk rule based on the planned trigger price.
- Buying power is reserved conceptually without locking cash.

### 5.2 Distance-to-Trigger & Proximity Monitoring
For each pending order $P$ with trigger $P.\text{entryTrigger}$ and live tape price $Q.\text{price}$:

$$\text{Distance Pct} = \left(\frac{P.\text{entryTrigger} - Q.\text{price}}{Q.\text{price}}\right) \times 100$$

- **Coiling Below Trigger** ($\text{Distance Pct} > 0$): Displays "Coiling {Distance Pct}% below trigger".
- **Trigger Touched / Crossed** ($Q.\text{price} \ge P.\text{entryTrigger}$):
  - Emits `ENTRY_TRIGGERED` alert.
  - Card pulses with emerald glow: "TRIGGER ACTIVATED — Ready to Fill".
  - Plays `playEntryTriggered()` sound (A5-C#6).

### 5.3 1-Click "Fill Entry Now" Execution Flow
1. User clicks **"Fill Entry Now"** button (or trigger executes automatically).
2. Sets `status = "ACTIVE"`.
3. Sets `actualEntry = Q.price || P.entryTrigger`.
4. Sets `entryDate = new Date().toISOString()`.
5. Sets `sharesRemaining = P.sharesTotal`.
6. Sets `sessionsElapsed = 0`.
7. Calls `localStore.saveTrade(updatedTrade)`.
8. Triggers `playEntryTriggered()`.
9. Shows toast notification: *"Position Opened: {TICKER} at ${actualEntry} ({sharesTotal} shares). Hard stop at ${initialStop}."*
10. Automatically deducts allocated capital from `cashAvailable` in `PortfolioState`.

---

## 6. Module 4: Visual 4-Tier Price Ladder Component Architecture

### 6.1 Proportional Bar & Level Geometry
The Visual 4-Tier Price Ladder provides a stacked, institutional execution map. Unlike static tables, it presents relative price geometry from Stop Loss (-1.0R) to Target 2 (+3.5R).

```
┌─────────────────────────────────────────────────────────────┐
│  TARGET 2 (Runner Extension / +3.5R)           $112.00     │  +26.6%  (+3.50 R)  [ 9 sh ]
├─────────────────────────────────────────────────────────────┤
│  TARGET 1 (Scale 50% & Breakeven / +2.0R)      $100.10     │  +13.1%  (+2.00 R)  [ 9 sh ]
├─────────────────────────────────────────────────────────────┤
│  ▲ CURRENT TAPE: $93.25 (+1.00 R Floating)                 │  +5.4%   (Tape Indicator)
├─────────────────────────────────────────────────────────────┤
│  ENTRY TRIGGER (Fill Price / 0.0R Baseline)    $88.50      │  0.0%    (0.00 R)   [18 sh ]
├─────────────────────────────────────────────────────────────┤
│  HARD STOP LOSS (Strict Invalidation / -1.0R)  $83.75      │  -5.4%   (-1.00 R)  [18 sh ]
└─────────────────────────────────────────────────────────────┘
  Risk Math: $4.75/sh • Size: 18 shares ($1,593.00) • Total Risk: $85.50 (0.57% of $15,000)
```

### 6.2 Relative Bar Position Calculation
For a live tape price $P_{\text{tape}}$ bounded between Stop Loss $P_{\text{stop}}$ and Target 2 $P_{\text{t2}}$:

$$\text{Ladder Progress \%} = \min\left(100, \max\left(0, \frac{P_{\text{tape}} - P_{\text{stop}}}{P_{\text{t2}} - P_{\text{stop}}} \times 100\right)\right)$$

- **Stop to Entry Zone** ($P_{\text{stop}} \le P_{\text{tape}} < P_{\text{entry}}$): Colored with Rose/Red gradient.
- **Entry to Target 1 Zone** ($P_{\text{entry}} \le P_{\text{tape}} < P_{\text{t1}}$): Colored with Emerald/Green gradient.
- **Target 1 to Target 2 Zone** ($P_{\text{t1}} \le P_{\text{tape}} \le P_{\text{t2}}$): Colored with Purple/Violet gradient.

### 6.3 PriceLadder Component Interface Specification

```typescript
export interface PriceLadderProps {
  entryTrigger: number;
  stopLoss: number;
  target1?: number;
  target2?: number;
  currentPrice?: number;
  positionShares?: number;
  riskAmount?: number;
  accountSize?: number; // Default: $15,000.00
  variant?: "full" | "compact" | "horizontal" | "card"; // Mode switch
  showSizingBar?: boolean;
}
```

---

## 7. Cross-Cutting Concerns & Integration Blueprint

### 7.1 Web Audio API Integration Matrix
The application uses zero external audio files, relying on pure procedural oscillators via `src/lib/audio/sound-effects.ts`:

| Event / Tactical Action | Sound Function | Musical Tones / Frequency Ramp | Rationale |
|---|---|---|---|
| **Target 1 / Target 2 Hit** | `playTargetChime()` | Ascending C6 (1046.5Hz) $\rightarrow$ E6 (1318.5Hz) $\rightarrow$ G6 (1567.98Hz) | Rewarding, euphoric confirmation of profit taking |
| **Stop Loss Invalidation** | `playStopLossAlert()` | Descending G3 (196Hz) $\rightarrow$ D3 (146.8Hz) triangle pulse | Low, unmistakable alert signaling mandatory exit |
| **Order Fill / Entry Activated** | `playEntryTriggered()` | Crisp ping A5 (880Hz) $\rightarrow$ C#6 (1108.7Hz) | Clean confirmation that risk has been deployed |
| **Time Stop Stagnation Warning** | `playTimeStopWarning()` | Gentle chime F#5 (739.99Hz) $\rightarrow$ D5 (587.33Hz) | Subtle prompt to review stagnating campaign |

*Audio preference is persisted in `UserSettings.audioEnabled` and `UserSettings.soundEnabled`.*

### 7.2 Component Directory Migration & Re-Export Architecture
To ensure complete compliance with `PROJECT.md` and `SCOPE.md` while maintaining 100% backward compatibility:
1. **Primary Implementations**:
   - `src/components/positions/ActiveTradesPanel.tsx`
   - `src/components/positions/AddTradeModal.tsx`
   - `src/components/positions/TacticalActionButtons.tsx`
   - `src/components/dashboard/PriceLadder.tsx`
2. **Backwards-Compatible Re-Exports**:
   - `src/components/dashboard/ActiveTradesPanel.tsx` $\rightarrow$ Re-exports `ActiveTradesPanel` from `../positions/ActiveTradesPanel`
   - `src/components/dashboard/AddTradeModal.tsx` $\rightarrow$ Re-exports `AddTradeModal` from `../positions/AddTradeModal`

---

## 8. Verification & Test Plan

### 8.1 Automated Test Suites to Run
1. `npx tsx src/tests/runner.ts` (Comprehensive Standalone Runner — all 529+ tests).
2. `src/tests/tier1_features/t1_position_rules.test.ts` (Features 7, 8, 9, 10, 11).
3. `src/tests/tier1_features/t1_navigation_ui.test.ts` (Price ladder tiers & navigation).
4. `src/tests/unit/sizing-calculator.test.ts` (1% risk auto-sizing math).
5. `src/tests/unit/rule-engine.test.ts` (Position lifecycle state machine).
6. `src/tests/unit/storage.test.ts` (Dual-layer persistence & stop invariants).

### 8.2 Invalidation Conditions & Boundaries
- If a stop loss is edited lower than `currentStop`, it must throw a Discipline Rule Violation.
- If `sharesRemaining` reaches 0, status must transition to `CLOSED`.
- If an account has 3 active positions, any new proposed active trade must be rejected by `validateProposedTrade`.
- If an active trade reaches `target1`, scaling 50% must set `currentStop` strictly to `actualEntry` and update status to `SCALED_T1`.
