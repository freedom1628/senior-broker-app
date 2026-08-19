# Technical Analysis & Architecture Specification: Milestone 3 (Tactical Actions, Briefings & Trade APIs)

## Executive Summary & Scope

This specification provides the comprehensive technical design and architectural blueprint for Milestone 3 (Position Manager, Tactical Actions & Audio Engine) of the Senior Broker swing trading web application. Specifically, this document details:

1. **1-Click Tactical Execution Engine**:
   - *"Scale 50% & Move Stop to Breakeven"*: Automated profit banking, stop ratcheting to entry, $0 open risk invariant, and procedural audio feedback.
   - *"Update Trailing Stop"*: Strict upward-only stop loss ratchet with downward-widening protection.
   - *"Exit Stale Position"*: Time-stop discipline liquidation (5–7 session window), multi-tranche campaign R-multiple arithmetic, and capital/risk recycling.
2. **Morning & Mid-Day Tactical Briefings**:
   - Architecture and component specifications for `src/components/coach/TacticalBriefingPanel.tsx` and `src/components/coach/CoachActionCard.tsx`.
   - Urgency triage system (High, Medium, Low urgency).
   - Morning vs. Mid-Day session awareness.
   - Standardized 1-Click Markdown Copy engine formatted for note-taking apps (Obsidian, Notion, Apple Notes).
   - Contextual expandable *"Why this move?"* educational drawers.
3. **Trade Management API Routes & Dual-Layer Persistence**:
   - Full REST API contract and action dispatcher for `src/app/api/trades/route.ts` and related endpoints.
   - Dual-layer synchronization model ensuring zero latency, offline persistence, and cross-tab reactivity.
4. **Web Audio & Push Notification Pipeline**:
   - Procedural Web Audio API sound synthesizers with zero external asset dependencies.

---

## 1. 1-Click Tactical Actions Specification

### 1.1 "Scale 50% & Move Stop to Breakeven"

#### Technical Objective
When an active position reaches Target 1 (default $2.0R$ target extension: $\text{Entry} + 2 \times \text{RiskPerShare}$), the trader can execute a single click to lock in profits on half the position and simultaneously eliminate all downside risk on the remaining shares.

#### Mathematical Equations & Rounding Rules
- **Share Partitioning**:
  $$\text{scaledShares} = \left\lceil \frac{\text{sharesTotal}}{2} \right\rceil$$
  $$\text{sharesRemaining} = \text{sharesTotal} - \text{scaledShares}$$
  *Example (Odd shares)*: A position of 41 shares partitions into $\lceil 41/2 \rceil = 21$ scaled shares and $41 - 21 = 20$ runner shares.
  *Example (Even shares)*: A position of 18 shares partitions into $9$ scaled shares and $9$ runner shares.

- **Realized P&L Calculation**:
  $$\text{effectiveEntry} = \text{trade.actualEntry} \lor \text{trade.entryTrigger}$$
  $$\text{fillPrice} = \text{fillPrice} \lor \text{currentQuote} \lor \text{trade.target1}$$
  $$\text{scaledGain} = \text{round}_2\big((\text{fillPrice} - \text{effectiveEntry}) \times \text{scaledShares}\big)$$
  $$\text{realizedPnL}_{\text{new}} = \text{round}_2\big((\text{trade.realizedPnL} \lor 0) + \text{scaledGain}\big)$$

- **Stop Ratchet & Breakeven Invariant**:
  $$\text{currentStop}_{\text{new}} = \text{effectiveEntry}$$
  $$\text{openRisk}_{\text{runner}} = \max\big(0, (\text{effectiveEntry} - \text{currentStop}_{\text{new}})\big) \times \text{sharesRemaining} = \$0.00$$

#### State Machine Transition
- **Pre-Condition**: `trade.status === "ACTIVE"` and `trade.sharesRemaining > 0`.
- **Post-Condition**:
  - `status = "SCALED_T1"`
  - `sharesRemaining = remainingShares`
  - `currentStop = effectiveEntry`
  - `realizedPnL = realizedPnL_new`
  - `notes` appended with: `Scaled {scaledShares} shares at ${fillPrice}. Stop moved to Breakeven (${effectiveEntry}).`
- **Invariant Protection**: Once in `SCALED_T1`, the status can NEVER regress back to `ACTIVE`, and `currentStop` can NEVER be lowered below `effectiveEntry`.

