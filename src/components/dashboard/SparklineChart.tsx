"use client";

import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SparklineChartProps, TimeframeOption, EquityDataPoint } from "@/types";
import { MOCK_EQUITY_SERIES, generateDynamicEquityCurve } from "@/lib/mockData";
import { ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";

const CustomSparklineTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;

  const data: EquityDataPoint = payload[0].payload;
  const isPositive = data.changeDollars >= 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0E131F]/95 p-3 backdrop-blur-xl shadow-2xl space-y-1 font-mono">
      <div className="text-[11px] text-neutral-400">{data.timeLabel}</div>
      <div className="text-base font-bold text-white">
        ${data.equity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className={`flex items-center space-x-1 text-xs font-semibold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
        {isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
        <span>
          {isPositive ? "+" : ""}${data.changeDollars.toFixed(2)} ({isPositive ? "+" : ""}{data.changePct.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
};

export const SparklineChart: React.FC<SparklineChartProps> = ({
  data,
  timeframe = "1D",
  onTimeframeChange,
  height = 180,
  startingCapital = 15000,
  currentEquity = 15340.5,
  className = "",
  showControls = true,
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [selectedTf, setSelectedTf] = useState<TimeframeOption>(timeframe);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleTfChange = (tf: TimeframeOption) => {
    setSelectedTf(tf);
    if (onTimeframeChange) {
      onTimeframeChange(tf);
    }
  };

  const chartData = data && data.length > 0
    ? data
    : generateDynamicEquityCurve(startingCapital, currentEquity - startingCapital, selectedTf);

  const latestPoint = chartData[chartData.length - 1] || { changeDollars: 0, changePct: 0 };
  const isPositive = latestPoint.changeDollars >= 0;
  const strokeColor = isPositive ? "#10B981" : "#F43F5E";
  const gradientId = isPositive ? "equityGlowEmerald" : "equityGlowCrimson";

  const timeframes: TimeframeOption[] = ["1D", "1W", "1M", "1Y"];

  return (
    <div className={`w-full flex flex-col space-y-3 ${className}`}>
      
      {/* Top Controls Row */}
      {showControls && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Period Return Badge */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono text-neutral-400">Period Return:</span>
            <div
              className={`flex items-center space-x-1 rounded-full px-2.5 py-0.5 text-xs font-mono font-semibold ${
                isPositive
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
              }`}
            >
              {isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              <span>
                {isPositive ? "+" : ""}${latestPoint.changeDollars.toFixed(2)} ({isPositive ? "+" : ""}{latestPoint.changePct.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Timeframe Selector Pills */}
          <div className="flex items-center rounded-full bg-black/40 p-1 border border-white/[0.08]">
            {timeframes.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => handleTfChange(tf)}
                className={`rounded-full px-3 py-1 text-xs font-mono font-semibold transition ${
                  selectedTf === tf
                    ? "bg-white text-neutral-900 shadow-md"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Responsive Recharts Container */}
      <div style={{ width: "100%", height }} className="relative">
        {!isMounted ? (
          <div className="flex h-full w-full items-center justify-center rounded-2xl bg-white/[0.02] border border-white/[0.04] text-xs text-neutral-500 font-mono">
            <TrendingUp className="h-4 w-4 mr-2 animate-pulse text-sky-400" />
            Loading Equity Curve...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="equityGlowEmerald" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="equityGlowCrimson" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#F43F5E" stopOpacity={0.0} />
                </linearGradient>
                <filter id="emeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#10B981" floodOpacity="0.5" />
                </filter>
                <filter id="crimsonGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#F43F5E" floodOpacity="0.5" />
                </filter>
              </defs>
              <XAxis dataKey="timeLabel" hide />
              <YAxis domain={["auto", "auto"]} hide />
              <Tooltip content={<CustomSparklineTooltip />} />
              <Area
                type="monotone"
                dataKey="equity"
                stroke={strokeColor}
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                filter={isPositive ? "url(#emeraldGlow)" : "url(#crimsonGlow)"}
                isAnimationActive={true}
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
