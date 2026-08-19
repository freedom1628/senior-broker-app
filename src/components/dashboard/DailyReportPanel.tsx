"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Layers,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { PortfolioActionItem, DailyPortfolioReport } from "@/lib/portfolio/daily-report";

interface DailyReportPanelProps {
  report: DailyPortfolioReport | null;
  onRefreshReport: () => void;
  onNavigateToTrades: () => void;
}

export const DailyReportPanel: React.FC<DailyReportPanelProps> = ({
  report,
  onRefreshReport,
  onNavigateToTrades,
}) => {
  const [copied, setCopied] = useState(false);

  if (!report) {
    return (
      <div className="py-20 text-center text-neutral-400">
        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-sky-400" />
        <p className="text-sm font-mono">Generating daily portfolio intelligence briefing...</p>
      </div>
    );
  }

  const { portfolioSummary, actionItems, sectorExposure, deskChecklist } = report;

  const handleCopyReport = () => {
    const text = `
=== SENIOR BROKER DAILY PORTFOLIO BRIEFING ===
Date: ${new Date(report.generatedAt).toLocaleString()}
Desk Regime: ${report.marketRegime}
Open Positions: ${portfolioSummary.totalOpenPositions} | Open Risk: $${portfolioSummary.aggregateRiskDollars} (${portfolioSummary.aggregateRiskPct}%)
Unrealized P&L: $${portfolioSummary.totalUnrealizedPnL}

PRIORITIZED DAILY MOVES TO CONSIDER:
${actionItems.map((item, idx) => `${idx + 1}. [${item.urgency}] ${item.ticker} — ${item.headline}\n   Action: ${item.suggestedOrder}`).join("\n\n")}

STANDING DESK RULES:
${deskChecklist.map(c => `• ${c}`).join("\n")}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header Card */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-6 backdrop-blur-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-wider text-sky-400">
              Senior Broker Tactical Briefing
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
            Daily Moves To Consider &amp; Position Actions
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5 font-mono">
            Generated {new Date(report.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Active tape sync
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={onRefreshReport}
            className="flex items-center space-x-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-xs text-neutral-300 hover:bg-white/[0.08] transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh Intelligence</span>
          </button>

          <button
            onClick={handleCopyReport}
            className="flex items-center space-x-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-900 shadow hover:bg-neutral-100 transition active:scale-95"
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

      {/* Portfolio Health Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-5 backdrop-blur-2xl">
          <span className="text-[11px] font-mono uppercase text-neutral-400">Open Risk Capital</span>
          <div className="font-mono text-2xl font-bold text-amber-400 mt-1">
            ${portfolioSummary.aggregateRiskDollars.toFixed(2)}
          </div>
          <span className="text-[10px] text-neutral-500 font-mono">
            {portfolioSummary.aggregateRiskPct}% of account (3.0% max cap)
          </span>
        </div>

        <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-5 backdrop-blur-2xl">
          <span className="text-[11px] font-mono uppercase text-neutral-400">Floating Unrealized P&amp;L</span>
          <div
            className={`font-mono text-2xl font-bold mt-1 ${
              portfolioSummary.totalUnrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {portfolioSummary.totalUnrealizedPnL >= 0 ? "+" : ""}${portfolioSummary.totalUnrealizedPnL.toFixed(2)}
          </div>
          <span className="text-[10px] text-neutral-500 font-mono">Across {portfolioSummary.totalOpenPositions} active holdings</span>
        </div>

        <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-5 backdrop-blur-2xl">
          <span className="text-[11px] font-mono uppercase text-neutral-400">Top Runner Holding</span>
          <div className="font-mono text-xl font-bold text-purple-300 mt-1 truncate">
            {portfolioSummary.topPerformingTicker || "None active"}
          </div>
          <span className="text-[10px] text-neutral-500 font-mono">Highest R-multiple campaign</span>
        </div>

        <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-5 backdrop-blur-2xl">
          <span className="text-[11px] font-mono uppercase text-neutral-400">Watch Queue</span>
          <div className="font-mono text-2xl font-bold text-sky-400 mt-1">
            {portfolioSummary.pendingOrdersCount} setups
          </div>
          <span className="text-[10px] text-neutral-500 font-mono">Coiling near breakout triggers</span>
        </div>
      </div>

      {/* Action Items List */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-6 sm:p-8 backdrop-blur-2xl shadow-xl space-y-4">
        <div className="border-b border-white/[0.06] pb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">
              Prioritized Daily Moves ({actionItems.length} Identified)
            </h3>
            <p className="text-xs text-neutral-400">
              Evaluated using 1% risk math, 2:1 R:R thresholds, trailing stops, and time-stop limits
            </p>
          </div>
        </div>

        {actionItems.length === 0 ? (
          <div className="py-12 text-center text-neutral-500 text-xs font-mono">
            No urgent actions needed. All open positions are holding according to plan.
          </div>
        ) : (
          <div className="space-y-3.5">
            {actionItems.map((item, idx) => {
              const isHigh = item.urgency === "HIGH";
              const isMedium = item.urgency === "MEDIUM";

              return (
                <div
                  key={idx}
                  className={`rounded-2xl border p-4 sm:p-5 transition space-y-3 ${
                    isHigh
                      ? "border-rose-500/30 bg-rose-500/[0.04]"
                      : isMedium
                      ? "border-amber-500/30 bg-amber-500/[0.04]"
                      : "border-white/[0.06] bg-white/[0.02]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${
                          isHigh
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                            : isMedium
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        }`}
                      >
                        {item.urgency} ACTION
                      </span>

                      <span className="font-mono text-base font-bold text-white">
                        {item.ticker}
                      </span>
                    </div>

                    {item.rMultiple !== undefined && (
                      <span className="font-mono text-xs font-semibold text-emerald-400">
                        {item.rMultiple >= 0 ? "+" : ""}{item.rMultiple} R on trade
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      {item.headline}
                    </h4>
                    <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                      {item.details}
                    </p>
                  </div>

                  {/* Broker Suggested Order Box */}
                  <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] p-3 text-xs font-mono text-sky-200 flex items-start space-x-2">
                    <ArrowRight className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-sky-400 uppercase tracking-wider block text-[10px]">
                        Recommended Execution:
                      </span>
                      {item.suggestedOrder}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Standing Desk Checklist & Sector Balance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Sector Exposure Balance */}
        <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-6 backdrop-blur-2xl">
          <h3 className="text-sm font-semibold text-white flex items-center space-x-2 mb-4">
            <Layers className="h-4 w-4 text-sky-400" />
            <span>Sector Diversification Balance</span>
          </h3>

          <div className="space-y-3 font-mono text-xs">
            {Object.entries(sectorExposure).length === 0 ? (
              <p className="text-neutral-500">No active sector allocations.</p>
            ) : (
              Object.entries(sectorExposure).map(([sec, count]) => (
                <div key={sec} className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                  <span className="text-neutral-300">{sec}</span>
                  <span className={`font-bold ${count > 2 ? "text-amber-400" : "text-emerald-400"}`}>
                    {count} position{count > 1 ? "s" : ""} {count > 2 ? "(Max Cap Warning)" : "(Within Bounds)"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Senior Broker Standing Checklist */}
        <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-6 backdrop-blur-2xl">
          <h3 className="text-sm font-semibold text-white flex items-center space-x-2 mb-4">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Desk Standing Execution Checklist</span>
          </h3>

          <ul className="space-y-2 text-xs text-neutral-300">
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