#### Side Effects & Audio Pipeline
1. Procedural Audio: Calls `playTargetChime()` synthesizing an ascending 3-tone arpeggio (C6 $1046.5\text{Hz}$ $\to$ E6 $1318.5\text{Hz}$ $\to$ G6 $1567.98\text{Hz}$ $\to$ C7).
2. Toast / Push: Dispatches `triggerNotificationAlert({ ticker, type: "TARGET_1_HIT", title, message })`.
3. Audit Log: Logs `POSITION_SCALED_T1` event with previous and new states.
4. Cross-Tab Sync: Dispatches `POSITION_SCALED` event across BroadcastChannel.

---

### 1.2 "Update Trailing Stop" (Upward-Only Ratchet)

#### Technical Objective
Allows tightening stop losses during positive price expansion or trailing stops under prior swing lows on runners, while strictly prohibiting downward stop widening (which violates institutional discipline).

#### Stop Ratchet Rules & Invariants
- **Permitted**: $\text{newStop} > \text{trade.currentStop}$ (Upward tightening).
- **Prohibited**: $\text{newStop} < \text{trade.currentStop}$ (Downward widening).
- **Validation**:
  ```typescript
  if (newStop < trade.currentStop) {
    throw new Error(
      `Discipline Rule Violation: Cannot widen stop downward from $${trade.currentStop.toFixed(2)} to $${newStop.toFixed(2)}`
    );
  }
  ```
- **Automated Trail Candidate Calculation (SCALED_T1)**:
  $$\text{trailCandidate} = \text{round}_2\Big(\max\big(\text{effectiveEntry}, \text{currentPrice} - (1.5 \times \text{riskPerShare})\big)\Big)$$
  If $\text{trailCandidate} > \text{trade.currentStop}$, the rule engine generates a `TRAIL_STOP_UPDATE` recommendation.

#### Storage Invariant Enforcement
In `LocalStoreService.saveTrade(trade)`:
```typescript
if (existing && existing.currentStop > updatedTrade.currentStop) {
  // Enforce upward-only ratchet rule (reject downward stop widening)
  updatedTrade.currentStop = existing.currentStop;
}
```

---

### 1.3 "Exit Stale Position" (Time Stop Discipline & Capital Recycling)

#### Technical Objective
Swing trading positions that fail to follow through within 5 to 7 sessions tie up risk capital while technical momentum decays. The 1-Click Stale Exit liquidates remaining shares at market, calculates the final campaign R-multiple, updates journal metrics, and frees open risk capacity.

#### Stagnation Detection & Session Count Lifecycle
| Session Elapsed | Rule State | Urgency | Action & Recommendation |
|---|---|---|---|
| Sessions 1 – 4 | `NONE` | `LOW` | Normal healthy hold. Stop active. |
| Session 5 – 6 | `TIME_STOP_WARNING` | `MEDIUM` | Warn trader: 5 sessions elapsed without follow-through. Prepare scratch exit. |
| Session $\ge 7$ (or $\ge \text{timeStopSessions}$) | `TIME_STOP_EXPIRED` | `HIGH` | Liquidate at market. Setup momentum has expired. Reallocate risk budget. |

#### Multi-Tranche Campaign R-Multiple Mathematics
When a trade is closed (either purely active or partially scaled at T1), the final campaign R-Multiple is calculated based on the **initial dollar risk**:

$$\text{initialRiskPerShare} = \max\big(0.01, |\text{effectiveEntry} - \text{trade.initialStop}|\big)$$
$$\text{initialDollarRisk} = \text{trade.sharesTotal} \times \text{initialRiskPerShare}$$
$$\text{finalLegGain} = (\text{exitPrice} - \text{effectiveEntry}) \times \text{trade.sharesRemaining}$$
$$\text{totalRealizedPnL} = \text{round}_2\big((\text{trade.realizedPnL} \lor 0) + \text{finalLegGain}\big)$$
$$\text{finalRMultiple} = \text{round}_2\left(\frac{\text{totalRealizedPnL}}{\text{initialDollarRisk}}\right)$$

*Example 1 (Full Stale Exit at Session 7)*:
- Entry: $\$100.00$, Initial Stop: $\$98.00$ ($2.00 risk/sh), 75 shares ($\$150.00$ total risk).
- Market Exit at $\$99.70$:
  - $\text{totalRealizedPnL} = 75 \times (\$99.70 - \$100.00) = -\$22.50$.
  - $\text{finalRMultiple} = -\$22.50 / \$150.00 = -0.15R$.

