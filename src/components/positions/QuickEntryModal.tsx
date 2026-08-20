"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Trade } from "@/lib/storage/types";
import { calculatePositionSize, SizingResult } from "@/lib/portfolio/sizing-calculator";
import { validateProposedTrade, PortfolioRuleCheckResult } from "@/lib/market/rule-engine";
import { upsertProfileTrade } from "@/lib/storage/profile-vault";
import { PriceLadder } from "@/components/dashboard/PriceLadder";
import { playEntryTriggered } from "@/lib/audio/sounds";
import {
  PlusCircle,
  Calculator,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
  Sparkles,
  Zap,
  TrendingUp,
  Sliders,
  AlertTriangle,
  Calendar,
  DollarSign,
  History,
  CheckCircle2,
} from "lucide-react";

export interface QuickEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTradeAdded: () => void;
  accountSize?: number;
  riskPerTrade?: number;
  availableCash?: number;
  activeTrades?: Trade[];
  initialCandidate?: any;
}

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({
  isOpen,
  onClose,
  onTradeAdded,
  accountSize = 15000,
  riskPerTrade = 1.0,
  availableCash,
  activeTrades = [],
  initialCandidate,
}) => {
  const [ticker, setTicker] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [sector, setSector] = useState("Technology");
  const [status, setStatus] = useState<"ACTIVE" | "PENDING_ENTRY" | "CLOSED">("ACTIVE");
  const [setupType, setSetupType] = useState("Catalyst Continuation");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [target1, setTarget1] = useState("");
  const [target2, setTarget2] = useState("");
  const [shares, setShares] = useState("");
  const [timeStopSessions, setTimeStopSessions] = useState("6");
  const [notes, setNotes] = useState("");
  const [atr, setAtr] = useState("");
  const [isManualShares, setIsManualShares] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fields for Closed / Historical Positions
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [exitDate, setExitDate] = useState(new Date().toISOString().split("T")[0]);
  const [exitPrice, setExitPrice] = useState("");
  const [exitReason, setExitReason] = useState("STOP_LOSS_EXECUTED");

  // Pre-fill from initialCandidate if supplied
  useEffect(() => {
    if (initialCandidate && isOpen) {
      setTicker(initialCandidate.ticker || "");
      setCompanyName(initialCandidate.companyName || "");
      setSector(initialCandidate.sector || "Technology");
      setSetupType(initialCandidate.setupType || "Catalyst Continuation");
      if (initialCandidate.entryTrigger) setEntryPrice(initialCandidate.entryTrigger.toString());
      if (initialCandidate.stopLoss) setStopLoss(initialCandidate.stopLoss.toString());
      if (initialCandidate.target1) setTarget1(initialCandidate.target1.toString());
      if (initialCandidate.target2) setTarget2(initialCandidate.target2.toString());
      if (initialCandidate.positionShares) setShares(initialCandidate.positionShares.toString());
      if (initialCandidate.notes || initialCandidate.catalystSummary) {
        setNotes(initialCandidate.notes || initialCandidate.catalystSummary || "");
      }
    }
  }, [initialCandidate, isOpen]);

  const parsedEntry = parseFloat(entryPrice) || 0;
  const parsedStop = parseFloat(stopLoss) || 0;
  const parsedT1 = parseFloat(target1) || undefined;
  const parsedT2 = parseFloat(target2) || undefined;
  const parsedAtr = parseFloat(atr) || undefined;
  const parsedExit = parseFloat(exitPrice) || 0;
  const parsedShares = parseInt(shares, 10) || 0;

  // Real-time Reactive Sizing calculation
  const sizingResult: SizingResult | null = useMemo(() => {
    if (parsedEntry <= 0 || parsedStop <= 0 || parsedStop >= parsedEntry) {
      return null;
    }
    return calculatePositionSize({
      accountSize,
      riskPct: riskPerTrade,
      entryPrice: parsedEntry,
      stopLoss: parsedStop,
      atr: parsedAtr,
      target1: parsedT1,
      target2: parsedT2,
      availableCash: availableCash ?? accountSize,
    });
  }, [accountSize, riskPerTrade, parsedEntry, parsedStop, parsedAtr, parsedT1, parsedT2, availableCash]);

  // Auto-fill shares, target1, target2 when sizingResult updates (if not manually overridden)
  useEffect(() => {
    if (sizingResult && !isManualShares && status !== "CLOSED") {
      setShares(sizingResult.shares.toString());
      if (!target1 && sizingResult.target1) {
        setTarget1(sizingResult.target1.toFixed(2));
      }
      if (!target2 && sizingResult.target2) {
        setTarget2(sizingResult.target2.toFixed(2));
      }
    }
  }, [sizingResult, isManualShares, target1, target2, status]);

  // For CLOSED positions, compute realized P&L and R-multiple
  const calculatedRealizedPnL = useMemo(() => {
    if (status !== "CLOSED" || parsedEntry <= 0 || parsedExit <= 0 || parsedShares <= 0) return 0;
    return Number(((parsedExit - parsedEntry) * parsedShares).toFixed(2));
  }, [status, parsedEntry, parsedExit, parsedShares]);

  const calculatedRMultiple = useMemo(() => {
    if (status !== "CLOSED" || parsedEntry <= 0 || parsedStop <= 0 || parsedEntry === parsedStop) return 0;
    const riskPerShare = Math.abs(parsedEntry - parsedStop);
    return Number(((parsedExit - parsedEntry) / riskPerShare).toFixed(2));
  }, [status, parsedEntry, parsedStop, parsedExit]);

  // Rule Guardrail Validation for proposed trade
  const ruleCheck: PortfolioRuleCheckResult | null = useMemo(() => {
    if (status === "CLOSED" || parsedEntry <= 0 || parsedStop <= 0 || parsedShares <= 0) return null;
    return validateProposedTrade(
      {
        ticker: ticker.toUpperCase(),
        entryPrice: parsedEntry,
        stopLoss: parsedStop,
        shares: parsedShares,
        sector,
      },
      {
        accountSize,
        trades: activeTrades,
      }
    );
  }, [status, ticker, parsedEntry, parsedStop, parsedShares, sector, accountSize, activeTrades]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const sym = ticker.toUpperCase().trim();
    if (!sym) {
      setError("Please specify a ticker symbol.");
      return;
    }
    if (parsedEntry <= 0) {
      setError("Valid entry price required.");
      return;
    }
    if (parsedStop <= 0) {
      setError("Stop loss price required.");
      return;
    }
    if (parsedShares <= 0) {
      setError("Total shares must be greater than zero.");
      return;
    }
    if (status === "CLOSED" && parsedExit <= 0) {
      setError("Please provide the exit / sold price for closed position.");
      return;
    }

    setLoading(true);
    try {
      const riskPerShare = Math.max(0.01, Math.abs(parsedEntry - parsedStop));
      const target1Val = parsedT1 || Number((parsedEntry + 2 * riskPerShare).toFixed(2));
      const target2Val = parsedT2 || Number((parsedEntry + 3.5 * riskPerShare).toFixed(2));
      const calculatedRR = Number(((target1Val - parsedEntry) / riskPerShare).toFixed(2));

      const payload: any = {
        ticker: sym,
        companyName: companyName.trim() || `${sym} Corporation`,
        sector,
        setupType,
        status,
        entryTrigger: parsedEntry,
        actualEntry: parsedEntry,
        entryDate: entryDate ? new Date(entryDate).toISOString() : new Date().toISOString(),
        sharesTotal: parsedShares,
        sharesRemaining: status === "CLOSED" ? 0 : parsedShares,
        initialStop: parsedStop,
        currentStop: parsedStop,
        target1: target1Val,
        target2: target2Val,
        rrRatio: calculatedRR,
        timeStopSessions: parseInt(timeStopSessions, 10) || 6,
        notes: notes.trim(),
      };

      if (status === "CLOSED") {
        payload.closedDate = exitDate ? new Date(exitDate).toISOString() : new Date().toISOString();
        payload.closedPrice = parsedExit;
        payload.exitReason = exitReason;
        payload.realizedPnL = calculatedRealizedPnL;
        payload.rMultiple = calculatedRMultiple;
      }

      // 1. Post to Server API
      let createdTrade: any = null;
      try {
        const res = await fetch("/api/trades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.trade) {
          createdTrade = data.trade;
        }
      } catch (e) {
        console.warn("Failed to post to server API:", e);
      }

      if (!createdTrade) {
        createdTrade = {
          ...payload,
          id: `custom-trade-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
      }

      // 2. Dual-Persist to Local Profile Vault
      upsertProfileTrade(createdTrade);

      onTradeAdded();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to log trade.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0E1322] p-6 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[92vh]">
        
        {/* Header & 3-Mode Selector */}
        <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-sky-400">
                Senior Broker Position Desk
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white mt-1">
              Log Position &amp; History
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-white/[0.08] hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 3-Mode Tabs */}
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-black/40 p-1.5 border border-white/[0.06]">
          <button
            type="button"
            onClick={() => setStatus("ACTIVE")}
            className={`flex items-center justify-center space-x-1.5 rounded-xl py-2 text-xs font-semibold transition ${
              status === "ACTIVE"
                ? "bg-emerald-500 text-white shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Active Holding</span>
          </button>

          <button
            type="button"
            onClick={() => setStatus("PENDING_ENTRY")}
            className={`flex items-center justify-center space-x-1.5 rounded-xl py-2 text-xs font-semibold transition ${
              status === "PENDING_ENTRY"
                ? "bg-sky-500 text-white shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Pending Watch</span>
          </button>

          <button
            type="button"
            onClick={() => setStatus("CLOSED")}
            className={`flex items-center justify-center space-x-1.5 rounded-xl py-2 text-xs font-semibold transition ${
              status === "CLOSED"
                ? "bg-purple-500 text-white shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Past Closed Move</span>
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Row 1: Symbol & Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                Ticker Symbol *
              </label>
              <input
                type="text"
                placeholder="e.g. NVDA, GLBE, ATRO"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                required
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 font-mono text-sm font-bold text-white uppercase tracking-wider focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                Company Name / Sector
              </label>
              <input
                type="text"
                placeholder="e.g. NVIDIA Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Row 2: Entry Price & Stop Loss */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-emerald-400 mb-1">
                {status === "CLOSED" ? "Actual Entry Price ($) *" : "Entry Price ($) *"}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2 text-neutral-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="100.00"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  required
                  className="w-full rounded-xl border border-emerald-500/30 bg-black/50 pl-8 pr-3.5 py-2 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-rose-400 mb-1">
                Hard Stop Loss ($) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2 text-rose-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="95.00"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  required
                  className="w-full rounded-xl border border-rose-500/30 bg-black/50 pl-8 pr-3.5 py-2 font-mono text-sm text-rose-300 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          </div>

          {/* Sizing & Shares Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-mono uppercase text-sky-400">
                  Total Shares *
                </label>
                {sizingResult && status !== "CLOSED" && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualShares(false);
                      setShares(sizingResult.shares.toString());
                    }}
                    className="text-[10px] font-mono text-emerald-400 underline"
                  >
                    1% Risk Auto: {sizingResult.shares} sh
                  </button>
                )}
              </div>
              <input
                type="number"
                placeholder="e.g. 50"
                value={shares}
                onChange={(e) => {
                  setIsManualShares(true);
                  setShares(e.target.value);
                }}
                required
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 font-mono text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Target 1 */}
            <div>
              <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                Target 1 ($) (2:1 R:R Scale)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2 text-neutral-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="110.00"
                  value={target1}
                  onChange={(e) => setTarget1(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 pl-8 pr-3.5 py-2 font-mono text-sm text-neutral-200 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* IF CLOSED: Exit Details (Date, Price, Reason, Realized P&L) */}
          {status === "CLOSED" && (
            <div className="rounded-2xl border border-purple-500/30 bg-purple-500/[0.04] p-4 space-y-4">
              <div className="flex items-center space-x-2 text-purple-300 text-xs font-mono font-bold uppercase">
                <History className="h-4 w-4" />
                <span>Historical Campaign Exit Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-neutral-400 mb-1">
                    Entry Date
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-1.5 font-mono text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-neutral-400 mb-1">
                    Exit / Sold Date *
                  </label>
                  <input
                    type="date"
                    value={exitDate}
                    onChange={(e) => setExitDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-1.5 font-mono text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-rose-400 mb-1">
                    Exit / Sold Price ($) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1.5 text-neutral-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="94.50"
                      value={exitPrice}
                      onChange={(e) => setExitPrice(e.target.value)}
                      required
                      className="w-full rounded-xl border border-purple-500/30 bg-black/50 pl-7 pr-3 py-1.5 font-mono text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-mono text-neutral-400 mb-1">
                    Exit Reason
                  </label>
                  <select
                    value={exitReason}
                    onChange={(e) => setExitReason(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white font-mono"
                  >
                    <option value="STOP_LOSS_EXECUTED">Stop Loss Hit (Stopped Out)</option>
                    <option value="TARGET_1_HIT">Target 1 Reached (Scaled 50%)</option>
                    <option value="TARGET_2_HIT">Target 2 Reached (Full Profit)</option>
                    <option value="TIME_STOP_EXIT">Time Stop Exit (Momentum Stalled)</option>
                    <option value="MANUAL_EXIT">Manual Discretionary Exit</option>
                  </select>
                </div>

                {/* Realized P&L Summary Box */}
                <div className="rounded-xl border border-white/10 bg-black/40 p-2.5 flex items-center justify-between font-mono text-xs">
                  <div>
                    <span className="text-neutral-400 block text-[10px] uppercase">Realized P&amp;L</span>
                    <span className={`text-base font-bold ${calculatedRealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {calculatedRealizedPnL >= 0 ? "+" : ""}${calculatedRealizedPnL.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-[10px] uppercase">R-Multiple</span>
                    <span className={`text-base font-bold ${calculatedRMultiple >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {calculatedRMultiple >= 0 ? "+" : ""}{calculatedRMultiple.toFixed(2)}R
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes / Thesis */}
          <div>
            <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
              Catalyst Notes / Trade Post-Mortem
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Stopped out on post-earnings consolidation chop. Honor risk rule."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 text-xs text-neutral-200 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className={`flex items-center space-x-2 rounded-full px-6 py-2.5 text-xs font-semibold text-white shadow-lg transition active:scale-95 disabled:opacity-50 ${
                status === "CLOSED"
                  ? "bg-purple-500 hover:bg-purple-400 shadow-purple-500/20"
                  : "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20"
              }`}
            >
              {loading ? (
                <span>Logging...</span>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{status === "CLOSED" ? "Log Closed Move into History" : "Save Active Position"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
