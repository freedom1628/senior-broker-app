// Domain Interfaces & Persistence Schemas for Senior Broker
// Supporting Dual-Layer Persistence (L1 In-Memory + LocalStorage + IndexedDB + Prisma Edge Memory)

export type TradeStatus =
  | "WATCHLIST"
  | "PENDING_ENTRY"
  | "ACTIVE"
  | "SCALED_T1"
  | "CLOSED"
  | "CANCELLED"
  | "CLOSED_STOP"
  | "CLOSED_TARGET"
  | "CLOSED_TIME_STOP"
  | "CLOSED_MANUAL";

export type SetupType =
  | "Catalyst Continuation"
  | "Breakout Base"
  | "Post-Earnings Pullback"
  | "Fresh Earnings Gap / Pivot Breakout"
  | "Mean Reversion Bounce"
  | "Cup & Handle / High Tight Flag"
  | string;

export type ExitReason =
  | "STOP_HIT"
  | "T1_REACHED"
  | "T2_REACHED"
  | "TIME_STOP"
  | "MANUAL"
  | "INVALIDATION"
  | string;

export type MarketRegime = "FAVORABLE" | "NEUTRAL" | "HOSTILE";

/**
 * 1. Trade & Campaign Entity
 */
export interface Trade {
  id: string;
  userId?: string;
  ticker: string;
  companyName: string;
  sector?: string;
  status: TradeStatus;
  setupType?: SetupType;
  entryTrigger: number;
  entryCondition?: string | null;
  actualEntry?: number | null;
  entryDate?: string | null; // ISO-8601 UTC
  sharesTotal: number;
  sharesRemaining: number;
  initialStop: number;
  currentStop: number;
  target1: number;
  target2: number;
  rrRatio: number;
  timeStopSessions: number;
  sessionsElapsed: number;
  closedPrice?: number | null;
  closedDate?: string | null; // ISO-8601 UTC
  realizedPnL?: number | null;
  rMultiple?: number | null;
  exitReason?: ExitReason | null;
  notes?: string | null;
  createdAt?: string; // ISO-8601 UTC
  updatedAt?: string; // ISO-8601 UTC
  _version?: number;
}

/**
 * 2. Active Position (Derived Real-Time View)
 */
export interface Position extends Trade {
  status: "ACTIVE" | "SCALED_T1";
  currentPrice?: number;
  unrealizedPnL?: number;
  unrealizedPnLPct?: number;
  openRiskDollars?: number;
  openRiskPct?: number;
  currentRMultiple?: number;
  isStale?: boolean; // sessionsElapsed >= timeStopSessions - 1
  isStopBreakeven?: boolean;
}

/**
 * 3. AI Screener Candidate Signal Entity
 */
