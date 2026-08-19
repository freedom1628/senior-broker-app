"use client";

import React from "react";
import { Sparkles, ArrowUpRight } from "lucide-react";

interface ExecutiveTableProps {
  candidates: any[];
  marketQuotes: Record<string, any>;
  onSelectCandidate: (candidate: any) => void;
}

export const ExecutiveTable: React.FC<ExecutiveTableProps> = ({
  candidates,
  marketQuotes,
  onSelectCandidate,
}) => {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 backdrop-blur-2xl shadow-xl">
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">
            Executive Summary Matrix — Ranked Swing Setups
          </h3>
          <p className="text-xs text-neutral-400">
            Multi-AI verified setups meeting strict 2.0:1 R:R and 1.0% account risk constraints
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/[0.06] bg-white/[0.02] text-neutral-400 font-mono uppercase text-[11px] tracking-wider">
            <tr>
              <th className="px-6 py-3.5">Ticker &amp; Models</th>
              <th className="px-4 py-3.5">Live Price</th>
              <th className="px-4 py-3.5">Setup Type</th>
              <th className="px-4 py-3.5">Entry Trigger</th>
              <th className="px-4 py-3.5">Hard Stop</th>
              <th className="px-4 py-3.5">Targets (T1 / T2)</th>
              <th className="px-4 py-3.5">R:R Ratio</th>
              <th className="px-4 py-3.5">Size ($10k)</th>
              <th className="px-4 py-3.5 text-center">Score</th>
              <th className="px-6 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {candidates.map((c) => {
              const quote = marketQuotes[c.ticker.toUpperCase()];
              const models = c.modelSources ? c.modelSources.split(",").map((m: string) => m.trim()) : [];
              const isConsensus = models.length > 1;

              return (
                <tr
                  key={c.id || c.ticker}
                  className="hover:bg-white/[0.02] transition cursor-pointer"
                  onClick={() => onSelectCandidate(c)}
                >
                  {/* Ticker & Multi-AI Badges */}
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm font-bold text-white">
                        {c.ticker}
                      </span>
                      {isConsensus && (
                        <span className="flex items-center space-x-1 rounded-full bg-purple-500/20 border border-purple-500/30 px-1.5 py-0.5 text-[9px] font-bold text-purple-300">
                          <Sparkles className="h-2.5 w-2.5" />
                          <span>CON</span>
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center space-x-1">
                      {models.map((m: string) => (
                        <span
                          key={m}
                          className="rounded px-1.5 py-0.2 text-[9px] font-mono text-neutral-400 bg-white/[0.04]"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Live Price */}
                  <td className="px-4 py-4 font-mono">
                    {quote ? (
                      <div>
                        <div className="font-semibold text-white">${quote.price.toFixed(2)}</div>
                        <div className={`text-[10px] ${quote.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {quote.change >= 0 ? "+" : ""}{quote.changePct.toFixed(2)}%
                        </div>
                      </div>
                    ) : (
                      <span className="text-neutral-500">--</span>
                    )}
                  </td>

                  {/* Setup Type */}
                  <td className="px-4 py-4 text-neutral-300 font-medium max-w-[150px] truncate">
                    {c.setupType}
                  </td>

                  {/* Entry */}
                  <td className="px-4 py-4 font-mono font-bold text-sky-400">
                    ${c.entryTrigger.toFixed(2)}
                  </td>

                  {/* Stop */}
                  <td className="px-4 py-4 font-mono font-semibold text-rose-400">
                    ${c.stopLoss.toFixed(2)}
                  </td>

                  {/* Targets */}
                  <td className="px-4 py-4 font-mono text-emerald-400">
                    ${c.target1.toFixed(2)} / ${c.target2.toFixed(2)}
                  </td>

                  {/* R:R */}
                  <td className="px-4 py-4 font-mono font-bold text-emerald-300">
                    {c.rrRatio.toFixed(2)} : 1
                  </td>

                  {/* Position Size */}
                  <td className="px-4 py-4 font-mono text-neutral-300">
                    {c.positionShares} sh <span className="text-neutral-500">(${(c.positionShares * c.entryTrigger).toFixed(0)})</span>
                  </td>

                  {/* Score */}
                  <td className="px-4 py-4 text-center font-mono">
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300">
                      {c.score}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="px-6 py-4 text-right">
                    <button className="rounded-full border border-white/[0.1] bg-white/[0.04] p-1.5 text-neutral-300 hover:bg-white/[0.1] hover:text-white transition">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
