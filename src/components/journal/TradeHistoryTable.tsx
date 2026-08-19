"use client";

import React, { useState } from "react";
import { Trade } from "@/lib/storage/types";
import { BookOpen, ShieldCheck, ArrowUpDown, ChevronRight, Clock, Award } from "lucide-react";

export interface TradeHistoryTableProps {
  closedTrades: Trade[];
  onSelectTrade: (trade: Trade) => void;
}

type SortCol = "date" | "ticker" | "pnl" | "r" | "sessions";

export const TradeHistoryTable: React.FC<TradeHistoryTableProps> = ({
  closedTrades = [],
  onSelectTrade,
}) => {
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortAsc, setSortAsc] = useState(false);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(false);
    }
  };

  const sortedTrades = [...closedTrades].sort((a, b) => {
    let comp = 0;
    if (sortCol === "date") {
      const dateA = a.closedDate || a.createdAt || "";
      const dateB = b.closedDate || b.createdAt || "";
      comp = dateA.localeCompare(dateB);
    } else if (sortCol === "ticker") {
      comp = a.ticker.localeCompare(b.ticker);
    } else if (sortCol === "pnl") {
      comp = (a.realizedPnL || 0) - (b.realizedPnL || 0);
    } else if (sortCol === "r") {
      comp = (a.rMultiple || 0) - (b.rMultiple || 0);
    } else if (sortCol === "sessions") {
      comp = (a.sessionsElapsed || 0) - (b.sessionsElapsed || 0);
    }
    return sortAsc ? comp : -comp;
  });

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 backdrop-blur-2xl shadow-xl overflow-hidden">
      <div className="border-b border-white/[0.06] p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center space-x-2">
            <BookOpen className="h-5 w-5 text-sky-400" />
            <span>Closed Campaign History Log ({closedTrades.length})</span>
          </h3>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">
            Click any row or details button to open institutional post-mortem and review lessons
          </p>
        </div>
      </div>

      {closedTrades.length === 0 ? (
        <div className="py-16 text-center text-neutral-500 text-sm font-mono space-y-2">
          <BookOpen className="h-8 w-8 text-neutral-600 mx-auto" />
          <p>No closed trades matching current filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/[0.06] bg-white/[0.02] text-neutral-400 font-mono uppercase text-[11px] tracking-wider">
              <tr>
                <th
                  className="px-6 py-4 cursor-pointer hover:text-white transition"
                  onClick={() => toggleSort("ticker")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Ticker &amp; Setup</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-4">Entry &amp; Stop</th>
                <th className="px-4 py-4">Exit Fill</th>
                <th
                  className="px-4 py-4 cursor-pointer hover:text-white transition"
                  onClick={() => toggleSort("pnl")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Realized P&amp;L</span>
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
                <th className="px-4 py-4">Exit Reason</th>
                <th className="px-6 py-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] font-mono">
              {sortedTrades.map((t) => {
                const entry = t.actualEntry || t.entryTrigger;
                const exit = t.closedPrice || entry;
                const pnl = t.realizedPnL || 0;
                const isWin = pnl >= 0;

                return (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTrade(t)}
                    className="hover:bg-white/[0.03] transition cursor-pointer group"
                  >
                    {/* Ticker & Setup */}
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-sm">{t.ticker}</span>
                        <span title="Discipline Honored">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        </span>
                      </div>
                      <div className="text-[10px] font-sans text-neutral-400 truncate max-w-[130px]">
                        {t.companyName}
                      </div>
                      {t.setupType && (
                        <div className="text-[9px] font-sans text-sky-400 mt-0.5">
                          {t.setupType}
                        </div>
                      )}
                    </td>

                    {/* Entry & Stop */}
                    <td className="px-4 py-4 text-neutral-300">
                      <div>Fill: ${entry.toFixed(2)}</div>
                      <div className="text-[10px] text-rose-400">Stop: ${t.initialStop.toFixed(2)}</div>
                    </td>

                    {/* Exit Fill */}
                    <td className="px-4 py-4 text-white font-bold">
                      ${t.closedPrice ? t.closedPrice.toFixed(2) : exit.toFixed(2)}
                    </td>

                    {/* Realized P&L */}
                    <td className="px-4 py-4">
                      <span
                        className={`font-bold text-sm ${
                          isWin ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {isWin ? "+" : ""}${pnl.toFixed(2)}
                      </span>
                    </td>

                    {/* R-Multiple */}
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          (t.rMultiple || 0) >= 2.0
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : isWin
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {t.rMultiple !== undefined && t.rMultiple !== null
                          ? `${t.rMultiple >= 0 ? "+" : ""}${t.rMultiple.toFixed(2)} R`
                          : "--"}
                      </span>
                    </td>

                    {/* Sessions */}
                    <td className="px-4 py-4 text-neutral-300">
                      <span className="flex items-center space-x-1">
                        <Clock className="h-3 w-3 text-neutral-400" />
                        <span>{t.sessionsElapsed || 0} / {t.timeStopSessions || 6}</span>
                      </span>
                    </td>

                    {/* Exit Reason */}
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-white/[0.04] border border-white/[0.08] px-2.5 py-1 text-[10px] font-sans text-neutral-300">
                        {t.exitReason || "MANUAL"}
                      </span>
                    </td>

                    {/* Details Arrow */}
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTrade(t);
                        }}
                        className="inline-flex items-center space-x-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-300 group-hover:bg-white group-hover:text-neutral-900 transition"
                      >
                        <span>Post-Mortem</span>
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TradeHistoryTable;