export interface Signal {
  id: string;
  researchRunId?: string;
  ticker: string;
  companyName: string;
  setupType: string;
  entryTrigger: number;
  entryCondition?: string;
  stopLoss: number;
  stopRationale?: string;
  target1: number;
  target2: number;
  rrRatio: number;
  timeStopDays?: number;
  positionShares?: number;
  riskAmount?: number;
  catalystDate?: string;
  catalystSummary?: string;
  bearCase?: string;
  score?: number;
  modelSources?: string[];
  status: "WATCHLIST" | "PROMOTED" | "DISMISSED";
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 4. Real-Time Market Quote Snapshot
 */
export interface MarketSnapshot {
  ticker: string;
  name?: string;
  price: number;
  change: number;
  changePct: number;
  high?: number;
  low?: number;
  volume?: number;
  prevClose?: number;
  updatedAt: string;
}

/**
 * 5. Portfolio Sleeve State
 */
export interface PortfolioState {
  userId?: string;
  dedicatedCapital: number; // Default: $15,000.00
  totalCapital?: number; // Alias for dedicatedCapital
  allocatedCapital: number;
  cashAvailable: number;
  cashBalance?: number; // Alias for cashAvailable
  openRiskDollars: number;
  openRiskPct: number;
  floatingPnL: number;
  totalRealizedPnL: number;
  winRate: number;
  profitFactor: number;
  totalTradesCount: number;
  closedTradesCount: number;
  avgRMultiple: number;
  maxOpenPositions: number; // Default: 3
  maxSectorPositions: number; // Default: 2
  maxSleeveRiskPct: number; // Default: 3.0%
  riskPerTradePct: number; // Default: 1.0% ($150 on $15k)
  updatedAt: string;
}

/**
 * 6. Audit Trail Log Entity
 */
export interface AuditLog {
  id: string;
  timestamp: string; // ISO-8601 UTC
  userId?: string;
  actionType:
    | "TRADE_CREATED"
    | "TRADE_ACTIVATED"
    | "POSITION_SCALED_T1"
    | "STOP_ADJUSTED"
    | "TRADE_CLOSED"
    | "TRADE_DELETED"
    | "SETTINGS_UPDATED"
    | "BACKUP_RESTORED"
    | "IMPORT_MERGED";
  entityType: "TRADE" | "SETTINGS" | "PORTFOLIO" | "BACKUP" | "SIGNAL";
  entityId: string;
  previousState?: any;
  newState?: any;
  description: string;
  source: "CLIENT_UI" | "SERVER_POLL" | "BACKUP_IMPORT" | "AI_COACH";
}

/**
 * 7. Journal Entry Entity (Psychology, Lessons, Discipline Score)
 */
export interface JournalEntry {
  id: string;
  tradeId: string;
  ticker: string;
  setupType: string;
  entryDate: string;
  exitDate?: string;
  entryPrice: number;
  exitPrice?: number;
  realizedPnL?: number;
  rMultiple?: number;
  disciplineScore: number; // 1 to 5 scale
  followedRules: boolean;
  thesis: string;
  mistakesOrLessons?: string;
  marketRegimeAtEntry?: MarketRegime;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 8. User Settings
 */
export interface UserSettings {
  id?: string;
  email?: string;
  name?: string;
  accountSize: number; // Dedicated Swing Capital ($15,000 default)
  riskPerTrade: number; // 1.0% default ($150)
  maxSleeveRiskPct: number; // 3.0% default ($450)
  maxOpenPositions: number; // 3 default
  maxSectorPositions?: number; // 2 default
  deskPasscode?: string;
  pinPasscodeHash?: string;
  hasGeminiKey?: boolean;
  hasAnthropicKey?: boolean;
  hasOpenaiKey?: boolean;
  theme?: "dark" | "obsidian" | "light";
  audioEnabled?: boolean;
  soundEnabled?: boolean; // Alias for audioEnabled
  hapticEnabled?: boolean;
  currency?: string;
  updatedAt?: string;
}

/**
 * 9. Unified Storage State Container
 */
export interface PortfolioStorageState {
  portfolio: PortfolioState;
  activeTrades: Trade[];
  pendingTrades: Trade[];
  closedTrades: Trade[];
  journal?: JournalEntry[];
  signals?: Signal[];
  auditLogs?: AuditLog[];
  settings: UserSettings;
  lastSyncedAt: string;
}

export type StorageEventType =
  | "STATE_INITIALIZED"
  | "PORTFOLIO_UPDATED"
  | "TRADE_ADDED"
  | "TRADE_SAVED"
  | "TRADE_UPDATED"
  | "TRADE_DELETED"
  | "TRADES_UPDATED"
  | "POSITION_SCALED"
  | "STOP_ADJUSTED"
  | "SIGNAL_PROMOTED"
  | "SETTINGS_UPDATED"
  | "JOURNAL_ENTRY_SAVED"
  | "SNAPSHOT_RESTORED"
  | "SYNC_COMPLETED";

export interface StorageEventPayload<T = any> {
  type: StorageEventType;
  payload: T;
  sourceTabId: string;
  timestamp: number;
}

export type StorageEventListener<T = any> = (event: StorageEventPayload<T> | T, type?: string) => void;
export type StorageListener = (type: string, data: any) => void;

export interface StorageAdapter {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
  clear(): Promise<void> | void;
}
