import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runModelResearch } from "@/lib/ai/runners";
import { parseReportContent } from "@/lib/ai/parser";
import { synthesizeArbiterPlan } from "@/lib/ai/arbiter";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      mode, // "automated" | "manual"
      geminiText,
      claudeText,
      chatgptText,
      manualText,
    } = body;

    const user = await prisma.user.findFirst({
      where: { email: "trader@broker.com" },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let geminiParsed, claudeParsed, chatgptParsed;

    if (mode === "manual") {
      if (manualText) {
        // Generic single paste
        geminiParsed = parseReportContent(manualText, "Imported Model");
      } else {
        if (geminiText) geminiParsed = parseReportContent(geminiText, "Gemini");
        if (claudeText) claudeParsed = parseReportContent(claudeText, "Claude");
        if (chatgptText) chatgptParsed = parseReportContent(chatgptText, "ChatGPT");
      }
    } else {
      // Automated runs
      const [gRes, cRes, chRes] = await Promise.all([
        runModelResearch("gemini", user.geminiKey || undefined),
        runModelResearch("claude", user.anthropicKey || undefined),
        runModelResearch("chatgpt", user.openaiKey || undefined),
      ]);
      geminiParsed = gRes.parsed;
      claudeParsed = cRes.parsed;
      chatgptParsed = chRes.parsed;
    }

    const arbiterPlan = synthesizeArbiterPlan(
      geminiParsed,
      claudeParsed,
      chatgptParsed,
      user.accountSize,
      user.riskPerTrade
    );

    // Save ResearchRun
    const researchRun = await prisma.researchRun.create({
      data: {
        userId: user.id,
        marketRegime: arbiterPlan.marketRegime,
        regimeNotes: arbiterPlan.regimeNotes,
        macroFlags: arbiterPlan.macroFlags,
        arbiterSynthesis: arbiterPlan.consensusHighlight,
        geminiReport: geminiText || "Automated Gemini Run",
        claudeReport: claudeText || "Automated Claude Run",
        chatgptReport: chatgptText || "Automated ChatGPT Run",
      },
    });

    // Create Candidate Setups
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

    return NextResponse.json({
      success: true,
      researchRunId: researchRun.id,
      arbiterPlan,
    });
  } catch (error) {
    console.error("Error executing research run:", error);
    return NextResponse.json({ error: "Failed to run research" }, { status: 500 });
  }
}
