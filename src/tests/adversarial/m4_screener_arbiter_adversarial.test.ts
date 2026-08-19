// src/tests/adversarial/m4_screener_arbiter_adversarial.test.ts
// Adversarial Empirical Stress Tests for Milestone 4 (Multi-LLM Screener, Prompt Station & Arbiter Engine)
// Rigorously tests:
// 1. 5-Stage Parser resilience under malformed JSON, truncated HTML, empty strings, blacklist collisions, and multi-stage fallbacks
// 2. Multi-model consensus scoring, +5/+10 conviction bonus boundaries, score capping at 99.0, and risk-averse regime arbitration matrix
// 3. 1% Risk sizing math across $1k, $15k, $100k, and $1M account scales with extreme stop distances
// 4. Visual 4-tier price ladder invariants (Stop < Entry < Target 1 < Target 2), R-multiple precision, and defensive level repairs
// 5. Dynamic Prompt Station customizer with all strategy presets, model directives, and parameter scaling

import { describe, it, expect } from "../helpers/assertions";
import {
  parseReportContent,
  ParsedReport,
  ParsedCandidate,
  TICKER_BLACKLIST,
} from "../../lib/ai/parser";
import {
  synthesizeArbiterPlan,
  generate4TierPriceLadder,
  MasterArbiterPlan,
  MasterSetup,
  PriceLadderTier,
} from "../../lib/ai/arbiter";
import {
  SWING_TRADE_RESEARCH_PROMPT,
  ARBITER_SYNTHESIS_PROMPT,
  generateDeepResearchPrompt,
} from "../../lib/ai/prompts";

