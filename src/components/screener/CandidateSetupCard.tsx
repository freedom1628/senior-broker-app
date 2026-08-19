"use client";

import React from "react";
import { MasterSetup, ParsedCandidate } from "@/lib/ai/types";
import { VisualPriceLadder } from "./VisualPriceLadder";
import {
  Sparkles,
  TrendingUp,
  Clock,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Play,
  Eye,
  Check,
  Zap,
} from "lucide-react";
import { playAudioChime } from "@/lib/audio/sound-effects";

export interface CandidateSetupCardProps {
  setup: MasterSetup | ParsedCandidate;
  liveQuote?: {
    price: number;
    change: number;
    changePct: number;
    high?: number;
    low?: number;
    volume?: number;
  };
  onPromoteToTrade: (setup: MasterSetup | ParsedCandidate, mode: "PENDING_ENTRY" | "ACTIVE") => void;
  accountSize?: number;
  riskPercent?: number;
}

export const CandidateSetupCard: React.FC<CandidateSetupCardProps> = ({
  setup,
  liveQuote,
  onPromoteToTrade,
  accountSize = 15000,
  riskPercent = 1.0,
}) => {
  const isMasterSetup = "isConsensusPick" in setup;
  const isConsensus = isMasterSetup ? (setup as MasterSetup).isConsensusPick : false;
  const consensusCount = isMasterSetup ? (setup as MasterSetup).consensusCount : 1;
  const modelsAgreed = isMasterSetup ? (setup as MasterSetup).modelsAgreed : [setup.modelSource];

  const handlePromote = (mode: "PENDING_ENTRY" | "ACTIVE") => {
    try {
      playAudioChime(mode === "ACTIVE" ? "PROMOTION" : "CLICK");
    } catch {
      // Audio optional
    }
    onPromoteToTrade(setup, mode);
  };

  const currentPrice = liveQuote?.price ?? setup.entryTrigger;
  const changePct = liveQuote?.changePct ?? 0;
  const isPositive = changePct >= 0;

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 bg-[#0C101A] backdrop-blur-xl shadow-xl overflow-hidden flex flex-col justify-between ${
        isConsensus
          ? "border-purple-500/40 ring-1 ring-purple-500/20 shadow-purple-950/20"
          : "border-white/[0.08] hover:border-white/[0.15]"
      }`}
    >
      {/* 1. Card Top / Header */}
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-2xl font-bold tracking-tight text-white">
                {setup.ticker}
              </span>
              <span className="rounded-full bg-slate-800/80 border border-slate-700/60 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                {setup.setupType}
              </span>
              {isConsensus && (
                <span className="flex items-center space-x-1 rounded-full bg-purple-500/20 border border-purple-500/40 px-2.5 py-0.5 text-[11px] font-bold text-purple-300 animate-pulse">
                  <Sparkles className="h-3 w-3 text-purple-400" />
                  <span>CONSENSUS PICK (+5 BONUS)</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium truncate max-w-[280px]">
              {setup.companyName || `${setup.ticker} Corp.`}
            </p>
          </div>

          {/* Conviction Score Pill */}
          <div className="flex flex-col items-end">
            <div
              className={`flex items-center space-x-1 rounded-full px-3 py-1 text-xs font-mono font-bold border ${
                setup.score >= 90
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : setup.score >= 80
                  ? "bg-sky-500/15 border-sky-500/40 text-sky-300"
                  : "bg-amber-500/15 border-amber-500/40 text-amber-300"
              }`}
            >
              <span>Score: {setup.score.toFixed(1)}</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 font-mono">100-pt rubric</span>
          </div>
        </div>

        {/* Model Attribution Badges */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-slate-500 mr-1">Models:</span>
          {modelsAgreed.map((model) => {
            const mLower = model.toLowerCase();
            let badgeStyle = "bg-slate-800 text-slate-300 border-slate-700";
            if (mLower.includes("gemini")) badgeStyle = "bg-indigo-500/20 text-indigo-300 border-indigo-500/30";
            else if (mLower.includes("claude")) badgeStyle = "bg-amber-500/20 text-amber-300 border-amber-500/30";
            else if (mLower.includes("openai") || mLower.includes("chatgpt") || mLower.includes("o3")) {
              badgeStyle = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
            }
            return (
              <span
                key={model}
                className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${badgeStyle}`}
              >
                {model}
              </span>
            );
          })}
        </div>

        {/* Live Tape Snapshot Strip */}
        <div className="flex items-center justify-between rounded-xl bg-black/40 border border-white/[0.05] px-3.5 py-2 text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Current Quote:</span>
            <span className="font-bold text-white">${currentPrice.toFixed(2)}</span>
          </div>
          <div className={`flex items-center space-x-1 font-semibold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
            <span>{isPositive ? "+" : ""}{changePct.toFixed(2)}%</span>
            {liveQuote?.volume && (
              <span className="text-slate-500 text-[10px] font-normal ml-2">
                Vol: {(liveQuote.volume / 1000000).toFixed(1)}M
              </span>
            )}
          </div>
        </div>

        {/* 2. Visual 4-Tier Price Ladder */}
        <VisualPriceLadder
          entryTrigger={setup.entryTrigger}
          stopLoss={setup.stopLoss}
          target1={setup.target1}
          target2={setup.target2}
          positionShares={setup.positionShares}
          riskAmount={setup.riskAmount}
          accountSize={accountSize}
          currentPrice={currentPrice}
        />

        {/* 3. Execution Trigger Condition Box */}
        {setup.entryCondition && (
          <div className="rounded-xl bg-sky-950/20 border border-sky-500/20 p-3 text-xs space-y-1">
            <div className="flex items-center space-x-1.5 text-sky-400 font-semibold">
              <Zap className="h-3.5 w-3.5" />
              <span>Trigger Condition</span>
            </div>
            <p className="text-slate-300 leading-relaxed font-mono text-[11.5px]">
              {setup.entryCondition}
            </p>
          </div>
        )}

        {/* 4. Fundamental Catalyst & The Honest Bear Case */}
        <div className="grid grid-cols-1 gap-2.5 text-xs">
          {/* Catalyst Box */}
          <div className="rounded-xl bg-emerald-950/20 border border-emerald-500/20 p-3 space-y-1">
            <div className="flex items-center justify-between text-emerald-400 font-semibold">
              <div className="flex items-center space-x-1.5">
                <CheckCircle className="h-3.5 w-3.5" />
                <span>Fundamental Catalyst</span>
              </div>
              {setup.catalystDate && (
                <span className="text-[10px] text-emerald-400/80 font-mono">
                  {setup.catalystDate}
                </span>
              )}
            </div>
            <p className="text-slate-300 leading-relaxed text-[11.5px]">
              {setup.catalystSummary || "Confirmed positive quarterly catalyst and institutional volume accumulation."}
            </p>
          </div>

          {/* Bear Case Box */}
          <div className="rounded-xl bg-rose-950/20 border border-rose-500/20 p-3 space-y-1">
            <div className="flex items-center space-x-1.5 text-rose-400 font-semibold">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>The Honest Bear Case (Failure Mode)</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11.5px]">
              {setup.bearCase || "Overhead supply, broader market pullback, or volume fading at resistance."}
            </p>
          </div>
        </div>
      </div>

      {/* 5. Footer & 1-Click Action Buttons */}
      <div className="p-5 pt-3 border-t border-white/[0.06] bg-black/20 space-y-3">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center space-x-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            <span>Time Stop: <strong className="text-slate-200">{setup.timeStopDays || 5} sessions</strong></span>
          </div>
          <div>
            R:R Ratio: <strong className="text-emerald-400">{setup.rrRatio.toFixed(2)}:1</strong>
          </div>
        </div>

        {/* 1-Click Promotion CTAs */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => handlePromote("PENDING_ENTRY")}
            className="flex items-center justify-center space-x-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 px-3 py-2.5 text-xs font-semibold text-sky-300 transition shadow-sm active:scale-[0.98]"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Watch Trigger (${setup.entryTrigger.toFixed(2)})</span>
          </button>

          <button
            onClick={() => handlePromote("ACTIVE")}
            className="flex items-center justify-center space-x-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-3 py-2.5 text-xs font-bold text-neutral-950 transition shadow-md shadow-emerald-500/20 active:scale-[0.98]"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Activate Trade ({setup.positionShares} shs)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
