// Tier 1 Milestone 4 Test Suite: Multi-LLM Screener, Prompt Station & Arbiter Engine
// Covers Features 22, 23, 24, 25, 26

import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { LocalStoreService, InMemoryStorageAdapter } from "@/lib/storage/local-store";
import { Trade } from "@/lib/storage/types";
import { parseReportContent, ParsedReport, ParsedCandidate, TICKER_BLACKLIST } from "../../lib/ai/parser";
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
import {
  DEFAULT_LATEST_MODELS,
  CLAUDE_LATEST_MODELS,
  runModelResearch,
} from "../../lib/ai/runners";

// Helper: 1-Click Candidate Promotion
function promoteCandidateToLocalStore(
  store: LocalStoreService,
  candidate: MasterSetup | ParsedCandidate,
  mode: "ACTIVE" | "PENDING_ENTRY",
  accountSize: number = 15000,
  riskPct: number = 1.0,
  fillPrice?: number
): Trade {
  const riskBudget = accountSize * (riskPct / 100);
  const riskPerShare = Math.max(0.01, Math.abs(candidate.entryTrigger - candidate.stopLoss));
  const shares = Math.max(1, Math.floor(riskBudget / riskPerShare));
  const isFill = mode === "ACTIVE";

  const trade: Trade = {
    id: `promoted_${candidate.ticker}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ticker: candidate.ticker.toUpperCase(),
    companyName: candidate.companyName,
    status: mode,
    setupType: candidate.setupType,
    entryTrigger: candidate.entryTrigger,
    actualEntry: isFill ? (fillPrice ?? candidate.entryTrigger) : undefined,
    entryDate: isFill ? new Date().toISOString() : undefined,
    sharesTotal: shares,
    sharesRemaining: shares,
    initialStop: candidate.stopLoss,
    currentStop: candidate.stopLoss,
    target1: candidate.target1,
    target2: candidate.target2,
    rrRatio: candidate.rrRatio,
    timeStopSessions: candidate.timeStopDays || 5,
    sessionsElapsed: 0,
    notes: `${candidate.catalystSummary || ""} | Bear Case: ${candidate.bearCase || ""}`,
  };

  store.saveTrade(trade);
  return trade;
}

describe("Milestone 4: Multi-LLM Screener, Prompt Station & Arbiter Engine", () => {
  let store: LocalStoreService;
  let mockAdapter: InMemoryStorageAdapter;

  beforeEach(() => {
    mockAdapter = new InMemoryStorageAdapter();
    store = new LocalStoreService(mockAdapter);
  });

  // -------------------------------------------------------------
  // FEATURE 22: Frontier Model Ingestion & Profiles
  // -------------------------------------------------------------
  describe("Feature 22: Frontier Model Ingestion & Profiles", () => {
    it("supports all frontier models: Gemini 3.7 Flash, Claude Sonnet 5, OpenAI 5.6", () => {
      expect(DEFAULT_LATEST_MODELS.geminiModel).toBe("gemini-3.7-flash");
      expect(DEFAULT_LATEST_MODELS.claudeModel).toBe("claude-sonnet-5");
      expect(DEFAULT_LATEST_MODELS.openaiModel).toBe("gpt-5.6");
    });

    it("verifies Claude model family contains Opus and Fable with descriptions", () => {
      expect(CLAUDE_LATEST_MODELS).toHaveLength(3);
      const sonnet = CLAUDE_LATEST_MODELS.find(m => m.id === "claude-sonnet-5");
      const opus = CLAUDE_LATEST_MODELS.find(m => m.id === "claude-opus");
      const fable = CLAUDE_LATEST_MODELS.find(m => m.id === "claude-fable");

      expect(sonnet?.name).toBe("Claude Sonnet 5");
      expect(opus?.name).toBe("Claude Opus");
      expect(fable?.name).toBe("Claude Fable");
    });

    it("parses code-fenced JSON responses from frontier models", () => {
      const jsonPayload = `
\`\`\`json
[
  {
    "ticker": "NVDA",
    "companyName": "NVIDIA Corporation",
    "setupType": "Momentum Breakout",
    "entryTrigger": 130.50,
    "stopLoss": 124.00,
    "target1": 143.50,
    "target2": 155.00,
    "score": 94.5,
    "catalystSummary": "Blackwell architecture production ramp confirmed."
  }
]
\`\`\`
      `;
      const parsed = parseReportContent(jsonPayload, "Gemini 3.7 Flash");
      expect(parsed.candidates).toHaveLength(1);
      const nvda = parsed.candidates[0];
      expect(nvda.ticker).toBe("NVDA");
      expect(nvda.entryTrigger).toBe(130.50);
      expect(nvda.stopLoss).toBe(124.00);
      expect(nvda.score).toBe(94.5);
      expect(nvda.modelSource).toBe("Gemini 3.7 Flash");
    });

    it("parses markdown tabular research format from OpenAI models", () => {
      const markdownTable = `
| Ticker | Setup | Entry | Stop | Target 1 | Target 2 | Score | Catalyst |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| AMD | Bull Flag | $165.00 | $156.00 | $183.00 | $198.00 | 89.0 | Data center AI GPU momentum |
      `;
      const parsed = parseReportContent(markdownTable, "OpenAI 5.6");
      expect(parsed.candidates).toHaveLength(1);
      const amd = parsed.candidates[0];
      expect(amd.ticker).toBe("AMD");
      expect(amd.entryTrigger).toBe(165.00);
      expect(amd.stopLoss).toBe(156.00);
      expect(amd.target1).toBe(183.00);
      expect(amd.score).toBe(89.0);
    });

    it("filters false-positive tokens against ticker blacklist", () => {
      expect(TICKER_BLACKLIST.has("BUY")).toBe(true);
      expect(TICKER_BLACKLIST.has("STOP")).toBe(true);
      expect(TICKER_BLACKLIST.has("TARGET")).toBe(true);
      expect(TICKER_BLACKLIST.has("SPY")).toBe(true);
      expect(TICKER_BLACKLIST.has("FOMC")).toBe(true);

      const noisyText = "BUY now at $100 with STOP at $95 for TARGET at $110. Also watch SPY and QQQ.";
      const parsed = parseReportContent(noisyText, "Gemini");
      // Blacklisted words should NOT be recognized as individual candidates
      parsed.candidates.forEach(c => {
        expect(TICKER_BLACKLIST.has(c.ticker)).toBe(false);
      });
    });
  });

  // -------------------------------------------------------------
  // FEATURE 23: 1-Click Research Prompt Station
  // -------------------------------------------------------------
  describe("Feature 23: 1-Click Research Prompt Station", () => {
    it("exports static standard deep research prompts", () => {
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Step 1 — Market Regime Check");
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Step 2 — Screening Universe");
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Step 3 — Research Requirements");
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Step 4 — Weighted Rubric & Selection");
      expect(ARBITER_SYNTHESIS_PROMPT).toContain("Chief Investment Officer");
    });

    it("dynamically generates customized prompt with custom account size and risk %", () => {
      const prompt = generateDeepResearchPrompt({
        accountSize: 50000,
        riskPercent: 1.5,
        strategyStyle: "PEAD_CONTINUATION",
        targetModel: "claude",
      });

      expect(prompt).toContain("$50,000");
      expect(prompt).toContain("1.5%");
      expect(prompt).toContain("$750.00 max risk");
      expect(prompt).toContain("Post-Earnings Announcement Drift (PEAD)");
      expect(prompt).toContain("Target Model Directive");
    });

    it("supports momentum breakout strategy preset in dynamic prompt generator", () => {
      const prompt = generateDeepResearchPrompt({
        strategyStyle: "MOMENTUM_BREAKOUT",
      });
      expect(prompt).toContain("Prioritize high-relative-strength momentum breakouts");
    });

    it("supports first pullback strategy preset in dynamic prompt generator", () => {
      const prompt = generateDeepResearchPrompt({
        strategyStyle: "FIRST_PULLBACK",
      });
      expect(prompt).toContain("Prioritize first pullbacks to rising 20-day EMA");
    });
  });

  // -------------------------------------------------------------
  // FEATURE 24: Multi-Model Consensus Arbiter Engine
  // -------------------------------------------------------------
  describe("Feature 24: Multi-Model Consensus Arbiter Engine", () => {
    it("deduplicates candidate tickers across 3 models and computes agreement", () => {
      const geminiReport = parseReportContent("ATRO CRWV favorable", "Gemini");
      const claudeReport = parseReportContent("ATRO MTRN favorable", "Claude");
      const chatgptReport = parseReportContent("ATRO GLBE favorable", "ChatGPT");

      const plan = synthesizeArbiterPlan(geminiReport, claudeReport, chatgptReport, 15000, 1.0);
      const atro = plan.masterSetups.find(s => s.ticker === "ATRO");

      expect(atro).toBeDefined();
      expect(atro?.isConsensusPick).toBe(true);
      expect(atro?.consensusCount).toBe(3);
      expect(atro?.modelsAgreed).toContain("Gemini");
      expect(atro?.modelsAgreed).toContain("Claude");
      expect(atro?.modelsAgreed).toContain("ChatGPT");
    });

    it("awards +5.0 bonus per agreeing model and ranks consensus picks first", () => {
      const geminiReport = parseReportContent("CRWV favorable", "Gemini"); // single pick
      const claudeReport = parseReportContent("ATRO favorable", "Claude");
      const chatgptReport = parseReportContent("ATRO favorable", "ChatGPT"); // 2-model consensus on ATRO

      const plan = synthesizeArbiterPlan(geminiReport, claudeReport, chatgptReport, 15000, 1.0);
      expect(plan.masterSetups[0].ticker).toBe("ATRO");
      expect(plan.masterSetups[0].isConsensusPick).toBe(true);
      expect(plan.masterSetups[0].score).toBe(96.8); // 91.8 + 5.0 = 96.8
    });

    it("synthesizes market regime with risk-averse bias when 2 models report HOSTILE", () => {
      const gReport: ParsedReport = { marketRegime: "HOSTILE", regimeNotes: "Selloff", macroFlags: "FOMC", candidates: [] };
      const cReport: ParsedReport = { marketRegime: "HOSTILE", regimeNotes: "Breakdown", macroFlags: "CPI", candidates: [] };
      const chReport: ParsedReport = { marketRegime: "FAVORABLE", regimeNotes: "Dip", macroFlags: "None", candidates: [] };

      const plan = synthesizeArbiterPlan(gReport, cReport, chReport, 15000, 1.0);
      expect(plan.marketRegime).toBe("HOSTILE");
    });

    it("synthesizes market regime as NEUTRAL when 1 hostile and 1 neutral report exist", () => {
      const gReport: ParsedReport = { marketRegime: "HOSTILE", regimeNotes: "Selloff", macroFlags: "FOMC", candidates: [] };
      const cReport: ParsedReport = { marketRegime: "NEUTRAL", regimeNotes: "Range", macroFlags: "CPI", candidates: [] };

      const plan = synthesizeArbiterPlan(gReport, cReport, undefined, 15000, 1.0);
      expect(plan.marketRegime).toBe("NEUTRAL");
    });

    it("computes 1% risk position sizing math on $15,000 capital ($150 risk budget)", () => {
      const claudeReport = parseReportContent("ATRO favorable", "Claude");
      const plan = synthesizeArbiterPlan(undefined, claudeReport, undefined, 15000, 1.0);
      const atro = plan.masterSetups[0];

      // Entry $89.20, Stop $83.75 -> Risk/sh $5.45.
      // Shares = floor(150 / 5.45) = 27 shares
      // Normalized risk = 27 * 5.45 = $147.15
      expect(atro.normalizedShares).toBe(27);
      expect(atro.normalizedRisk).toBe(147.15);
      expect(atro.allocatedCapital).toBe(2408.40);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 25: Visual 4-Tier Price Ladder Calculation
  // -------------------------------------------------------------
  describe("Feature 25: Visual 4-Tier Price Ladder Calculation", () => {
    it("generates correctly structured 4-tier price ladder levels", () => {
      const ladder = generate4TierPriceLadder(89.20, 83.75, 100.10, 112.00);
      expect(ladder).toHaveLength(4);

      // Target 2
      expect(ladder[0].levelName).toBe("TARGET_2");
      expect(ladder[0].price).toBe(112.00);
      expect(ladder[0].rMultiple).toBe(4.18);
      expect(ladder[0].distancePct).toBe(25.56);

      // Target 1
      expect(ladder[1].levelName).toBe("TARGET_1");
      expect(ladder[1].price).toBe(100.10);
      expect(ladder[1].rMultiple).toBe(2.0);
      expect(ladder[1].distancePct).toBe(12.22);

      // Entry Trigger
      expect(ladder[2].levelName).toBe("ENTRY");
      expect(ladder[2].price).toBe(89.20);
      expect(ladder[2].distancePct).toBe(0.0);

      // Hard Stop Loss
      expect(ladder[3].levelName).toBe("STOP_LOSS");
      expect(ladder[3].price).toBe(83.75);
      expect(ladder[3].rMultiple).toBe(-1.0);
      expect(ladder[3].distancePct).toBe(-6.11);
    });

    it("verifies stop loss always yields -1.0R multiple", () => {
      const ladder = generate4TierPriceLadder(200.0, 190.0, 220.0, 235.0);
      expect(ladder[3].rMultiple).toBe(-1.0);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 26: 1-Click Candidate Setup Promotion
  // -------------------------------------------------------------
  describe("Feature 26: 1-Click Candidate Setup Promotion", () => {
    it("promotes candidate to ACTIVE trade with instant fill and 1% risk position sizing", () => {
      const candidate: MasterSetup = {
        ticker: "ATRO",
        companyName: "Astronics Corporation",
        setupType: "Base Breakout",
        entryTrigger: 89.20,
        entryCondition: "Buy-stop on 30-min hold above $88.72 pivot",
        stopLoss: 83.75,
        stopRationale: "Below catalyst gap-open low",
        target1: 100.10,
        target2: 112.00,
        rrRatio: 2.0,
        timeStopDays: 5,
        positionShares: 27,
        riskAmount: 147.15,
        catalystDate: "August 11, 2026",
        catalystSummary: "Record sales $260M, raised FY26 guidance.",
        bearCase: "Overhead resistance at $92.49 high.",
        score: 96.8,
        modelSource: "Gemini",
        consensusCount: 2,
        modelsAgreed: ["Gemini", "Claude"],
        isConsensusPick: true,
        normalizedShares: 27,
        normalizedRisk: 147.15,
      };

      const trade = promoteCandidateToLocalStore(store, candidate, "ACTIVE", 15000, 1.0, 89.20);

      expect(trade.status).toBe("ACTIVE");
      expect(trade.ticker).toBe("ATRO");
      expect(trade.sharesTotal).toBe(27);
      expect(trade.sharesRemaining).toBe(27);
      expect(trade.actualEntry).toBe(89.20);
      expect(trade.initialStop).toBe(83.75);
      expect(trade.currentStop).toBe(83.75);
      expect(trade.target1).toBe(100.10);
      expect(trade.target2).toBe(112.00);
      expect(trade.timeStopSessions).toBe(5);
      expect(trade.notes).toContain("Record sales $260M");
      expect(trade.notes).toContain("Overhead resistance");

      const storedTrades = store.getTrades();
      expect(storedTrades).toHaveLength(1);
      expect(storedTrades[0].ticker).toBe("ATRO");
    });

    it("promotes candidate to PENDING_ENTRY watch order with undefined actualEntry", () => {
      const candidate: MasterSetup = {
        ticker: "MTRN",
        companyName: "Materion Corporation",
        setupType: "First Pullback",
        entryTrigger: 282.00,
        entryCondition: "Reclaim $282 pivot",
        stopLoss: 270.50,
        stopRationale: "Below post-gap low",
        target1: 305.00,
        target2: 328.00,
        rrRatio: 2.0,
        timeStopDays: 6,
        positionShares: 13,
        riskAmount: 149.50,
        catalystDate: "August 5, 2026",
        catalystSummary: "Adjusted EPS $1.90 vs $1.37.",
        bearCase: "Materials sector lagging.",
        score: 93.1,
        modelSource: "Claude",
        consensusCount: 1,
        modelsAgreed: ["Claude"],
        isConsensusPick: false,
        normalizedShares: 13,
        normalizedRisk: 149.50,
      };

      const trade = promoteCandidateToLocalStore(store, candidate, "PENDING_ENTRY", 15000, 1.0);

      expect(trade.status).toBe("PENDING_ENTRY");
      expect(trade.actualEntry).toBeUndefined();
      expect(trade.entryDate).toBeUndefined();
      expect(trade.entryTrigger).toBe(282.00);
      expect(trade.sharesTotal).toBe(13);
    });

    it("preserves downward stop loss ratchet invariant across multiple updates", () => {
      const candidate: MasterSetup = {
        ticker: "GLBE",
        companyName: "Global-e Online",
        setupType: "Continuation",
        entryTrigger: 42.60,
        entryCondition: "Retest support",
        stopLoss: 40.20,
        stopRationale: "Below 20 EMA",
        target1: 48.00,
        target2: 52.00,
        rrRatio: 2.25,
        timeStopDays: 7,
        positionShares: 62,
        riskAmount: 148.80,
        catalystDate: "Aug 12, 2026",
        catalystSummary: "GMV +44%",
        bearCase: "Macro softness",
        score: 92.0,
        modelSource: "ChatGPT",
        consensusCount: 1,
        modelsAgreed: ["ChatGPT"],
        isConsensusPick: false,
        normalizedShares: 62,
        normalizedRisk: 148.80,
      };

      const trade = promoteCandidateToLocalStore(store, candidate, "ACTIVE");

      // Attempt upward stop ratchet to $42.60 (breakeven) -> permitted
      trade.currentStop = 42.60;
      store.saveTrade(trade);
      expect(store.getTrades()[0].currentStop).toBe(42.60);

      // Attempt downward stop widening to $39.00 -> rejected by storage ratchet
      const widenedTrade = { ...trade, currentStop: 39.00 };
      store.saveTrade(widenedTrade);
      expect(store.getTrades()[0].currentStop).toBe(42.60);
    });
  });
});
