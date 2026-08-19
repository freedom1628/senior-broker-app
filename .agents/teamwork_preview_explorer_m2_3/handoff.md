# Exploration & Recommendations: Portfolio Summary Card & Recharts Sparkline Visualization (Milestone 2)

**Agent**: `teamwork_preview_explorer_m2_3`  
**Milestone**: Milestone 2 — Public.com UI Shell & Dashboard Visualization  
**Target Components**: `src/components/dashboard/PortfolioSummaryCard.tsx`, `src/components/dashboard/SparklineChart.tsx`, `src/types/index.ts`, `src/lib/mockData.ts`  
**Working Directory**: `C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\teamwork_preview_explorer_m2_3`  

---

## 1. Observation

### 1.1 Existing Codebase & Environment State
1. **Package Ecosystem (`package.json`)**:
   - `recharts` is installed at version `^3.10.1` (line 31 in `package.json`).
   - `lucide-react` (`^1.33.0`), `clsx` (`^2.1.1`), `tailwind-merge` (`^3.6.0`), and `@tailwindcss/postcss` (`^4`) are installed and configured.
   - Next.js is at `16.3.1` (React `19.2.8`) with OpenNext Cloudflare edge compilation targets (`cf:build`).

2. **Domain Persistence & Storage Schemas (`src/lib/storage/types.ts`)**:
   - `PortfolioState` (lines 134–155) defines:
     ```ts
     dedicatedCapital: number; // Default: $15,000.00
     allocatedCapital: number;
     cashAvailable: number;
     openRiskDollars: number;
     openRiskPct: number;
     floatingPnL: number;
     totalRealizedPnL: number;
     winRate: number;
     profitFactor: number;
     maxOpenPositions: number; // Default: 3
     maxSectorPositions: number; // Default: 2
     maxSleeveRiskPct: number; // Default: 3.0%
     riskPerTradePct: number; // Default: 1.0% ($150 on $15k)
     ```
   - `Trade` & `Position` (lines 39–85) define `sharesTotal`, `sharesRemaining`, `actualEntry`, `entryTrigger`, `initialStop`, `currentStop`, `target1`, `target2`, and lifecycle status (`ACTIVE`, `SCALED_T1`, `PENDING_ENTRY`, `CLOSED`).

3. **Current Dashboard Implementation (`src/app/page.tsx` & `PublicPortfolioOverview.tsx`)**:
   - In `src/app/page.tsx` (lines 431–440), the dashboard currently mounts `PublicPortfolioOverview`.
   - In `PublicPortfolioOverview.tsx` (lines 42–67), metrics are computed on the fly from `activeTrades` and `marketQuotes`, but lack inlined interactive Recharts sparkline curves, multi-timeframe toggles (`1D`, `1W`, `1M`, `1Y`), glowing neon borders, and dynamic tooltip crosshairs.

4. **Test Suite Verification (`src/tests/tier1_features/t1_portfolio_core.test.ts`)**:
   - Full test suite passes 100% (529 assertions across 28 test files in `0.83s`).
   - `t1_portfolio_core.test.ts` (lines 18–58) specifies canonical math for `computePortfolioSummary`:
     - Open Risk is `$0.00` if `currentStop >= entry` (e.g. Breakeven stops on `SCALED_T1` trades do NOT consume sleeve risk budget).
     - Cash Available = `dedicatedCapital - allocatedCapital`.
     - Floating P&L = `sum((currentPrice - entry) * sharesRemaining)`.
   - `generateEquitySparkline` (lines 131–170) models progressive equity curve coordinate calculations with `minEquity`, `maxEquity`, and `netChange`.

---

## 2. Logic Chain

### 2.1 Problem Decomposition
The user request requires delivering a Public.com-inspired consumer-grade dashboard featuring:
1. **Feature 1: Portfolio Summary Card (`PortfolioSummaryCard.tsx`)**:
   - Clear display of Dedicated Swing Capital ($15,000 default), Allocated Capital, Cash Available, Open Risk ($ and %), and Floating P&L.
   - Visual styling: Positive/negative glowing pill badges, obsidian glassmorphism, 4-pillar metric tiles, and fast action triggers.
2. **Feature 2: Interactive Equity Sparklines (`SparklineChart.tsx`)**:
   - High-fidelity Recharts responsive area/line visualization with dynamic emerald/crimson gradient fills.
   - Timeframe toggles (`1D`, `1W`, `1M`, `1Y`).
   - Interactive glass tooltip with equity, delta, and percentage return.
   - Smooth animations, zero layout shift, and SSR hydration safety for React 19 / Next.js 16.
3. **Data Integration (`src/lib/mockData.ts` & `src/types/index.ts`)**:
   - Structured mock data and reactive hooks/helpers that recalculate immediately upon capital changes or quote streaming ticks.

