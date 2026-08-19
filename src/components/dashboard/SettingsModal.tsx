"use client";

import React, { useState, useEffect } from "react";
import { Sliders, Key, DollarSign, Shield, X, Check, Smartphone, Globe } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountSize: number;
  riskPerTrade: number;
  onUpdateSettings: (newSettings: { accountSize: number; riskPerTrade: number }) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  accountSize,
  riskPerTrade,
  onUpdateSettings,
}) => {
  const [size, setSize] = useState(accountSize.toString());
  const [risk, setRisk] = useState(riskPerTrade.toString());
  const [geminiKey, setGeminiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSize(accountSize.toString());
    setRisk(riskPerTrade.toString());
  }, [accountSize, riskPerTrade]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const s = parseFloat(size) || 10000;
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
                Manage risk sizing constraints, API keys, and device sync
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

        {/* Risk Management Math Settings */}
        <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <h4 className="text-xs font-mono uppercase tracking-wider text-sky-400">
            1. Risk &amp; Sizing Parameters
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Account Capital ($)
              </label>
              <input
                type="number"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 font-mono text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Risk Per Trade (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={risk}
                onChange={(e) => setRisk(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 font-mono text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <p className="text-[11px] text-neutral-500 font-mono">
            Every candidate setup automatically computes exact share count = floor((${parseFloat(size || "10000")} × {parseFloat(risk || "1.0")}%) ÷ stop distance).
          </p>
        </div>

        {/* Multi-AI API Keys Vault */}
        <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <h4 className="text-xs font-mono uppercase tracking-wider text-sky-400 flex items-center space-x-1.5">
            <Key className="h-3.5 w-3.5" />
            <span>2. Optional AI Model API Keys (Encrypted)</span>
          </h4>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Google Gemini API Key
              </label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 font-mono text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Anthropic Claude API Key
              </label>
              <input
                type="password"
                placeholder="sk-ant-..."
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 font-mono text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                OpenAI GPT-4o API Key
              </label>
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

        {/* Cloudflare & Mobile Access Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-2 text-xs text-neutral-300">
          <div className="flex items-center space-x-2 text-sky-400 font-semibold uppercase tracking-wider">
            <Smartphone className="h-4 w-4" />
            <span>Mobile &amp; Cloudflare Access</span>
          </div>
          <p>
            This web app is 100% responsive and PWA-enabled. You can deploy it to <strong>Cloudflare</strong> or access it from your phone’s browser and click <em>"Add to Home Screen"</em> to receive instant notifications anywhere.
          </p>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-white py-3.5 text-sm font-semibold text-neutral-900 shadow hover:bg-neutral-100 transition active:scale-95"
        >
          {saved ? (
            <>
              <Check className="h-4 w-4 text-emerald-600" />
              <span>Settings Saved</span>
            </>
          ) : (
            <span>Save Settings</span>
          )}
        </button>
      </div>
    </div>
  );
};
