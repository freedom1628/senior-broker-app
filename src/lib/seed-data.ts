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
          accountSize: 15000.0,
          riskPerTrade: 1.0,
        },
      });
    }

    const existingRun = await prisma.researchRun.findFirst({
      where: { userId: user.id },
    });

    if (!existingRun) {
      // 1. Parse initial model reports for opportunity research screener only (no open trades)
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
          geminiReport: "Gemini 3.7 Flash Institutional Deep Research (CRWV, HALO, TWLO)",
          chatgptReport: "OpenAI 5.6 Prop Desk Intelligence (GLBE, NIQ, ATRO)",
          claudeReport: "Claude Sonnet 5 Institutional Screen (MTRN, ATRO, LITE)",
        },
      });

      // 3. Create CandidateSetups for Screener
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
      // NO pre-populated sample trades! User starts with a clean 0-position slate.
    }
  } catch (error) {
    console.error("Error in ensureSeedData:", error);
  }
}
