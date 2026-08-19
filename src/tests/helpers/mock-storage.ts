// Pure in-memory Dual-Layer Persistence Simulator for Unit and E2E Testing
// Mimics browser LocalStorage + Universal Cloudflare Edge D1/Memory store + Snapshot Backup Engine

export interface StoredTrade {
  id: string;
  ticker: string;
  companyName: string;
  status: "WATCHLIST" | "PENDING_ENTRY" | "ACTIVE" | "SCALED_T1" | "CLOSED" | "CANCELLED";
  setupType?: string;
  entryTrigger: number;
  actualEntry?: number | null;
  entryDate?: string;
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
  closedDate?: string | null;
  realizedPnL?: number;
  rMultiple?: number;
  exitReason?: string | null;
  notes?: string;
  updatedAt?: string;
}

export interface UserSettings {
  accountSize: number;
  riskPerTrade: number;
  maxSleeveRiskPct: number;
  maxSectorPositions: number;
  deskPasscode: string;
  audioEnabled: boolean;
  theme: "dark" | "obsidian" | "light";
  currency: string;
}

export interface StoredNotification {
  id: string;
  ticker: string;
  type: "ENTRY_TRIGGERED" | "STOP_ALERT" | "TARGET_1_HIT" | "TARGET_2_HIT" | "TIME_STOP_WARNING" | "RISK_ALERT";
  title: string;
  message: string;
  isRead: boolean;
  timestamp: string;
}

export interface BackupSnapshot {
  version: string;
  exportedAt: string;
  appVersion: string;
  settings: UserSettings;
  trades: StoredTrade[];
  notifications: StoredNotification[];
  meta?: Record<string, any>;
}

export interface RestoreResult {
  success: boolean;
  restoredTradesCount: number;
  restoredNotificationsCount: number;
  error?: string;
}

export class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  dump(): Record<string, string> {
    const obj: Record<string, string> = {};
    for (const [k, v] of this.store.entries()) {
      obj[k] = v;
    }
    return obj;
  }

  load(data: Record<string, string>): void {
    this.store.clear();
    for (const [k, v] of Object.entries(data)) {
      this.store.set(k, v);
    }
  }
}

export class MockDualLayerStorage {
  public local: MockLocalStorage;
  private edgeStore: Map<string, any> = new Map();
  public isOnline: boolean = true;
  public pendingSyncQueue: Array<{ action: string; key: string; payload: any; timestamp: number }> = [];
  public syncFailureCount: number = 0;

  constructor() {
    this.local = new MockLocalStorage();
    this.seedDefaultSettings();
  }

  public seedDefaultSettings(): void {
    const defaultSettings: UserSettings = {
      accountSize: 15000.0, // $15,000 default dedicated swing sleeve
      riskPerTrade: 1.0,    // 1% ($150)
      maxSleeveRiskPct: 3.0, // 3% ($450 total open risk cap)
      maxSectorPositions: 2, // max 2 per sector
      deskPasscode: "1234",
      audioEnabled: true,
      theme: "obsidian",
      currency: "USD",
    };
    this.saveSettings(defaultSettings);
  }

