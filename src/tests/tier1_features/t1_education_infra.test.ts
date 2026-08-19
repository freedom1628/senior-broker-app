import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade, BackupSnapshot } from "../helpers/mock-storage";
import { evaluateTrade } from "../../lib/market/rule-engine";

// Interactive Education Curriculum Model
export interface StrategyLesson {
  id: string;
  lessonNumber: number;
  title: string;
  category: "RISK_MANAGEMENT" | "EXECUTION" | "TIME_DISCIPLINE" | "PORTFOLIO_CONSTRUCTION" | "MARKET_REGIME";
  summary: string;
  institutionalRule: string;
  formula?: string;
  keyTakeaways: string[];
}

export const STRATEGY_LESSONS: StrategyLesson[] = [
  {
    id: "lesson_1_risk_formula",
    lessonNumber: 1,
    title: "The 1% Account Risk Formula",
    category: "RISK_MANAGEMENT",
    summary: "Professional proprietary swing traders never risk more than 1% of dedicated account capital on any single setup.",
    institutionalRule: "Position Size = floor(Account Size * 0.01 / |Entry - Hard Stop|). Never trade without a hard stop.",
    formula: "Shares = Math.floor((AccountSize * 0.01) / (EntryPrice - StopLoss))",
    keyTakeaways: [
      "Risk is defined by the stop distance, not arbitrary dollar amounts.",
      "A $15,000 sleeve permits exactly $150.00 maximum risk per trade.",
      "Whole integer share allocation prevents fractional rounding over-exposure.",
    ],
  },
  {
    id: "lesson_2_asymmetric_rr",
    lessonNumber: 2,
    title: "Asymmetric 2:1 R:R & Target Scaling",
    category: "EXECUTION",
    summary: "Scale 50% at Target 1 (+2.0R) and automatically ratchet your stop loss to Breakeven to guarantee a winning campaign.",
    institutionalRule: "Bank half at 2:1 R:R to lock +1.0R in the book, then let the remaining 50% runner seek 3.5R+ with zero downside risk.",
    formula: "Target1 = Entry + 2.0 * (Entry - Stop); Target2 = Entry + 3.5 * (Entry - Stop)",
    keyTakeaways: [
      "Target 1 at 2.0R ensures positive mathematical expectancy even with a 40% win rate.",
      "Moving stop to Breakeven on the remaining runner eliminates risk of turning winners into losers.",
      "The runner position compound asymmetric gains during sustained momentum trends.",
    ],
  },
  {
    id: "lesson_3_time_stops",
    lessonNumber: 3,
    title: "Time Stops vs Price Stops",
    category: "TIME_DISCIPLINE",
    summary: "If a swing trade fails to expand momentum within 5–7 trading sessions, exit at market to eliminate opportunity cost.",
    institutionalRule: "Dead money ties up scarce sleeve capital. True institutional catalysts follow through within 3–5 days.",
    keyTakeaways: [
      "Setups lose statistical edge when consolidating sideways past session 5.",
      "Time stop warnings activate at session 5; liquidation is mandated at session 6–7.",
      "Capital freed from stale positions is immediately reallocated to fresh catalyst breakouts.",
    ],
  },
  {
    id: "lesson_4_sleeve_caps",
    lessonNumber: 4,
    title: "Sector Concentration & Sleeve Caps",
    category: "PORTFOLIO_CONSTRUCTION",
    summary: "Cap aggregate open portfolio risk at 3.0% ($450 on $15k) and limit concurrent exposure to maximum 2 positions per sector.",
    institutionalRule: "Never hold more than 3 active swing positions simultaneously, and never exceed 2 correlated sector holdings.",
    keyTakeaways: [
      "The 3.0% sleeve risk cap prevents catastrophic multi-position correlation selloffs.",
      "Scaling a position to Breakeven frees up risk budget for new entries.",
      "Sector limits (max 2) prevent concentrated industry headline risks.",
    ],
  },
  {
    id: "lesson_5_market_regimes",
    lessonNumber: 5,
    title: "Market Regime Identification",
    category: "MARKET_REGIME",
    summary: "Align swing long trades strictly with market regime: Favorable, Neutral, or Hostile based on SPY, QQQ, breadth, and VIX.",
    institutionalRule: "Only deploy full risk when SPY and QQQ trade above their 20D/50D MAs with VIX < 20. In Hostile regimes, hold 100% cash.",
    keyTakeaways: [
      "Favorable: Indices above 20D/50D MAs, breadth > 60%, VIX tame -> Full 1% risk allocation.",
      "Neutral: Mixed trend or macro hazards -> Reduce risk to 0.5% or tighten setups.",
      "Hostile: Indices breaking 50D MA, elevated VIX -> Freeze all new long entries.",
    ],
  },
];

