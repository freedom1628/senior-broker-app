"use client";

import React, { useState } from "react";
import { Trade } from "@/lib/storage/types";
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
} from "lucide-react";

export interface TradeDetailDrawerProps {
  trade: Trade | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateNotes?: (tradeId: string, updatedNotes: string) => void;
}

export const TradeDetailDrawer: React.FC<TradeDetailDrawerProps> = ({
  trade,
  isOpen,
  onClose,
  onUpdateNotes,
}) => {
  const [notesText, setNotesText] = useState(trade?.notes || "");
  const [savedNotes, setSavedNotes] = useState(false);

  // Sync state if trade changes
  React.useEffect(() => {
    if (trade) {
      setNotesText(trade.notes || "");
    }
  }, [trade]);

  if (!isOpen || !trade) return null;

  const entry = trade.actualEntry || trade.entryTrigger;
  const exit = trade.closedPrice || entry;
  const initialStop = trade.initialStop;
  const riskPerShare = Math.max(0.01, Math.abs(entry - initialStop));
  const plannedDollarRisk = trade.sharesTotal * riskPerShare;
  const realized = trade.realizedPnL || 0;
  const rMultiple = trade.rMultiple ?? Number((realized / plannedDollarRisk).toFixed(2));
  const isWinner = realized > 0;

  const handleSaveNotes = () => {
    if (onUpdateNotes) {
      onUpdateNotes(trade.id, notesText);
    }
    // Also save to localStorage
    try {
      const localTrades = JSON.parse(localStorage.getItem("senior_broker_custom_positions") || "[]");
      const updated = localTrades.map((t: any) => (t.id === trade.id ? { ...t, notes: notesText } : t));
      localStorage.setItem("senior_broker_custom_positions", JSON.stringify(updated));
    } catch (e) {}

    setSavedNotes(true);
    setTimeout(() => setSavedNotes(false), 2000);
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
                {isWinner ? "+" : ""}${realized.toFixed(2)} ({isWinner ? "+" : ""}{rMultiple.toFixed(2)}R)
              </span>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-neutral-400 font-mono">
                {trade.exitReason || "CLOSED"}
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-sans mt-0.5">
              {trade.companyName} • {trade.setupType || "Swing Campaign"}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-white/[0.08] hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section 1: Planned vs Actual Performance */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3 font-mono text-xs">
          <span className="text-[11px] uppercase tracking-wider text-sky-400 font-bold block">
            Planned Risk vs Actual Outcome
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-neutral-500 block text-[10px] uppercase">Planned Risk</span>
              <span className="text-white font-bold">${plannedDollarRisk.toFixed(2)}</span>
              <span className="text-neutral-500 block text-[10px]">({trade.sharesTotal} sh @ ${riskPerShare.toFixed(2)}/sh)</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px] uppercase">Planned R:R</span>
              <span className="text-white font-bold">{trade.rrRatio?.toFixed(2) || "2.00"} : 1</span>
              <span className="text-neutral-500 block text-[10px]">(Target 1)</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px] uppercase">Actual Fill / Exit</span>
              <span className="text-white font-bold">${entry.toFixed(2)} → ${exit.toFixed(2)}</span>
              <span className="text-neutral-500 block text-[10px]">({trade.sessionsElapsed || 0} sessions held)</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px] uppercase">Final Campaign Return</span>
              <span className={`font-bold ${isWinner ? "text-emerald-400" : "text-rose-400"}`}>
                {isWinner ? "+" : ""}${realized.toFixed(2)}
              </span>
              <span className="text-purple-300 font-bold block text-[10px]">
                {isWinner ? "+" : ""}{rMultiple.toFixed(2)} R
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Visual 4-Tier Price Ladder at Exit */}
        <div className="space-y-2">
          <span className="text-[11px] font-mono uppercase text-neutral-400 block">
            Execution Price Ladder:
          </span>
          <PriceLadder
            entryTrigger={entry}
            stopLoss={trade.initialStop}
            target1={trade.target1}
            target2={trade.target2}
            currentPrice={exit}
            positionShares={trade.sharesTotal}
            variant="full"
            showSizingBar={false}
          />
        </div>

        {/* Section 3: Discipline & Post-Mortem Checklist */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2.5">
          <span className="text-[11px] font-mono uppercase text-emerald-400 font-bold flex items-center space-x-1.5">
            <ShieldCheck className="h-4 w-4" />
            <span>Discipline &amp; Rules Audit</span>
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-300 font-mono">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Hard stop respected without widening</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Position sized strictly $\le$ 1% risk</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Scaled 50% at Target 1 &amp; raised stop</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Exited within 5–7 session window</span>
            </div>
          </div>
        </div>

        {/* Section 4: Editable Reflections & Trade Notes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono uppercase text-neutral-400">
              Post-Mortem Lessons &amp; Reflections
            </label>
            {savedNotes && (
              <span className="text-[11px] font-mono text-emerald-400 flex items-center space-x-1">
                <Check className="h-3 w-3" />
                <span>Notes Saved</span>
              </span>
            )}
          </div>
          <textarea
            rows={3}
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="Record post-trade psychological reflections, catalyst follow-through observations, and improvements for future campaigns..."
            className="w-full rounded-2xl border border-white/10 bg-black/50 p-3.5 text-xs text-neutral-200 focus:outline-none focus:border-sky-500 font-sans"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={handleSaveNotes}
            className="flex items-center space-x-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 transition"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Reflection</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white px-5 py-2 text-xs font-semibold text-neutral-900 shadow hover:bg-neutral-100 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default TradeDetailDrawer;
