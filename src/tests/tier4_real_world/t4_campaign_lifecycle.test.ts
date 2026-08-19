// Tier 4 Real-World Workload Scenario Test: End-to-End Multi-Day Swing Trade Campaign Lifecycle
// Requirements: ORIGINAL_REQUEST §R2.1, §R2.2, §R2.3, §R3.1, §R4.1, §R4.3

import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade } from "../helpers/mock-storage";
import { MockMarketEngine } from "../helpers/mock-market";
import { parseReportContent } from "../../lib/ai/parser";
import { synthesizeArbiterPlan } from "../../lib/ai/arbiter";
import { evaluateTrade } from "../../lib/market/rule-engine";

describe("Tier 4 Scenario: End-to-End Multi-Day Swing Trade Campaign Lifecycles", () => {
  let storage: MockDualLayerStorage;
  let market: MockMarketEngine;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
    market = new MockMarketEngine();
  });

  it("Campaign 1: The Textbook 5-Day Swing Campaign (Consensus Ingestion -> 1% Sizing -> T1 Scale -> T2 Max Runner Exit -> +3.13R Journal)", () => {
    // Day 0: Research Ingestion & Consensus Arbiter
    const geminiReport = parseReportContent("CRWV HALO ATRO SPY QQQ favorable CPI tame", "Gemini");
    const claudeReport = parseReportContent("MTRN ATRO LITE SPY QQQ favorable VIX low", "Claude");
    const chatgptReport = parseReportContent("GLBE NIQ ATRO SPY QQQ favorable PPI in range", "ChatGPT");

    const settings = storage.getSettings();
    const plan = synthesizeArbiterPlan(geminiReport, claudeReport, chatgptReport, settings.accountSize, settings.riskPerTrade);

    const candidate = plan.masterSetups.find(s => s.ticker === "ATRO")!;
    expect(candidate.isConsensusPick).toBe(true);
    expect(candidate.normalizedShares).toBe(27);

    // Day 1: Execution at Market Open ($89.20 Entry)
    const trade: StoredTrade = {
      id: "campaign_atro_1",
      ticker: "ATRO",
      companyName: "Astronics Corporation",
      status: "ACTIVE",
      setupType: "Base Breakout",
      entryTrigger: 89.20,
      actualEntry: 89.20,
      entryDate: market.getSessionInfo().dateIso,
      sharesTotal: 27,
      sharesRemaining: 27,
      initialStop: 83.75,
      currentStop: 83.75,
      target1: 100.10,
      target2: 112.00,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 1,
      notes: "Consensus 3-model breakout trade",
    };
    storage.addOrUpdateTrade(trade);

    // Day 2-3: Holding Phase & Advance Sessions
    market.advanceSession(2);
    market.setPrice("ATRO", 94.65); // Consolidating at +1.0R
    trade.sessionsElapsed = 3;
    let evalRes = evaluateTrade(trade, market.getQuote("ATRO"));
    expect(evalRes.currentRMultiple).toBe(1.0);
    expect(evalRes.alertType).toBeUndefined(); // Normal constructive hold

    // Day 4: Surges to $100.50 (Hits Target 1) -> 1-Click Scale 50%
    market.advanceSession(1);
    market.setPrice("ATRO", 100.50);
    trade.sessionsElapsed = 4;
    evalRes = evaluateTrade(trade, market.getQuote("ATRO"));
    expect(evalRes.alertType).toBe("TARGET_1_HIT");

    // Execute Scale 50%: Sell 14 shares, raise stop to Breakeven $89.20 on 13 shares
    const scaledCount = Math.ceil(trade.sharesTotal / 2); // 14 shares
    const remainingCount = trade.sharesTotal - scaledCount; // 13 shares
    const t1Realized = Number(((100.50 - 89.20) * scaledCount).toFixed(2)); // $158.20

    trade.status = "SCALED_T1";
    trade.sharesRemaining = remainingCount;
    trade.currentStop = 89.20; // Breakeven floor
    trade.realizedPnL = t1Realized;
    trade.notes = `Day 4: Scaled 14 shares at $100.50 (+$158.20). Stop moved to Breakeven.`;
    storage.addOrUpdateTrade(trade);

    expect(storage.getTrades().find(t => t.id === "campaign_atro_1")?.sharesRemaining).toBe(13);
    expect(storage.getTrades().find(t => t.id === "campaign_atro_1")?.currentStop).toBe(89.20);

    // Day 5: Runner reaches Target 2 ($112.50) -> Close Full Campaign
    market.advanceSession(1);
    market.setPrice("ATRO", 112.50);
    trade.sessionsElapsed = 5;
    evalRes = evaluateTrade(trade, market.getQuote("ATRO"));
    expect(evalRes.alertType).toBe("TARGET_2_HIT");
    expect(evalRes.shouldAutoClose).toBe(true);

    const t2Realized = Number(((112.50 - 89.20) * remainingCount).toFixed(2)); // 13 * 23.30 = $302.90
    const totalCampaignPnL = Number((t1Realized + t2Realized).toFixed(2)); // $158.20 + $302.90 = $461.10
    const totalRiskBudget = (89.20 - 83.75) * 27; // $147.15
    const finalR = Number((totalCampaignPnL / totalRiskBudget).toFixed(2)); // +3.13R

    trade.status = "CLOSED";
    trade.sharesRemaining = 0;
    trade.closedPrice = 112.50;
    trade.closedDate = market.getSessionInfo().dateIso;
    trade.realizedPnL = totalCampaignPnL;
    trade.rMultiple = finalR;
    trade.exitReason = "TARGET_2_REACHED";

    storage.addOrUpdateTrade(trade);

    // Validate closed journal record
    const closed = storage.getTrades().find(t => t.id === "campaign_atro_1");
    expect(closed?.status).toBe("CLOSED");
    expect(closed?.realizedPnL).toBe(461.10);
    expect(closed?.rMultiple).toBe(3.13);
    expect(closed?.sessionsElapsed).toBe(5);
  });

  it("Campaign 2: 4-Day Scaled Runner Breakeven Exit (MTRN -> T1 Scale -> Retracement Stop -> +1.08R Net Win)", () => {
    // Day 1: Enter MTRN on Post-Earnings Pullback ($282.00, Stop $270.50, Shares: 13, Risk: $149.50)
    const trade: StoredTrade = {
      id: "campaign_mtrn_2",
      ticker: "MTRN",
      companyName: "Materion Corporation",
      status: "ACTIVE",
      setupType: "Post-Earnings Pullback",
      entryTrigger: 282.00,
      actualEntry: 282.00,
      entryDate: market.getSessionInfo().dateIso,
      sharesTotal: 13,
      sharesRemaining: 13,
      initialStop: 270.50,
      currentStop: 270.50,
      target1: 305.00,
      target2: 328.00,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 1,
    };
    storage.addOrUpdateTrade(trade);

    // Day 2: Price hits Target 1 ($305.00, +2.0R)
    market.advanceSession(1);
    market.setPrice("MTRN", 305.00);
    trade.sessionsElapsed = 2;
    const evalRes = evaluateTrade(trade, market.getQuote("MTRN"));
    expect(evalRes.alertType).toBe("TARGET_1_HIT");

    // Scale 50% (7 shares at $305.00 = +$161.00 gain), raise stop to Breakeven $282.00 on 6 shares
    const scaledCount = Math.ceil(trade.sharesTotal / 2); // 7 shares
    const remainder = trade.sharesTotal - scaledCount; // 6 shares
    const t1Gain = (305.00 - 282.00) * scaledCount; // $161.00

    trade.status = "SCALED_T1";
    trade.sharesRemaining = remainder;
    trade.currentStop = 282.00;
    trade.realizedPnL = t1Gain;
    storage.addOrUpdateTrade(trade);

    // Day 3-4: Resistance rejects rally, price rolls over to $282.00
    market.advanceSession(2);
    market.setPrice("MTRN", 282.00);
    trade.sessionsElapsed = 4;
    const stopEval = evaluateTrade(trade, market.getQuote("MTRN"));
    expect(stopEval.alertType).toBe("STOP_ALERT");

    // Liquidate remaining 6 shares at Breakeven ($282.00)
    const finalLegLoss = (282.00 - 282.00) * remainder; // $0.00
    const totalCampaignPnL = t1Gain + finalLegLoss; // $161.00
    const campaignR = Number((totalCampaignPnL / 149.50).toFixed(2)); // +1.08R

    trade.status = "CLOSED";
    trade.sharesRemaining = 0;
    trade.closedPrice = 282.00;
    trade.closedDate = market.getSessionInfo().dateIso;
    trade.realizedPnL = totalCampaignPnL;
    trade.rMultiple = campaignR;
    trade.exitReason = "BREAKEVEN_STOP";

    storage.addOrUpdateTrade(trade);

    const closed = storage.getTrades().find(t => t.id === "campaign_mtrn_2");
    expect(closed?.status).toBe("CLOSED");
    expect(closed?.realizedPnL).toBe(161.00);
    expect(closed?.rMultiple).toBe(1.08); // Successfully locked in positive campaign
  });

  it("Campaign 3: Invalidation Discipline on Gap Down (NIQ -> Stop Honor -> -1.07R Disciplined Loss)", () => {
    // Day 1: Entry at $16.25, Hard Stop $14.90 (111 shares, $149.85 risk)
    const trade: StoredTrade = {
      id: "campaign_niq_3",
      ticker: "NIQ",
      companyName: "NIQ Global Intelligence",
      status: "ACTIVE",
      setupType: "High-Tight Flag",
      entryTrigger: 16.25,
      actualEntry: 16.25,
      entryDate: market.getSessionInfo().dateIso,
      sharesTotal: 111,
      sharesRemaining: 111,
      initialStop: 14.90,
      currentStop: 14.90,
      target1: 18.95,
      target2: 21.00,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 1,
    };
    storage.addOrUpdateTrade(trade);

    // Day 2: Market gap down on macro news: opens at $14.80
    market.advanceSession(1);
    market.setPrice("NIQ", 14.80);
    trade.sessionsElapsed = 2;
    const evalRes = evaluateTrade(trade, market.getQuote("NIQ"));

    expect(evalRes.alertType).toBe("STOP_ALERT");
    expect(evalRes.shouldAutoClose).toBe(true);

    // Trader honors stop without hesitation
    const loss = Number(((14.80 - 16.25) * 111).toFixed(2)); // -$160.95
    const rMultiple = Number((loss / 149.85).toFixed(2)); // -1.07R

    trade.status = "CLOSED";
    trade.sharesRemaining = 0;
    trade.closedPrice = 14.80;
    trade.closedDate = market.getSessionInfo().dateIso;
    trade.realizedPnL = loss;
    trade.rMultiple = rMultiple;
    trade.exitReason = "HARD_STOP";
    trade.notes = "Honored hard stop promptly on gap down.";

    storage.addOrUpdateTrade(trade);

    const closed = storage.getTrades().find(t => t.id === "campaign_niq_3");
    expect(closed?.status).toBe("CLOSED");
    expect(closed?.realizedPnL).toBe(-160.95);
    expect(closed?.rMultiple).toBe(-1.07);
  });

  it("Campaign 4: Multi-Asset Rotational Sleeve Progression over 7 Sessions", () => {
    // Session 1: Open ATRO (Aerospace) and GLBE (Tech)
    const atro: StoredTrade = {
      id: "rot_atro",
      ticker: "ATRO",
      companyName: "Astronics Corporation",
      status: "ACTIVE",
      setupType: "Aerospace & Defense Breakout",
      entryTrigger: 88.50,
      actualEntry: 88.50,
      sharesTotal: 27,
      sharesRemaining: 27,
      initialStop: 83.75,
      currentStop: 83.75,
      target1: 98.00,
      target2: 108.00,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 1,
    };
    const glbe: StoredTrade = {
      id: "rot_glbe",
      ticker: "GLBE",
      companyName: "Global-e Online Ltd.",
      status: "ACTIVE",
      setupType: "Technology Continuation",
      entryTrigger: 42.60,
      actualEntry: 42.60,
      sharesTotal: 62,
      sharesRemaining: 62,
      initialStop: 40.20,
      currentStop: 40.20,
      target1: 47.40,
      target2: 51.00,
      rrRatio: 2.0,
      timeStopSessions: 7,
      sessionsElapsed: 1,
    };
    storage.saveTrades([atro, glbe]);

    // Session 3: ATRO hits T1 ($98.00) -> Scale 50%, free risk capacity
    market.advanceSession(2);
    market.setPrice("ATRO", 98.00);
    atro.status = "SCALED_T1";
    atro.sharesRemaining = 13;
    atro.currentStop = 88.50; // Breakeven
    atro.realizedPnL = 133.00;
    atro.sessionsElapsed = 3;
    storage.addOrUpdateTrade(atro);

    // Session 4: Open 3rd Trade: MTRN (Materials) using freed risk capacity
    const mtrn: StoredTrade = {
      id: "rot_mtrn",
      ticker: "MTRN",
      companyName: "Materion Corporation",
      status: "ACTIVE",
      setupType: "Materials Pullback",
      entryTrigger: 282.00,
      actualEntry: 282.00,
      sharesTotal: 13,
      sharesRemaining: 13,
      initialStop: 270.50,
      currentStop: 270.50,
      target1: 305.00,
      target2: 328.00,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 1,
    };
    storage.addOrUpdateTrade(mtrn);

    expect(storage.getTrades().filter(t => t.status === "ACTIVE" || t.status === "SCALED_T1")).toHaveLength(3);

    // Session 7: ATRO hits T2 ($108.00) -> Closed. GLBE reaches T1 ($47.40) -> Scaled.
    market.advanceSession(3);
    market.setPrice("ATRO", 108.00);
    market.setPrice("GLBE", 47.40);

    atro.status = "CLOSED";
    atro.sharesRemaining = 0;
    atro.closedPrice = 108.00;
    atro.realizedPnL = 133.00 + (108.00 - 88.50) * 13; // $133 + $253.50 = $386.50
    atro.rMultiple = 2.97;
    atro.exitReason = "TARGET_2_REACHED";
    atro.sessionsElapsed = 7;
    storage.addOrUpdateTrade(atro);

    glbe.status = "SCALED_T1";
    glbe.sharesRemaining = 31;
    glbe.currentStop = 42.60;
    glbe.realizedPnL = 148.80;
    glbe.sessionsElapsed = 7;
    storage.addOrUpdateTrade(glbe);

    const allTrades = storage.getTrades();
    const closedTrades = allTrades.filter(t => t.status === "CLOSED");
    const activeAndScaled = allTrades.filter(t => t.status === "ACTIVE" || t.status === "SCALED_T1");

    expect(closedTrades).toHaveLength(1);
    expect(closedTrades[0].realizedPnL).toBe(386.50);
    expect(activeAndScaled).toHaveLength(2);
  });
});
