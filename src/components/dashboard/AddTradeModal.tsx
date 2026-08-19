"use client";

import React, { useState } from "react";
import { PlusCircle, DollarSign, ShieldAlert, TrendingUp, X, Check, Calculator, Sparkles } from "lucide-react";

interface AddTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTradeAdded: () => void;
  accountSize: number;
  riskPerTrade: number;
}

export const AddTradeModal: React.FC<AddTradeModalProps> = ({
  isOpen,
  onClose,
  onTradeAdded,
  accountSize,
  riskPerTrade,
}) => {
  const [ticker, setTicker] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "PENDING_ENTRY">("ACTIVE");
  const [setupType, setSetupType] = useState("Post-Earnings Pullback");
  const [entryPrice, setEntryPrice] = useState("");
  const [shares, setShares] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [target1, setTarget1] = useState("");
  const [target2, setTarget2] = useState("");
  const [timeStopSessions, setTimeStopSessions] = useState("6");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  // Auto-calculate position size based on 1% risk rule
  const handleAutoCalculateSize = () => {
    const entry = parseFloat(entryPrice);
    const stop = parseFloat(stopLoss);
    if (!entry || !stop || entry <= stop) {
      setError("Please enter valid Entry Price and Stop Loss (Entry must be > Stop).");
      return;
    }
    setError("");
    const riskBudget = accountSize * (riskPerTrade / 100);
    const riskPerShare = Math.abs(entry - stop);
    const calculatedShares = Math.max(1, Math.floor(riskBudget / riskPerShare));
    setShares(calculatedShares.toString());

    // If Target 1 is empty, auto-set to 2:1 R:R
    if (!target1) {
      const defaultT1 = entry + (2.0 * riskPerShare);
      setTarget1(defaultT1.toFixed(2));
    }
    if (!target2) {
      const defaultT2 = entry + (3.5 * riskPerShare);
      setTarget2(defaultT2.toFixed(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || !entryPrice || !stopLoss || !shares) {
      setError("Please fill in Ticker, Entry Price, Stop Loss, and Shares.");
      return;
    }

    const entry = parseFloat(entryPrice);
    const stop = parseFloat(stopLoss);
    if (isNaN(entry) || isNaN(stop) || entry <= stop) {
      setError("Entry price must be greater than Hard Stop Loss.");
      return;
    }

    const totalShares = Math.max(1, Math.floor(parseFloat(shares) || 1));
    const riskPerShare = Math.abs(entry - stop);
    const t1 = parseFloat(target1) || (entry + (2.0 * riskPerShare));
    const t2 = parseFloat(target2) || (entry + (3.5 * riskPerShare));
    const rrRatio = (t1 - entry) / riskPerShare;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: ticker.toUpperCase().trim(),
          companyName: companyName.trim() || `${ticker.toUpperCase().trim()} Inc.`,
          status,
          setupType,
          entryTrigger: entry,
          actualEntry: status === "ACTIVE" ? entry : undefined,
          sharesTotal: totalShares,
          initialStop: stop,
          currentStop: stop,
          target1: t1,
          target2: t2,
          rrRatio: Number(rrRatio.toFixed(2)),
          timeStopSessions: parseInt(timeStopSessions, 10) || 6,
          notes: notes.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        onTradeAdded();
        onClose();
        // Reset form
        setTicker("");
        setCompanyName("");
        setEntryPrice("");
        setShares("");
        setStopLoss("");
        setTarget1("");
        setTarget2("");
        setNotes("");
      } else {
        setError(data.error || "Failed to add position");
      }
    } catch (err: any) {
      setError(err?.message || "Error adding position");
    } finally {
      setLoading(false);
    }
  };

  const parsedSharesNum = Math.floor(parseFloat(shares) || 0);
  const calculatedRisk = parsedSharesNum * Math.abs((parseFloat(entryPrice) || 0) - (parseFloat(stopLoss) || 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0E121D] p-6 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600">
              <PlusCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Add Current Position / Watch Order
              </h3>
              <p className="text-xs text-neutral-400 font-mono">
                Log your swing positions with defined risk, stops, and profit targets
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Status Toggle (Active Position vs Pending Watch Order) */}
          <div className="flex rounded-2xl bg-black/40 p-1 border border-white/[0.06]">
            <button
              type="button"
              onClick={() => setStatus("ACTIVE")}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
                status === "ACTIVE"
                  ? "bg-emerald-500 text-white shadow"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Active Open Position (Holding Now)
            </button>
            <button
              type="button"
              onClick={() => setStatus("PENDING_ENTRY")}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
                status === "PENDING_ENTRY"
                  ? "bg-sky-500 text-white shadow"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Pending Watch Order (Trigger Pending)
            </button>
          </div>

          {/* Row 1: Ticker & Setup Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                Ticker Symbol *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. GLBE, PLTR, NVDA"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-emerald-500 uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                Setup Style
              </label>
              <select
                value={setupType}
                onChange={(e) => setSetupType(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Post-Earnings Pullback">Post-Earnings Pullback</option>
                <option value="Catalyst Continuation">Catalyst Continuation</option>
                <option value="Base Breakout">Base Breakout</option>
                <option value="Momentum High-Tight Flag">Momentum High-Tight Flag</option>
              </select>
            </div>
          </div>

          {/* Row 2: Entry Price & Stop Loss */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                Entry / Fill Price ($) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="42.30"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-rose-400 mb-1">
                Hard Stop Loss ($) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="40.20"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full rounded-xl border border-rose-500/30 bg-black/50 px-3.5 py-2.5 font-mono text-sm text-rose-300 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Row 3: Auto-Calculate Shares Button & Shares Count */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-sky-400">
                Position Sizing (1% Risk = ${(accountSize * (riskPerTrade / 100)).toFixed(0)})
              </span>
              <button
                type="button"
                onClick={handleAutoCalculateSize}
                className="flex items-center space-x-1 text-xs font-semibold text-emerald-400 hover:underline"
              >
                <Calculator className="h-3.5 w-3.5" />
                <span>Auto-Calculate 1% Risk Size</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">
                  Share Count (Whole Shares) *
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  placeholder="e.g. 118"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex flex-col justify-center text-xs font-mono text-neutral-400">
                <div>Capital Allocated: <span className="text-white font-bold">${(parsedSharesNum * (parseFloat(entryPrice) || 0)).toFixed(2)}</span></div>
                <div>Risk on Trade: <span className="text-amber-400 font-bold">${calculatedRisk.toFixed(2)}</span> ({((calculatedRisk / accountSize) * 100).toFixed(1)}% of ${accountSize.toLocaleString()})</div>
              </div>
            </div>
          </div>

          {/* Row 4: Targets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-emerald-400 mb-1">
                Target 1 (Scale 50%) ($)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="48.00"
                value={target1}
                onChange={(e) => setTarget1(e.target.value)}
                className="w-full rounded-xl border border-emerald-500/30 bg-black/50 px-3.5 py-2.5 font-mono text-sm text-emerald-300 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-purple-400 mb-1">
                Target 2 (Runner) ($)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="52.00"
                value={target2}
                onChange={(e) => setTarget2(e.target.value)}
                className="w-full rounded-xl border border-purple-500/30 bg-black/50 px-3.5 py-2.5 font-mono text-sm text-purple-300 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Row 5: Notes */}
          <div>
            <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
              Catalyst / Trade Thesis (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Q2 Earnings beat + guidance raise. Breakout above 50-DMA on 2x volume."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-neutral-200 focus:outline-none focus:border-sky-500"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 font-mono">{error}</p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-white py-3.5 text-sm font-semibold text-neutral-900 shadow hover:bg-neutral-100 transition active:scale-95 disabled:opacity-50"
          >
            <PlusCircle className="h-4 w-4 text-emerald-600" />
            <span>Add Position to Portfolio</span>
          </button>
        </form>
      </div>
    </div>
  );
};
