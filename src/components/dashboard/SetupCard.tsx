"use client";

import React, { useState } from "react";
import { PriceLadder } from "./PriceLadder";
import {
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Clock,
  CheckCircle2,
  TrendingUp,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface SetupCardProps {
  setup: {
    id: string;
    ticker: string;
    companyName: string;
    setupType: string;
    entryTrigger: number;
    entryCondition: string;
    stopLoss: number;
    stopRationale: string;
    target1: number;
    target2: number;
    rrRatio: number;
    timeStopDays: number;
    positionShares: number;
    riskAmount: number;
    catalystDate: string;
    catalystSummary: string;
    bearCase: string;
    score: number;
    modelSources: string;
    status: string;
  };
  liveQuote?: {
    price: number;
    change: number;
    changePct: number;
  };
  onPromoteToTrade: (setup: any, mode: "PENDING_ENTRY" | "ACTIVE") => void;
  accountSize?: number;
}

export const SetupCard: React.FC<SetupCardProps> = ({
  setup,
  liveQuote,
  onPromoteToTrade,
  accountSize = 10000,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const models = setup.modelSources ? setup.modelSources.split(",").map(m => m.trim()) : ["Arbiter"];
  const isMultiModelConsensus = models.length > 1;

  const currentPrice = liveQuote?.price || setup.entryTrigger;
  const distanceToEntry = ((setup.entryTrigger - currentPrice) / currentPrice) * 100;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-6 backdrop-blur-2xl transition hover:border-white/[0.15] shadow-lg">
      
      {/* Top Header: Ticker, Badges, Composite Score */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center space-x-3">
            <h3 className="font-mono text-2xl font-bold tracking-tight text-white">
              {setup.ticker}
            </h3>
            <span className="text-sm font-medium text-neutral-300">
              {setup.companyName}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-400">
              {setup.setupType}
            </span>

            {/* Multi-AI Model Badges */}
            <div className="flex items-center space-x-1">
              {models.map(m => (
                <span
                  key={m}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider ${
                    m.toLowerCase().includes("gemini")
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                      : m.toLowerCase().includes("claude")
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  {m}
                </span>
              ))}
            </div>

            {isMultiModelConsensus && (
              <span className="flex items-center space-x-1 rounded-full border border-purple-500/30 bg-purple-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-300 shadow-sm">
                <Sparkles className="h-3 w-3 text-purple-400" />
                <span>CONSENSUS PICK</span>
              </span>
            )}
          </div>
        </div>

        {/* Live Price & Score Pill */}
        <div className="flex items-center space-x-3">
          {liveQuote && (
            <div className="text-right">
              <div className="font-mono text-lg font-bold text-white">
                ${liveQuote.price.toFixed(2)}
              </div>
              <div className={`font-mono text-xs ${liveQuote.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {liveQuote.change >= 0 ? "+" : ""}{liveQuote.changePct.toFixed(2)}%
              </div>
            </div>
          )}

          <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2">
            <span className="font-mono text-xs uppercase tracking-wider text-emerald-400">SCORE</span>
            <span className="font-mono text-lg font-bold text-emerald-300">{setup.score}</span>
          </div>
        </div>
      </div>

      {/* Visual Price Ladder */}
      <PriceLadder
        entryTrigger={setup.entryTrigger}
        stopLoss={setup.stopLoss}
        target1={setup.target1}
        target2={setup.target2}
        positionShares={setup.positionShares}
        riskAmount={setup.riskAmount}
        accountSize={accountSize}
      />

      {/* Entry Trigger Condition */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs leading-relaxed text-neutral-300">
        <span className="font-semibold text-sky-400 uppercase tracking-wider">Trigger Condition: </span>
        {setup.entryCondition}
      </div>

      {/* Catalyst & Bear Case Section */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Catalyst */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3.5">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Catalyst ({setup.catalystDate})</span>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed">
            {setup.catalystSummary}
          </p>
        </div>

        {/* Honest Bear Case */}
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-3.5">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-rose-400 uppercase tracking-wide mb-1">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>The Honest Bear Case</span>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed">
            {setup.bearCase}
          </p>
        </div>
      </div>

      {/* Details Footer: Time Stop & Action Buttons */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/[0.06]">
        <div className="flex items-center space-x-2 text-xs text-neutral-400 font-mono">
          <Clock className="h-3.5 w-3.5 text-amber-400" />
          <span>Time Stop: {setup.timeStopDays} sessions max</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPromoteToTrade(setup, "PENDING_ENTRY")}
            className="rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/20 transition active:scale-95"
          >
            Watch Trigger (${setup.entryTrigger})
          </button>

          <button
            onClick={() => onPromoteToTrade(setup, "ACTIVE")}
            className="flex items-center space-x-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-neutral-900 shadow-sm hover:bg-neutral-100 transition active:scale-95"
          >
            <span>Activate Trade</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
