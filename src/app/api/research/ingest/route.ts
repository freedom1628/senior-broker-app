// src/app/api/research/ingest/route.ts
// Multi-LLM Report Ingestion API Endpoint
// Ingests raw or structured reports from Gemini 3.7 Flash, Claude Sonnet 5, OpenAI 5.6/o3, synthesizes consensus, and persists to DB

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseReportContent, ParsedReport } from "@/lib/ai/parser";
import { synthesizeArbiterPlan } from "@/lib/ai/arbiter";
import { IngestRequestBody, IngestReportPayload } from "@/lib/ai/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let reports: IngestReportPayload[] = [];
    const accountSize = Number(body.accountSize) || 15000.0;
    const riskPercent = Number(body.riskPercent) || 1.0;

    if (Array.isArray(body.reports)) {
      reports = body.reports;
    } else if (body.modelSource && body.rawText) {
      reports = [{ modelSource: body.modelSource, rawText: body.rawText }];
    } else if (body.rawText) {
      reports = [{ modelSource: "Imported Model", rawText: body.rawText }];
    }

    if (reports.length === 0) {
      return NextResponse.json(
        { error: "No research reports provided. Expected array of { modelSource, rawText }" },
        { status: 400 }
      );
    }

    // Lookup trader user (or default)
    const user = await prisma.user.findFirst({
      where: { email: "trader@broker.com" },
    });

    const effectiveAccount = user?.accountSize ?? accountSize;
    const effectiveRisk = user?.riskPerTrade ?? riskPercent;

    // Parse each provided report
    let geminiParsed: ParsedReport | undefined;
    let claudeParsed: ParsedReport | undefined;
    let chatgptParsed: ParsedReport | undefined;

    for (const item of reports) {
      const src = (item.modelSource || "").toLowerCase();
      const parsed = parseReportContent(item.rawText, item.modelSource);

      if (src.includes("gemini")) {
        geminiParsed = parsed;
      } else if (src.includes("claude")) {
        claudeParsed = parsed;
      } else if (src.includes("openai") || src.includes("chatgpt") || src.includes("o3")) {
        chatgptParsed = parsed;
      } else {
        if (!geminiParsed) geminiParsed = parsed;
        else if (!claudeParsed) claudeParsed = parsed;
        else chatgptParsed = parsed;
      }
    }

    // Synthesize Master Arbiter Plan (+5 pts bonus per agreeing model, 1% sizing normalization)
    const arbiterPlan = synthesizeArbiterPlan(
      geminiParsed,
      claudeParsed,
      chatgptParsed,
      effectiveAccount,
      effectiveRisk
    );

    let runId = `run_${Date.now()}`;
    if (user) {
      const savedRun = await prisma.researchRun.create({
        data: {
          userId: user.id,
          marketRegime: arbiterPlan.marketRegime,
          regimeNotes: arbiterPlan.regimeNotes,
          macroFlags: arbiterPlan.macroFlags,
          arbiterSynthesis: arbiterPlan.consensusHighlight,
          geminiReport: reports.find(r => r.modelSource.toLowerCase().includes("gemini"))?.rawText || (geminiParsed ? "Ingested Gemini Report" : null),
          claudeReport: reports.find(r => r.modelSource.toLowerCase().includes("claude"))?.rawText || (claudeParsed ? "Ingested Claude Report" : null),
          chatgptReport: reports.find(r => r.modelSource.toLowerCase().includes("openai") || r.modelSource.toLowerCase().includes("chatgpt"))?.rawText || (chatgptParsed ? "Ingested OpenAI Report" : null),
        },
      });
      runId = savedRun.id;

      // Persist Candidate Setups
      for (const s of arbiterPlan.masterSetups) {
        await prisma.candidateSetup.create({
          data: {
            researchRunId: savedRun.id,
            ticker: s.ticker,
            companyName: s.companyName,
            setupType: s.setupType,
            entryTrigger: s.entryTrigger,
            entryCondition: s.entryCondition,
            stopLoss: s.stopLoss,
            stopRationale: s.stopRationale,
            target1: s.target1,
            target2: s.target2,
            rrRatio: s.rrRatio,
            timeStopDays: s.timeStopDays,
            positionShares: s.positionShares,
            riskAmount: s.riskAmount,
            catalystDate: s.catalystDate,
            catalystSummary: s.catalystSummary,
            bearCase: s.bearCase,
            score: s.score,
            modelSources: s.modelsAgreed.join(", "),
            status: "WATCHLIST",
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      researchRunId: runId,
      arbiterPlan,
      masterSetups: arbiterPlan.masterSetups,
      count: arbiterPlan.masterSetups.length,
    });
  } catch (error) {
    console.error("Error in /api/research/ingest:", error);
    return NextResponse.json({ error: "Failed to ingest research reports" }, { status: 500 });
  }
}
