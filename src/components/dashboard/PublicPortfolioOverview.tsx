"use client";

import React from "react";
import {
  TrendingUp,
  ShieldCheck,
  DollarSign,
  Plus,
  Sparkles,
  PieChart,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Lock,
  Layers,
  GraduationCap,
} from "lucide-react";

interface PublicPortfolioOverviewProps {
  accountSize: number;
  riskPerTrade: number;
  activeTrades: any[];
  marketQuotes: Record<string, any>;
  onOpenAddTrade: () => void;
  onOpenImport: () => void;
  onOpenSettings: () => void;
  onNavigateToTab: (tab: "COACH" | "POSITIONS" | "SCREENER" | "LEARNING" | "JOURNAL") => void;
}

export const PublicPortfolioOverview: React.FC<PublicPortfolioOverviewProps> = ({
  accountSize,
  riskPerTrade,
  activeTrades,
  marketQuotes,
  onOpenAddTrade,
  onOpenImport,
  onOpenSettings,
  onNavigateToTab,
}) => {
  // Compute portfolio metrics
  let totalAllocated = 0;
  let totalUnrealizedPnL = 0;
  let totalOpenRisk = 0;

  activeTrades.forEach((trade) => {
    const quote = marketQuotes[trade.ticker.toUpperCase()];
    const currentPrice = quote?.price || trade.entryTrigger;
    const entry = trade.actualEntry || trade.entryTrigger;
    const shares = trade.sharesRemaining || trade.sharesTotal;

    const positionValue = currentPrice * shares;
    const positionPnL = (currentPrice - entry) * shares;
    const riskPerShare = Math.max(0.01, Math.abs(entry - trade.initialStop));
    const positionRisk = riskPerShare * trade.sharesTotal;

    totalAllocated += positionValue;
    totalUnrealizedPnL += positionPnL;
    totalOpenRisk += positionRisk;
  });

  const cashAvailable = Math.max(0, accountSize - totalAllocated);
  const totalPortfolioValue = accountSize + totalUnrealizedPnL;
  const unrealizedPct = accountSize > 0 ? (totalUnrealizedPnL / accountSize) * 100 : 0;
  const openRiskPct = accountSize > 0 ? (totalOpenRisk / accountSize) * 100 : 0;
  const isRiskSafe = openRiskPct <= 3.0;

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#0E131F] to-[#0A0D15] p-6 sm:p-8 backdrop-blur-2xl shadow-2xl space-y-6">
      
      {/* Top Banner: Sleeve Context & Fast Settings */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div className="flex items-center space-x-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-400">
            Dedicated Swing Trading Sleeve (&lt;1% Overall Wealth)
          </span>
        </div>
        <button
          onClick={onOpenSettings}
          className="flex items-center space-x-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-neutral-300 hover:bg-white/[0.08] transition"
        >
          <span className="font-mono">Capital: ${accountSize.toLocaleString()}</span>
          <span className="text-neutral-500">•</span>
          <span className="font-mono">{riskPerTrade}% Max Risk</span>
        </button>
      </div>

      {/* Main Balance Display */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="text-xs font-mono text-neutral-400 block mb-1">
            Total Sleeve Value
          </span>
          <div className="flex items-baseline space-x-3">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-mono">
              ${totalPortfolioValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h1>
            <div className={`flex items-center space-x-1 text-sm font-semibold font-mono ${totalUnrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {totalUnrealizedPnL >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              <span>{totalUnrealizedPnL >= 0 ? "+" : ""}${Math.abs(totalUnrealizedPnL).toFixed(2)} ({unrealizedPct.toFixed(2)}%)</span>
            </div>
          </div>
        </div>

        {/* 1-Click Action Buttons */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={onOpenAddTrade}
            className="flex items-center space-x-2 rounded-full bg-emerald-500 px-4 sm:px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition active:scale-95"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>Add Position</span>
          </button>

          <button
            onClick={onOpenImport}
            className="flex items-center space-x-2 rounded-full bg-white px-4 sm:px-5 py-2.5 text-xs font-semibold text-neutral-900 shadow-lg hover:bg-neutral-100 transition active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5 text-sky-600" />
            <span>AI Screener</span>
          </button>
        </div>
      </div>

      {/* 4 Key Metric Tiles (Public.com Clean Style) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
        
        {/* Available Cash */}
        <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4 space-y-1">
          <span className="text-[11px] font-mono text-neutral-400 block uppercase">Cash Available</span>
          <span className="text-lg font-bold text-white font-mono">${cashAvailable.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
          <span className="text-[10px] text-neutral-500 font-mono block">{((cashAvailable / accountSize) * 100).toFixed(0)}% liquid buffer</span>
        </div>

        {/* Capital Allocated */}
        <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4 space-y-1">
          <span className="text-[11px] font-mono text-neutral-400 block uppercase">In Active Trades</span>
          <span className="text-lg font-bold text-sky-400 font-mono">${totalAllocated.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
          <span className="text-[10px] text-neutral-500 font-mono block">{activeTrades.length} open campaign{activeTrades.length === 1 ? "" : "s"}</span>
        </div>

        {/* Total Risk at Risk */}
        <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4 space-y-1">
          <span className="text-[11px] font-mono text-neutral-400 block uppercase">Open Risk Cap</span>
          <div className="flex items-center space-x-1.5">
            <span className={`text-lg font-bold font-mono ${isRiskSafe ? "text-emerald-400" : "text-rose-400"}`}>
              ${totalOpenRisk.toFixed(0)}
            </span>
            <span className={`text-xs font-mono font-semibold ${isRiskSafe ? "text-emerald-400" : "text-rose-400"}`}>
              ({openRiskPct.toFixed(1)}%)
            </span>
          </div>
          <span className="text-[10px] text-neutral-500 font-mono block">Max 3.0% allowed</span>
        </div>

        {/* Max Loss Per Trade */}
        <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4 space-y-1">
          <span className="text-[11px] font-mono text-neutral-400 block uppercase">1% Trade Risk</span>
          <span className="text-lg font-bold text-amber-400 font-mono">${(accountSize * 0.01).toFixed(0)} / trade</span>
          <span className="text-[10px] text-neutral-500 font-mono block">Strict hard stop limit</span>
        </div>
      </div>
    </div>
  );
};
