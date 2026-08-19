# Exploration & Blueprint Handoff: Layout & Navigation Shell (Milestone 2)

**Agent**: `teamwork_preview_explorer_m2_1`  
**Milestone**: Milestone 2 — Visual Shell, Layout & Global Context Foundations  
**Scope**: Features 1, 3, 4, 5 (Obsidian Dark Theme, Top Header, 6-View Pill Navigation, Responsive Mobile Navigation, Main View Container)

---

## 1. Observation

### 1.1 Existing Workspace & Codebase State
Direct inspection of the repository files revealed:
- **`src/app/layout.tsx`** (lines 1–40):
  - Viewport themeColor set to `#070A0F`.
  - Body styled with `bg-[#070A0F] text-slate-100 selection:bg-sky-500/30 selection:text-white`.
  - Mobile web app meta tags configured for `appleWebApp: { capable: true, statusBarStyle: "black-translucent" }`.
- **`src/app/globals.css`** (lines 1–34):
  - Tailwind v4 `@import "tailwindcss";` setup.
  - CSS root variables: `--background: #070A0F; --foreground: #F1F5F9;`.
  - Apple-style subtle scrollbar styling (`::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); }`).
- **`src/app/page.tsx`** (lines 1–628):
  - Client component `"use client"` with authentication gating via `SignInView.tsx`.
  - Currently contains inline 5-tab pill buttons (`COACH`, `POSITIONS`, `SCREENER`, `LEARNING`, `JOURNAL`), while Settings is rendered as a separate modal dialog (`isSettingsOpen`).
  - Fetches and orchestrates research data, active/pending/closed trades, daily report, live market quotes, and notifications polling.
- **`src/components/layout/Header.tsx`** (lines 1–179):
  - Top header with sticky positioning, backdrop blur (`bg-[#070A0F]/85 backdrop-blur-2xl border-b border-white/[0.08]`).
  - Displays brand logo, account size / risk quick pill, live index ribbon (SPY, QQQ, VIX), polling spinner, notification badge, settings toggle, and desk lock/sign out button.
- **`src/components/auth/SignInView.tsx`** (lines 1–310):
  - Dual-mode authentication UI supporting 1-click Google OAuth simulation and 4-digit Desk Passcode login / registration.
  - Glassmorphic card styling (`bg-[#0C101A]/85 backdrop-blur-2xl border border-white/10 rounded-3xl`).
- **`src/tests/tier1_features/t1_navigation_ui.test.ts`** (lines 1–502):
  - 100% passing tests for `NavView` ("REPORT" | "RESEARCH" | "TRADES" | "JOURNAL" | "EDUCATION" | "SETTINGS"), `NavigationState`, `AuthServiceSimulator`, Public.com dark theme tokens, and 4-tier price ladders.
- **Test Suite Status**: Executed `npm test` — all 28 test files with 529 assertions passed (100% success rate, 0.88s execution time).

---

## 2. Logic Chain & Architectural Blueprint

### 2.1 Design System Tokens (Public.com Minimalist Dark UI)
To fulfill Requirement R1.1/R1.3 and Feature 4, we define the standardized design tokens:

| Token Category | Hex / Class | Semantic Role |
| :--- | :--- | :--- |
| **Canvas Background** | `#070A0F` (`bg-[#070A0F]`) | Deep obsidian base canvas, zero OLED bleed |
| **Surface 1 (Cards)** | `#0E131F` (`bg-[#0E131F]`) | Primary card container, subtle cool dark tone |
| **Surface 2 (Elevated)**| `#161D2F` (`bg-[#161D2F]`) | Hover cards, input containers, active pill highlights |
| **Surface Glass** | `bg-white/[0.03]` – `bg-white/[0.06]` | Glassmorphic floating bars & nested panels |
| **Hairline Border** | `border-white/[0.08]` / `border-white/10` | Sleek Public.com minimalist card edge |
| **Accent Emerald** | `#10B981` (`emerald-500`) | Target 1 reached, profit P&L, safe risk, active trades |
| **Accent Sky / Cyan** | `#06B6D4` / `#0EA5E9` (`sky-500`) | AI Coach, prompt station, pending watch orders, SPY/QQQ |
| **Accent Crimson** | `#EF4444` / `#F43F5E` (`rose-500`) | Hard stop loss, trade invalidation, risk limit warning |
| **Accent Amber** | `#F59E0B` (`amber-500`) | Time-stop warning (5-6 sessions), 1% risk threshold |
| **Accent Purple** | `#A855F7` (`purple-500`) | Target 2 runner, Investor Learning Center |
| **Typography Primary**| `#F1F5F9` (`text-slate-100`) | High-contrast readable headings & numeric readouts |
| **Typography Muted** | `#94A3B8` (`text-neutral-400`) | Labels, captions, thesis notes, secondary metrics |