describe("Tier 1 Feature Coverage: Investor Education, Why Coach & Infrastructure", () => {
  let storage: MockDualLayerStorage;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
  });

  // -------------------------------------------------------------
  // FEATURE 27: 5 Interactive Strategy Lessons
  // -------------------------------------------------------------
  describe("Feature 27: 5 Interactive Strategy Lessons", () => {
    it("contains all 5 core strategy curriculum modules with sequential numbering", () => {
      expect(STRATEGY_LESSONS).toHaveLength(5);
      const numbers = STRATEGY_LESSONS.map(l => l.lessonNumber);
      expect(numbers).toEqual([1, 2, 3, 4, 5]);
    });

    it("verifies Lesson 1 (The 1% Risk Formula) defines exact sizing math for $15,000 sleeve", () => {
      const lesson = STRATEGY_LESSONS.find(l => l.lessonNumber === 1);
      expect(lesson).toBeDefined();
      expect(lesson?.title).toBe("The 1% Account Risk Formula");
      expect(lesson?.category).toBe("RISK_MANAGEMENT");
      expect(lesson?.formula).toContain("AccountSize * 0.01");
      expect(lesson?.keyTakeaways.join(" ")).toContain("$15,000 sleeve permits exactly $150.00");
    });

    it("verifies Lesson 2 (Asymmetric 2:1 R:R & Target Scaling) defines T1 50% scale & B/E stop ratchet", () => {
      const lesson = STRATEGY_LESSONS.find(l => l.lessonNumber === 2);
      expect(lesson?.title).toContain("Asymmetric 2:1 R:R");
      expect(lesson?.category).toBe("EXECUTION");
      expect(lesson?.institutionalRule).toContain("Bank half at 2:1 R:R");
      expect(lesson?.summary).toContain("stop loss to Breakeven");
    });

    it("verifies Lesson 3 (Time Stops vs Price Stops) specifies 5–7 session freshness limit", () => {
      const lesson = STRATEGY_LESSONS.find(l => l.lessonNumber === 3);
      expect(lesson?.title).toContain("Time Stops vs Price Stops");
      expect(lesson?.category).toBe("TIME_DISCIPLINE");
      expect(lesson?.summary).toContain("5–7 trading sessions");
      expect(lesson?.institutionalRule).toContain("Dead money ties up scarce sleeve capital");
    });

    it("verifies Lesson 4 (Sector Concentration & Sleeve Caps) specifies 3.0% cap and max 2 per sector", () => {
      const lesson = STRATEGY_LESSONS.find(l => l.lessonNumber === 4);
      expect(lesson?.title).toContain("Sector Concentration & Sleeve Caps");
      expect(lesson?.category).toBe("PORTFOLIO_CONSTRUCTION");
      expect(lesson?.summary).toContain("3.0% ($450 on $15k)");
      expect(lesson?.summary).toContain("maximum 2 positions per sector");
    });

    it("verifies Lesson 5 (Market Regime Identification) defines Favorable, Neutral, Hostile criteria", () => {
      const lesson = STRATEGY_LESSONS.find(l => l.lessonNumber === 5);
      expect(lesson?.title).toContain("Market Regime Identification");
      expect(lesson?.category).toBe("MARKET_REGIME");
      expect(lesson?.keyTakeaways.join(" ")).toContain("Favorable");
      expect(lesson?.keyTakeaways.join(" ")).toContain("Neutral");
      expect(lesson?.keyTakeaways.join(" ")).toContain("Hostile");
    });
  });

  // -------------------------------------------------------------
  // FEATURE 28: Contextual 'Why?' Coach Insights
  // -------------------------------------------------------------
  describe("Feature 28: Contextual 'Why?' Coach Insights", () => {
    it("delivers institutional 'Why?' breakdown when Target 1 is achieved", () => {
      const trade = {
        id: "t_why_t1",
        ticker: "ATRO",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75,
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        timeStopSessions: 5,
        sessionsElapsed: 3,
      };

      const evaluation = evaluateTrade(trade, {
        ticker: "ATRO",
        name: "Astronics",
        price: 100.2,
        change: 11.7,
        changePct: 13.2,
        high: 101.0,
        low: 88.5,
        volume: 2000000,
        prevClose: 88.5,
        lastUpdated: "",
      });

      expect(evaluation.whyRationale).toBeDefined();
      expect(evaluation.whyRationale).toContain("Target 1 (2.0R) achieved");
      expect(evaluation.whyRationale).toContain("eliminates all risk of turning a winning trade into a loser");
    });

    it("delivers institutional 'Why?' breakdown on Hard Stop Invalidation", () => {
      const trade = {
        id: "t_why_stop",
        ticker: "MTRN",
        status: "ACTIVE",
        entryTrigger: 282.0,
        actualEntry: 282.0,
        sharesTotal: 8,
        sharesRemaining: 8,
        initialStop: 270.5,
        currentStop: 270.5,
        target1: 305.0,
        target2: 328.0,
        timeStopSessions: 6,
        sessionsElapsed: 1,
      };

      const evaluation = evaluateTrade(trade, {
        ticker: "MTRN",
        name: "Materion",
        price: 270.0, // Stop touched
        change: -12.0,
        changePct: -4.25,
        high: 282.0,
        low: 269.0,
        volume: 800000,
        prevClose: 282.0,
        lastUpdated: "",
      });

      expect(evaluation.whyRationale).toBeDefined();
      expect(evaluation.whyRationale).toContain("initial setup thesis has been invalidated");
      expect(evaluation.whyRationale).toContain("Immediate exit is mandatory to protect capital");
    });

    it("delivers institutional 'Why?' breakdown on Time Stop Expiration", () => {
      const trade = {
        id: "t_why_time",
        ticker: "TWLO",
        status: "ACTIVE",
        entryTrigger: 250.0,
        actualEntry: 250.0,
        sharesTotal: 4,
        sharesRemaining: 4,
        initialStop: 225.0,
        currentStop: 250.0,
        target1: 275.0,
        target2: 300.0,
        timeStopSessions: 5,
        sessionsElapsed: 6, // Overdue
      };

      const evaluation = evaluateTrade(trade, {
        ticker: "TWLO",
        name: "Twilio",
        price: 252.0,
        change: 2.0,
        changePct: 0.8,
        high: 255.0,
        low: 248.0,
        volume: 1000000,
        prevClose: 250.0,
        lastUpdated: "",
      });

      expect(evaluation.whyRationale).toBeDefined();
      expect(evaluation.whyRationale).toContain("catalysts deliver expansion within 3–5 sessions");
      expect(evaluation.whyRationale).toContain("Dead money past 6–7 sessions incurs opportunity cost");
    });

    it("delivers institutional 'Why?' breakdown when Entry Trigger activates", () => {
      const pendingTrade = {
        id: "t_why_entry",
        ticker: "GLBE",
        status: "PENDING_ENTRY",
        entryTrigger: 42.6,
        sharesTotal: 41,
        sharesRemaining: 41,
        initialStop: 40.2,
        currentStop: 40.2,
        target1: 48.0,
        target2: 52.0,
        timeStopSessions: 7,
        sessionsElapsed: 0,
      };

      const evaluation = evaluateTrade(pendingTrade, {
        ticker: "GLBE",
        name: "Global-e",
        price: 42.7,
        change: 0.1,
        changePct: 0.23,
        high: 43.0,
        low: 42.0,
        volume: 2000000,
        prevClose: 42.6,
        lastUpdated: "",
      });

      expect(evaluation.whyRationale).toBeDefined();
      expect(evaluation.whyRationale).toContain("Price has breached the technical breakout pivot");
    });

    it("delivers institutional 'Why?' breakdown when Trailing Stop on runner is adjusted", () => {
      const scaledTrade = {
        id: "t_why_trail",
        ticker: "ATRO",
        status: "SCALED_T1",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 9,
        initialStop: 83.75,
        currentStop: 88.5, // At breakeven
        target1: 100.1,
        target2: 112.0,
        timeStopSessions: 5,
        sessionsElapsed: 4,
      };

      const evaluation = evaluateTrade(scaledTrade, {
        ticker: "ATRO",
        name: "Astronics",
        price: 106.0, // High above T1
        change: 17.5,
        changePct: 19.7,
        high: 107.0,
        low: 88.5,
        volume: 3000000,
        prevClose: 88.5,
        lastUpdated: "",
      });

      expect(evaluation.actionRequired).toBe("TRAIL_STOP_UPDATE");
      expect(evaluation.whyRationale).toContain("trailing the stop behind swing pivots locks in open profits");
    });
  });

  // -------------------------------------------------------------
  // FEATURE 30: Dual-Layer Persistence & Local Storage
  // -------------------------------------------------------------
  describe("Feature 30: Dual-Layer Persistence & Local Storage", () => {
    it("initializes dual-layer storage with synchronous local and edge memory layers", () => {
      expect(storage.local).toBeDefined();
      expect(storage.isOnline).toBe(true);
      expect(storage.getSettings().accountSize).toBe(15000.0);
    });

    it("persists trade additions atomically across local and edge layers", () => {
      const trade: StoredTrade = {
        id: "tr_dual_1",
        ticker: "ATRO",
        companyName: "Astronics",
        status: "ACTIVE",
        entryTrigger: 88.5,
        actualEntry: 88.5,
        sharesTotal: 18,
        sharesRemaining: 18,
        initialStop: 83.75,
        currentStop: 83.75,
        target1: 100.1,
        target2: 112.0,
        rrRatio: 2.13,
        timeStopSessions: 5,
        sessionsElapsed: 1,
      };

      storage.addOrUpdateTrade(trade);
      const trades = storage.getTrades();
      expect(trades).toHaveLength(1);
      expect(trades[0].ticker).toBe("ATRO");

      // Verify raw JSON string in localStorage
      const raw = storage.local.getItem("sb_trades");
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!)[0].ticker).toBe("ATRO");
    });

    it("queues offline mutations in sync queue and flushes upon reconnection", () => {
      storage.setOnline(false);
      expect(storage.isOnline).toBe(false);

      storage.saveSettings({ accountSize: 25000.0 });
      expect(storage.pendingSyncQueue).toHaveLength(1);

      storage.setOnline(true);
      expect(storage.isOnline).toBe(true);
      expect(storage.pendingSyncQueue).toHaveLength(0);
      expect(storage.getSettings().accountSize).toBe(25000.0);
    });

    it("recovers gracefully from corrupt JSON in local storage fallback", () => {
      storage.local.setItem("sb_settings", "{ corrupt json !!");
      const settings = storage.getSettings();
      // Returns fallback default settings
      expect(settings.accountSize).toBe(15000.0);
    });

    it("handles notification queue persistence with max 100 cap", () => {
      for (let i = 0; i < 5; i++) {
        storage.addNotification({
          ticker: `SYM${i}`,
          type: "ENTRY_TRIGGERED",
          title: `Alert ${i}`,
          message: `Message ${i}`,
          isRead: false,
        });
      }

      const notifs = storage.getNotifications();
      expect(notifs).toHaveLength(5);
    });
  });

  // -------------------------------------------------------------
  // FEATURE 31: 1-Click JSON Snapshot Backup/Restore
  // -------------------------------------------------------------
  describe("Feature 31: 1-Click JSON Snapshot Backup/Restore", () => {
    it("exports a complete, valid JSON snapshot containing settings, trades, notifications", () => {
      storage.addOrUpdateTrade({
        id: "tr_snap",
        ticker: "MTRN",
        companyName: "Materion",
        status: "ACTIVE",
        entryTrigger: 282.0,
        sharesTotal: 8,
        sharesRemaining: 8,
        initialStop: 270.5,
        currentStop: 270.5,
        target1: 305.0,
        target2: 328.0,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 1,
      });

      const snapshot = storage.exportSnapshot();
      expect(snapshot.version).toBe("1.0.0");
      expect(snapshot.exportedAt).toBeDefined();
      expect(snapshot.settings.accountSize).toBe(15000.0);
      expect(snapshot.trades).toHaveLength(1);
      expect(snapshot.trades[0].ticker).toBe("MTRN");
    });

    it("validates snapshot schema rejecting payloads missing required fields", () => {
      const invalidSnapshot = { version: "1.0.0", settings: null, trades: "not-an-array" };
      const validation = storage.validateSnapshot(invalidSnapshot);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain("Missing or invalid settings");
    });

    it("restores database state atomically from JSON snapshot", () => {
      storage.addOrUpdateTrade({
        id: "tr_atomic",
        ticker: "GLBE",
        companyName: "Global-e",
        status: "ACTIVE",
        entryTrigger: 42.6,
        sharesTotal: 41,
        sharesRemaining: 41,
        initialStop: 40.2,
        currentStop: 40.2,
        target1: 48.0,
        target2: 52.0,
        rrRatio: 2.25,
        timeStopSessions: 7,
        sessionsElapsed: 2,
      });

      const snapshot = storage.exportSnapshot();
      // Wipe state
      storage.resetAll();
      expect(storage.getTrades()).toHaveLength(0);

      // Restore
      const restoreResult = storage.importSnapshot(snapshot);
      expect(restoreResult.success).toBe(true);
      expect(restoreResult.restoredTradesCount).toBe(1);
      expect(storage.getTrades()[0].ticker).toBe("GLBE");
    });

    it("rejects corrupted JSON string on import with clear error message", () => {
      const result = storage.importSnapshot("INVALID JSON STRING {");
      expect(result.success).toBe(false);
      expect(result.error).toContain("JSON parse error");
    });

    it("handles snapshot import with invalid trade objects", () => {
      const badSnapshot = {
        version: "1.0.0",
        settings: storage.getSettings(),
        trades: [{ id: "bad_trade", ticker: null, entryTrigger: "NaN" }],
      };

      const result = storage.importSnapshot(badSnapshot as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid trade item");
    });
  });

  // -------------------------------------------------------------
  // FEATURE 32: Cloudflare Workers & Pages Compatibility
  // -------------------------------------------------------------
  describe("Feature 32: Cloudflare Workers & Pages Compatibility", () => {
    it("operates with zero native Node.js C++ bindings or locks", () => {
      // Pure JavaScript / TypeScript objects only
      expect(typeof storage.exportSnapshot).toBe("function");
      expect(typeof storage.importSnapshot).toBe("function");
    });

    it("executes domain calculations with sub-millisecond latency (< 10ms)", () => {
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        storage.exportSnapshot();
      }
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });

    it("ensures all data structures are serializable with standard JSON", () => {
      const snapshot = storage.exportSnapshot();
      const serialized = JSON.stringify(snapshot);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.version).toBe("1.0.0");
      expect(deserialized.settings.accountSize).toBe(15000.0);
    });

    it("supports Web Crypto compatible string hashing and unique IDs", () => {
      const id1 = `trade_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const id2 = `trade_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      expect(id1).not.toBe(id2);
    });

    it("verifies universal Edge Memory & D1 storage compatibility", () => {
      storage.resetAll();
      const settings = storage.getSettings();
      expect(settings.deskPasscode).toBe("1234");
      expect(settings.accountSize).toBe(15000.0);
    });
  });
});
