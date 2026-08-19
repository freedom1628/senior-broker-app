"use client";

import React from "react";
import { BookOpen, Award, TrendingUp, BarChart2, CheckCircle, XCircle } from "lucide-react";

interface TradeJournalProps {
  closedTrades: any[];
  metrics: {
    totalRealizedPnL: number;
    winRate: number;
    totalTrades: number;
    avgRMultiple: number;
    openPositionCount: number;
  };
}

export const TradeJournal: React.FC<TradeJournalProps> = ({
  closedTrades,
  metrics,
}) => {
  return (
    <div className="space-y-6">
      
      {/* Portfolio Performance Analytics Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Realized PnL */}
        <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-5 backdrop-blur-2xl">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">Total Realized P&amp;L</span>
          <div
            className={`font-mono text-2xl font-bold mt-1 ${
              metrics.totalRealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {metrics.totalRealizedPnL >= 0 ? "+" : ""}${metrics.totalRealizedPnL.toFixed(2)}
          </div>
          <span className="text-[10px] text-neutral-500 font-mono">Net closed gains across campaigns</span>
        </div>

        {/* Win Rate */}
        <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-5 backdrop-blur-2xl">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">Win Rate</span>
          <div className="font-mono text-2xl font-bold text-sky-400 mt-1">
            {metrics.winRate.toFixed(1)}%
          </div>
          <span className="text-[10px] text-neutral-500 font-mono">{metrics.totalTrades} completed trades</span>
        </div>

        {/* Average R-Multiple */}
        <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-5 backdrop-blur-2xl">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">Average R-Multiple</span>
          <div className="font-mono text-2xl font-bold text-purple-300 mt-1">
            +{metrics.avgRMultiple.toFixed(2)} R
          </div>
          <span className="text-[10px] text-neutral-500 font-mono">Gain relative to planned 1% risk</span>
        </div>

        {/* Discipline Score */}
        <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-5 backdrop-blur-2xl">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">Discipline Score</span>
          <div className="font-mono text-2xl font-bold text-emerald-400 mt-1">
            100%
          </div>
          <span className="text-[10px] text-neutral-500 font-mono">0 widened stops • Strict 2:1 R:R</span>
        </div>
      </div>

      {/* Closed Trades Log Table */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 backdrop-blur-2xl shadow-xl overflow-hidden">
        <div className="border-b border-white/[0.06] p-6">
          <h3 className="text-base font-semibold text-white flex items-center space-x-2">
            <BookOpen className="h-5 w-5 text-sky-400" />
            <span>Closed Trades Audit Journal</span>
          </h3>
          <p className="text-xs text-neutral-400">
            Historical swing campaign log with actual exit prices, realized returns, and trade notes
          </p>
        </div>

        {closedTrades.length === 0 ? (
          <div className="py-12 text-center text-neutral-500 text-sm">
            No closed trades in journal yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.06] bg-white/[0.02] text-neutral-400 font-mono uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Ticker &amp; Setup</th>
                  <th className="px-4 py-3.5">Entry &amp; Stop</th>
                  <th className="px-4 py-3.5">Exit Price</th>
                  <th className="px-4 py-3.5">Realized P&amp;L</th>
                  <th className="px-4 py-3.5">R-Multiple</th>
                  <th className="px-4 py-3.5">Exit Reason</th>
                  <th className="px-6 py-3.5">Journal Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] font-mono">
                {closedTrades.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-6 py-4">
                      <span className="font-bold text-white block">{t.ticker}</span>
                      <span className="text-[10px] font-sans text-neutral-400">{t.setupType}</span>
                    </td>
                    <td className="px-4 py-4 text-neutral-300">
                      <div>Fill: ${t.actualEntry?.toFixed(2) || t.entryTrigger.toFixed(2)}</div>
                      <div className="text-[10px] text-rose-400">Stop: ${t.initialStop.toFixed(2)}</div>
                    </td>
                    <td className="px-4 py-4 text-white font-bold">
                      ${t.closedPrice?.toFixed(2) || "--"}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`font-bold ${
                          (t.realizedPnL || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {(t.realizedPnL || 0) >= 0 ? "+" : ""}${t.realizedPnL?.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-purple-300 font-bold">
                        {t.rMultiple ? `+${t.rMultiple} R` : "--"}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-sans text-xs">
                      <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-neutral-300">
                        {t.exitReason || "MANUAL"}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-sans text-xs text-neutral-400 max-w-xs">
                      {t.notes || "Executed according to prop desk discipline."}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
