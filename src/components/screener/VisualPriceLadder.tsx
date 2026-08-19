"use client";

import React from "react";
import { generate4TierPriceLadder, PriceLadderTier } from "@/lib/ai/arbiter";
import { ArrowUpRight, ArrowDownRight, Target, ShieldAlert, Zap, DollarSign } from "lucide-react";

export interface VisualPriceLadderProps {
  entryTrigger: number;
  stopLoss: number;
  target1: number;
  target2: number;
  positionShares?: number;
  riskAmount?: number;
  accountSize?: number;
  currentPrice?: number;
  compact?: boolean;
}

export const VisualPriceLadder: React.FC<VisualPriceLadderProps> = ({
  entryTrigger,
  stopLoss,
  target1,
  target2,
  positionShares = 0,
  riskAmount = 150.0,
  accountSize = 15000,
  currentPrice,
  compact = false,
}) => {
  const ladder: PriceLadderTier[] = generate4TierPriceLadder(
    entryTrigger,
    stopLoss,
    target1,
    target2
  );

  const riskPerShare = Math.max(0.01, Math.abs(entryTrigger - stopLoss));
  const effectiveShares = positionShares > 0 ? positionShares : Math.max(1, Math.floor(riskAmount / riskPerShare));
  const effectiveRisk = Number((effectiveShares * riskPerShare).toFixed(2));
  const totalAllocatedCapital = Number((effectiveShares * entryTrigger).toFixed(2));

  // T1 & T2 projected dollar profits
  const t1HalfShares = Math.ceil(effectiveShares / 2);
  const t2RemainingShares = effectiveShares - t1HalfShares;
  const t1ProfitDollars = Number((t1HalfShares * (target1 - entryTrigger)).toFixed(2));
  const t2ProfitDollars = Number((t2RemainingShares * (target2 - entryTrigger)).toFixed(2));
  const totalProjectedProfit = Number((t1ProfitDollars + t2ProfitDollars).toFixed(2));

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0A0E17]/90 p-3.5 sm:p-4 backdrop-blur-md shadow-lg space-y-3">
      {/* Header / Title */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-400 border-b border-white/[0.06] pb-2">
        <div className="flex items-center space-x-1.5">
          <Zap className="h-3.5 w-3.5 text-sky-400" />
          <span className="tracking-wide uppercase">Execution Price Ladder (4-Tier)</span>
        </div>
        <div className="text-[11px] font-mono text-slate-500">
          Risk: <span className="text-rose-400 font-semibold">${effectiveRisk.toFixed(2)}</span> (1.0% of ${(accountSize / 1000).toFixed(0)}k)
        </div>
      </div>

      {/* 4 Ladder Levels */}
      <div className="space-y-1.5 font-mono text-xs">
        {/* LEVEL 1: TARGET 2 (RUNNER) */}
        <div className="flex items-center justify-between rounded-lg bg-purple-950/30 border border-purple-500/20 px-3 py-2 text-purple-200 transition hover:bg-purple-950/40">
          <div className="flex items-center space-x-2">
            <Target className="h-3.5 w-3.5 text-purple-400" />
            <span className="font-semibold text-purple-300">Target 2 (Runner)</span>
            <span className="text-[10px] rounded bg-purple-500/20 px-1.5 py-0.5 text-purple-300">
              +{ladder[0].rMultiple}R
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-[11px] text-purple-400/90 font-medium">+{ladder[0].distancePct}%</span>
            <span className="text-sm font-bold text-white">${ladder[0].price.toFixed(2)}</span>
            {!compact && t2ProfitDollars > 0 && (
              <span className="text-[10px] text-purple-300/80 hidden sm:inline">(+${t2ProfitDollars.toFixed(0)})</span>
            )}
          </div>
        </div>

        {/* LEVEL 2: TARGET 1 (SCALE 50% & B/E STOP) */}
        <div className="flex items-center justify-between rounded-lg bg-emerald-950/30 border border-emerald-500/20 px-3 py-2 text-emerald-200 transition hover:bg-emerald-950/40">
          <div className="flex items-center space-x-2">
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-semibold text-emerald-300">Target 1 (Scale 50%)</span>
            <span className="text-[10px] rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-300">
              +{ladder[1].rMultiple}R
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-[11px] text-emerald-400/90 font-medium">+{ladder[1].distancePct}%</span>
            <span className="text-sm font-bold text-white">${ladder[1].price.toFixed(2)}</span>
            {!compact && t1ProfitDollars > 0 && (
              <span className="text-[10px] text-emerald-300/80 hidden sm:inline">(+${t1ProfitDollars.toFixed(0)})</span>
            )}
          </div>
        </div>

        {/* LEVEL 3: ENTRY TRIGGER */}
        <div className="flex items-center justify-between rounded-lg bg-sky-950/30 border border-sky-500/30 px-3 py-2 text-sky-200 transition hover:bg-sky-950/40 shadow-inner">
          <div className="flex items-center space-x-2">
            <Zap className="h-3.5 w-3.5 text-sky-400 animate-pulse" />
            <span className="font-semibold text-sky-300">Entry Trigger</span>
            <span className="text-[10px] rounded bg-sky-500/20 px-1.5 py-0.5 text-sky-300">Pivot</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-[11px] text-sky-400 font-medium">0.00%</span>
            <span className="text-sm font-bold text-white">${ladder[2].price.toFixed(2)}</span>
            {currentPrice !== undefined && currentPrice > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${currentPrice >= entryTrigger ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                Live ${currentPrice.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* LEVEL 4: HARD STOP LOSS */}
        <div className="flex items-center justify-between rounded-lg bg-rose-950/30 border border-rose-500/25 px-3 py-2 text-rose-200 transition hover:bg-rose-950/40">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
            <span className="font-semibold text-rose-300">Hard Invalidation Stop</span>
            <span className="text-[10px] rounded bg-rose-500/20 px-1.5 py-0.5 text-rose-300">-1.00R</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-[11px] text-rose-400/90 font-medium">{ladder[3].distancePct}%</span>
            <span className="text-sm font-bold text-white">${ladder[3].price.toFixed(2)}</span>
            {!compact && (
              <span className="text-[10px] text-rose-300/80 hidden sm:inline">(-${effectiveRisk.toFixed(0)})</span>
            )}
          </div>
        </div>
      </div>

      {/* Sizing Breakdown Footnote */}
      <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 gap-y-1">
        <div className="flex items-center space-x-2">
          <span>Size: <strong className="text-slate-200">{effectiveShares} shs</strong></span>
          <span className="text-slate-600">•</span>
          <span>Risk/sh: <strong className="text-slate-200">${riskPerShare.toFixed(2)}</strong></span>
          <span className="text-slate-600">•</span>
          <span>Capital: <strong className="text-slate-200">${totalAllocatedCapital.toLocaleString()}</strong></span>
        </div>
        {totalProjectedProfit > 0 && (
          <div className="text-emerald-400 font-semibold">
            Max Reward: +${totalProjectedProfit.toFixed(0)} ({((totalProjectedProfit / effectiveRisk) || 0).toFixed(1)}R)
          </div>
        )}
      </div>
    </div>
  );
};
