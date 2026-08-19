// Senior Broker — M1 Adversarial Empirical Stress Test Harness
// Comprehensive stress testing for:
// 1. Auto Position Sizer (extreme bounds, rounding, volatility, account sizes)
// 2. Rule Engine (rapid transitions, gap slippage, zero-risk sleeve caps, sector casing)
// 3. Dual-Layer Storage & Backup Resilience (invariant preservation, tamper detection, migration)

import { describe, it, expect, beforeEach } from "../helpers/assertions";
import {
  calculatePositionSize,
  DEFAULT_ACCOUNT_SIZE,
  DEFAULT_RISK_PCT,
} from "../../lib/portfolio/sizing-calculator";
import {
  evaluateTradeRules,
  validateProposedTrade,
  calculateTradeOpenRisk,
  calculateAggregateOpenRisk,
  TradeRuleInput,
} from "../../lib/market/rule-engine";
import { LocalStoreService, InMemoryStorageAdapter } from "../../lib/storage/local-store";
import {
  generateBackupSnapshot,
  validateBackupSnapshot,
  restoreBackupSnapshot,
  canonicalJsonStringify,
} from "../../lib/storage/backup-service";
import { Trade } from "../../lib/storage/types";

describe("M1 Adversarial Verification: Auto Position Sizer Stress Testing", () => {
  it("Stress 1.1: Handles micro accounts ($100) with high-priced equities ($500)", () => {
    const res = calculatePositionSize({
      accountSize: 100,
      riskPct: 1.0, // $1.00 risk budget
      entryPrice: 500.0,
      stopLoss: 490.0,
      availableCash: 100.0,
    });

    // Cannot buy even 1 share with $100 cash (shares = 0, invalid)
    expect(res.shares).toBe(0);
    expect(res.isValid).toBe(false);
    expect(res.status).toBe("INVALID");
    expect(res.limitingFactor).toBe("ZERO_SHARES");
    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.errors[0]).toContain("Insufficient cash");
  });

  it("Stress 1.2: Handles institutional mega-accounts ($100,000,000) without numerical overflow", () => {
    const accountSize = 100_000_000.0;
    const res = calculatePositionSize({
      accountSize,
      riskPct: 1.0, // $1,000,000 risk budget
      entryPrice: 200.0,
      stopLoss: 195.0, // $5 risk per share
      availableCash: accountSize,
    });

    // 1,000,000 / 5 = 200,000 shares
    // 200,000 * 200 = $40,000,000 (40% of account) -> Capped at 25% max position = $25,000,000
    // Usable cash = $100M * 0.95 = $95M. Max position cap = $25M.
    // Shares capped at $25,000,000 / 200 = 125,000 shares.
    expect(res.isValid).toBe(true);
    expect(res.shares).toBe(125000);
    expect(res.limitingFactor).toBe("MAX_POSITION_CAP");
    expect(res.allocatedCapital).toBe(25000000);
    expect(res.allocatedCapitalPct).toBe(25.0);
    expect(res.dollarRisk).toBe(125000 * 5); // $625,000 (0.625% risk)
    expect(res.actualRiskPct).toBe(0.625);
  });

  it("Stress 1.3: Ultra-tight stop volatility ($Stop ≈ Entry, e.g. $100 entry vs $99.99 stop)", () => {
    const res = calculatePositionSize({
      accountSize: 15000.0,
      riskPct: 1.0, // $150 risk budget
      entryPrice: 100.0,
      stopLoss: 99.99, // $0.01 risk per share -> raw risk shares = 15,000 shares ($1.5M capital!)
      availableCash: 15000.0,
    });

    // Sizer must strictly enforce capital caps (25% max position = $3,750 / $100 = 37 shares)
    expect(res.isValid).toBe(true);
    expect(res.shares).toBe(37);
    expect(res.limitingFactor).toBe("MAX_POSITION_CAP");
    expect(res.allocatedCapital).toBeLessThanOrEqual(3750);
    expect(res.dollarRisk).toBeCloseTo(0.37, 2);
  });

  it("Stress 1.4: Handles sub-cent micro-spreads without zero division or NaN", () => {
    const res = calculatePositionSize({
      accountSize: 15000.0,
      entryPrice: 100.0005,
      stopLoss: 100.0001,
      availableCash: 15000.0,
    });

    expect(res.isValid).toBe(true);
    expect(res.shares).toBeGreaterThanOrEqual(0);
    expect(isNaN(res.dollarRisk)).toBe(false);
    expect(isFinite(res.dollarRisk)).toBe(true);
  });

  it("Stress 1.5: Rejects inverted stops and boundary anomalies", () => {
    // Stop > Entry
    const inverted = calculatePositionSize({
      accountSize: 15000,
      entryPrice: 100,
      stopLoss: 105,
    });
    expect(inverted.isValid).toBe(false);
    expect(inverted.errors).toContain("Stop loss must be strictly below entry price for long trades.");

    // Stop == Entry
    const equal = calculatePositionSize({
      accountSize: 15000,
      entryPrice: 100,
      stopLoss: 100,
    });
    expect(equal.isValid).toBe(false);

    // Negative Entry
    const negEntry = calculatePositionSize({
      accountSize: 15000,
      entryPrice: -50,
      stopLoss: 40,
    });
    expect(negEntry.isValid).toBe(false);

    // Negative Account Size
    const negAccount = calculatePositionSize({
      accountSize: -1000,
      entryPrice: 100,
      stopLoss: 95,
    });
    expect(negAccount.isValid).toBe(false);
  });

  it("Stress 1.6: Fractional vs Round Lot vs Integer modes", () => {
    // Standard integer flooring:
    const standard = calculatePositionSize({
      accountSize: 15000,
      entryPrice: 103.5,
      stopLoss: 99.2, // risk = 4.3 -> 150 / 4.3 = 34.8837 shares
    });
    expect(standard.shares).toBe(34);

    // Fractional share mode:
    const fractional = calculatePositionSize({
      accountSize: 15000,
      entryPrice: 103.5,
      stopLoss: 99.2,
      allowFractional: true,
    });
    expect(fractional.shares).toBe(34.8837);

    // Round lot mode (10-share block):
    const roundLot = calculatePositionSize({
      accountSize: 15000,
      entryPrice: 103.5,
      stopLoss: 99.2,
      roundLot: true,
    });
    expect(roundLot.shares).toBe(30);
  });

  it("Stress 1.7: Dynamic ATR Stops and Asymmetric Target Ladders", () => {
    // Dynamic ATR stop (2.0x ATR = $4.00 stop distance on $100 entry -> $96.00 stop)
    const atrRes = calculatePositionSize({
      accountSize: 15000,
      entryPrice: 100.0,
      atr: 2.0,
      atrMultiplier: 2.0,
    });
    expect(atrRes.isAtrDerivedStop).toBe(true);
    expect(atrRes.stopLoss).toBe(96.0);
    expect(atrRes.riskPerShare).toBe(4.0);
    // T1 @ +2.0R = 100 + (2 * 4) = 108.00
    expect(atrRes.target1).toBe(108.0);
    // T2 @ +3.5R = 100 + (3.5 * 4) = 114.00
    expect(atrRes.target2).toBe(114.0);
    expect(atrRes.rewardToRiskT1).toBe(2.0);
    expect(atrRes.rewardToRiskT2).toBe(3.5);
    expect(atrRes.blendedExpectedR).toBe(2.75); // (0.5 * 2.0) + (0.5 * 3.5) = 2.75R
  });
});

