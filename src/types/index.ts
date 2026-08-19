import type React from "react";
export * from "./auth";

// Navigation Types
export type NavigationTab = 
  | "COACH"       // AI Swing Coach Briefing & Prioritized Moves
  | "POSITIONS"   // Active Trades & Watch Queue Price Ladders
  | "SCREENER"    // Multi-LLM Frontier Research & Arbiter
  | "LEARNING"    // Investor Education & Sizing Calculator
  | "JOURNAL"     // Closed Trade Analytics & P&L Curve
  | "SETTINGS";   // Capital Allocation & API Keys

export interface NavigationBadgeCounts {
  activePositions: number;
  pendingOrders: number;
  unreadAlerts: number;
  highUrgencyMoves?: number;
  candidateSetups?: number;
}

export interface TabItem {
  id: NavigationTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string; // e.g. "sky", "emerald", "indigo", "purple", "amber", "slate"
  badgeCount?: number;
  badgeTone?: "emerald" | "sky" | "rose" | "amber";
}

// Portfolio & Chart Visualization Types
export type TimeframeOption = "1D" | "1W" | "1M" | "1Y";

export interface EquityDataPoint {
  timestamp: string; // ISO string or display label
  timeLabel: string; // e.g. "09:30 AM", "Mon", "Aug 15"
  equity: number; // e.g. 15245.50
  changeDollars: number; // e.g. +245.50
  changePct: number; // e.g. +1.64
  benchmark?: number; // Optional benchmark line
}

export interface PortfolioSummaryMetrics {
  dedicatedCapital: number;
  allocatedCapital: number;
  cashAvailable: number;
  openRiskDollars: number;
  openRiskPct: number;
  floatingPnL: number;
  floatingPnLPct: number;
  totalSleeveValue: number;
  activePositionsCount: number;
  isRiskSafe: boolean; // openRiskPct <= maxSleeveRiskPct (3.0%)
  riskCapacityRemaining: number; // 3.0% - openRiskPct
}

export interface SparklineChartProps {
  data?: EquityDataPoint[];
  timeframe: TimeframeOption;
  onTimeframeChange?: (tf: TimeframeOption) => void;
  height?: number;
  startingCapital?: number;
  currentEquity?: number;
  className?: string;
  showControls?: boolean;
}

export interface PortfolioSummaryCardProps {
  accountSize?: number;
  riskPerTrade?: number;
  maxSleeveRiskPct?: number;
  activeTrades: any[];
  marketQuotes: Record<string, any>;
  equityHistory?: Record<TimeframeOption, EquityDataPoint[]>;
  onOpenAddTrade?: () => void;
  onOpenImport?: () => void;
  onOpenSettings?: () => void;
  onNavigateToTab?: (tab: NavigationTab) => void;
  className?: string;
}
