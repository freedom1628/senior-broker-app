"use client";

import React from "react";
import { ShieldCheck, AlertTriangle, XCircle, Calendar, Sparkles, Activity } from "lucide-react";

interface RegimeBannerProps {
  marketRegime: "FAVORABLE" | "NEUTRAL" | "HOSTILE";
  regimeNotes: string;
  macroFlags?: string | null;
  arbiterSynthesis?: string | null;
  date?: string;
}

export const RegimeBanner: React.FC<RegimeBannerProps> = ({
  marketRegime,
  regimeNotes,
  macroFlags,
  arbiterSynthesis,
  date,
}) => {
  const isFavorable = marketRegime === "FAVORABLE";
  const isNeutral = marketRegime === "NEUTRAL";
  const isHostile = marketRegime === "HOSTILE";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0E131F]/70 p-6 sm:p-8 backdrop-blur-2xl shadow-xl transition-all">
      {/* Subtle background ambient glow */}
      <div
        className={`absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl opacity-20 pointer-events-none ${
          isFavorable ? "bg-emerald-500" : isNeutral ? "bg-amber-500" : "bg-rose-500"
        }`}
      />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        
        {/* Left column: Verdict & Regime Thesis */}
        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Pill */}
            <div
              className={`inline-flex items-center space-x-2 rounded-full border px-3.5 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur-md shadow-sm ${
                isFavorable
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : isNeutral
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-400"
              }`}
            >
              {isFavorable && <ShieldCheck className="h-4 w-4" />}
              {isNeutral && <AlertTriangle className="h-4 w-4" />}
              {isHostile && <XCircle className="h-4 w-4" />}
              <span>DESK REGIME: {marketRegime}</span>
            </div>

            <span className="text-xs text-neutral-400 font-mono">
              Step 1 Market Gate • {date ? new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Active Session"}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Market Regime Assessment & Macro Guardrails
          </h2>

          <p className="text-sm leading-relaxed text-neutral-300">
            {regimeNotes}
          </p>

          {/* Arbiter Consensus Callout */}
          {arbiterSynthesis && (
            <div className="flex items-start space-x-3 rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-4 backdrop-blur-md">
              <Sparkles className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-semibold text-sky-400 uppercase tracking-wide">
                  Sr. Broker Arbiter Synthesis
                </span>
                <p className="text-xs sm:text-sm text-neutral-200 mt-0.5 leading-normal">
                  {arbiterSynthesis}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Macro Calendar & Risk Box */}
        <div className="lg:w-80 shrink-0 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 backdrop-blur-md">
          <div className="flex items-center space-x-2 text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-3">
            <Calendar className="h-4 w-4 text-amber-400" />
            <span>Macro 14-Day Calendar</span>
          </div>

          <p className="text-xs leading-relaxed text-neutral-300 mb-4">
            {macroFlags || "CPI cleared; watch PPI and FOMC minutes. Maintain strict 1.0% account risk rule."}
          </p>

          <div className="border-t border-white/[0.08] pt-3 text-[11px] font-mono text-neutral-400 flex items-center justify-between">
            <span>Risk Rule:</span>
            <span className="text-amber-400 font-semibold">1.0% Max Risk / Trade</span>
          </div>
        </div>
      </div>
    </div>
  );
};