### 2.2 Architectural Blueprints

#### Blueprint A: TypeScript Interfaces (`src/types/index.ts`)
```ts
// src/types/index.ts

export type TimeframeOption = "1D" | "1W" | "1M" | "1Y";

export interface EquityDataPoint {
  timestamp: string; // ISO string or display label
  timeLabel: string; // e.g. "09:30 AM", "Mon", "Aug 15"
  equity: number; // e.g. 15245.50
  changeDollars: number; // e.g. +245.50
  changePct: number; // e.g. +1.64
  benchmark?: number; // Optional SPY benchmark line
}

export interface PortfolioSummaryMetrics {
  dedicatedCapital: number;
  allocatedCapital: number;
  cashAvailable: number;
  openRiskDollars: number;
  openRiskPct: number;
  floatingPnL: number;
  floatingPnLPct: number;
  totalSleeveValue: number;
  activePositionsCount: number;
  isRiskSafe: boolean; // openRiskPct <= maxSleeveRiskPct (3.0%)
  riskCapacityRemaining: number; // 3.0% - openRiskPct
}

export interface SparklineChartProps {
  data?: EquityDataPoint[];
  timeframe: TimeframeOption;
  onTimeframeChange?: (tf: TimeframeOption) => void;
  height?: number;
  startingCapital?: number;
  currentEquity?: number;
  className?: string;
  showControls?: boolean;
}

export interface PortfolioSummaryCardProps {
  accountSize?: number;
  riskPerTrade?: number;
  maxSleeveRiskPct?: number;
  activeTrades: any[];
  marketQuotes: Record<string, any>;
  equityHistory?: Record<TimeframeOption, EquityDataPoint[]>;
  onOpenAddTrade?: () => void;
  onOpenImport?: () => void;
  onOpenSettings?: () => void;
  onNavigateToTab?: (tab: "COACH" | "POSITIONS" | "SCREENER" | "LEARNING" | "JOURNAL") => void;
  className?: string;
}
```

---

#### Blueprint B: `SparklineChart.tsx` Implementation Design
- **Container Structure**:
  - Top header row with period return badge (`+$245.50 (+1.64%)`) on left, and 4-pill segmented buttons (`1D`, `1W`, `1M`, `1Y`) on right.
  - Recharts `ResponsiveContainer` wrapped in fixed-height element (`h-[180px]` or `h-[220px]`).
- **Gradient Defs**:
  - Dynamic gradient ID `equityGlowEmerald` or `equityGlowCrimson` defined via SVG `<defs>`.
  - Positive trend: `#10B981` (Emerald) with stroke drop-shadow glow and area gradient `rgba(16,185,129,0.3)` to `rgba(16,185,129,0.0)`.
  - Negative trend: `#F43F5E` (Crimson) with stroke drop-shadow glow and area gradient `rgba(244,63,94,0.3)` to `rgba(244,63,94,0.0)`.
- **Recharts AreaChart Configuration**:
  ```tsx
  <ResponsiveContainer width="100%" height={height}>
    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
      <defs>
        <linearGradient id="equityEmeraldGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#10B981" stopOpacity={0.0} />
        </linearGradient>
        <linearGradient id="equityCrimsonGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#F43F5E" stopOpacity={0.0} />
        </linearGradient>
        <filter id="emeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#10B981" floodOpacity="0.6" />
        </filter>
        <filter id="crimsonGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#F43F5E" floodOpacity="0.6" />
        </filter>
      </defs>
      <XAxis dataKey="timeLabel" hide />
      <YAxis domain={["auto", "auto"]} hide />
      <Tooltip content={<CustomSparklineTooltip />} />
      <Area
        type="monotone"
        dataKey="equity"
        stroke={isPositive ? "#10B981" : "#F43F5E"}
        strokeWidth={2.5}
        fill={isPositive ? "url(#equityEmeraldGradient)" : "url(#equityCrimsonGradient)"}
        filter={isPositive ? "url(#emeraldGlow)" : "url(#crimsonGlow)"}
        isAnimationActive={true}
        animationDuration={800}
      />
    </AreaChart>
  </ResponsiveContainer>
  ```
- **Interactive Glass Tooltip**:
  - Framed in `bg-[#0B0F19]/95 backdrop-blur-xl border border-white/[0.12] rounded-2xl p-3 shadow-2xl`.
  - Shows exact timestamp, current equity level, dollar change from baseline, and return percentage.

---

