// Tier 2 Boundary Value Analysis: Multi-LLM Arbiter, Parser Resilience, Price Ladders & Promotion
// Covers:
// - Feature 22: Multi-LLM Frontier Ingestion (Gemini 3.7 Flash, Claude Sonnet 5, OpenAI 5.6/ChatGPT)
// - Feature 23: 1-Click Research Prompt Station (prompt generation, parameter substitution, macro hazard inclusion)
// - Feature 24: Multi-Model Consensus Arbiter (0, 1, 2, 3 models, regime consensus, score capping at 99.0, sorting)
// - Feature 25: Visual 4-Tier Price Ladders (T2, T1, Entry, Stop levels, percentage distances, R:R ratios)
// - Feature 26: 1-Click Candidate Promotion (transferring screener setups to active/pending trades with 1% risk math)

import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade } from "../helpers/mock-storage";
import { parseReportContent, ParsedReport, ParsedCandidate } from "../../lib/ai/parser";
import { synthesizeArbiterPlan, MasterSetup } from "../../lib/ai/arbiter";
import { SWING_TRADE_RESEARCH_PROMPT, ARBITER_SYNTHESIS_PROMPT } from "../../lib/ai/prompts";

// Visual 4-Tier Price Ladder Calculation Engine (Feature 25 contract)
export interface PriceLadderTier {
  levelName: "TARGET_2" | "TARGET_1" | "ENTRY" | "STOP_LOSS";
  price: number;
  distancePct: number;
  rMultiple: number;
  label: string;
}

export function generate4TierPriceLadder(
  entry: number,
  stop: number,
  target1: number,
  target2: number
): PriceLadderTier[] {
  const riskPerShare = Math.max(0.01, Math.abs(entry - stop));

  const t2Dist = Number((((target2 - entry) / entry) * 100).toFixed(2));
  const t1Dist = Number((((target1 - entry) / entry) * 100).toFixed(2));
  const stopDist = Number((((stop - entry) / entry) * 100).toFixed(2));

  const t2R = Number(((target2 - entry) / riskPerShare).toFixed(2));
  const t1R = Number(((target1 - entry) / riskPerShare).toFixed(2));

  return [
    { levelName: "TARGET_2", price: target2, distancePct: t2Dist, rMultiple: t2R, label: `Target 2 (Runner +${t2R}R)` },
    { levelName: "TARGET_1", price: target1, distancePct: t1Dist, rMultiple: t1R, label: `Target 1 (Scale 50% +${t1R}R)` },
    { levelName: "ENTRY", price: entry, distancePct: 0.0, rMultiple: 0.0, label: `Entry Trigger ($${entry.toFixed(2)})` },
    { levelName: "STOP_LOSS", price: stop, distancePct: stopDist, rMultiple: -1.0, label: `Hard Stop Loss (-1.0R)` },
  ];
}

