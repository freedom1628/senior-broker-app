"use client";

import React, { useState } from "react";
import { Trade } from "@/lib/storage/types";
import { playTargetChime, playStopLossAlert } from "@/lib/audio/sounds";
import { TrendingUp, Shield, XCircle, ArrowUpRight, Clock, AlertTriangle } from "lucide-react";

export interface TacticalActionButtonsProps {
  trade: Trade;
  currentPrice: number;
  onScaleT1: (tradeId: string, fillPrice?: number) => void;
  onUpdateStop: (tradeId: string, newStop: number) => void;
  onCloseTrade: (tradeId: string, exitReason: string, closePrice?: number) => void;
  onOpenAdjustStop?: (trade: Trade) => void;
}

export const TacticalActionButtons: React.FC<TacticalActionButtonsProps> = ({
  trade,
  currentPrice,
  onScaleT1,
  onUpdateStop,
  onCloseTrade,
  onOpenAdjustStop,
}) => {
  const [isConfirmingExit, setIsConfirmingExit] = useState(false);
  const isScaled = trade.status === "SCALED_T1";
  const entry = trade.actualEntry || trade.entryTrigger;
  const isStale = (trade.sessionsElapsed || 0) >= (trade.timeStopSessions || 6) - 1;
  const isExpired = (trade.sessionsElapsed || 0) >= (trade.timeStopSessions || 6);

  const handleScaleClick = () => {
    playTargetChime();
    onScaleT1(trade.id, currentPrice);
  };

  const handleStaleExitClick = () => {
    onCloseTrade(trade.id, "TIME_STOP_EXIT", currentPrice);
    setIsConfirmingExit(false);
  };

  const handleStandardCloseClick = () => {
    onCloseTrade(trade.id, "MANUAL", currentPrice);
    setIsConfirmingExit(false);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/[0.06]">
      <div className="flex flex-wrap items-center gap-2">
        {/* Action 1: Scale 50% & Move Stop to Breakeven */}
        {!isScaled && (
          <button
            type="button"
            onClick={handleScaleClick}
            className="flex items-center space-x-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 hover:border-emerald-500/60 transition active:scale-95 shadow-sm"
            title="Sells 50% of position at market and automatically raises stop to Breakeven"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Scale 50% &amp; Move to B/E</span>
          </button>
        )}

        {/* Action 2: Adjust / Trail Stop Loss */}
        {onOpenAdjustStop && (
          <button
            type="button"
            onClick={() => onOpenAdjustStop(trade)}
            className="flex items-center space-x-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-white/[0.08] hover:border-white/[0.2] transition active:scale-95"
            title="Tighten stop loss or trail upward under swing lows"
          >
            <Shield className="h-3.5 w-3.5 text-sky-400" />
            <span>Adjust Stop</span>
          </button>
        )}

        {/* Action 3: Exit Stale Position (Highlighted when session count >= 5) */}
        {isStale && (
          <button
            type="button"
            onClick={handleStaleExitClick}
            className={`flex items-center space-x-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 border ${
              isExpired
                ? "bg-rose-500/20 border-rose-500/50 text-rose-300 hover:bg-rose-500/30 animate-pulse"
                : "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
            }`}
            title="Liquidates remaining shares due to time-stop expiration and recycles capital"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Exit Stale ({trade.sessionsElapsed}s)</span>
          </button>
        )}
      </div>

      {/* Action 4: Close Position with Confirmation */}
      <div>
        {isConfirmingExit ? (
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] text-neutral-400">Close at ${currentPrice.toFixed(2)}?</span>
            <button
              type="button"
              onClick={handleStandardCloseClick}
              className="rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-600 transition"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmingExit(false)}
              className="rounded-full bg-white/[0.08] px-2 py-1 text-[11px] text-neutral-300 hover:bg-white/[0.15]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsConfirmingExit(true)}
            className="flex items-center space-x-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition active:scale-95"
            title="Liquidate position at current market price"
          >
            <XCircle className="h-3.5 w-3.5" />
            <span>Close Position</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default TacticalActionButtons;
