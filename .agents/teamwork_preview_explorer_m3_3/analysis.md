# Technical Design & Architecture Specification: Web Audio Synthesizer & Closed Trade Journal

**Milestone**: Milestone 3 — Position Manager, Tactical Actions & Audio  
**Author**: Explorer 3  
**Target Path**: `src/lib/audio/*` and `src/components/journal/*`  
**Date**: 2026-08-19  

---

## 1. Executive Summary

This specification establishes the technical architecture and interface contracts for two critical subsystems of the **Senior Broker** swing trading application:
1. **Zero-Dependency Native Web Audio API Synthesizer** (`src/lib/audio/*`): A pure procedural sound synthesizer providing Apple-style high-fidelity audio feedback for trade target reaches, stop-loss invalidations, order triggers, and time-stop alerts without external asset dependencies.
2. **Closed Trade Journal & Performance Analytics** (`src/components/journal/*`): A Public.com-inspired institutional swing campaign audit log and equity analytics suite featuring real-time metric computations (Win Rate %, Realized P&L, Profit Factor, Average R-Multiple, Discipline Score), interactive Recharts cumulative P&L equity curves, multi-dimensional filtering, and deep post-mortem trade drawers.

---

## 2. Zero-Dependency Native Web Audio Synthesizer (`src/lib/audio/*`)

### 2.1 Rationale & Constraints
- **Zero Asset Dependencies**: Eliminates `.mp3`, `.wav`, or `.ogg` asset downloads, preventing HTTP latency, 404 network failures, CORS issues on edge runtimes (Cloudflare), and mobile bandwidth consumption.
- **Microsecond Latency**: Audio buffers are generated procedurally on-demand via native Web Audio API oscillators and gain nodes.
- **Browser Autoplay Compliance**: Safely manages the `AudioContext` lifecycle across browsers (Chrome, Safari iOS, Edge, Firefox), automatically unlocking audio on first user gesture.
- **Universal Runtime Safety**: All functions gracefully evaluate environment availability (`typeof window !== "undefined"` and `typeof AudioContext !== "undefined"`), executing cleanly in SSR, Node, and test runner environments without throwing exceptions.

### 2.2 Sound Signatures & Harmonic Physics

| Sound Effect | Action Trigger | Pitch Sequence & Frequencies | Waveform Type | Envelope Timing & Gains | Rationale & Sound Aesthetic |
|---|---|---|---|---|---|
| **Target Reached Chime** | Target 1 reached (+2R scale), Target 2 runner closed | Ascending Arpeggio: **C6 (1046.50 Hz)** $\to$ **E6 (1318.51 Hz)** $\to$ **G6 (1567.98 Hz)** $\to$ **C7 (2093.00 Hz overtone)** | `sine` | Staggered onsets: `t=0s` (gain 0.18, dec 0.5s), `t=0.12s` (gain 0.22, dec 0.85s), `t=0.24s` (gain 0.20, dec 1.2s) | Bright, triumphant, Apple-style shimmering bell arpeggio celebrating profit capture. |
| **Stop Alert / Risk Breach** | Hard stop hit, risk cap breach (>3%), stop invalidation | Descending Warning Tone: **G3 (196.00 Hz)** $\to$ **D3 (146.83 Hz)** $\to$ **A2 (110.00 Hz undertone)** | `triangle` / filtered `sawtooth` | `t=0s` (gain 0.25, 50ms linear attack, 600ms exponential decay) | Low-frequency resonant warning pulse signaling capital protection and stop discipline. |
| **Entry Ping / Order Filled** | Watch order triggered, manual trade entry executed | Crisp Step Ping: **A5 (880.00 Hz)** $\to$ **C#6 (1108.73 Hz)** | `sine` | `t=0s` (gain 0.20, 30ms linear attack, frequency sweep 0.1s, 700ms decay) | Crisp, decisive high-frequency notification confirming order execution. |
| **Time-Stop Warning** | Session 5–6 stagnation warning (stale campaign) | Gentle Descending Chime: **F#5 (739.99 Hz)** $\to$ **D5 (587.33 Hz)** | `sine` | `t=0s` (gain 0.15, 40ms attack, 600ms decay) | Mild, advisory double-chime reminding trader of time-decay risk without alarming. |

### 2.3 AudioContext Lifecycle, Master Gain & Muting Architecture

