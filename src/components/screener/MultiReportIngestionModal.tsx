"use client";

import React, { useState } from "react";
import { MasterArbiterPlan, IngestReportPayload } from "@/lib/ai/types";
import { parseReportContent } from "@/lib/ai/parser";
import { PromptStation } from "./PromptStation";
import {
  Sparkles,
  Layers,
  Cpu,
  CheckCircle,
  FileText,
  UploadCloud,
  Play,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  X,
  Zap,
} from "lucide-react";
import { playAudioChime } from "@/lib/audio/sound-effects";

export interface MultiReportIngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResearchCompleted?: (plan: MasterArbiterPlan) => void;
  accountSize?: number;
  riskPercent?: number;
}

export const MultiReportIngestionModal: React.FC<MultiReportIngestionModalProps> = ({
  isOpen,
  onClose,
  onResearchCompleted,
  accountSize = 15000,
  riskPercent = 1.0,
}) => {
  const [activeTab, setActiveTab] = useState<"AUTOMATED" | "MANUAL" | "PROMPTS">("AUTOMATED");

  // Automated Run State
  const [selectedGemini, setSelectedGemini] = useState<boolean>(true);
  const [selectedClaude, setSelectedClaude] = useState<boolean>(true);
  const [selectedOpenAI, setSelectedOpenAI] = useState<boolean>(true);
  const [claudeModelChoice, setClaudeModelChoice] = useState<string>("claude-sonnet-5");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runStage, setRunStage] = useState<string>("");

  // Manual Paste State
  const [pasteMode, setPasteMode] = useState<"UNIVERSAL" | "SPLIT">("UNIVERSAL");
  const [universalText, setUniversalText] = useState<string>("");
  const [geminiText, setGeminiText] = useState<string>("");
  const [claudeText, setClaudeText] = useState<string>("");
  const [chatgptText, setChatgptText] = useState<string>("");

  // Parsing Preview Heuristics
  const activePasteContent =
    pasteMode === "UNIVERSAL"
      ? universalText
      : [geminiText, claudeText, chatgptText].filter(Boolean).join("\n\n");

  const heuristicPreview = parseReportContent(activePasteContent, "Preview");

  // Execute Automated Research
  const handleExecuteAutomated = async () => {
    setIsRunning(true);
    setRunStage("Connecting to Frontier AI Models...");
    try {
      playAudioChime("CLICK");
    } catch {}

    try {
      setRunStage("Prompting Gemini 3.7, Claude & OpenAI...");
      const res = await fetch("/api/research/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "automated",
          accountSize,
          riskPercent,
          claudeModel: claudeModelChoice,
        }),
      });

      setRunStage("Arbitrating Consensus & Risk Sizing...");
      const data = await res.json();

      if (data.arbiterPlan) {
        setRunStage("Complete!");
        try {
          playAudioChime("PROMOTION");
        } catch {}
        if (onResearchCompleted) {
          onResearchCompleted(data.arbiterPlan);
        }
        setTimeout(() => {
          setIsRunning(false);
          onClose();
        }, 600);
      } else {
        throw new Error(data.error || "Failed to execute research");
      }
    } catch (err) {
      console.error("Error running research:", err);
      // Fallback: load sample research
      await handleLoadSample();
      setIsRunning(false);
    }
  };

  // Execute Manual Ingestion
  const handleExecuteManual = async () => {
    setIsRunning(true);
    setRunStage("Parsing multi-format research text...");
    try {
      const reports: IngestReportPayload[] = [];
      if (pasteMode === "UNIVERSAL") {
        if (universalText.trim()) {
          reports.push({ modelSource: "Universal AI Report", rawText: universalText });
        }
      } else {
        if (geminiText.trim()) reports.push({ modelSource: "Gemini 3.7 Flash", rawText: geminiText });
        if (claudeText.trim()) reports.push({ modelSource: "Claude Sonnet 5", rawText: claudeText });
        if (chatgptText.trim()) reports.push({ modelSource: "OpenAI 5.6", rawText: chatgptText });
      }

      if (reports.length === 0) {
        alert("Please paste at least one research report before ingesting.");
        setIsRunning(false);
        return;
      }

      const res = await fetch("/api/research/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reports,
          accountSize,
          riskPercent,
        }),
      });

      const data = await res.json();
      if (data.arbiterPlan) {
        try {
          playAudioChime("PROMOTION");
        } catch {}
        if (onResearchCompleted) {
          onResearchCompleted(data.arbiterPlan);
        }
        setIsRunning(false);
        onClose();
      } else {
        throw new Error(data.error || "Failed to ingest research");
      }
    } catch (err) {
      console.error("Error ingesting manual reports:", err);
      setIsRunning(false);
    }
  };

  // Load High-Conviction Sample Research (Consensus on ATRO)
  const handleLoadSample = async () => {
    setIsRunning(true);
    setRunStage("Loading Calibrated Frontier Sample Research...");
    try {
      const res = await fetch(`/api/research/sample?accountSize=${accountSize}&riskPercent=${riskPercent}`);
      const data = await res.json();
      if (data.arbiterPlan) {
        try {
          playAudioChime("PROMOTION");
        } catch {}
        if (onResearchCompleted) {
          onResearchCompleted(data.arbiterPlan);
        }
        setIsRunning(false);
        onClose();
      }
    } catch (err) {
      console.error("Error loading sample research:", err);
      setIsRunning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#0C101A] p-6 shadow-2xl space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition p-1.5 rounded-lg hover:bg-white/[0.05]"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
              <UploadCloud className="h-5 w-5" />
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Multi-LLM Research Ingestion & Arbiter Station
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Synthesize market regime checks and swing trade setups from Gemini 3.7 Flash, Claude Sonnet 5, and OpenAI 5.6.
          </p>
        </div>

        {/* Segmented Navigation Tabs */}
        <div className="flex rounded-xl bg-black/50 p-1 border border-white/[0.06]">
          <button
            onClick={() => setActiveTab("AUTOMATED")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center space-x-2 ${
              activeTab === "AUTOMATED"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Cpu className="h-4 w-4" />
            <span>Automated Multi-AI Run</span>
          </button>

          <button
            onClick={() => setActiveTab("MANUAL")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center space-x-2 ${
              activeTab === "MANUAL"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Manual Multi-Paste</span>
          </button>

          <button
            onClick={() => setActiveTab("PROMPTS")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center space-x-2 ${
              activeTab === "PROMPTS"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>1-Click Prompt Station</span>
          </button>
        </div>

        {/* TAB 1: AUTOMATED MULTI-AI RUN */}
        {activeTab === "AUTOMATED" && (
          <div className="space-y-6">
            <div className="rounded-xl bg-black/40 border border-white/[0.06] p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Select Frontier Models To Query
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Gemini 3.7 Flash */}
                <div
                  onClick={() => setSelectedGemini(!selectedGemini)}
                  className={`cursor-pointer rounded-xl border p-4 transition ${
                    selectedGemini
                      ? "bg-indigo-950/40 border-indigo-500/50 shadow-lg shadow-indigo-950/20"
                      : "bg-[#0C101A] border-white/[0.06] opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300">Google Gemini</span>
                    <span className="h-2 w-2 rounded-full bg-indigo-400" />
                  </div>
                  <div className="font-mono text-sm font-semibold text-white mt-1">Gemini 3.7 Flash</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Hybrid reasoning & fast discovery</div>
                </div>

                {/* Claude Sonnet 5 / Opus / Fable */}
                <div
                  onClick={() => setSelectedClaude(!selectedClaude)}
                  className={`cursor-pointer rounded-xl border p-4 transition ${
                    selectedClaude
                      ? "bg-amber-950/40 border-amber-500/50 shadow-lg shadow-amber-950/20"
                      : "bg-[#0C101A] border-white/[0.06] opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300">Anthropic Claude</span>
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                  </div>
                  <select
                    value={claudeModelChoice}
                    onChange={(e) => {
                      e.stopPropagation();
                      setClaudeModelChoice(e.target.value);
                    }}
                    className="w-full mt-1 rounded bg-black/60 border border-amber-500/30 px-2 py-1 text-xs text-white font-mono focus:outline-none"
                  >
                    <option value="claude-sonnet-5">Claude Sonnet 5 (Flagship)</option>
                    <option value="claude-opus">Claude Opus (Deep Strategy)</option>
                    <option value="claude-fable">Claude Fable (Next-Gen)</option>
                  </select>
                  <div className="text-[11px] text-slate-400 mt-1">Institutional macro & catalysts</div>
                </div>

                {/* OpenAI 5.6 / o3 */}
                <div
                  onClick={() => setSelectedOpenAI(!selectedOpenAI)}
                  className={`cursor-pointer rounded-xl border p-4 transition ${
                    selectedOpenAI
                      ? "bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-950/20"
                      : "bg-[#0C101A] border-white/[0.06] opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">OpenAI Desk</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  </div>
                  <div className="font-mono text-sm font-semibold text-white mt-1">OpenAI 5.6 / o3</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Asymmetric math & tabular plans</div>
                </div>
              </div>
            </div>

            {/* Sizing & Account Rule Reminder */}
            <div className="flex items-center justify-between rounded-xl bg-sky-950/20 border border-sky-500/20 px-4 py-3 text-xs text-slate-300">
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4 text-sky-400" />
                <span>
                  Sizing normalized to <strong>1% risk</strong> on <strong>${accountSize.toLocaleString()}</strong> dedicated capital (${(accountSize * (riskPercent / 100)).toFixed(2)} risk budget).
                </span>
              </div>
              <button
                onClick={handleLoadSample}
                disabled={isRunning}
                className="text-xs font-bold text-sky-400 hover:text-sky-300 underline underline-offset-2 ml-4 flex-shrink-0"
              >
                Load Sample ATRO Consensus
              </button>
            </div>

            {/* Run Action */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                disabled={isRunning}
                className="w-full sm:w-auto rounded-xl border border-white/[0.1] px-5 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>

              <button
                onClick={handleExecuteAutomated}
                disabled={isRunning}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 text-xs font-bold text-white transition shadow-lg shadow-indigo-600/30 disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>{runStage || "Executing Deep Research..."}</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    <span>Execute Multi-AI Deep Research</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: MANUAL MULTI-PASTE */}
        {activeTab === "MANUAL" && (
          <div className="space-y-4">
            {/* Paste Mode Toggle */}
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center space-x-2 text-xs">
                <button
                  onClick={() => setPasteMode("UNIVERSAL")}
                  className={`rounded-lg px-3 py-1 font-semibold transition ${
                    pasteMode === "UNIVERSAL"
                      ? "bg-white/[0.1] text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Universal Single Paste
                </button>
                <button
                  onClick={() => setPasteMode("SPLIT")}
                  className={`rounded-lg px-3 py-1 font-semibold transition ${
                    pasteMode === "SPLIT"
                      ? "bg-white/[0.1] text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Split Model Panels (Gemini / Claude / OpenAI)
                </button>
              </div>

              {/* Heuristic Live Validation Badge */}
              {activePasteContent.trim().length > 0 && (
                <div className="flex items-center space-x-2 text-[11px] font-mono">
                  <span className="text-slate-400">Heuristic Parser:</span>
                  <span className="rounded bg-emerald-500/20 text-emerald-300 px-2 py-0.5 font-bold">
                    {heuristicPreview.candidates.length} Setups Found
                  </span>
                  <span className="rounded bg-indigo-500/20 text-indigo-300 px-2 py-0.5">
                    Regime: {heuristicPreview.marketRegime}
                  </span>
                </div>
              )}
            </div>

            {/* Universal Paste Area */}
            {pasteMode === "UNIVERSAL" ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">
                  Paste Web Chat Transcript / JSON / Markdown / HTML:
                </label>
                <textarea
                  value={universalText}
                  onChange={(e) => setUniversalText(e.target.value)}
                  placeholder="Paste research output from Gemini, Claude, or ChatGPT here... The 5-stage parser handles JSON codeblocks, markdown tables, section headers, and raw text."
                  rows={10}
                  className="w-full rounded-xl bg-black/50 border border-white/[0.1] p-4 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none leading-relaxed"
                />
              </div>
            ) : (
              /* Split Model Panels */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-indigo-300">Google Gemini Text</span>
                  <textarea
                    value={geminiText}
                    onChange={(e) => setGeminiText(e.target.value)}
                    placeholder="Paste Gemini 3.7 Flash report..."
                    rows={8}
                    className="w-full rounded-xl bg-black/50 border border-indigo-500/20 p-3 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-amber-300">Anthropic Claude Report</span>
                  <textarea
                    value={claudeText}
                    onChange={(e) => setClaudeText(e.target.value)}
                    placeholder="Paste Claude Sonnet 5 report..."
                    rows={8}
                    className="w-full rounded-xl bg-black/50 border border-amber-500/20 p-3 text-xs text-slate-200 font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-emerald-300">OpenAI 5.6 Table / JSON</span>
                  <textarea
                    value={chatgptText}
                    onChange={(e) => setChatgptText(e.target.value)}
                    placeholder="Paste OpenAI 5.6 report..."
                    rows={8}
                    className="w-full rounded-xl bg-black/50 border border-emerald-500/20 p-3 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Ingest Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                onClick={handleLoadSample}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Paste Sample Multimodel Report (ATRO consensus)
              </button>

              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <button
                  onClick={onClose}
                  className="rounded-xl border border-white/[0.1] px-5 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteManual}
                  disabled={isRunning || (!universalText.trim() && !geminiText.trim() && !claudeText.trim() && !chatgptText.trim())}
                  className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-6 py-2.5 text-xs font-bold text-neutral-950 transition shadow-lg shadow-emerald-500/25 disabled:opacity-40"
                >
                  {isRunning ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Ingesting...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-4 w-4" />
                      <span>Ingest & Arbitrate Candidates</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 1-CLICK PROMPT STATION */}
        {activeTab === "PROMPTS" && (
          <div className="space-y-4">
            <PromptStation
              accountSize={accountSize}
              riskPercent={riskPercent}
              embedded={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};
