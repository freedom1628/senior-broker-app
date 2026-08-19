"use client";

import React, { useState } from "react";
import { DailyPortfolioReport, PortfolioActionItem } from "@/lib/portfolio/daily-report";
import { Trade } from "@/lib/storage/types";
import { CoachActionCard } from "./CoachActionCard";
import {
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  TrendingUp,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Sun,
  Moon,
  Filter,
  ArrowRight,
  Zap,
} from "lucide-react";

export interface TacticalBriefingPanelProps {
  report: DailyPortfolioReport | null;
  activeTrades?: Trade[];
  marketQuotes?: Record<string, any>;
  accountSize?: number;
  onRefreshReport: () => void;
  onScaleT1?: (tradeId: string, fillPrice?: number) => void;
  onUpdateStop?: (tradeId: string, newStop: number) => void;
  onCloseTrade?: (tradeId: string, exitReason: string, closePrice?: number) => void;
  onActivatePending?: (tradeId: string, fillPrice?: number) => void;
  onOpenAddTrade?: () => void;
  onOpenLearning?: () => void;
  onNavigateToTrades?: () => void;
  onOpenImport?: () => void;
  onOpenSettings?: () => void;
}

export const TacticalBriefingPanel: React.FC<TacticalBriefingPanelProps> = ({
  report,
  activeTrades = [],
  marketQuotes = {},
  accountSize = 15000,
  onRefreshReport,
  onScaleT1,
  onUpdateStop,
  onCloseTrade,
  onActivatePending,
  onOpenAddTrade,
  onOpenLearning,
  onNavigateToTrades,
  onOpenImport,
  onOpenSettings,
}) => {
  const [copied, setCopied] = useState(false);
  const [urgencyFilter, setUrgencyFilter] = useState<"ALL" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const [sessionMode, setSessionMode] = useState<"MORNING" | "MIDDAY">(() => {
    const hour = new Date().getHours();
    return hour < 11 ? "MORNING" : "MIDDAY";
  });

  if (!report) {
    return (
      <div className="py-24 text-center text-neutral-400 space-y-3">
        <RefreshCw className="h-7 w-7 animate-spin mx-auto text-sky-400" />
        <p className="text-sm font-mono">Generating daily tactical portfolio briefing...</p>
      </div>
    );
  }

  const { portfolioSummary, actionItems, sectorExposure, deskChecklist } = report;

  // Filter action items by urgency
  const filteredActionItems = actionItems.filter((item) => {
    if (urgencyFilter === "ALL") return true;
    return item.urgency === urgencyFilter;
  });

  const highUrgencyCount = actionItems.filter((a) => a.urgency === "HIGH").length;
  const medUrgencyCount = actionItems.filter((a) => a.urgency === "MEDIUM").length;

  const handleCopyMarkdown = () => {
    const lines: string[] = [];
    lines.push(`# Senior Broker — Daily Tactical Moves Briefing`);
    lines.push(`**Generated:** ${new Date(report.generatedAt).toUTCString()}`);
    lines.push(`**Session Mode:** ${sessionMode === "MORNING" ? "Morning Pre-Market" : "Mid-Day Tape"} Briefing`);
    lines.push(`**Market Regime:** ${report.marketRegime}`);
    lines.push(``);
    lines.push(`## Sleeve Summary`);
    lines.push(`- **Dedicated Swing Capital:** $${accountSize.toLocaleString()}`);
    lines.push(`- **Open Positions:** ${portfolioSummary.totalOpenPositions} active (Max 3)`);
    lines.push(`- **Pending Watch Orders:** ${portfolioSummary.pendingOrdersCount} queued`);
    lines.push(`- **Open Dollar Risk:** $${portfolioSummary.aggregateRiskDollars.toFixed(2)} (${portfolioSummary.aggregateRiskPct}% of 3.0% cap)`);
    lines.push(`- **Floating Unrealized P&L:** $${portfolioSummary.totalUnrealizedPnL.toFixed(2)}`);
    if (portfolioSummary.topPerformingTicker) {
      lines.push(`- **Top Performer:** ${portfolioSummary.topPerformingTicker}`);
    }
    lines.push(``);
    lines.push(`## Prioritized Tactical Action Items (${actionItems.length} Identified)`);
    if (actionItems.length === 0) {
      lines.push(`- [x] No immediate tactical actions required. All positions holding within rules.`);
    } else {
      actionItems.forEach((item, idx) => {
        lines.push(``);
        lines.push(`### ${idx + 1}. [${item.urgency}] ${item.ticker} — ${item.headline}`);
        lines.push(`- **Details:** ${item.details}`);
        lines.push(`- **Suggested Order:** \`${item.suggestedOrder}\``);
        if (item.rMultiple !== undefined) {
          lines.push(`- **R-Multiple:** +${item.rMultiple.toFixed(2)}R`);
        }
      });
    }
    lines.push(``);
    lines.push(`## Desk Standing Execution Checklist`);
    deskChecklist.forEach((c) => {
      lines.push(`- [ ] ${c}`);
    });

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Briefing Header Card */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-6 sm:p-8 backdrop-blur-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-wider text-sky-400 font-bold">
              Senior Broker Tactical Intelligence
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {sessionMode === "MORNING"
              ? "Morning Pre-Market Tactical Briefing"
              : "Mid-Day Tape & Moves Briefing"}
          </h2>
          <p className="text-xs text-neutral-400 font-mono">
            Generated {new Date(report.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • Regime:{" "}
            <span className="text-emerald-400 font-semibold">{report.marketRegime}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Session Mode Switcher */}
          <div className="flex rounded-full bg-black/40 p-1 border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setSessionMode("MORNING")}
              className={`flex items-center space-x-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                sessionMode === "MORNING"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Sun className="h-3.5 w-3.5" />
              <span>Morning</span>
            </button>
            <button
              type="button"
              onClick={() => setSessionMode("MIDDAY")}
              className={`flex items-center space-x-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                sessionMode === "MIDDAY"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Moon className="h-3.5 w-3.5" />
              <span>Mid-Day</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onRefreshReport}
            className="flex items-center space-x-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-xs text-neutral-300 hover:bg-white/[0.08] transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>

          {/* 1-Click Markdown Copy Button */}
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="flex items-center space-x-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-900 shadow hover:bg-neutral-100 transition active:scale-95"
            title="Copies standardized Markdown report to clipboard for Obsidian, Notion, or Apple Notes"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Briefing Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Daily Briefing</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sleeve Health Summary Metric Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Risk */}
        <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-5 backdrop-blur-2xl">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">Open Risk Capital</span>
          <div className="font-mono text-2xl font-bold text-amber-400 mt-1">
            ${portfolioSummary.aggregateRiskDollars.toFixed(2)}
          </div>
          <span className="text-[10px] text-neutral-500 font-mono">
            {portfolioSummary.aggregateRiskPct}% of sleeve (3.0% max cap)
          </span>
        </div>

        {/* Floating PnL */}
        <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-5 backdrop-blur-2xl">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">Floating Unrealized P&amp;L</span>
          <div
            className={`font-mono text-2xl font-bold mt-1 ${
              portfolioSummary.totalUnrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {portfolioSummary.totalUnrealizedPnL >= 0 ? "+" : ""}${portfolioSummary.totalUnrealizedPnL.toFixed(2)}
          </div>
          <span className="text-[10px] text-neutral-500 font-mono">
            Across {portfolioSummary.totalOpenPositions} active holdings
          </span>
        </div>

        {/* Top Performer */}
        <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-5 backdrop-blur-2xl">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">Top Runner Holding</span>
          <div className="font-mono text-xl font-bold text-purple-300 mt-1 truncate">
            {portfolioSummary.topPerformingTicker || "None active"}
          </div>
          <span className="text-[10px] text-neutral-500 font-mono">
            Highest R-multiple campaign
          </span>
        </div>

        {/* Watch Queue */}
        <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-5 backdrop-blur-2xl">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">Watch Queue</span>
          <div className="font-mono text-2xl font-bold text-sky-400 mt-1">
            {portfolioSummary.pendingOrdersCount} setups
          </div>
          <span className="text-[10px] text-neutral-500 font-mono">
            Coiling near breakout triggers
          </span>
        </div>
      </div>

      {/* Action Items Section with Urgency Triage Filters */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-sky-400" />
              <span>Prioritized Tactical Moves ({actionItems.length} Total)</span>
            </h3>
            <p className="text-xs text-neutral-400 font-mono">
              Evaluated with strict 1% risk math, 2:1 R:R scaling, trailing stops, and 5–7 session limits
            </p>
          </div>

          {/* Urgency Filter Pills */}
          <div className="flex rounded-full bg-black/40 p-1 border border-white/[0.08] text-xs font-mono">
            <button
              type="button"
              onClick={() => setUrgencyFilter("ALL")}
              className={`px-3 py-1 rounded-full transition ${
                urgencyFilter === "ALL"
                  ? "bg-white text-neutral-900 font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              All ({actionItems.length})
            </button>
            <button
              type="button"
              onClick={() => setUrgencyFilter("HIGH")}
              className={`px-3 py-1 rounded-full transition ${
                urgencyFilter === "HIGH"
                  ? "bg-rose-500 text-white font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              High ({highUrgencyCount})
            </button>
            <button
              type="button"
              onClick={() => setUrgencyFilter("MEDIUM")}
              className={`px-3 py-1 rounded-full transition ${
                urgencyFilter === "MEDIUM"
                  ? "bg-amber-500 text-white font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Med ({medUrgencyCount})
            </button>
            <button
              type="button"
              onClick={() => setUrgencyFilter("LOW")}
              className={`px-3 py-1 rounded-full transition ${
                urgencyFilter === "LOW"
                  ? "bg-emerald-500 text-white font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Low ({actionItems.length - highUrgencyCount - medUrgencyCount})
            </button>
          </div>
        </div>

        {filteredActionItems.length === 0 ? (
          <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-12 text-center text-neutral-400 space-y-2">
            <ShieldCheck className="h-8 w-8 text-emerald-400 mx-auto" />
            <p className="text-sm font-medium text-white">No actions in this category.</p>
            <p className="text-xs text-neutral-500 font-mono">
              All monitored swing positions are tracking safely within institutional rules.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredActionItems.map((item, idx) => {
              const matchingTrade = activeTrades.find(
                (t) => t.ticker.toUpperCase() === item.ticker.toUpperCase()
              );
              const currentQuote = marketQuotes[item.ticker.toUpperCase()];

              return (
                <CoachActionCard
                  key={idx}
                  item={item}
                  matchingTrade={matchingTrade}
                  currentQuote={currentQuote}
                  onScaleT1={onScaleT1}
                  onUpdateStop={onUpdateStop}
                  onCloseTrade={onCloseTrade}
                  onActivatePending={onActivatePending}
                  onOpenLearning={onOpenLearning}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Diversification & Standing Checklist Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sector Concentration Balance */}
        <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-6 backdrop-blur-2xl shadow-xl space-y-4">
          <div className="flex items-center space-x-2 border-b border-white/[0.06] pb-3">
            <Layers className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-white">
              Sector Concentration Balance (Max 2 per Sector)
            </h3>
          </div>

          <div className="space-y-2.5 font-mono text-xs">
            {Object.entries(sectorExposure).length === 0 ? (
              <p className="text-neutral-500">No active sector allocations.</p>
            ) : (
              Object.entries(sectorExposure).map(([sec, count]) => (
                <div
                  key={sec}
                  className="flex items-center justify-between border-b border-white/[0.04] pb-2"
                >
                  <span className="text-neutral-300">{sec}</span>
                  <span
                    className={`font-bold ${
                      count > 2
                        ? "text-rose-400"
                        : count === 2
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {count} position{count > 1 ? "s" : ""}{" "}
                    {count > 2
                      ? "(Cap Exceeded)"
                      : count === 2
                      ? "(At Limit)"
                      : "(Within Bounds)"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Standing Desk Checklist */}
        <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-6 backdrop-blur-2xl shadow-xl space-y-4">
          <div className="flex items-center space-x-2 border-b border-white/[0.06] pb-3">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">
              Senior Broker Standing Execution Checklist
            </h3>
          </div>

          <ul className="space-y-2.5 text-xs text-neutral-300 font-mono">
            {deskChecklist.map((c, i) => (
              <li key={i} className="flex items-start space-x-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TacticalBriefingPanel;
