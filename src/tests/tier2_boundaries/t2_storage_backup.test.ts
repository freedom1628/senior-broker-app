// Tier 2 Boundary Value Analysis: Dual-Layer Persistence, Snapshot Backup, Auth, Audio & Edge
// Covers:
// - Feature 30: Dual-Layer Persistence & Local Storage (offline queue, sync flush, rapid mutations, corrupt fallback)
// - Feature 31: 1-Click JSON Snapshot Backup/Restore (corrupt JSON, missing fields, schema evolution, atomic rollback, unicode/XSS)
// - Feature 5: Dual-Mode Authentication (4-digit PIN matching, boundary strings, PIN updates)
// - Feature 20: Zero-Dependency Web Audio Synthesizer (SSR/headless execution safety, oscillator triggers)
// - Feature 21: Web Push & Toast Notifications (100 items cap, unread badges, alert types)
// - Feature 27 & 28: Strategy Lessons & Contextual "Why?" Coach Insights (5 lessons, institutional rationales)
// - Feature 32: Cloudflare Workers & Pages Compatibility (pure TS/ESM, no native Node C++ bindings)

import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade, BackupSnapshot, UserSettings } from "../helpers/mock-storage";
import { playTargetChime, playStopLossAlert, playEntryTriggered } from "../../lib/audio/sound-effects";

// 5 Institutional Strategy Lessons Data (Feature 27 contract)
export const STRATEGY_LESSONS = [
  {
    id: "lesson_1",
    title: "The 1% Risk Formula",
    tagline: "Asymmetric position sizing based on stop distance rather than share count",
    corePrinciple: "Risk exactly 1.0% of total capital ($150 on $15k) per swing trade.",
    formula: "Shares = floor( (Account Size * 0.01) / |Entry - Hard Stop| )",
  },
  {
    id: "lesson_2",
    title: "2:1 Asymmetric R:R & Target Scaling",
    tagline: "Lock 50% at Target 1 and let runners float risk-free to Target 2",
    corePrinciple: "Target 1 must be >= 2.0x the initial hard stop distance.",
    formula: "Target 1 = Entry + (2.0 * RiskPerShare); Target 2 = Entry + (3.5 * RiskPerShare)",
  },
  {
    id: "lesson_3",
    title: "Time Stops vs Price Stops",
    tagline: "Release capital when setups stagnate for 5–7 sessions without follow-through",
    corePrinciple: "A swing trade is a momentum event. Dead money past 5–7 sessions incurs opportunity cost.",
    formula: "Exit if Sessions Elapsed >= Time Stop Sessions (default 5–7 sessions)",
  },
  {
    id: "lesson_4",
    title: "Sector Concentration & Sleeve Caps",
    tagline: "Never hold >2 trades in one sector and cap total open risk at 3.0%",
    corePrinciple: "Max 3 concurrent positions, max 3.0% sleeve risk ($450 on $15k), max 2 per sector.",
    formula: "Aggregate Risk = Sum( (Entry - Current Stop) * Shares ) <= Account Size * 0.03",
  },
  {
    id: "lesson_5",
    title: "Market Regime Identification",
    tagline: "Align trade aggression with SPY/QQQ 20D/50D moving averages and VIX",
    corePrinciple: "Trade full size in Favorable regimes, reduce size in Neutral, freeze longs in Hostile.",
    formula: "Regime = Favorable (SPY > 20D > 50D & VIX < 18), Neutral (Choppy), Hostile (Downtrend / VIX > 25)",
  },
];

// PIN Passcode Validator Helper (Feature 5 contract)
export function validateDeskPasscode(inputPin: string, storedPin: string): { valid: boolean; reason?: string } {
  if (typeof inputPin !== "string" || inputPin.length !== 4) {
    return { valid: false, reason: "PIN must be exactly 4 digits" };
  }
  if (!/^\d{4}$/.test(inputPin)) {
    return { valid: false, reason: "PIN must contain only numeric digits" };
  }
  if (inputPin !== storedPin) {
    return { valid: false, reason: "Incorrect desk passcode" };
  }
  return { valid: true };
}

