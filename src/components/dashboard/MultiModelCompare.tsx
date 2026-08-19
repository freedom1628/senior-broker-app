"use client";

import React, { useState } from "react";
import { Sparkles, Layers, Cpu, CheckCircle } from "lucide-react";
import { SetupCard } from "./SetupCard";
import { ExecutiveTable } from "./ExecutiveTable";

interface MultiModelCompareProps {
  candidates: any[];
  marketQuotes: Record<string, any>;
  onPromoteToTrade: (setup: any, mode: "PENDING_ENTRY" | "ACTIVE") => void;
  accountSize: number;
}

export const MultiModelCompare: React.FC<MultiModelCompareProps> = ({
  candidates,
  marketQuotes,
  onPromoteToTrade,
  accountSize,
}) => {
  const [selectedModel, setSelectedModel] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"CARDS" | "TABLE">("CARDS");

  const filteredCandidates = candidates.filter((c) => {
    if (selectedModel === "ALL") return true;
    if (selectedModel === "CONSENSUS") {
      const models = c.modelSources ? c.modelSources.split(",") : [];
      return models.length > 1;
    }
    return (c.modelSources || "").toLowerCase().includes(selectedModel.toLowerCase());
  });

  return (
    <div className="space-y-6">
      
      {/* Top Filter & View Controls (Apple-style Segmented Pills) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        
        {/* Model Filter Pills */}
        <div className="flex flex-wrap items-center rounded-2xl bg-[#0E131F]/90 p-1.5 border border-white/[0.08] backdrop-blur-xl">
          <button
            onClick={() => setSelectedModel("ALL")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              selectedModel === "ALL"
                ? "bg-white text-neutral-900 shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Master Arbiter Plan ({candidates.length})
          </button>

          <button
            onClick={() => setSelectedModel("CONSENSUS")}
            className={`flex items-center space-x-1 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              selectedModel === "CONSENSUS"
                ? "bg-purple-500 text-white shadow"
                : "text-purple-300 hover:text-white"
            }`}
          >
            <Sparkles className="h-3 w-3" />
            <span>Consensus Setups</span>
          </button>

          <button
            onClick={() => setSelectedModel("Gemini")}
            className={`rounded-xl px-3 py-1.5 text-xs font-mono font-medium transition ${
              selectedModel === "Gemini"
                ? "bg-indigo-500 text-white shadow"
                : "text-indigo-300 hover:text-white"
            }`}
          >
            Gemini 3.7 Flash
          </button>

          <button
            onClick={() => setSelectedModel("Claude")}
            className={`rounded-xl px-3 py-1.5 text-xs font-mono font-medium transition ${
              selectedModel === "Claude"
                ? "bg-amber-500 text-neutral-900 font-bold shadow"
                : "text-amber-300 hover:text-white"
            }`}
          >
            Claude (Sonnet 5 / Opus / Fable)
          </button>

          <button
            onClick={() => setSelectedModel("ChatGPT")}
            className={`rounded-xl px-3 py-1.5 text-xs font-mono font-medium transition ${
              selectedModel === "ChatGPT"
                ? "bg-emerald-500 text-neutral-900 font-bold shadow"
                : "text-emerald-300 hover:text-white"
            }`}
          >
            OpenAI 5.6
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center rounded-2xl bg-[#0E131F]/90 p-1 border border-white/[0.08]">
          <button
            onClick={() => setViewMode("CARDS")}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
              viewMode === "CARDS"
                ? "bg-white/10 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Setup Cards
          </button>
          <button
            onClick={() => setViewMode("TABLE")}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
              viewMode === "TABLE"
                ? "bg-white/10 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Summary Matrix
          </button>
        </div>
      </div>

      {/* Candidate Views */}
      {viewMode === "TABLE" ? (
        <ExecutiveTable
          candidates={filteredCandidates}
          marketQuotes={marketQuotes}
          onSelectCandidate={(c) => onPromoteToTrade(c, "PENDING_ENTRY")}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredCandidates.map((setup) => (
            <SetupCard
              key={setup.id || setup.ticker}
              setup={setup}
              liveQuote={marketQuotes[setup.ticker.toUpperCase()]}
              onPromoteToTrade={onPromoteToTrade}
              accountSize={accountSize}
            />
          ))}
        </div>
      )}
    </div>
  );
};
