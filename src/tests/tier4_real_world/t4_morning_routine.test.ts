// Tier 4 Real-World Workload Scenario Test: Pre-Market Opening Routine & Watch Queue Execution
// Requirements: ORIGINAL_REQUEST §R1.1, §R1.2, §R3.2, §R4.1, §R4.3, §R6.1

import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade } from "../helpers/mock-storage";
import { MockMarketEngine } from "../helpers/mock-market";
import { parseReportContent } from "../../lib/ai/parser";
import { synthesizeArbiterPlan } from "../../lib/ai/arbiter";
import { generateDailyPortfolioReport } from "../../lib/portfolio/daily-report";
import { evaluateTrade } from "../../lib/market/rule-engine";

describe("Tier 4 Scenario: Pre-Market Opening Routine, Screener Consensus & Watch Queue Execution", () => {
  let storage: MockDualLayerStorage;
  let market: MockMarketEngine;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
    market = new MockMarketEngine();
  });

  it("Journey 1: Desk Authentication, Tactical Briefing Generation & 1-Click Markdown Copy", () => {
    // 1. PIN Authentication
    const settings = storage.getSettings();
    const enteredPasscode = "1234";
    const isPasscodeValid = enteredPasscode === settings.deskPasscode;
    expect(isPasscodeValid).toBe(true);

    // 2. Active Trade in Portfolio approaching Target 1
    const activeTrade: StoredTrade = {
      id: "tr_morn_1",
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
      target1: 100.10,
      target2: 112.00,
      rrRatio: 2.44,
      timeStopSessions: 6,
      sessionsElapsed: 2,
      notes: "Holding post-earnings consolidation",
    };
    storage.addOrUpdateTrade(activeTrade);

    // Market quote near T1 ($98.50)
    market.setPrice("ATRO", 98.50);

    // 3. Generate Morning Tactical Briefing
    const report = generateDailyPortfolioReport(
      storage.getTrades(),
      market.getAllQuotes(),
      settings.accountSize,
      "FAVORABLE"
    );

    expect(report.marketRegime).toBe("FAVORABLE");
    expect(report.portfolioSummary.totalOpenPositions).toBe(1);
    expect(report.actionItems.length).toBeGreaterThanOrEqual(1);

    // 4. Verify 1-Click Copy Briefing Markdown export
    const formatBriefingMarkdown = (rep: typeof report): string => {
      let md = `# Daily Tactical Moves Briefing — ${new Date().toISOString().split("T")[0]}\n\n`;
      md += `**Market Regime:** ${rep.marketRegime}\n`;
      md += `**Open Positions:** ${rep.portfolioSummary.totalOpenPositions} | **Open Risk:** $${rep.portfolioSummary.aggregateRiskDollars} (${rep.portfolioSummary.aggregateRiskPct}%)\n\n`;
      md += `## Prioritized Action Items\n`;
      rep.actionItems.forEach((item, idx) => {
        md += `### ${idx + 1}. [${item.urgency}] ${item.ticker} — ${item.headline}\n`;
        md += `- **Details:** ${item.details}\n`;
        md += `- **Suggested Order:** \`${item.suggestedOrder}\`\n\n`;
      });
      md += `## Desk Checklist\n`;
      rep.deskChecklist.forEach(c => {
        md += `- [ ] ${c}\n`;
      });
      return md;
    };

    const copiedMarkdown = formatBriefingMarkdown(report);
    expect(copiedMarkdown).toContain("# Daily Tactical Moves Briefing");
    expect(copiedMarkdown).toContain("FAVORABLE");
    expect(copiedMarkdown).toContain("ATRO");
    expect(copiedMarkdown).toContain("Desk Checklist");
  });

  it("Journey 2: Multi-LLM Opportunity Screening, Arbiter Synthesis & Watch Queue Promotion", () => {
    // 1. Ingest Multi-LLM research reports
    const geminiReport = parseReportContent("CRWV HALO ATRO SPY QQQ favorable CPI tame", "Gemini");
    const claudeReport = parseReportContent("MTRN ATRO LITE SPY QQQ favorable VIX low", "Claude");
    const chatgptReport = parseReportContent("GLBE NIQ ATRO SPY QQQ favorable PPI in range", "ChatGPT");

    // 2. Synthesize Arbiter Plan
    const settings = storage.getSettings();
    const plan = synthesizeArbiterPlan(geminiReport, claudeReport, chatgptReport, settings.accountSize, settings.riskPerTrade);

    expect(plan.marketRegime).toBe("FAVORABLE");
    expect(plan.consensusHighlight).toContain("ATRO");

    // 3. Select top consensus candidate (ATRO)
    const topCandidate = plan.masterSetups.find(s => s.ticker === "ATRO")!;
    expect(topCandidate.isConsensusPick).toBe(true);
    expect(topCandidate.consensusCount).toBe(3);
    expect(topCandidate.normalizedShares).toBe(27); // $150 risk budget / $5.45 stop

    // 4. 1-Click Candidate Promotion to Pending Watch Order
    const watchOrder: StoredTrade = {
      id: `trade_watch_${topCandidate.ticker.toLowerCase()}`,
      ticker: topCandidate.ticker,
      companyName: topCandidate.companyName,
      status: "PENDING_ENTRY",
      setupType: topCandidate.setupType,
      entryTrigger: topCandidate.entryTrigger,
      sharesTotal: topCandidate.normalizedShares,
      sharesRemaining: topCandidate.normalizedShares,
      initialStop: topCandidate.stopLoss,
      currentStop: topCandidate.stopLoss,
      target1: topCandidate.target1,
      target2: topCandidate.target2,
      rrRatio: topCandidate.rrRatio,
      timeStopSessions: topCandidate.timeStopDays,
      sessionsElapsed: 0,
      notes: `Consensus Pick (${topCandidate.modelsAgreed.join("+")}). Catalyst: ${topCandidate.catalystSummary}`,
    };

    storage.addOrUpdateTrade(watchOrder);

    const savedTrades = storage.getTrades();
    expect(savedTrades).toHaveLength(1);
    expect(savedTrades[0].ticker).toBe("ATRO");
    expect(savedTrades[0].status).toBe("PENDING_ENTRY");
  });

  it("Journey 3: Morning Market Open Gap & Instant Order Execution Lifecycle", () => {
    // Queued watch trade: ATRO awaiting $89.20 trigger
    const queuedTrade: StoredTrade = {
      id: "tr_watch_atro",
      ticker: "ATRO",
      companyName: "Astronics Corporation",
      status: "PENDING_ENTRY",
      entryTrigger: 89.20,
      sharesTotal: 27,
      sharesRemaining: 27,
      initialStop: 83.75,
      currentStop: 83.75,
      target1: 100.10,
      target2: 112.00,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 0,
    };
    storage.addOrUpdateTrade(queuedTrade);

    // Market opens at 9:30 AM: Price gaps up to $89.50 (crossing above $89.20)
    market.setPrice("ATRO", 89.50);
    const evalRes = evaluateTrade(queuedTrade, market.getQuote("ATRO"));

    expect(evalRes.alertType).toBe("ENTRY_TRIGGERED");
    expect(evalRes.alertTitle).toContain("Entry Trigger Activated");

    // Notification generated
    const notification = storage.addNotification({
      ticker: queuedTrade.ticker,
      type: "ENTRY_TRIGGERED",
      title: evalRes.alertTitle || "Entry Trigger Activated",
      message: evalRes.alertMessage || "Trigger reached",
      isRead: false,
    });
    expect(notification.type).toBe("ENTRY_TRIGGERED");

    // User executes 1-Click "Fill Entry Now" at market ($89.50)
    queuedTrade.status = "ACTIVE";
    queuedTrade.actualEntry = 89.50;
    queuedTrade.entryDate = new Date().toISOString();
    queuedTrade.notes = "Filled at market on opening gap";

    storage.addOrUpdateTrade(queuedTrade);

    const activeTrade = storage.getTrades().find(t => t.id === "tr_watch_atro");
    expect(activeTrade?.status).toBe("ACTIVE");
    expect(activeTrade?.actualEntry).toBe(89.50);
    expect(activeTrade?.currentStop).toBe(83.75); // Hard stop intact
  });

  it("Journey 4: Pre-Bell Portfolio Risk, Sector Exposure & Capital Allocation Audit", () => {
    const settings = storage.getSettings();

    // 2 Active Trades in different sectors
    const active1: StoredTrade = {
      id: "t_audit_1",
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
    const active2: StoredTrade = {
      id: "t_audit_2",
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

    storage.saveTrades([active1, active2]);

    // Portfolio Summary Calculations
    const dedicatedCapital = settings.accountSize; // $15,000
    const allocatedCapital = (88.50 * 27) + (282.00 * 13); // $2,389.50 + $3,666.00 = $6,055.50
    const availableCash = dedicatedCapital - allocatedCapital; // $8,944.50
    const openRiskDollars = ((88.50 - 83.75) * 27) + ((282.00 - 270.50) * 13); // 128.25 + 149.50 = $277.75
    const openRiskPct = (openRiskDollars / dedicatedCapital) * 100; // 1.85%

    expect(dedicatedCapital).toBe(15000.0);
    expect(allocatedCapital).toBeCloseTo(6055.50, 2);
    expect(availableCash).toBeCloseTo(8944.50, 2);
    expect(openRiskDollars).toBeCloseTo(277.75, 2);
    expect(openRiskPct).toBeLessThan(3.0); // Within 3% sleeve cap

    // Sector exposure verification
    const report = generateDailyPortfolioReport(storage.getTrades(), market.getAllQuotes(), dedicatedCapital);
    expect(report.sectorExposure["Aerospace & Defense"]).toBe(1);
    expect(report.sectorExposure["Materials"]).toBe(1);
    expect(report.deskChecklist).toHaveLength(5);
  });

  it("Journey 5: Complex Morning Multi-Position Triage & Prioritized Execution", () => {
    // 3 active positions in different states:
    // 1. ATRO hitting Target 1 (urgent take profit)
    const atro: StoredTrade = {
      id: "t_atro",
      ticker: "ATRO",
      companyName: "Astronics Corporation",
      status: "ACTIVE",
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
      sessionsElapsed: 2,
    };
    // 2. GLBE approaching time stop (session 6 of 7)
    const glbe: StoredTrade = {
      id: "t_glbe",
      ticker: "GLBE",
      companyName: "Global-e Online Ltd.",
      status: "ACTIVE",
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
      sessionsElapsed: 6, // 6 of 7 sessions elapsed
    };
    // 3. MTRN pending entry order
    const mtrn: StoredTrade = {
      id: "t_mtrn",
      ticker: "MTRN",
      companyName: "Materion Corporation",
      status: "PENDING_ENTRY",
      entryTrigger: 282.00,
      sharesTotal: 13,
      sharesRemaining: 13,
      initialStop: 270.50,
      currentStop: 270.50,
      target1: 305.00,
      target2: 328.00,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 0,
    };

    storage.saveTrades([atro, glbe, mtrn]);

    market.setPrice("ATRO", 98.50); // Above T1
    market.setPrice("GLBE", 43.10); // Stalled near entry
    market.setPrice("MTRN", 280.00); // Coiling near trigger

    const report = generateDailyPortfolioReport(storage.getTrades(), market.getAllQuotes(), 15000.0);

    // High urgency items should include ATRO take profit and GLBE time stop warning
    const highUrgencyItems = report.actionItems.filter(i => i.urgency === "HIGH");
    expect(highUrgencyItems.length).toBeGreaterThanOrEqual(2);

    const atroAction = highUrgencyItems.find(i => i.ticker === "ATRO");
    const glbeAction = highUrgencyItems.find(i => i.ticker === "GLBE");

    expect(atroAction?.actionType).toBe("TAKE_PROFIT");
    expect(glbeAction?.actionType).toBe("TIME_STOP_WARNING");
  });
});