#### Blueprint C: `PortfolioSummaryCard.tsx` Implementation Design
- **Visual Structure**:
  1. **Top Sleeve Identity Ribbon**:
     - Pulsing emerald radar dot + `"Dedicated Swing Trading Sleeve (<1% Overall Wealth)"`.
     - Settings Pill: `"Capital: $15,000 • 1.0% Max Risk • 3.0% Sleeve Cap"`.
  2. **Hero Sleeve Value Row**:
     - Large typography: `$15,340.50` (`text-4xl font-bold font-mono text-white`).
     - Floating P&L Pill Badge:
       - If `floatingPnL >= 0`: `bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]` with `<ArrowUpRight className="h-4 w-4" />`.
       - If `floatingPnL < 0`: `bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.15)]` with `<ArrowDownRight className="h-4 w-4" />`.
     - Quick Action Button Hub:
       - `+ Add Position` (Emerald accent pill button).
       - `AI Screener` (Obsidian glass pill button).
  3. **Embedded Interactive Sparkline Area**:
     - Seamless integration with `SparklineChart` with default `1D` or selected timeframe.
  4. **4-Tile Executive Sizing & Risk Matrix**:
     - **Cash Available**: Available liquidity buffer, percentage of sleeve liquid.
     - **In Active Trades**: Current cost basis / market value, active position count.
     - **Open Risk Cap**: Current dollar risk to hard stops, open risk % vs 3.0% cap, status indicator.
     - **1% Trade Risk Budget**: Calculated $150 risk budget per new setup with stop loss rule reminder.

---

#### Blueprint D: Mock Data Architecture (`src/lib/mockData.ts`)
```ts
// src/lib/mockData.ts
import { EquityDataPoint, TimeframeOption } from "@/types";

export const MOCK_EQUITY_SERIES: Record<TimeframeOption, EquityDataPoint[]> = {
  "1D": [
    { timestamp: "2026-08-19T09:30:00Z", timeLabel: "09:30 AM", equity: 15000.0, changeDollars: 0, changePct: 0 },
    { timestamp: "2026-08-19T10:30:00Z", timeLabel: "10:30 AM", equity: 15045.2, changeDollars: 45.2, changePct: 0.3 },
    { timestamp: "2026-08-19T11:30:00Z", timeLabel: "11:30 AM", equity: 15112.5, changeDollars: 112.5, changePct: 0.75 },
    { timestamp: "2026-08-19T12:30:00Z", timeLabel: "12:30 PM", equity: 15089.0, changeDollars: 89.0, changePct: 0.59 },
    { timestamp: "2026-08-19T13:30:00Z", timeLabel: "01:30 PM", equity: 15185.4, changeDollars: 185.4, changePct: 1.24 },
    { timestamp: "2026-08-19T14:30:00Z", timeLabel: "02:30 PM", equity: 15270.0, changeDollars: 270.0, changePct: 1.8 },
    { timestamp: "2026-08-19T15:30:00Z", timeLabel: "03:30 PM", equity: 15310.8, changeDollars: 310.8, changePct: 2.07 },
    { timestamp: "2026-08-19T16:00:00Z", timeLabel: "04:00 PM", equity: 15340.5, changeDollars: 340.5, changePct: 2.27 },
  ],
  "1W": [
    { timestamp: "2026-08-15T16:00:00Z", timeLabel: "Fri (Prev)", equity: 14920.0, changeDollars: -80.0, changePct: -0.53 },
    { timestamp: "2026-08-16T16:00:00Z", timeLabel: "Mon", equity: 15050.0, changeDollars: 50.0, changePct: 0.33 },
    { timestamp: "2026-08-17T16:00:00Z", timeLabel: "Tue", equity: 15120.0, changeDollars: 120.0, changePct: 0.8 },
    { timestamp: "2026-08-18T16:00:00Z", timeLabel: "Wed", equity: 15210.0, changeDollars: 210.0, changePct: 1.4 },
    { timestamp: "2026-08-19T16:00:00Z", timeLabel: "Today", equity: 15340.5, changeDollars: 340.5, changePct: 2.27 },
  ],
  "1M": [
    { timestamp: "2026-07-20T16:00:00Z", timeLabel: "Jul 20", equity: 14650.0, changeDollars: -350.0, changePct: -2.33 },
    { timestamp: "2026-07-27T16:00:00Z", timeLabel: "Jul 27", equity: 14820.0, changeDollars: -180.0, changePct: -1.2 },
    { timestamp: "2026-08-03T16:00:00Z", timeLabel: "Aug 03", equity: 14980.0, changeDollars: -20.0, changePct: -0.13 },
    { timestamp: "2026-08-10T16:00:00Z", timeLabel: "Aug 10", equity: 15160.0, changeDollars: 160.0, changePct: 1.07 },
    { timestamp: "2026-08-19T16:00:00Z", timeLabel: "Aug 19", equity: 15340.5, changeDollars: 340.5, changePct: 2.27 },
  ],
  "1Y": [
    { timestamp: "2025-08-19T16:00:00Z", timeLabel: "Q3 '25", equity: 13500.0, changeDollars: -1500.0, changePct: -10.0 },
    { timestamp: "2025-11-19T16:00:00Z", timeLabel: "Q4 '25", equity: 14100.0, changeDollars: -900.0, changePct: -6.0 },
    { timestamp: "2026-02-19T16:00:00Z", timeLabel: "Q1 '26", equity: 14600.0, changeDollars: -400.0, changePct: -2.67 },
    { timestamp: "2026-05-19T16:00:00Z", timeLabel: "Q2 '26", equity: 15000.0, changeDollars: 0.0, changePct: 0.0 },
    { timestamp: "2026-08-19T16:00:00Z", timeLabel: "Q3 '26", equity: 15340.5, changeDollars: 340.5, changePct: 2.27 },
  ],
};

export function generateDynamicEquityCurve(
  startingCapital: number,
  floatingPnL: number,
  timeframe: TimeframeOption
): EquityDataPoint[] {
  const baseSeries = MOCK_EQUITY_SERIES[timeframe];
  if (!baseSeries || baseSeries.length === 0) return [];

  const currentEquity = startingCapital + floatingPnL;
  const lastIndex = baseSeries.length - 1;

  return baseSeries.map((pt, idx) => {
    if (idx === lastIndex) {
      return {
        ...pt,
        equity: Number(currentEquity.toFixed(2)),
        changeDollars: Number((currentEquity - startingCapital).toFixed(2)),
        changePct: Number((((currentEquity - startingCapital) / startingCapital) * 100).toFixed(2)),
      };
    }
    const ratio = pt.equity / 15000.0;
    const scaledEquity = Number((startingCapital * ratio).toFixed(2));
    return {
      ...pt,
      equity: scaledEquity,
      changeDollars: Number((scaledEquity - startingCapital).toFixed(2)),
      changePct: Number((((scaledEquity - startingCapital) / startingCapital) * 100).toFixed(2)),
    };
  });
}
```

