"use client";

import React, { useState, useMemo } from "react";
import { Trade } from "@/lib/storage/types";
import { MetricsRibbon } from "./MetricsRibbon";
import { PnLCurveChart } from "./PnLCurveChart";
import { JournalFilterBar, JournalFilterState } from "./JournalFilterBar";
import { TradeHistoryTable } from "./TradeHistoryTable";
import { TradeDetailDrawer } from "./TradeDetailDrawer";
import { JournalExportModal } from "./JournalExportModal";
import { BookOpen, Download, TrendingUp, Sparkles, Filter } from "lucide-react";

export interface TradeJournalProps {
  closedTrades: Trade[];
  metrics?: {
    totalRealizedPnL: number;
    winRate: number;
    totalTrades: number;
    avgRMultiple: number;
    openPositionCount: number;
    profitFactor?: number;
    disciplineScore?: number;
  };
  accountSize?: number;
  onUpdateTradeNotes?: (tradeId: string, notes: string) => void;
}

const DEFAULT_FILTERS: JournalFilterState = {
  searchQuery: "",
  setupType: "ALL",
  outcome: "ALL",
  marketRegime: "ALL",
  dateRange: "ALL",
  sortBy: "DATE_DESC",
};

export const TradeJournal: React.FC<TradeJournalProps> = ({
  closedTrades = [],
  metrics,
  accountSize = 15000,
  onUpdateTradeNotes,
}) => {
  const [filters, setFilters] = useState<JournalFilterState>(DEFAULT_FILTERS);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Extract unique setup types from closed trades
  const availableSetups = useMemo(() => {
    const set = new Set<string>();
    closedTrades.forEach((t) => {
      if (t.setupType) set.add(t.setupType);
    });
    return Array.from(set);
  }, [closedTrades]);

  // Filtered and sorted closed trades
  const filteredTrades = useMemo(() => {
    return closedTrades
      .filter((t) => {
        // Search query
        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase();
          const matchTicker = t.ticker.toLowerCase().includes(q);
          const matchCompany = t.companyName.toLowerCase().includes(q);
          const matchNotes = (t.notes || "").toLowerCase().includes(q);
          const matchSetup = (t.setupType || "").toLowerCase().includes(q);
          if (!matchTicker && !matchCompany && !matchNotes && !matchSetup) return false;
        }

        // Setup filter
        if (filters.setupType !== "ALL" && t.setupType !== filters.setupType) {
          return false;
        }

        // Outcome filter
        const pnl = t.realizedPnL || 0;
        if (filters.outcome === "WINNERS" && pnl <= 0.01) return false;
        if (filters.outcome === "LOSERS" && pnl >= -0.01) return false;
        if (filters.outcome === "BREAKEVEN" && Math.abs(pnl) > 0.01) return false;

        // Date Range filter
        if (filters.dateRange !== "ALL" && t.closedDate) {
          const tradeTime = new Date(t.closedDate).getTime();
          const now = Date.now();
          const daysDiff = (now - tradeTime) / (1000 * 60 * 60 * 24);
          if (filters.dateRange === "7D" && daysDiff > 7) return false;
          if (filters.dateRange === "30D" && daysDiff > 30) return false;
          if (filters.dateRange === "90D" && daysDiff > 90) return false;
          if (filters.dateRange === "YTD") {
            const tradeYear = new Date(t.closedDate).getFullYear();
            const currentYear = new Date().getFullYear();
            if (tradeYear !== currentYear) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (filters.sortBy === "DATE_DESC") {
          const dateA = a.closedDate || a.createdAt || "";
          const dateB = b.closedDate || b.createdAt || "";
          return dateB.localeCompare(dateA);
        }
        if (filters.sortBy === "DATE_ASC") {
          const dateA = a.closedDate || a.createdAt || "";
          const dateB = b.closedDate || b.createdAt || "";
          return dateA.localeCompare(dateB);
        }
        if (filters.sortBy === "PNL_DESC") {
          return (b.realizedPnL || 0) - (a.realizedPnL || 0);
        }
        if (filters.sortBy === "R_DESC") {
          return (b.rMultiple || 0) - (a.rMultiple || 0);
        }
        return 0;
      });
  }, [closedTrades, filters]);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner & Export Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
            <BookOpen className="h-6 w-6 text-sky-400" />
            <span>Closed Campaign Trade Journal</span>
          </h2>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">
            Audit log with institutional performance analytics, Recharts equity curve, and post-mortem reflections
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsExportOpen(true)}
          className="flex items-center space-x-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-neutral-200 hover:bg-white/[0.08] hover:border-white/20 transition active:scale-95 shadow"
        >
          <Download className="h-4 w-4 text-sky-400" />
          <span>Export Journal</span>
        </button>
      </div>

      {/* 1. Metrics Ribbon */}
      <MetricsRibbon closedTrades={closedTrades} metrics={metrics} />

      {/* 2. Cumulative Equity Curve Chart */}
      <PnLCurveChart closedTrades={closedTrades} initialCapital={accountSize} />

      {/* 3. Multi-Dimensional Filter Bar */}
      <JournalFilterBar
        filters={filters}
        onFilterChange={setFilters}
        onResetFilters={() => setFilters(DEFAULT_FILTERS)}
        availableSetups={availableSetups.length > 0 ? availableSetups : undefined}
      />

      {/* 4. Closed Trade History Table */}
      <TradeHistoryTable
        closedTrades={filteredTrades}
        onSelectTrade={(t) => setSelectedTrade(t)}
      />

      {/* 5. Deep Post-Mortem Drawer */}
      <TradeDetailDrawer
        trade={selectedTrade}
        isOpen={!!selectedTrade}
        onClose={() => setSelectedTrade(null)}
        onUpdateNotes={onUpdateTradeNotes}
      />

      {/* 6. Export Modal */}
      <JournalExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        closedTrades={closedTrades}
        accountSize={accountSize}
      />
    </div>
  );
};

export default TradeJournal;
