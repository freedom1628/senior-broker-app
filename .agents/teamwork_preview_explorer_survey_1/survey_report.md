# Senior Broker App — Codebase Survey & Repository Inventory Report

**Date:** August 19, 2026  
**Investigator:** Explorer 1 (Project Survey Team)  
**Workspace Root:** `C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app`  
**Build Status:** Clean build verified (`npm run build` exits code 0, 12 static/dynamic pages compiled, TypeScript 0 errors).

---

## 1. Executive Summary

The `senior-broker-app` repository is a consumer-grade, high-performance Next.js 16 (App Router with Turbopack) application written in TypeScript and styled with Tailwind CSS v4. It implements an AI Swing Trading Coach and Risk Management Desk inspired by Public.com, designed for retail and semi-institutional traders managing dedicated swing trading sleeves.

The application contains an existing, functional foundation spanning authentication, portfolio risk rules, multi-LLM research parsing and arbitration (Gemini 3.7 Flash, Claude Sonnet 5/Opus/Fable, OpenAI 5.6/o3), active position tracking, 1-click tactical execution (e.g. 50% scale + breakeven stop), Web Audio API sound synthesis, dual-layer edge persistence, and Cloudflare Pages deployment readiness.

---

## 2. Technology Stack & Tooling

| Layer | Technologies & Packages | Version / Configuration |
|---|---|---|
| **Framework** | Next.js (App Router, Turbopack) | `16.3.1` |
| **Language** | TypeScript | `^5.0` (Strict mode) |
| **UI & Styling** | React, React DOM, Tailwind CSS v4, Lucide React, Canvas Confetti, Recharts, clsx, tailwind-merge | React `19.2.8`, Tailwind `@tailwindcss/postcss` `^4`, Lucide `^1.33.0`, Recharts `^3.10.1` |
| **Database & ORM** | Prisma Client, SQLite, Universal MemoryStore Edge Adapter | Prisma `^7.9.1`, `@prisma/client` `^7.9.1`, better-sqlite3 `^13.0.3` |
| **Edge & Cloud Deployment** | Cloudflare Pages / Workers via OpenNext | `@opennextjs/cloudflare` `^1.20.2`, `wrangler` `^4.124.0`, `open-next.config.ts`, `wrangler.jsonc` |
| **AI SDKs** | Google GenAI, Anthropic SDK, OpenAI SDK | `@google/genai` `^2.17.1`, `@anthropic-ai/sdk` `^0.119.0`, `openai` `^7.5.0` |
| **Audio Synthesis** | Apple-style Web Audio API Oscillator synthesizer | Native Web Audio API (`src/lib/audio/sound-effects.ts`) |
| **Authentication** | NextAuth.js + Custom Desk PIN / Google OAuth Gate | `next-auth` `^4.24.15` |

---

## 3. Codebase File Structure & Inventory

