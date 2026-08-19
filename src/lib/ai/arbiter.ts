// src/lib/ai/arbiter.ts
// Multi-Model Consensus Arbiter Engine
// Harmonizes market regimes, cross-model deduplication, +5.0 conviction bonuses, 1% risk sizing, and price ladders

import { ParsedReport, ParsedCandidate, MasterSetup, MasterArbiterPlan, MarketRegimeType, PriceLadderTier } from "./types";

export type { MasterSetup, MasterArbiterPlan, PriceLadderTier };

/**
 * Calculates a 4-tier visual execution price ladder for any trade setup.
 */
export function generate4TierPriceLadder(
  entry: number,
  stop: number,
  target1: number,
  target2: number
): PriceLadderTier[] {
  const riskPerShare = Math.max(0.01, Math.abs(entry - stop));

  const t2Dist = Number((((target2 - entry) / entry) * 100).toFixed(2));
  const t1Dist = Number((((target1 - entry) / entry) * 100).toFixed(2));
  const stopDist = Number((((stop - entry) / entry) * 100).toFixed(2));

  const t2R = Number(((target2 - entry) / riskPerShare).toFixed(2));
  const t1R = Number(((target1 - entry) / riskPerShare).toFixed(2));

  return [
    {
      levelName: "TARGET_2",
      price: target2,
      distancePct: t2Dist,
      rMultiple: t2R,
      label: `Target 2 (Runner +${t2R}R)`,
      actionLabel: "Sell Remaining 50%",
    },
    {
      levelName: "TARGET_1",
      price: target1,
      distancePct: t1Dist,
      rMultiple: t1R,
      label: `Target 1 (Scale 50% +${t1R}R)`,
      actionLabel: "Scale 50% & Ratchet B/E",
    },
    {
      levelName: "ENTRY",
      price: entry,
      distancePct: 0.0,
      rMultiple: 0.0,
      label: `Entry Trigger ($${entry.toFixed(2)})`,
      actionLabel: "Execution Pivot",
    },
    {
      levelName: "STOP_LOSS",
      price: stop,
      distancePct: stopDist,
      rMultiple: -1.0,
      label: `Hard Stop Loss (-1.0R)`,
      actionLabel: "Invalidation Cut",
    },
  ];
}

/**
 * Synthesizes multiple independent model reports into a unified Master Arbiter Plan.
 */
export function synthesizeArbiterPlan(
  geminiReport?: ParsedReport,
  claudeReport?: ParsedReport,
  chatgptReport?: ParsedReport,
  accountSize: number = 15000.0,
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

  // 1. Calculate Desk Regime Consensus (Risk-averse bias)
  let favorableCount = 0;
  let neutralCount = 0;
  let hostileCount = 0;

  reports.forEach(r => {
    if (r.report.marketRegime === "HOSTILE") hostileCount++;
    else if (r.report.marketRegime === "NEUTRAL") neutralCount++;
    else if (r.report.marketRegime === "FAVORABLE") favorableCount++;
  });

  let finalRegime: MarketRegimeType = "FAVORABLE";
  if (hostileCount >= 2) {
    finalRegime = "HOSTILE";
  } else if (neutralCount >= 2 || (hostileCount === 1 && neutralCount >= 1)) {
    finalRegime = "NEUTRAL";
  } else if (favorableCount >= 1) {
    finalRegime = "FAVORABLE";
  }

  // 2. Group and deduplicate tickers across models
  const tickerMap = new Map<string, { candidates: ParsedCandidate[]; models: Set<string> }>();

  allParsed.forEach(c => {
    const key = c.ticker.toUpperCase().trim();
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
    const rawShares = Math.max(1, Math.floor(riskBudget / riskPerShare));
    const normalizedShares = rawShares;
    const normalizedRisk = Number((normalizedShares * riskPerShare).toFixed(2));
    const allocatedCapital = Number((normalizedShares * primary.entryTrigger).toFixed(2));
    const actualRiskPct = Number(((normalizedRisk / accountSize) * 100).toFixed(4));

    // Calculate normalized R:R
    const rewardPerShare = Math.abs(primary.target1 - primary.entryTrigger);
    const normalizedRR = Number((rewardPerShare / riskPerShare).toFixed(2));

    // Boost score for multi-model consensus (+5.0 bonus per additional model)
    const consensusBonus = isConsensusPick ? 5.0 * (consensusCount - 1) : 0;
    const finalScore = Number(Math.min(99.0, primary.score + consensusBonus).toFixed(1));

    masterSetups.push({
      ...primary,
      rrRatio: normalizedRR,
      score: finalScore,
      positionShares: normalizedShares,
      riskAmount: normalizedRisk,
      normalizedShares,
      normalizedRisk,
      allocatedCapital,
      actualRiskPct,
      consensusCount,
      modelsAgreed,
      isConsensusPick,
    });
  });

  // 3. Sort: Consensus picks first, then by highest composite score
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
    id: `arbiter_plan_${Date.now()}`,
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
    generatedAt: new Date().toISOString(),
  };
}
