"use client";

import React from "react";

export interface PriceLadderProps {
  entryTrigger: number;
  stopLoss: number;
  target1?: number;
  target2?: number;
  currentPrice?: number;
  positionShares?: number;
  riskAmount?: number;
  accountSize?: number;
  variant?: "full" | "compact" | "horizontal" | "card";
  showSizingBar?: boolean;
}

export const PriceLadder: React.FC<PriceLadderProps> = ({
  entryTrigger,
  stopLoss,
  target1: customT1,
  target2: customT2,
  currentPrice,
  positionShares = 0,
  riskAmount,
  accountSize = 15000,
  variant = "full",
  showSizingBar = true,
}) => {
  const riskPerShare = Math.max(0.01, Math.abs(entryTrigger - stopLoss));
  const target1 = customT1 ?? Number((entryTrigger + 2.0 * riskPerShare).toFixed(2));
  const target2 = customT2 ?? Number((entryTrigger + 3.5 * riskPerShare).toFixed(2));

  const t1GainPerShare = target1 - entryTrigger;
  const t2GainPerShare = target2 - entryTrigger;

  const t1Pct = ((t1GainPerShare / entryTrigger) * 100).toFixed(1);
  const t2Pct = ((t2GainPerShare / entryTrigger) * 100).toFixed(1);
  const stopPct = (((entryTrigger - stopLoss) / entryTrigger) * 100).toFixed(1);

  const t1R = (t1GainPerShare / riskPerShare).toFixed(2);
  const t2R = (t2GainPerShare / riskPerShare).toFixed(2);

  const effectiveRiskAmount = riskAmount ?? (positionShares > 0 ? positionShares * riskPerShare : 150);

  // Calculate live price metrics if currentPrice is provided
  const hasCurrentPrice = typeof currentPrice === "number" && !isNaN(currentPrice);
  const curP = currentPrice ?? entryTrigger;
  const currentDiff = curP - entryTrigger;
  const currentPct = ((currentDiff / entryTrigger) * 100).toFixed(1);
  const currentR = (currentDiff / riskPerShare).toFixed(2);

  // Proportional position calculation for the needle bar (bounded between Stop and Target 2)
  const totalRange = Math.max(0.01, target2 - stopLoss);
  const needlePct = Math.min(100, Math.max(0, ((curP - stopLoss) / totalRange) * 100));

  // Determine current price zone
  const isAboveT1 = hasCurrentPrice && curP >= target1;
  const isAboveEntry = hasCurrentPrice && curP >= entryTrigger && curP < target1;
  const isBelowEntry = hasCurrentPrice && curP < entryTrigger && curP > stopLoss;
  const isAtOrBelowStop = hasCurrentPrice && curP <= stopLoss;

  if (variant === "compact" || variant === "card") {
    return (
      <div className="space-y-1.5 font-mono text-xs">
        {/* Proportional needle track */}
        <div className="relative h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 opacity-60 rounded-full transition-all duration-300"
            style={{ width: `${needlePct}%` }}
          />
          {hasCurrentPrice && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_#ffffff] -ml-0.5 rounded-full"
              style={{ left: `${needlePct}%` }}
            />
          )}
        </div>

        {/* Levels Row */}
        <div className="flex items-center justify-between text-[11px] text-neutral-400">
          <span className="text-rose-400 font-semibold">${stopLoss.toFixed(2)} (-1R)</span>
          <span className="text-neutral-300 font-medium">${entryTrigger.toFixed(2)}</span>
          <span className="text-emerald-400 font-semibold">${target1.toFixed(2)} (+{t1R}R)</span>
          <span className="text-purple-300 font-semibold">${target2.toFixed(2)} (+{t2R}R)</span>
        </div>
      </div>
    );
  }

  if (variant === "horizontal") {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-3.5 backdrop-blur-xl space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span className="rounded-md bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">STOP</span>
            <span className="text-rose-300 font-bold">${stopLoss.toFixed(2)}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="rounded-md bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">ENTRY</span>
            <span className="text-white font-bold">${entryTrigger.toFixed(2)}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">T1</span>
            <span className="text-emerald-300 font-bold">${target1.toFixed(2)}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="rounded-md bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-bold text-purple-300">T2</span>
            <span className="text-purple-300 font-bold">${target2.toFixed(2)}</span>
          </div>
        </div>

        {/* Progress track */}
        <div className="relative h-2.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-rose-500 via-sky-500 via-emerald-500 to-purple-500 opacity-70 rounded-full transition-all duration-300"
            style={{ width: `${needlePct}%` }}
          />
        </div>
      </div>
    );
  }

  // Full Variant (Default 4-Tier Ladder)
  return (
    <div className="my-4 space-y-2.5">
      {/* 4-Tier Ladder Container */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-xl">
        
        {/* Tier 1: Target 2 (Runner Extension / +3.5R) */}
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-purple-500/[0.08] px-4 py-2.5 transition hover:bg-purple-500/[0.12]">
          <div className="flex items-center space-x-2">
            <span className="rounded-md bg-purple-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-purple-300">
              TARGET 2
            </span>
            <span className="text-xs text-neutral-400">Measured Move / Runner (+3.5R)</span>
          </div>
          <div className="text-right">
            <span className="font-mono text-sm font-bold text-purple-300">
              ${target2.toFixed(2)}
            </span>
            <span className="ml-2 font-mono text-xs text-purple-400">
              +{t2Pct}% (+{t2R}R)
            </span>
          </div>
        </div>

        {/* Tier 2: Target 1 (Take 50% & Breakeven / +2.0R) */}
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-emerald-500/[0.08] px-4 py-2.5 transition hover:bg-emerald-500/[0.12]">
          <div className="flex items-center space-x-2">
            <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              TARGET 1
            </span>
            <span className="text-xs text-neutral-400">Scale 50% &amp; Move Stop to B/E (+2.0R)</span>
          </div>
          <div className="text-right">
            <span className="font-mono text-sm font-bold text-emerald-300">
              ${target1.toFixed(2)}
            </span>
            <span className="ml-2 font-mono text-xs text-emerald-400">
              +{t1Pct}% (+{t1R}R)
            </span>
          </div>
        </div>

        {/* Live Tape Needle (Rendered between appropriate tiers if currentPrice is given) */}
        {hasCurrentPrice && (
          <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.06] px-4 py-2 font-mono text-xs">
            <div className="flex items-center space-x-2">
              <span className="flex h-2 w-2 rounded-full bg-sky-400 animate-ping" />
              <span className="text-sky-300 font-bold uppercase text-[10px] tracking-wider">LIVE TAPE</span>
              <span className="text-neutral-400 text-xs">Current Market Price</span>
            </div>
            <div className="text-right">
              <span className={`font-bold ${isAboveEntry ? "text-emerald-400" : isAtOrBelowStop ? "text-rose-400" : "text-sky-300"}`}>
                ${curP.toFixed(2)}
              </span>
              <span className={`ml-2 text-xs ${Number(currentR) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {Number(currentR) >= 0 ? "+" : ""}{currentPct}% ({Number(currentR) >= 0 ? "+" : ""}{currentR}R)
              </span>
            </div>
          </div>
        )}

        {/* Tier 3: Entry Trigger (Fill Baseline) */}
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-sky-500/[0.08] px-4 py-2.5 transition hover:bg-sky-500/[0.12]">
          <div className="flex items-center space-x-2">
            <span className="rounded-md bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-sky-300">
              ENTRY
            </span>
            <span className="text-xs text-neutral-300 font-medium">Trigger Execution Baseline (0.0R)</span>
          </div>
          <div className="text-right">
            <span className="font-mono text-sm font-bold text-white">
              ${entryTrigger.toFixed(2)}
            </span>
            <span className="ml-2 font-mono text-xs text-neutral-400">
              0.0% (0.00R)
            </span>
          </div>
        </div>

        {/* Tier 4: Hard Stop Loss (Strict Invalidation) */}
        <div className="flex items-center justify-between bg-rose-500/[0.08] px-4 py-2.5 transition hover:bg-rose-500/[0.12]">
          <div className="flex items-center space-x-2">
            <span className="rounded-md bg-rose-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-rose-300">
              STOP LOSS
            </span>
            <span className="text-xs text-neutral-400">Strict Invalidation Level (-1.0R)</span>
          </div>
          <div className="text-right">
            <span className="font-mono text-sm font-bold text-rose-300">
              ${stopLoss.toFixed(2)}
            </span>
            <span className="ml-2 font-mono text-xs text-rose-400">
              -{stopPct}% (-1.00R)
            </span>
          </div>
        </div>
      </div>

      {/* Proportional visual progress needle bar */}
      <div className="relative h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-rose-500 via-sky-500 to-emerald-500 opacity-60 rounded-full transition-all duration-300"
          style={{ width: `${needlePct}%` }}
        />
        {hasCurrentPrice && (
          <div
            className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_#ffffff] -ml-0.5 rounded-full"
            style={{ left: `${needlePct}%` }}
          />
        )}
      </div>

      {/* Position Sizing Calculation Bar */}
      {showSizingBar && (
        <div className="flex flex-wrap items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2 text-xs text-neutral-400 font-mono">
          <div>
            <span>Risk Math: </span>
            <span className="text-white">${riskPerShare.toFixed(2)}/sh</span>
            {positionShares > 0 && (
              <>
                <span className="mx-1 text-neutral-600">•</span>
                <span>Size: </span>
                <span className="text-emerald-400 font-bold">{positionShares} shares</span>
                <span className="text-neutral-500"> (${(positionShares * entryTrigger).toFixed(2)})</span>
              </>
            )}
          </div>
          <div className="text-amber-400 font-medium">
            Total Risk: ${effectiveRiskAmount.toFixed(2)} (1% of ${accountSize.toLocaleString()})
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceLadder;
