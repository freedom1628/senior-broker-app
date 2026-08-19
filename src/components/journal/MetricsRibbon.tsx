"use client";

import React, { useMemo } from "react";
import { Trade } from "@/lib/storage/types";
import { TrendingUp, Award, Percent, DollarSign, ShieldCheck, Target, ArrowUpRight, BarChart2 } from "lucide-react";

export interface MetricsRibbonProps {
  closedTrades: Trade[];
  metrics?: {
    totalRealizedPnL?: number;
    winRate?: number;
    totalTrades?: number;
    avgRMultiple?: number;
    profitFactor?: number;
    disciplineScore?: number;
  };
}

export const MetricsRibbon: React.FC<MetricsRibbonProps> = ({
  closedTrades = [],
  metrics: explicitMetrics,
}) => {
  const calculated = useMemo(() => {
    if (closedTrades.length === 0) {
      return {
        totalRealizedPnL: explicitMetrics?.totalRealizedPnL ?? 0.0,
        winRate: explicitMetrics?.winRate ?? 0.0,
        totalTrades: explicitMetrics?.totalTrades ?? 0,
        avgRMultiple: explicitMetrics?.avgRMultiple ?? 0.0,
        profitFactor: explicitMetrics?.profitFactor ?? 0.0,
        disciplineScore: explicitMetrics?.disciplineScore ?? 100.0,
        winningTrades: 0,
        losingTrades: 0,
        avgWinDollars: 0,
        avgLossDollars: 0,
      };
    }

    let totalPnL = 0;
    let totalR = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let winningCount = 0;
    let losingCount = 0;

    closedTrades.forEach((t) => {
      const pnl = t.realizedPnL ?? 0;
      const r = t.rMultiple ?? 0;
      totalPnL += pnl;
      totalR += r;

      if (pnl > 0.01) {
        winningCount++;
        grossProfit += pnl;
      } else if (pnl < -0.01) {
        losingCount++;
        grossLoss += Math.abs(pnl);
      }
    });

    const winRate = (winningCount / closedTrades.length) * 100;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999.0 : 0.0;
    const avgRMultiple = totalR / closedTrades.length;
    const avgWinDollars = winningCount > 0 ? grossProfit / winningCount : 0;
    const avgLossDollars = losingCount > 0 ? grossLoss / losingCount : 0;

    return {
      totalRealizedPnL: Number(totalPnL.toFixed(2)),
      winRate: Number(winRate.toFixed(1)),
      totalTrades: closedTrades.length,
      avgRMultiple: Number(avgRMultiple.toFixed(2)),
      profitFactor: Number(profitFactor.toFixed(2)),
      disciplineScore: explicitMetrics?.disciplineScore ?? 100.0,
      winningTrades: winningCount,
      losingTrades: losingCount,
      avgWinDollars: Number(avgWinDollars.toFixed(2)),
      avgLossDollars: Number(avgLossDollars.toFixed(2)),
    };
  }, [closedTrades, explicitMetrics]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      {/* 1. Total Realized P&L */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-4 sm:p-5 backdrop-blur-2xl shadow-lg space-y-1">
        <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-neutral-400 block truncate">
          Total Realized P&amp;L
        </span>
        <div
          className={`font-mono text-xl sm:text-2xl font-bold tracking-tight ${
            calculated.totalRealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {calculated.totalRealizedPnL >= 0 ? "+" : ""}${calculated.totalRealizedPnL.toFixed(2)}
        </div>
        <span className="text-[10px] text-neutral-500 font-mono block">
          Net closed campaign gains
        </span>
      </div>

      {/* 2. Win Rate % */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-4 sm:p-5 backdrop-blur-2xl shadow-lg space-y-1">
        <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-neutral-400 block truncate">
          Win Rate
        </span>
        <div className="font-mono text-xl sm:text-2xl font-bold text-sky-400 tracking-tight">
          {calculated.winRate.toFixed(1)}%
        </div>
        <span className="text-[10px] text-neutral-500 font-mono block">
          {calculated.winningTrades}W / {calculated.losingTrades}L ({calculated.totalTrades} closed)
        </span>
      </div>

      {/* 3. Profit Factor */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-4 sm:p-5 backdrop-blur-2xl shadow-lg space-y-1">
        <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-neutral-400 block truncate">
          Profit Factor
        </span>
        <div className="font-mono text-xl sm:text-2xl font-bold text-emerald-300 tracking-tight">
          {calculated.profitFactor > 99 ? "∞" : calculated.profitFactor.toFixed(2)}
        </div>
        <span className="text-[10px] text-neutral-500 font-mono block">
          Gross Win / Gross Loss ratio
        </span>
      </div>

      {/* 4. Average R-Multiple */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-4 sm:p-5 backdrop-blur-2xl shadow-lg space-y-1">
        <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-neutral-400 block truncate">
          Avg R-Multiple
        </span>
        <div
          className={`font-mono text-xl sm:text-2xl font-bold tracking-tight ${
            calculated.avgRMultiple >= 0 ? "text-purple-300" : "text-rose-400"
          }`}
        >
          {calculated.avgRMultiple >= 0 ? "+" : ""}{calculated.avgRMultiple.toFixed(2)} R
        </div>
        <span className="text-[10px] text-neutral-500 font-mono block">
          Gain relative to 1% risk
        </span>
      </div>

      {/* 5. Discipline Score */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-4 sm:p-5 backdrop-blur-2xl shadow-lg space-y-1">
        <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-neutral-400 block truncate">
          Discipline Score
        </span>
        <div className="font-mono text-xl sm:text-2xl font-bold text-emerald-400 tracking-tight">
          {calculated.disciplineScore.toFixed(0)}%
        </div>
        <span className="text-[10px] text-neutral-500 font-mono block">
          0 widened stops • 1% risk
        </span>
      </div>

      {/* 6. Win/Loss Average */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-4 sm:p-5 backdrop-blur-2xl shadow-lg space-y-1">
        <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-neutral-400 block truncate">
          Avg Win / Avg Loss
        </span>
        <div className="font-mono text-base sm:text-lg font-bold text-white tracking-tight mt-1 truncate">
          <span className="text-emerald-400">${calculated.avgWinDollars.toFixed(0)}</span>
          <span className="text-neutral-500 mx-1">/</span>
          <span className="text-rose-400">${calculated.avgLossDollars.toFixed(0)}</span>
        </div>
        <span className="text-[10px] text-neutral-500 font-mono block">
          Institutional reward asymmetry
        </span>
      </div>
    </div>
  );
};

export default MetricsRibbon;