*Example 2 (Scaled T1 + Runner Stale Exit)*:
- Entry: $\$42.60$, Initial Stop: $\$40.20$ ($2.40 risk/sh), 62 shares ($\$148.80$ initial risk).
- Scale 31 shares at T1 ($\$47.40$): Realized $+\$148.80$ ($+1.0R$).
- Runner 31 shares exit at Session 7 at $\$43.00$: Realized $31 \times (\$43.00 - \$42.60) = +\$12.40$.
- $\text{totalRealizedPnL} = \$148.80 + \$12.40 = +\$161.20$.
- $\text{finalRMultiple} = +\$161.20 / \$148.80 = +1.08R$.

#### Capital & Risk Recycling Impact
1. **Open Risk Reduction**: The closed position's open dollar risk drops from its previous level to $\$0.00$.
2. **Sleeve Cap Headroom**: The freed risk budget ($150 risk on a 1% model) immediately allows opening new high-conviction candidates without violating the 3.0% sleeve cap ($450 on $15k).
3. **Cash Availability**: Liquidated shares convert allocated capital back into available cash balance.

---

## 2. Morning & Mid-Day Tactical Briefings Architecture

### 2.1 Component Structure & File Ownership

```
src/components/coach/
├── TacticalBriefingPanel.tsx    # Main Briefing view with session toggle & markdown copy
├── CoachActionCard.tsx          # Individual actionable triage card with 1-click execution
└── WhyDrawer.tsx                # Contextual slide-over explaining institutional rationale
```

### 2.2 Urgency Triage Matrix

The system triages all active positions, watch triggers, and portfolio risk breaches into three priority tiers:

```
[HIGH URGENCY] (Rose Border / Badge)
  ├─ Hard Stop Invalidation (currentPrice <= currentStop)
  ├─ Target 1 Reached (currentPrice >= target1 & status === "ACTIVE")
  ├─ Target 2 Max Runner Reached (currentPrice >= target2 & status === "SCALED_T1")
  ├─ Time Stop Expired (sessionsElapsed >= timeStopSessions)
  ├─ Aggregate Sleeve Risk Cap Exceeded (aggregateRiskPct > 3.0%)
  └─ Watch Order Breakout Triggered (currentPrice >= entryTrigger)

[MEDIUM URGENCY] (Amber Border / Badge)
  ├─ Approaching Target 1 (distToT1 <= 2.5%)
  ├─ Approaching Watch Trigger (distToTrigger <= 2.0%)
  └─ Time Stop Warning (sessionsElapsed >= 5 or === timeStopSessions - 1)

[LOW URGENCY] (Sky / Emerald Border / Badge)
  ├─ Scaled Runner Floating Risk-Free (Breakeven Floor Active)
  ├─ Trailing Stop Ratchet Opportunity (Price expansion supports stop tightening)
  └─ Healthy Trending Hold (Position advancing constructively towards T1)
```

### 2.3 Morning vs. Mid-Day Contextual Awareness

The `TacticalBriefingPanel` adapts its presentation and analysis based on market time:
- **Morning Briefing Mode (Pre-Market to 10:30 AM EST)**:
  - Header: *"Senior Broker Morning Tactical Briefing"*.
  - Focus: Overnight gaps, pre-market quote indication, pending watch orders coiling near triggers, sector exposure limits, and the morning desk execution checklist.
- **Mid-Day Briefing Mode (10:30 AM to 4:00 PM EST)**:
  - Header: *"Senior Broker Mid-Day Tape & Moves Briefing"*.
  - Focus: Target 1 scale opportunities hit intraday, trailing stop tightening under morning swing lows, time-stop stagnations, and floating P&L progression.

### 2.4 Standardized 1-Click Markdown Export Specification

The 1-Click Copy button generates a clean, standardized Markdown document formatted for direct pasting into Obsidian, Notion, Apple Notes, or trading journals:

```markdown
# Senior Broker — Daily Tactical Moves Briefing
**Generated:** 2026-08-19 17:30:00 UTC
**Session Mode:** Morning Briefing (Pre-Market)
**Market Regime:** FAVORABLE (Consensus Bullish Expansion)

## Sleeve Summary
- **Dedicated Swing Capital:** $15,000.00
- **Allocated Capital:** $6,055.50 | **Cash Available:** $8,944.50
- **Open Positions:** 2 active (Max 3)
- **Pending Watch Orders:** 1 queued
- **Open Dollar Risk:** $277.75 (1.85% of sleeve / 3.0% max cap)
- **Floating Unrealized P&L:** +$342.50
- **Top Performer:** ATRO (+2.13R)

## Prioritized Tactical Action Items (3 Items)

### 1. [HIGH] ATRO — Target 1 Hit ($100.10) — Scale 50% & Move to Breakeven
- **Status:** ACTIVE | **Tape:** $100.25 | **Gain:** +2.13R
- **Details:** ATRO reached $100.25 (+2.13R). Lock in profits on 9 shares immediately.
- **Suggested Order:** `Sell Limit 9 shares at market ($100.25) and raise stop on remainder to $88.50.`
- **Strategy Rationale:** Scaling 50% at Target 1 locks in +1.0R guaranteed gain and creates a risk-free runner to Target 2.

### 2. [HIGH] STAL — Time Stop Expired (Session 7/7)
- **Status:** ACTIVE | **Tape:** $99.70 | **Gain:** -0.15R
- **Details:** STAL has consumed 7 trading sessions without reaching Target 1. Setup momentum has stalled.
- **Suggested Order:** `SELL 75 shares at market to release $150.00 risk capital.`
- **Strategy Rationale:** Catalysts deliver expansion within 3–5 sessions. Dead money past session 7 incurs opportunity cost.

### 3. [MEDIUM] MTRN — Watch Setup Coiling (0.7% to $282.00 trigger)
- **Status:** PENDING_ENTRY | **Tape:** $280.00
- **Details:** Testing pivot resistance at $280.00. Sized for 8 shares ($150 risk on $11.50 stop).
- **Suggested Order:** `Keep buy-stop queued at $282.00. Set stop loss at $270.50 upon fill.`

## Desk Execution Checklist
- [ ] Verify confirmed earnings dates weekly — never hold through unexpected binary events.
- [ ] Honor every hard stop without hesitation. A stop widened is a plan abandoned.
- [ ] Scale 50% at Target 1 and immediately adjust stop to breakeven.
- [ ] Enforce time stops: after 5–7 sessions without expansion, reallocate risk capital.
- [ ] Maintain aggregate open risk below 3.0% of total account value ($450.00).
```

### 2.5 Contextual "Why This Move?" Expandable Drawers

Every action item in `CoachActionCard` includes an interactive *"Why did the Coach recommend this move?"* expandable component:
- **Target 1 Scale**: Explains the institutional mathematics of asymmetric risk-reward (locking in +1.0R guaranteed gain eliminates all downside risk and finances the runner).
- **Hard Stop Invalidation**: Explains thesis invalidation and strict adherence to the 1% risk rule (never averaging down).
- **Time-Stop Exit**: Explains opportunity cost and the decay of breakout catalyst momentum after 5–7 sessions.
- **Trailing Stop**: Explains trailing behind technical swing lows without capping asymmetric upside.

---

## 3. Trade Management API Routes & Dual-Layer Persistence

### 3.1 REST API Routes Specification (`src/app/api/trades/*`)

#### 1. `GET /api/trades`
- **Query Parameters**: `?status=ACTIVE | CLOSED | PENDING_ENTRY`, `?limit=50`.
- **Response**:
  ```json
  {
    "trades": [...],
    "activeTrades": [...],
    "pendingTrades": [...],
    "closedTrades": [...],
    "metrics": {
      "totalRealizedPnL": 340.00,
      "winRate": 75.0,
      "totalTrades": 4,
      "avgRMultiple": 0.88,
      "openPositionCount": 2,
      "openRiskDollars": 277.75,
      "openRiskPct": 1.85
    }
  }
  ```

#### 2. `POST /api/trades`
- **Payload**:
  ```typescript
  interface CreateTradePayload {
    candidateId?: string;
    ticker: string;
    companyName: string;
    sector?: string;
    status: "PENDING_ENTRY" | "ACTIVE";
    setupType?: string;
    entryTrigger: number;
    actualEntry?: number;
    sharesTotal: number;
    initialStop: number;
    currentStop?: number;
    target1?: number;
    target2?: number;
    rrRatio?: number;
    timeStopSessions?: number;
    notes?: string;
  }
  ```
