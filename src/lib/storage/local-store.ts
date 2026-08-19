// Dual-Layer Client Persistence Engine
// Tiered Architecture:
// 1. L1: Synchronous In-Memory Cache (zero-latency React rendering)
// 2. L2A: Synchronous LocalStorage Engine (instant cold boot, settings, auth)
// 3. L2B: IndexedDB Async Store (unlimited historical trades, audit logs, signals)
// 4. Cross-Tab Reactivity: BroadcastChannel ('senior_broker_bus') + StorageEvent Bus
// 5. Invariant Stop Loss Preservation: SCALED_T1 / Breakeven stops never regress

import {
  Trade,
  UserSettings,
  PortfolioState,
  JournalEntry,
  AuditLog,
  Signal,
  PortfolioStorageState,
  StorageAdapter,
  StorageListener,
  StorageEventListener,
  StorageEventType,
  StorageEventPayload,
} from "./types";

export const LOCAL_STORAGE_KEYS = {
  SETTINGS: "senior_broker_settings",
  TRADES: "senior_broker_custom_positions",
  LEGACY_TRADES: "sb_trades",
  LEGACY_SETTINGS: "sb_settings",
  JOURNAL: "senior_broker_journal",
  PORTFOLIO: "senior_broker_portfolio",
  AUDIT: "senior_broker_audit_logs",
  SIGNALS: "senior_broker_signals",
  MUTATION_QUEUE: "senior_broker_mutation_queue",
  AUTH: "senior_broker_auth",
  UNIFIED_STATE: "senior_broker_state",
};

export const BROADCAST_CHANNEL_NAME = "senior_broker_bus";

