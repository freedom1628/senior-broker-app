// Standardized Institutional Swing Trading Deep Research Prompts
// Formatted for Frontier Reasoning LLMs: Gemini 3.7 Flash, Claude Sonnet 5/Opus/Fable, OpenAI 5.6/o3

import { PromptCustomizerOptions } from "./types";

export const SWING_TRADE_RESEARCH_PROMPT = `# Swing Trade Deep Research Prompt — Sector-Agnostic, Long-Only Shares

Act as a senior swing-trading strategist at a proprietary trading desk. Your task is to research current market conditions and identify the **top 3 swing trade opportunities** — long-only, shares-only, any sector — and deliver findings as a **single, polished, self-contained HTML report**. Every recommendation must be a complete trade plan, not just a stock pick: a trade without a defined entry, stop, and target is not a trade.

## Trader Profile (fixed constraints)
- **Direction:** Long only. No shorts, no options.
- **Holding window:** 3 days to 4 weeks. The setup dictates the exit, not the calendar.
- **Setup styles:** (a) Momentum/breakouts — stocks emerging from consolidation bases on expanding volume; (b) Catalyst continuation — stocks with a fresh, confirmed positive catalyst (earnings beat + raised guidance, major contract, FDA approval, analyst upgrade cycle, sector rotation) in the early innings of their post-catalyst move. Do NOT recommend holding through an upcoming binary event.
- **Risk rule:** Assume 1% of account risked per trade. Every pick must specify position size math off the stop distance.

## Step 1 — Market Regime Check (do this FIRST, report it prominently)
Assess whether conditions favor long swing trades:
- Trend of SPY and QQQ vs. their 20-day and 50-day moving averages
- Recent breadth (advance/decline behavior, % of stocks above 50-day MA)
- Volatility regime (VIX level and direction)
- Major scheduled macro events in the next 2 weeks (FOMC, CPI, PPI, jobs report)
State a verdict: **Favorable / Neutral / Hostile**.

## Step 2 — Screening Universe
Only consider stocks meeting ALL of:
- Exchange: NYSE or NASDAQ only
- Price: Above $5
- Liquidity: Average daily dollar volume above $20M
- Volatility: ATR of at least ~2% of price
- Earnings: NO confirmed earnings report inside the expected holding window.
- No active going-concern, delisting, fraud investigation, or halted status.

## Step 3 — Research Requirements Per Candidate
For every candidate:
1. The setup pattern & volume confirmation.
2. Relative strength vs SPY over 1 and 3 months.
3. The catalyst with exact date and primary source verification.
4. The crowd: Short interest, days-to-cover, institutional ownership, distance above 50-day MA.
5. Mandatory Trade Plan: Entry trigger, Hard Stop, Target 1, Target 2, Risk/Reward (>= 2:1 to T1), Time Stop (session count), Position Size math for $10,000 account at 1% risk.
6. The honest Bear Case.

## Step 4 — Weighted Rubric & Selection
- Setup quality & volume confirmation (30%)
- Relative strength (25%)
- Risk/reward >= 2:1 (20%)
- Catalyst durability (15%)
- Liquidity & clean exit (10%)
`;

export const ARBITER_SYNTHESIS_PROMPT = `Act as Chief Investment Officer and Senior Risk Arbiter at a proprietary trading desk.
You are given swing trade research reports produced by multiple AI models (Gemini, Claude, ChatGPT).

Your objectives:
1. Reconcile market regime assessments into a single authoritative Desk Regime Verdict (Favorable / Neutral / Hostile) with macro risks.
2. Identify consensus tickers (stocks recommended by 2 or more models, e.g. ATRO) vs high-conviction independent picks.
3. Validate and normalize the exact trade levels for each finalist:
   - Entry Trigger (Condition & Price)
   - Hard Stop Loss
   - Target 1 & Target 2
   - Risk/Reward to T1 (must be >= 2.0:1)
   - Time Stop (sessions)
   - Position Sizing Math for $10,000 account risking exactly 1% ($100 risk)
4. Score each setup out of 100 based on composite conviction.
5. Return the result strictly in valid JSON format matching the schema provided.`;

/**
 * Dynamically generates a customized 4-step research prompt based on user parameters.
 */