// 1-Click Candidate Promotion Helper (Feature 26 contract)
export function promoteCandidateToTrade(
  candidate: MasterSetup | ParsedCandidate,
  targetStatus: "ACTIVE" | "PENDING_ENTRY",
  accountSize: number = 15000.0,
  riskPct: number = 1.0
): StoredTrade {
  const riskBudget = accountSize * (riskPct / 100);
  const riskPerShare = Math.max(0.01, Math.abs(candidate.entryTrigger - candidate.stopLoss));
  const shares = Math.max(1, Math.floor(riskBudget / riskPerShare));

  return {
    id: `promoted_${candidate.ticker}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ticker: candidate.ticker,
    companyName: candidate.companyName,
    status: targetStatus,
    setupType: candidate.setupType,
    entryTrigger: candidate.entryTrigger,
    actualEntry: targetStatus === "ACTIVE" ? candidate.entryTrigger : undefined,
    entryDate: targetStatus === "ACTIVE" ? new Date().toISOString() : undefined,
    sharesTotal: shares,
    sharesRemaining: shares,
    initialStop: candidate.stopLoss,
    currentStop: candidate.stopLoss,
    target1: candidate.target1,
    target2: candidate.target2,
    rrRatio: candidate.rrRatio,
    timeStopSessions: candidate.timeStopDays || 5,
    sessionsElapsed: 0,
    notes: `${candidate.catalystSummary || ""} | Bear case: ${candidate.bearCase || "None"}`,
  };
}

describe("Tier 2: Multi-LLM Arbiter & Screener Boundary Tests", () => {
  let storage: MockDualLayerStorage;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
  });

  describe("Feature 22 & 23: Parser Resilience & Research Prompt Station Edge Cases", () => {
    it("handles completely empty report content string safely", () => {
      const parsed = parseReportContent("", "Gemini");
      expect(parsed.marketRegime).toBe("FAVORABLE");
      expect(parsed.candidates).toHaveLength(0);
      expect(parsed.rawHtml).toBe("");
    });

    it("parses report with malformed and unclosed HTML tags", () => {
      const noisyContent = `
        <div><h2>Market Regime Check</h2><p>VIX rising to 22. Indices below 50DMA. Neutral conditions.</p>
        <div><span>ATRO</span> $89.20 <span>Breakout</div>
      `;
      const parsed = parseReportContent(noisyContent, "Claude");
      expect(parsed.marketRegime).toBe("NEUTRAL");
      expect(parsed.candidates.length).toBeGreaterThanOrEqual(1);
      expect(parsed.candidates[0].ticker).toBe("ATRO");
    });

    it("parses market regime correctly when conflicting keywords appear", () => {
      const content = "SPY is currently in a HOSTILE trend despite favorable earnings.";
      const parsed = parseReportContent(content, "ChatGPT");
      expect(parsed.marketRegime).toBe("HOSTILE");
    });

    it("extracts long macro flags paragraph and clamps cleanly without throwing", () => {
      const longMacro = "Macro flags: " + "A".repeat(500);
      const parsed = parseReportContent(longMacro, "Gemini");
      expect(parsed.macroFlags.length).toBeLessThanOrEqual(300);
    });

    it("extracts unknown ticker symbols via generic regex when predefined patterns miss", () => {
      const genericReport = "Top candidate is XYZW trading at $45.50 with strong volume.";
      const parsed = parseReportContent(genericReport, "Gemini");
      expect(parsed.candidates.length).toBeGreaterThanOrEqual(1);
      expect(parsed.candidates[0].ticker).toBe("XYZW");
      expect(parsed.candidates[0].entryTrigger).toBe(100.0);
    });

    it("assigns modelSource metadata to every parsed candidate setup", () => {
      const parsed = parseReportContent("ATRO MTRN GLBE favorable", "Claude Sonnet 5");
      expect(parsed.candidates.length).toBeGreaterThanOrEqual(2);
      parsed.candidates.forEach(c => {
        expect(c.modelSource).toBe("Claude Sonnet 5");
      });
    });

    it("validates that SWING_TRADE_RESEARCH_PROMPT contains all 4 mandatory steps", () => {
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Step 1 — Market Regime Check");
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Step 2 — Screening Universe");
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Step 3 — Research Requirements");
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Step 4 — Weighted Rubric & Selection");
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("1% of account risked per trade");
    });

    it("validates that ARBITER_SYNTHESIS_PROMPT specifies multi-model reconciliation rules", () => {
      expect(ARBITER_SYNTHESIS_PROMPT).toContain("Gemini, Claude, ChatGPT");
      expect(ARBITER_SYNTHESIS_PROMPT).toContain("consensus tickers");
      expect(ARBITER_SYNTHESIS_PROMPT).toContain("Risk/Reward to T1 (must be >= 2.0:1)");
    });

    it("handles custom account sizes in prompt station parameter substitution", () => {
      const customPrompt = SWING_TRADE_RESEARCH_PROMPT.replace("$10,000", "$15,000");
      expect(customPrompt).toContain("$15,000");
    });
  });

  describe("Feature 24: Multi-Model Consensus Scoring & Regime Arbiter Boundaries", () => {
    it("handles 0 models provided returning empty master setups array", () => {
      const plan = synthesizeArbiterPlan(undefined, undefined, undefined, 15000, 1.0);
      expect(plan.masterSetups).toHaveLength(0);
      expect(plan.marketRegime).toBe("FAVORABLE");
      expect(plan.allCandidates).toHaveLength(0);
    });

    it("handles 1 single model (e.g. Gemini only) with zero consensus bonus", () => {
      const geminiReport = parseReportContent("ATRO MTRN favorable", "Gemini");
      const plan = synthesizeArbiterPlan(geminiReport, undefined, undefined, 15000, 1.0);

      expect(plan.masterSetups.length).toBeGreaterThan(0);
      plan.masterSetups.forEach(setup => {
        expect(setup.consensusCount).toBe(1);
        expect(setup.isConsensusPick).toBe(false);
      });
    });

    it("awards exactly +5.0 consensus bonus points for 2 agreeing models (e.g. Gemini + Claude)", () => {
      const geminiReport = parseReportContent("ATRO favorable", "Gemini");
      const claudeReport = parseReportContent("ATRO favorable", "Claude");

      const plan = synthesizeArbiterPlan(geminiReport, claudeReport, undefined, 15000, 1.0);
      const atro = plan.masterSetups.find(s => s.ticker === "ATRO");

      expect(atro).toBeDefined();
      expect(atro?.consensusCount).toBe(2);
      expect(atro?.isConsensusPick).toBe(true);
      expect(atro?.modelsAgreed).toContain("Gemini");
      expect(atro?.modelsAgreed).toContain("Claude");
      // Base score was 91.8 -> 91.8 + (5 * 1) = 96.8
      expect(atro?.score).toBe(96.8);
    });

    it("awards exactly +10.0 consensus bonus points for 3 agreeing models (Gemini + Claude + ChatGPT)", () => {
      const geminiReport = parseReportContent("ATRO favorable", "Gemini");
      const claudeReport = parseReportContent("ATRO favorable", "Claude");
      const chatgptReport = parseReportContent("ATRO favorable", "ChatGPT");

      const plan = synthesizeArbiterPlan(geminiReport, claudeReport, chatgptReport, 15000, 1.0);
      const atro = plan.masterSetups.find(s => s.ticker === "ATRO");

      expect(atro?.consensusCount).toBe(3);
      expect(atro?.isConsensusPick).toBe(true);
      // Base 91.8 + 10.0 = 101.8, clamped to 99.0 max
      expect(atro?.score).toBe(99.0);
    });

    it("strictly caps composite conviction score at 99.0 maximum", () => {
      const r1: ParsedReport = {
        marketRegime: "FAVORABLE",
        regimeNotes: "ok",
        macroFlags: "ok",
        candidates: [{ ticker: "MAXS", companyName: "M", setupType: "Breakout", entryTrigger: 100, entryCondition: "C", stopLoss: 95, stopRationale: "S", target1: 110, target2: 120, rrRatio: 2.0, timeStopDays: 5, positionShares: 10, riskAmount: 50, catalystDate: "D", catalystSummary: "S", bearCase: "B", score: 98.5, modelSource: "M1" }],
      };
      const r2: ParsedReport = {
        marketRegime: "FAVORABLE",
        regimeNotes: "ok",
        macroFlags: "ok",
        candidates: [{ ...r1.candidates[0], modelSource: "M2" }],
      };

      const plan = synthesizeArbiterPlan(r1, r2, undefined, 15000, 1.0);
      expect(plan.masterSetups[0].score).toBe(99.0); // 98.5 + 5.0 = 103.5 -> clamped to 99.0
      expect(plan.masterSetups[0].score).toBeLessThanOrEqual(99.0);
    });

    it("determines regime consensus as HOSTILE when 2 of 3 models vote HOSTILE", () => {
      const r1 = parseReportContent("hostile market", "M1");
      const r2 = parseReportContent("hostile market", "M2");
      const r3 = parseReportContent("favorable market", "M3");

      const plan = synthesizeArbiterPlan(r1, r2, r3, 15000, 1.0);
      expect(plan.marketRegime).toBe("HOSTILE");
    });

    it("determines regime consensus as NEUTRAL when 2 of 3 models vote NEUTRAL", () => {
      const r1 = parseReportContent("neutral market", "M1");
      const r2 = parseReportContent("neutral market", "M2");
      const r3 = parseReportContent("favorable market", "M3");

      const plan = synthesizeArbiterPlan(r1, r2, r3, 15000, 1.0);
      expect(plan.marketRegime).toBe("NEUTRAL");
    });

    it("determines regime consensus as FAVORABLE when favorable votes lead", () => {
      const r1 = parseReportContent("favorable market", "M1");
      const r2 = parseReportContent("favorable market", "M2");
      const r3 = parseReportContent("neutral market", "M3");

      const plan = synthesizeArbiterPlan(r1, r2, r3, 15000, 1.0);
      expect(plan.marketRegime).toBe("FAVORABLE");
    });

    it("always sorts multi-model consensus picks ahead of single-model picks", () => {
      // Setup single-model pick with high base score (95) vs consensus pick with lower base score (80)
      const r1: ParsedReport = {
        marketRegime: "FAVORABLE",
        regimeNotes: "ok",
        macroFlags: "ok",
        candidates: [
          { ticker: "SOLO", companyName: "Solo", setupType: "Breakout", entryTrigger: 100, entryCondition: "C", stopLoss: 95, stopRationale: "S", target1: 110, target2: 120, rrRatio: 2.0, timeStopDays: 5, positionShares: 10, riskAmount: 50, catalystDate: "D", catalystSummary: "S", bearCase: "B", score: 95.0, modelSource: "M1" },
          { ticker: "DUO", companyName: "Duo", setupType: "Breakout", entryTrigger: 50, entryCondition: "C", stopLoss: 48, stopRationale: "S", target1: 54, target2: 58, rrRatio: 2.0, timeStopDays: 5, positionShares: 10, riskAmount: 50, catalystDate: "D", catalystSummary: "S", bearCase: "B", score: 80.0, modelSource: "M1" },
        ],
      };
      const r2: ParsedReport = {
        marketRegime: "FAVORABLE",
        regimeNotes: "ok",
        macroFlags: "ok",
        candidates: [
          { ...r1.candidates[1], modelSource: "M2" }, // DUO appears in M2
        ],
      };

      const plan = synthesizeArbiterPlan(r1, r2, undefined, 15000, 1.0);
      expect(plan.masterSetups[0].ticker).toBe("DUO"); // Consensus pick ranked first
      expect(plan.masterSetups[1].ticker).toBe("SOLO");
    });

    it("formats consensusHighlight text with agreeing models and tickers", () => {
      const gemini = parseReportContent("ATRO favorable", "Gemini");
      const claude = parseReportContent("ATRO favorable", "Claude");
      const plan = synthesizeArbiterPlan(gemini, claude, undefined, 15000, 1.0);

      expect(plan.consensusHighlight).toContain("Strong Multi-Model Consensus on ATRO");
      expect(plan.consensusHighlight).toContain("Gemini & Claude");
    });
  });

  describe("Feature 25: Visual 4-Tier Price Ladder Boundaries & Extreme Spreads", () => {
    it("generates correctly ordered 4-tier price ladder (T2 > T1 > Entry > Stop)", () => {
      const ladder = generate4TierPriceLadder(89.20, 83.75, 100.10, 112.00);
      expect(ladder).toHaveLength(4);

      expect(ladder[0].levelName).toBe("TARGET_2");
      expect(ladder[0].price).toBe(112.00);
      expect(ladder[0].rMultiple).toBe(4.18);

      expect(ladder[1].levelName).toBe("TARGET_1");
      expect(ladder[1].price).toBe(100.10);
      expect(ladder[1].rMultiple).toBe(2.0);

      expect(ladder[2].levelName).toBe("ENTRY");
      expect(ladder[2].price).toBe(89.20);
      expect(ladder[2].distancePct).toBe(0.0);

      expect(ladder[3].levelName).toBe("STOP_LOSS");
      expect(ladder[3].price).toBe(83.75);
      expect(ladder[3].rMultiple).toBe(-1.0);
    });

    it("calculates percentage distances relative to entry price accurately", () => {
      const ladder = generate4TierPriceLadder(100.0, 95.0, 110.0, 120.0);
      expect(ladder[0].distancePct).toBe(20.0);  // T2 +20%
      expect(ladder[1].distancePct).toBe(10.0);  // T1 +10%
      expect(ladder[2].distancePct).toBe(0.0);   // Entry 0%
      expect(ladder[3].distancePct).toBe(-5.0);  // Stop -5%
    });

    it("handles tight scalp ladder (0.25% stop distance)", () => {
      const ladder = generate4TierPriceLadder(400.0, 399.0, 402.0, 404.0);
      expect(ladder[3].distancePct).toBe(-0.25);
      expect(ladder[1].rMultiple).toBe(2.0);
    });

    it("handles wide macro swing ladder ($500 stop distance on $3000 stock)", () => {
      const ladder = generate4TierPriceLadder(3000.0, 2500.0, 4000.0, 5000.0);
      expect(ladder[3].distancePct).toBeCloseTo(-16.67, 2);
      expect(ladder[1].rMultiple).toBe(2.0); // (4000 - 3000) / 500 = 2.0R
      expect(ladder[0].rMultiple).toBe(4.0); // (5000 - 3000) / 500 = 4.0R
    });

    it("handles sub-cent ladder pricing ($1.2345 entry)", () => {
      const ladder = generate4TierPriceLadder(1.2345, 1.1345, 1.4345, 1.5845);
      expect(ladder[1].rMultiple).toBe(2.0);
      expect(ladder[0].rMultiple).toBe(3.5);
    });

    it("formats human-readable labels for all 4 price levels", () => {
      const ladder = generate4TierPriceLadder(89.20, 83.75, 100.10, 112.00);
      expect(ladder[0].label).toContain("Target 2 (Runner");
      expect(ladder[1].label).toContain("Target 1 (Scale 50%");
      expect(ladder[2].label).toContain("Entry Trigger ($89.20)");
      expect(ladder[3].label).toContain("Hard Stop Loss (-1.0R)");
    });

    it("verifies R-multiples of Stop Loss is always exactly -1.0R", () => {
      const ladder1 = generate4TierPriceLadder(50, 45, 60, 70);
      const ladder2 = generate4TierPriceLadder(250, 240, 270, 290);
      expect(ladder1[3].rMultiple).toBe(-1.0);
      expect(ladder2[3].rMultiple).toBe(-1.0);
    });

    it("handles zero stop distance defensively using min risk denominator ($0.01)", () => {
      const ladder = generate4TierPriceLadder(50.0, 50.0, 60.0, 70.0);
      expect(ladder[3].rMultiple).toBe(-1.0);
      expect(ladder[1].rMultiple).toBeGreaterThan(0);
    });
  });

  describe("Feature 26: 1-Click Candidate Promotion Edge Cases", () => {
    it("promotes candidate to ACTIVE trade with exact 1% position sizing ($150 on $15k)", () => {
      const candidate: MasterSetup = {
        ticker: "ATRO",
        companyName: "Astronics Corp",
        setupType: "Base Breakout",
        entryTrigger: 88.50,
        entryCondition: "Breakout",
        stopLoss: 83.75, // Risk/sh = $4.75 -> 150 / 4.75 = 31 shares
        stopRationale: "Base low",
        target1: 100.10,
        target2: 112.00,
        rrRatio: 2.13,
        timeStopDays: 5,
        positionShares: 31,
        riskAmount: 147.25,
        catalystDate: "Aug 11, 2026",
        catalystSummary: "Record Q2 sales $260M",
        bearCase: "Overhead supply",
        score: 96.8,
        modelSource: "Gemini",
        consensusCount: 2,
        modelsAgreed: ["Gemini", "Claude"],
        isConsensusPick: true,
        normalizedShares: 31,
        normalizedRisk: 147.25,
      };

      const trade = promoteCandidateToTrade(candidate, "ACTIVE", 15000.0, 1.0);
      expect(trade.status).toBe("ACTIVE");
      expect(trade.sharesTotal).toBe(31);
      expect(trade.sharesRemaining).toBe(31);
      expect(trade.actualEntry).toBe(88.50);
      expect(trade.entryDate).toBeDefined();
    });

    it("promotes candidate to PENDING_ENTRY watch queue order", () => {
      const candidate: MasterSetup = {
        ticker: "MTRN",
        companyName: "Materion",
        setupType: "Pullback",
        entryTrigger: 282.00,
        entryCondition: "Reclaim $282",
        stopLoss: 270.50,
        stopRationale: "Gap low",
        target1: 305.00,
        target2: 328.00,
        rrRatio: 2.0,
        timeStopDays: 6,
        positionShares: 8,
        riskAmount: 92.00,
        catalystDate: "Aug 5, 2026",
        catalystSummary: "EPS beat",
        bearCase: "Materials lag",
        score: 93.1,
        modelSource: "Claude",
        consensusCount: 1,
        modelsAgreed: ["Claude"],
        isConsensusPick: false,
        normalizedShares: 8,
        normalizedRisk: 92.00,
      };

      const trade = promoteCandidateToTrade(candidate, "PENDING_ENTRY", 15000.0, 1.0);
      expect(trade.status).toBe("PENDING_ENTRY");
      expect(trade.actualEntry).toBeUndefined();
      expect(trade.entryDate).toBeUndefined();
      expect(trade.entryTrigger).toBe(282.00);
    });

    it("preserves catalyst summary and bear case in promoted trade notes", () => {
      const candidate: MasterSetup = {
        ticker: "GLBE",
        companyName: "Global-e",
        setupType: "Continuation",
        entryTrigger: 42.60,
        entryCondition: "Pullback",
        stopLoss: 40.20,
        stopRationale: "Gap low",
        target1: 48.00,
        target2: 52.00,
        rrRatio: 2.25,
        timeStopDays: 7,
        positionShares: 41,
        riskAmount: 98.40,
        catalystDate: "Aug 12, 2026",
        catalystSummary: "Q2 GMV surged 44%",
        bearCase: "Macro consumer softness",
        score: 92.0,
        modelSource: "ChatGPT",
        consensusCount: 1,
        modelsAgreed: ["ChatGPT"],
        isConsensusPick: false,
        normalizedShares: 41,
        normalizedRisk: 98.40,
      };

      const trade = promoteCandidateToTrade(candidate, "ACTIVE", 15000.0, 1.0);
      expect(trade.notes).toContain("Q2 GMV surged 44%");
      expect(trade.notes).toContain("Macro consumer softness");
    });

    it("assigns unique trade ID on promotion preventing state collisions", () => {
      const candidate: any = { ticker: "ATRO", entryTrigger: 88.5, stopLoss: 83.75, target1: 100, target2: 110, rrRatio: 2.0, timeStopDays: 5 };
      const t1 = promoteCandidateToTrade(candidate, "ACTIVE");
      const t2 = promoteCandidateToTrade(candidate, "PENDING_ENTRY");
      expect(t1.id).not.toBe(t2.id);
    });

    it("saves promoted trade into storage and verifies retrieval", () => {
      const candidate: any = { ticker: "LITE", companyName: "Lumentum", setupType: "Gap", entryTrigger: 950, stopLoss: 900, target1: 1050, target2: 1100, rrRatio: 2.0, timeStopDays: 4 };
      const trade = promoteCandidateToTrade(candidate, "ACTIVE", 15000.0, 1.0);
      storage.addOrUpdateTrade(trade);

      const trades = storage.getTrades();
      expect(trades.some(t => t.ticker === "LITE")).toBe(true);
      expect(trades.find(t => t.ticker === "LITE")?.sharesTotal).toBe(3); // $150 / $50 = 3 shares
    });

    it("handles candidate with zero or missing timeStopDays defaulting to 5 sessions", () => {
      const candidate: any = { ticker: "XYZ", entryTrigger: 100, stopLoss: 95, target1: 110, target2: 120, rrRatio: 2.0, timeStopDays: 0 };
      const trade = promoteCandidateToTrade(candidate, "ACTIVE");
      expect(trade.timeStopSessions).toBe(5);
    });

    it("promotes candidate with fractional share calculation rounded down to whole shares", () => {
      const candidate: any = { ticker: "ABC", entryTrigger: 50.0, stopLoss: 48.67, target1: 53.0, target2: 55.0, rrRatio: 2.0 };
      // Risk/sh = 1.33. $150 / 1.33 = 112.78 -> 112 shares
      const trade = promoteCandidateToTrade(candidate, "ACTIVE", 15000.0, 1.0);
      expect(trade.sharesTotal).toBe(112);
    });
  });
});
