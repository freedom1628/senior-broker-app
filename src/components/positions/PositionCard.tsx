"use client";

import React from "react";
import { Trade } from "@/lib/storage/types";
import { PriceLadder } from "@/components/dashboard/PriceLadder";
import { TacticalActionButtons } from "./TacticalActionButtons";
import { Clock, Shield, AlertTriangle, TrendingUp, Info } from "lucide-react";

export interface PositionCardProps {
  trade: Trade;
  currentPrice: number;
  accountSize?: number;
  onScaleT1: (tradeId: string, fillPrice?: number) => void;
  onUpdateStop: (tradeId: string, newStop: number) => void;
  onCloseTrade: (tradeId: string, exitReason: string, closePrice?: number) => void;
  onOpenAdjustStop?: (trade: Trade) => void;
}

export const PositionCard: React.FC<PositionCardProps> = ({
  trade,
  currentPrice,
  accountSize = 15000,
  onScaleT1,
  onUpdateStop,
  onCloseTrade,
  onOpenAdjustStop,
}) => {
  const entry = trade.actualEntry || trade.entryTrigger;
  const riskPerShare = Math.max(0.01, Math.abs(entry - trade.initialStop));
  const remainingShares = trade.sharesRemaining > 0 ? trade.sharesRemaining : trade.sharesTotal;

  const unrealizedPnL = (currentPrice - entry) * remainingShares;
  const unrealizedPct = ((currentPrice - entry) / entry) * 100;
  const currentR = (currentPrice - entry) / riskPerShare;

  const isScaled = trade.status === "SCALED_T1";
  const isBreakevenStop = trade.currentStop >= entry;

  // Open risk calculation: $0 if stop >= entry
  const openRiskDollars = isBreakevenStop
    ? 0.0
    : Math.max(0, (entry - trade.currentStop) * remainingShares);
  const openRiskPct = (openRiskDollars / accountSize) * 100;

  const distToStop = ((currentPrice - trade.currentStop) / currentPrice) * 100;
  const distToT1 = ((trade.target1 - currentPrice) / currentPrice) * 100;

  const sessions = trade.sessionsElapsed || 0;
  const maxSessions = trade.timeStopSessions || 6;
  const isStagnant = sessions >= 5 && sessions < maxSessions;
  const isExpired = sessions >= maxSessions;

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-5 sm:p-6 backdrop-blur-2xl shadow-xl hover:border-white/[0.15] transition space-y-4">
      {/* Header Row */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="font-mono text-xl font-bold tracking-tight text-white">
              {trade.ticker}
            </span>
            {isScaled ? (
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                T1 SCALED • B/E STOP
              </span>
            ) : (
              <span className="rounded-full bg-sky-500/20 border border-sky-500/30 px-2.5 py-0.5 text-[10px] font-bold text-sky-300">
                ACTIVE
              </span>
            )}
            {trade.setupType && (
              <span className="hidden sm:inline-block rounded-full bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 text-[10px] text-neutral-400">
                {trade.setupType}
              </span>
            )}
          </div>
          <div className="text-xs text-neutral-400 mt-1">
            {trade.companyName} • <span className="text-neutral-300 font-mono font-medium">{remainingShares}</span> of {trade.sharesTotal} shares
            {trade.realizedPnL && trade.realizedPnL > 0 ? (
              <span className="ml-1 text-emerald-400 font-mono">
                (Banked +${trade.realizedPnL.toFixed(2)})
              </span>
            ) : null}
          </div>
        </div>

        {/* Floating P&L and R-Multiple Header Badges */}
        <div className="text-right">
          <div
            className={`font-mono text-lg font-bold tracking-tight ${
              unrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {unrealizedPnL >= 0 ? "+" : ""}${unrealizedPnL.toFixed(2)}{" "}
            <span className="text-xs font-normal opacity-80">
              ({unrealizedPct >= 0 ? "+" : ""}{unrealizedPct.toFixed(2)}%)
            </span>
          </div>
          <div className="flex items-center justify-end space-x-1.5 mt-0.5">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
                currentR >= 2.0
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : currentR >= 0
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
              }`}
            >
              {currentR >= 0 ? "+" : ""}{currentR.toFixed(2)} R
            </span>
          </div>
        </div>
      </div>

      {/* Execution Levels Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-2xl bg-black/50 border border-white/[0.06] p-3 text-xs font-mono">
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
          <span className="text-[10px] uppercase text-neutral-500 block">Target 1 (+2.0R)</span>
          <span className="text-emerald-400 font-bold">${trade.target1.toFixed(2)}</span>
        </div>
      </div>

      {/* Embedded Compact Price Ladder */}
      <PriceLadder
        entryTrigger={entry}
        stopLoss={trade.currentStop}
        target1={trade.target1}
        target2={trade.target2}
        currentPrice={currentPrice}
        positionShares={remainingShares}
        variant="compact"
        showSizingBar={false}
      />

      {/* Risk & Time-Stop Status Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-neutral-400 pt-1">
        {/* Session Countdown */}
        <div className="flex items-center space-x-1.5">
          <Clock
            className={`h-3.5 w-3.5 ${
              isExpired
                ? "text-rose-400 animate-pulse"
                : isStagnant
                ? "text-amber-400"
                : "text-emerald-400"
            }`}
          />
          <span
            className={
              isExpired
                ? "text-rose-300 font-bold"
                : isStagnant
                ? "text-amber-300 font-medium"
                : "text-neutral-300"
            }
          >
            Session {sessions} of {maxSessions} {isExpired ? "(Time Stop Expired)" : isStagnant ? "(Stale Warning)" : ""}
          </span>
        </div>

        {/* Open Risk Gauge */}
        <div className="flex items-center space-x-2">
          {isBreakevenStop ? (
            <span className="flex items-center space-x-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400 font-semibold">
              <Shield className="h-3 w-3" />
              <span>$0.00 Open Risk (B/E Protected)</span>
            </span>
          ) : (
            <span className="text-amber-400">
              Open Risk: ${openRiskDollars.toFixed(2)} ({openRiskPct.toFixed(2)}%)
            </span>
          )}
        </div>
      </div>

      {/* Thesis / Notes if present */}
      {trade.notes && (
        <div className="text-xs text-neutral-400 font-sans italic bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.04]">
          &ldquo;{trade.notes}&rdquo;
        </div>
      )}

      {/* Tactical 1-Click Action Buttons Strip */}
      <TacticalActionButtons
        trade={trade}
        currentPrice={currentPrice}
        onScaleT1={onScaleT1}
        onUpdateStop={onUpdateStop}
        onCloseTrade={onCloseTrade}
        onOpenAdjustStop={onOpenAdjustStop}
      />
    </div>
  );
};

export default PositionCard;
