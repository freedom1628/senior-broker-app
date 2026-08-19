"use client";

import React, { useState } from "react";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  PlusCircle,
  HelpCircle,
} from "lucide-react";

interface CoachFeedProps {
  report: any | null;
  activeTrades: any[];
  marketQuotes: Record<string, any>;
  onRefreshReport: () => void;
  onScaleT1: (tradeId: string, fillPrice?: number) => void;
  onCloseTrade: (tradeId: string, exitReason: string, closePrice?: number) => void;
  onOpenAddTrade: () => void;
  onOpenLearning: () => void;
}

export const CoachFeed: React.FC<CoachFeedProps> = ({
  report,
  activeTrades,
  marketQuotes,
  onRefreshReport,
  onScaleT1,
  onCloseTrade,
  onOpenAddTrade,
  onOpenLearning,
}) => {
  const [copied, setCopied] = useState(false);
  const [expandedWhy, setExpandedWhy] = useState<number | null>(null);

  const actionItems = report?.actionItems || [];
  const deskChecklist = report?.deskChecklist || [
    "Strict 1% account risk enforced per position.",
    "Sell 50% at Target 1 and immediately move stop to Breakeven.",
    "Honor 5–7 session time stop if momentum stalls.",
    "Maintain maximum 3.0% total open sleeve risk.",
  ];

  const handleCopy = () => {
    const text = `
=== SENIOR BROKER AI SWING COACH BRIEFING ===
Date: ${new Date().toLocaleString()}
Market Regime: ${report?.marketRegime || "FAVORABLE"}
Open Positions: ${activeTrades.length}

TACTICAL MOVES:
${actionItems.length > 0
  ? actionItems.map((a: any, idx: number) => `${idx + 1}. [${a.urgency}] ${a.ticker}: ${a.headline}\n   Action: ${a.suggestedOrder}`).join("\n\n")
  : "• All open positions are behaving within normal parameters. Continue holding with hard stops active."}

CORE SWING DESK RULES:
${deskChecklist.map((c: string) => `• ${c}`).join("\n")}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header Bar */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-6 backdrop-blur-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-wider text-sky-400">
              AI Swing Trading Coach
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
            Tactical Action Feed &amp; Position Checking
          </h2>
          <p className="text-xs text-neutral-400 font-mono">
            Analyzes active positions against live tape to guide future moves &amp; risk
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={onRefreshReport}
            className="flex items-center space-x-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-xs text-neutral-300 hover:bg-white/[0.08] transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Re-Check Tape</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-900 shadow hover:bg-neutral-100 transition active:scale-95"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Copied</span>
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

      {/* Actionable Move Cards */}
      <div className="space-y-4">
        {actionItems.length === 0 ? (
          <div className="rounded-3xl border border-white/[0.08] bg-[#0E121D]/80 p-8 text-center backdrop-blur-xl shadow-md space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-white">
              All Positions Aligned with Strategy
            </h3>
            <p className="text-xs text-neutral-400 max-w-md mx-auto">
              No immediate high-urgency scales or stop violations. Your active holdings are tracking within normal parameters.
            </p>
            {activeTrades.length === 0 && (
              <button
                onClick={onOpenAddTrade}
                className="inline-flex items-center space-x-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-400 transition"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Log Your First Swing Position</span>
              </button>
            )}
          </div>
        ) : (
          actionItems.map((item: any, idx: number) => {
            const matchingTrade = activeTrades.find(
              (t) => t.ticker.toUpperCase() === item.ticker.toUpperCase()
            );
            const isTargetScale = item.suggestedOrder?.includes("SCALE") || item.suggestedOrder?.includes("T1");
            const isTimeStop = item.suggestedOrder?.includes("TIME") || item.headline?.includes("Stale");
            const isExpanded = expandedWhy === idx;

            return (
              <div
                key={idx}
                className="rounded-3xl border border-white/[0.08] bg-[#0E121D]/90 p-5 sm:p-6 backdrop-blur-xl shadow-lg space-y-4 transition hover:border-white/20"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-mono font-bold text-xs ${
                        item.urgency === "HIGH"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : item.urgency === "MEDIUM"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                      }`}
                    >
                      {item.urgency}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-base font-bold text-white font-mono">
                          {item.ticker}
                        </span>
                        <span className="text-xs text-neutral-400 font-mono">
                          {item.headline}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-300 mt-1 font-mono">
                        Suggested Move: <span className="text-sky-300 font-semibold">{item.suggestedOrder}</span>
                      </p>
                    </div>
                  </div>

                  {/* 1-Click Action Buttons */}
                  <div className="flex items-center space-x-2">
                    {matchingTrade && isTargetScale && (
                      <button
                        onClick={() => onScaleT1(matchingTrade.id, matchingTrade.target1)}
                        className="flex items-center space-x-1.5 rounded-full bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-400 transition active:scale-95"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Scale 50% &amp; Move Stop to B/E</span>
                      </button>
                    )}

                    {matchingTrade && isTimeStop && (
                      <button
                        onClick={() => onCloseTrade(matchingTrade.id, "TIME_STOP")}
                        className="flex items-center space-x-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 px-3.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition active:scale-95"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        <span>Exit Stale Trade</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Educational "Why This Move?" Expandable */}
                <div className="border-t border-white/[0.06] pt-3">
                  <button
                    onClick={() => setExpandedWhy(isExpanded ? null : idx)}
                    className="flex items-center space-x-1.5 text-xs text-neutral-400 hover:text-sky-400 transition font-mono"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>Why did the Coach recommend this move?</span>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-2.5 rounded-2xl border border-sky-500/20 bg-sky-500/[0.05] p-3.5 text-xs leading-relaxed text-neutral-300 space-y-1.5 animate-in fade-in duration-150">
                      <div className="font-semibold text-sky-300">Institutional Strategy Rule:</div>
                      <p>
                        {isTargetScale
                          ? "Scaling 50% at Target 1 (2:1 R:R) locks in +1.0R in profit and eliminates all remaining downside risk by setting the stop to breakeven. This creates a risk-free 'Free Roll' on the remaining shares toward Target 2."
                          : isTimeStop
                          ? "Swing trading positions that fail to follow through within 5 to 7 sessions tie up buying power with declining momentum. Exiting preserves capital to rotate into fresh breakout candidates."
                          : "Maintaining disciplined stops and position sizing guarantees that no individual trade can jeopardize more than 1% of your dedicated trading sleeve."}
                      </p>
                      <button
                        onClick={onOpenLearning}
                        className="text-[11px] text-sky-400 underline pt-1 block"
                      >
                        Read full lesson in Investor Learning Center →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