describe("Milestone 4 Adversarial Stress Suite: Screener, Prompts & Arbiter", () => {

  // =========================================================================
  // SUITE 1: 5-STAGE PARSER RESILIENCE & ADVERSARIAL INPUTS
  // =========================================================================
  describe("Suite 1: Parser Adversarial & Malformed Payload Handling", () => {
    it("handles null, empty, whitespace, and undefined-like strings without throwing", () => {
      const emptyOutputs = ["", "   ", "\n\t\r\n", "null", "undefined", "   \n\n   "];
      for (const input of emptyOutputs) {
        const parsed = parseReportContent(input, "Gemini");
        expect(parsed).toBeDefined();
        expect(parsed.marketRegime).toBe("FAVORABLE");
        expect(Array.isArray(parsed.candidates)).toBe(true);
        expect(parsed.candidates.length).toBe(0);
      }
    });

    it("recovers from truncated / malformed JSON code blocks and falls back cleanly", () => {
      const brokenJson = `
\`\`\`json
[
  {
    "ticker": "AAPL",
    "entryTrigger": 225.50,
    "stopLoss": 218.00,
    "target1": 240.00
`; // Unclosed JSON array and fence

      const parsed = parseReportContent(brokenJson, "OpenAI");
      // JSON.parse will fail, should fall back through table/blocks/catalog/regex
      expect(parsed).toBeDefined();
      expect(Array.isArray(parsed.candidates)).toBe(true);
    });

    it("parses valid JSON with atypical keys (e.g. 'symbol', 'entryPrice', 'stopReason')", () => {
      const atypicalJson = `
\`\`\`json
{
  "trades": [
    {
      "symbol": "SNOW",
      "name": "Snowflake Inc.",
      "setup": "Post-Earnings Gap",
      "entryPrice": 145.00,
      "stop": 138.50,
      "t1": 158.00,
      "t2": 170.00,
      "conviction": 92.5,
      "catalyst": "Consumption growth accelerated 30% YoY."
    }
  ]
}
\`\`\`
      `;
      const parsed = parseReportContent(atypicalJson, "Claude");
      expect(parsed.candidates).toHaveLength(1);
      const snow = parsed.candidates[0];
      expect(snow.ticker).toBe("SNOW");
      expect(snow.companyName).toBe("Snowflake Inc.");
      expect(snow.setupType).toBe("Post-Earnings Gap");
      expect(snow.entryTrigger).toBe(145.00);
      expect(snow.stopLoss).toBe(138.50);
      expect(snow.target1).toBe(158.00);
      expect(snow.target2).toBe(170.00);
      expect(snow.score).toBe(92.5);
      expect(snow.catalystSummary).toContain("Consumption growth");
    });

    it("filters all non-ticker blacklist tokens across table and regex parsing", () => {
      // Create noisy markdown table where column values or fake tickers use blacklisted words
      const blacklistTable = `
| Ticker | Setup | Entry | Stop | Target 1 | Target 2 | Score |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BUY | Breakout | $100 | $95 | $110 | $120 | 85.0 |
| SELL | Breakdown | $100 | $95 | $110 | $120 | 85.0 |
| STOP | Gap | $100 | $95 | $110 | $120 | 85.0 |
| SPY | Trend | $550 | $540 | $570 | $590 | 85.0 |
| QQQ | Tech | $480 | $470 | $500 | $520 | 85.0 |
| FOMC | Event | $100 | $95 | $110 | $120 | 85.0 |
| NVDA | Momentum | $130 | $124 | $142 | $155 | 92.0 |
      `;
      const parsed = parseReportContent(blacklistTable, "Gemini");
      expect(parsed.candidates).toHaveLength(1);
      expect(parsed.candidates[0].ticker).toBe("NVDA");

      // Verify blacklist set has no leaks
      for (const token of TICKER_BLACKLIST) {
        expect(parsed.candidates.some(c => c.ticker === token)).toBe(false);
      }
    });

    it("falls through from broken Stage 1 to Stage 2 Markdown Table", () => {
      const content = `
Here is malformed json:
\`\`\`json
{ "invalid": [
\`\`\`

Here is the actual research table:
| Ticker | Setup | Entry | Stop | Target 1 | Target 2 | Score | Catalyst |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PLTR | AI Platform Breakout | $32.50 | $30.00 | $37.50 | $42.00 | 91.0 | AIP bootcamps expanding commercial revenue |
      `;
      const parsed = parseReportContent(content, "ChatGPT");
      expect(parsed.candidates).toHaveLength(1);
      expect(parsed.candidates[0].ticker).toBe("PLTR");
      expect(parsed.candidates[0].entryTrigger).toBe(32.50);
      expect(parsed.candidates[0].stopLoss).toBe(30.00);
      expect(parsed.candidates[0].target1).toBe(37.50);
    });

    it("falls through from Stage 2 to Stage 3 Block-by-Block Headings", () => {
      const content = `
### Candidate 1: PANW
- Setup: Base Breakout above 50DMA
- Entry Trigger: $360.00 on volume confirmation
- Stop Loss: $342.00 below structural pivot
- Target 1: $396.00 (2:1 R:R)
- Target 2: $425.00
- Catalyst: Platformization deal sizes +40% YoY
- Bear Case: Slower enterprise firewall upgrade cycles
- Score: 89.5
      `;
      const parsed = parseReportContent(content, "Claude");
      expect(parsed.candidates).toHaveLength(1);
      const panw = parsed.candidates[0];
      expect(panw.ticker).toBe("PANW");
      expect(panw.entryTrigger).toBe(360.00);
      expect(panw.stopLoss).toBe(342.00);
      expect(panw.target1).toBe(396.00);
      expect(panw.score).toBe(89.5);
    });

    it("falls through to Stage 4 Realistic Pattern Catalog when text mentions catalog tickers", () => {
      const content = "We recommend looking closely at ATRO and MTRN after recent quarterly beats.";
      const parsed = parseReportContent(content, "Gemini");
      expect(parsed.candidates.length).toBeGreaterThanOrEqual(2);
      expect(parsed.candidates.some(c => c.ticker === "ATRO")).toBe(true);
      expect(parsed.candidates.some(c => c.ticker === "MTRN")).toBe(true);
    });

    it("falls through to Stage 5 Generic Regex Sniffer when unknown tickers are mentioned with dollar prices", () => {
      const content = "Strong momentum observed in CRWD $295.50 and HUBS $580.00 with clean volume.";
      const parsed = parseReportContent(content, "OpenAI");
      expect(parsed.candidates.length).toBeGreaterThanOrEqual(2);
      expect(parsed.candidates.some(c => c.ticker === "CRWD")).toBe(true);
      expect(parsed.candidates.some(c => c.ticker === "HUBS")).toBe(true);
    });

    it("extracts and clamps long HTML fragments for regime notes and macro flags", () => {
      const longHtml = `
<section id="regime">
  <p>${"Market breadth expanding nicely across all sectors. ".repeat(20)}</p>
</section>
<div class="macro">
  ${"CPI report due on Wednesday, followed by PPI on Thursday and FOMC rate decision. ".repeat(10)}
</div>
      `;
      const parsed = parseReportContent(longHtml, "Claude");
      expect(parsed.regimeNotes.length).toBeLessThanOrEqual(400);
      expect(parsed.macroFlags.length).toBeLessThanOrEqual(300);
      expect(parsed.regimeNotes).toContain("Market breadth expanding");
      expect(parsed.macroFlags).toContain("CPI report due");
    });
  });

  // =========================================================================
  // SUITE 2: CONSENSUS ARBITER & REGIME VOTING MATRIX
  // =========================================================================
  describe("Suite 2: Multi-Model Consensus Scoring & Regime Arbitration Matrix", () => {
    it("handles 0 reports gracefully", () => {
      const plan = synthesizeArbiterPlan(undefined, undefined, undefined, 15000, 1.0);
      expect(plan.marketRegime).toBe("FAVORABLE");
      expect(plan.masterSetups).toHaveLength(0);
      expect(plan.allCandidates).toHaveLength(0);
      expect(plan.consensusHighlight).toContain("Diversified");
    });

    it("handles 1 single model report with zero consensus bonus", () => {
      const report: ParsedReport = {
        marketRegime: "FAVORABLE",
        regimeNotes: "Solid uptrend",
        macroFlags: "None",
        candidates: [
          {
            ticker: "ATRO",
            companyName: "Astronics",
            setupType: "Breakout",
            entryTrigger: 89.20,
            entryCondition: "Buy pivot",
            stopLoss: 83.75,
            stopRationale: "Below low",
            target1: 100.10,
            target2: 112.00,
            rrRatio: 2.0,
            timeStopDays: 5,
            positionShares: 27,
            riskAmount: 147.15,
            catalystDate: "Aug 11",
            catalystSummary: "Record sales",
            bearCase: "Overhead supply",
            score: 91.8,
            modelSource: "Gemini",
          },
        ],
      };

      const plan = synthesizeArbiterPlan(report, undefined, undefined, 15000, 1.0);
      expect(plan.masterSetups).toHaveLength(1);
      const setup = plan.masterSetups[0];
      expect(setup.consensusCount).toBe(1);
      expect(setup.isConsensusPick).toBe(false);
      expect(setup.modelsAgreed).toEqual(["Gemini"]);
      expect(setup.score).toBe(91.8); // No bonus
    });

    it("awards exactly +5.0 consensus bonus for 2 agreeing models", () => {
      const r1: ParsedReport = {
        marketRegime: "FAVORABLE",
        regimeNotes: "Bullish",
        macroFlags: "None",
        candidates: [
          {
            ticker: "NVDA",
            companyName: "NVIDIA",
            setupType: "Breakout",
            entryTrigger: 130.00,
            entryCondition: "Pivot",
            stopLoss: 123.50,
            stopRationale: "EMA",
            target1: 143.00,
            target2: 155.00,
            rrRatio: 2.0,
            timeStopDays: 5,
            positionShares: 23,
            riskAmount: 149.50,
            catalystDate: "Aug",
            catalystSummary: "AI GPU demand",
            bearCase: "Valuation",
            score: 90.0,
            modelSource: "Gemini",
          },
        ],
      };
      const r2: ParsedReport = {
        marketRegime: "FAVORABLE",
        regimeNotes: "Bullish",
        macroFlags: "None",
        candidates: [
          { ...r1.candidates[0], modelSource: "Claude" },
        ],
      };

      const plan = synthesizeArbiterPlan(r1, r2, undefined, 15000, 1.0);
      expect(plan.masterSetups).toHaveLength(1);
      const setup = plan.masterSetups[0];
      expect(setup.consensusCount).toBe(2);
      expect(setup.isConsensusPick).toBe(true);
      expect(setup.modelsAgreed).toContain("Gemini");
      expect(setup.modelsAgreed).toContain("Claude");
      expect(setup.score).toBe(95.0); // 90.0 + 5.0 = 95.0
    });

    it("awards exactly +10.0 consensus bonus for 3 agreeing models", () => {
      const makeReport = (model: string): ParsedReport => ({
        marketRegime: "FAVORABLE",
        regimeNotes: "Bullish",
        macroFlags: "None",
        candidates: [
          {
            ticker: "NVDA",
            companyName: "NVIDIA",
            setupType: "Breakout",
            entryTrigger: 130.00,
            entryCondition: "Pivot",
            stopLoss: 123.50,
            stopRationale: "EMA",
            target1: 143.00,
            target2: 155.00,
            rrRatio: 2.0,
            timeStopDays: 5,
            positionShares: 23,
            riskAmount: 149.50,
            catalystDate: "Aug",
            catalystSummary: "AI GPU demand",
            bearCase: "Valuation",
            score: 88.0,
            modelSource: model,
          },
        ],
      });

      const plan = synthesizeArbiterPlan(makeReport("Gemini"), makeReport("Claude"), makeReport("ChatGPT"), 15000, 1.0);
      expect(plan.masterSetups).toHaveLength(1);
      const setup = plan.masterSetups[0];
      expect(setup.consensusCount).toBe(3);
      expect(setup.isConsensusPick).toBe(true);
      expect(setup.modelsAgreed).toHaveLength(3);
      expect(setup.score).toBe(98.0); // 88.0 + 10.0 = 98.0
    });

    it("strictly clamps composite conviction score at 99.0 maximum ceiling", () => {
      const makeHighReport = (model: string): ParsedReport => ({
        marketRegime: "FAVORABLE",
        regimeNotes: "Bullish",
        macroFlags: "None",
        candidates: [
          {
            ticker: "TOP1",
            companyName: "Top One Corp",
            setupType: "Breakout",
            entryTrigger: 100.0,
            entryCondition: "Break",
            stopLoss: 95.0,
            stopRationale: "Base",
            target1: 110.0,
            target2: 120.0,
            rrRatio: 2.0,
            timeStopDays: 5,
            positionShares: 30,
            riskAmount: 150.0,
            catalystDate: "Aug",
            catalystSummary: "Massive beat",
            bearCase: "Macro",
            score: 97.5,
            modelSource: model,
          },
        ],
      });

      // 97.5 + 5.0 = 102.5 -> clamped to 99.0
      const plan2 = synthesizeArbiterPlan(makeHighReport("Gemini"), makeHighReport("Claude"), undefined, 15000, 1.0);
      expect(plan2.masterSetups[0].score).toBe(99.0);

      // 97.5 + 10.0 = 107.5 -> clamped to 99.0
      const plan3 = synthesizeArbiterPlan(makeHighReport("Gemini"), makeHighReport("Claude"), makeHighReport("ChatGPT"), 15000, 1.0);
      expect(plan3.masterSetups[0].score).toBe(99.0);
    });

    it("executes the complete Risk-Averse Regime Consensus Matrix across all 9 permutations", () => {
      const makeRep = (regime: "FAVORABLE" | "NEUTRAL" | "HOSTILE", name: string): ParsedReport => ({
        marketRegime: regime,
        regimeNotes: regime,
        macroFlags: regime,
        candidates: [],
      });

      // 1. [HOSTILE, HOSTILE, HOSTILE] -> HOSTILE (hostileCount >= 2)
      expect(synthesizeArbiterPlan(makeRep("HOSTILE", "1"), makeRep("HOSTILE", "2"), makeRep("HOSTILE", "3")).marketRegime).toBe("HOSTILE");

      // 2. [HOSTILE, HOSTILE, FAVORABLE] -> HOSTILE (hostileCount >= 2)
      expect(synthesizeArbiterPlan(makeRep("HOSTILE", "1"), makeRep("HOSTILE", "2"), makeRep("FAVORABLE", "3")).marketRegime).toBe("HOSTILE");

      // 3. [HOSTILE, HOSTILE, NEUTRAL] -> HOSTILE (hostileCount >= 2)
      expect(synthesizeArbiterPlan(makeRep("HOSTILE", "1"), makeRep("HOSTILE", "2"), makeRep("NEUTRAL", "3")).marketRegime).toBe("HOSTILE");

      // 4. [HOSTILE, NEUTRAL, NEUTRAL] -> NEUTRAL (neutralCount >= 2)
      expect(synthesizeArbiterPlan(makeRep("HOSTILE", "1"), makeRep("NEUTRAL", "2"), makeRep("NEUTRAL", "3")).marketRegime).toBe("NEUTRAL");

      // 5. [HOSTILE, NEUTRAL, FAVORABLE] -> NEUTRAL (hostileCount === 1 && neutralCount >= 1 -> risk averse tie breaker)
      expect(synthesizeArbiterPlan(makeRep("HOSTILE", "1"), makeRep("NEUTRAL", "2"), makeRep("FAVORABLE", "3")).marketRegime).toBe("NEUTRAL");

      // 6. [HOSTILE, FAVORABLE, FAVORABLE] -> FAVORABLE (hostileCount=1, neutralCount=0, favorableCount=2)
      expect(synthesizeArbiterPlan(makeRep("HOSTILE", "1"), makeRep("FAVORABLE", "2"), makeRep("FAVORABLE", "3")).marketRegime).toBe("FAVORABLE");

      // 7. [NEUTRAL, NEUTRAL, FAVORABLE] -> NEUTRAL (neutralCount >= 2)
      expect(synthesizeArbiterPlan(makeRep("NEUTRAL", "1"), makeRep("NEUTRAL", "2"), makeRep("FAVORABLE", "3")).marketRegime).toBe("NEUTRAL");

      // 8. [NEUTRAL, FAVORABLE, FAVORABLE] -> FAVORABLE (neutralCount=1, favorableCount=2)
      expect(synthesizeArbiterPlan(makeRep("NEUTRAL", "1"), makeRep("FAVORABLE", "2"), makeRep("FAVORABLE", "3")).marketRegime).toBe("FAVORABLE");

      // 9. [FAVORABLE, FAVORABLE, FAVORABLE] -> FAVORABLE (favorableCount=3)
      expect(synthesizeArbiterPlan(makeRep("FAVORABLE", "1"), makeRep("FAVORABLE", "2"), makeRep("FAVORABLE", "3")).marketRegime).toBe("FAVORABLE");
    });

    it("guarantees consensus picks always precede single-model picks in master ranking", () => {
      const r1: ParsedReport = {
        marketRegime: "FAVORABLE",
        regimeNotes: "",
        macroFlags: "",
        candidates: [
          { ticker: "SOLO_HIGH", companyName: "S", setupType: "B", entryTrigger: 100, entryCondition: "C", stopLoss: 95, stopRationale: "R", target1: 110, target2: 120, rrRatio: 2.0, timeStopDays: 5, positionShares: 10, riskAmount: 50, catalystDate: "D", catalystSummary: "C", bearCase: "B", score: 98.0, modelSource: "M1" },
          { ticker: "CONS_LOW", companyName: "C", setupType: "B", entryTrigger: 50, entryCondition: "C", stopLoss: 48, stopRationale: "R", target1: 54, target2: 58, rrRatio: 2.0, timeStopDays: 5, positionShares: 10, riskAmount: 50, catalystDate: "D", catalystSummary: "C", bearCase: "B", score: 75.0, modelSource: "M1" },
        ],
      };
      const r2: ParsedReport = {
        marketRegime: "FAVORABLE",
        regimeNotes: "",
        macroFlags: "",
        candidates: [
          { ...r1.candidates[1], modelSource: "M2" }, // CONS_LOW gets consensus
        ],
      };

      const plan = synthesizeArbiterPlan(r1, r2, undefined, 15000, 1.0);
      expect(plan.masterSetups[0].ticker).toBe("CONS_LOW");
      expect(plan.masterSetups[0].isConsensusPick).toBe(true);
      expect(plan.masterSetups[1].ticker).toBe("SOLO_HIGH");
      expect(plan.masterSetups[1].isConsensusPick).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 3: 1% RISK SIZING MATH ACROSS MULTI-TIER ACCOUNT SCALES
  // =========================================================================
  describe("Suite 3: 1% Risk Sizing Math Across Account Scales ($1k, $15k, $100k, $1M)", () => {
    const candidateBase: ParsedCandidate = {
      ticker: "ATRO",
      companyName: "Astronics Corporation",
      setupType: "Base Breakout",
      entryTrigger: 89.20,
      entryCondition: "Buy pivot",
      stopLoss: 83.75, // Risk per share = $5.45
      stopRationale: "Gap low",
      target1: 100.10,
      target2: 112.00,
      rrRatio: 2.0,
      timeStopDays: 5,
      positionShares: 27,
      riskAmount: 147.15,
      catalystDate: "Aug 11",
      catalystSummary: "Record sales",
      bearCase: "Overhead supply",
      score: 91.8,
      modelSource: "Gemini",
    };

    const makeSingleReport = (cand: ParsedCandidate): ParsedReport => ({
      marketRegime: "FAVORABLE",
      regimeNotes: "",
      macroFlags: "",
      candidates: [cand],
    });

    it("computes 1% risk math for Small Account ($1,000 capital, $10 risk budget)", () => {
      // Risk budget = $10.00. Risk/sh = $5.45.
      // Shares = max(1, floor(10 / 5.45)) = 1 share.
      // Normalized risk = 1 * 5.45 = $5.45.
      // Allocated capital = 1 * 89.20 = $89.20.
      // Actual risk pct = (5.45 / 1000) * 100 = 0.545%
      const plan = synthesizeArbiterPlan(makeSingleReport(candidateBase), undefined, undefined, 1000.0, 1.0);
      const setup = plan.masterSetups[0];

      expect(setup.normalizedShares).toBe(1);
      expect(setup.normalizedRisk).toBe(5.45);
      expect(setup.allocatedCapital).toBe(89.20);
      expect(setup.actualRiskPct).toBe(0.545);
    });

    it("computes 1% risk math for Default Account ($15,000 capital, $150 risk budget)", () => {
      // Risk budget = $150.00. Risk/sh = $5.45.
      // Shares = floor(150 / 5.45) = 27 shares.
      // Normalized risk = 27 * 5.45 = $147.15.
      // Allocated capital = 27 * 89.20 = $2,408.40.
      // Actual risk pct = (147.15 / 15000) * 100 = 0.981%
      const plan = synthesizeArbiterPlan(makeSingleReport(candidateBase), undefined, undefined, 15000.0, 1.0);
      const setup = plan.masterSetups[0];

      expect(setup.normalizedShares).toBe(27);
      expect(setup.normalizedRisk).toBe(147.15);
      expect(setup.allocatedCapital).toBe(2408.40);
      expect(setup.actualRiskPct).toBe(0.981);
    });

    it("computes 1% risk math for Large Account ($100,000 capital, $1,000 risk budget)", () => {
      // Risk budget = $1,000.00. Risk/sh = $5.45.
      // Shares = floor(1000 / 5.45) = 183 shares.
      // Normalized risk = 183 * 5.45 = $997.35.
      // Allocated capital = 183 * 89.20 = $16,323.60.
      // Actual risk pct = (997.35 / 100000) * 100 = 0.9974%
      const plan = synthesizeArbiterPlan(makeSingleReport(candidateBase), undefined, undefined, 100000.0, 1.0);
      const setup = plan.masterSetups[0];

      expect(setup.normalizedShares).toBe(183);
      expect(setup.normalizedRisk).toBe(997.35);
      expect(setup.allocatedCapital).toBe(16323.60);
      expect(setup.actualRiskPct).toBe(0.9974);
    });

    it("computes 1% risk math for Ultra-Large Account ($1,000,000 capital, $10,000 risk budget)", () => {
      // Risk budget = $10,000.00. Risk/sh = $5.45.
      // Shares = floor(10000 / 5.45) = 1834 shares.
      // Normalized risk = 1834 * 5.45 = $9,995.30.
      // Allocated capital = 1834 * 89.20 = $163,592.80.
      // Actual risk pct = (9995.30 / 1000000) * 100 = 0.9995%
      const plan = synthesizeArbiterPlan(makeSingleReport(candidateBase), undefined, undefined, 1000000.0, 1.0);
      const setup = plan.masterSetups[0];

      expect(setup.normalizedShares).toBe(1834);
      expect(setup.normalizedRisk).toBe(9995.30);
      expect(setup.allocatedCapital).toBe(163592.80);
      expect(setup.actualRiskPct).toBe(0.9995);
    });

    it("handles extreme sub-cent tight stop distance ($0.01) defensively without dividing by zero", () => {
      const tightCandidate: ParsedCandidate = {
        ...candidateBase,
        entryTrigger: 100.00,
        stopLoss: 99.999, // delta near 0
      };

      const plan = synthesizeArbiterPlan(makeSingleReport(tightCandidate), undefined, undefined, 15000.0, 1.0);
      const setup = plan.masterSetups[0];
      expect(setup.normalizedShares).toBeGreaterThan(0);
      expect(Number.isFinite(setup.normalizedShares)).toBe(true);
      expect(Number.isFinite(setup.normalizedRisk)).toBe(true);
    });

    it("handles inverted prices where stop > entry defensively using absolute distance", () => {
      const invertedCandidate: ParsedCandidate = {
        ...candidateBase,
        entryTrigger: 50.00,
        stopLoss: 55.00, // Inverted
      };

      const plan = synthesizeArbiterPlan(makeSingleReport(invertedCandidate), undefined, undefined, 15000.0, 1.0);
      const setup = plan.masterSetups[0];
      // |50 - 55| = 5.0. 150 / 5 = 30 shares
      expect(setup.normalizedShares).toBe(30);
      expect(setup.normalizedRisk).toBe(150.00);
    });
  });

  // =========================================================================
  // SUITE 4: PRICE LADDER LEVEL MATH & INVARIANTS
  // =========================================================================
  describe("Suite 4: Visual 4-Tier Price Ladder Math & Invariants", () => {
    it("strictly enforces Stop < Entry < Target 1 < Target 2 on generated levels", () => {
      const ladder = generate4TierPriceLadder(89.20, 83.75, 100.10, 112.00);

      const target2 = ladder.find(l => l.levelName === "TARGET_2")!;
      const target1 = ladder.find(l => l.levelName === "TARGET_1")!;
      const entry = ladder.find(l => l.levelName === "ENTRY")!;
      const stop = ladder.find(l => l.levelName === "STOP_LOSS")!;

      expect(target2).toBeDefined();
      expect(target1).toBeDefined();
      expect(entry).toBeDefined();
      expect(stop).toBeDefined();

      expect(stop.price).toBeLessThan(entry.price);
      expect(entry.price).toBeLessThan(target1.price);
      expect(target1.price).toBeLessThan(target2.price);
    });

    it("calculates exact R-multiples and distance percentages", () => {
      // Entry 100, Stop 95 (Risk = 5). T1 = 110 (+2.0R, +10%), T2 = 120 (+4.0R, +20%)
      const ladder = generate4TierPriceLadder(100.0, 95.0, 110.0, 120.0);

      const t2 = ladder[0];
      const t1 = ladder[1];
      const e = ladder[2];
      const s = ladder[3];

      expect(t2.rMultiple).toBe(4.0);
      expect(t2.distancePct).toBe(20.0);
      expect(t2.actionLabel).toBe("Sell Remaining 50%");

      expect(t1.rMultiple).toBe(2.0);
      expect(t1.distancePct).toBe(10.0);
      expect(t1.actionLabel).toBe("Scale 50% & Ratchet B/E");

      expect(e.rMultiple).toBe(0.0);
      expect(e.distancePct).toBe(0.0);
      expect(e.actionLabel).toBe("Execution Pivot");

      expect(s.rMultiple).toBe(-1.0);
      expect(s.distancePct).toBe(-5.0);
      expect(s.actionLabel).toBe("Invalidation Cut");
    });

    it("normalizes candidates with missing/invalid stop and target prices in parser Stage 6", () => {
      const invalidCandidate: any = {
        ticker: "TEST",
        companyName: "Test Corp",
        setupType: "Breakout",
        entryTrigger: 100.0,
        stopLoss: 105.0, // Invalid: stop >= entry
        target1: 90.0,   // Invalid: t1 <= entry
        target2: 95.0,   // Invalid: t2 <= t1
        score: 110.0,    // Invalid: score > 99
      };

      const jsonStr = `\`\`\`json\n[${JSON.stringify(invalidCandidate)}]\n\`\`\``;
      const parsed = parseReportContent(jsonStr, "Gemini");
      expect(parsed.candidates).toHaveLength(1);
      const normalized = parsed.candidates[0];

      // Stop should have been repaired to entry * 0.95 = 95.0
      expect(normalized.stopLoss).toBe(95.0);
      expect(normalized.stopLoss).toBeLessThan(normalized.entryTrigger);

      // T1 should have been repaired to entry + 2.0 * risk = 100 + 2*(5) = 110.0
      expect(normalized.target1).toBe(110.0);
      expect(normalized.target1).toBeGreaterThan(normalized.entryTrigger);

      // T2 should have been repaired to entry + 3.5 * risk = 100 + 3.5*(5) = 117.5
      expect(normalized.target2).toBe(117.5);
      expect(normalized.target2).toBeGreaterThan(normalized.target1);

      // Score clamped to <= 99.0
      expect(normalized.score).toBe(99.0);
    });
  });

  // =========================================================================
  // SUITE 5: PROMPT STATION CUSTOMIZER & STRATEGY PRESETS
  // =========================================================================
  describe("Suite 5: Dynamic Prompt Station & Customizer Options", () => {
    it("generates prompt with all 4 strategy presets accurately", () => {
      const pMomentum = generateDeepResearchPrompt({ strategyStyle: "MOMENTUM_BREAKOUT" });
      expect(pMomentum).toContain("Prioritize high-relative-strength momentum breakouts");

      const pPead = generateDeepResearchPrompt({ strategyStyle: "PEAD_CONTINUATION" });
      expect(pPead).toContain("Post-Earnings Announcement Drift (PEAD)");

      const pPullback = generateDeepResearchPrompt({ strategyStyle: "FIRST_PULLBACK" });
      expect(pPullback).toContain("Prioritize first pullbacks to rising 20-day EMA");

      const pHighTight = generateDeepResearchPrompt({ strategyStyle: "HIGH_TIGHT_FLAG" });
      expect(pHighTight).toContain("Prioritize high-tight flags holding within upper 20%");
    });

    it("generates model-specific directives for Gemini, Claude, and OpenAI", () => {
      const pGemini = generateDeepResearchPrompt({ targetModel: "gemini" });
      expect(pGemini).toContain("Format output with clear markdown headings, bold ticker symbols");

      const pClaude = generateDeepResearchPrompt({ targetModel: "claude" });
      expect(pClaude).toContain("Provide institutional-grade depth with rigorous macro regime evaluation");

      const pOpenai = generateDeepResearchPrompt({ targetModel: "openai" });
      expect(pOpenai).toContain("Deliver mathematically precise level specifications");
    });

    it("accurately substitutes custom capital and risk percentages", () => {
      const pCustom = generateDeepResearchPrompt({ accountSize: 250000, riskPercent: 0.75 });
      expect(pCustom).toContain("$250,000");
      expect(pCustom).toContain("0.8%"); // 0.75 toFixed(1) = 0.8%
      expect(pCustom).toContain("$1875.00 max risk"); // 250,000 * 0.0075 = $1,875.00
    });

    it("always embeds 4 mandatory research steps, macro hazard calendar, and liquidity filters", () => {
      const prompt = generateDeepResearchPrompt();
      expect(prompt).toContain("Step 1 — Market Regime Check");
      expect(prompt).toContain("Step 2 — Screening Universe & Liquidity Filters");
      expect(prompt).toContain("Step 3 — Research Requirements Per Candidate Setup");
      expect(prompt).toContain("Step 4 — Weighted Selection & Scoring Rubric");
      expect(prompt).toContain("Macro Hazard Calendar: Scheduled high-impact macro events");
      expect(prompt).toContain("Average Daily Volume (ADV) > 1,000,000");
      expect(prompt).toContain("NO confirmed earnings report inside the expected holding window");
    });
  });
});
