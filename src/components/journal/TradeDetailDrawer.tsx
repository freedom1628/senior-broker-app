"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Trade } from "@/lib/storage/types";
import { upsertProfileTrade } from "@/lib/storage/profile-vault";
import { PriceLadder } from "@/components/dashboard/PriceLadder";
import {
  X,
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Clock,
  TrendingUp,
  Tag,
  Save,
  Check,
  Edit3,
  DollarSign,
  AlertTriangle,
} from "lucide-react";

export interface TradeDetailDrawerProps {
  trade: Trade | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateTrade?: (updatedTrade: Trade) => void;
  onUpdateNotes?: (tradeId: string, updatedNotes: string) => void;
}

export const TradeDetailDrawer: React.FC<TradeDetailDrawerProps> = ({
  trade,
  isOpen,
  onClose,
  onUpdateTrade,
  onUpdateNotes,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [sharesTotal, setSharesTotal] = useState("");
  const [customRealizedPnL, setCustomRealizedPnL] = useState("");
  const [isManualPnL, setIsManualPnL] = useState(false);
  const [entryDate, setEntryDate] = useState("");
  const [exitDate, setExitDate] = useState("");
  const [exitReason, setExitReason] = useState("STOP_LOSS_EXECUTED");
  const [notesText, setNotesText] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync state if trade changes
  useEffect(() => {
    if (trade) {
      const entry = trade.actualEntry || trade.entryTrigger || 0;
      const exit = trade.closedPrice || entry;
      setEntryPrice(entry.toString());
      setStopLoss((trade.initialStop || 0).toString());
      setExitPrice(exit.toString());
      setSharesTotal((trade.sharesTotal || 0).toString());
      setCustomRealizedPnL(trade.realizedPnL !== undefined && trade.realizedPnL !== null ? trade.realizedPnL.toString() : "");
      setIsManualPnL(trade.realizedPnL !== undefined && trade.realizedPnL !== null);

      let safeEntryDate = "";
      if (trade.entryDate) {
        try {
          const d = new Date(trade.entryDate);
          if (!isNaN(d.getTime())) safeEntryDate = d.toISOString().split("T")[0];
        } catch (e) {}
      }
      setEntryDate(safeEntryDate);

      let safeExitDate = "";
      if (trade.closedDate) {
        try {
          const d = new Date(trade.closedDate);
          if (!isNaN(d.getTime())) safeExitDate = d.toISOString().split("T")[0];
        } catch (e) {}
      }
      setExitDate(safeExitDate);

      setExitReason(trade.exitReason || "STOP_LOSS_EXECUTED");
      setNotesText(trade.notes || "");
      setIsEditing(false);
    }
  }, [trade]);

  const currentEntry = parseFloat(entryPrice) || trade?.actualEntry || trade?.entryTrigger || 100;
  const currentExit = parseFloat(exitPrice) || trade?.closedPrice || currentEntry;
  const currentStop = parseFloat(stopLoss) || trade?.initialStop || 95;
  const currentShares = parseFloat(sharesTotal) || trade?.sharesTotal || 1;

  const riskPerShare = Math.max(0.01, Math.abs(currentEntry - currentStop));
  const plannedDollarRisk = currentShares * riskPerShare;
  const autoRealized = Number(((currentExit - currentEntry) * currentShares).toFixed(2));

  const activePnL = useMemo(() => {
    const p = parseFloat(customRealizedPnL);
    return !isNaN(p) ? p : autoRealized;
  }, [customRealizedPnL, autoRealized]);

  const calculatedRMultiple = useMemo(() => {
    if (plannedDollarRisk <= 0) return 0;
    return Number((activePnL / plannedDollarRisk).toFixed(2));
  }, [activePnL, plannedDollarRisk]);

  const isWinner = activePnL > 0;

  if (!isOpen || !trade) return null;

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const updatedPayload: any = {
        tradeId: trade.id,
        actualEntry: currentEntry,
        closedPrice: currentExit,
        initialStop: currentStop,
        currentStop: currentStop,
        sharesTotal: currentShares,
        entryDate: entryDate ? new Date(entryDate).toISOString() : trade.entryDate,
        closedDate: exitDate ? new Date(exitDate).toISOString() : trade.closedDate,
        exitReason: exitReason,
        realizedPnL: activePnL,
        rMultiple: calculatedRMultiple,
        notes: notesText.trim(),
      };

      // 1. Update on Server API
      try {
        await fetch("/api/trades", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tradeId: trade.id,
            action: "UPDATE_DETAILS",
            ...updatedPayload,
          }),
        });
      } catch (e) {}

      // 2. Update in Local Profile Vault
      const fullUpdated = { ...trade, ...updatedPayload };
      upsertProfileTrade(fullUpdated);

      if (onUpdateTrade) {
        onUpdateTrade({ ...trade, ...updatedPayload });
      }

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setSaving(false);
        setIsEditing(false);
      }, 1000);
    } catch (err) {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0E1322] p-6 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
          <div>
            <div className="flex items-center space-x-3">
              <span className="font-mono text-2xl font-bold text-white tracking-tight">
                {trade.ticker}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-mono font-bold ${
                  isWinner
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                }`}
              >
                {isWinner ? "+" : ""}${activePnL.toFixed(2)} ({isWinner ? "+" : ""}{calculatedRMultiple.toFixed(2)}R)
              </span>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-neutral-400 font-mono">
                {exitReason || trade.exitReason || "CLOSED"}
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-sans mt-0.5">
              {trade.companyName} • {trade.setupType || "Swing Campaign"}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center space-x-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-300 hover:bg-white/[0.08] transition"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>{isEditing ? "View Mode" : "Edit Details"}</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-neutral-400 hover:bg-white/[0.08] hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* EDIT FORM (When editing mode active) */}
        {isEditing ? (
          <div className="space-y-4 rounded-2xl border border-sky-500/30 bg-sky-500/[0.03] p-4 font-mono text-xs">
            <div className="flex items-center space-x-2 text-sky-300 font-bold uppercase">
              <Edit3 className="h-4 w-4" />
              <span>Edit Closed Position Details</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] text-neutral-400 uppercase mb-1">Entry Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-2.5 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] text-rose-400 uppercase mb-1">Stop Loss ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-2.5 py-1.5 text-rose-300"
                />
              </div>

              <div>
                <label className="block text-[10px] text-purple-400 uppercase mb-1">Exit / Sold ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={exitPrice}
                  onChange={(e) => setExitPrice(e.target.value)}
                  className="w-full rounded-xl border border-purple-500/30 bg-black/50 px-2.5 py-1.5 text-purple-300"
                />
              </div>

              <div>
                <label className="block text-[10px] text-sky-400 uppercase mb-1">Shares Total</label>
                <input
                  type="number"
                  step="any"
                  value={sharesTotal}
                  onChange={(e) => setSharesTotal(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-2.5 py-1.5 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-neutral-400 uppercase mb-1">Entry Date</label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-2.5 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 uppercase mb-1">Exit Date</label>
                <input
                  type="date"
                  value={exitDate}
                  onChange={(e) => setExitDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-2.5 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 uppercase mb-1">Exit Reason</label>
                <select
                  value={exitReason}
                  onChange={(e) => setExitReason(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-2 py-1.5 text-xs text-white"
                >
                  <option value="STOP_LOSS_EXECUTED">Stop Loss Hit (Stopped Out)</option>
                  <option value="TARGET_1_HIT">Target 1 Reached (50% Scale)</option>
                  <option value="TARGET_2_HIT">Target 2 Reached (Full Profit)</option>
                  <option value="TIME_STOP_EXIT">Time Stop Exit (Momentum Stalled)</option>
                  <option value="MANUAL_EXIT">Manual Discretionary Exit</option>
                </select>
              </div>
            </div>

            {/* Editable Realized P&L Row */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-mono text-neutral-300">
                  Exact Realized P&amp;L ($):
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsManualPnL(false);
                    setCustomRealizedPnL(autoRealized.toFixed(2));
                  }}
                  className="text-[10px] font-mono text-sky-400 underline hover:text-sky-300"
                >
                  Auto: ${(autoRealized).toFixed(2)}
                </button>
              </div>
              <div className="flex items-center space-x-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2 text-neutral-500 font-mono text-xs">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={customRealizedPnL}
                    onChange={(e) => {
                      setIsManualPnL(true);
                      setCustomRealizedPnL(e.target.value);
                    }}
                    placeholder="-303.84"
                    className={`w-full rounded-xl border bg-black/50 pl-7 pr-3.5 py-1.5 font-mono text-xs font-bold ${
                      activePnL >= 0 ? "border-emerald-500/30 text-emerald-300" : "border-rose-500/30 text-rose-300"
                    }`}
                  />
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-neutral-400 block">R-Multiple:</span>
                  <span className={`text-xs font-bold ${calculatedRMultiple >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {calculatedRMultiple >= 0 ? "+" : ""}{calculatedRMultiple.toFixed(2)}R
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={saving}
                className="flex items-center space-x-1.5 rounded-full bg-emerald-500 px-5 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-400 transition"
              >
                {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                <span>{saved ? "Saved!" : saving ? "Saving..." : "Save Details & Adjust Balance"}</span>
              </button>
            </div>
          </div>
        ) : (
          /* VIEW MODE */
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3 font-mono text-xs">
            <span className="text-[11px] uppercase tracking-wider text-sky-400 font-bold block">
              Planned Risk vs Actual Outcome
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-neutral-500 block text-[10px] uppercase">Planned Risk</span>
                <span className="text-white font-bold">${plannedDollarRisk.toFixed(2)}</span>
                <span className="text-neutral-500 block text-[10px]">({currentShares} sh @ ${riskPerShare.toFixed(2)}/sh)</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[10px] uppercase">Planned R:R</span>
                <span className="text-white font-bold">{trade.rrRatio?.toFixed(2) || "2.00"} : 1</span>
                <span className="text-neutral-500 block text-[10px]">(Target 1)</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[10px] uppercase">Actual Fill / Exit</span>
                <span className="text-white font-bold">${currentEntry.toFixed(2)} → ${currentExit.toFixed(2)}</span>
                <span className="text-neutral-500 block text-[10px]">({trade.closedDate ? new Date(trade.closedDate).toLocaleDateString() : "Closed"})</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[10px] uppercase">Final Campaign Return</span>
                <span className={`font-bold ${isWinner ? "text-emerald-400" : "text-rose-400"}`}>
                  {isWinner ? "+" : ""}${activePnL.toFixed(2)}
                </span>
                <span className="text-purple-300 font-bold block text-[10px]">
                  {isWinner ? "+" : ""}{calculatedRMultiple.toFixed(2)} R
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Visual 4-Tier Price Ladder at Exit */}
        <div className="space-y-2">
          <span className="text-[11px] font-mono uppercase text-neutral-400 block">
            Execution Price Ladder:
          </span>
          <PriceLadder
            entryTrigger={currentEntry}
            stopLoss={currentStop}
            target1={trade.target1}
            target2={trade.target2}
            currentPrice={currentExit}
            positionShares={currentShares}
            variant="full"
            showSizingBar={false}
          />
        </div>

        {/* Section 3: Notes & Trade Post-Mortem */}
        <div className="space-y-2">
          <label className="block text-xs font-mono uppercase text-neutral-400">
            Campaign Post-Mortem &amp; Notes
          </label>
          <textarea
            rows={3}
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="Document catalysts, lessons learned, or reason for early exit..."
            className="w-full rounded-2xl border border-white/10 bg-black/40 p-3.5 font-mono text-xs text-neutral-200 focus:outline-none focus:border-sky-500"
          />
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSaveChanges}
              disabled={saving}
              className="flex items-center space-x-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-neutral-900 shadow hover:bg-neutral-100 transition active:scale-95 disabled:opacity-50"
            >
              {saved ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 text-neutral-700" />
                  <span>Save Notes &amp; History</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