```
                                  +-----------------------+
                                  | AudioContext Singleton|
                                  +-----------+-----------+
                                              |
                +-----------------------------+-----------------------------+
                |                             |                             |
     +----------v----------+       +----------v----------+       +----------v----------+
     | Target Chime Nodes  |       |  Stop Alert Nodes   |       |   Entry Ping Nodes  |
     | Osc1, Osc2, Osc3    |       |  Osc1 (G3->D3), Gain|       |   Osc1 (A5->C#6)    |
     | Envelope Gains 1..3 |       |                     |       |                     |
     +----------+----------+       +----------+----------+       +----------+----------+
                |                             |                             |
                +-----------------------------+-----------------------------+
                                              |
                                   +----------v----------+
                                   |  Master Gain Node   |  <-- Volume (0.0 - 1.0)
                                   |  (Mute = 0.0 gain)  |  <-- Mute Switch
                                   +----------+----------+
                                              |
                                   +----------v----------+
                                   |   ctx.destination   |
                                   +---------------------+
```

### 2.4 File Specifications: `src/lib/audio/sound-effects.ts`

```typescript
// Interface & API Specifications for Native Web Audio Synthesizer

export interface AudioEngineConfig {
  volume: number; // 0.0 to 1.0 (default 0.7)
  isMuted: boolean;
}

export interface SoundEffectService {
  playTargetChime(): void;
  playStopLossAlert(): void;
  playEntryTriggered(): void;
  playTimeStopWarning(): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  setVolume(volume: number): void;
  getVolume(): number;
  unlockAudio(): Promise<void>;
}
```

#### Detailed Implementation Blueprint:
1. **AudioContext Lazy Initializer & Unlock**:
   ```typescript
   let audioCtx: AudioContext | null = null;
   let masterGainNode: GainNode | null = null;
   let isAudioMuted: boolean = false;
   let currentVolume: number = 0.7;

   function getAudioContext(): AudioContext | null {
     if (typeof window === "undefined") return null;
     if (!audioCtx) {
       const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
       if (AudioContextClass) {
         audioCtx = new AudioContextClass();
         masterGainNode = audioCtx.createGain();
         masterGainNode.gain.setValueAtTime(isAudioMuted ? 0 : currentVolume, audioCtx.currentTime);
         masterGainNode.connect(audioCtx.destination);
       }
     }
     if (audioCtx && audioCtx.state === "suspended") {
       audioCtx.resume().catch(() => {});
     }
     return audioCtx;
   }
   ```
2. **First-Gesture Auto-Unlock**:
   ```typescript
   export function setupAudioUnlockListeners(): void {
     if (typeof window === "undefined") return;
     const unlock = () => {
       const ctx = getAudioContext();
       if (ctx && ctx.state === "suspended") {
         ctx.resume();
       }
       window.removeEventListener("click", unlock);
       window.removeEventListener("touchstart", unlock);
       window.removeEventListener("keydown", unlock);
     };
     window.addEventListener("click", unlock, { once: true, passive: true });
     window.addEventListener("touchstart", unlock, { once: true, passive: true });
     window.addEventListener("keydown", unlock, { once: true, passive: true });
   }
   ```
3. **Mute State & Volume Synchronization**:
   - On load, read `senior_broker_settings` and `senior_broker_sound_muted` from `localStorage`.
   - Update `masterGainNode.gain` immediately upon toggle.
   - Synchronize across tabs using `localStore` / `BroadcastChannel`.

4. **React Hook: `src/lib/audio/use-audio.ts`**:
   ```typescript
   export function useAudio() {
     const [isMuted, setIsMutedState] = useState<boolean>(() => isMuted());
     const [volume, setVolumeState] = useState<number>(() => getVolume());

     const toggleMute = useCallback(() => {
       const next = !isMuted;
       setMuted(next);
       setIsMutedState(next);
     }, [isMuted]);

     const updateVolume = useCallback((val: number) => {
       setVolume(val);
       setVolumeState(val);
     }, []);

     return {
       isMuted,
       volume,
       toggleMute,
       setVolume: updateVolume,
       playTarget: playTargetChime,
       playStop: playStopLossAlert,
       playEntry: playEntryTriggered,
       playTimeStop: playTimeStopWarning,
     };
   }
   ```

---

## 3. Closed Trade Journal & Analytics (`src/components/journal/*`)

### 3.1 Component Architecture & File Tree

