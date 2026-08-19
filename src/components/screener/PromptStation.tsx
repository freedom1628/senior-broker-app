"use client";

import React, { useState } from "react";
import { generateDeepResearchPrompt } from "@/lib/ai/prompts";
import { PromptCustomizerOptions } from "@/lib/ai/types";
import {
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Sliders,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Zap,
  DollarSign,
  Percent,
} from "lucide-react";
import { playAudioChime } from "@/lib/audio/sound-effects";

export interface PromptStationProps {
  accountSize?: number;
  riskPercent?: number;
  isOpen?: boolean;
  onClose?: () => void;
  onLaunchModel?: (model: "gemini" | "claude" | "chatgpt") => void;
  embedded?: boolean;
}

export const PromptStation: React.FC<PromptStationProps> = ({
  accountSize: initialAccountSize = 15000,
  riskPercent: initialRiskPercent = 1.0,
  isOpen = true,
  onClose,
  onLaunchModel,
  embedded = false,
}) => {
  const [accountSize, setAccountSize] = useState<number>(initialAccountSize);
  const [riskPercent, setRiskPercent] = useState<number>(initialRiskPercent);
  const [strategyStyle, setStrategyStyle] = useState<
    "ALL" | "MOMENTUM_BREAKOUT" | "PEAD_CONTINUATION" | "FIRST_PULLBACK" | "HIGH_TIGHT_FLAG"
  >("ALL");
  const [targetModel, setTargetModel] = useState<"all" | "gemini" | "claude" | "openai">("all");
  const [copied, setCopied] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);

  const dollarRisk = (accountSize * (riskPercent / 100)).toFixed(2);

  const currentPrompt = generateDeepResearchPrompt({
    accountSize,
    riskPercent,
    strategyStyle,
    targetModel,
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentPrompt);
      setCopied(true);
      try {
        playAudioChime("CLICK");
      } catch {
        // audio optional
      }
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy prompt to clipboard:", err);
    }
  };

  const handleOpenModelUrl = (provider: "gemini" | "claude" | "chatgpt") => {
    if (onLaunchModel) {
      onLaunchModel(provider);
    } else {
      let url = "https://gemini.google.com";
      if (provider === "claude") url = "https://claude.ai";
      if (provider === "chatgpt") url = "https://chatgpt.com";
      window.open(url, "_blank");
    }
  };

  const content = (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-bold text-white tracking-tight">
              1-Click Deep Research Prompt Station
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Generate standardized 4-step research prompts for Gemini 3.7 Flash, Claude Sonnet 5, and OpenAI 5.6/o3.
          </p>
        </div>

        {/* 1-Click Copy Master CTA */}
        <button
          onClick={handleCopy}
          className={`flex items-center justify-center space-x-2 rounded-xl px-5 py-2.5 text-xs font-bold transition shadow-lg active:scale-95 ${
            copied
              ? "bg-emerald-500 text-neutral-950 shadow-emerald-500/25"
              : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25"
          }`}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 stroke-[3]" />
              <span>Copied Prompt to Clipboard!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>Copy 4-Step Research Prompt</span>
            </>
          )}
        </button>
      </div>

      {/* Dynamic Parameter Adjustment Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 rounded-xl bg-black/40 border border-white/[0.06] p-4 text-xs">
        {/* Param 1: Account Capital */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1">
            <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
            <span>Dedicated Capital</span>
          </label>
          <select
            value={accountSize}
            onChange={(e) => setAccountSize(parseFloat(e.target.value))}
            className="w-full rounded-lg bg-[#0C101A] border border-white/[0.1] px-3 py-1.5 text-white font-mono text-xs focus:border-indigo-500 focus:outline-none"
          >
            <option value={10000}>$10,000 (Baseline)</option>
            <option value={15000}>$15,000 (Sleeve Capital)</option>
            <option value={25000}>$25,000 (PDT Account)</option>
            <option value={50000}>$50,000 (Standard Desk)</option>
            <option value={100000}>$100,000 (Senior Desk)</option>
          </select>
        </div>

        {/* Param 2: Risk Per Trade */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1">
            <Percent className="h-3.5 w-3.5 text-rose-400" />
            <span>Risk Per Trade (${dollarRisk})</span>
          </label>
          <select
            value={riskPercent}
            onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
            className="w-full rounded-lg bg-[#0C101A] border border-white/[0.1] px-3 py-1.5 text-white font-mono text-xs focus:border-indigo-500 focus:outline-none"
          >
            <option value={0.5}>0.5% ($75.00)</option>
            <option value={1.0}>1.0% ($150.00 standard)</option>
            <option value={1.5}>1.5% ($225.00)</option>
            <option value={2.0}>2.0% ($300.00 max)</option>
          </select>
        </div>

        {/* Param 3: Strategy Style Preset */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1">
            <Layers className="h-3.5 w-3.5 text-sky-400" />
            <span>Strategy Focus</span>
          </label>
          <select
            value={strategyStyle}
            onChange={(e) => setStrategyStyle(e.target.value as any)}
            className="w-full rounded-lg bg-[#0C101A] border border-white/[0.1] px-3 py-1.5 text-white text-xs focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Setup Styles (Balanced)</option>
            <option value="MOMENTUM_BREAKOUT">Momentum Breakouts</option>
            <option value="PEAD_CONTINUATION">Post-Earnings PEAD</option>
            <option value="FIRST_PULLBACK">First Pullback to 20D EMA</option>
            <option value="HIGH_TIGHT_FLAG">High-Tight Flags</option>
          </select>
        </div>

        {/* Param 4: Frontier Model Optimization */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1">
            <Cpu className="h-3.5 w-3.5 text-purple-400" />
            <span>Target Model Rubric</span>
          </label>
          <select
            value={targetModel}
            onChange={(e) => setTargetModel(e.target.value as any)}
            className="w-full rounded-lg bg-[#0C101A] border border-white/[0.1] px-3 py-1.5 text-white text-xs focus:border-indigo-500 focus:outline-none"
          >
            <option value="all">Universal (All Frontier Models)</option>
            <option value="gemini">Google Gemini 3.7 Flash</option>
            <option value="claude">Anthropic Claude Sonnet 5</option>
            <option value="openai">OpenAI 5.6 / o3</option>
          </select>
        </div>
      </div>

      {/* Deep Link Launch Strip (1-Click Open Web Chat) */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Step 2: Paste Into Frontier LLM Web Chat
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => handleOpenModelUrl("gemini")}
            className="flex items-center justify-between rounded-xl bg-indigo-950/30 border border-indigo-500/25 hover:border-indigo-500/50 p-3 text-xs transition group"
          >
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
              <div className="text-left">
                <div className="font-semibold text-indigo-300">Gemini 3.7 Flash</div>
                <div className="text-[10px] text-slate-400">gemini.google.com</div>
              </div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-indigo-400 group-hover:translate-x-0.5 transition" />
          </button>

          <button
            onClick={() => handleOpenModelUrl("claude")}
            className="flex items-center justify-between rounded-xl bg-amber-950/30 border border-amber-500/25 hover:border-amber-500/50 p-3 text-xs transition group"
          >
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              <div className="text-left">
                <div className="font-semibold text-amber-300">Claude Sonnet 5</div>
                <div className="text-[10px] text-slate-400">claude.ai</div>
              </div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-amber-400 group-hover:translate-x-0.5 transition" />
          </button>

          <button
            onClick={() => handleOpenModelUrl("chatgpt")}
            className="flex items-center justify-between rounded-xl bg-emerald-950/30 border border-emerald-500/25 hover:border-emerald-500/50 p-3 text-xs transition group"
          >
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <div className="text-left">
                <div className="font-semibold text-emerald-300">OpenAI 5.6 / o3</div>
                <div className="text-[10px] text-slate-400">chatgpt.com</div>
              </div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-emerald-400 group-hover:translate-x-0.5 transition" />
          </button>
        </div>
      </div>

      {/* Collapsible Prompt Preview */}
      <div className="rounded-xl border border-white/[0.08] bg-[#0A0E17] overflow-hidden">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-slate-300 hover:bg-white/[0.02] transition"
        >
          <div className="flex items-center space-x-2">
            <Sliders className="h-3.5 w-3.5 text-indigo-400" />
            <span>View Full Formatted Prompt Text</span>
            <span className="text-[11px] font-mono text-slate-500">
              ({currentPrompt.split("\n").length} lines)
            </span>
          </div>
          {showPreview ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showPreview && (
          <div className="border-t border-white/[0.06] p-4">
            <pre className="max-h-72 overflow-y-auto font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed select-all">
              {currentPrompt}
            </pre>
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#0C101A] p-6 shadow-2xl space-y-4">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition p-1"
          >
            ✕
          </button>
        )}
        {content}
      </div>
    </div>
  );
};
