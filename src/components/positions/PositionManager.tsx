"use client";

import React, { useState } from "react";
import { Trade } from "@/lib/storage/types";
import { PositionCard } from "./PositionCard";
import { PositionTable } from "./PositionTable";
import { WatchOrderQueue } from "./WatchOrderQueue";
import { QuickEntryModal } from "./QuickEntryModal";
import {
  TrendingUp,
  LayoutGrid,
  Table as TableIcon,
  Plus,
  Shield,
  Clock,
  AlertTriangle,
  Zap,
} from "lucide-react";

export interface PositionManagerProps {
  activeTrades: Trade[];
  pendingTrades: Trade[];
  marketQuotes: Record<string, any>;
  accountSize?: number;
  riskPerTrade?: number;
  onScaleT1: (tradeId: string, fillPrice?: number) => void;
  onUpdateStop: (tradeId: string, newStop: number) => void;
  onCloseTrade: (tradeId: string, exitReason: string, closePrice?: number) => void;
  onActivatePending: (tradeId: string, fillPrice?: number) => void;
  onDeleteTrade: (tradeId: string) => void;
  onOpenAddTrade?: () => void;
}

export const PositionManager: React.FC<PositionManagerProps> = ({
  activeTrades,
  pendingTrades,
  marketQuotes,
  accountSize = 15000,
  riskPerTrade = 1.0,
  onScaleT1,
  onUpdateStop,
  onCloseTrade,
  onActivatePending,
  onDeleteTrade,
  onOpenAddTrade,
}) => {
  const [viewMode, setViewMode] = useState<"CARDS" | "TABLE">("CARDS");
  const [adjustStopTrade, setAdjustStopTrade] = useState<{
    trade: Trade;
    stopPrice: string;
    error: string;
  } | null>(null);
  const [isInternalAddOpen, setIsInternalAddOpen] = useState(false);

  const handleOpenAdd = onOpenAddTrade || (() => setIsInternalAddOpen(true));

  const handleStopPriceChange = (val: string) => {
    if (!adjustStopTrade) return;
    const num = parseFloat(val);
    let err = "";
    if (!isNaN(num) && num < adjustStopTrade.trade.currentStop) {
      err = `Discipline Rule Violation: Cannot widen stop downward from $${adjustStopTrade.trade.currentStop.toFixed(2)} to $${num.toFixed(2)}`;
    }
    setAdjustStopTrade({
      ...adjustStopTrade,
      stopPrice: val,
      error: err,
    });
  };

  const handleSaveStop = () => {
    if (!adjustStopTrade) return;
    const num = parseFloat(adjustStopTrade.stopPrice);
    if (isNaN(num) || num < adjustStopTrade.trade.currentStop) return;
    onUpdateStop(adjustStopTrade.trade.id, num);
    setAdjustStopTrade(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Active Positions Header & View Toggle */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-6 backdrop-blur-2xl shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between border-b border-white/[0.06] pb-4 gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <span>Active Swing Positions ({activeTrades.length} / 3 Max)</span>
            </h3>
            <p className="text-xs text-neutral-400 font-mono mt-0.5">
              Strict 1% risk per trade ($150 on ${accountSize.toLocaleString()}) • Monitored with live stops, T1 scales, and 5–7 session time stops
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* View Mode Toggle (Obsidian Cards vs Executive Table) */}
            <div className="flex rounded-full bg-black/40 p-1 border border-white/[0.08]">
              <button
                type="button"
                onClick={() => setViewMode("CARDS")}
                className={`flex items-center space-x-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  viewMode === "CARDS"
                    ? "bg-white text-neutral-900 shadow"
                    : "text-neutral-400 hover:text-white"
                }`}
                title="Obsidian Card Grid View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("TABLE")}
                className={`flex items-center space-x-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  viewMode === "TABLE"
                    ? "bg-white text-neutral-900 shadow"
                    : "text-neutral-400 hover:text-white"
                }`}
                title="Executive Spreadsheet Table View"
              >
                <TableIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>

            {/* + Add Position Button */}
            <button
              type="button"
              onClick={handleOpenAdd}
              className="flex items-center space-x-1.5 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Add Position</span>
            </button>
          </div>
        </div>

        {/* Content View */}
        {activeTrades.length === 0 ? (
          <div className="py-16 text-center text-neutral-400 space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.08]">
              <TrendingUp className="h-6 w-6 text-neutral-500" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">No active swing positions open.</p>
              <p className="text-xs text-neutral-500">
                Promote a candidate from the AI Screener or log a trade with automatic 1% risk sizing.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center space-x-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Log Your First Position (&lt;15s)</span>
            </button>
          </div>
        ) : viewMode === "CARDS" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeTrades.map((trade) => {
              const quote = marketQuotes[trade.ticker.toUpperCase()];
              const currentPrice = quote?.price || trade.entryTrigger;

              return (
                <PositionCard
                  key={trade.id}
                  trade={trade}
                  currentPrice={currentPrice}
                  accountSize={accountSize}
                  onScaleT1={onScaleT1}
                  onUpdateStop={onUpdateStop}
                  onCloseTrade={onCloseTrade}
                  onOpenAdjustStop={(t) =>
                    setAdjustStopTrade({
                      trade: t,
                      stopPrice: t.currentStop.toString(),
                      error: "",
                    })
                  }
                />
              );
            })}
          </div>
        ) : (
          <PositionTable
            activeTrades={activeTrades}
            marketQuotes={marketQuotes}
            accountSize={accountSize}
            onScaleT1={onScaleT1}
            onUpdateStop={onUpdateStop}
            onCloseTrade={onCloseTrade}
            onOpenAdjustStop={(t) =>
              setAdjustStopTrade({
                trade: t,
                stopPrice: t.currentStop.toString(),
                error: "",
              })
            }
          />
        )}
      </div>

      {/* Pending Watch Order Queue */}
      <WatchOrderQueue
        pendingTrades={pendingTrades}
        marketQuotes={marketQuotes}
        onActivatePending={onActivatePending}
        onDeleteTrade={onDeleteTrade}
      />

      {/* Adjust Stop Loss Modal (With Invariant Enforcement Feedback) */}
      {adjustStopTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#121622] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-white">
                  Adjust Stop — {adjustStopTrade.trade.ticker}
                </h4>
                <p className="text-[11px] font-mono text-neutral-400">
                  Current stop: ${adjustStopTrade.trade.currentStop.toFixed(2)}
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-300">
              Institutional Discipline Rule: Stop losses may be tightened or trailed upward only. Downward widening is strictly prohibited.
            </p>

            <div>
              <label className="block text-[11px] font-mono uppercase text-neutral-400 mb-1">
                New Stop Loss Price ($)
              </label>
              <input
                type="number"
                step="0.05"
                value={adjustStopTrade.stopPrice}
                onChange={(e) => handleStopPriceChange(e.target.value)}
                className={`w-full rounded-xl border bg-black/50 px-4 py-2.5 font-mono text-sm text-white focus:outline-none ${
                  adjustStopTrade.error
                    ? "border-rose-500 text-rose-300 focus:border-rose-500"
                    : "border-white/10 focus:border-sky-500"
                }`}
              />
              {adjustStopTrade.error && (
                <p className="text-[11px] text-rose-400 font-mono mt-1.5 flex items-start space-x-1">
                  <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                  <span>{adjustStopTrade.error}</span>
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setAdjustStopTrade(null)}
                className="rounded-full px-4 py-2 text-xs text-neutral-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!!adjustStopTrade.error || !adjustStopTrade.stopPrice}
                onClick={handleSaveStop}
                className="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-400 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirm Ratchet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Internal Quick Entry Modal */}
      {isInternalAddOpen && (
        <QuickEntryModal
          isOpen={isInternalAddOpen}
          onClose={() => setIsInternalAddOpen(false)}
          onTradeAdded={() => {
            setIsInternalAddOpen(false);
          }}
          accountSize={accountSize}
          riskPerTrade={riskPerTrade}
          activeTrades={activeTrades}
        />
      )}
    </div>
  );
};

export default PositionManager;