```
src/components/journal/
├── TradeJournal.tsx            # Main Container with tab views, filters, and sub-components
├── MetricsRibbon.tsx           # Institutional Performance Analytics Banner (Win Rate, PnL, R-Multiple, Discipline)
├── PnLCurveChart.tsx           # Interactive Recharts Cumulative Equity Curve & High Water Mark
├── JournalFilterBar.tsx        # Setup, Regime, Mistake, Outcome, and Date Range Filter Bar
├── TradeHistoryTable.tsx       # Comprehensive Closed Campaign Audit Table with pagination & sorting
├── TradeDetailDrawer.tsx       # Slide-Over Post-Mortem Drawer (Planned vs Actual, Ladder, Notes)
└── JournalExportModal.tsx      # 1-Click CSV/JSON & Markdown Journal Export Modal
```

### 3.2 Key Performance Indicators (KPIs) & Mathematical Formats

| Metric | Mathematical Formula | Display Format | Target Benchmark | Institutional Meaning |
|---|---|---|---|---|
| **Total Realized P&L** | $\sum_{i=1}^N \text{realizedPnL}_i$ | `+$340.00` / `-$92.00` | $>0$ ($) | Aggregate dollar profit banked across closed swing campaigns. |
| **Win Rate %** | $\left(\frac{N_{\text{wins}}}{N_{\text{total}}}\right) \times 100$ | `75.0%` (1 dec) | $45\% - 65\%$ | Percentage of campaigns generating $> \$0.01$ profit. |
| **Profit Factor** | $\frac{\text{Gross Profit}}{\text{Gross Loss}}$ | `3.00` (2 dec) | $> 2.0$ | Ratio of gross profit to gross losses. $\ge 2.0$ indicates strong edge. |
| **Average R-Multiple** | $\frac{\sum_{i=1}^N \text{rMultiple}_i}{N_{\text{total}}}$ | `+1.64 R` (2 dec) | $\ge +1.50 \text{ R}$ | Return normalized to initial 1% dollar risk per trade. |
| **Discipline Score %** | $\left(\frac{N_{\text{disciplined}}}{N_{\text{total}}}\right) \times 100$ | `100.0%` / `92.5%` | $100\%$ | Strict adherence: 0 widened stops, $\ge 2:1$ R:R entry, time stops honored. |
| **Average Win ($)** | $\frac{\text{Gross Profit}}{N_{\text{wins}}}$ | `$180.00` | $> 1.5 \times \text{Avg Loss}$ | Average dollar gain on winning trades. |
| **Average Loss ($)** | $\frac{\text{Gross Loss}}{N_{\text{losses}}}$ | `$100.00` | $\le \$150.00$ (1% risk) | Average dollar loss on losing trades (strictly bounded by 1% rule). |
| **Peak Equity / HWM** | $\max_{0 \le k \le N} \text{Equity}_k$ | `$15,650.00` | Upward trending | High water mark of the swing sleeve capital. |
| **Max Drawdown** | $\max_k (\text{HWM}_k - \text{Equity}_k)$ | `$250.00 (1.60%)` | $\le 5.0\%$ | Maximum dollar and percent drawdown from peak equity. |

### 3.3 Interactive Recharts Cumulative Equity Curve (`PnLCurveChart.tsx`)

#### Visual Design Specifications:
- **Container**: `<ResponsiveContainer width="100%" height={320}>`
- **Chart Type**: `AreaChart` with gradient fill and high-contrast lines.
- **Color Gradients**:
  - `pnlGradientGreen`: `stop-color="#10B981"` (opacity 0.35 $\to$ 0.00)
  - `pnlGradientRed`: `stop-color="#F43F5E"` (opacity 0.35 $\to$ 0.00)
- **Series & Lines**:
  - **Cumulative P&L Line**: Emerald `#34D399` stroke (width 2.5px), smooth monotone curve.
  - **High Water Mark (Peak Equity) Line**: Amber `#F59E0B` dashed stroke (width 1.5px, `strokeDasharray="3 3"`).
  - **Zero Baseline ReferenceLine**: `#FFFFFF20` dashed horizontal reference at $0 PnL ($15,000 baseline).
- **Custom Interactive Tooltip**:
  - Displays: Trade index & closed date.
  - Ticker & Company Name badge.
  - Trade Realized P&L: `+$156.60` with color coding.
  - Trade R-Multiple: `+1.83 R`.
  - Cumulative P&L to date: `+$418.00`.
  - Sleeve Total Equity: `$15,418.00`.
  - Drawdown from Peak: `$0.00 (0.0%)`.
  - Exit Reason pill (e.g. `T1_AND_RUNNER`, `STOP_LOSS`, `TIME_STOP`).

