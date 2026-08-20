"use client";

import React, { useMemo } from "react";
import { Trade } from "@/lib/storage/types";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { TrendingUp, ShieldAlert, DollarSign, Award, ArrowUpRight } from "lucide-react";

export interface PnLCurveChartProps {
  closedTrades: Trade[];
  initialCapital?: number;
}

export interface EquityDataPoint {
  tradeIndex: number;
  label: string;
  date: string;
  ticker?: string;
  companyName?: string;
  tradePnL?: number;
  tradeR?: number;
  cumulativePnL: number;
  totalEquity: number;
  highWaterMark: number;
  drawdownDollars: number;
  drawdownPct: number;
  exitReason?: string;
}

export const PnLCurveChart: React.FC<PnLCurveChartProps> = ({
  closedTrades = [],
  initialCapital = 15000.0,
}) => {
  const { series, peakEquity, maxDrawdownDollars, maxDrawdownPct, finalEquity } = useMemo(() => {
    let currentEquity = initialCapital;
    let cumulativePnL = 0;
    let peak = initialCapital;
    let maxDd = 0;

    const data: EquityDataPoint[] = [
      {
        tradeIndex: 0,
        label: "Start",
        date: "Deposit",
        cumulativePnL: 0,
        totalEquity: initialCapital,
        highWaterMark: initialCapital,
        drawdownDollars: 0,
        drawdownPct: 0,
      },
    ];

    // Sort trades chronologically by closedDate or createdAt safely
    const sorted = [...closedTrades].sort((a, b) => {
      const getTimestamp = (trade: Trade) => {
        const d = trade.closedDate || trade.createdAt;
        if (!d) return 0;
        const time = new Date(d).getTime();
        return isNaN(time) ? 0 : time;
      };
      return getTimestamp(a) - getTimestamp(b);
    });

    sorted.forEach((t, idx) => {
      const pnl = typeof t.realizedPnL === "number" ? t.realizedPnL : 0;
      cumulativePnL += pnl;
      currentEquity += pnl;
      if (currentEquity > peak) {
        peak = currentEquity;
      }
      const currentDrawdown = peak - currentEquity;
      if (currentDrawdown > maxDd) {
        maxDd = currentDrawdown;
      }

      const ddPct = peak > 0 ? (currentDrawdown / peak) * 100 : 0;

      let formattedDate = `T${idx + 1}`;
      if (t.closedDate) {
        try {
          const d = new Date(t.closedDate);
          if (!isNaN(d.getTime())) {
            formattedDate = d.toLocaleDateString([], { month: "short", day: "numeric" });
          }
        } catch (e) {}
      }

      data.push({
        tradeIndex: idx + 1,
        label: `#${idx + 1} ${t.ticker || "TRADE"}`,
        date: formattedDate,
        ticker: t.ticker,
        companyName: t.companyName,
        tradePnL: pnl,
        tradeR: typeof t.rMultiple === "number" ? t.rMultiple : 0,
        cumulativePnL: Number(cumulativePnL.toFixed(2)),
        totalEquity: Number(currentEquity.toFixed(2)),
        highWaterMark: Number(peak.toFixed(2)),
        drawdownDollars: Number(currentDrawdown.toFixed(2)),
        drawdownPct: Number(ddPct.toFixed(2)),
        exitReason: t.exitReason || "CLOSED",
      });
    });

    const maxDdPax = peak > 0 ? (maxDd / peak) * 100 : 0;

    return {
      series: data,
      peakEquity: Number(peak.toFixed(2)),
      maxDrawdownDollars: Number(maxDd.toFixed(2)),
      maxDrawdownPct: Number(maxDdPax.toFixed(2)),
      finalEquity: Number(currentEquity.toFixed(2)),
    };
  }, [closedTrades, initialCapital]);

  const isNetPositive = finalEquity >= initialCapital;

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-6 sm:p-8 backdrop-blur-2xl shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/[0.06] pb-4 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">
              Cumulative Sleeve Equity Progression
            </h3>
          </div>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">
            Sequential growth curve across closed swing campaigns vs. High Water Mark peak
          </p>
        </div>

        {/* Top Summary Badges */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <div className="rounded-2xl border border-white/[0.08] bg-black/40 px-3 py-1.5">
            <span className="text-neutral-500 block text-[10px] uppercase">Current Equity</span>
            <span className={`font-bold ${isNetPositive ? "text-emerald-400" : "text-rose-400"}`}>
              ${finalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] px-3 py-1.5">
            <span className="text-amber-400 block text-[10px] uppercase">Peak Equity (HWM)</span>
            <span className="text-amber-300 font-bold">
              ${peakEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.05] px-3 py-1.5">
            <span className="text-rose-400 block text-[10px] uppercase">Max Drawdown</span>
            <span className="text-rose-300 font-bold">
              -${maxDrawdownDollars.toFixed(2)} ({maxDrawdownPct.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="equityGradGreen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="equityGradRed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF08" vertical={false} />

            <XAxis
              dataKey="date"
              stroke="#6B7280"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#FFFFFF15" }}
            />
            <YAxis
              stroke="#6B7280"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#FFFFFF15" }}
              domain={["auto", "auto"]}
              tickFormatter={(v) => `$${v.toLocaleString()}`}
            />

            {/* Zero/Baseline Reference Line */}
            <ReferenceLine
              y={initialCapital}
              stroke="#FFFFFF30"
              strokeDasharray="4 4"
              label={{
                value: `$${initialCapital.toLocaleString()} Base`,
                fill: "#9CA3AF",
                fontSize: 10,
                position: "insideTopRight",
              }}
            />

            {/* High Water Mark Line */}
            <Line
              type="stepAfter"
              dataKey="highWaterMark"
              stroke="#F59E0B"
              strokeDasharray="3 3"
              strokeWidth={1.5}
              dot={false}
              name="Peak Equity (HWM)"
            />

            {/* Total Equity Area Line */}
            <Area
              type="monotone"
              dataKey="totalEquity"
              stroke={isNetPositive ? "#34D399" : "#FB7185"}
              strokeWidth={2.5}
              fill={isNetPositive ? "url(#equityGradGreen)" : "url(#equityGradRed)"}
              dot={{ r: 3, fill: isNetPositive ? "#34D399" : "#FB7185", strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#FFFFFF", stroke: isNetPositive ? "#34D399" : "#FB7185", strokeWidth: 2 }}
              name="Sleeve Equity"
            />

            {/* Custom Tooltip */}
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data: EquityDataPoint = payload[0].payload;
                  const isPositive = (data.tradePnL || 0) >= 0;

                  return (
                    <div className="rounded-2xl border border-white/10 bg-[#0E1322]/95 p-4 text-xs font-mono shadow-2xl backdrop-blur-xl space-y-2 min-w-[200px]">
                      <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
                        <span className="font-bold text-white">
                          {data.ticker ? `${data.ticker}` : "Initial Baseline"}
                        </span>
                        <span className="text-neutral-400 text-[10px]">{data.date}</span>
                      </div>

                      {data.tradeIndex > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-400">Trade P&amp;L:</span>
                            <span className={`font-bold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                              {isPositive ? "+" : ""}${data.tradePnL?.toFixed(2)} ({isPositive ? "+" : ""}{data.tradeR?.toFixed(2)}R)
                            </span>
                          </div>
                          {data.exitReason && (
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-400">Exit Reason:</span>
                              <span className="text-sky-300 font-sans text-[10px]">{data.exitReason}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="border-t border-white/[0.06] pt-1.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-400">Cumulative Gain:</span>
                          <span className={`font-semibold ${data.cumulativePnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {data.cumulativePnL >= 0 ? "+" : ""}${data.cumulativePnL.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-400">Total Equity:</span>
                          <span className="text-white font-bold">${data.totalEquity.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-400">Drawdown from Peak:</span>
                          <span className="text-rose-400">
                            -${data.drawdownDollars.toFixed(2)} ({data.drawdownPct.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PnLCurveChart;