---

## 3. Caveats

1. **Recharts Next.js 16 SSR Hydration Consideration**:
   - Recharts requires measuring DOM bounding boxes dynamically. If rendered on the server without hydration guards, React 19 may throw hydration warnings (`Prop 'd' did not match`).
   - *Mitigation*: Include a `const [isMounted, setIsMounted] = useState(false)` check in `SparklineChart.tsx`, rendering an animated skeleton or sleek placeholder during server render and hydrating seamlessly on mount.
2. **Dynamic Stop Loss Math & Open Risk Calculation**:
   - For `SCALED_T1` positions where `currentStop >= actualEntry`, the stop loss has been ratcheted to Breakeven or in profit. Open risk MUST be evaluated as `0.00` to avoid incorrectly capping buying power.
   - *Mitigation*: Ensure `computePortfolioSummary` and `PortfolioSummaryCard` strictly check `if (trade.currentStop < entry) openRisk += (entry - stop) * shares; else openRisk += 0;`.
3. **Responsive Breakpoints on Mobile Screen**:
   - On small screens (< 640px), the 4-pillar metric tiles should format cleanly as a 2x2 grid (`grid-cols-2 sm:grid-cols-4`), and chart controls should wrap cleanly without overflowing horizontally.

---

## 4. Conclusion

1. **Complete Architectural Blueprint Defined**:
   - `PortfolioSummaryCard.tsx` provides a consumer-grade Public.com overview with obsidian dark theme, glowing floating P&L badges, 4 key risk/capital tiles, and 1-click action triggers.
   - `SparklineChart.tsx` provides an interactive Recharts area chart with dynamic emerald/crimson gradient glows, time-frame toggles (`1D`, `1W`, `1M`, `1Y`), smooth easing animations, and interactive tooltips.
   - `src/types/index.ts` and `src/lib/mockData.ts` deliver deterministic data models, equity series generation, and seamless calculation helpers.
2. **Ready for Milestone 2 Implementation**:
   - The specifications are fully aligned with `PROJECT.md`, `SCOPE.md`, and all 28 test suites (including `t1_portfolio_core.test.ts` and `t1_navigation_ui.test.ts`).

---

## 5. Verification Method

To independently verify these architectural recommendations:

1. **Run Full Test Suite**:
   ```pwsh
   npm test
   ```
   *Expected*: All 28 test files and 529 assertions pass with 100% success rate.

2. **Verify Component Compatibility & TypeScript Build**:
   ```pwsh
   npx tsc --noEmit
   ```
   *Expected*: Zero type errors across all interface definitions.

3. **Verify Next.js Production Build**:
   ```pwsh
   npm run build
   ```
   *Expected*: Next.js compiles client and server bundles cleanly with zero warnings or SSR errors.

4. **Verify Responsive Visual Layout**:
   - Inspect desktop viewport (1440px): 4-pillar grid, inlined sparkline chart, action pills.
   - Inspect mobile viewport (375px): 2x2 metric grid, responsive chart resizing, zero horizontal overflow.
