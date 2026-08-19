"use client";

import React from "react";

interface PriceLadderProps {
  entryTrigger: number;
  stopLoss: number;
  target1: number;
  target2: number;
  positionShares: number;
  riskAmount: number;
  accountSize?: number;
}

export const PriceLadder: React.FC<PriceLadderProps> = ({
  entryTrigger,
  stopLoss,
  target1,
  target2,
  positionShares,
  riskAmount,
  accountSize = 10000,
}) => {
  const riskPerShare = Math.abs(entryTrigger - stopLoss);
  const t1GainPerShare = target1 - entryTrigger;
  const t2GainPerShare = target2 - entryTrigger;

  const t1Pct = ((t1GainPerShare / entryTrigger) * 100).toFixed(1);
  const t2Pct = ((t2GainPerShare / entryTrigger) * 100).toFixed(1);
  const stopPct = (((entryTrigger - stopLoss) / entryTrigger) * 100).toFixed(1);

  const t1R = (t1GainPerShare / riskPerShare).toFixed(2);
  const t2R = (t2GainPerShare / riskPerShare).toFixed(2);

  return (
    <div className="my-4 space-y-2">
      {/* Ladder Container */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-xl">
        
        {/* Target 2 Row */}
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-purple-500/[0.08] px-4 py-2.5 transition hover:bg-purple-500/[0.12]">
          <div className="flex items-center space-x-2">
            <span className="rounded-md bg-purple-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-purple-300">
              TARGET 2
            </span>
            <span className="text-xs text-neutral-400">Measured Move / Runner</span>
          </div>
          <div className="text-right">
            <span className="font-mono text-sm font-bold text-purple-300">
              ${target2.toFixed(2)}
            </span>
            <span className="ml-2 font-mono text-xs text-purple-400">
              +{t2Pct}% ({t2R}R)
            </span>
          </div>
        </div>

        {/* Target 1 Row */}
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-emerald-500/[0.08] px-4 py-2.5 transition hover:bg-emerald-500/[0.12]">
          <div className="flex items-center space-x-2">
            <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              TARGET 1
            </span>
            <span className="text-xs text-neutral-400">Take 50% &amp; Move Stop to B/E</span>
          </div>
          <div className="text-right">
            <span className="font-mono text-sm font-bold text-emerald-300">
              ${target1.toFixed(2)}
            </span>
            <span className="ml-2 font-mono text-xs text-emerald-400">
              +{t1Pct}% ({t1R}R)
            </span>
          </div>
        </div>

        {/* Entry Trigger Row */}
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-sky-500/[0.08] px-4 py-2.5 transition hover:bg-sky-500/[0.12]">
          <div className="flex items-center space-x-2">
            <span className="rounded-md bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-sky-300">
              ENTRY
            </span>
            <span className="text-xs text-neutral-300 font-medium">Trigger Execution Price</span>
          </div>
          <div className="text-right">
            <span className="font-mono text-sm font-bold text-white">
              ${entryTrigger.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Hard Stop Loss Row */}
        <div className="flex items-center justify-between bg-rose-500/[0.08] px-4 py-2.5 transition hover:bg-rose-500/[0.12]">
          <div className="flex items-center space-x-2">
            <span className="rounded-md bg-rose-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-rose-300">
              STOP LOSS
            </span>
            <span className="text-xs text-neutral-400">Strict Invalidation Level</span>
          </div>
          <div className="text-right">
            <span className="font-mono text-sm font-bold text-rose-300">
              ${stopLoss.toFixed(2)}
            </span>
            <span className="ml-2 font-mono text-xs text-rose-400">
              -{stopPct}% (-1.0R)
            </span>
          </div>
        </div>
      </div>

      {/* Position Sizing Calculation Bar */}
      <div className="flex flex-wrap items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2 text-xs text-neutral-400 font-mono">
        <div>
          <span>Risk Math: </span>
          <span className="text-white">${riskPerShare.toFixed(2)}/sh</span>
          <span className="mx-1 text-neutral-600">•</span>
          <span>Size: </span>
          <span className="text-emerald-400 font-bold">{positionShares} shares</span>
          <span className="text-neutral-500"> (${(positionShares * entryTrigger).toFixed(2)})</span>
        </div>
        <div className="text-amber-400 font-medium">
          Total Risk: ${riskAmount.toFixed(2)} (1% of ${accountSize.toLocaleString()})
        </div>
      </div>
    </div>
  );
};
