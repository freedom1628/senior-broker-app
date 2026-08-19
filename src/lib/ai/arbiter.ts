import { ParsedReport, ParsedCandidate } from "./parser";

export interface MasterSetup extends ParsedCandidate {
  consensusCount: number;
  modelsAgreed: string[];
  isConsensusPick: boolean;
  normalizedShares: number;
  normalizedRisk: number;
}

export interface MasterArbiterPlan {
  marketRegime: "FAVORABLE" | "NEUTRAL" | "HOSTILE";
  regimeNotes: string;
  macroFlags: string;
  consensusHighlight: string;
  masterSetups: MasterSetup[];
  allCandidates: ParsedCandidate[];
  modelBreakdowns: {
    gemini?: ParsedReport;
    claude?: ParsedReport;
    chatgpt?: ParsedReport;
  };
}

export function synthesizeArbiterPlan(
  geminiReport?: ParsedReport,
  claudeReport?: ParsedReport,
  chatgptReport?: ParsedReport,
  accountSize: number = 10000.0,
  riskPercent: number = 1.0
): MasterArbiterPlan {
  const allParsed: ParsedCandidate[] = [];
  const reports = [
    { name: "Gemini", report: geminiReport },
    { name: "Claude", report: claudeReport },
    { name: "ChatGPT", report: chatgptReport },
  ].filter((r): r is { name: string; report: ParsedReport } => !!r.report);

  reports.forEach(r => {
    r.report.candidates.forEach(c => {
      allParsed.push({ ...c, modelSource: r.name });
    });
  });

  // Calculate Desk Regime Consensus
  let favorableCount = 0;
  let neutralCount = 0;
  let hostileCount = 0;

  reports.forEach(r => {
    if (r.report.marketRegime === "FAVORABLE") favorableCount++;
    else if (r.report.marketRegime === "NEUTRAL") neutralCount++;
    else if (r.report.marketRegime === "HOSTILE") hostileCount++;
  });

  let finalRegime: "FAVORABLE" | "NEUTRAL" | "HOSTILE" = "FAVORABLE";
  if (hostileCount >= 2) finalRegime = "HOSTILE";
  else if (neutralCount >= 2) finalRegime = "NEUTRAL";
  else if (favorableCount >= 1) finalRegime = "FAVORABLE";

  // Group tickers across models
  const tickerMap = new Map<string, { candidates: ParsedCandidate[]; models: Set<string> }>();

  allParsed.forEach(c => {
    const key = c.ticker.toUpperCase();
    if (!tickerMap.has(key)) {
      tickerMap.set(key, { candidates: [], models: new Set() });
    }
    const entry = tickerMap.get(key)!;
    entry.candidates.push(c);
    entry.models.add(c.modelSource);
  });

  const masterSetups: MasterSetup[] = [];

  tickerMap.forEach((val, ticker) => {
    const primary = val.candidates[0];
    const consensusCount = val.models.size;
    const modelsAgreed = Array.from(val.models);
    const isConsensusPick = consensusCount > 1;

    // Normalizing risk math:
    // Risk Budget = Account Size * (Risk % / 100)
    // Risk Per Share = |Entry - Stop|
    // Shares = floor(Risk Budget / Risk Per Share)
    const riskBudget = accountSize * (riskPercent / 100);
    const riskPerShare = Math.max(0.01, Math.abs(primary.entryTrigger - primary.stopLoss));
    const normalizedShares = Math.max(1, Math.floor(riskBudget / riskPerShare));
    const normalizedRisk = Number((normalizedShares * riskPerShare).toFixed(2));

    // Calculate normalized R:R
    const rewardPerShare = Math.abs(primary.target1 - primary.entryTrigger);
    const normalizedRR = Number((rewardPerShare / riskPerShare).toFixed(2));

    // Boost score for multi-model consensus
    const consensusBonus = isConsensusPick ? 5.0 * (consensusCount - 1) : 0;
    const finalScore = Number(Math.min(99, primary.score + consensusBonus).toFixed(1));

    masterSetups.push({
      ...primary,
      rrRatio: normalizedRR,
      score: finalScore,
      positionShares: normalizedShares,
      riskAmount: normalizedRisk,
      normalizedShares,
      normalizedRisk,
      consensusCount,
      modelsAgreed,
      isConsensusPick,
    });
  });

  // Sort: Consensus picks first, then by highest composite score
  masterSetups.sort((a, b) => {
    if (a.isConsensusPick && !b.isConsensusPick) return -1;
    if (!a.isConsensusPick && b.isConsensusPick) return 1;
    return b.score - a.score;
  });

  const consensusTickers = masterSetups.filter(s => s.isConsensusPick).map(s => s.ticker);
  const consensusHighlight = consensusTickers.length > 0
    ? `Strong Multi-Model Consensus on ${consensusTickers.join(", ")} across ${reports.map(r => r.name).join(" & ")}. Top-ranked for immediate watch execution.`
    : `Diversified top conviction opportunities identified across ${reports.map(r => r.name).join(", ")}.`;

  const representativeReport = reports[0]?.report;
  const regimeNotes = representativeReport?.regimeNotes || "SPY and QQQ maintain bullish structure above rising 20D and 50D moving averages with healthy market breadth (>60% above 50D MA) and tame VIX ~15.";
  const macroFlags = representativeReport?.macroFlags || "CPI print cleared; monitor PPI (Thu) and FOMC minutes (Aug 19). Maintain strict 1% risk allocation.";

  return {
    marketRegime: finalRegime,
    regimeNotes,
    macroFlags,
    consensusHighlight,
    masterSetups,
    allCandidates: allParsed,
    modelBreakdowns: {
      gemini: geminiReport,
      claude: claudeReport,
      chatgpt: chatgptReport,
    },
  };
}