#### Glassmorphism & Pill Badges CSS Specifications
```css
/* Custom Utility Classes for Public.com Styling */
.glass-card {
  background: linear-gradient(180deg, rgba(14, 19, 31, 0.85) 0%, rgba(10, 13, 21, 0.85) 100%);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 1.5rem; /* 24px */
}

.glass-pill-nav {
  background: rgba(14, 19, 31, 0.90);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
}

.pill-badge-emerald {
  background-color: rgba(16, 185, 129, 0.10);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: 9999px;
}

.pill-badge-sky {
  background-color: rgba(14, 165, 233, 0.10);
  color: #38bdf8;
  border: 1px solid rgba(14, 165, 233, 0.25);
  border-radius: 9999px;
}

.pill-badge-rose {
  background-color: rgba(239, 68, 68, 0.10);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 9999px;
}

.pill-badge-amber {
  background-color: rgba(245, 158, 11, 0.10);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 9999px;
}
```

---

### 2.2 Concrete TypeScript Interfaces & Contracts

#### A. Navigation Models (`src/types/navigation.ts` or layout components)
```typescript
export type NavigationTab = 
  | "COACH"       // AI Swing Coach Briefing & Prioritized Moves
  | "POSITIONS"   // Active Trades & Watch Queue Price Ladders
  | "SCREENER"    // Multi-LLM Frontier Research & Arbiter
  | "LEARNING"    // Investor Education & Sizing Calculator
  | "JOURNAL"     // Closed Trade Analytics & P&L Curve
  | "SETTINGS";   // Capital Allocation & API Keys

export interface NavigationBadgeCounts {
  activePositions: number;
  pendingOrders: number;
  unreadAlerts: number;
  highUrgencyMoves: number;
  candidateSetups: number;
}

export interface TabItem {
  id: NavigationTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string; // e.g. "sky", "emerald", "indigo", "purple", "amber", "slate"
  badgeCount?: number;
  badgeTone?: "emerald" | "sky" | "rose" | "amber";
}
```

#### B. Header Interface Contract (`src/components/layout/Header.tsx`)
```typescript
export interface HeaderProps {
  onOpenImport: () => void;
  onOpenSettings: () => void;
  onOpenAddTrade: () => void;
  onOpenNotifications: () => void;
  onSignOut: () => void;
  unreadAlertsCount: number;
  marketQuotes: Record<string, { price: number; change: number; changePct: number }>;
  onRefreshQuotes: () => void;
  isPolling: boolean;
  accountSize: number;
  riskPerTrade: number;
  currentUser?: { email: string; name: string } | null;
  activeTab?: NavigationTab;
  onNavigateTab?: (tab: NavigationTab) => void;
}
```

#### C. Segmented Tab Navigation Contract (`src/components/layout/TabNavigation.tsx`)
```typescript
export interface TabNavigationProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  counts: NavigationBadgeCounts;
  className?: string;
}
```

#### D. Responsive Mobile Navigation & Bottom Sheet Contracts
```typescript
export interface MobileNavProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  counts: NavigationBadgeCounts;
  onOpenAddTrade: () => void;
  onOpenQuickMenu: () => void;
}

export interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  maxHeight?: string; // default "max-h-[90vh]"
}
```

---

### 2.3 Component Architecture & Blueprints

#### 1. Header Blueprint (`src/components/layout/Header.tsx`)
- **Brand & Sleeve Quick-Pill (Left)**:
  - Gradient icon (`TrendingUp` with `from-sky-500 to-indigo-600`).
  - Title "Senior Broker".
  - Clickable capital pill: `$15,000 • 1% Risk` -> opens Settings/Allocation view.
  - Live pulse dot showing status.
- **Live Index Ribbon (Center - Hidden on Mobile, Visible on Desktop)**:
  - SPY price & % change (emerald for positive, rose for negative).
  - QQQ price & % change.
  - VIX volatility reading (sky blue accent).
  - Glass backdrop with `border-white/[0.08] bg-white/[0.03]`.
- **Desk Controls & Actions (Right)**:
  - "+ Add Position" primary button (Emerald, active scale effect).
  - "AI Research" quick button (White/Neutral).
  - Polling live dot / spin trigger with tooltip.
  - Notification bell with dynamic red count badge.
  - Settings slider button.
  - Desk Lock / Sign Out button with confirmation trigger.