```typescript
export interface EquitySeriesPoint {
  tradeIndex: number;
  date: string;
  ticker?: string;
  tradePnL?: number;
  tradeR?: number;
  cumulativePnL: number;
  totalEquity: number;
  highWaterMark: number;
  drawdownDollars: number;
  exitReason?: string;
}
```

### 3.4 Closed Trade History Table (`TradeHistoryTable.tsx`)

#### Features & Columns:
1. **Ticker & Setup**:
   - Large mono ticker badge (`ATRO`), company name, setup tag (`Catalyst Continuation`).
2. **Timestamps & Sessions**:
   - Entry date $\to$ Closed date, sessions elapsed vs time stop limit (e.g. `4 / 5 sessions`).
3. **Execution Levels**:
   - Entry Fill ($), Initial Hard Stop ($), Actual Exit Fill ($).
4. **Realized P&L ($)**:
   - Formatted `$`, green `text-emerald-400` for wins, red `text-rose-400` for losses.
5. **R-Multiple**:
   - High-contrast pill badge: Purple `+2.13 R` for multi-R wins, Emerald `+1.00 R`, Rose `-1.00 R`.
6. **Discipline Flag**:
   - Green shield: "Stop Honored & Plan Followed" / Red flag: "Stop Widened (Violation)".
7. **Exit Reason**:
   - Pill badge: `T1_AND_RUNNER`, `T1_REACHED`, `STOP_HIT`, `TIME_STOP`, `MANUAL`.
8. **Journal Notes & Quick Actions**:
   - Truncated notes preview.
   - Button: **"Post-Mortem / Details"** opening `TradeDetailDrawer`.

### 3.5 Deep Trade Post-Mortem Drawer (`TradeDetailDrawer.tsx`)

#### Slide-Over Layout:
- **Header**: Ticker, Company, Sector, Entry Date, Exit Date, Status (`CLOSED`).
- **Section 1: Planned vs Actual Outcome**:
  - Planned 1% Risk: `$150.00` on `18` shares.
  - Planned R:R: `2.13 : 1`.
  - Actual Realized: `+$156.60` (`+1.83 R`).
- **Section 2: Visual 4-Tier Price Ladder at Exit**:
  - Horizontal / vertical ladder visualizing:
    - Target 2: `$112.00`
    - Target 1: `$100.10`
    - Exit Price: `$100.10` (Marker)
    - Actual Entry: `$88.50`
    - Initial Hard Stop: `$83.75`
- **Section 3: Execution Timeline**:
  - `2026-08-10 09:45`: Buy Limit filled 18 shares at $88.50.
  - `2026-08-13 14:15`: Target 1 hit at $100.10. Scaled 9 shares, stop raised to $88.50 (Breakeven).
  - `2026-08-14 15:30`: Runner liquidated at $100.10. Total campaign profit: +$156.60.
- **Section 4: Discipline & Psychological Post-Mortem**:
  - Checkboxes / Audit:
    - [x] Hard stop respected without hesitation
    - [x] Position sized strictly $\le 1\%$ risk
    - [x] Scaled 50% at Target 1 and raised stop to Breakeven
    - [x] Exited within 5–7 session time horizon
  - **Editable Lessons & Reflections**:
    - Textarea with auto-saving to `localStore` (saved under `senior_broker_journal` or `Trade.notes`).
    - Tag selector (e.g. `Flawless Execution`, `FOMO Entry`, `Early Profit Exit`, `A+ Base Breakout`).

### 3.6 Journal Filter Bar (`JournalFilterBar.tsx`)

#### Multi-Dimensional Filters:
- **Setup Type**: Dropdown (All, Breakout Base, Catalyst Continuation, Post-Earnings Pullback, Fresh Earnings Gap, Mean Reversion).
- **Outcome Filter**: Pill group (All Trades, Winners Only [PnL > $0], Losers Only [PnL < $0], Breakeven).
- **Market Regime**: Dropdown (All, Favorable, Neutral, Hostile).
- **Date Range Filter**: Pill presets (`7D`, `30D`, `90D`, `YTD`, `ALL`) + custom date picker.
- **Search Query**: Ticker or keyword search in notes.
- **Sort By**: Date (Newest/Oldest), Realized P&L (High to Low), R-Multiple (High to Low).

---

## 4. Dual-Layer Storage & Data Persistence Integration

### 4.1 Schema Mapping (`src/lib/storage/types.ts`)