```
senior-broker-app/
├── package.json               # Dependencies, build scripts (dev, build, cf:build, cf:deploy)
├── tsconfig.json              # Path aliases (@/* -> ./src/*), strict TypeScript
├── next.config.ts             # Next.js configuration
├── open-next.config.ts        # OpenNext Cloudflare edge wrapper config
├── wrangler.jsonc             # Cloudflare Pages / Workers deployment manifest
├── prisma.config.ts           # Prisma config loader
├── prisma/
│   └── schema.prisma          # Models: User, ResearchRun, CandidateSetup, Trade, MarketQuote, AlertNotification
├── public/                    # Static assets, icons, manifest
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout with dark mode, viewport, PWA headers
│   │   ├── globals.css        # Tailwind v4 import & custom Apple scrollbars
│   │   ├── page.tsx           # Main App Container (Auth Gate, Tab Nav, Real-time Polling, Modals)
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts     # Credentials + Google OAuth NextAuth route
│   │       ├── market/poll/route.ts            # Real-time trigger evaluation & auto-alert generator
│   │       ├── market/quotes/route.ts          # Market quotes with micro-drift simulation & static anchors
│   │       ├── notifications/route.ts          # Notification retrieval & mark-all-read
│   │       ├── portfolio/daily-report/route.ts # Daily moves, aggregate risk, sector balance, checklist
│   │       ├── research/current/route.ts       # Latest research run & candidates
│   │       ├── research/run/route.ts           # Automated & manual Multi-LLM research engine
│   │       ├── trades/route.ts                 # Full Trade CRUD + Lifecycle Actions (Scale T1, Close, Stop)
│   │       └── user/settings/route.ts          # Account size, risk per trade %, LLM API keys
│   ├── components/
│   │   ├── auth/
│   │   │   └── SignInView.tsx                  # Public.com glassmorphism auth gate (Google + PIN)
│   │   ├── layout/
│   │   │   └── Header.tsx                      # Top nav, live SPY/QQQ/VIX ticker ribbon, action buttons
│   │   └── dashboard/
│   │       ├── ActiveTradesPanel.tsx           # Open positions, execution levels, time stops, 1-click moves
│   │       ├── AddTradeModal.tsx               # Position logger with 1-click 1% risk auto-sizer
│   │       ├── DailyReportPanel.tsx            # Prioritized daily moves briefing with 1-click clipboard copy
│   │       ├── ExecutiveTable.tsx              # Summary matrix of screened candidate setups
│   │       ├── ImportModal.tsx                 # Multi-AI model research runner, prompt copier, transcript importer
│   │       ├── MultiModelCompare.tsx           # Model segmented pills & consensus filtering
│   │       ├── NotificationCenter.tsx          # Slide-over alert drawer with audio chime tests
│   │       ├── PriceLadder.tsx                 # Visual execution ladder (T2, T1, Entry, Stop Loss)
│   │       ├── RegimeBanner.tsx                # Market regime status (Favorable/Neutral/Hostile) & macro risks
│   │       ├── SettingsModal.tsx               # Capital, risk %, and AI key config
│   │       ├── SetupCard.tsx                   # Candidate setup card with catalyst, bear case, score
│   │       └── TradeJournal.tsx                # Closed trade audit log with Win Rate %, Realized P&L, R-multiples
│   └── lib/
│       ├── prisma.ts                           # Universal MemoryStore / Prisma edge client
│       ├── seed-data.ts                        # Pre-seeded sample trades (ATRO, GLBE, MTRN, TWLO), runs, notifications
│       ├── auth.ts                             # NextAuth options & credentials provider
│       ├── audio/
│       │   └── sound-effects.ts                # Pure Web Audio harmonic chimes (T1, Stop Warning, Entry ping)
│       ├── market/
│       │   ├── quotes.ts                       # Quote cache with drift simulator (SPY, QQQ, VIX, candidates)
│       │   └── rule-engine.ts                  # Trade rules evaluator (T1 hit, Stop loss invalidation, Time stop)
│       ├── portfolio/
│       │   └── daily-report.ts                 # Action item prioritization & sector diversification logic
│       ├── notifications/
│       │   └── notification-service.ts         # Push notification trigger + audio dispatcher
│       └── ai/
│           ├── prompts.ts                      # Standardized Deep Research & Arbiter prompts
│           ├── runners.ts                      # Gemini 3.7, Claude Sonnet 5/Opus/Fable, OpenAI 5.6 runners
│           ├── parser.ts                       # HTML/text report regex parser into structured setups
│           └── arbiter.ts                      # CIO / Arbiter synthesis engine, consensus scoring, 1% risk normalizer
```

---

## 4. Requirements Traceability & Gap Analysis

Based on `ORIGINAL_REQUEST.md`:

| Requirement | Current Status | Analysis & Next Steps |
|---|---|---|
| **R1: Public.com-Inspired UI/UX & Summary Dashboard** | 🟡 Largely Present / Needs Enhancement | - Clean dark glass aesthetic, pill segmented controls, responsive layout are in place.<br>- Needs: Default capital should default to **$15,000** (currently set to $10,000 in a few default initializers).<br>- Needs: Integrated Top Portfolio Summary Card with interactive equity sparkline / P&L chart (`recharts` is installed).<br>- Needs: Dedicated tab navigation including the new **Investor Learning Center**. |
| **R2: Dedicated Swing Sleeve Position & History Manager** | 🟢 Fully Functional | - Fast position logger with 1-click 1% account risk auto-sizer ($150 risk on $15k capital).<br>- Real-time tracking of entry, current price, shares, hard stop, Target 1, Target 2, holding days, thesis.<br>- Closed trade journal with Win Rate %, Realized P&L, R-multiple.<br>- Opportunity: Add Profit Factor calculation and visual cumulative P&L equity curve chart. |
| **R3: Proactive AI Swing Trading Coach & 1-Click Tactical Actions** | 🟢 Fully Functional | - 1-Click Tactical Actions: "Scale 50% & Move Stop to Breakeven", "Adjust Stop", "Close Position".<br>- Morning / Mid-Day Tactical Briefings with 1-click clipboard copy.<br>- Strict rule enforcement (1% risk, 5-7 session time stop warnings, 3% total sleeve risk cap).<br>- Web Audio chimes for target reaches, stop warnings, and entry triggers. |
| **R4: Multi-LLM Opportunity Screening & Arbiter Engine** | 🟢 Fully Functional | - Multi-LLM research hub configured for Google Gemini 3.7 Flash, Claude Sonnet 5 / Opus / Fable, and OpenAI 5.6 / o3.<br>- 1-Click Prompt Station with standardized deep research prompt.<br>- Multi-Model Consensus Arbiter scoring conviction and rendering visual price ladders. |
| **R5: Interactive Investor Education & Concept Learning Center** | 🔴 Not Yet Implemented | - **High-Priority Gap**:<br>  1. Core Strategy Lessons with interactive visual modules: (1) The 1% Risk Formula, (2) Asymmetric 2:1 R:R & Target Scaling, (3) Time Stops vs Price Stops, (4) Sector Concentration & Sleeve Caps, (5) Market Regime Identification.<br>  2. Contextual "Why?" Coach Insights: Expandable drawer / tooltip on coach recommendations explaining institutional rationale.<br>  3. Interactive Sizing & Scenario Practice Calculator for testing stops and sizing before placing orders. |
| **R6: Dual Authentication & Cloudflare Deployment** | 🟢 Fully Functional | - Dual-mode auth: 4-digit PIN / Desk Passcode + Google OAuth.<br>- Dual-layer data persistence (MemoryStore Edge DB + LocalStorage custom position vault).<br>- Fully configured for Cloudflare Pages / Workers via OpenNext. |

---

## 5. Build, Lint & Runtime Verification

1. **Compilation (`npm run build`)**:  
   - Generated Prisma Client v7.9.1.
   - Next.js 16.3.1 Turbopack build succeeded with 0 errors in 14.5 seconds.
   - TypeScript check passed with 0 type errors.
   - Static pages generated: 12/12.
2. **Dependencies**:  
   - All necessary packages (`recharts`, `lucide-react`, `canvas-confetti`, `@anthropic-ai/sdk`, `@google/genai`, `openai`, `@opennextjs/cloudflare`) are already installed in `node_modules` with matching lockfile.
   - No missing packages or broken dependencies detected.

---

## 6. Recommendations for Next Milestones

1. **Implement R5: Investor Learning Center Component & Tab**:
   - Create `src/components/dashboard/LearningCenter.tsx` with the 5 interactive core lessons, interactive scenario practice tool, and institutional concept guides.
   - Add "Investor Learning Center" to the main segmented pill navigation tab bar in `src/app/page.tsx`.
2. **Embed Contextual "Why?" Coach Explanations**:
   - Add expandable accordion / drawer explaining the institutional reasoning behind each daily move in `DailyReportPanel.tsx` and `ActiveTradesPanel.tsx`.
3. **Harmonize Default Capital to $15,000 ($150 Risk / Trade)**:
   - Update default account size from $10,000 to $15,000 across `prisma.ts`, `auth.ts`, `seed-data.ts`, `SettingsModal.tsx`, and `PriceLadder.tsx`.
4. **Enrich Summary Dashboard with Recharts P&L / Equity Sparkline**:
   - Embed an interactive performance chart in the top summary card and Trade Journal.