#### 2. 6-View Pill Segmented Navigation (`src/components/layout/TabNavigation.tsx`)
- Encapsulates desktop/tablet floating pill bar with 6 views:
  1. **AI Coach Feed**: `Sparkles` icon (Sky accent) + High-urgency move badge.
  2. **Positions**: `TrendingUp` icon (Emerald accent) + Active count pill `(3)`.
  3. **AI Screener**: `Layers` icon (Indigo accent) + Candidate count pill.
  4. **Learning Center**: `GraduationCap` icon (Purple accent).
  5. **Trade Journal**: `BookOpen` icon (Amber accent).
  6. **Settings / Capital**: `Sliders` icon (Slate/Emerald accent).
- Seamless active pill transition (`bg-white text-neutral-900 shadow-xl font-semibold` vs inactive `text-neutral-400 hover:text-white`).

#### 3. Responsive Mobile Navigation (`src/components/layout/MobileNav.tsx`)
- Docked at screen bottom (`fixed bottom-0 left-0 right-0 z-40 sm:hidden`).
- Glassmorphic backdrop (`bg-[#070A0F]/95 backdrop-blur-2xl border-t border-white/[0.08] pb-safe`).
- 5 primary touch tabs + centered elevated "+" Action Button for fast 15-second trade logging.
- Compact badge counters.

#### 4. Slide-Over Bottom Sheet Modal Wrapper (`src/components/layout/MobileBottomSheet.tsx`)
- Reusable drawer container for Add Trade, Prompt Station, Settings, and "Why?" Coach Insights.
- Desktop: Centered glass modal (`max-w-xl rounded-3xl`).
- Mobile: Smooth slide-up sheet from bottom with drag indicator pill handle and `max-h-[92vh] overflow-y-auto`.

#### 5. Main View Container (`src/app/page.tsx`)
- Orchestrates view rendering based on `activeTab`:
  - `COACH` -> `<CoachFeed />` with prioritized tactical moves and 1-click execution.
  - `POSITIONS` -> `<ActiveTradesPanel />` with live 4-tier price ladders.
  - `SCREENER` -> `<RegimeBanner />` + `<MultiModelCompare />` (Gemini 3.7, Claude Sonnet 5, OpenAI 5.6).
  - `LEARNING` -> `<LearningCenter />` with 5 strategy lessons and interactive sizing calculator.
  - `JOURNAL` -> `<TradeJournal />` with cumulative P&L curve and discipline analytics.
  - `SETTINGS` -> `<SettingsView />` / dedicated capital allocation dashboard view.
- Persistent state preservation across tab switches.
- Top-level NotificationCenter, AddTradeModal, and ImportModal integration.

---

## 3. Caveats

1. **Read-Only Exploration Mandate**: In accordance with the Explorer archetype, no source files were directly rewritten during this turn. All component designs, interfaces, and CSS classes have been authored as drop-in blueprints for the implementer agent.
2. **Tailwind CSS v4 Configuration**: Next.js 16 uses Tailwind CSS v4 `@import "tailwindcss";` without legacy `tailwind.config.js` theme plugins. The proposed CSS utility classes and inline Tailwind tokens (`bg-[#070A0F]`, `border-white/[0.08]`, `backdrop-blur-2xl`) match the existing build setup cleanly.
3. **Client-Side Hydration & LocalStorage**: Components accessing `localStorage` or `window` must declare `"use client"` and guard local storage access inside `useEffect` or safe parse blocks to avoid hydration mismatch.

---

## 4. Conclusion

- The visual shell and navigation architecture for Senior Broker App Milestone 2 are completely mapped out and ready for implementation.
- The 6 core views are clearly delineated with distinct icons, color tokens, and badge metrics.
- The Public.com obsidian dark aesthetic (`#070A0F`, `#0E131F`, `#161D2F`, glassmorphism, pill badges, and hairline borders) provides a distraction-free trading desk experience.
- The proposed separation into `src/components/layout/TabNavigation.tsx`, `src/components/layout/MobileNav.tsx`, `src/components/layout/MobileBottomSheet.tsx`, and updated `src/components/layout/Header.tsx` will deliver modular, maintainable, and responsive UI foundations.

---

## 5. Verification Method

### 5.1 Automated Test Execution
Run the automated test runner:
```bash
npm test
```
**Expected Outcome**: All 28 test suites and 529 assertions pass with zero failures.

### 5.2 Specific File & Type Verification
1. Inspect `src/tests/tier1_features/t1_navigation_ui.test.ts` to confirm test coverage for all 6 `NavView` states, badge counter updates, and Public obsidian styling tokens.
2. Verify that `src/components/layout/` exports `Header`, `TabNavigation`, `MobileNav`, and `MobileBottomSheet`.
3. Verify Next.js build compilation:
```bash
npm run build
```
**Invalidation Condition**: If `npm test` or `npm run build` fails with TypeScript typing errors or missing layout exports.