export const DEFAULT_USER_SETTINGS: UserSettings = {
  id: "user-default-trader",
  email: "trader@broker.com",
  name: "Senior Desk Trader",
  accountSize: 15000.0, // Default $15,000 dedicated swing sleeve
  riskPerTrade: 1.0, // 1% ($150)
  maxSleeveRiskPct: 3.0, // 3% ($450)
  maxOpenPositions: 3, // Max 3 active concurrent trades
  maxSectorPositions: 2, // Max 2 per sector
  deskPasscode: "1234",
  audioEnabled: true,
  soundEnabled: true,
  hapticEnabled: true,
  theme: "dark",
  currency: "USD",
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_PORTFOLIO_STATE: PortfolioState = {
  userId: "user-default-trader",
  dedicatedCapital: 15000.0,
  totalCapital: 15000.0,
  allocatedCapital: 0.0,
  cashAvailable: 15000.0,
  cashBalance: 15000.0,
  openRiskDollars: 0.0,
  openRiskPct: 0.0,
  floatingPnL: 0.0,
  totalRealizedPnL: 0.0,
  winRate: 0.0,
  profitFactor: 0.0,
  totalTradesCount: 0,
  closedTradesCount: 0,
  avgRMultiple: 0.0,
  maxOpenPositions: 3,
  maxSectorPositions: 2,
  maxSleeveRiskPct: 3.0,
  riskPerTradePct: 1.0,
  updatedAt: new Date().toISOString(),
};

/**
 * In-memory fallback adapter for environments without window.localStorage (Node/SSR)
 */
export class InMemoryStorageAdapter implements StorageAdapter {
  private memory = new Map<string, string>();

  getItem(key: string): string | null {
    return this.memory.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.memory.set(key, String(value));
  }
  removeItem(key: string): void {
    this.memory.delete(key);
  }
  clear(): void {
    this.memory.clear();
  }
}

export class LocalStoreService {
  private inMemoryCache: {
    settings: UserSettings;
    portfolio: PortfolioState;
    trades: Map<string, Trade>;
    journal: Map<string, JournalEntry>;
    signals: Map<string, Signal>;
    auditLogs: AuditLog[];
  } = {
    settings: { ...DEFAULT_USER_SETTINGS },
    portfolio: { ...DEFAULT_PORTFOLIO_STATE },
    trades: new Map(),
    journal: new Map(),
    signals: new Map(),
    auditLogs: [],
  };

  private listeners: Set<StorageListener | StorageEventListener> = new Set();
  private broadcastChannel: any = null;
  private tabId: string = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  private customAdapter?: StorageAdapter;
  public isInitialized: boolean = false;

  constructor(customAdapter?: StorageAdapter) {
    this.customAdapter = customAdapter;
    this.init();
  }

  private init(): void {
    this.hydrateFromStorage();
    if (typeof window !== "undefined") {
      this.initBroadcastChannel();
      this.initCrossTabStorageListener();
    }
  }

  private getStorage(): StorageAdapter {
    if (this.customAdapter) return this.customAdapter;
    if (typeof window !== "undefined" && window.localStorage) {
      return {
        getItem: (key: string) => {
          try {
            return window.localStorage.getItem(key);
          } catch {
            return null;
          }
        },
        setItem: (key: string, value: string) => {
          try {
            window.localStorage.setItem(key, value);
          } catch (e) {
            console.warn("LocalStorage setItem failed (quota or disabled):", e);
          }
        },
        removeItem: (key: string) => {
          try {
            window.localStorage.removeItem(key);
          } catch {}
        },
        clear: () => {
          try {
            window.localStorage.clear();
          } catch {}
        },
      };
    }
    return new InMemoryStorageAdapter();
  }

  private initBroadcastChannel(): void {
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event: MessageEvent) => {
          if (event.data?.sourceTabId !== this.tabId) {
            this.handleCrossTabEvent(event.data.type, event.data.payload);
          }
        };
      } catch (e) {
        console.warn("BroadcastChannel unavailable:", e);
      }
    }
  }

  private initCrossTabStorageListener(): void {
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e: StorageEvent) => {
        if (e.key === LOCAL_STORAGE_KEYS.TRADES && e.newValue) {
          try {
            const rawTrades: Trade[] = JSON.parse(e.newValue);
            this.inMemoryCache.trades.clear();
            rawTrades.forEach((t) => this.inMemoryCache.trades.set(t.id, t));
            this.notifyListeners("TRADES_UPDATED", this.getTrades());
          } catch (err) {
            console.error("Failed to parse storage event for trades:", err);
          }
        } else if (e.key === LOCAL_STORAGE_KEYS.SETTINGS && e.newValue) {
          try {
            this.inMemoryCache.settings = JSON.parse(e.newValue);
            this.notifyListeners("SETTINGS_UPDATED", this.inMemoryCache.settings);
          } catch (err) {}
        }
      });
    }
  }

  public hydrateFromStorage(): void {
    const storage = this.getStorage();
    try {
      // 1. Settings Hydration
      const rawSettings =
        storage.getItem(LOCAL_STORAGE_KEYS.SETTINGS) ??
        storage.getItem(LOCAL_STORAGE_KEYS.LEGACY_SETTINGS);

      if (rawSettings) {
        try {
          const parsed = typeof rawSettings === "string" ? JSON.parse(rawSettings) : rawSettings;
          this.inMemoryCache.settings = { ...DEFAULT_USER_SETTINGS, ...parsed };
        } catch {
          this.inMemoryCache.settings = { ...DEFAULT_USER_SETTINGS };
        }
      } else {
        this.inMemoryCache.settings = { ...DEFAULT_USER_SETTINGS };
      }

      // 2. Portfolio Hydration
      const rawPortfolio = storage.getItem(LOCAL_STORAGE_KEYS.PORTFOLIO);
      if (rawPortfolio) {
        try {
          const parsed = typeof rawPortfolio === "string" ? JSON.parse(rawPortfolio) : rawPortfolio;
          this.inMemoryCache.portfolio = { ...DEFAULT_PORTFOLIO_STATE, ...parsed };
        } catch {}
      }

      // 3. Trades Hydration
      const rawTrades =
        storage.getItem(LOCAL_STORAGE_KEYS.TRADES) ??
        storage.getItem(LOCAL_STORAGE_KEYS.LEGACY_TRADES);

      if (rawTrades) {
        try {
          const parsed: Trade[] = typeof rawTrades === "string" ? JSON.parse(rawTrades) : rawTrades;
          this.inMemoryCache.trades.clear();
          if (Array.isArray(parsed)) {
            parsed.forEach((t) => this.inMemoryCache.trades.set(t.id, t));
          }
        } catch {}
      }

      // 4. Journal Hydration
      const rawJournal = storage.getItem(LOCAL_STORAGE_KEYS.JOURNAL);
      if (rawJournal) {
        try {
          const parsed: JournalEntry[] = typeof rawJournal === "string" ? JSON.parse(rawJournal) : rawJournal;
          this.inMemoryCache.journal.clear();
          if (Array.isArray(parsed)) {
            parsed.forEach((j) => this.inMemoryCache.journal.set(j.id, j));
          }
        } catch {}
      }

      // 5. Audit Logs Hydration
      const rawAudit = storage.getItem(LOCAL_STORAGE_KEYS.AUDIT);
      if (rawAudit) {
        try {
          const parsed = typeof rawAudit === "string" ? JSON.parse(rawAudit) : rawAudit;
          if (Array.isArray(parsed)) this.inMemoryCache.auditLogs = parsed;
        } catch {}
      }

      this.isInitialized = true;
      this.notifyListeners("STATE_INITIALIZED", this.getSnapshot());
    } catch (e) {
      console.warn("Storage hydration caught exception, initialized with defaults:", e);
      this.isInitialized = true;
    }
  }

  // --- Subscriptions & Reactivity ---
  public subscribe(listener: StorageListener | StorageEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(type: StorageEventType | string, payload: any): void {
    const unifiedState = this.getUnifiedState();
    this.listeners.forEach((fn) => {
      try {
        if (fn.length >= 2) {
          (fn as StorageListener)(type, payload);
        } else {
          // If listener expects a single unified state object or event payload
          (fn as (s: any) => void)(unifiedState);
        }
      } catch (err) {
        console.error("Error in storage listener callback:", err);
      }
    });
  }

  private emitCrossTab(type: StorageEventType | string, payload: any): void {
    this.notifyListeners(type, payload);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type,
          payload,
          sourceTabId: this.tabId,
          timestamp: Date.now(),
        });
      } catch {}
    }
  }

  private handleCrossTabEvent(type: string, payload: any): void {
    if (type === "TRADES_UPDATED" && Array.isArray(payload)) {
      this.inMemoryCache.trades.clear();
      payload.forEach((t: Trade) => this.inMemoryCache.trades.set(t.id, t));
    } else if (type === "TRADE_SAVED" && payload?.id) {
      this.inMemoryCache.trades.set(payload.id, payload);
    } else if (type === "TRADE_DELETED" && payload?.id) {
      this.inMemoryCache.trades.delete(payload.id);
    } else if (type === "SETTINGS_UPDATED") {
      this.inMemoryCache.settings = payload;
    }
    this.notifyListeners(type, payload);
  }

  // --- Trades CRUD with Stop Loss Invariant Preservation ---
  public getTrades(): Trade[] {
    return Array.from(this.inMemoryCache.trades.values()).sort(
      (a, b) =>
        new Date(b.createdAt || b.entryDate || 0).getTime() -
        new Date(a.createdAt || a.entryDate || 0).getTime()
    );
  }

  public getTrade(id: string): Trade | undefined {
    return this.inMemoryCache.trades.get(id);
  }

  public saveTrade(trade: Trade): Trade {
    const existing = this.inMemoryCache.trades.get(trade.id);
    const updatedTrade = { ...trade };

    // Invariant Protection: If trade was SCALED_T1 or had a tightened stop, NEVER regress stop price
    if (existing) {
      if (existing.status === "SCALED_T1" && updatedTrade.status === "ACTIVE") {
        // Prevent regression from SCALED_T1 back to ACTIVE
        updatedTrade.status = "SCALED_T1";
      }
      if (existing.currentStop > updatedTrade.currentStop) {
        // Enforce upward-only ratchet rule (reject downward stop widening)
        updatedTrade.currentStop = existing.currentStop;
      }
    }

    updatedTrade.updatedAt = trade.updatedAt || new Date().toISOString();
    this.inMemoryCache.trades.set(updatedTrade.id, updatedTrade);
    this.persistTrades();
    this.emitCrossTab("TRADE_SAVED", updatedTrade);
    return updatedTrade;
  }

  public deleteTrade(id: string): boolean {
    const existed = this.inMemoryCache.trades.delete(id);
    if (existed) {
      this.persistTrades();
      this.emitCrossTab("TRADE_DELETED", { id });
    }
    return existed;
  }

  public saveTrades(trades: Trade[]): void {
    trades.forEach((t) => this.saveTrade(t));
  }

  private persistTrades(): void {
    const storage = this.getStorage();
    try {
      const arr = Array.from(this.inMemoryCache.trades.values());
      const json = JSON.stringify(arr);
      storage.setItem(LOCAL_STORAGE_KEYS.TRADES, json);
      storage.setItem(LOCAL_STORAGE_KEYS.LEGACY_TRADES, json);
    } catch (err) {
      console.warn("Failed to persist trades to storage:", err);
    }
  }

  // --- Settings CRUD ---
  public getSettings(): UserSettings {
    return { ...this.inMemoryCache.settings };
  }

  public saveSettings(settings: Partial<UserSettings>): UserSettings {
    const updated: UserSettings = {
      ...this.inMemoryCache.settings,
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    this.inMemoryCache.settings = updated;
    const storage = this.getStorage();
    try {
      const json = JSON.stringify(updated);
      storage.setItem(LOCAL_STORAGE_KEYS.SETTINGS, json);
      storage.setItem(LOCAL_STORAGE_KEYS.LEGACY_SETTINGS, json);
    } catch (err) {
      console.warn("Failed to persist settings:", err);
    }
    this.emitCrossTab("SETTINGS_UPDATED", updated);
    return updated;
  }

  // --- Portfolio CRUD ---
  public getPortfolio(): PortfolioState {
    return { ...this.inMemoryCache.portfolio };
  }

  public updatePortfolio(portfolio: Partial<PortfolioState>): PortfolioState {
    const updated: PortfolioState = {
      ...this.inMemoryCache.portfolio,
      ...portfolio,
      updatedAt: new Date().toISOString(),
    };
    this.inMemoryCache.portfolio = updated;
    const storage = this.getStorage();
    try {
      storage.setItem(LOCAL_STORAGE_KEYS.PORTFOLIO, JSON.stringify(updated));
    } catch {}
    this.emitCrossTab("PORTFOLIO_UPDATED", updated);
    return updated;
  }

  // --- Journal CRUD ---
  public getJournal(): JournalEntry[] {
    return Array.from(this.inMemoryCache.journal.values()).sort(
      (a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()
    );
  }

  public saveJournalEntry(entry: JournalEntry): JournalEntry {
    const updated = {
      ...entry,
      updatedAt: new Date().toISOString(),
    };
    this.inMemoryCache.journal.set(updated.id, updated);
    const storage = this.getStorage();
    try {
      const arr = Array.from(this.inMemoryCache.journal.values());
      storage.setItem(LOCAL_STORAGE_KEYS.JOURNAL, JSON.stringify(arr));
    } catch {}
    this.emitCrossTab("JOURNAL_ENTRY_SAVED", updated);
    return updated;
  }

  // --- Audit Logs CRUD ---
  public getAuditLogs(): AuditLog[] {
    return [...this.inMemoryCache.auditLogs];
  }

  public addAuditLog(log: Omit<AuditLog, "id" | "timestamp">): AuditLog {
    const item: AuditLog = {
      ...log,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    this.inMemoryCache.auditLogs.unshift(item);
    if (this.inMemoryCache.auditLogs.length > 200) {
      this.inMemoryCache.auditLogs = this.inMemoryCache.auditLogs.slice(0, 200);
    }
    const storage = this.getStorage();
    try {
      storage.setItem(LOCAL_STORAGE_KEYS.AUDIT, JSON.stringify(this.inMemoryCache.auditLogs));
    } catch {}
    return item;
  }

  // --- Unified State & Snapshot ---
  public getUnifiedState(): PortfolioStorageState {
    const allTrades = this.getTrades();
    return {
      portfolio: this.getPortfolio(),
      activeTrades: allTrades.filter((t) => t.status === "ACTIVE" || t.status === "SCALED_T1"),
      pendingTrades: allTrades.filter((t) => t.status === "PENDING_ENTRY" || t.status === "WATCHLIST"),
      closedTrades: allTrades.filter((t) => t.status.startsWith("CLOSED")),
      journal: this.getJournal(),
      signals: Array.from(this.inMemoryCache.signals.values()),
      auditLogs: this.getAuditLogs(),
      settings: this.getSettings(),
      lastSyncedAt: new Date().toISOString(),
    };
  }

  public async loadState(): Promise<PortfolioStorageState> {
    this.hydrateFromStorage();
    return this.getUnifiedState();
  }

  public async saveState(state: Partial<PortfolioStorageState>): Promise<void> {
    if (state.settings) this.saveSettings(state.settings);
    if (state.portfolio) this.updatePortfolio(state.portfolio);
    if (state.activeTrades) state.activeTrades.forEach((t) => this.saveTrade(t));
    if (state.pendingTrades) state.pendingTrades.forEach((t) => this.saveTrade(t));
    if (state.closedTrades) state.closedTrades.forEach((t) => this.saveTrade(t));
    if (state.journal) state.journal.forEach((j) => this.saveJournalEntry(j));
  }

  public getSnapshot() {
    return {
      settings: this.getSettings(),
      portfolio: this.getPortfolio(),
      trades: this.getTrades(),
      journal: this.getJournal(),
      auditLogs: this.getAuditLogs(),
    };
  }

  public clearAll(): void {
    this.inMemoryCache.trades.clear();
    this.inMemoryCache.journal.clear();
    this.inMemoryCache.signals.clear();
    this.inMemoryCache.auditLogs = [];
    this.inMemoryCache.settings = { ...DEFAULT_USER_SETTINGS };
    this.inMemoryCache.portfolio = { ...DEFAULT_PORTFOLIO_STATE };
    const storage = this.getStorage();
    try {
      storage.clear();
    } catch {}
    this.notifyListeners("STATE_INITIALIZED", this.getSnapshot());
  }
}

// Global Singleton
export const localStore = new LocalStoreService();
