"use client";

import React from "react";
import { Search, Filter, Calendar, TrendingUp, Layers, SlidersHorizontal, X } from "lucide-react";

export interface JournalFilterState {
  searchQuery: string;
  setupType: string;
  outcome: "ALL" | "WINNERS" | "LOSERS" | "BREAKEVEN";
  marketRegime: string;
  dateRange: "7D" | "30D" | "90D" | "YTD" | "ALL";
  sortBy: "DATE_DESC" | "DATE_ASC" | "PNL_DESC" | "R_DESC";
}

export interface JournalFilterBarProps {
  filters: JournalFilterState;
  onFilterChange: (filters: JournalFilterState) => void;
  onResetFilters: () => void;
  availableSetups?: string[];
}

export const JournalFilterBar: React.FC<JournalFilterBarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  availableSetups = [
    "Catalyst Continuation",
    "Post-Earnings Pullback",
    "Base Breakout",
    "Momentum High-Tight Flag",
  ],
}) => {
  const update = (partial: Partial<JournalFilterState>) => {
    onFilterChange({ ...filters, ...partial });
  };

  const hasActiveFilters =
    filters.searchQuery !== "" ||
    filters.setupType !== "ALL" ||
    filters.outcome !== "ALL" ||
    filters.marketRegime !== "ALL" ||
    filters.dateRange !== "ALL";

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-5 backdrop-blur-2xl shadow-xl space-y-4">
      {/* Top Row: Search & Outcome Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search closed ticker, thesis, or notes..."
            value={filters.searchQuery}
            onChange={(e) => update({ searchQuery: e.target.value })}
            className="w-full rounded-2xl border border-white/10 bg-black/50 pl-10 pr-4 py-2 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500"
          />
          {filters.searchQuery && (
            <button
              onClick={() => update({ searchQuery: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Outcome Filter Pills */}
        <div className="flex rounded-full bg-black/40 p-1 border border-white/[0.08] text-xs font-mono">
          <button
            type="button"
            onClick={() => update({ outcome: "ALL" })}
            className={`px-3 py-1 rounded-full transition ${
              filters.outcome === "ALL"
                ? "bg-white text-neutral-900 font-bold"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            All Trades
          </button>
          <button
            type="button"
            onClick={() => update({ outcome: "WINNERS" })}
            className={`px-3 py-1 rounded-full transition ${
              filters.outcome === "WINNERS"
                ? "bg-emerald-500 text-white font-bold"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Winners
          </button>
          <button
            type="button"
            onClick={() => update({ outcome: "LOSERS" })}
            className={`px-3 py-1 rounded-full transition ${
              filters.outcome === "LOSERS"
                ? "bg-rose-500 text-white font-bold"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Losses
          </button>
          <button
            type="button"
            onClick={() => update({ outcome: "BREAKEVEN" })}
            className={`px-3 py-1 rounded-full transition ${
              filters.outcome === "BREAKEVEN"
                ? "bg-sky-500 text-white font-bold"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Breakeven
          </button>
        </div>
      </div>

      {/* Second Row: Dropdowns & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/[0.06] text-xs font-mono">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Setup Type Dropdown */}
          <div className="flex items-center space-x-1">
            <span className="text-neutral-500">Setup:</span>
            <select
              value={filters.setupType}
              onChange={(e) => update({ setupType: e.target.value })}
              className="rounded-xl border border-white/10 bg-black/50 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">All Setups</option>
              {availableSetups.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Presets */}
          <div className="flex items-center space-x-1">
            <span className="text-neutral-500">Range:</span>
            <div className="flex rounded-lg bg-black/40 p-0.5 border border-white/[0.08]">
              {(["7D", "30D", "90D", "YTD", "ALL"] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => update({ dateRange: range })}
                  className={`px-2 py-0.5 rounded text-[11px] transition ${
                    filters.dateRange === range
                      ? "bg-sky-500/20 text-sky-300 font-bold"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sort Dropdown & Reset */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="text-neutral-500">Sort:</span>
            <select
              value={filters.sortBy}
              onChange={(e) => update({ sortBy: e.target.value as any })}
              className="rounded-xl border border-white/10 bg-black/50 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="DATE_DESC">Newest Exit</option>
              <option value="DATE_ASC">Oldest Exit</option>
              <option value="PNL_DESC">Highest Realized P&amp;L</option>
              <option value="R_DESC">Highest R-Multiple</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="text-[11px] text-rose-400 hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default JournalFilterBar;