  public getSettings(): UserSettings {
    const raw = this.local.getItem("sb_settings");
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // Corrupt storage recovery
      }
    }
    return {
      accountSize: 15000.0,
      riskPerTrade: 1.0,
      maxSleeveRiskPct: 3.0,
      maxSectorPositions: 2,
      deskPasscode: "1234",
      audioEnabled: true,
      theme: "obsidian",
      currency: "USD",
    };
  }

  public saveSettings(settings: Partial<UserSettings>): UserSettings {
    const current = this.getSettings();
    const updated: UserSettings = { ...current, ...settings };
    const serialized = JSON.stringify(updated);
    this.local.setItem("sb_settings", serialized);

    if (this.isOnline) {
      this.edgeStore.set("sb_settings", updated);
    } else {
      this.pendingSyncQueue.push({
        action: "UPDATE_SETTINGS",
        key: "sb_settings",
        payload: updated,
        timestamp: Date.now(),
      });
    }

    return updated;
  }

  // Trade persistence methods
  public getTrades(): StoredTrade[] {
    const raw = this.local.getItem("sb_trades");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Fallback
      }
    }
    return [];
  }

  public saveTrades(trades: StoredTrade[]): void {
    const serialized = JSON.stringify(trades);
    this.local.setItem("sb_trades", serialized);

    if (this.isOnline) {
      this.edgeStore.set("sb_trades", [...trades]);
    } else {
      this.pendingSyncQueue.push({
        action: "SYNC_TRADES",
        key: "sb_trades",
        payload: trades,
        timestamp: Date.now(),
      });
    }
  }

  public addOrUpdateTrade(trade: StoredTrade): StoredTrade {
    const trades = this.getTrades();
    const index = trades.findIndex(t => t.id === trade.id);
    const updatedTrade = { ...trade, updatedAt: new Date().toISOString() };

    if (index >= 0) {
      trades[index] = updatedTrade;
    } else {
      trades.push(updatedTrade);
    }

    this.saveTrades(trades);
    return updatedTrade;
  }

  public deleteTrade(tradeId: string): boolean {
    const trades = this.getTrades();
    const initialLen = trades.length;
    const filtered = trades.filter(t => t.id !== tradeId);
    if (filtered.length !== initialLen) {
      this.saveTrades(filtered);
      return true;
    }
    return false;
  }

  // Notification persistence
  public getNotifications(): StoredNotification[] {
    const raw = this.local.getItem("sb_notifications");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  }

  public addNotification(n: Omit<StoredNotification, "id" | "timestamp">): StoredNotification {
    const notifications = this.getNotifications();
    const item: StoredNotification = {
      ...n,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    notifications.unshift(item);
    this.local.setItem("sb_notifications", JSON.stringify(notifications.slice(0, 100)));
    return item;
  }

  // Snapshot Backup & Restore Engine
  public exportSnapshot(): BackupSnapshot {
    return {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      appVersion: "Senior Broker 2.0",
      settings: this.getSettings(),
      trades: this.getTrades(),
      notifications: this.getNotifications(),
    };
  }

  public validateSnapshot(data: any): { valid: boolean; reason?: string } {
    if (!data || typeof data !== "object") {
      return { valid: false, reason: "Snapshot payload is not a valid JSON object" };
    }
    if (!data.version) {
      return { valid: false, reason: "Missing snapshot version field" };
    }
    if (!data.settings || typeof data.settings !== "object") {
      return { valid: false, reason: "Missing or invalid settings block" };
    }
    if (!Array.isArray(data.trades)) {
      return { valid: false, reason: "Trades field must be an array" };
    }
    for (let i = 0; i < data.trades.length; i++) {
      const t = data.trades[i];
      if (!t.id || !t.ticker || typeof t.entryTrigger !== "number" || typeof t.initialStop !== "number") {
        return { valid: false, reason: `Invalid trade item at index ${i}: missing required fields` };
      }
    }
    return { valid: true };
  }

  public importSnapshot(snapshotData: BackupSnapshot | string): RestoreResult {
    let parsed: any;
    try {
      parsed = typeof snapshotData === "string" ? JSON.parse(snapshotData) : snapshotData;
    } catch (err) {
      return {
        success: false,
        restoredTradesCount: 0,
        restoredNotificationsCount: 0,
        error: `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const validation = this.validateSnapshot(parsed);
    if (!validation.valid) {
      return {
        success: false,
        restoredTradesCount: 0,
        restoredNotificationsCount: 0,
        error: validation.reason || "Validation failed",
      };
    }

    // Atomic Restore
    try {
      this.saveSettings(parsed.settings);
      this.saveTrades(parsed.trades || []);
      if (Array.isArray(parsed.notifications)) {
        this.local.setItem("sb_notifications", JSON.stringify(parsed.notifications));
      }

      return {
        success: true,
        restoredTradesCount: parsed.trades?.length || 0,
        restoredNotificationsCount: parsed.notifications?.length || 0,
      };
    } catch (err) {
      return {
        success: false,
        restoredTradesCount: 0,
        restoredNotificationsCount: 0,
        error: `Atomic restore failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // Network sync simulation
  public setOnline(online: boolean): void {
    this.isOnline = online;
    if (online && this.pendingSyncQueue.length > 0) {
      this.flushSyncQueue();
    }
  }

  public flushSyncQueue(): number {
    const count = this.pendingSyncQueue.length;
    while (this.pendingSyncQueue.length > 0) {
      const item = this.pendingSyncQueue.shift();
      if (item) {
        this.edgeStore.set(item.key, item.payload);
      }
    }
    return count;
  }

  public resetAll(): void {
    this.local.clear();
    this.edgeStore.clear();
    this.pendingSyncQueue = [];
    this.seedDefaultSettings();
  }
}

// Singleton helper for test suites
export const globalMockStorage = new MockDualLayerStorage();
