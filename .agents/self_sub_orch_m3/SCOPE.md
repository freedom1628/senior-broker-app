# Scope: Milestone 3 — Position Manager, 1-Click Tactical Actions, Trade Journal & Web Audio Chimes

## Objectives
Implement the complete Position Management, Watch Orders, 1-Click Tactical Execution, Trade Journaling, Tactical Briefings, and Web Audio synthesizers according to the system requirements and interface contracts.

## Feature Inventory Scope
- **Feature 7**: Fast Position & Watch Order Entry (<15s flow, 1-click 1% account risk auto-sizing, 4-tier price ladder auto-calc: Stop, Target 1 50% scale, Target 2 runner).
- **Feature 8**: Active Position Table & Card View (real-time tracking, entry, live price, share count, hard stop, T1/T2, holding sessions count, conviction/thesis, live P&L in $ and R-multiples).
- **Feature 9**: Pending Watch Order Queue (pre-staged orders with condition triggers and 1-click "Fill Entry Now").
- **Feature 10**: 1-Click Tactical Actions:
  - "Scale 50% & Move Stop to Breakeven" (half position close, stop set to entry price, sound trigger).
  - "Update Trailing Stop" (strict upward-only stop ratcheting, rejection if lower than current stop).
  - "Exit Stale Position" (close full position with stale reason tag).
- **Feature 11**: Visual 4-Tier Price Ladder (Target 2, Target 1, Current Price, Entry, Hard Stop relative bar/ladder visualization).
- **Feature 12**: Closed Trade Journal & Performance Analytics:
  - Win Rate %, Total Realized P&L, Profit Factor, Average R-Multiple, Discipline Score.
  - Interactive Recharts Cumulative P&L curve over time.
  - Tag filtering (setup, mistake, market regime) and trade log table.
- **Feature 13**: Morning & Mid-Day Tactical Briefings:
  - Priority triage (High/Medium/Low urgency).
  - Positions needing attention (approaching stop, target 1 reached, stale holding period > 5 sessions).
  - 1-click formatted Markdown export/copy to clipboard.
- **Feature 14 & 15**: Tactical Action Engine & Coach Recommendations.
- **Feature 20 & 21**: Zero-dependency Web Audio API sound synthesizer:
  - C6-E6-G6 ascending chime (Target reached).
  - G3-D3 descending buzzer/tone (Stop alert / risk breach).
  - A5-C#6 crisp entry ping (Order filled / executed).
  - Mute/unmute toggle persisted to localStorage.

## File Ownership
- `src/components/positions/*`
- `src/components/dashboard/PriceLadder.tsx`
- `src/components/journal/*`
- `src/components/coach/TacticalBriefingPanel.tsx`
- `src/components/coach/CoachActionCard.tsx`
- `src/lib/audio/*`
- `src/app/api/trades/*`

## Milestones & Status
| # | Milestone | Scope | Dependencies | Status |
|---|-----------|-------|-------------|--------|
| M3 | Positions, Tactical Actions, Audio & Journal | Features 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 21 | M1 (Storage & Base Types) | IN_PROGRESS |
