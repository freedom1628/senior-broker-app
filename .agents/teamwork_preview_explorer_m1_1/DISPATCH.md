## 2026-08-19T20:46:57Z
You are Explorer 1 for Milestone 1 (M1: Core Domain & Dual-Layer Persistence).
Your working directory: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\teamwork_preview_explorer_m1_1
Parent Orchestrator ID: 30038885-cde3-4272-8f01-569f4d0d2fd1

Scope documents to read:
- ORIGINAL_REQUEST.md: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\ORIGINAL_REQUEST.md
- PROJECT.md: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\PROJECT.md
- SCOPE.md: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\self_sub_orch_m1\SCOPE.md

Your Task:
Investigate and produce an architectural and technical blueprint for:
1. Auto Position Sizer (`src/lib/portfolio/sizing-calculator.ts`):
   - 1% Account Risk model ($150 risk on $15,000 baseline capital, configurable)
   - Max share calculation given Entry and Stop Loss: Shares = AccountRisk / (Entry - StopLoss)
   - Cash buffer constraints, buying power limits, margin checks
   - ATR-based sizing adjustments if stop loss not explicitly provided
2. Trade Management Rule Engine (`src/lib/market/rule-engine.ts`):
   - Target 1 scale: 50% position reduction at Target 1 with automatic stop move to Break-Even (Entry Price)
   - Target 2 runner management: trailing stop (e.g. 21 EMA / swing low / ATR trailing)
   - Hard stop invalidation trigger
   - Time-stop rule: Invalidation/exit trigger after 5-7 sessions of stagnant momentum
   - Portfolio Sleeve limits: Max 3 open concurrent swing trades per sleeve, max 3.0% combined sleeve risk
   - Sector Concentration Limiter: Max 2 concurrent positions in the same sector

Write your findings to `analysis.md` in your working directory and summarize in `handoff.md`.
Communicate back via send_message to recipient 30038885-cde3-4272-8f01-569f4d0d2fd1.
