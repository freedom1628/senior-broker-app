"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Trade } from "@/lib/storage/types";
import { calculatePositionSize, SizingResult } from "@/lib/portfolio/sizing-calculator";
import { validateProposedTrade, PortfolioRuleCheckResult } from "@/lib/market/rule-engine";
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
  const [status, setStatus] = useState<"ACTIVE" | "PENDING_ENTRY">("ACTIVE");
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

  // Auto-sync calculated shares if not manually overridden
  useEffect(() => {
    if (!isManualShares && sizingResult && sizingResult.isValid && sizingResult.shares > 0) {
      setShares(sizingResult.shares.toString());
      if (!target1 && sizingResult.target1 > 0) {
        setTarget1(sizingResult.target1.toFixed(2));
      }
      if (!target2 && sizingResult.target2 > 0) {
        setTarget2(sizingResult.target2.toFixed(2));
      }
    }
  }, [sizingResult, isManualShares, target1, target2]);

  // Pre-trade Guardrail Validation
  const guardrailCheck: PortfolioRuleCheckResult | null = useMemo(() => {
    if (!ticker || parsedEntry <= 0 || parsedStop <= 0) return null;
    const currentShares = parseInt(shares, 10) || sizingResult?.shares || 1;
    const riskPerShare = Math.max(0.01, parsedEntry - parsedStop);
    const dollarRisk = currentShares * riskPerShare;

    return validateProposedTrade(
      {
        ticker,
        companyName,
        sector,
        entryPrice: parsedEntry,
        stopLoss: parsedStop,
        shares: currentShares,
        dollarRisk,
      },
      {
        accountSize,
        trades: activeTrades as any,
      }
    );
  }, [ticker, companyName, sector, parsedEntry, parsedStop, shares, sizingResult, accountSize, activeTrades]);

  // Quick Preset Handlers (<15s flow)
  const applyPresetStop = (pct: number) => {
    if (parsedEntry <= 0) return;
    const calculatedStop = Number((parsedEntry * (1 - pct / 100)).toFixed(2));
    setStopLoss(calculatedStop.toString());
    setIsManualShares(false);
  };

  const applyAtrStop = () => {
    if (parsedEntry <= 0) return;
    const estimatedAtr = parsedAtr || Number((parsedEntry * 0.035).toFixed(2));
    const calculatedStop = Number((parsedEntry - estimatedAtr * 2.0).toFixed(2));
    setStopLoss(calculatedStop.toString());
    setIsManualShares(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim() || parsedEntry <= 0 || parsedStop <= 0) {
      setError("Please provide a valid Ticker, Entry Price, and Hard Stop Loss.");
      return;
    }

    if (parsedStop >= parsedEntry) {
      setError("Discipline Rule: Hard Stop Loss must be strictly below Entry Price for long swing trades.");
      return;
    }

    const finalShares = Math.max(1, parseInt(shares, 10) || (sizingResult?.shares ?? 1));
    const riskPerShare = Math.max(0.01, parsedEntry - parsedStop);
    const finalT1 = parsedT1 || Number((parsedEntry + 2.0 * riskPerShare).toFixed(2));
    const finalT2 = parsedT2 || Number((parsedEntry + 3.5 * riskPerShare).toFixed(2));
    const rrRatio = Number(((finalT1 - parsedEntry) / riskPerShare).toFixed(2));

    setLoading(true);
    setError("");

    const newTradePayload = {
      id: `local-trade-${Date.now()}`,
      ticker: ticker.toUpperCase().trim(),
      companyName: companyName.trim() || `${ticker.toUpperCase().trim()} Inc.`,
      sector: sector.trim() || "Technology",
      status,
      setupType,
      entryTrigger: parsedEntry,
      actualEntry: status === "ACTIVE" ? parsedEntry : undefined,
      entryDate: status === "ACTIVE" ? new Date().toISOString() : undefined,
      sharesTotal: finalShares,
      sharesRemaining: finalShares,
      initialStop: parsedStop,
      currentStop: parsedStop,
      target1: finalT1,
      target2: finalT2,
      rrRatio,
      timeStopSessions: parseInt(timeStopSessions, 10) || 6,
      sessionsElapsed: 0,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    try {
      // POST to server route
      await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTradePayload),
      });

      // Synchronously backup to localStorage
      try {
        const localTrades = JSON.parse(localStorage.getItem("senior_broker_custom_positions") || "[]");
        localTrades.unshift(newTradePayload);
        localStorage.setItem("senior_broker_custom_positions", JSON.stringify(localTrades));
      } catch (e) {}

      playEntryTriggered();
      onTradeAdded();
      onClose();

      // Reset form
      setTicker("");
      setCompanyName("");
      setEntryPrice("");
      setStopLoss("");
      setTarget1("");
      setTarget2("");
      setShares("");
      setNotes("");
      setIsManualShares(false);
    } catch (err: any) {
      // Fallback to local storage if network route has edge issue
      try {
        const localTrades = JSON.parse(localStorage.getItem("senior_broker_custom_positions") || "[]");
        localTrades.unshift(newTradePayload);
        localStorage.setItem("senior_broker_custom_positions", JSON.stringify(localTrades));
      } catch (e) {}

      playEntryTriggered();
      onTradeAdded();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0E121D] p-6 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
              <PlusCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                <span>Fast Trade &amp; Watch Order Entry</span>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-400 font-bold">
                  &lt;15s Flow
                </span>
              </h3>
              <p className="text-xs text-neutral-400 font-mono">
                Automated 1% account risk sizing ($150 on ${accountSize.toLocaleString()}) with 4-tier execution ladders
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

        {/* Pre-Trade Guardrail Gatekeeper Banner */}
        {guardrailCheck && (
          <div
            className={`rounded-2xl border p-3.5 text-xs font-mono flex items-start space-x-2.5 ${
              !guardrailCheck.isAllowed
                ? "border-rose-500/40 bg-rose-500/[0.08] text-rose-200"
                : guardrailCheck.warnings.length > 0
                ? "border-amber-500/40 bg-amber-500/[0.08] text-amber-200"
                : "border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-200"
            }`}
          >
            {!guardrailCheck.isAllowed ? (
              <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            ) : guardrailCheck.warnings.length > 0 ? (
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <span className="font-bold block">
                {!guardrailCheck.isAllowed
                  ? `Order Blocked: ${guardrailCheck.blockReason}`
                  : "Institutional Guardrails Passed"}
              </span>
              <span className="text-[11px] opacity-80">
                Sleeve Risk: ${guardrailCheck.projectedOpenRiskDollars.toFixed(2)} ({guardrailCheck.projectedOpenRiskPct.toFixed(2)}% of 3.0% cap) • Active: {guardrailCheck.currentActiveCount + (status === "ACTIVE" ? 1 : 0)}/3 Max
              </span>
            </div>
          </div>
        )}

        {/* Entry Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Status Mode Toggle */}
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
              Pending Watch Order (Breakout Trigger)
            </button>
          </div>

          {/* Row 1: Ticker, Company & Sector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                Ticker Symbol *
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. GLBE, ATRO"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase().trim())}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-emerald-500 uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                Company Name
              </label>
              <input
                type="text"
                placeholder="e.g. Global-e Online"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                Sector / Industry
              </label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Technology">Technology</option>
                <option value="Consumer Discretionary">Consumer Discretionary</option>
                <option value="Industrials">Industrials / Aerospace</option>
                <option value="Healthcare">Healthcare / Biotech</option>
                <option value="Financials">Financials</option>
                <option value="Energy">Energy / Materials</option>
                <option value="Diversified">Diversified</option>
              </select>
            </div>
          </div>

          {/* Row 2: Setup Style Pills */}
          <div>
            <label className="block text-xs font-mono uppercase text-neutral-400 mb-1.5">
              Setup Pattern Style
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                "Catalyst Continuation",
                "Post-Earnings Pullback",
                "Base Breakout",
                "High-Tight Flag",
              ].map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setSetupType(style)}
                  className={`rounded-full px-3 py-1 text-xs font-mono transition ${
                    setupType === style
                      ? "bg-sky-500/20 border border-sky-500/40 text-sky-300 font-semibold"
                      : "bg-white/[0.04] border border-white/[0.06] text-neutral-400 hover:text-white"
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: Entry Price & Stop Loss with Presets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                {status === "ACTIVE" ? "Entry / Fill Price ($) *" : "Breakout Trigger Price ($) *"}
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="42.30"
                value={entryPrice}
                onChange={(e) => {
                  setEntryPrice(e.target.value);
                  setIsManualShares(false);
                }}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-mono uppercase text-rose-400">
                  Hard Stop Loss ($) *
                </label>
                <div className="flex items-center space-x-1.5 text-[10px] font-mono">
                  <span className="text-neutral-500">Presets:</span>
                  <button
                    type="button"
                    onClick={() => applyPresetStop(5)}
                    className="text-sky-400 hover:underline"
                  >
                    5% Pivot
                  </button>
                  <span className="text-neutral-600">•</span>
                  <button
                    type="button"
                    onClick={() => applyPresetStop(8)}
                    className="text-sky-400 hover:underline"
                  >
                    8% Swing
                  </button>
                  <span className="text-neutral-600">•</span>
                  <button
                    type="button"
                    onClick={applyAtrStop}
                    className="text-emerald-400 hover:underline"
                  >
                    2x ATR
                  </button>
                </div>
              </div>
              <input
                type="number"
                step="0.01"
                required
                placeholder="40.20"
                value={stopLoss}
                onChange={(e) => {
                  setStopLoss(e.target.value);
                  setIsManualShares(false);
                }}
                className="w-full rounded-xl border border-rose-500/30 bg-black/50 px-3.5 py-2.5 font-mono text-sm text-rose-300 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Row 4: Reactive Sizing Bar */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-sky-400 flex items-center space-x-1.5">
                <Calculator className="h-3.5 w-3.5" />
                <span>1% Risk Model ($150 Risk on ${accountSize.toLocaleString()})</span>
              </span>
              {sizingResult && (
                <span className="text-[10px] font-mono rounded-md bg-white/[0.06] px-2 py-0.5 text-neutral-300">
                  Limit: {sizingResult.limitingFactor}
                </span>
              )}
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
                  placeholder="e.g. 74"
                  value={shares}
                  onChange={(e) => {
                    setShares(e.target.value);
                    setIsManualShares(true);
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex flex-col justify-center text-xs font-mono text-neutral-400 space-y-1">
                <div>
                  Capital Allocated:{" "}
                  <span className="text-white font-bold">
                    ${((parseInt(shares, 10) || 0) * parsedEntry).toFixed(2)}
                  </span>
                </div>
                <div>
                  Trade Risk:{" "}
                  <span className="text-amber-400 font-bold">
                    ${((parseInt(shares, 10) || 0) * Math.max(0, parsedEntry - parsedStop)).toFixed(2)}
                  </span>{" "}
                  ({(
                    (((parseInt(shares, 10) || 0) * Math.max(0, parsedEntry - parsedStop)) /
                      accountSize) *
                    100
                  ).toFixed(2)}
                  % of sleeve)
                </div>
              </div>
            </div>
          </div>

          {/* Row 5: 4-Tier Target Ladder Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-emerald-400 mb-1">
                Target 1 (Scale 50% &amp; Move Stop to B/E) ($)
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
                Target 2 (Runner Extension / +3.5R) ($)
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

          {/* Embedded Visual 4-Tier Price Ladder Preview */}
          {parsedEntry > 0 && parsedStop > 0 && parsedStop < parsedEntry && (
            <div className="pt-2">
              <span className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">
                Execution Price Ladder Preview:
              </span>
              <PriceLadder
                entryTrigger={parsedEntry}
                stopLoss={parsedStop}
                target1={parsedT1}
                target2={parsedT2}
                positionShares={parseInt(shares, 10) || 0}
                accountSize={accountSize}
                variant="full"
                showSizingBar={true}
              />
            </div>
          )}

          {/* Row 6: Thesis & Catalyst Notes */}
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

          {error && <p className="text-xs text-rose-400 font-mono">{error}</p>}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || (guardrailCheck ? !guardrailCheck.isAllowed : false)}
            className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-white py-3.5 text-sm font-semibold text-neutral-900 shadow hover:bg-neutral-100 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PlusCircle className="h-4 w-4 text-emerald-600" />
            <span>
              {status === "ACTIVE" ? "Log Active Position (<15s)" : "Stage Pending Watch Order"}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default QuickEntryModal;