```typescript
export interface Trade {
  id: string;
  ticker: string;
  companyName: string;
  sector?: string;
  status: TradeStatus; // "CLOSED", "CLOSED_STOP", "CLOSED_TARGET", "CLOSED_TIME_STOP", "CLOSED_MANUAL"
  setupType?: SetupType;
  entryTrigger: number;
  actualEntry?: number | null;
  entryDate?: string | null;
  sharesTotal: number;
  sharesRemaining: number;
  initialStop: number;
  currentStop: number;
  target1: number;
  target2: number;
  rrRatio: number;
  timeStopSessions: number;
  sessionsElapsed: number;
  closedPrice?: number | null;
  closedDate?: string | null;
  realizedPnL?: number | null;
  rMultiple?: number | null;
  exitReason?: ExitReason | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface JournalEntry {
  id: string;
  tradeId: string;
  ticker: string;
  setupType: string;
  entryDate: string;
  exitDate?: string;
  entryPrice: number;
  exitPrice?: number;
  realizedPnL?: number;
  rMultiple?: number;
  disciplineScore: number; // 1 to 5 scale
  followedRules: boolean;
  thesis: string;
  mistakesOrLessons?: string;
  marketRegimeAtEntry?: MarketRegime;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}
```

### 4.2 Storage Synchronization Flow
1. When a trade is closed in `ActiveTradesPanel` (via `onCloseTrade` or `onScaleT1`), the trade is updated in `localStore` and posted to `/api/trades`.
2. `localStore.saveTrade()` calculates the final realized P&L and R-multiple:
   $$\text{PnL} = (\text{Exit Price} - \text{Entry Price}) \times \text{Shares} + \text{Prior Scaled PnL}$$
   $$\text{R-Multiple} = \frac{\text{PnL}}{\text{Risk Per Share} \times \text{Initial Shares}}$$
3. A `StorageEvent` and `BroadcastChannel` message are emitted (`TRADE_SAVED`, `TRADES_UPDATED`).
4. `TradeJournal` listening via `localStore.subscribe()` recalculates metrics and updates the Recharts equity curve in real-time.

---

## 5. Verification Plan & Test Matrix

| Test Category | Target File | Verification Command | Success Criteria |
|---|---|---|---|
| **Audio Synthesizer Unit Tests** | `src/tests/tier1_features/t1_journal_audio.test.ts` | `npm test` | All audio functions (`playTargetChime`, `playStopLossAlert`, `playEntryTriggered`) execute safely without errors in Node/SSR. |
| **Journal Analytics Computation** | `src/tests/tier1_features/t1_journal_audio.test.ts` | `npm test` | 100% precision on Win Rate %, Realized P&L, Profit Factor, Average R-Multiple, and Discipline Score. |
| **Cumulative Equity Series & Drawdown** | `src/tests/tier1_features/t1_journal_audio.test.ts` | `npm test` | Equity series computes HWM, Drawdown Dollars, and Max Drawdown % matching trade sequence. |
| **Daily Moves Briefing Markdown Export** | `src/tests/tier1_features/t1_journal_audio.test.ts` | `npm test` | Formats standardized Markdown report with urgent action items and desk checklists. |
| **Build & Type Checking** | Full Project | `npm run build` | Zero TypeScript errors, zero lint errors, 100% clean Next.js build. |

---

## 6. Implementation Task Breakdown for Implementer Agent

1. **Audio Synthesizer Enhancement (`src/lib/audio/sound-effects.ts`)**:
   - Add master gain node, volume getter/setter, mute persistence in `localStorage`, time-stop warning chime (`playTimeStopWarning`), and auto-unlock listener.
   - Create `src/lib/audio/use-audio.ts` React hook for reactive component bindings.
2. **Journal Component Architecture (`src/components/journal/*`)**:
   - Implement `MetricsRibbon.tsx` with 6 responsive KPI tiles.
   - Implement `PnLCurveChart.tsx` with Recharts `AreaChart`, custom tooltip, high-water mark, and responsive container.
   - Implement `JournalFilterBar.tsx` with search, setup filter, regime filter, outcome pills, and date presets.
   - Implement `TradeHistoryTable.tsx` with sortable columns, R-multiple badges, and discipline tags.
   - Implement `TradeDetailDrawer.tsx` with post-mortem breakdown, price ladder snapshot, and editable notes.
   - Wire all components into `TradeJournal.tsx` and integrate with `src/app/page.tsx` tab navigation.