describe("M1 Adversarial Verification: Rule Engine Lifecycle & State Transitions", () => {
  const baseTrade: TradeRuleInput = {
    id: "trade-stress-1",
    ticker: "NVDA",
    status: "ACTIVE",
    entryTrigger: 100.0,
    actualEntry: 100.0,
    sharesTotal: 100,
    sharesRemaining: 100,
    initialStop: 95.0,
    currentStop: 95.0,
    target1: 110.0, // 2.0R ($10 profit)
    target2: 117.5, // 3.5R ($17.50 profit)
    sessionsElapsed: 1,
    timeStopSessions: 6,
  };

  it("Transition 2.1: Rapid sequence: Breakout -> T1 Achieved -> Ratchet Breakeven -> Immediate Invalidation Stop Hit", () => {
    // Step A: PENDING_ENTRY triggers at breakout
    const pendingTrade: TradeRuleInput = { ...baseTrade, status: "PENDING_ENTRY" };
    const entryEval = evaluateTradeRules(pendingTrade, 100.0);
    expect(entryEval.actionRequired).toBe("ENTRY_TRIGGER");
    expect(entryEval.alertType).toBe("ENTRY_TRIGGERED");

    // Step B: Trade is ACTIVE, price surges to Target 1 ($110)
    const t1Eval = evaluateTradeRules(baseTrade, 110.0);
    expect(t1Eval.actionRequired).toBe("SCALE_T1");
    expect(t1Eval.alertType).toBe("TARGET_1_HIT");
    expect(t1Eval.sharesToScale).toBe(50); // 50% scale
    expect(t1Eval.suggestedStopUpdate).toBe(100.0); // Ratchet stop to Breakeven ($100.00)

    // Step C: Trader executes scale & stop ratchet -> Position is now SCALED_T1
    const scaledTrade: TradeRuleInput = {
      ...baseTrade,
      status: "SCALED_T1",
      sharesRemaining: 50,
      currentStop: 100.0, // Stop raised to Breakeven
    };

    // Open risk is now mathematically $0.00
    const openRisk = calculateTradeOpenRisk(scaledTrade);
    expect(openRisk).toBe(0.0);

    // Step D: Price suddenly crashes back down to $99.50 (breaching Breakeven stop)
    const stopEval = evaluateTradeRules(scaledTrade, 99.5);
    expect(stopEval.actionRequired).toBe("STOP_LOSS_HIT");
    expect(stopEval.alertType).toBe("STOP_ALERT");
    expect(stopEval.shouldAutoClose).toBe(true);
    expect(stopEval.recommendedAction).toContain("HONOR THE STOP IMMEDIATELY");
  });

  it("Transition 2.2: Gap down below stop triggers STOP_LOSS_HIT with slippage annotation", () => {
    // Overnight gap down from $98 to $85 (stop was at $95)
    const gapEval = evaluateTradeRules(baseTrade, 85.0);
    expect(gapEval.actionRequired).toBe("STOP_LOSS_HIT");
    expect(gapEval.alertType).toBe("STOP_ALERT");
    expect(gapEval.shouldAutoClose).toBe(true);
    expect(gapEval.alertMessage).toContain("Gap slippage: exited at $85.00");
  });

  it("Transition 2.3: Upward-only trailing stop on SCALED_T1 runner", () => {
    const scaledTrade: TradeRuleInput = {
      ...baseTrade,
      status: "SCALED_T1",
      sharesRemaining: 50,
      currentStop: 100.0, // Breakeven
    };

    // Price moves to $115.00 (riskPerShare = $5.00, 1.5 * risk = $7.50, trailCandidate = 115 - 7.5 = $107.50)
    const trailEval = evaluateTradeRules(scaledTrade, 115.0);
    expect(trailEval.actionRequired).toBe("TRAIL_STOP_UPDATE");
    expect(trailEval.suggestedStopUpdate).toBe(107.5);

    // Update stop to $107.50
    const tightenedTrade: TradeRuleInput = { ...scaledTrade, currentStop: 107.5 };

    // Price pulls back to $111.00 -> trailCandidate would be 111 - 7.5 = $103.50
    // But since $103.50 < currentStop ($107.50), no downward update must be suggested
    const pullbackEval = evaluateTradeRules(tightenedTrade, 111.0);
    expect(pullbackEval.actionRequired).toBe("NONE");

    // Price reaches Target 2 ($117.50) -> Full close
    const t2Eval = evaluateTradeRules(tightenedTrade, 117.5);
    expect(t2Eval.actionRequired).toBe("TARGET_2_HIT");
    expect(t2Eval.shouldAutoClose).toBe(true);
  });

  it("Transition 2.4: Time stop session progression (5 Warning -> 6 Expired)", () => {
    // Session 4 -> Normal active
    expect(evaluateTradeRules(baseTrade, 102.0, 4).actionRequired).toBe("NONE");

    // Session 5 -> Warning
    const warnEval = evaluateTradeRules(baseTrade, 102.0, 5);
    expect(warnEval.actionRequired).toBe("TIME_STOP_WARNING");
    expect(warnEval.urgency).toBe("MEDIUM");

    // Session 6 -> Expired
    const expEval = evaluateTradeRules(baseTrade, 102.0, 6);
    expect(expEval.actionRequired).toBe("TIME_STOP_EXPIRED");
    expect(expEval.urgency).toBe("HIGH");
    expect(expEval.recommendedAction).toContain("Liquidate position at market");
  });
});

