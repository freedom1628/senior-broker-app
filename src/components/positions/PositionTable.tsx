"use client";

import React, { useState } from "react";
import { Trade } from "@/lib/storage/types";
import { TrendingUp, Shield, Clock, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { TacticalActionButtons } from "./TacticalActionButtons";

export interface PositionTableProps {
  activeTrades: Trade[];
  marketQuotes: Record<string, any>;
  accountSize?: number;
  onScaleT1: (tradeId: string, fillPrice?: number) => void;
  onUpdateStop: (tradeId: string, newStop: number) => void;
  onCloseTrade: (tradeId: string, exitReason: string, closePrice?: number) => void;
  onOpenAdjustStop?: (trade: Trade) => void;
}

type SortField = "ticker" | "pnl" | "r" | "sessions" | "risk";
type SortOrder = "asc" | "desc";

export const PositionTable: React.FC<PositionTableProps> = ({
  activeTrades,
  marketQuotes,
  accountSize = 15000,
  onScaleT1,
  onUpdateStop,
  onCloseTrade,
  onOpenAdjustStop,
}) => {
  const [sortField, setSortField] = useState<SortField>("pnl");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const sortedTrades = [...activeTrades].sort((a, b) => {
    const quoteA = marketQuotes[a.ticker.toUpperCase()];
    const quoteB = marketQuotes[b.ticker.toUpperCase()];
    const priceA = quoteA?.price || a.entryTrigger;
    const priceB = quoteB?.price || b.entryTrigger;
    const entryA = a.actualEntry || a.entryTrigger;
    const entryB = b.actualEntry || b.entryTrigger;
    const sharesA = a.sharesRemaining > 0 ? a.sharesRemaining : a.sharesTotal;
    const sharesB = b.sharesRemaining > 0 ? b.sharesRemaining : b.sharesTotal;
    const pnlA = (priceA - entryA) * sharesA;
    const pnlB = (priceB - entryB) * sharesB;

    const riskPerShareA = Math.max(0.01, Math.abs(entryA - a.initialStop));
    const riskPerShareB = Math.max(0.01, Math.abs(entryB - b.initialStop));
    const rA = (priceA - entryA) / riskPerShareA;
    const rB = (priceB - entryB) / riskPerShareB;

    const riskA = a.currentStop >= entryA ? 0 : (entryA - a.currentStop) * sharesA;
    const riskB = b.currentStop >= entryB ? 0 : (entryB - b.currentStop) * sharesB;

    let comp = 0;
    if (sortField === "ticker") comp = a.ticker.localeCompare(b.ticker);
    else if (sortField === "pnl") comp = pnlA - pnlB;
    else if (sortField === "r") comp = rA - rB;
    else if (sortField === "sessions") comp = (a.sessionsElapsed || 0) - (b.sessionsElapsed || 0);
    else if (sortField === "risk") comp = riskA - riskB;

    return sortOrder === "asc" ? comp : -comp;
  });

  return (
    <div className="overflow-x-auto rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 backdrop-blur-2xl shadow-xl">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-white/[0.06] bg-white/[0.02] text-neutral-400 font-mono uppercase text-[11px] tracking-wider">
          <tr>
            <th
              className="px-5 py-4 cursor-pointer hover:text-white transition"
              onClick={() => toggleSort("ticker")}
            >
              <div className="flex items-center space-x-1">
                <span>Ticker / Setup</span>
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </th>
            <th className="px-4 py-4">Status &amp; Shares</th>
            <th className="px-4 py-4">Fill &amp; Tape</th>
            <th className="px-4 py-4">Stop &amp; Target 1</th>
            <th
              className="px-4 py-4 cursor-pointer hover:text-white transition"
              onClick={() => toggleSort("pnl")}
            >
              <div className="flex items-center space-x-1">
                <span>Floating P&amp;L</span>
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </th>
            <th
              className="px-4 py-4 cursor-pointer hover:text-white transition"
              onClick={() => toggleSort("r")}
            >
              <div className="flex items-center space-x-1">
                <span>R-Multiple</span>
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </th>
            <th
              className="px-4 py-4 cursor-pointer hover:text-white transition"
              onClick={() => toggleSort("sessions")}
            >
              <div className="flex items-center space-x-1">
                <span>Sessions</span>
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </th>
            <th
              className="px-4 py-4 cursor-pointer hover:text-white transition"
              onClick={() => toggleSort("risk")}
            >
              <div className="flex items-center space-x-1">
                <span>Open Risk</span>
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </th>
            <th className="px-5 py-4 text-right">Tactical Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04] font-mono">
          {sortedTrades.map((trade) => {
            const quote = marketQuotes[trade.ticker.toUpperCase()];
            const currentPrice = quote?.price || trade.entryTrigger;
            const entry = trade.actualEntry || trade.entryTrigger;
            const riskPerShare = Math.max(0.01, Math.abs(entry - trade.initialStop));
            const remainingShares = trade.sharesRemaining > 0 ? trade.sharesRemaining : trade.sharesTotal;

            const unrealizedPnL = (currentPrice - entry) * remainingShares;
            const unrealizedPct = ((currentPrice - entry) / entry) * 100;
            const currentR = (currentPrice - entry) / riskPerShare;

            const isScaled = trade.status === "SCALED_T1";
            const isBreakevenStop = trade.currentStop >= entry;

            const openRiskDollars = isBreakevenStop
              ? 0.0
              : Math.max(0, (entry - trade.currentStop) * remainingShares);

            const sessions = trade.sessionsElapsed || 0;
            const maxSessions = trade.timeStopSessions || 6;
            const isExpired = sessions >= maxSessions;
            const isStagnant = sessions >= 5 && sessions < maxSessions;

            return (
              <tr key={trade.id} className="hover:bg-white/[0.02] transition">
                {/* Ticker & Setup */}
                <td className="px-5 py-4">
                  <div className="font-bold text-white text-sm">{trade.ticker}</div>
                  <div className="text-[10px] text-neutral-400 font-sans truncate max-w-[120px]">
                    {trade.companyName}
                  </div>
                  {trade.setupType && (
                    <div className="text-[9px] text-sky-400 font-sans mt-0.5">
                      {trade.setupType}
                    </div>
                  )}
                </td>

                {/* Status & Shares */}
                <td className="px-4 py-4">
                  {isScaled ? (
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-bold text-emerald-300 block w-fit mb-1">
                      SCALED T1 (B/E)
                    </span>
                  ) : (
                    <span className="rounded-full bg-sky-500/20 border border-sky-500/30 px-2 py-0.5 text-[9px] font-bold text-sky-300 block w-fit mb-1">
                      ACTIVE
                    </span>
                  )}
                  <span className="text-neutral-300 font-semibold">{remainingShares}</span>
                  <span className="text-neutral-500"> / {trade.sharesTotal} sh</span>
                </td>

                {/* Fill & Tape */}
                <td className="px-4 py-4">
                  <div className="text-neutral-300">Fill: <span className="text-white font-semibold">${entry.toFixed(2)}</span></div>
                  <div className="text-sky-300 font-bold">Tape: ${currentPrice.toFixed(2)}</div>
                </td>

                {/* Stop & Target 1 */}
                <td className="px-4 py-4">
                  <div className="text-rose-400">Stop: ${trade.currentStop.toFixed(2)}</div>
                  <div className="text-emerald-400">T1: ${trade.target1.toFixed(2)}</div>
                </td>

                {/* Floating P&L */}
                <td className="px-4 py-4">
                  <div
                    className={`font-bold text-sm ${
                      unrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {unrealizedPnL >= 0 ? "+" : ""}${unrealizedPnL.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-neutral-400">
                    {unrealizedPct >= 0 ? "+" : ""}{unrealizedPct.toFixed(2)}%
                  </div>
                </td>

                {/* R-Multiple */}
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      currentR >= 2.0
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : currentR >= 0
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {currentR >= 0 ? "+" : ""}{currentR.toFixed(2)} R
                  </span>
                </td>

                {/* Sessions */}
                <td className="px-4 py-4">
                  <span
                    className={`flex items-center space-x-1 ${
                      isExpired
                        ? "text-rose-400 font-bold"
                        : isStagnant
                        ? "text-amber-400 font-medium"
                        : "text-neutral-300"
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    <span>{sessions}/{maxSessions}</span>
                  </span>
                </td>

                {/* Open Risk */}
                <td className="px-4 py-4">
                  {isBreakevenStop ? (
                    <span className="text-emerald-400 font-semibold">$0.00 (B/E)</span>
                  ) : (
                    <span className="text-amber-400">${openRiskDollars.toFixed(2)}</span>
                  )}
                </td>

                {/* Tactical Actions */}
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end space-x-1.5">
                    {!isScaled && (
                      <button
                        onClick={() => onScaleT1(trade.id, currentPrice)}
                        className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/30 transition active:scale-95"
                        title="Scale 50% at Target 1 and raise stop to Breakeven"
                      >
                        Scale 50%
                      </button>
                    )}
                    {onOpenAdjustStop && (
                      <button
                        onClick={() => onOpenAdjustStop(trade)}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-neutral-300 hover:bg-white/[0.08] transition"
                        title="Adjust or trail stop loss upward"
                      >
                        Stop
                      </button>
                    )}
                    <button
                      onClick={() => onCloseTrade(trade.id, "MANUAL", currentPrice)}
                      className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-500/20 transition active:scale-95"
                      title="Close position"
                    >
                      Close
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PositionTable;
