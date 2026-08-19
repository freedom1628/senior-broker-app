"use client";

import React, { useState, useMemo } from "react";
import { MasterArbiterPlan, MasterSetup, ParsedCandidate } from "@/lib/ai/types";
import { CandidateSetupCard } from "./CandidateSetupCard";
import {
  Sparkles,
  Layers,
  Cpu,
  CheckCircle,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  LayoutGrid,
  Table as TableIcon,
  Search,
  SlidersHorizontal,
  UploadCloud,
  Play,
  Eye,
  TrendingUp,
  Clock,
  ArrowRight,
  Info,
} from "lucide-react";
import { playAudioChime } from "@/lib/audio/sound-effects";

export interface ConsensusArbiterViewProps {
  arbiterPlan: MasterArbiterPlan | null;
  marketQuotes: Record<string, any>;
  onPromoteToTrade: (setup: MasterSetup | ParsedCandidate, mode: "PENDING_ENTRY" | "ACTIVE") => void;
  onOpenPromptStation: () => void;
  onOpenIngestModal: () => void;
  accountSize?: number;
  riskPercent?: number;
}

export const ConsensusArbiterView: React.FC<ConsensusArbiterViewProps> = ({
  arbiterPlan,
  marketQuotes,
  onPromoteToTrade,
  onOpenPromptStation,
  onOpenIngestModal,
  accountSize = 15000,
  riskPercent = 1.0,
}) => {
  const [modelFilter, setModelFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"CARDS" | "TABLE">("CARDS");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedSetupType, setSelectedSetupType] = useState<string>("ALL");

  const masterSetups = arbiterPlan?.masterSetups || [];
  const consensusCount = masterSetups.filter((s) => s.isConsensusPick).length;

  // Filter candidates
  const filteredSetups = useMemo(() => {
    return masterSetups.filter((setup) => {
      // 1. Model Filter
      if (modelFilter === "CONSENSUS_ONLY" && !setup.isConsensusPick) return false;
      if (modelFilter === "GEMINI") {
        const agreed = setup.modelsAgreed.map((m) => m.toLowerCase());
        if (!agreed.some((m) => m.includes("gemini")) && !setup.modelSource.toLowerCase().includes("gemini"))
          return false;
      }
      if (modelFilter === "CLAUDE") {
        const agreed = setup.modelsAgreed.map((m) => m.toLowerCase());
        if (!agreed.some((m) => m.includes("claude")) && !setup.modelSource.toLowerCase().includes("claude"))
          return false;
      }
      if (modelFilter === "OPENAI") {
        const agreed = setup.modelsAgreed.map((m) => m.toLowerCase());
        if (
          !agreed.some((m) => m.includes("openai") || m.includes("chatgpt") || m.includes("o3")) &&
          !setup.modelSource.toLowerCase().includes("openai") &&
          !setup.modelSource.toLowerCase().includes("chatgpt")
        )
          return false;
      }

      // 2. Setup Type Filter
      if (selectedSetupType !== "ALL" && !setup.setupType.toLowerCase().includes(selectedSetupType.toLowerCase())) {
        return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTicker = setup.ticker.toLowerCase().includes(q);
        const matchCompany = setup.companyName.toLowerCase().includes(q);
        const matchCatalyst = setup.catalystSummary.toLowerCase().includes(q);
        if (!matchTicker && !matchCompany && !matchCatalyst) return false;
      }

      return true;
    });
  }, [masterSetups, modelFilter, selectedSetupType, searchQuery]);

  const regime = arbiterPlan?.marketRegime || "FAVORABLE";
  const regimeBg =
    regime === "FAVORABLE"
      ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
      : regime === "NEUTRAL"
      ? "bg-amber-950/40 border-amber-500/30 text-amber-300"
      : "bg-rose-950/40 border-rose-500/30 text-rose-300";

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* 1. Harmonized Market Regime & Consensus Highlight Banner */}
      {arbiterPlan && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0C101A] p-6 backdrop-blur-xl shadow-2xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Harmonized Market Regime Verdict
                </span>
                <span
                  className={`inline-flex items-center space-x-1.5 rounded-full border px-3 py-1 text-xs font-bold ${regimeBg}`}
                >
                  {regime === "FAVORABLE" ? (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  ) : regime === "NEUTRAL" ? (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  ) : (
                    <ShieldAlert className="h-3.5 w-3.5" />
                  )}
                  <span>{regime}</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                {arbiterPlan.regimeNotes}
              </p>
            </div>

            {/* Quick Action Toolbar */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                onClick={onOpenPromptStation}
                className="flex items-center space-x-1.5 rounded-xl border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] px-3.5 py-2 text-xs font-semibold text-slate-300 transition"
              >
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                <span>Prompt Station</span>
              </button>

              <button
                onClick={onOpenIngestModal}
                className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white transition shadow-lg shadow-indigo-600/30"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                <span>Run / Ingest AI</span>
              </button>
            </div>
          </div>

          {/* Macro Hazard Radar & Arbiter Consensus Highlight */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Macro Hazard */}
            <div className="rounded-xl bg-black/40 border border-white/[0.05] p-3 space-y-1">
              <div className="flex items-center space-x-1.5 text-amber-400 font-semibold">
                <Clock className="h-3.5 w-3.5" />
                <span>Macro Hazard Calendar</span>
              </div>
              <p className="text-slate-300 text-[11.5px] leading-relaxed">
                {arbiterPlan.macroFlags}
              </p>
            </div>

            {/* Arbiter Consensus Highlight */}
            <div className="rounded-xl bg-purple-950/20 border border-purple-500/20 p-3 space-y-1">
              <div className="flex items-center space-x-1.5 text-purple-300 font-semibold">
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                <span>Multi-Model Arbiter Synthesis</span>
              </div>
              <p className="text-slate-200 text-[11.5px] leading-relaxed">
                {arbiterPlan.consensusHighlight}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Model Filter Pills & Search Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Model Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#0E131F] p-1.5 border border-white/[0.08] shadow-lg">
          <button
            onClick={() => setModelFilter("ALL")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              modelFilter === "ALL"
                ? "bg-white text-neutral-900 shadow-md font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            All Setups ({masterSetups.length})
          </button>

          <button
            onClick={() => setModelFilter("CONSENSUS_ONLY")}
            className={`flex items-center space-x-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              modelFilter === "CONSENSUS_ONLY"
                ? "bg-purple-600 text-white shadow-md font-bold"
                : "text-purple-300/80 hover:text-purple-200 bg-purple-950/20"
            }`}
          >
            <Sparkles className="h-3 w-3 text-purple-400" />
            <span>Consensus Picks ({consensusCount})</span>
          </button>

          <button
            onClick={() => setModelFilter("GEMINI")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              modelFilter === "GEMINI"
                ? "bg-indigo-600 text-white shadow-md font-bold"
                : "text-indigo-300/80 hover:text-indigo-200"
            }`}
          >
            Gemini 3.7
          </button>

          <button
            onClick={() => setModelFilter("CLAUDE")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              modelFilter === "CLAUDE"
                ? "bg-amber-600 text-white shadow-md font-bold"
                : "text-amber-300/80 hover:text-amber-200"
            }`}
          >
            Claude Sonnet 5
          </button>

          <button
            onClick={() => setModelFilter("OPENAI")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              modelFilter === "OPENAI"
                ? "bg-emerald-600 text-white shadow-md font-bold"
                : "text-emerald-300/80 hover:text-emerald-200"
            }`}
          >
            OpenAI 5.6
          </button>
        </div>

        {/* Search & View Mode Switcher */}
        <div className="flex items-center space-x-3">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker, catalyst..."
              className="w-full rounded-xl bg-[#0C101A] border border-white/[0.1] pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* View Toggle */}
          <div className="flex rounded-xl bg-[#0C101A] border border-white/[0.1] p-1">
            <button
              onClick={() => setViewMode("CARDS")}
              title="Setup Cards View"
              className={`p-1.5 rounded-lg transition ${
                viewMode === "CARDS" ? "bg-white/[0.1] text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("TABLE")}
              title="Executive Summary Table View"
              className={`p-1.5 rounded-lg transition ${
                viewMode === "TABLE" ? "bg-white/[0.1] text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <TableIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Render Candidate Setups */}
      {filteredSetups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.12] p-12 text-center space-y-4 bg-black/20">
          <div className="flex justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400">
              <Sparkles className="h-6 w-6" />
            </span>
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No Candidate Setups Match Filters</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Run automated AI research, paste research reports from frontier models, or adjust your active search query.
            </p>
          </div>
          <div className="flex items-center justify-center space-x-3 pt-2">
            <button
              onClick={onOpenIngestModal}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2 text-xs font-bold text-white transition shadow-lg shadow-indigo-600/30"
            >
              Run Deep Research Ingestion
            </button>
          </div>
        </div>
      ) : viewMode === "CARDS" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredSetups.map((setup) => (
            <CandidateSetupCard
              key={`${setup.ticker}_${setup.modelSource}`}
              setup={setup}
              liveQuote={marketQuotes[setup.ticker]}
              onPromoteToTrade={onPromoteToTrade}
              accountSize={accountSize}
              riskPercent={riskPercent}
            />
          ))}
        </div>
      ) : (
        /* EXECUTIVE SUMMARY TABLE MATRIX */
        <div className="rounded-2xl border border-white/[0.08] bg-[#0C101A] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-black/50 border-b border-white/[0.08] text-slate-400">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Ticker / Company</th>
                  <th className="py-3.5 px-3 font-semibold">Setup Style</th>
                  <th className="py-3.5 px-3 font-semibold">Entry Trigger</th>
                  <th className="py-3.5 px-3 font-semibold">Hard Stop</th>
                  <th className="py-3.5 px-3 font-semibold">Target 1 & 2</th>
                  <th className="py-3.5 px-3 font-semibold">1% Sizing</th>
                  <th className="py-3.5 px-3 font-semibold">Score</th>
                  <th className="py-3.5 px-3 font-semibold">Models</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-slate-300">
                {filteredSetups.map((setup) => {
                  const quote = marketQuotes[setup.ticker];
                  return (
                    <tr
                      key={setup.ticker}
                      className="hover:bg-white/[0.02] transition"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-sm">{setup.ticker}</span>
                          {setup.isConsensusPick && (
                            <span className="h-2 w-2 rounded-full bg-purple-400 animate-ping" />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-sans truncate max-w-[150px]">
                          {setup.companyName}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 font-sans">
                          {setup.setupType}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-bold text-sky-300">${setup.entryTrigger.toFixed(2)}</div>
                        {quote && (
                          <div className="text-[10px] text-slate-500">Live ${quote.price.toFixed(2)}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-3 font-bold text-rose-300">
                        ${setup.stopLoss.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="text-emerald-300">T1: ${setup.target1.toFixed(2)}</div>
                        <div className="text-purple-300 text-[10px]">T2: ${setup.target2.toFixed(2)}</div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div>{setup.positionShares} shares</div>
                        <div className="text-[10px] text-slate-500">${setup.riskAmount.toFixed(2)} risk</div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                            setup.score >= 90
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "bg-sky-500/20 text-sky-300 border-sky-500/40"
                          }`}
                        >
                          {setup.score.toFixed(1)}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {setup.modelsAgreed.map((m) => (
                            <span
                              key={m}
                              className="rounded bg-black/40 border border-white/[0.08] px-1.5 py-0.5 text-[9px] text-slate-300 font-sans"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5 font-sans">
                          <button
                            onClick={() => {
                              try {
                                playAudioChime("CLICK");
                              } catch {}
                              onPromoteToTrade(setup, "PENDING_ENTRY");
                            }}
                            title="Add to Watch Queue"
                            className="rounded-lg border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 p-1.5 text-sky-300 transition"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              try {
                                playAudioChime("PROMOTION");
                              } catch {}
                              onPromoteToTrade(setup, "ACTIVE");
                            }}
                            title="Activate Live Trade"
                            className="flex items-center space-x-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-2.5 py-1.5 text-xs font-bold text-neutral-950 transition shadow-sm"
                          >
                            <Play className="h-3 w-3 fill-current" />
                            <span>Activate</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
