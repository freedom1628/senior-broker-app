# Original User Request

## Initial Request — 2026-08-19T20:41:23Z

# Teamwork Project Prompt — Swing Trading Coach & Investor Education Overhaul

A consumer-grade AI Swing Trading Coach, Portfolio Intelligence, and Investor Learning web application inspired by Public.com, designed specifically for managing a dedicated swing trading sleeve ($15,000 default / <1% of total portfolio) with position tracking, historical trade logging, tactical move coaching, multi-LLM daily opportunity screening, and interactive investor education.

Working directory: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app
Integrity mode: development

## Requirements

### R1. Public.com-Inspired Minimalist Consumer UI/UX & Summary Dashboard
A clean, premium, and distraction-free user experience tailored for fast mobile and desktop interactions:
- High-level Portfolio Summary Card displaying Total Dedicated Swing Capital ($15,000 default), Allocated Capital, Cash Available, Open Risk ($ and %), and Floating P&L with clean interactive sparklines/charts.
- Section navigation with dedicated focused views: Coach Feed & Summary, Active Positions & Ladders, AI Opportunity Screener, Investor Learning Center, Trade History & Analytics, and Settings / Capital Allocation.
- Large modern typography, smooth bottom sheets / slide-over panels for logging trades, and zero cognitive clutter.

### R2. Dedicated Swing Sleeve Position & History Manager
A streamlined system for managing active swing trades and closed campaign history:
- Fast position logger with 1-click 1% account risk auto-sizer ($150 risk per trade on $15k capital).
- Real-time tracking of entry price, current price, shares, hard stop loss, Target 1 (50% scale), Target 2 (runner), holding days, and trade thesis.
- Closed trade journal with Win Rate %, Total Realized P&L, Profit Factor, Average R-Multiple, and interactive P&L curve.

### R3. Proactive AI Swing Trading Coach & 1-Click Tactical Actions
An intelligent rules and coaching engine that continuously checks active positions against market data:
- 1-Click Tactical Actions: Instant buttons on cards to execute "Scale 50% & Move Stop to Breakeven", "Update Trailing Stop", or "Exit Stale Position".
- Morning & Mid-Day Tactical Briefings: Clear actionable summaries of required moves for the day with 1-click copy for notes.
- Rule Enforcement: Strict alerts when positions violate the 1% risk rule, reach 5–7 sessions without follow-through (time stop), or exceed the 3% total sleeve risk cap.
- Audible Chimes & Push Alerts: Web Audio chimes for target reaches and low stop warnings.

### R4. Multi-LLM Opportunity Screening & Arbiter Engine
A daily research hub leveraging the latest frontier models (Google Gemini 3.7 Flash, Claude Sonnet 5/Opus/Fable, OpenAI 5.6/o3):
- 1-Click Prompt Station: Copies the standardized deep research prompt formatted for web search chats.
- Multi-Model Consensus Arbiter: Analyzes and cross-references candidate tickers across models, scoring conviction and rendering visual price ladders with risk/reward metrics.

### R5. Interactive Investor Education & Concept Learning Center
A dedicated teaching module with contextual coach tips that helps the user grow as an investor:
- Core Strategy Lessons: Visual interactive guides on (1) The 1% Risk Formula, (2) Asymmetric 2:1 R:R & Target Scaling, (3) Time Stops vs Price Stops, (4) Sector Concentration & Sleeve Caps, and (5) Market Regime Identification.
- Contextual "Why?" Coach Insights: Every recommendation from the coach includes a "Why this move?" expandable breakdown explaining the institutional reasoning behind the rule.
- Interactive Sizing & Scenario Calculator: Practice tool for testing stop loss placements and position sizes before placing orders.

### R6. Frictionless Authentication & Cloudflare Web Deployment
- Dual-mode authentication: 4-digit PIN / Desk Passcode for instant access, plus Google OAuth support.
- Fully compatible with Cloudflare Workers / Pages edge runtime with dual-layer database and client-side persistence so user data is never lost.

## Acceptance Criteria

### Visual Design & Experience
- [ ] Interface follows Public.com's clean aesthetic with modern cards, pill badges, and smooth mobile bottom sheets.
- [ ] Dashboard displays the dedicated swing capital ($15,000 default), active risk, and cash balance clearly at the top.
- [ ] Seamless responsive behavior across mobile browsers (iOS Safari / Android Chrome PWA) and desktop.

### Position Management, Coaching & Education
- [ ] Adding an active position or historical trade takes under 15 seconds with automated 1% position sizing.
- [ ] The AI Coach delivers real-time recommendations (Hold, Scale 50% to B/E, Time-Stop Exit, Stop Invalidation).
- [ ] 1-click buttons allow users to scale 50% and automatically adjust the stop loss to Breakeven.
- [ ] Investor Learning Center offers interactive lessons, sizing calculators, and contextual "Why?" coaching tips.
- [ ] Closed trades populate the Trade History with accurate Win Rate % and R-multiple tracking.

### Research & System Integrity
- [ ] Ingests or generates research from Gemini 3.7, Claude Sonnet 5/Opus/Fable, and OpenAI 5.6.
- [ ] Builds with zero errors (npm run build) and deploys cleanly to Cloudflare.
- [ ] Dual-layer data persistence ensures positions and settings remain preserved across sessions.
