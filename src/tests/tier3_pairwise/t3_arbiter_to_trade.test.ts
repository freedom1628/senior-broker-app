// Tier 3 Pairwise Combinatorial Integration Test: Arbiter Consensus to Trade Promotion & Price Ladders
// Requirements: ORIGINAL_REQUEST §R4.1, §R4.3, §R2.1, §R2.2, §R3.4

import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade } from "../helpers/mock-storage";
import { MockMarketEngine } from "../helpers/mock-market";
import { parseReportContent } from "../../lib/ai/parser";
import { synthesizeArbiterPlan } from "../../lib/ai/arbiter";
import { evaluateTrade } from "../../lib/market/rule-engine";

describe("Tier 3 Pairwise: Arbiter Consensus, Candidate Promotion, Sizing & Price Ladders", () => {
  let storage: MockDualLayerStorage;
  let market: MockMarketEngine;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
    market = new MockMarketEngine();
  });

  it("1. Parses multi-LLM research outputs and extracts structured trade setups", () => {
    const geminiRaw = "CRWV HALO TWLO SPY QQQ favorable CPI tame";
    const claudeRaw = "MTRN ATRO LITE SPY QQQ favorable VIX low";
    const chatgptRaw = "GLBE NIQ ATRO SPY QQQ favorable PPI in range";

    const geminiReport = parseReportContent(geminiRaw, "Gemini");
    const claudeReport = parseReportContent(claudeRaw, "Claude");
    const chatgptReport = parseReportContent(chatgptRaw, "ChatGPT");

    expect(geminiReport.marketRegime).toBe("FAVORABLE");
    expect(claudeReport.marketRegime).toBe("FAVORABLE");
    expect(chatgptReport.marketRegime).toBe("FAVORABLE");

    expect(geminiReport.candidates.length).toBeGreaterThanOrEqual(3);
    expect(claudeReport.candidates.length).toBeGreaterThanOrEqual(3);
    expect(chatgptReport.candidates.length).toBeGreaterThanOrEqual(3);

    // Verify candidate fields
    const atro = claudeReport.candidates.find(c => c.ticker === "ATRO");
    expect(atro).toBeDefined();
    expect(atro?.entryTrigger).toBe(89.20);
    expect(atro?.stopLoss).toBe(83.75);
    expect(atro?.target1).toBe(100.10);
  });

  it("2. Synthesizes multi-model arbiter plan and awards +5 consensus bonus to cross-model picks", () => {
    const geminiReport = parseReportContent("CRWV HALO TWLO ATRO SPY QQQ favorable", "Gemini");
    const claudeReport = parseReportContent("MTRN ATRO LITE SPY QQQ favorable", "Claude");
    const chatgptReport = parseReportContent("GLBE NIQ ATRO SPY QQQ favorable", "ChatGPT");

    const arbiterPlan = synthesizeArbiterPlan(
      geminiReport,
      claudeReport,
      chatgptReport,
      15000.0, // $15,000 sleeve
      1.0      // 1.0% risk ($150 risk budget)
    );

    expect(arbiterPlan.marketRegime).toBe("FAVORABLE");
    expect(arbiterPlan.masterSetups.length).toBeGreaterThanOrEqual(5);

    // ATRO was recommended by Gemini, Claude, and ChatGPT (3 models)
    const atroSetup = arbiterPlan.masterSetups.find(s => s.ticker === "ATRO");
    expect(atroSetup).toBeDefined();
    expect(atroSetup?.isConsensusPick).toBe(true);
    expect(atroSetup?.consensusCount).toBe(3);
    expect(atroSetup?.modelsAgreed).toContain("Claude");
    expect(atroSetup?.modelsAgreed).toContain("ChatGPT");
    expect(atroSetup?.modelsAgreed).toContain("Gemini");

    // Consensus picks should appear first in sorted masterSetups
    expect(arbiterPlan.masterSetups[0].isConsensusPick).toBe(true);
  });

  it("3. Normalizes 1% risk position sizing mathematically for $15,000 sleeve account", () => {
    const claudeReport = parseReportContent("MTRN ATRO LITE SPY QQQ favorable", "Claude");
    const plan = synthesizeArbiterPlan(claudeReport, undefined, undefined, 15000.0, 1.0);

    const atro = plan.masterSetups.find(s => s.ticker === "ATRO")!;
    // Entry: 89.20, Stop: 83.75, Risk/Share: 5.45
    // Risk Budget = $15,000 * 1% = $150.00
    // Shares = floor(150 / 5.45) = 27 shares
    // Total Dollar Risk = 27 * 5.45 = $147.15
    expect(atro.normalizedShares).toBe(27);
    expect(atro.normalizedRisk).toBe(147.15);
    expect(atro.normalizedRisk).toBeLessThanOrEqual(150.0);

    const mtrn = plan.masterSetups.find(s => s.ticker === "MTRN")!;
    // Entry: 282.00, Stop: 270.50, Risk/Share: 11.50
    // Shares = floor(150 / 11.50) = 13 shares
    // Total Dollar Risk = 13 * 11.50 = $149.50
    expect(mtrn.normalizedShares).toBe(13);
    expect(mtrn.normalizedRisk).toBe(149.50);
  });

  it("4. Calculates complete 4-tier visual price ladder metrics with R-multiples and % distances", () => {
    const claudeReport = parseReportContent("ATRO SPY QQQ favorable", "Claude");
    const plan = synthesizeArbiterPlan(claudeReport, undefined, undefined, 15000.0, 1.0);
    const setup = plan.masterSetups.find(s => s.ticker === "ATRO")!;

    // 4-Tier Ladder: Stop -> Entry -> Target 1 -> Target 2
    const stopPrice = setup.stopLoss; // 83.75
    const entryPrice = setup.entryTrigger; // 89.20
    const t1Price = setup.target1; // 100.10
    const t2Price = setup.target2; // 112.00
    const riskDistance = entryPrice - stopPrice; // 5.45

    const stopPct = Number((((stopPrice - entryPrice) / entryPrice) * 100).toFixed(2)); // -6.11%
    const t1Pct = Number((((t1Price - entryPrice) / entryPrice) * 100).toFixed(2)); // +12.22%
    const t2Pct = Number((((t2Price - entryPrice) / entryPrice) * 100).toFixed(2)); // +25.56%
    const t1R = Number(((t1Price - entryPrice) / riskDistance).toFixed(2)); // 2.00R
    const t2R = Number(((t2Price - entryPrice) / riskDistance).toFixed(2)); // 4.18R

    expect(stopPrice).toBe(83.75);
    expect(entryPrice).toBe(89.20);
    expect(t1Price).toBe(100.10);
    expect(t2Price).toBe(112.00);

    expect(stopPct).toBeCloseTo(-6.11, 2);
    expect(t1Pct).toBeCloseTo(12.22, 2);
    expect(t2Pct).toBeCloseTo(25.56, 2);
    expect(t1R).toBe(2.0);
    expect(t2R).toBeGreaterThanOrEqual(3.5);
  });

  it("5. Promotes candidate setup to Pending Watch Order with full sizing math and persistence", () => {
    const claudeReport = parseReportContent("ATRO SPY QQQ favorable", "Claude");
    const plan = synthesizeArbiterPlan(claudeReport, undefined, undefined, 15000.0, 1.0);
    const candidate = plan.masterSetups.find(s => s.ticker === "ATRO")!;

    // 1-Click Promote to Pending Watch Queue
    const pendingTrade: StoredTrade = {
      id: `trade_promoted_${candidate.ticker.toLowerCase()}`,
      ticker: candidate.ticker,
      companyName: candidate.companyName,
      status: "PENDING_ENTRY",
      setupType: candidate.setupType,
      entryTrigger: candidate.entryTrigger,
      sharesTotal: candidate.normalizedShares,
      sharesRemaining: candidate.normalizedShares,
      initialStop: candidate.stopLoss,
      currentStop: candidate.stopLoss,
      target1: candidate.target1,
      target2: candidate.target2,
      rrRatio: candidate.rrRatio,
      timeStopSessions: candidate.timeStopDays,
      sessionsElapsed: 0,
      notes: `Promoted from Screener. Catalyst: ${candidate.catalystSummary}`,
    };

    storage.addOrUpdateTrade(pendingTrade);
    const trades = storage.getTrades();

    expect(trades).toHaveLength(1);
    expect(trades[0].ticker).toBe("ATRO");
    expect(trades[0].status).toBe("PENDING_ENTRY");
    expect(trades[0].sharesTotal).toBe(27);
    expect(trades[0].initialStop).toBe(83.75);
    expect(trades[0].notes).toContain("Record Q2 sales");
  });

  it("6. Promotes candidate setup directly to ACTIVE Trade with instant fill and entry notification", () => {
    const chatgptReport = parseReportContent("GLBE SPY QQQ favorable", "ChatGPT");
    const plan = synthesizeArbiterPlan(undefined, undefined, chatgptReport, 15000.0, 1.0);
    const candidate = plan.masterSetups.find(s => s.ticker === "GLBE")!;

    // Promote directly to ACTIVE with fill at trigger
    const activeTrade: StoredTrade = {
      id: `trade_active_${candidate.ticker.toLowerCase()}`,
      ticker: candidate.ticker,
      companyName: candidate.companyName,
      status: "ACTIVE",
      setupType: candidate.setupType,
      entryTrigger: candidate.entryTrigger,
      actualEntry: candidate.entryTrigger,
      entryDate: new Date().toISOString(),
      sharesTotal: candidate.normalizedShares,
      sharesRemaining: candidate.normalizedShares,
      initialStop: candidate.stopLoss,
      currentStop: candidate.stopLoss,
      target1: candidate.target1,
      target2: candidate.target2,
      rrRatio: candidate.rrRatio,
      timeStopSessions: candidate.timeStopDays,
      sessionsElapsed: 0,
      notes: `Active Swing Trade. Model: ${candidate.modelsAgreed.join(", ")}`,
    };

    storage.addOrUpdateTrade(activeTrade);

    // Generate entry notification
    const notif = storage.addNotification({
      ticker: activeTrade.ticker,
      type: "ENTRY_TRIGGERED",
      title: `Position Opened: ${activeTrade.ticker}`,
      message: `Entered ${activeTrade.sharesTotal} shares at $${activeTrade.actualEntry?.toFixed(2)}. Hard stop placed at $${activeTrade.initialStop.toFixed(2)}.`,
      isRead: false,
    });

    expect(storage.getTrades()).toHaveLength(1);
    expect(storage.getTrades()[0].status).toBe("ACTIVE");
    expect(storage.getNotifications()).toHaveLength(1);
    expect(notif.type).toBe("ENTRY_TRIGGERED");
    expect(notif.title).toContain("GLBE");
  });

  it("7. Handles hostile desk regime synthesis when multiple models detect hostile conditions", () => {
    const hostileGemini = parseReportContent("SPY QQQ hostile breakdown high VIX macro shock", "Gemini");
    const hostileClaude = parseReportContent("SPY QQQ hostile trend broken distribution days", "Claude");
    const neutralGpt = parseReportContent("SPY QQQ neutral consolidation", "ChatGPT");

    const plan = synthesizeArbiterPlan(hostileGemini, hostileClaude, neutralGpt, 15000.0, 1.0);

    // Hostile count >= 2 => Desk Regime = HOSTILE
    expect(plan.marketRegime).toBe("HOSTILE");
  });

  it("8. Re-evaluates promoted trades against live market quotes immediately on dashboard", () => {
    const claudeReport = parseReportContent("ATRO SPY QQQ favorable", "Claude");
    const plan = synthesizeArbiterPlan(claudeReport, undefined, undefined, 15000.0, 1.0);
    const candidate = plan.masterSetups.find(s => s.ticker === "ATRO")!;

    const activeTrade: StoredTrade = {
      id: "live_eval_atro",
      ticker: "ATRO",
      companyName: candidate.companyName,
      status: "ACTIVE",
      entryTrigger: candidate.entryTrigger,
      actualEntry: 89.20,
      sharesTotal: candidate.normalizedShares,
      sharesRemaining: candidate.normalizedShares,
      initialStop: candidate.stopLoss,
      currentStop: candidate.stopLoss,
      target1: candidate.target1,
      target2: candidate.target2,
      rrRatio: candidate.rrRatio,
      timeStopSessions: candidate.timeStopDays,
      sessionsElapsed: 1,
    };
    storage.addOrUpdateTrade(activeTrade);

    // Live quote update: ATRO at $94.65 (+1.0R gain)
    market.setPrice("ATRO", 94.65);
    const evalRes = evaluateTrade(activeTrade, market.getQuote("ATRO"));

    expect(evalRes.currentPrice).toBe(94.65);
    expect(evalRes.currentRMultiple).toBe(1.0);
    expect(evalRes.unrealizedPnL).toBeCloseTo(147.15, 1); // 27 shares * $5.45
    expect(evalRes.alertType).toBeUndefined(); // Healthy hold, no target/stop triggered yet
  });

  it("9. Preserves bear case and risk thesis through candidate promotion lifecycle", () => {
    const geminiReport = parseReportContent("CRWV HALO TWLO SPY QQQ favorable", "Gemini");
    const plan = synthesizeArbiterPlan(geminiReport, undefined, undefined, 15000.0, 1.0);
    const halo = plan.masterSetups.find(s => s.ticker === "HALO")!;

    expect(halo.bearCase).toContain("Extended +34%");
    expect(halo.catalystSummary).toContain("Q2 rev $481M");

    const trade: StoredTrade = {
      id: "trade_halo_risk_thesis",
      ticker: halo.ticker,
      companyName: halo.companyName,
      status: "PENDING_ENTRY",
      entryTrigger: halo.entryTrigger,
      sharesTotal: halo.normalizedShares,
      sharesRemaining: halo.normalizedShares,
      initialStop: halo.stopLoss,
      currentStop: halo.stopLoss,
      target1: halo.target1,
      target2: halo.target2,
      rrRatio: halo.rrRatio,
      timeStopSessions: halo.timeStopDays,
      sessionsElapsed: 0,
      notes: `Thesis: ${halo.catalystSummary} | Bear Case: ${halo.bearCase}`,
    };

    storage.addOrUpdateTrade(trade);
    const saved = storage.getTrades().find(t => t.id === "trade_halo_risk_thesis");
    expect(saved?.notes).toContain("Bear Case: Extended +34%");
  });

  it("10. Scales position sizing dynamically for different account size parameters ($25,000 sleeve)", () => {
    const claudeReport = parseReportContent("ATRO SPY QQQ favorable", "Claude");
    
    // Test with $25,000 sleeve account at 1% risk ($250 risk budget)
    const plan25k = synthesizeArbiterPlan(claudeReport, undefined, undefined, 25000.0, 1.0);
    const atro25k = plan25k.masterSetups.find(s => s.ticker === "ATRO")!;

    // Risk budget = $250.00, Risk/share = $5.45
    // Shares = floor(250 / 5.45) = 45 shares
    // Total Dollar Risk = 45 * 5.45 = $245.25
    expect(atro25k.normalizedShares).toBe(45);
    expect(atro25k.normalizedRisk).toBe(245.25);
    expect(atro25k.normalizedRisk).toBeLessThanOrEqual(250.0);
  });
});
