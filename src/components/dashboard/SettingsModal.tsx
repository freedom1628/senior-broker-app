"use client";

import React, { useState, useEffect } from "react";
import { Sliders, Key, DollarSign, Shield, X, Check, Trash2, AlertTriangle } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountSize: number;
  riskPerTrade: number;
  onUpdateSettings: (newSettings: { accountSize: number; riskPerTrade: number }) => void;
  onResetAllData?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  accountSize,
  riskPerTrade,
  onUpdateSettings,
  onResetAllData,
}) => {
  const [size, setSize] = useState(accountSize.toString());
  const [risk, setRisk] = useState(riskPerTrade.toString());
  const [geminiKey, setGeminiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    setSize(accountSize.toString());
    setRisk(riskPerTrade.toString());
  }, [accountSize, riskPerTrade]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const s = parseFloat(size) || 15000;
    const r = parseFloat(risk) || 1.0;

    await fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountSize: s,
        riskPerTrade: r,
        geminiKey: geminiKey || undefined,
        anthropicKey: anthropicKey || undefined,
        openaiKey: openaiKey || undefined,
      }),
    });

    onUpdateSettings({ accountSize: s, riskPerTrade: r });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  const handleClearAllData = async () => {
    if (!confirm("Are you sure you want to reset all positions and start with a completely fresh, clean slate?")) {
      return;
    }

    setClearing(true);
    try {
      // 1. Wipe server database trades
      await fetch("/api/trades?clearAll=true", { method: "DELETE" });

      // 2. Wipe client-side storage vaults
      localStorage.removeItem("senior_broker_custom_positions");
      localStorage.removeItem("senior_broker_positions_v1");

      if (onResetAllData) {
        onResetAllData();
      }

      setCleared(true);
      setTimeout(() => {
        setCleared(false);
        setClearing(false);
        onClose();
      }, 1000);
    } catch (e) {
      setClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0E121D] p-6 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06]">
              <Sliders className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Trading Desk &amp; Security Settings
              </h3>
              <p className="text-xs text-neutral-400">
                Manage risk sizing constraints, API keys, and start fresh
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

        {/* Section 1: Risk & Capital Controls */}
        <div className="space-y-4">
          <h4 className="text-xs font-mono uppercase tracking-wider text-sky-400">
            Portfolio Risk Constraints
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Dedicated Swing Capital ($)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-neutral-500">$</span>
                <input
                  type="number"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 pl-8 pr-3.5 py-2 font-mono text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">Total dedicated swing trading sleeve</p>
            </div>

            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Max Risk Per Trade (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={risk}
                  onChange={(e) => setRisk(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 font-mono text-sm text-white focus:outline-none focus:border-sky-500"
                />
                <span className="absolute right-3.5 top-2.5 text-neutral-500">%</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                Dollar Risk: <span className="text-amber-400 font-bold">${((parseFloat(size) || 15000) * ((parseFloat(risk) || 1.0) / 100)).toFixed(0)}</span> per setup
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: AI Model API Keys (Optional) */}
        <div className="space-y-4 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono uppercase tracking-wider text-sky-400">
              Frontier Model API Keys (Optional)
            </h4>
            <span className="text-[11px] text-neutral-500">Stored securely</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Google Gemini API Key</label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 font-mono text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-400 mb-1">Anthropic Claude API Key</label>
              <input
                type="password"
                placeholder="sk-ant-..."
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 font-mono text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-400 mb-1">OpenAI API Key</label>
              <input
                type="password"
                placeholder="sk-..."
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 font-mono text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Reset & Clear Data (Clean Slate) */}
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-4 space-y-3">
          <div className="flex items-center space-x-2 text-rose-400 text-xs font-semibold">
            <AlertTriangle className="h-4 w-4" />
            <span>Reset Portfolio &amp; Start Fresh</span>
          </div>
          <p className="text-xs text-neutral-400">
            Wipe all sample and active positions to start with a clean 0-position portfolio.
          </p>
          <button
            type="button"
            onClick={handleClearAllData}
            disabled={clearing}
            className="flex items-center space-x-2 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3.5 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition active:scale-95 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{cleared ? "Portfolio Wiped & Reset!" : clearing ? "Clearing..." : "Clear All Positions & Reset to $0"}</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center space-x-2 rounded-full bg-white px-5 py-2 text-xs font-semibold text-neutral-900 shadow hover:bg-neutral-100 transition active:scale-95"
          >
            {saved ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Saved</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
