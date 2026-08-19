"use client";

import React, { useState } from "react";
import { Sparkles, FileText, Upload, RefreshCw, X, Check, Copy, Key, ChevronRight } from "lucide-react";
import { SWING_TRADE_RESEARCH_PROMPT } from "@/lib/ai/prompts";
import { CLAUDE_LATEST_MODELS } from "@/lib/ai/runners";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResearchCompleted: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onResearchCompleted,
}) => {
  const [tab, setTab] = useState<"automated" | "manual" | "prompt">("automated");
  const [loading, setLoading] = useState(false);
  const [geminiModel, setGeminiModel] = useState("gemini-3.7-flash");
  const [claudeModel, setClaudeModel] = useState("claude-sonnet-5");
  const [openaiModel, setOpenaiModel] = useState("gpt-5.6");
  
  const [manualText, setManualText] = useState("");
  const [geminiChatText, setGeminiChatText] = useState("");
  const [claudeReportText, setClaudeReportText] = useState("");
  const [chatgptReportText, setChatgptReportText] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [promptCopied, setPromptCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(SWING_TRADE_RESEARCH_PROMPT);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  const handleRunAutomated = async () => {
    setLoading(true);
    setSuccessMessage("");
    try {
      const res = await fetch("/api/research/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "automated",
          geminiModel,
          claudeModel,
          openaiModel,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`Synthesized latest models (${geminiModel}, ${claudeModel}, ${openaiModel})!`);
        setTimeout(() => {
          onResearchCompleted();
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualImport = async () => {
    setLoading(true);
    setSuccessMessage("");
    try {
      const res = await fetch("/api/research/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "manual",
          manualText: manualText || undefined,
          geminiText: geminiChatText || undefined,
          claudeText: claudeReportText || undefined,
          chatgptText: chatgptReportText || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage("Reports parsed and consensus synthesized into Master Trade Plan!");
        setTimeout(() => {
          onResearchCompleted();
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0E121D] p-6 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Multi-AI Research Orchestrator
              </h3>
              <p className="text-xs text-neutral-400 font-mono">
                Gemini 3.7 Flash • Claude (Sonnet 5 / Opus / Fable) • OpenAI 5.6
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-white/[0.08] hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Segmented Control Tabs */}
        <div className="flex rounded-2xl bg-black/40 p-1 border border-white/[0.06]">
          <button
            onClick={() => setTab("automated")}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
              tab === "automated"
                ? "bg-white text-neutral-900 shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Run Latest AI Models
          </button>
          <button
            onClick={() => setTab("manual")}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
              tab === "manual"
                ? "bg-white text-neutral-900 shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Paste Report / Gemini Chat
          </button>
          <button
            onClick={() => setTab("prompt")}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
              tab === "prompt"
                ? "bg-white text-neutral-900 shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Get Deep Research Prompt
          </button>
        </div>

        {/* Tab 1: Automated Latest AI Models */}
        {tab === "automated" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.05] p-4 text-xs text-neutral-300 leading-relaxed space-y-2">
              <span className="font-semibold text-sky-400 block uppercase tracking-wider">
                Targeting Paid &amp; Latest AI Models
              </span>
              <p>
                The Senior Broker engine will query your selected paid models: <strong>Gemini 3.7 Flash</strong>, <strong>Claude (Sonnet 5 / Opus / Fable)</strong>, and <strong>OpenAI 5.6</strong>.
              </p>
            </div>

            {/* Model Selection Config Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              {/* Gemini */}
              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 space-y-1.5">
                <span className="text-indigo-300 font-bold block text-sm">Google Gemini</span>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full rounded-lg border border-indigo-500/30 bg-black/70 px-2 py-1 text-xs text-white"
                >
                  <option value="gemini-3.7-flash">Gemini 3.7 Flash</option>
                  <option value="gemini-2.0-pro">Gemini 2.0 Pro</option>
                </select>
                <span className="text-[10px] text-neutral-400 block">Fast deep reasoning</span>
              </div>

              {/* Claude */}
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-1.5">
                <span className="text-amber-300 font-bold block text-sm">Anthropic Claude</span>
                <select
                  value={claudeModel}
                  onChange={(e) => setClaudeModel(e.target.value)}
                  className="w-full rounded-lg border border-amber-500/30 bg-black/70 px-2 py-1 text-xs text-white"
                >
                  <option value="claude-sonnet-5">Claude Sonnet 5</option>
                  <option value="claude-opus">Claude Opus</option>
                  <option value="claude-fable">Claude Fable</option>
                </select>
                <span className="text-[10px] text-neutral-400 block">Prop desk strategist</span>
              </div>

              {/* OpenAI */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-1.5">
                <span className="text-emerald-300 font-bold block text-sm">OpenAI</span>
                <select
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  className="w-full rounded-lg border border-emerald-500/30 bg-black/70 px-2 py-1 text-xs text-white"
                >
                  <option value="gpt-5.6">OpenAI 5.6</option>
                  <option value="o3">OpenAI o3</option>
                  <option value="gpt-4o">OpenAI 4o</option>
                </select>
                <span className="text-[10px] text-neutral-400 block">Asymmetric setups</span>
              </div>
            </div>

            <button
              onClick={handleRunAutomated}
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 py-3.5 text-sm font-semibold text-white shadow-lg hover:opacity-95 transition active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Synthesizing Latest AI Models...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Execute Latest Multi-AI Deep Research</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Tab 2: Manual Paste Mode */}
        {tab === "manual" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-xs text-neutral-300">
              <span className="font-semibold text-white block mb-1">
                Paste Gemini 3.7 Chat, Claude, or HTML Report
              </span>
              Run the deep research prompt in your Gemini 3.7 / Claude Sonnet 5 / OpenAI 5.6 web chats, and paste the raw text or HTML here.
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                Report Text or Gemini Chat Transcript
              </label>
              <textarea
                rows={6}
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Paste your Gemini 3.7 chat, Claude report, or trade table here..."
                className="w-full rounded-2xl border border-white/10 bg-black/50 p-3.5 font-mono text-xs text-neutral-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            <button
              onClick={handleManualImport}
              disabled={loading || !manualText.trim()}
              className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-white py-3.5 text-sm font-semibold text-neutral-900 shadow hover:bg-neutral-100 transition active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Reconciling &amp; Synthesizing...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>Import &amp; Synthesize Master Plan</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Tab 3: Copy Master Prompt */}
        {tab === "prompt" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-xs text-neutral-300 space-y-2">
              <span className="font-semibold text-white block">
                Proprietary Deep Research Prompt
              </span>
              <p>
                Copy this prompt and paste it into a new conversation in <strong>Gemini 3.7 Flash</strong>, <strong>Claude Sonnet 5 / Opus / Fable</strong>, or <strong>OpenAI 5.6</strong> with web research enabled.
              </p>
            </div>

            <button
              onClick={handleCopyPrompt}
              className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-sky-500 py-3 text-xs font-semibold text-white shadow hover:bg-sky-400 transition active:scale-95"
            >
              {promptCopied ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Prompt Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy Prompt for Gemini 3.7 / Claude / OpenAI 5.6</span>
                </>
              )}
            </button>

            <pre className="max-h-48 overflow-y-auto rounded-2xl border border-white/10 bg-black/60 p-4 font-mono text-[11px] text-neutral-300">
              {SWING_TRADE_RESEARCH_PROMPT}
            </pre>
          </div>
        )}

        {/* Success Message Banner */}
        {successMessage && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 font-medium flex items-center space-x-2">
            <Check className="h-4 w-4 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
