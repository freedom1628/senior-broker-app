import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade } from "../helpers/mock-storage";
import { parseReportContent, ParsedReport, ParsedCandidate } from "../../lib/ai/parser";
import { synthesizeArbiterPlan, MasterArbiterPlan, MasterSetup } from "../../lib/ai/arbiter";
import { SWING_TRADE_RESEARCH_PROMPT, ARBITER_SYNTHESIS_PROMPT } from "../../lib/ai/prompts";
import { DEFAULT_LATEST_MODELS, CLAUDE_LATEST_MODELS, runModelResearch } from "../../lib/ai/runners";

// Promotion Helper
export function promoteCandidateToTrade(
  storage: MockDualLayerStorage,
  candidate: ParsedCandidate,
  targetStatus: "ACTIVE" | "PENDING_ENTRY",
  actualFillPrice?: number
): StoredTrade {
  const isFill = targetStatus === "ACTIVE";
  const entryPrice = isFill ? (actualFillPrice ?? candidate.entryTrigger) : candidate.entryTrigger;

  const newTrade: StoredTrade = {
    id: `promoted_${candidate.ticker.toLowerCase()}_${Date.now()}`,
    ticker: candidate.ticker.toUpperCase(),
    companyName: candidate.companyName,
    status: targetStatus,
    setupType: candidate.setupType,
    entryTrigger: candidate.entryTrigger,
    actualEntry: isFill ? entryPrice : undefined,
    entryDate: isFill ? new Date().toISOString() : undefined,
    sharesTotal: candidate.positionShares,
    sharesRemaining: candidate.positionShares,
    initialStop: candidate.stopLoss,
    currentStop: candidate.stopLoss,
    target1: candidate.target1,
    target2: candidate.target2,
    rrRatio: candidate.rrRatio,
    timeStopSessions: candidate.timeStopDays || 6,
    sessionsElapsed: 0,
    notes: candidate.catalystSummary,
  };

  storage.addOrUpdateTrade(newTrade);
  return newTrade;
}

