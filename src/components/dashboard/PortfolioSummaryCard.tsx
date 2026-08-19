"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  Plus,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  ShieldCheck,
  DollarSign,
  Layers,
} from "lucide-react";
import { PortfolioSummaryCardProps, TimeframeOption } from "@/types";
import { SparklineChart } from "./SparklineChart";
import { computePortfolioSummaryMetrics } from "@/lib/mockData";

export const PortfolioSummaryCard: React.FC<PortfolioSummaryCardProps> = ({
  accountSize = 15000,
  riskPerTrade = 1.0,
  maxSleeveRiskPct = 3.0,
  activeTrades = [],
  marketQuotes = {},
  onOpenAddTrade,
  onOpenImport,
  onOpenSettings,
  onNavigateToTab,
  className = "",
}) => {
  const [selectedTf, setSelectedTf] = useState<TimeframeOption>("1D");

  const metrics = computePortfolioSummaryMetrics(
    accountSize,
    activeTrades,
    marketQuotes,
    maxSleeveRiskPct
  );

  const isFloatingPositive = metrics.floatingPnL >= 0;

  return (
    <div
      className={`rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#0E131F] to-[#0A0D15] p-6 sm:p-8 backdrop-blur-2xl shadow-2xl space-y-6 ${className}`}
    >
      {/* 1. Top Ribbon: Sleeve Context & Quick Settings Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div className="flex items-center space-x-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-400">
            Dedicated Swing Trading Sleeve (&lt;1% Overall Wealth)
          </span>
        </div>

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center space-x-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1 text-xs text-neutral-300 hover:bg-white/[0.08] hover:text-white transition group active:scale-95"
          >
            <Sliders className="h-3.5 w-3.5 text-neutral-400 group-hover:text-emerald-400 transition" />
            <span className="font-mono font-semibold text-white">
              ${metrics.dedicatedCapital.toLocaleString()}
            </span>
            <span className="text-neutral-500">•</span>
            <span className="font-mono text-neutral-300">{riskPerTrade}% Risk / Trade</span>
          </button>
        )}
      </div>

      {/* 2. Hero Balance Row & Action Buttons */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="text-xs font-mono text-neutral-400 block mb-1">
            Total Sleeve Value
          </span>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-mono">
              ${metrics.totalSleeveValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h1>
            <div
              className={`flex items-center space-x-1 rounded-full px-2.5 py-0.5 text-xs font-mono font-semibold ${
                isFloatingPositive
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                  : "bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.15)]"
              }`}
            >
              {isFloatingPositive ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              <span>
                {isFloatingPositive ? "+" : ""}${Math.abs(metrics.floatingPnL).toFixed(2)} ({isFloatingPositive ? "+" : ""}{metrics.floatingPnLPct.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* 1-Click Action Buttons */}
        <div className="flex items-center space-x-2.5">
          {onOpenAddTrade && (
            <button
              type="button"
              onClick={onOpenAddTrade}
              className="flex items-center space-x-2 rounded-full bg-emerald-500 px-4 sm:px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition active:scale-95"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>Add Position</span>
            </button>
          )}

          {onOpenImport && (
            <button
              type="button"
              onClick={onOpenImport}
              className="flex items-center space-x-2 rounded-full bg-white px-4 sm:px-5 py-2.5 text-xs font-semibold text-neutral-900 shadow-lg hover:bg-neutral-100 transition active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5 text-sky-600" />
              <span>AI Screener</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Interactive Recharts Sparkline */}
      <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
        <SparklineChart
          timeframe={selectedTf}
          onTimeframeChange={(tf) => setSelectedTf(tf)}
          startingCapital={accountSize}
          currentEquity={metrics.totalSleeveValue}
          height={160}
        />
      </div>

      {/* 4. 4-Tile Executive Sizing & Risk Matrix */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
        
        {/* Cash Available */}
        <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4 space-y-1 hover:border-white/10 transition">
          <span className="text-[11px] font-mono text-neutral-400 block uppercase">
            Cash Available
          </span>
          <span className="text-lg font-bold text-white font-mono">
            ${metrics.cashAvailable.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
          <span className="text-[10px] text-neutral-500 font-mono block">
            {accountSize > 0 ? ((metrics.cashAvailable / accountSize) * 100).toFixed(0) : 0}% liquid buffer
          </span>
        </div>

        {/* Capital Allocated */}
        <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4 space-y-1 hover:border-white/10 transition">
          <span className="text-[11px] font-mono text-neutral-400 block uppercase">
            In Active Trades
          </span>
          <span className="text-lg font-bold text-sky-400 font-mono">
            ${metrics.allocatedCapital.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
          <span className="text-[10px] text-neutral-500 font-mono block">
            {metrics.activePositionsCount} open position{metrics.activePositionsCount === 1 ? "" : "s"}
          </span>
        </div>

        {/* Open Risk at Risk */}
        <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4 space-y-1 hover:border-white/10 transition">
          <span className="text-[11px] font-mono text-neutral-400 block uppercase">
            Open Risk Cap
          </span>
          <div className="flex items-center space-x-1.5">
            <span className={`text-lg font-bold font-mono ${metrics.isRiskSafe ? "text-emerald-400" : "text-rose-400"}`}>
              ${metrics.openRiskDollars.toFixed(0)}
            </span>
            <span className={`text-xs font-mono font-semibold ${metrics.isRiskSafe ? "text-emerald-400" : "text-rose-400"}`}>
              ({metrics.openRiskPct.toFixed(1)}%)
            </span>
          </div>
          <span className="text-[10px] text-neutral-500 font-mono block">
            {metrics.isRiskSafe ? "Within 3.0% cap" : "Exceeds 3.0% cap"}
          </span>
        </div>

        {/* 1% Risk Budget Per Trade */}
        <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4 space-y-1 hover:border-white/10 transition">
          <span className="text-[11px] font-mono text-neutral-400 block uppercase">
            1% Trade Risk
          </span>
          <span className="text-lg font-bold text-amber-400 font-mono">
            ${(accountSize * (riskPerTrade / 100)).toFixed(0)} / setup
          </span>
          <span className="text-[10px] text-neutral-500 font-mono block">
            Hard stop loss rule
          </span>
        </div>
      </div>
    </div>
  );
};