describe("M1 Adversarial Verification: Portfolio Sleeve Limits & Concentration Edge Cases", () => {
  it("Limit 3.1: Rejects 4th active trade EVEN IF all 3 active trades have $0 open risk (stops at B/E)", () => {
    // 3 active trades, but ALL stops moved to breakeven ($0 open risk)
    const trade1: TradeRuleInput = {
      id: "t1",
      ticker: "AAPL",
      sector: "Technology",
      status: "SCALED_T1",
      entryTrigger: 150,
      actualEntry: 150,
      currentStop: 150, // B/E
      initialStop: 140,
      sharesTotal: 20,
      sharesRemaining: 10,
      target1: 170,
      target2: 185,
    };
    const trade2: TradeRuleInput = {
      id: "t2",
      ticker: "MSFT",
      sector: "Technology",
      status: "SCALED_T1",
      entryTrigger: 300,
      actualEntry: 300,
      currentStop: 300, // B/E
      initialStop: 285,
      sharesTotal: 10,
      sharesRemaining: 5,
      target1: 330,
      target2: 350,
    };
    const trade3: TradeRuleInput = {
      id: "t3",
      ticker: "JNJ",
      sector: "Healthcare",
      status: "SCALED_T1",
      entryTrigger: 160,
      actualEntry: 160,
      currentStop: 160, // B/E
      initialStop: 155,
      sharesTotal: 30,
      sharesRemaining: 15,
      target1: 170,
      target2: 180,
    };

    const activeTrades = [trade1, trade2, trade3];
    const totalOpenRisk = calculateAggregateOpenRisk(activeTrades);
    expect(totalOpenRisk).toBe(0.0);

    // Attempt to open a 4th trade in Financials
    const check = validateProposedTrade(
      {
        ticker: "JPM",
        sector: "Financials",
        entryPrice: 150,
        stopLoss: 145,
        shares: 30,
        dollarRisk: 150,
      },
      {
        accountSize: 15000,
        maxOpenPositions: 3,
        maxSleeveRiskPct: 3.0,
        maxSectorPositions: 2,
        trades: activeTrades,
      }
    );

    // MUST be blocked due to sleeve position limit (activeCount = 3 >= maxOpenPositions = 3)
    expect(check.isAllowed).toBe(false);
    expect(check.canOpen).toBe(false);
    expect(check.blockReason).toContain("Maximum 3 active concurrent swing trades allowed");
  });

  it("Limit 3.2: Sector Concentration Limit handles casing, whitespace, and defaults", () => {
    const trade1: TradeRuleInput = {
      id: "t1",
      ticker: "NVDA",
      sector: "Technology ", // trailing whitespace
      status: "ACTIVE",
      entryTrigger: 100,
      initialStop: 90,
      currentStop: 90,
      sharesTotal: 15,
      sharesRemaining: 15,
      target1: 120,
      target2: 135,
    };
    const trade2: TradeRuleInput = {
      id: "t2",
      ticker: "AMD",
      sector: "  tEcHnOlOgY", // irregular case and leading whitespace
      status: "ACTIVE",
      entryTrigger: 100,
      initialStop: 90,
      currentStop: 90,
      sharesTotal: 15,
      sharesRemaining: 15,
      target1: 120,
      target2: 135,
    };

    const activeTrades = [trade1, trade2];

    // Attempting 3rd position in "TECHNOLOGY"
    const techCheck = validateProposedTrade(
      {
        ticker: "INTC",
        sector: "TECHNOLOGY",
        dollarRisk: 150,
      },
      {
        accountSize: 15000,
        maxOpenPositions: 3,
        maxSectorPositions: 2,
        trades: activeTrades,
      }
    );

    expect(techCheck.isAllowed).toBe(false);
    expect(techCheck.blockReason).toContain("Sector concentration limit exceeded");

    // Attempting position in "Energy" -> Allowed (activeCount = 2 < 3, sectorCount = 0 < 2)
    const energyCheck = validateProposedTrade(
      {
        ticker: "XOM",
        sector: "Energy",
        dollarRisk: 150,
      },
      {
        accountSize: 15000,
        maxOpenPositions: 3,
        maxSectorPositions: 2,
        trades: activeTrades,
      }
    );

    expect(energyCheck.isAllowed).toBe(true);
    expect(energyCheck.canOpen).toBe(true);
  });

  it("Limit 3.3: Aggregate sleeve risk budget strictly caps at 3.0% ($450 on $15k)", () => {
    const trade1: TradeRuleInput = {
      id: "t1",
      ticker: "AAPL",
      sector: "Tech",
      status: "ACTIVE",
      entryTrigger: 100,
      actualEntry: 100,
      currentStop: 98, // $2 risk * 100 shares = $200 risk
      initialStop: 98,
      sharesTotal: 100,
      sharesRemaining: 100,
      target1: 104,
      target2: 107,
    };
    const trade2: TradeRuleInput = {
      id: "t2",
      ticker: "MSFT",
      sector: "Tech",
      status: "ACTIVE",
      entryTrigger: 200,
      actualEntry: 200,
      currentStop: 198, // $2 risk * 100 shares = $200 risk
      initialStop: 198,
      sharesTotal: 100,
      sharesRemaining: 100,
      target1: 204,
      target2: 207,
    };

    // Current aggregate open risk: $200 + $200 = $400 (2.67% of $15k)
    const activeTrades = [trade1, trade2];
    expect(calculateAggregateOpenRisk(activeTrades)).toBe(400);

    // Proposed 3rd trade with $60 risk -> Projected = $460 > $450 (3.0% cap) -> REJECTED
    const overCap = validateProposedTrade(
      {
        ticker: "AMZN",
        sector: "Consumer",
        dollarRisk: 60,
      },
      {
        accountSize: 15000,
        maxSleeveRiskPct: 3.0,
        trades: activeTrades,
      }
    );
    expect(overCap.isAllowed).toBe(false);
    expect(overCap.blockReason).toContain("Aggregate sleeve open risk limit exceeded");

    // Proposed 3rd trade with $45 risk -> Projected = $445 <= $450 -> ALLOWED
    const underCap = validateProposedTrade(
      {
        ticker: "AMZN",
        sector: "Consumer",
        dollarRisk: 45,
      },
      {
        accountSize: 15000,
        maxSleeveRiskPct: 3.0,
        trades: activeTrades,
      }
    );
    expect(underCap.isAllowed).toBe(true);
  });
});