export function generateDeepResearchPrompt(options: PromptCustomizerOptions = {}): string {
  const accountSize = options.accountSize || 15000;
  const riskPercent = options.riskPercent || 1.0;
  const dollarRisk = (accountSize * (riskPercent / 100)).toFixed(2);
  const strategyStyle = options.strategyStyle || "ALL";
  const targetModel = options.targetModel || "all";

  let strategyCustomization = "";
  if (strategyStyle === "MOMENTUM_BREAKOUT") {
    strategyCustomization = `\n- **Focus Strategy:** Prioritize high-relative-strength momentum breakouts from >3-week consolidation bases with volume expansion >1.5x 50-day average. Holding window: 3 to 5 sessions.`;
  } else if (strategyStyle === "PEAD_CONTINUATION") {
    strategyCustomization = `\n- **Focus Strategy:** Prioritize Post-Earnings Announcement Drift (PEAD) setups with recent beat-and-raise quarterly reports, expanding margins, and minimum 10-day earnings clearance. Holding window: 5 to 7 sessions.`;
  } else if (strategyStyle === "FIRST_PULLBACK") {
    strategyCustomization = `\n- **Focus Strategy:** Prioritize first pullbacks to rising 20-day EMA on decreasing volume following an initial catalyst expansion. Minimum 2.5:1 R:R to Target 1.`;
  } else if (strategyStyle === "HIGH_TIGHT_FLAG") {
    strategyCustomization = `\n- **Focus Strategy:** Prioritize high-tight flags holding within upper 20% of range with low float (<50M shares) and high ATR (>3.5%).`;
  }

  let modelDirective = "";
  if (targetModel === "gemini") {
    modelDirective = `\n**Target Model Directive:** Format output with clear markdown headings, bold ticker symbols (e.g. **ATRO**), and complete parameter values.`;
  } else if (targetModel === "claude") {
    modelDirective = `\n**Target Model Directive:** Provide institutional-grade depth with rigorous macro regime evaluation, explicit catalyst dates, and comprehensive bear case invalidation scenarios.`;
  } else if (targetModel === "openai") {
    modelDirective = `\n**Target Model Directive:** Deliver mathematically precise level specifications, concise catalyst summaries, and an embedded structured markdown table or JSON block.`;
  }

  return `# Swing Trade Deep Research Prompt — Sector-Agnostic, Long-Only Shares

Act as a senior swing-trading strategist at a proprietary trading desk. Your task is to research current live market conditions and identify the **top 3 swing trade opportunities** — long-only, shares-only, any sector — and deliver findings as a **single, polished, self-contained HTML report**. Every recommendation must be a complete trade plan, not just a stock pick: a trade without a defined entry, stop, and target is not a trade.

## Trader Profile (Fixed Desk Constraints)
- **Direction:** Long only. No shorts, no options, no leveraged margin.
- **Holding window:** 3 days to 4 weeks (3 to 7 trading sessions typical). The technical setup dictates the exit, not the calendar.
- **Setup styles:** (a) Momentum / Base Breakouts; (b) Post-Earnings Catalyst Continuation (PEAD); (c) First Pullback to 20D EMA; (d) High-Tight Flags. Do NOT recommend holding through an upcoming binary event.${strategyCustomization}
- **Risk Rule:** Strict ${riskPercent.toFixed(1)}% account risk per trade ($${dollarRisk} risk on $${accountSize.toLocaleString()} dedicated capital). Every setup must specify exact share sizing derived from the stop distance.${modelDirective}

## Step 1 — Market Regime Check (Do this FIRST, report it prominently)
Assess whether macro and broad market conditions favor long swing trades:
- Trend of SPY and QQQ vs. their 20-day EMA and 50-day SMA.
- Market Breadth: % of stocks above 50-day SMA (>60% favorable, <40% hostile), Net Advance/Decline line.
- Volatility Regime: CBOE VIX level (<18 favorable, 18–24 neutral, >25 hostile) and short-term trajectory.
- Macro Hazard Calendar: Scheduled high-impact macro events within the next 14 days (FOMC rate decisions/minutes, CPI, PPI, Core PCE, Non-Farm Payrolls).
- State an authoritative verdict: **Favorable / Neutral / Hostile**.

## Step 2 — Screening Universe & Liquidity Filters
Only consider stocks meeting ALL of the following criteria:
- **Exchange:** NYSE or NASDAQ only (strictly zero OTC / pink sheets / penny stocks).
- **Price:** Above $5.00 per share.
- **Liquidity:** Average Daily Volume (ADV) > 1,000,000 shares OR Average Daily Dollar Volume (ADDV) > $20,000,000.
- **Volatility Expansion:** 14-day Average True Range (ATR) of at least ~2.0% of share price.
- **Earnings Calendar Rule:** NO confirmed earnings report inside the expected holding window (minimum 10 trading days clearance).
- **Solvency:** No active going-concern warnings, delisting notices, SEC fraud investigations, or halted trading status.

## Step 3 — Research Requirements Per Candidate Setup
For each of the top 3 candidate setups, provide the complete dossier:
1. **Technical Pattern & Volume Confirmation:** Base structure, breakout pivot, and volume expansion ratio (>1.5x 50-day average).
2. **Relative Strength (RS):** 1-month and 3-month RS performance vs. SPY / QQQ benchmark.
3. **Fundamental Catalyst:** Exact announcement date, primary source verification (SEC 8-K, 10-Q, official press release), and headline metrics.
4. **Market Structure & Positioning:** Short interest (% of float), Days-to-Cover (DTC), Institutional ownership %, Distance above 50-day SMA.
5. **Mandatory 5-Point Trade Plan:**
   - **Entry Trigger:** Exact price and trigger condition (e.g., "Buy-stop on 30-min candle close above pivot").
   - **Hard Invalidation Stop:** Exact price and technical rationale.
   - **Target 1 (T1):** Exact price delivering >= 2.0:1 Reward-to-Risk (Take 50% profit and ratchet stop to Breakeven).
   - **Target 2 (T2):** Exact price delivering >= 3.5:1 Reward-to-Risk (Runner exit).
   - **Time Stop Limit:** Maximum sessions (3 to 7 sessions) before liquidating stagnant positions.
   - **Position Sizing Math:** For $${accountSize.toLocaleString()} account risking ${riskPercent.toFixed(1)}% ($${dollarRisk} max risk):
     - Risk Per Share = Entry Trigger - Hard Stop
     - Position Shares = floor($${dollarRisk} / Risk Per Share)
     - Total Position Capital = Position Shares * Entry Trigger
6. **The Honest Bear Case:** Top 2-3 specific structural failure modes.

## Step 4 — Weighted Selection & Scoring Rubric (100-Point Scale)
- **Setup Quality & Base Cleanliness (30%):** Tight consolidation, clear resistance, volume surge.
- **Relative Strength vs. SPY/QQQ (25%):** Making new relative highs while market consolidates.
- **Asymmetric Risk/Reward >= 2:1 (20%):** Mathematical R:R to Target 1 >= 2.0:1.
- **Catalyst Durability (15%):** Secular multi-quarter driver vs. one-off headline noise.
- **Liquidity & Clean Exit (10%):** Tight bid/ask spread, institutional sponsorship.
`;
}
