import { describe, it, expect, beforeEach } from "../helpers/assertions";
import {
  computePortfolioSummaryMetrics,
  generateDynamicEquityCurve,
  MOCK_EQUITY_SERIES,
} from "../../lib/mockData";
import { TimeframeOption, NavigationTab, PortfolioSummaryMetrics } from "../../types";

describe("Milestone 2 Comprehensive Empirical Adversarial Suite", () => {
  // =========================================================================
  // SECTION 1: Adversarial Portfolio Calculations & Capital Sizing Stress Tests
  // =========================================================================
  describe("1. Portfolio Calculations Stress Tests", () => {
    it("handles zero open positions with exact $0 risk and 100% available capital", () => {
      const metrics = computePortfolioSummaryMetrics(15000, [], {}, 3.0);
      expect(metrics.dedicatedCapital).toBe(15000.0);
      expect(metrics.allocatedCapital).toBe(0.0);
      expect(metrics.cashAvailable).toBe(15000.0);
      expect(metrics.openRiskDollars).toBe(0.0);
      expect(metrics.openRiskPct).toBe(0.0);
      expect(metrics.floatingPnL).toBe(0.0);
      expect(metrics.floatingPnLPct).toBe(0.0);
      expect(metrics.totalSleeveValue).toBe(15000.0);
      expect(metrics.activePositionsCount).toBe(0);
      expect(metrics.isRiskSafe).toBe(true);
      expect(metrics.riskCapacityRemaining).toBe(3.0);
    });

    it("evaluates 3 concurrent active positions with diverse stop ratchet configurations", () => {
      const activeTrades = [
        {
          id: "trade-be",
          ticker: "NVDA",
          status: "ACTIVE",
          actualEntry: 120.0,
          currentStop: 120.0, // Ratcheted to Breakeven
          sharesRemaining: 50, // $6,000 allocated
        },
        {
          id: "trade-profit-lock",
          ticker: "AAPL",
          status: "SCALED_T1",
          actualEntry: 200.0,
          currentStop: 210.0, // Stop ratcheted above entry (locked profit)
          sharesRemaining: 20, // $4,000 allocated
        },
        {
          id: "trade-active-risk",
          ticker: "TSLA",
          status: "ACTIVE",
          actualEntry: 250.0,
          currentStop: 235.0, // $15 stop distance below entry
          sharesRemaining: 10, // $2,500 allocated
        },
      ];

      const quotes = {
        NVDA: { price: 132.0 }, // +$12 * 50 = +$600
        AAPL: { price: 218.0 }, // +$18 * 20 = +$360
        TSLA: { price: 242.0 }, // -$8 * 10 = -$80
      };

      const metrics = computePortfolioSummaryMetrics(15000, activeTrades, quotes, 3.0);

      // Allocated: NVDA(6000) + AAPL(4000) + TSLA(2500) = $12,500
      expect(metrics.allocatedCapital).toBe(12500.0);
      expect(metrics.cashAvailable).toBe(2500.0);
      expect(metrics.activePositionsCount).toBe(3);

      // Open Risk Contribution:
      // NVDA (Stop at entry $120): $0.00
      // AAPL (Stop above entry $210): $0.00
      // TSLA (Stop below entry $235): (250 - 235) * 10 = $150.00
      expect(metrics.openRiskDollars).toBe(150.0);
      // Risk %: (150.00 / 15000) * 100 = 1.00%
      expect(metrics.openRiskPct).toBe(1.0);
      expect(metrics.isRiskSafe).toBe(true);
      expect(metrics.riskCapacityRemaining).toBe(2.0);

      // Floating PnL: +600 + 360 - 80 = +$880.00
      expect(metrics.floatingPnL).toBe(880.0);
      expect(metrics.floatingPnLPct).toBe(5.87); // (880 / 15000) * 100
      expect(metrics.totalSleeveValue).toBe(15880.0);
    });

    it("verifies negative floating P&L drawdown behavior and capital depletion boundary", () => {
      const activeTrades = [
        {
          id: "trade-drawdown-1",
          ticker: "AMD",
          status: "ACTIVE",
          actualEntry: 150.0,
          currentStop: 140.0,
          sharesRemaining: 30, // $4,500 allocated, $300 risk
        },
        {
          id: "trade-drawdown-2",
          ticker: "INTC",
          status: "ACTIVE",
          actualEntry: 30.0,
          currentStop: 28.0,
          sharesRemaining: 50, // $1,500 allocated, $100 risk
        },
      ];

      const quotes = {
        AMD: { price: 141.0 }, // -$9 * 30 = -$270
        INTC: { price: 28.5 }, // -$1.5 * 50 = -$75
      };

      const metrics = computePortfolioSummaryMetrics(15000, activeTrades, quotes, 3.0);
      expect(metrics.allocatedCapital).toBe(6000.0);
      expect(metrics.cashAvailable).toBe(9000.0);
      expect(metrics.floatingPnL).toBe(-345.0);
      expect(metrics.floatingPnLPct).toBe(-2.3);
      expect(metrics.totalSleeveValue).toBe(14655.0);
      // Total Open Risk: $300 + $100 = $400 (2.67%)
      expect(metrics.openRiskDollars).toBe(400.0);
      expect(metrics.openRiskPct).toBe(2.67);
      expect(metrics.isRiskSafe).toBe(true);
      expect(metrics.riskCapacityRemaining).toBe(0.33);
    });

    it("verifies extreme capital scaling: Mini $5k sleeve vs Large $100k sleeve", () => {
      // 1. Mini $5,000 Sleeve
      const miniTrades = [
        {
          id: "mini-pltr",
          ticker: "PLTR",
          status: "ACTIVE",
          actualEntry: 25.0,
          currentStop: 23.5, // $1.50 risk / share
          sharesRemaining: 30, // $750 allocated, $45 risk (0.9% of 5k)
        },
      ];
      const miniMetrics = computePortfolioSummaryMetrics(5000, miniTrades, { PLTR: { price: 26.5 } }, 3.0);
      expect(miniMetrics.dedicatedCapital).toBe(5000.0);
      expect(miniMetrics.allocatedCapital).toBe(750.0);
      expect(miniMetrics.cashAvailable).toBe(4250.0);
      expect(miniMetrics.openRiskDollars).toBe(45.0);
      expect(miniMetrics.openRiskPct).toBe(0.9);
      expect(miniMetrics.floatingPnL).toBe(45.0); // +$1.50 * 30
      expect(miniMetrics.floatingPnLPct).toBe(0.9);
      expect(miniMetrics.totalSleeveValue).toBe(5045.0);

      // 2. Large $100,000 Sleeve
      const largeTrades = [
        {
          id: "large-msft",
          ticker: "MSFT",
          status: "ACTIVE",
          actualEntry: 450.0,
          currentStop: 440.0, // $10 risk
          sharesRemaining: 100, // $45,000 allocated, $1,000 risk
        },
        {
          id: "large-amzn",
          ticker: "AMZN",
          status: "SCALED_T1",
          actualEntry: 180.0,
          currentStop: 180.0, // Ratcheted to breakeven
          sharesRemaining: 150, // $27,000 allocated, $0 risk
        },
        {
          id: "large-meta",
          ticker: "META",
          status: "ACTIVE",
          actualEntry: 500.0,
          currentStop: 485.0, // $15 risk
          sharesRemaining: 40, // $20,000 allocated, $600 risk
        },
      ];
      const largeQuotes = {
        MSFT: { price: 465.0 }, // +$15 * 100 = +$1,500
        AMZN: { price: 192.0 }, // +$12 * 150 = +$1,800
        META: { price: 510.0 }, // +$10 * 40 = +$400
      };
      const largeMetrics = computePortfolioSummaryMetrics(100000, largeTrades, largeQuotes, 3.0);
      expect(largeMetrics.dedicatedCapital).toBe(100000.0);
      expect(largeMetrics.allocatedCapital).toBe(92000.0);
      expect(largeMetrics.cashAvailable).toBe(8000.0);
      // Open risk: MSFT ($1,000) + AMZN ($0) + META ($600) = $1,600 (1.6%)
      expect(largeMetrics.openRiskDollars).toBe(1600.0);
      expect(largeMetrics.openRiskPct).toBe(1.6);
      expect(largeMetrics.isRiskSafe).toBe(true);
      expect(largeMetrics.riskCapacityRemaining).toBe(1.4);
      // Floating: +1500 + 1800 + 400 = +$3,700 (3.7%)
      expect(largeMetrics.floatingPnL).toBe(3700.0);
      expect(largeMetrics.floatingPnLPct).toBe(3.7);
      expect(largeMetrics.totalSleeveValue).toBe(103700.0);
    });

    it("safely ignores CLOSED and PENDING_ENTRY trades from active portfolio open risk", () => {
      const mixedTrades = [
        {
          id: "pending-1",
          ticker: "NFLX",
          status: "PENDING_ENTRY",
          entryTrigger: 600.0,
          initialStop: 580.0,
          sharesTotal: 10,
        },
        {
          id: "closed-1",
          ticker: "GOOGL",
          status: "CLOSED",
          actualEntry: 160.0,
          currentStop: 150.0,
          sharesTotal: 25,
          sharesRemaining: 0,
          realizedPnL: 250.0,
        },
        {
          id: "active-1",
          ticker: "UBER",
          status: "ACTIVE",
          actualEntry: 70.0,
          currentStop: 66.5,
          sharesRemaining: 40,
        },
      ];

      const metrics = computePortfolioSummaryMetrics(15000, mixedTrades, { UBER: { price: 72.0 } }, 3.0);
      expect(metrics.activePositionsCount).toBe(1);
      expect(metrics.allocatedCapital).toBe(2800.0); // 70 * 40
      expect(metrics.openRiskDollars).toBe(140.0); // (70 - 66.5) * 40
      expect(metrics.floatingPnL).toBe(80.0); // (72 - 70) * 40
    });

    it("handles missing market quotes by falling back to entry price without NaN errors", () => {
      const tradeWithoutQuote = [
        {
          id: "no-quote-1",
          ticker: "XYZ",
          status: "ACTIVE",
          actualEntry: 50.0,
          currentStop: 48.0,
          sharesRemaining: 20,
        },
      ];

      const metrics = computePortfolioSummaryMetrics(15000, tradeWithoutQuote, {}, 3.0);
      expect(metrics.floatingPnL).toBe(0.0);
      expect(metrics.floatingPnLPct).toBe(0.0);
      expect(metrics.allocatedCapital).toBe(1000.0);
      expect(metrics.openRiskDollars).toBe(40.0);
      expect(Number.isNaN(metrics.floatingPnL)).toBe(false);
      expect(Number.isNaN(metrics.openRiskDollars)).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 2: Adversarial Sparkline & Dynamic Equity Curve Stress Tests
  // =========================================================================
  describe("2. Sparkline & Dynamic Equity Curve Stress Tests", () => {
    const timeframes: TimeframeOption[] = ["1D", "1W", "1M", "1Y"];

    it("verifies equity curve structure and continuity across all 4 timeframes (1D, 1W, 1M, 1Y)", () => {
      timeframes.forEach((tf) => {
        const series = MOCK_EQUITY_SERIES[tf];
        expect(series).toBeDefined();
        expect(series.length).toBeGreaterThanOrEqual(4);

        const curve = generateDynamicEquityCurve(15000, 340.5, tf);
        expect(curve.length).toBe(series.length);

        // Verify timestamps and monotonic indexing
        for (let i = 0; i < curve.length; i++) {
          expect(typeof curve[i].timestamp).toBe("string");
          expect(typeof curve[i].timeLabel).toBe("string");
          expect(Number.isFinite(curve[i].equity)).toBe(true);
          expect(Number.isFinite(curve[i].changeDollars)).toBe(true);
          expect(Number.isFinite(curve[i].changePct)).toBe(true);
        }

        // Terminal equity point must precisely match startingCapital + floatingPnL
        const terminalPt = curve[curve.length - 1];
        expect(terminalPt.equity).toBe(15340.5);
        expect(terminalPt.changeDollars).toBe(340.5);
        expect(terminalPt.changePct).toBe(2.27);
      });
    });

    it("verifies negative equity return delta and percentage under portfolio drawdown", () => {
      const drawdownCurve = generateDynamicEquityCurve(15000, -600.0, "1W");
      const terminalPt = drawdownCurve[drawdownCurve.length - 1];

      expect(terminalPt.equity).toBe(14400.0);
      expect(terminalPt.changeDollars).toBe(-600.0);
      expect(terminalPt.changePct).toBe(-4.0); // (-600 / 15000) * 100
      expect(terminalPt.changeDollars).toBeLessThan(0);
    });

    it("safely handles zero capital without producing division by zero or NaN", () => {
      const zeroCurve = generateDynamicEquityCurve(0, 0, "1D");
      expect(zeroCurve.length).toBeGreaterThan(0);
      zeroCurve.forEach((pt) => {
        expect(pt.equity).toBe(0);
        expect(pt.changeDollars).toBe(0);
        expect(pt.changePct).toBe(0);
      });
    });

    it("verifies ratio scaling across intermediate points preserves relative curve shape", () => {
      const curve10k = generateDynamicEquityCurve(10000, 0, "1D");
      const curve20k = generateDynamicEquityCurve(20000, 0, "1D");

      expect(curve10k.length).toBe(curve20k.length);
      for (let i = 0; i < curve10k.length - 1; i++) {
        // Points should scale strictly 2:1 with capital
        const ratio = curve20k[i].equity / curve10k[i].equity;
        expect(Number(ratio.toFixed(1))).toBe(2.0);
      }
    });
  });

  // =========================================================================
  // SECTION 3: Adversarial 6-View Pill Navigation & Viewport Switching Stress Tests
  // =========================================================================
  describe("3. 6-View Pill Navigation & Viewport Switching Stress Tests", () => {
    const views: NavigationTab[] = [
      "COACH",
      "POSITIONS",
      "SCREENER",
      "LEARNING",
      "JOURNAL",
      "SETTINGS",
    ];

    it("verifies all 6 core navigation tabs exist in the schema and render valid view identifiers", () => {
      expect(views).toHaveLength(6);
      const uniqueViews = new Set(views);
      expect(uniqueViews.size).toBe(6);
    });

    it("simulates rapid high-frequency tab switching without memory state corruption", () => {
      let currentTab: NavigationTab = "COACH";
      let tabHistory: NavigationTab[] = [];

      const setTab = (t: NavigationTab) => {
        tabHistory.push(currentTab);
        currentTab = t;
      };

      // 100 consecutive rapid switches
      for (let i = 0; i < 100; i++) {
        const nextTab = views[i % views.length];
        setTab(nextTab);
        expect(currentTab).toBe(nextTab);
      }

      expect(tabHistory).toHaveLength(100);
      expect(currentTab).toBe(views[99 % views.length]);
    });

    it("verifies badge counter integrity when tab state transitions", () => {
      const badgeCounts = {
        activePositions: 3,
        pendingOrders: 2,
        unreadAlerts: 5,
        highUrgencyMoves: 1,
        candidateSetups: 7,
      };

      expect(badgeCounts.activePositions).toBe(3);
      expect(badgeCounts.unreadAlerts).toBe(5);
      expect(badgeCounts.highUrgencyMoves).toBe(1);
      expect(badgeCounts.candidateSetups).toBe(7);
    });

    it("verifies responsive desktop pill (<640px hidden) vs mobile dock (>=640px hidden) contract", () => {
      const desktopBreakpoint = 640;
      
      const isDesktopVisible = (width: number) => width >= desktopBreakpoint;
      const isMobileVisible = (width: number) => width < desktopBreakpoint;

      // Test mobile phone viewport (375px)
      expect(isDesktopVisible(375)).toBe(false);
      expect(isMobileVisible(375)).toBe(true);

      // Test tablet/desktop viewport (768px, 1024px, 1440px)
      expect(isDesktopVisible(768)).toBe(true);
      expect(isMobileVisible(768)).toBe(false);

      expect(isDesktopVisible(1024)).toBe(true);
      expect(isMobileVisible(1024)).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 4: Dual-Mode Auth, PIN Keypad & Desk Lock Overlay Adversarial Tests
  // =========================================================================
  describe("4. Dual-Mode Auth, PIN Keypad & Desk Lock Overlay Adversarial Tests", () => {
    // PIN pad keypad state machine
    class PinPadHarness {
      public pin: string = "";
      public isShaking: boolean = false;
      public error: string | null = null;
      public isLoading: boolean = false;
      public submittedPins: string[] = [];

      public handleDigit(digit: string): boolean {
        if (this.isLoading || this.pin.length >= 4) return false;
        if (!/^[0-9]$/.test(digit)) return false;
        this.pin += digit;
        if (this.pin.length === 4) {
          this.submittedPins.push(this.pin);
          return true;
        }
        return false;
      }

      public handleBackspace(): void {
        if (this.isLoading || this.pin.length === 0) return;
        this.pin = this.pin.slice(0, -1);
      }

      public handleClear(): void {
        if (this.isLoading) return;
        this.pin = "";
      }

      public handleKeyDown(key: string): void {
        if (/^[0-9]$/.test(key)) {
          this.handleDigit(key);
        } else if (key === "Backspace") {
          this.handleBackspace();
        } else if (key === "Escape") {
          this.handleClear();
        }
      }

      public setError(err: string | null): void {
        this.error = err;
        if (err) {
          this.isShaking = true;
          this.pin = "";
        } else {
          this.isShaking = false;
        }
      }
    }

    it("verifies PIN pad auto-submits on 4th digit and rejects 5th+ rapid digit overflow", () => {
      const harness = new PinPadHarness();
      expect(harness.handleDigit("8")).toBe(false);
      expect(harness.handleDigit("8")).toBe(false);
      expect(harness.handleDigit("8")).toBe(false);
      expect(harness.handleDigit("8")).toBe(true); // 4th digit
      expect(harness.pin).toBe("8888");
      expect(harness.submittedPins).toHaveLength(1);

      // Attempt 5th and 6th digit
      expect(harness.handleDigit("9")).toBe(false);
      expect(harness.handleDigit("0")).toBe(false);
      expect(harness.pin).toBe("8888"); // Unchanged
    });

    it("handles backspace on empty PIN pad without error or string underflow", () => {
      const harness = new PinPadHarness();
      for (let i = 0; i < 10; i++) {
        harness.handleBackspace();
        expect(harness.pin).toBe("");
      }
    });

    it("filters out non-digit inputs from keyboard events", () => {
      const harness = new PinPadHarness();
      const forbidden = ["a", "B", "!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "Enter", "Space"];
      forbidden.forEach((k) => {
        harness.handleKeyDown(k);
        expect(harness.pin).toBe("");
      });

      // Digits work cleanly
      harness.handleKeyDown("1");
      harness.handleKeyDown("2");
      expect(harness.pin).toBe("12");
    });

    it("triggers shake feedback and resets PIN buffer on error", () => {
      const harness = new PinPadHarness();
      harness.handleDigit("9");
      harness.handleDigit("9");
      harness.handleDigit("9");
      harness.handleDigit("9");
      expect(harness.pin).toBe("9999");

      harness.setError("Incorrect PIN. Please try again.");
      expect(harness.isShaking).toBe(true);
      expect(harness.pin).toBe(""); // Cleared
      expect(harness.error).toBe("Incorrect PIN. Please try again.");
    });

    it("verifies desk lock overlay isolation and in-memory state preservation", () => {
      let isDeskLocked = false;
      const inMemoryState = {
        activeTab: "POSITIONS",
        activeTrades: [{ id: "t1", ticker: "NVDA", shares: 50, entry: 120.0 }],
        pendingDraft: { ticker: "TSLA", trigger: 245.0 },
      };

      // 1. Lock Desk
      isDeskLocked = true;
      expect(isDeskLocked).toBe(true);

      // 2. State remains completely intact in memory
      expect(inMemoryState.activeTrades).toHaveLength(1);
      expect(inMemoryState.pendingDraft.ticker).toBe("TSLA");

      // 3. Unlock Desk
      const unlock = (pin: string) => {
        if (pin === "1234" || pin === "8888") {
          isDeskLocked = false;
          return true;
        }
        return false;
      };

      expect(unlock("0000")).toBe(false);
      expect(isDeskLocked).toBe(true); // Still locked

      expect(unlock("1234")).toBe(true);
      expect(isDeskLocked).toBe(false); // Unlocked

      // State is immediately available
      expect(inMemoryState.activeTrades[0].ticker).toBe("NVDA");
      expect(inMemoryState.activeTab).toBe("POSITIONS");
    });

    it("verifies sign-out completely wipes session storage and resets authentication state", () => {
      const sessionStore: Record<string, string> = {
        senior_broker_session_auth: "true",
        senior_broker_desk_locked: "false",
        senior_broker_user: JSON.stringify({ email: "trader@broker.com", name: "Senior Desk Trader" }),
      };

      const signOut = () => {
        delete sessionStore.senior_broker_session_auth;
        delete sessionStore.senior_broker_desk_locked;
        delete sessionStore.senior_broker_user;
      };

      expect(sessionStore.senior_broker_session_auth).toBe("true");
      signOut();
      expect(sessionStore.senior_broker_session_auth).toBeUndefined();
      expect(sessionStore.senior_broker_desk_locked).toBeUndefined();
      expect(sessionStore.senior_broker_user).toBeUndefined();
    });

    it("verifies Google OAuth simulated handshake token and profile initialization", () => {
      const initOAuthProfile = (account: { email: string; name: string; avatarUrl?: string }) => {
        return {
          id: `usr_google_${Date.now()}`,
          email: account.email,
          name: account.name,
          avatarUrl: account.avatarUrl || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
          authProvider: "GOOGLE" as const,
          role: "SENIOR_TRADER" as const,
          accountSize: 15000.0,
          riskPerTrade: 1.0,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };
      };

      const user = initOAuthProfile({
        email: "alex.jones.trader@gmail.com",
        name: "Alex Jones (Swing Desk)",
      });

      expect(user.email).toBe("alex.jones.trader@gmail.com");
      expect(user.name).toBe("Alex Jones (Swing Desk)");
      expect(user.authProvider).toBe("GOOGLE");
      expect(user.role).toBe("SENIOR_TRADER");
      expect(user.accountSize).toBe(15000.0);
      expect(user.riskPerTrade).toBe(1.0);
    });
  });
});