- **Validation**:
  - `entryTrigger > 0`, `initialStop > 0`, `sharesTotal >= 1`.
  - `initialStop < entryTrigger` (for long swing trades).
  - Target auto-calculation if omitted: $T_1 = \text{Entry} + 2 \times \text{Risk}$, $T_2 = \text{Entry} + 3.5 \times \text{Risk}$.
  - Promotes candidate signal if `candidateId` provided.
  - Generates `ENTRY_TRIGGERED` notification.

#### 3. `PUT /api/trades` (Action Dispatcher)
- **Payload Schema**:
  ```typescript
  interface UpdateTradeActionPayload {
    tradeId: string;
    action: "ACTIVATE" | "SCALE_T1" | "UPDATE_STOP" | "INCREMENT_SESSION" | "CLOSE_TRADE" | "EXIT_STALE" | "CANCEL_ORDER";
    fillPrice?: number;
    newStop?: number;
    closePrice?: number;
    exitReason?: string;
    notes?: string;
  }
  ```
- **Action Execution Logic**:
  - `ACTIVATE`: Sets `status = "ACTIVE"`, `actualEntry = fillPrice || entryTrigger`, `entryDate = now()`.
  - `SCALE_T1`: Executes 50% scale math ($\lceil N/2 \rceil$), sets `status = "SCALED_T1"`, ratchets `currentStop = actualEntry`, adds partial realized PnL.
  - `UPDATE_STOP`: Validates `newStop >= currentStop` (rejects downward widening), updates `currentStop`.
  - `INCREMENT_SESSION`: Increments `sessionsElapsed += 1`.
  - `CLOSE_TRADE` / `EXIT_STALE`: Liquidates remaining shares, computes final campaign PnL and `rMultiple`, sets `status = "CLOSED"`, sets `exitReason`.
  - `CANCEL_ORDER`: Sets `status = "CANCELLED"`.

#### 4. `DELETE /api/trades?id={id}`
- Removes trade record from database.

#### 5. `GET /api/trades/journal`
- Returns closed trade logs, tag distributions, and the cumulative equity curve data points computed via `generateCumulativeEquitySeries`.

---

### 3.2 Dual-Layer Persistence & Cross-Tab Reactivity

