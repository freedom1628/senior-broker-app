"use client";

import React from "react";
import { Trade } from "@/lib/storage/types";
import { playEntryTriggered } from "@/lib/audio/sounds";
import { Clock, Zap, XCircle, ArrowUpRight, CheckCircle2, AlertCircle } from "lucide-react";

export interface WatchOrderQueueProps {
  pendingTrades: Trade[];
  marketQuotes: Record<string, any>;
  onActivatePending: (tradeId: string, fillPrice?: number) => void;
  onDeleteTrade: (tradeId: string) => void;
}

export const WatchOrderQueue: React.FC<WatchOrderQueueProps> = ({
  pendingTrades,
  marketQuotes,
  onActivatePending,
  onDeleteTrade,
}) => {
  if (pendingTrades.length === 0) return null;

  const handleFillNow = (tradeId: string, currentPrice: number) => {
    playEntryTriggered();
    onActivatePending(tradeId, currentPrice);
  };

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-6 backdrop-blur-2xl shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/[0.06] pb-4 gap-2">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              Pending Watch Orders &amp; Breakout Triggers ({pendingTrades.length})
            </h3>
            <p className="text-xs text-neutral-400">
              Pre-staged orders with pre-calculated 1% risk sizing awaiting technical trigger confirmation
            </p>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {pendingTrades.map((pt) => {
          const quote = marketQuotes[pt.ticker.toUpperCase()];
          const current = quote?.price || pt.entryTrigger;
          const trigger = pt.entryTrigger;
          const distPct = ((trigger - current) / current) * 100;
          const isTriggerHit = current >= trigger;
          const riskPerShare = Math.max(0.01, trigger - pt.initialStop);
          const totalRisk = pt.sharesTotal * riskPerShare;

          return (
            <div
              key={pt.id}
              className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 text-xs font-mono transition ${
                isTriggerHit
                  ? "border-emerald-500/50 bg-emerald-500/[0.08] shadow-[0_0_20px_rgba(16,185,129,0.15)] animate-pulse"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
              }`}
            >
              {/* Left Column: Ticker & Plan */}
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-base font-bold text-white tracking-tight">
                    {pt.ticker}
                  </span>
                  <span className="text-neutral-400 font-sans">
                    {pt.companyName}
                  </span>
                  {pt.setupType && (
                    <span className="rounded-full bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[10px] text-sky-300 font-sans">
                      {pt.setupType}
                    </span>
                  )}
                  {isTriggerHit && (
                    <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-neutral-900 font-sans">
                      TRIGGER ACTIVATED
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-neutral-400 space-x-2">
                  <span>Trigger: <span className="text-white font-semibold">${trigger.toFixed(2)}</span></span>
                  <span>•</span>
                  <span>Stop: <span className="text-rose-400 font-semibold">${pt.initialStop.toFixed(2)}</span></span>
                  <span>•</span>
                  <span>Size: <span className="text-emerald-400 font-semibold">{pt.sharesTotal} sh</span> (${(pt.sharesTotal * trigger).toFixed(2)})</span>
                  <span>•</span>
                  <span>Risk: <span className="text-amber-400 font-semibold">${totalRisk.toFixed(2)}</span></span>
                </div>
              </div>

              {/* Right Column: Proximity & 1-Click Action */}
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-neutral-400 text-[11px]">
                    Current Tape: <span className="text-white font-semibold">${current.toFixed(2)}</span>
                  </div>
                  <div
                    className={`font-semibold text-xs ${
                      isTriggerHit
                        ? "text-emerald-400 font-bold"
                        : distPct > 0
                        ? "text-sky-400"
                        : "text-amber-400"
                    }`}
                  >
                    {isTriggerHit
                      ? "Crossed Trigger (Ready to fill)"
                      : `${Math.abs(distPct).toFixed(1)}% to trigger`}
                  </div>
                </div>

                {/* 1-Click Fill Entry Now Button */}
                <button
                  type="button"
                  onClick={() => handleFillNow(pt.id, current)}
                  className={`flex items-center space-x-1.5 rounded-full px-4 py-2 text-xs font-semibold shadow transition active:scale-95 ${
                    isTriggerHit
                      ? "bg-emerald-500 text-white hover:bg-emerald-400 shadow-emerald-500/20"
                      : "bg-white text-neutral-900 hover:bg-neutral-100"
                  }`}
                  title="Executes the planned order immediately and moves trade to active positions"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Fill Entry Now</span>
                </button>

                {/* Delete / Cancel Watch Order Button */}
                <button
                  type="button"
                  onClick={() => onDeleteTrade(pt.id)}
                  className="rounded-full p-1 text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  title="Cancel watch order"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WatchOrderQueue;