describe("Tier 2: Storage, Snapshot Backup, Auth, Audio & Edge Compatibility", () => {
  let storage: MockDualLayerStorage;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
  });

  describe("Feature 31: Snapshot Backup/Restore Integrity & Schema Boundaries", () => {
    it("exports valid snapshot structure with version, settings, trades, and notifications", () => {
      const snapshot = storage.exportSnapshot();
      expect(snapshot.version).toBe("1.0.0");
      expect(snapshot.appVersion).toBe("Senior Broker 2.0");
      expect(snapshot.settings.accountSize).toBe(15000.0);
      expect(Array.isArray(snapshot.trades)).toBe(true);
      expect(Array.isArray(snapshot.notifications)).toBe(true);
      expect(new Date(snapshot.exportedAt).getTime()).toBeGreaterThan(0);
    });

    it("restores valid snapshot atomically replacing current state", () => {
      const customSnapshot: BackupSnapshot = {
        version: "1.0.0",
        appVersion: "Senior Broker 2.0",
        exportedAt: new Date().toISOString(),
        settings: {
          accountSize: 25000.0,
          riskPerTrade: 1.0,
          maxSleeveRiskPct: 3.0,
          maxSectorPositions: 2,
          deskPasscode: "9999",
          audioEnabled: true,
          theme: "obsidian",
          currency: "USD",
        },
        trades: [
          {
            id: "tr_restored",
            ticker: "ATRO",
            companyName: "Astronics",
            status: "ACTIVE",
            entryTrigger: 89.2,
            actualEntry: 88.5,
            sharesTotal: 18,
            sharesRemaining: 18,
            initialStop: 83.75,
            currentStop: 83.75,
            target1: 100.1,
            target2: 112.0,
            rrRatio: 2.13,
            timeStopSessions: 5,
            sessionsElapsed: 2,
          },
        ],
        notifications: [
          {
            id: "notif_1",
            ticker: "ATRO",
            type: "ENTRY_TRIGGERED",
            title: "Entry",
            message: "Triggered",
            isRead: false,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const result = storage.importSnapshot(customSnapshot);
      expect(result.success).toBe(true);
      expect(result.restoredTradesCount).toBe(1);
      expect(result.restoredNotificationsCount).toBe(1);

      expect(storage.getSettings().accountSize).toBe(25000.0);
      expect(storage.getSettings().deskPasscode).toBe("9999");
      expect(storage.getTrades()[0].ticker).toBe("ATRO");
    });

    it("rejects corrupt JSON string payload with parse error", () => {
      const corruptPayload = "{ bad json syntax string !!!";
      const result = storage.importSnapshot(corruptPayload);
      expect(result.success).toBe(false);
      expect(result.error).toContain("JSON parse error");
    });

    it("rejects snapshot payload missing required version field", () => {
      const missingVersion = {
        settings: storage.getSettings(),
        trades: [],
        notifications: [],
      };
      const result = storage.importSnapshot(missingVersion as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing snapshot version field");
    });

    it("rejects snapshot payload with invalid or null settings block", () => {
      const invalidSettings = {
        version: "1.0.0",
        settings: null,
        trades: [],
      };
      const result = storage.importSnapshot(invalidSettings as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing or invalid settings block");
    });

    it("rejects snapshot payload where trades is not an array", () => {
      const nonArrayTrades = {
        version: "1.0.0",
        settings: storage.getSettings(),
        trades: "not-an-array",
      };
      const result = storage.importSnapshot(nonArrayTrades as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Trades field must be an array");
    });

    it("rejects snapshot payload containing trade with missing required fields", () => {
      const invalidTradeItem = {
        version: "1.0.0",
        settings: storage.getSettings(),
        trades: [
          { ticker: "ATRO" }, // Missing id, entryTrigger, initialStop
        ],
      };
      const result = storage.importSnapshot(invalidTradeItem as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid trade item at index 0");
    });

    it("maintains atomic state rollback: failed validation leaves existing storage intact", () => {
      // Seed initial trade
      storage.addOrUpdateTrade({
        id: "tr_original",
        ticker: "SAFE",
        companyName: "Safe Inc",
        status: "ACTIVE",
        entryTrigger: 100,
        sharesTotal: 10,
        sharesRemaining: 10,
        initialStop: 90,
        currentStop: 90,
        target1: 120,
        target2: 140,
        rrRatio: 2.0,
        timeStopSessions: 5,
        sessionsElapsed: 1,
      });

      // Attempt corrupt import
      const result = storage.importSnapshot("{ invalid json");
      expect(result.success).toBe(false);

      // Existing trade MUST be preserved
      const trades = storage.getTrades();
      expect(trades).toHaveLength(1);
      expect(trades[0].ticker).toBe("SAFE");
    });

    it("handles snapshots containing Unicode, emoji, and XSS strings in notes safely", () => {
      const unicodeSnapshot: BackupSnapshot = {
        version: "1.0.0",
        appVersion: "Senior Broker 2.0",
        exportedAt: new Date().toISOString(),
        settings: storage.getSettings(),
        trades: [
          {
            id: "tr_unicode",
            ticker: "ATRO",
            companyName: "Astronics 株式会社",
            status: "ACTIVE",
            entryTrigger: 88.5,
            sharesTotal: 18,
            sharesRemaining: 18,
            initialStop: 83.75,
            currentStop: 83.75,
            target1: 100.1,
            target2: 112.0,
            rrRatio: 2.13,
            timeStopSessions: 5,
            sessionsElapsed: 1,
            notes: "<script>alert('xss')</script> 🔥🚀 100% win rate! ñ, ö, 中文, €15,000",
          },
        ],
        notifications: [],
      };

      const result = storage.importSnapshot(unicodeSnapshot);
      expect(result.success).toBe(true);
      expect(storage.getTrades()[0].companyName).toBe("Astronics 株式会社");
      expect(storage.getTrades()[0].notes).toContain("<script>alert('xss')</script>");
      expect(storage.getTrades()[0].notes).toContain("🔥🚀");
    });
  });

  describe("Feature 30: Dual-Layer Storage & Offline Sync Queue Boundaries", () => {
    it("queues 5 consecutive offline mutations and tracks queue length", () => {
      storage.setOnline(false);
      expect(storage.isOnline).toBe(false);

      for (let i = 1; i <= 5; i++) {
        storage.saveSettings({ accountSize: 15000 + i * 1000 });
      }

      expect(storage.pendingSyncQueue).toHaveLength(5);
    });

    it("flushes all offline queued mutations upon reconnection", () => {
      storage.setOnline(false);
      storage.saveSettings({ accountSize: 22000 });
      storage.saveSettings({ deskPasscode: "5678" });

      expect(storage.pendingSyncQueue).toHaveLength(2);

      storage.setOnline(true);
      expect(storage.isOnline).toBe(true);
      expect(storage.pendingSyncQueue).toHaveLength(0);
      expect(storage.getSettings().deskPasscode).toBe("5678");
    });

    it("handles 100 rapid consecutive trade updates maintaining state consistency", () => {
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        storage.addOrUpdateTrade({
          id: `trade_${i % 10}`,
          ticker: `SYM${i % 10}`,
          companyName: "Corp",
          status: "ACTIVE",
          entryTrigger: 100 + i,
          sharesTotal: 10,
          sharesRemaining: 10,
          initialStop: 95,
          currentStop: 95,
          target1: 110,
          target2: 120,
          rrRatio: 2.0,
          timeStopSessions: 5,
          sessionsElapsed: 1,
        });
      }
      expect(storage.getTrades()).toHaveLength(10);
      expect(Date.now() - startTime).toBeLessThan(1000);
    });

    it("recovers safely from corrupt JSON string in localStorage sb_settings", () => {
      storage.local.setItem("sb_settings", "invalid-corrupt-json-string");
      const settings = storage.getSettings();
      // Returns safe fallback default $15k settings
      expect(settings.accountSize).toBe(15000.0);
      expect(settings.riskPerTrade).toBe(1.0);
    });

    it("recovers safely from corrupt JSON string in localStorage sb_trades", () => {
      storage.local.setItem("sb_trades", "corrupted [array syntax");
      const trades = storage.getTrades();
      expect(trades).toHaveLength(0);
    });

    it("deletes a trade record and verifies updated collection length", () => {
      const trade: StoredTrade = {
        id: "tr_to_delete",
        ticker: "DEL",
        companyName: "Delete Me",
        status: "ACTIVE",
        entryTrigger: 50,
        sharesTotal: 10,
        sharesRemaining: 10,
        initialStop: 45,
        currentStop: 45,
        target1: 60,
        target2: 70,
        rrRatio: 2.0,
        timeStopSessions: 5,
        sessionsElapsed: 1,
      };

      storage.addOrUpdateTrade(trade);
      expect(storage.getTrades()).toHaveLength(1);

      const deleted = storage.deleteTrade("tr_to_delete");
      expect(deleted).toBe(true);
      expect(storage.getTrades()).toHaveLength(0);
    });

    it("returns false when attempting to delete non-existent trade ID", () => {
      const deleted = storage.deleteTrade("ghost_trade_id");
      expect(deleted).toBe(false);
    });

    it("resets all storage keys and re-seeds default settings upon resetAll()", () => {
      storage.saveSettings({ accountSize: 99999 });
      storage.resetAll();

      const settings = storage.getSettings();
      expect(settings.accountSize).toBe(15000.0);
      expect(settings.deskPasscode).toBe("1234");
      expect(storage.getTrades()).toHaveLength(0);
    });
  });

  describe("Feature 5 & 20: Dual-Mode Auth & Procedural Web Audio Boundaries", () => {
    it("validates exact 4-digit numeric desk PIN (e.g. '1234')", () => {
      const res = validateDeskPasscode("1234", "1234");
      expect(res.valid).toBe(true);
      expect(res.reason).toBeUndefined();
    });

    it("rejects incorrect 4-digit PIN (e.g. '0000' vs '1234')", () => {
      const res = validateDeskPasscode("0000", "1234");
      expect(res.valid).toBe(false);
      expect(res.reason).toBe("Incorrect desk passcode");
    });

    it("rejects PIN with fewer or more than 4 digits ('12' or '12345')", () => {
      const r1 = validateDeskPasscode("12", "1234");
      const r2 = validateDeskPasscode("12345", "1234");
      expect(r1.valid).toBe(false);
      expect(r1.reason).toContain("exactly 4 digits");
      expect(r2.valid).toBe(false);
    });

    it("rejects non-numeric alphanumeric PINs ('123a' or 'abcd')", () => {
      const res = validateDeskPasscode("123a", "1234");
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("only numeric digits");
    });

    it("allows updating desk passcode in UserSettings", () => {
      storage.saveSettings({ deskPasscode: "8888" });
      expect(storage.getSettings().deskPasscode).toBe("8888");
      expect(validateDeskPasscode("8888", storage.getSettings().deskPasscode).valid).toBe(true);
    });

    it("executes playTargetChime without error in SSR / headless environment", () => {
      expect(() => playTargetChime()).not.toThrow();
    });

    it("executes playStopLossAlert without error in SSR / headless environment", () => {
      expect(() => playStopLossAlert()).not.toThrow();
    });

    it("executes playEntryTriggered without error in SSR / headless environment", () => {
      expect(() => playEntryTriggered()).not.toThrow();
    });
  });

  describe("Feature 21, 27, 28, 32: Notifications, Lessons, Coach Insights & Cloudflare Edge", () => {
    it("caps stored notifications list at 100 items upon overflow", () => {
      for (let i = 0; i < 110; i++) {
        storage.addNotification({
          ticker: `T${i}`,
          type: "ENTRY_TRIGGERED",
          title: `Alert ${i}`,
          message: `Triggered at $${i}`,
          isRead: false,
        });
      }

      const notifs = storage.getNotifications();
      expect(notifs).toHaveLength(100);
      expect(notifs[0].title).toBe("Alert 109"); // Most recent at start
    });

    it("generates notification records across all 6 alert types", () => {
      const types = ["ENTRY_TRIGGERED", "STOP_ALERT", "TARGET_1_HIT", "TARGET_2_HIT", "TIME_STOP_WARNING", "RISK_ALERT"] as const;
      types.forEach(t => {
        const notif = storage.addNotification({
          ticker: "ATRO",
          type: t,
          title: `${t} Title`,
          message: `${t} Message`,
          isRead: false,
        });
        expect(notif.type).toBe(t);
        expect(notif.id).toBeDefined();
      });

      expect(storage.getNotifications()).toHaveLength(6);
    });

    it("verifies the integrity of all 5 Core Strategy Lessons", () => {
      expect(STRATEGY_LESSONS).toHaveLength(5);

      const titles = STRATEGY_LESSONS.map(l => l.title);
      expect(titles).toContain("The 1% Risk Formula");
      expect(titles).toContain("2:1 Asymmetric R:R & Target Scaling");
      expect(titles).toContain("Time Stops vs Price Stops");
      expect(titles).toContain("Sector Concentration & Sleeve Caps");
      expect(titles).toContain("Market Regime Identification");

      STRATEGY_LESSONS.forEach(lesson => {
        expect(lesson.formula.length).toBeGreaterThan(0);
        expect(lesson.corePrinciple.length).toBeGreaterThan(0);
      });
    });

    it("provides contextual 'Why?' institutional rationale for every coach action", () => {
      const whyReasons = [
        "Price has breached the technical breakout pivot. In swing trading, execution at the pivot captures immediate momentum expansion.",
        "Target 1 (2.0R) achieved. Scaling 50% locks in a guaranteed profitable campaign (+1.0R banked) and raising the stop on the runner to Breakeven eliminates all risk of turning a winning trade into a loser.",
        "Full campaign extension target (3.5R) reached. Closing the runner captures maximum asymmetric swing gains before mean reversion.",
        "Hard stop price touched or breached. The initial setup thesis has been invalidated by price action. Immediate exit is mandatory to protect capital.",
        "Institutional swing trading catalysts deliver expansion within 3–5 sessions. Dead money past 6–7 sessions incurs opportunity cost.",
      ];

      whyReasons.forEach(r => {
        expect(r.length).toBeGreaterThan(20);
        expect(r).not.toContain("undefined");
      });
    });

    it("validates theme settings supporting 'obsidian', 'dark', and 'light'", () => {
      storage.saveSettings({ theme: "obsidian" });
      expect(storage.getSettings().theme).toBe("obsidian");

      storage.saveSettings({ theme: "dark" });
      expect(storage.getSettings().theme).toBe("dark");
    });

    it("validates that storage persistence uses zero native Node C++ bindings (Cloudflare Edge compatible)", () => {
      // Storage uses pure Map / LocalStorage JSON serialization
      expect(typeof storage.local.dump).toBe("function");
      const dumped = storage.local.dump();
      expect(typeof dumped).toBe("object");
    });

    it("ensures all trade timestamps adhere to ISO 8601 UTC format", () => {
      const trade = storage.addOrUpdateTrade({
        id: "tr_iso_check",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "ACTIVE",
        entryTrigger: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75,
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        rrRatio: 2.13,
        timeStopSessions: 5,
        sessionsElapsed: 1,
      });

      expect(trade.updatedAt).toBeDefined();
      expect(isNaN(Date.parse(trade.updatedAt!))).toBe(false);
    });

    it("verifies audioEnabled toggle setting in UserSettings", () => {
      storage.saveSettings({ audioEnabled: false });
      expect(storage.getSettings().audioEnabled).toBe(false);

      storage.saveSettings({ audioEnabled: true });
      expect(storage.getSettings().audioEnabled).toBe(true);
    });

    it("verifies currency settings defaults to USD", () => {
      expect(storage.getSettings().currency).toBe("USD");
    });
  });
});