describe("M1 Adversarial Verification: Dual-Layer Persistence & Backup Integrity", () => {
  let store: LocalStoreService;

  beforeEach(() => {
    store = new LocalStoreService(new InMemoryStorageAdapter());
  });

  it("Storage Invariant 4.1: Downward stop widening is strictly rejected (ratchet preservation)", () => {
    const trade: Trade = {
      id: "trade-inv-1",
      ticker: "NVDA",
      companyName: "NVIDIA Corp",
      status: "ACTIVE",
      entryTrigger: 100,
      actualEntry: 100,
      sharesTotal: 50,
      sharesRemaining: 50,
      initialStop: 95,
      currentStop: 98, // Current stop raised to $98
      target1: 110,
      target2: 118,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 1,
    };

    store.saveTrade(trade);

    // Attempt to widen stop downwards to $92
    const maliciousUpdate: Trade = {
      ...trade,
      currentStop: 92,
    };

    const saved = store.saveTrade(maliciousUpdate);
    expect(saved.currentStop).toBe(98); // Protected by invariant!

    const retrieved = store.getTrade("trade-inv-1");
    expect(retrieved?.currentStop).toBe(98);
  });

  it("Storage Invariant 4.2: SCALED_T1 trade status cannot regress to ACTIVE", () => {
    const trade: Trade = {
      id: "trade-inv-2",
      ticker: "AAPL",
      companyName: "Apple Inc",
      status: "SCALED_T1",
      entryTrigger: 150,
      actualEntry: 150,
      sharesTotal: 50,
      sharesRemaining: 25,
      initialStop: 140,
      currentStop: 150,
      target1: 170,
      target2: 185,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 2,
    };

    store.saveTrade(trade);

    // Attempt to regress status back to ACTIVE
    const regressionUpdate: Trade = {
      ...trade,
      status: "ACTIVE",
    };

    const saved = store.saveTrade(regressionUpdate);
    expect(saved.status).toBe("SCALED_T1"); // Protected against status regression!
  });

  it("Backup 4.3: Generates canonical SHA-256 backup and rejects tampered data", async () => {
    const trade: Trade = {
      id: "trade-backup-1",
      ticker: "TSLA",
      companyName: "Tesla Inc",
      status: "ACTIVE",
      entryTrigger: 200,
      actualEntry: 200,
      sharesTotal: 20,
      sharesRemaining: 20,
      initialStop: 190,
      currentStop: 190,
      target1: 220,
      target2: 235,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 1,
    };

    store.saveTrade(trade);

    const snapshot = await generateBackupSnapshot(store);
    expect(snapshot.app).toBe("senior-broker-app");
    expect(snapshot.version).toBe(1);
    expect(snapshot.checksum).toHaveLength(64);

    // Validation of pristine snapshot -> Valid
    const validCheck = await validateBackupSnapshot(JSON.stringify(snapshot));
    expect(validCheck.isValid).toBe(true);
    expect(validCheck.checksumValid).toBe(true);

    // Tampering test: Modify entryTrigger in data payload without updating checksum
    const tampered = JSON.parse(JSON.stringify(snapshot));
    tampered.data.trades[0].entryTrigger = 999;

    const tamperedCheck = await validateBackupSnapshot(JSON.stringify(tampered));
    expect(tamperedCheck.isValid).toBe(false);
    expect(tamperedCheck.checksumValid).toBe(false);
    expect(tamperedCheck.errors.some((e) => e.path === "checksum")).toBe(true);
  });

  it("Backup 4.4: Gracefully handles malformed JSON, invalid types, and future versions", async () => {
    // Malformed JSON string
    const malformed = await validateBackupSnapshot("{ invalid_json: true");
    expect(malformed.isValid).toBe(false);
    expect(malformed.errors[0].message).toContain("Malformed JSON");

    // Future version (e.g. version 99)
    const futureVer = await validateBackupSnapshot(
      JSON.stringify({
        app: "senior-broker-app",
        version: 99,
        data: { trades: [] },
      })
    );
    expect(futureVer.isValid).toBe(false);
    expect(futureVer.errors.some((e) => e.path === "version")).toBe(true);

    // Invalid app identifier
    const badApp = await validateBackupSnapshot(
      JSON.stringify({
        app: "foreign-unsupported-app",
        version: 1,
        data: { trades: [] },
      })
    );
    expect(badApp.isValid).toBe(false);
    expect(badApp.errors.some((e) => e.path === "app")).toBe(true);
  });

  it("Backup 4.5: Multi-mode restore (OVERWRITE, MERGE, DRY_RUN)", async () => {
    const trade1: Trade = {
      id: "t-local-1",
      ticker: "MSFT",
      companyName: "Microsoft",
      status: "ACTIVE",
      entryTrigger: 300,
      sharesTotal: 10,
      sharesRemaining: 10,
      initialStop: 285,
      currentStop: 285,
      target1: 330,
      target2: 350,
      rrRatio: 2.0,
      timeStopSessions: 6,
      sessionsElapsed: 1,
      updatedAt: "2026-08-01T10:00:00Z",
    };
    store.saveTrade(trade1);

    const snapshot = await generateBackupSnapshot(store);
    const jsonStr = JSON.stringify(snapshot);

    // DRY_RUN test: does not mutate store
    const dryRun = await restoreBackupSnapshot(jsonStr, "DRY_RUN", store);
    expect(dryRun.success).toBe(true);
    expect(dryRun.mode).toBe("DRY_RUN");

    // OVERWRITE test: replaces storage cleanly
    const overwrite = await restoreBackupSnapshot(jsonStr, "OVERWRITE", store);
    expect(overwrite.success).toBe(true);
    expect(overwrite.mode).toBe("OVERWRITE");
    expect(store.getTrades().length).toBe(1);

    // MERGE test
    const merge = await restoreBackupSnapshot(jsonStr, "MERGE", store);
    expect(merge.success).toBe(true);
    expect(merge.mode).toBe("MERGE");
  });
});