describe("Tier 1 Feature Coverage: Screener AI & Arbiter Engine", () => {
  let storage: MockDualLayerStorage;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
  });

  // -------------------------------------------------------------
  // FEATURE 22: Multi-LLM Frontier Ingestion
  // -------------------------------------------------------------
  describe("Feature 22: Multi-LLM Frontier Ingestion", () => {
    it("verifies latest model configuration identifiers (Gemini 3.7 Flash, Claude Sonnet 5, OpenAI 5.6)", () => {
      expect(DEFAULT_LATEST_MODELS.geminiModel).toBe("gemini-3.7-flash");
      expect(DEFAULT_LATEST_MODELS.claudeModel).toBe("claude-sonnet-5");
      expect(DEFAULT_LATEST_MODELS.openaiModel).toBe("gpt-5.6");
    });

    it("verifies Claude multi-model family options (Sonnet 5, Opus, Fable)", () => {
      expect(CLAUDE_LATEST_MODELS).toHaveLength(3);
      const ids = CLAUDE_LATEST_MODELS.map(m => m.id);
      expect(ids).toContain("claude-sonnet-5");
      expect(ids).toContain("claude-opus");
      expect(ids).toContain("claude-fable");
    });

    it("parses Google Gemini research report text extracting structured candidates", () => {
      const reportText = "Top swing opportunities: ATRO Astronics Corp earnings gap, CRWV CoreWeave. Market regime: favorable.";
      const parsed = parseReportContent(reportText, "Gemini 3.7 Flash");

      expect(parsed.marketRegime).toBe("FAVORABLE");
      expect(parsed.candidates.length).toBeGreaterThan(0);
      const tickers = parsed.candidates.map(c => c.ticker);
      expect(tickers).toContain("ATRO");
      expect(tickers).toContain("CRWV");
    });

    it("parses Anthropic Claude research report text with complete trade levels", () => {
      const reportText = "Claude Institutional Research: MTRN Materion, ATRO, LITE. Market Regime: Favorable.";
      const parsed = parseReportContent(reportText, "Claude Sonnet 5");

      expect(parsed.marketRegime).toBe("FAVORABLE");
      const mtrn = parsed.candidates.find(c => c.ticker === "MTRN");
      expect(mtrn).toBeDefined();
      expect(mtrn?.entryTrigger).toBe(282.0);
      expect(mtrn?.stopLoss).toBe(270.5);
      expect(mtrn?.target1).toBe(305.0);
      expect(mtrn?.target2).toBe(328.0);
      expect(mtrn?.rrRatio).toBe(2.0);
    });

    it("parses OpenAI 5.6 research report text extracting setup metrics and bear case", () => {
      const reportText = "OpenAI Prop Screen: GLBE Global-e Online, NIQ Global Intelligence. Market Regime: Favorable.";
      const parsed = parseReportContent(reportText, "OpenAI 5.6");

      const glbe = parsed.candidates.find(c => c.ticker === "GLBE");
      expect(glbe).toBeDefined();
      expect(glbe?.entryTrigger).toBe(42.6);
      expect(glbe?.stopLoss).toBe(40.2);
      expect(glbe?.bearCase).toBeDefined();
      expect(glbe?.catalystDate).toContain("August");
    });

    it("executes runModelResearch fallback without throwing when API key is unconfigured", async () => {
      const geminiResult = await runModelResearch("gemini");
      expect(geminiResult.reportText).toBeDefined();
      expect(geminiResult.parsed.candidates.length).toBeGreaterThan(0);

      const claudeResult = await runModelResearch("claude");
      expect(claudeResult.reportText).toBeDefined();
      expect(claudeResult.parsed.candidates.length).toBeGreaterThan(0);

      const chatgptResult = await runModelResearch("chatgpt");
      expect(chatgptResult.reportText).toBeDefined();
      expect(chatgptResult.parsed.candidates.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 23: 1-Click Research Prompt Station
  // -------------------------------------------------------------
  describe("Feature 23: 1-Click Research Prompt Station", () => {
    it("contains complete 4-step research methodology in SWING_TRADE_RESEARCH_PROMPT", () => {
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Step 1 — Market Regime Check");
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Step 2 — Screening Universe");
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Step 3 — Research Requirements Per Candidate");
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Step 4 — Weighted Rubric & Selection");
    });

    it("enforces long-only shares-only trader profile constraints in prompt", () => {
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Long only. No shorts, no options");
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("3 days to 4 weeks");
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Assume 1% of account risked per trade");
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("NO confirmed earnings report inside the expected holding window");
    });

    it("defines universe liquidity and price filters (NYSE/NASDAQ, >$5, >$20M volume)", () => {
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Exchange: NYSE or NASDAQ only");
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Price: Above $5");
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Average daily dollar volume above $20M");
    });

    it("specifies weighted rubric distribution summing to 100%", () => {
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Setup quality & volume confirmation (30%)");
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Relative strength (25%)");
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Risk/reward >= 2:1 (20%)");
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Catalyst durability (15%)");
      expect(SWING_TRADE_RESEARCH_PROMPT).toContain("Liquidity & clean exit (10%)");
    });

    it("contains Chief Investment Officer synthesis instructions in ARBITER_SYNTHESIS_PROMPT", () => {
      expect(ARBITER_SYNTHESIS_PROMPT).toContain("Chief Investment Officer");
      expect(ARBITER_SYNTHESIS_PROMPT).toContain("Reconcile market regime assessments");
      expect(ARBITER_SYNTHESIS_PROMPT).toContain("Identify consensus tickers");
      expect(ARBITER_SYNTHESIS_PROMPT).toContain("Score each setup out of 100");
    });
  });

  // -------------------------------------------------------------
  // FEATURE 24: Multi-Model Consensus Arbiter
  // -------------------------------------------------------------
  describe("Feature 24: Multi-Model Consensus Arbiter", () => {
    it("identifies cross-model consensus pick when ticker appears in multiple model reports", () => {
      const geminiReport = parseReportContent("ATRO CRWV favorable", "Gemini");
      const claudeReport = parseReportContent("ATRO MTRN favorable", "Claude");
      const chatgptReport = parseReportContent("ATRO GLBE favorable", "ChatGPT");

      const arbiterPlan = synthesizeArbiterPlan(geminiReport, claudeReport, chatgptReport, 15000.0, 1.0);
      const atroSetup = arbiterPlan.masterSetups.find(s => s.ticker === "ATRO");

      expect(atroSetup).toBeDefined();
      expect(atroSetup?.isConsensusPick).toBe(true);
      expect(atroSetup?.consensusCount).toBe(3);
      expect(atroSetup?.modelsAgreed).toContain("Gemini");
      expect(atroSetup?.modelsAgreed).toContain("Claude");
      expect(atroSetup?.modelsAgreed).toContain("ChatGPT");
    });

    it("awards +5 bonus conviction points per agreeing model to consensus picks", () => {
      const geminiReport = parseReportContent("ATRO favorable", "Gemini");
      const claudeReport = parseReportContent("ATRO favorable", "Claude");

      const arbiterPlan = synthesizeArbiterPlan(geminiReport, claudeReport, undefined, 15000.0, 1.0);
      const atroSetup = arbiterPlan.masterSetups.find(s => s.ticker === "ATRO");

      // Baseline score ~91.8 + (2 - 1) * 5 = +5 bonus = 96.8
      expect(atroSetup?.score).toBeGreaterThan(91.8);
      expect(atroSetup?.isConsensusPick).toBe(true);
    });

    it("harmonizes market regime verdict across reports (Favorable / Neutral / Hostile)", () => {
      // 2 Hostile reports override 1 Favorable
      const hostileGemini: ParsedReport = { marketRegime: "HOSTILE", regimeNotes: "Selloff", macroFlags: "FOMC", candidates: [] };
      const hostileClaude: ParsedReport = { marketRegime: "HOSTILE", regimeNotes: "Breadth breaking", macroFlags: "PPI", candidates: [] };
      const favChatGPT: ParsedReport = { marketRegime: "FAVORABLE", regimeNotes: "Dip buy", macroFlags: "None", candidates: [] };

      const plan = synthesizeArbiterPlan(hostileGemini, hostileClaude, favChatGPT, 15000.0, 1.0);
      expect(plan.marketRegime).toBe("HOSTILE");
    });

    it("sorts consensus picks first, followed by highest conviction single-model setups", () => {
      const geminiReport = parseReportContent("CRWV HALO favorable", "Gemini");
      const claudeReport = parseReportContent("ATRO MTRN favorable", "Claude");
      const chatgptReport = parseReportContent("ATRO GLBE favorable", "ChatGPT");

      const plan = synthesizeArbiterPlan(geminiReport, claudeReport, chatgptReport, 15000.0, 1.0);
      expect(plan.masterSetups[0].ticker).toBe("ATRO"); // Top consensus pick
      expect(plan.masterSetups[0].isConsensusPick).toBe(true);
    });

    it("normalizes 1% position sizing math off $15,000 sleeve account", () => {
      const claudeReport = parseReportContent("ATRO favorable", "Claude");
      const plan = synthesizeArbiterPlan(undefined, claudeReport, undefined, 15000.0, 1.0);
      const atro = plan.masterSetups[0];

      // $150 / $5.45 risk per share = 27 shares
      expect(atro.normalizedShares).toBe(27);
      expect(atro.normalizedRisk).toBe(147.15);
    });

    it("generates consensus highlight summary sentence for top recommendations", () => {
      const geminiReport = parseReportContent("ATRO favorable", "Gemini");
      const claudeReport = parseReportContent("ATRO favorable", "Claude");

      const plan = synthesizeArbiterPlan(geminiReport, claudeReport, undefined, 15000.0, 1.0);
      expect(plan.consensusHighlight).toContain("Multi-Model Consensus on ATRO");
    });
  });

  // -------------------------------------------------------------
  // FEATURE 26: 1-Click Candidate Promotion
  // -------------------------------------------------------------
  describe("Feature 26: 1-Click Candidate Promotion", () => {
    it("promotes candidate setup to PENDING_ENTRY watch order with pre-filled math", () => {
      const candidate: ParsedCandidate = {
        ticker: "MTRN",
        companyName: "Materion Corporation",
        setupType: "Post-Earnings Pullback / Bull Flag",
        entryTrigger: 282.0,
        entryCondition: "Reclaim $282 with 30-min bar close",
        stopLoss: 270.5,
        stopRationale: "Below post-gap low",
        target1: 305.0,
        target2: 328.0,
        rrRatio: 2.0,
        timeStopDays: 6,
        positionShares: 8,
        riskAmount: 92.0,
        catalystDate: "August 5, 2026",
        catalystSummary: "Q2 sales $613.9M, adjusted EPS $1.90 vs $1.37.",
        bearCase: "Materials sector lagging.",
        score: 93.1,
        modelSource: "Claude",
      };

      const trade = promoteCandidateToTrade(storage, candidate, "PENDING_ENTRY");

      expect(trade.status).toBe("PENDING_ENTRY");
      expect(trade.ticker).toBe("MTRN");
      expect(trade.sharesTotal).toBe(8);
      expect(trade.sharesRemaining).toBe(8);
      expect(trade.entryTrigger).toBe(282.0);
      expect(trade.initialStop).toBe(270.5);
      expect(trade.target1).toBe(305.0);
      expect(trade.notes).toContain("Q2 sales $613.9M");
    });

    it("promotes candidate setup directly to ACTIVE trade with instant fill price capture", () => {
      const candidate: ParsedCandidate = {
        ticker: "ATRO",
        companyName: "Astronics Corporation",
        setupType: "Earnings Gap Breakout",
        entryTrigger: 89.2,
        entryCondition: "Buy-stop above 88.72 pivot",
        stopLoss: 83.75,
        stopRationale: "Below catalyst low",
        target1: 100.1,
        target2: 112.0,
        rrRatio: 2.13,
        timeStopDays: 5,
        positionShares: 18,
        riskAmount: 98.1,
        catalystDate: "August 11, 2026",
        catalystSummary: "Record sales $260M.",
        bearCase: "Intraday fade from high.",
        score: 91.8,
        modelSource: "Gemini",
      };

      const trade = promoteCandidateToTrade(storage, candidate, "ACTIVE", 89.25);

      expect(trade.status).toBe("ACTIVE");
      expect(trade.actualEntry).toBe(89.25);
      expect(trade.entryDate).toBeDefined();
      expect(trade.sharesRemaining).toBe(18);
      expect(trade.currentStop).toBe(83.75);
    });

    it("persists promoted trades into dual-layer storage successfully", () => {
      const candidate: ParsedCandidate = {
        ticker: "GLBE",
        companyName: "Global-e Online",
        setupType: "Catalyst Continuation",
        entryTrigger: 42.6,
        entryCondition: "Limit order at 42.60",
        stopLoss: 40.2,
        stopRationale: "Below gap low",
        target1: 48.0,
        target2: 52.0,
        rrRatio: 2.25,
        timeStopDays: 7,
        positionShares: 41,
        riskAmount: 98.4,
        catalystDate: "August 12, 2026",
        catalystSummary: "Q2 GMV $2.09B.",
        bearCase: "Macro consumer softness.",
        score: 92.0,
        modelSource: "OpenAI",
      };

      promoteCandidateToTrade(storage, candidate, "ACTIVE");
      const stored = storage.getTrades();

      expect(stored).toHaveLength(1);
      expect(stored[0].ticker).toBe("GLBE");
    });

    it("promotes multiple distinct candidates without overwriting existing trades", () => {
      const c1: ParsedCandidate = { ticker: "ATRO", companyName: "Astronics", setupType: "Breakout", entryTrigger: 89.2, entryCondition: "", stopLoss: 83.75, stopRationale: "", target1: 100.0, target2: 112.0, rrRatio: 2.0, timeStopDays: 5, positionShares: 18, riskAmount: 98.0, catalystDate: "", catalystSummary: "", bearCase: "", score: 90, modelSource: "Gemini" };
      const c2: ParsedCandidate = { ticker: "MTRN", companyName: "Materion", setupType: "Pullback", entryTrigger: 282.0, entryCondition: "", stopLoss: 270.5, stopRationale: "", target1: 305.0, target2: 328.0, rrRatio: 2.0, timeStopDays: 6, positionShares: 8, riskAmount: 92.0, catalystDate: "", catalystSummary: "", bearCase: "", score: 91, modelSource: "Claude" };

      promoteCandidateToTrade(storage, c1, "ACTIVE");
      promoteCandidateToTrade(storage, c2, "PENDING_ENTRY");

      const stored = storage.getTrades();
      expect(stored).toHaveLength(2);
    });

    it("preserves time stop holding days parameter upon candidate promotion", () => {
      const c: ParsedCandidate = { ticker: "LITE", companyName: "Lumentum", setupType: "Breakout", entryTrigger: 951.0, entryCondition: "", stopLoss: 898.5, stopRationale: "", target1: 1056.0, target2: 1085.5, rrRatio: 2.0, timeStopDays: 4, positionShares: 1, riskAmount: 52.5, catalystDate: "", catalystSummary: "", bearCase: "", score: 88, modelSource: "Claude" };
      const trade = promoteCandidateToTrade(storage, c, "ACTIVE");

      expect(trade.timeStopSessions).toBe(4);
    });
  });
});
