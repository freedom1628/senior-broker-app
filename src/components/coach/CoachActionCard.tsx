"use client";

import React, { useState } from "react";
import { PortfolioActionItem } from "@/lib/portfolio/daily-report";
import { Trade } from "@/lib/storage/types";
import { WhyDrawer } from "./WhyDrawer";
import { playTargetChime, playEntryTriggered } from "@/lib/audio/sounds";
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Zap,
  ArrowRight,
  HelpCircle,
  Sparkles,
} from "lucide-react";

export interface CoachActionCardProps {
  item: PortfolioActionItem;
  matchingTrade?: Trade;
  currentQuote?: any;
  onScaleT1?: (tradeId: string, fillPrice?: number) => void;
  onUpdateStop?: (tradeId: string, newStop: number) => void;
  onCloseTrade?: (tradeId: string, exitReason: string, closePrice?: number) => void;
  onActivatePending?: (tradeId: string, fillPrice?: number) => void;
  onOpenLearning?: () => void;
}

export const CoachActionCard: React.FC<CoachActionCardProps> = ({
  item,
  matchingTrade,
  currentQuote,
  onScaleT1,
  onUpdateStop,
  onCloseTrade,
  onActivatePending,
  onOpenLearning,
}) => {
  const [isWhyOpen, setIsWhyOpen] = useState(false);

  const isHigh = item.urgency === "HIGH";
  const isMedium = item.urgency === "MEDIUM";
  const currentTape = currentQuote?.price || item.currentPrice;

  // Determine why rationale
  let whyRationale = "";
  let institutionalRule = "";

  if (item.actionType === "TAKE_PROFIT") {
    whyRationale =
      "Scaling 50% at Target 1 (+2.0R) locks in a guaranteed profitable campaign (+1.0R guaranteed gain) and finances the remaining runner to Target 2 (+3.5R) with zero downside risk.";
    institutionalRule =
      "Rule #2 (Asymmetric 2:1 R:R & Target Scaling): Never give back a 2R gain. Bank 50% at T1 and ratchet stop to Breakeven.";
  } else if (item.actionType === "TIME_STOP_WARNING" || item.headline.includes("Time Stop")) {
    whyRationale =
      "Breakout catalysts deliver price expansion within 3 to 5 sessions. If a position stagnates for 5–7 sessions without follow-through, technical momentum has decayed, and capital is better reallocated to fresh setups.";
    institutionalRule =
      "Rule #3 (Time Stops vs Price Stops): 5–7 session time stop limit. Dead money carries severe opportunity cost.";
  } else if (item.actionType === "ENTRY_TRIGGER") {
    whyRationale =
      "Price has crossed the predefined technical pivot point. Executing immediately captures the catalyst expansion phase while maintaining planned 1% risk distance to the hard stop.";
    institutionalRule =
      "Rule #1 (The 1% Risk Formula): Enter strictly at confirmed technical triggers with pre-calculated share sizes.";
  } else if (item.actionType === "RISK_ALERT") {
    whyRationale =
      "Aggregate open risk across all positions must remain at or below 3.0% of total dedicated capital ($450 on $15k) to protect against broad market regime shocks.";
    institutionalRule =
      "Rule #4 (Sector Concentration & Sleeve Caps): Max 3 concurrent positions, max 3.0% total sleeve open risk.";
  } else {
    whyRationale =
      "This position is progressing constructively according to the trade thesis. Maintain stops and allow technical expansion towards target.";
    institutionalRule =
      "Rule #5 (Market Regime & Trend Riding): Let winners run until predefined target levels are reached.";
  }

  const handleScaleClick = () => {
    if (matchingTrade && onScaleT1) {
      playTargetChime();
      onScaleT1(matchingTrade.id, currentTape);
    }
  };

  const handleStaleExitClick = () => {
    if (matchingTrade && onCloseTrade) {
      onCloseTrade(matchingTrade.id, "TIME_STOP_EXIT", currentTape);
    }
  };

  const handleFillEntryClick = () => {
    if (matchingTrade && onActivatePending) {
      playEntryTriggered();
      onActivatePending(matchingTrade.id, currentTape);
    }
  };

  return (
    <div
      className={`rounded-3xl border p-5 sm:p-6 backdrop-blur-2xl transition space-y-4 shadow-xl ${
        isHigh
          ? "border-rose-500/30 bg-rose-500/[0.04] hover:border-rose-500/50"
          : isMedium
          ? "border-amber-500/30 bg-amber-500/[0.04] hover:border-amber-500/50"
          : "border-white/[0.08] bg-[#0C101A]/80 hover:border-white/[0.15]"
      }`}
    >
      {/* Header */}
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
            {item.urgency} URGENCY
          </span>

          <span className="font-mono text-lg font-bold text-white tracking-tight">
            {item.ticker}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {item.rMultiple !== undefined && (
            <span
              className={`font-mono text-xs font-bold rounded-full px-2.5 py-0.5 ${
                item.rMultiple >= 2.0
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : item.rMultiple >= 0
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
              }`}
            >
              {item.rMultiple >= 0 ? "+" : ""}{item.rMultiple.toFixed(2)} R
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsWhyOpen(true)}
            className="flex items-center space-x-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] text-sky-300 hover:bg-sky-500/20 transition"
            title="Expand institutional rationale for this recommendation"
          >
            <HelpCircle className="h-3 w-3" />
            <span className="font-mono">Why?</span>
          </button>
        </div>
      </div>

      {/* Headline & Details */}
      <div>
        <h4 className="text-sm font-semibold text-white tracking-tight">
          {item.headline}
        </h4>
        <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
          {item.details}
        </p>
      </div>

      {/* Suggested Order Execution Box */}
      <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-3.5 text-xs font-mono text-sky-200 flex items-start space-x-2.5">
        <ArrowRight className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-sky-400 uppercase tracking-wider text-[10px] block">
            Suggested Execution Order:
          </span>
          <span className="text-white font-medium">{item.suggestedOrder}</span>
        </div>
      </div>

      {/* 1-Click Action Dispatch Button Row */}
      {matchingTrade && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
          <span className="text-[11px] font-mono text-neutral-400">
            Position State: {matchingTrade.status} ({matchingTrade.sharesRemaining} sh)
          </span>

          <div className="flex items-center space-x-2">
            {/* Scale T1 Action */}
            {item.actionType === "TAKE_PROFIT" && matchingTrade.status === "ACTIVE" && onScaleT1 && (
              <button
                type="button"
                onClick={handleScaleClick}
                className="flex items-center space-x-1.5 rounded-full bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition active:scale-95"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                <span>1-Click Scale 50% &amp; B/E</span>
              </button>
            )}

            {/* Time Stop Stale Exit Action */}
            {(item.actionType === "TIME_STOP_WARNING" || item.headline.includes("Time Stop")) &&
              onCloseTrade && (
                <button
                  type="button"
                  onClick={handleStaleExitClick}
                  className="flex items-center space-x-1.5 rounded-full bg-rose-500/20 border border-rose-500/40 px-3.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/30 transition active:scale-95"
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>1-Click Exit Stale</span>
                </button>
              )}

            {/* Fill Entry Action for Pending Orders */}
            {item.actionType === "ENTRY_TRIGGER" &&
              matchingTrade.status === "PENDING_ENTRY" &&
              onActivatePending && (
                <button
                  type="button"
                  onClick={handleFillEntryClick}
                  className="flex items-center space-x-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-900 shadow hover:bg-neutral-100 transition active:scale-95"
                >
                  <Zap className="h-3.5 w-3.5 text-emerald-600" />
                  <span>1-Click Fill Entry</span>
                </button>
              )}
          </div>
        </div>
      )}

      {/* Contextual "Why?" Drawer */}
      <WhyDrawer
        isOpen={isWhyOpen}
        onClose={() => setIsWhyOpen(false)}
        title={item.headline}
        ticker={item.ticker}
        rationale={whyRationale}
        institutionalRule={institutionalRule}
        onOpenLearning={onOpenLearning}
      />
    </div>
  );
};

export default CoachActionCard;
