// src/app/api/research/sample/route.ts
// Sample Research API Endpoint
// Supplies rich, calibrated multi-model research reports and synthesized Master Arbiter Plan for instant demo and offline testing

import { NextResponse } from "next/server";
import { parseReportContent } from "@/lib/ai/parser";
import { synthesizeArbiterPlan } from "@/lib/ai/arbiter";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountSize = parseFloat(searchParams.get("accountSize") || "15000.0");
    const riskPercent = parseFloat(searchParams.get("riskPercent") || "1.0");

    const geminiRaw = `
# Gemini 3.7 Flash — Swing Research Intelligence
## Step 1: Market Regime Check
- Indices: SPY and QQQ trading firmly above rising 20-day EMA and 50-day SMA.
- Breadth: 64.8% of NYSE/NASDAQ stocks above 50-day moving average.
- Volatility: VIX at 15.12, reflecting constructive risk-on environment.
- Macro Hazard: CPI cleared; PPI scheduled Thursday and FOMC minutes next week.
- **Verdict: FAVORABLE**

## Step 3: Top 3 Swing Setups
### 1. ATRO (Astronics Corporation)
- **Pattern:** Fresh Earnings Gap / Base Breakout from 5-week base.
- **Entry Trigger:** $89.20 (Buy-stop on 30-min hold above $88.72 pivot)
- **Stop Loss:** $83.75 (Below $85 gap-open support and catalyst base low)
- **Target 1:** $100.10 (>= 2.0:1 R:R)
- **Target 2:** $112.00 (>= 4.0:1 R:R runner)
- **Catalyst:** Record Q2 sales $260M (+27% YoY), $306M bookings, raised FY26 guidance to $1.02B–$1.04B.
- **Bear Case:** Intraday fade from $92.49 high shows overhead supply; failure below $85 can retrace to mid-$70s.
- **Score:** 91.8

### 2. CRWV (CoreWeave Inc.)
- **Pattern:** Catalyst Continuation Gap above consolidation.
- **Entry Trigger:** $92.00
- **Stop Loss:** $79.00
- **Target 1:** $110.00
- **Target 2:** $130.00
- **Catalyst:** Q2 revenue $2.575B (+112% YoY), backlog grew to $104B (+25B new contracts).
- **Bear Case:** High debt load, still net unprofitable, high intraday extension.
- **Score:** 83.0

### 3. HALO (Halozyme Therapeutics)
- **Pattern:** Post-Earnings Pullback to 20-day EMA.
- **Entry Trigger:** $97.00
- **Stop Loss:** $85.00
- **Target 1:** $110.00
- **Target 2:** $120.00
- **Catalyst:** Q2 rev $481M (+48% YoY), EPS $2.28 vs $1.82, raised FY26 guidance, $333M buyback.
- **Bear Case:** Extended +34% over 90 days, elevated debt-to-capital (~90%).
- **Score:** 80.0
`;

    const claudeRaw = `
<section id="regime">
  <h2>Claude Sonnet 5 Institutional Regime Analysis</h2>
  <p><strong>Verdict: FAVORABLE</strong></p>
  <p>SPY and QQQ exhibiting sustained institutional accumulation. Advance/decline breadth remains strong at 63.2%. VIX remains pinned near 14.80. Macro hazards include PPI and FOMC minutes.</p>
  <div class="macro">PPI print Thursday, FOMC Minutes Aug 19. Maintain strict 1% risk allocation.</div>
</section>

### Candidate 1: MTRN (Materion Corporation)
- **Pattern:** Post-Earnings First Pullback / Bull Flag
- **Entry Trigger:** $282.00
- **Stop Loss:** $270.50
- **Target 1:** $305.00
- **Target 2:** $328.00
- **Catalyst:** Q2 sales $613.9M, adjusted EPS $1.90 vs $1.37, backlog up ~30% YoY, raised full year outlook.
- **Bear Case:** Materials sector as a whole is not leading; 30% gap could act as exhaustion if $271.75 breaks.
- **Score:** 93.1

### Candidate 2: ATRO (Astronics Corporation)
- **Pattern:** Fresh Earnings Gap / Base Breakout
- **Entry Trigger:** $89.20
- **Stop Loss:** $83.75
- **Target 1:** $100.10
- **Target 2:** $112.00
- **Catalyst:** Record Q2 sales $260M (+27% YoY), $306M bookings, raised FY26 guidance.
- **Bear Case:** Intraday fade from $92.49 high shows overhead supply.
- **Score:** 91.8

### Candidate 3: LITE (Lumentum Holdings)
- **Pattern:** Catalyst-Day Gap-and-Go over High
- **Entry Trigger:** $951.00
- **Stop Loss:** $898.50
- **Target 1:** $1056.00
- **Target 2:** $1085.50
- **Catalyst:** Q4 revenue $1.006B (+109% YoY), strong AI guidance, supported by $2B NVIDIA strategic investment.
- **Bear Case:** High nominal share price ($940+), significant overhead supply near $1,085.
- **Score:** 88.4
`;

    const chatgptRaw = `
# OpenAI 5.6 Proprietary Desk Intelligence
## Regime: FAVORABLE
Indices in confirmed uptrend above 20D EMA. Low volatility (VIX 15.28).

| Ticker | Setup Type | Entry Trigger | Stop Loss | Target 1 | Target 2 | Catalyst | Bear Case | Score |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| GLBE | Post-Earnings PEAD | $42.60 | $40.20 | $48.00 | $52.00 | Q2 GMV surged 44% to $2.09B; raised FY26 revenue guide | Macro consumer softness | 92.0 |
| NIQ | High-Tight Flag | $16.25 | $14.90 | $19.20 | $21.50 | 5th consecutive quarter beat & raise | +42% single day move | 88.0 |
| ATRO | Base Breakout | $89.20 | $83.75 | $100.10 | $112.00 | Record Q2 sales $260M (+27% YoY) | Intraday fade from high | 91.8 |
`;

    const geminiParsed = parseReportContent(geminiRaw, "Gemini 3.7 Flash");
    const claudeParsed = parseReportContent(claudeRaw, "Claude Sonnet 5");
    const chatgptParsed = parseReportContent(chatgptRaw, "OpenAI 5.6");

    const arbiterPlan = synthesizeArbiterPlan(
      geminiParsed,
      claudeParsed,
      chatgptParsed,
      accountSize,
      riskPercent
    );

    return NextResponse.json({
      success: true,
      arbiterPlan,
      sampleReports: [
        { modelSource: "Gemini 3.7 Flash", rawText: geminiRaw, parsed: geminiParsed },
        { modelSource: "Claude Sonnet 5", rawText: claudeRaw, parsed: claudeParsed },
        { modelSource: "OpenAI 5.6", rawText: chatgptRaw, parsed: chatgptParsed },
      ],
    });
  } catch (error) {
    console.error("Error in /api/research/sample:", error);
    return NextResponse.json({ error: "Failed to generate sample research" }, { status: 500 });
  }
}
