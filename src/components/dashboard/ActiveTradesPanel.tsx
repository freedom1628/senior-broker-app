"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Percent,
  CheckCircle,
  XCircle,
  Edit2,
  DollarSign,
  ArrowRight,
} from "lucide-react";

interface ActiveTradesPanelProps {
  activeTrades: any[];
  pendingTrades: any[];
  marketQuotes: Record<string, any>;
  onScaleT1: (tradeId: string, fillPrice?: number) => void;
  onUpdateStop: (tradeId: string, newStop: number) => void;
  onCloseTrade: (tradeId: string, exitReason: string, closePrice?: number) => void;
  onActivatePending: (tradeId: string, fillPrice?: number) => void;
  onDeleteTrade: (tradeId: string) => void;
  onOpenAddTrade?: () => void;
}

export const ActiveTradesPanel: React.FC<ActiveTradesPanelProps> = ({
  activeTrades,
  pendingTrades,
  marketQuotes,
  onScaleT1,
  onUpdateStop,
  onCloseTrade,
  onActivatePending,
  onDeleteTrade,
  onOpenAddTrade,
}) => {
  const [selectedTrade, setSelectedTrade] = useState<any | null>(null);
  const [editStopModal, setEditStopModal] = useState<{ trade: any; stopPrice: string } | null>(null);

  return (
    <div className="space-y-6">
      
      {/* Active Positions Section */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-6 backdrop-blur-2xl shadow-xl">
        <div className="flex flex-wrap items-center justify-between border-b border-white/[0.06] pb-4 mb-6 gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <span>Live Open Positions ({activeTrades.length})</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Continuously monitored with real-time stops, profit thresholds, and session countdowns
            </p>
          </div>

          {onOpenAddTrade && (
            <button
              onClick={onOpenAddTrade}
              className="flex items-center space-x-1.5 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-400 transition active:scale-95"
            >
              <span>+ Add Position</span>
            </button>
          )}
        </div>

        {activeTrades.length === 0 ? (
          <div className="py-12 text-center text-neutral-400 space-y-3">
            <p className="text-sm">No active positions logged yet.</p>
            {onOpenAddTrade && (
              <button
                onClick={onOpenAddTrade}
                className="inline-flex items-center space-x-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
              >
                <span>+ Log Your First Swing Position</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeTrades.map((trade) => {
              const quote = marketQuotes[trade.ticker.toUpperCase()];
              const currentPrice = quote?.price || trade.entryTrigger;
              const entry = trade.actualEntry || trade.entryTrigger;
              const riskPerShare = Math.max(0.01, Math.abs(entry - trade.initialStop));

              const unrealizedPnL = (currentPrice - entry) * trade.sharesRemaining;
              const unrealizedPct = ((currentPrice - entry) / entry) * 100;
              const currentR = (currentPrice - entry) / riskPerShare;

              const isScaled = trade.status === "SCALED_T1";
              const isBreakevenStop = trade.currentStop >= entry;

              const distToStop = ((currentPrice - trade.currentStop) / currentPrice) * 100;
              const distToT1 = ((trade.target1 - currentPrice) / currentPrice) * 100;

              return (
                <div
                  key={trade.id}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 hover:border-white/[0.15] transition space-y-4"
                >
                  {/* Trade Card Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xl font-bold text-white">
                          {trade.ticker}
                        </span>
                        {isScaled ? (
                          <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            T1 SCALED (B/E STOP)
                          </span>
                        ) : (
                          <span className="rounded-full bg-sky-500/20 border border-sky-500/30 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        {trade.sharesRemaining} of {trade.sharesTotal} shares remaining
                      </div>
                    </div>

                    {/* Unrealized P&L Badge */}
                    <div className="text-right">
                      <div
                        className={`font-mono text-base font-bold ${
                          unrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {unrealizedPnL >= 0 ? "+" : ""}${unrealizedPnL.toFixed(2)} ({unrealizedPct >= 0 ? "+" : ""}{unrealizedPct.toFixed(2)}%)
                      </div>
                      <div className="font-mono text-xs text-neutral-400">
                        {currentR >= 0 ? "+" : ""}{currentR.toFixed(2)} R
                      </div>
                    </div>
                  </div>

                  {/* Execution Levels Strip */}
                  <div className="grid grid-cols-4 gap-2 rounded-xl bg-black/40 border border-white/[0.06] p-3 text-xs font-mono">
                    <div>
                      <span className="text-[10px] uppercase text-neutral-500 block">Entry Fill</span>
                      <span className="text-white font-bold">${entry.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-neutral-500 block">Current Tape</span>
                      <span className="text-sky-300 font-bold">${currentPrice.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-neutral-500 block">Stop Level</span>
                      <span className="text-rose-400 font-bold">${trade.currentStop.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-neutral-500 block">Target 1</span>
                      <span className="text-emerald-400 font-bold">${trade.target1.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Safety & Time Stop Bar */}
                  <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="h-3.5 w-3.5 text-amber-400" />
                      <span>Session {trade.sessionsElapsed} of {trade.timeStopSessions} max</span>
                    </div>
                    <div>
                      <span>Stop Buffer: </span>
                      <span className="text-rose-400 font-semibold">{distToStop.toFixed(1)}% away</span>
                    </div>
                  </div>

                  {/* Trade Action Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                    <div className="flex items-center space-x-2">
                      {!isScaled && (
                        <button
                          onClick={() => onScaleT1(trade.id, currentPrice)}
                          className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition active:scale-95"
                        >
                          Scale 50% at T1 &amp; Move to B/E
                        </button>
                      )}

                      <button
                        onClick={() => setEditStopModal({ trade, stopPrice: trade.currentStop.toString() })}
                        className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-xs text-neutral-300 hover:bg-white/[0.08] transition"
                      >
                        Adjust Stop
                      </button>
                    </div>

                    <button
                      onClick={() => onCloseTrade(trade.id, "MANUAL", currentPrice)}
                      className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition active:scale-95"
                    >
                      Close Position
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending Watch Orders Section */}
      {pendingTrades.length > 0 && (
        <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-6 backdrop-blur-2xl shadow-xl">
          <div className="border-b border-white/[0.06] pb-4 mb-4">
            <h3 className="text-base font-semibold text-white">
              Pending Entry Orders &amp; Watch Triggers ({pendingTrades.length})
            </h3>
            <p className="text-xs text-neutral-400">
              Orders awaiting breakout or pullback trigger confirmation before activating
            </p>
          </div>

          <div className="space-y-3">
            {pendingTrades.map((pt) => {
              const quote = marketQuotes[pt.ticker.toUpperCase()];
              const current = quote?.price || pt.entryTrigger;
              const dist = ((pt.entryTrigger - current) / current) * 100;

              return (
                <div
                  key={pt.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs font-mono"
                >
                  <div>
                    <span className="text-sm font-bold text-white mr-2">{pt.ticker}</span>
                    <span className="text-neutral-400">{pt.companyName}</span>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      Trigger: ${pt.entryTrigger.toFixed(2)} • Size: {pt.sharesTotal} shares • Stop: ${pt.initialStop.toFixed(2)}
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <span className="text-neutral-400 block">Tape: ${current.toFixed(2)}</span>
                      <span className="text-sky-400 font-semibold">{Math.abs(dist).toFixed(1)}% to trigger</span>
                    </div>

                    <button
                      onClick={() => onActivatePending(pt.id, current)}
                      className="rounded-full bg-white px-3 py-1.5 font-sans font-semibold text-neutral-900 shadow-sm hover:bg-neutral-100 transition active:scale-95"
                    >
                      Fill Entry Now
                    </button>

                    <button
                      onClick={() => onDeleteTrade(pt.id)}
                      className="text-neutral-500 hover:text-rose-400 transition"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Stop Loss Modal */}
      {editStopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#121622] p-6 space-y-4 shadow-2xl">
            <h4 className="text-base font-semibold text-white">
              Adjust Stop Loss — {editStopModal.trade.ticker}
            </h4>
            <p className="text-xs text-neutral-400">
              Never widen a stop lower than initial entry risk. Tighten or trail stop upward only.
            </p>
            <input
              type="number"
              step="0.05"
              value={editStopModal.stopPrice}
              onChange={(e) => setEditStopModal({ ...editStopModal, stopPrice: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-2 font-mono text-white focus:outline-none focus:border-sky-500"
            />
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setEditStopModal(null)}
                className="rounded-full px-4 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onUpdateStop(editStopModal.trade.id, parseFloat(editStopModal.stopPrice));
                  setEditStopModal(null);
                }}
                className="rounded-full bg-sky-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-400"
              >
                Save Stop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