The application utilizes a robust dual-layer persistence model ensuring that user data is never lost:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React Application Layer                         │
│   (usePortfolioStore, useCoachStore, React State Hooks, Sound FX)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Layer 1: Client Storage & Sync Bus                   │
│  ├─ Synchronous In-Memory Cache (sub-millisecond UI rendering)         │
│  ├─ LocalStorage ('senior_broker_custom_positions', 'settings')        │
│  ├─ IndexedDB Async Store (Historical campaigns, journal, audit logs)  │
│  └─ BroadcastChannel ('senior_broker_bus') [Cross-Tab Live Sync]       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Layer 2: Edge Database & API Routes                  │
│  ├─ Next.js Edge Routes (/api/trades, /api/market/poll)                │
│  ├─ Prisma SQLite / Cloudflare D1 Edge Store                           │
│  └─ 1-Click JSON Snapshot Backup / Restore Engine                      │
└────────────────────────────────────────────────────────────────────────┘
```

#### Storage Invariants Enforced at All Layers
1. **SCALED_T1 Invariant**: A trade marked as `SCALED_T1` cannot regress to `ACTIVE`.
2. **Stop Loss Ratchet Invariant**: A stop loss price can only be increased, never lowered.
3. **Breakeven Risk Invariant**: If `currentStop >= effectiveEntry`, open dollar risk is mathematically clamped to `$0.00`.

---

## 4. Component Interface Contracts & Prop Definitions

### 4.1 `src/components/coach/TacticalBriefingPanel.tsx`

```typescript
export interface TacticalBriefingPanelProps {
  report: DailyPortfolioReport | null;
  activeTrades: Trade[];
  marketQuotes: Record<string, MarketSnapshot | PartialQuote>;
  onRefreshReport: () => void;
  onScaleT1: (tradeId: string, fillPrice?: number) => void;
  onUpdateStop: (tradeId: string, newStop: number) => void;
  onCloseTrade: (tradeId: string, exitReason: string, closePrice?: number) => void;
  onActivatePending?: (tradeId: string, fillPrice?: number) => void;
  onOpenAddTrade?: () => void;
  onOpenLearning?: () => void;
}
```

### 4.2 `src/components/coach/CoachActionCard.tsx`

```typescript
export interface CoachActionCardProps {
  item: PortfolioActionItem;
  matchingTrade?: Trade;
  currentQuote?: MarketSnapshot | PartialQuote;
  onScaleT1: (tradeId: string, fillPrice?: number) => void;
  onUpdateStop: (tradeId: string, newStop: number) => void;
  onCloseTrade: (tradeId: string, exitReason: string, closePrice?: number) => void;
  onActivatePending?: (tradeId: string, fillPrice?: number) => void;
  onOpenLearning?: () => void;
}
```

### 4.3 `src/components/positions/TacticalActionButtons.tsx`

```typescript
export interface TacticalActionButtonsProps {
  trade: Trade;
  currentPrice: number;
  onScaleT1: (tradeId: string, fillPrice?: number) => void;
  onUpdateStop: (tradeId: string, newStop: number) => void;
  onCloseTrade: (tradeId: string, exitReason: string, closePrice?: number) => void;
}
```

---

## 5. Web Audio API Procedural Sound Engine

The audio engine (`src/lib/audio/sound-effects.ts`) implements pure procedural Web Audio API synthesizers that require zero external `.mp3` or `.wav` assets:

1. **`playTargetChime()`**:
   - Tones: C6 ($1046.5\text{Hz}$) $\to$ E6 ($1318.5\text{Hz}$) $\to$ G6 ($1567.98\text{Hz}$) $\to$ C7 ($2093\text{Hz}$).
   - Envelope: Fast linear attack ($40\text{ms}$), exponential harmonic decay.
   - Purpose: Dispatched on Target 1 or Target 2 reaches.
2. **`playStopLossAlert()`**:
   - Tones: G3 ($196\text{Hz}$) $\to$ D3 ($146.8\text{Hz}$).
   - Oscillator: Triangle wave with low warning pulse.
   - Purpose: Dispatched on hard stop loss invalidation or 3.0% sleeve risk cap breach.
3. **`playEntryTriggered()`**:
   - Tones: A5 ($880\text{Hz}$) $\to$ C#6 ($1108.7\text{Hz}$).
   - Envelope: Crisp bell ping ($30\text{ms}$ attack, $700\text{ms}$ decay).
   - Purpose: Dispatched on watch order trigger breakout or manual order execution.
4. **`playTimeStopWarning()`**:
   - Tones: F#5 ($739.99\text{Hz}$) $\to$ D5 ($587.33\text{Hz}$).
   - Envelope: Gentle descending reminder chime.
   - Purpose: Dispatched on Session 5–6 time-stop warning.

---

## 6. Implementation Task List for Implementers

| Component / File | Specific Tasks |
|---|---|
| `src/components/coach/TacticalBriefingPanel.tsx` | Implement full Public.com-style briefing panel with session mode indicator, urgency triage filter pills, responsive summary grid, and 1-click Markdown copy button. |
| `src/components/coach/CoachActionCard.tsx` | Implement modular action card with urgency pill badge, ticker & R-multiple header, order suggestion box, 1-click action buttons (Scale 50%, Update Stop, Exit Stale), and expandable "Why This Move?" drawer. |
| `src/components/positions/TacticalActionButtons.tsx` | Implement responsive 1-click button strip for active position table and card views. |
| `src/app/api/trades/route.ts` | Ensure all PUT action types (`SCALE_T1`, `UPDATE_STOP`, `EXIT_STALE`, `ACTIVATE`, `INCREMENT_SESSION`) strictly enforce downward-widening protection, $0 open risk invariants, and campaign R-multiple math. |
| `src/lib/portfolio/daily-report.ts` | Ensure `generateDailyPortfolioReport` and `formatBriefingMarkdown` outputs include full metadata, risk percentages, and markdown checklist checkboxes. |
| `src/lib/notifications/notification-service.ts` | Wire procedural sound chimes to all action dispatches with user audio preferences. |

---

## 7. Verification & Invalidation Matrix

- **Unit & Adversarial Verification**: Run `npx tsx src/tests/runner.ts` (all 28 test suites must continue passing 100%).
- **Invariant Verification**: Verify that attempting to set `newStop < currentStop` throws `Discipline Rule Violation` and does not mutate storage.
- **Sizing & Scale Verification**: Verify that scaling a 41-share position sells exactly 21 shares and leaves 20 shares at entry stop price.
