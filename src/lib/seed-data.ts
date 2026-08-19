import { prisma } from "./prisma";
import { synthesizeArbiterPlan } from "./ai/arbiter";
import { parseReportContent } from "./ai/parser";

export async function ensureSeedData() {
  try {
    let user = await prisma.user.findFirst({
      where: { email: "trader@broker.com" },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: "trader@broker.com",
          name: "Senior Trader",
          accountSize: 10000.0,
          riskPerTrade: 1.0,
        },
      });
    }

    const existingRun = await prisma.researchRun.findFirst({
      where: { userId: user.id },
    });

    if (!existingRun) {
      // 1. Parse the three model reports
      const geminiParsed = parseReportContent("CRWV HALO TWLO SPY QQQ favorable CPI", "Gemini");
      const chatgptParsed = parseReportContent("GLBE NIQ ATRO SPY QQQ favorable PPI", "ChatGPT");
      const claudeParsed = parseReportContent("MTRN ATRO LITE SPY QQQ favorable VIX", "Claude");

      const arbiterPlan = synthesizeArbiterPlan(geminiParsed, claudeParsed, chatgptParsed, user.accountSize, user.riskPerTrade);

      // 2. Create ResearchRun
      const researchRun = await prisma.researchRun.create({
        data: {
          userId: user.id,
          marketRegime: arbiterPlan.marketRegime,
          regimeNotes: arbiterPlan.regimeNotes,
          macroFlags: arbiterPlan.macroFlags,
          arbiterSynthesis: arbiterPlan.consensusHighlight,
          geminiReport: "Gemini 2.0 Deep Research Screen (CRWV, HALO, TWLO)",
          chatgptReport: "ChatGPT Prop Desk Intelligence (GLBE, NIQ, ATRO)",
          claudeReport: "Claude 3.5 Sonnet Institutional Screen (MTRN, ATRO, LITE)",
        },
      });

      // 3. Create CandidateSetups
      for (const setup of arbiterPlan.masterSetups) {
        await prisma.candidateSetup.create({
          data: {
            researchRunId: researchRun.id,
            ticker: setup.ticker,
            companyName: setup.companyName,
            setupType: setup.setupType,
            entryTrigger: setup.entryTrigger,
            entryCondition: setup.entryCondition,
            stopLoss: setup.stopLoss,
            stopRationale: setup.stopRationale,
            target1: setup.target1,
            target2: setup.target2,
            rrRatio: setup.rrRatio,
            timeStopDays: setup.timeStopDays,
            positionShares: setup.positionShares,
            riskAmount: setup.riskAmount,
            catalystDate: setup.catalystDate,
            catalystSummary: setup.catalystSummary,
            bearCase: setup.bearCase,
            score: setup.score,
            modelSources: setup.modelsAgreed.join(", "),
            status: "WATCHLIST",
          },
        });
      }

      // 4. Seed initial sample trades across different lifecycle states:
      // Active Trade: ATRO (Consensus pick)
      await prisma.trade.create({
        data: {
          userId: user.id,
          ticker: "ATRO",
          companyName: "Astronics Corporation",
          status: "ACTIVE",
          setupType: "Fresh Earnings Gap / Pivot Breakout",
          entryTrigger: 89.20,
          actualEntry: 88.50,
          entryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          sharesTotal: 18,
          sharesRemaining: 18,
          initialStop: 83.75,
          currentStop: 83.75,
          target1: 100.10,
          target2: 112.00,
          rrRatio: 2.13,
          timeStopSessions: 5,
          sessionsElapsed: 2,
          notes: "Entered on post-earnings consolidation hold. Volume expanding 2x norm.",
        },
      });

      // Scaled T1 Trade: GLBE
      await prisma.trade.create({
        data: {
          userId: user.id,
          ticker: "GLBE",
          companyName: "Global-e Online Ltd.",
          status: "SCALED_T1",
          setupType: "Post-Earnings Continuation",
          entryTrigger: 42.60,
          actualEntry: 42.60,
          entryDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          sharesTotal: 41,
          sharesRemaining: 21,
          initialStop: 40.20,
          currentStop: 42.60, // Stop raised to Breakeven!
          target1: 48.00,
          target2: 52.00,
          rrRatio: 2.25,
          timeStopSessions: 7,
          sessionsElapsed: 4,
          realizedPnL: 113.40, // 20 shares scaled at $48.00 (+$5.40/sh)
          notes: "Scaled 50% at Target 1 ($48.00). Stop raised to Breakeven $42.60.",
        },
      });

      // Pending Entry: MTRN
      await prisma.trade.create({
        data: {
          userId: user.id,
          ticker: "MTRN",
          companyName: "Materion Corporation",
          status: "PENDING_ENTRY",
          setupType: "Post-Earnings Pullback Flag",
          entryTrigger: 282.00,
          entryCondition: "Reclaim $282.00 with 30-min bar close after test",
          sharesTotal: 8,
          sharesRemaining: 8,
          initialStop: 270.50,
          currentStop: 270.50,
          target1: 305.00,
          target2: 328.00,
          rrRatio: 2.0,
          timeStopSessions: 6,
          sessionsElapsed: 0,
          notes: "Awaiting pullback test of $278-$282 before trigger.",
        },
      });

      // Closed Trade: TWLO (History / Journal)
      await prisma.trade.create({
        data: {
          userId: user.id,
          ticker: "TWLO",
          companyName: "Twilio Inc.",
          status: "CLOSED",
          setupType: "Breakout Continuation",
          entryTrigger: 250.00,
          actualEntry: 250.00,
          entryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          sharesTotal: 4,
          sharesRemaining: 0,
          initialStop: 225.00,
          currentStop: 250.00,
          target1: 275.00,
          target2: 300.00,
          rrRatio: 2.0,
          timeStopSessions: 5,
          sessionsElapsed: 5,
          closedPrice: 278.50,
          closedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          realizedPnL: 114.00,
          rMultiple: 2.28,
          exitReason: "T1_REACHED",
          notes: "Hit Target 1 with strong momentum. Closed full position ahead of weekend.",
        },
      });

      // Sample Notifications
      await prisma.alertNotification.create({
        data: {
          userId: user.id,
          ticker: "ATRO",
          type: "ENTRY_TRIGGERED",
          title: "Entry Trigger Activated: ATRO",
          message: "ATRO broke through $89.20 pivot. 18 shares allocated at 1% account risk.",
          isRead: false,
        },
      });

      await prisma.alertNotification.create({
        data: {
          userId: user.id,
          ticker: "GLBE",
          type: "TARGET_1_HIT",
          title: "Target 1 Hit: GLBE (+2.25R)",
          message: "GLBE hit $48.00. Took 50% profit ($113.40 gain) and adjusted stop to Breakeven ($42.60).",
          isRead: true,
        },
      });
    }
  } catch (err) {
    console.error("Error in ensureSeedData:", err);
  }
}
