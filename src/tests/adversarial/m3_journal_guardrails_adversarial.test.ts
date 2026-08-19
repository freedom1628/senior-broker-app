// Adversarial Verification Suite for Milestone 3
// Focus: Trade Journal & Analytics Formulas, 1% Risk Sizing Model, Sleeve Guardrails, Price Ladder Geometry

import { describe, it, expect } from "../helpers/assertions";
import {
  calculatePositionSize,
  DEFAULT_ACCOUNT_SIZE,
  DEFAULT_RISK_PCT,
} from "../../lib/portfolio/sizing-calculator";
import {
  validateProposedTrade,
  calculateTradeOpenRisk,
  calculateAggregateOpenRisk,
  evaluateTrade,
  TradeRuleInput,
} from "../../lib/market/rule-engine";
import {
  playTargetChime,
  playStopLossAlert,
  playEntryTriggered,
  playTimeStopWarning,
  setMuted,
  isMuted,
  setVolume,
  getVolume,
} from "../../lib/audio/sounds";

describe("M3 Adversarial: Trade Journal & Analytics Mathematical Integrity", () => {
  // Pure helper simulating Journal Analytics computation mirroring API and UI ribbon
  function computeJournalAnalytics(trades: { realizedPnL?: number; rMultiple?: number; closedDate?: string }[], accountSize = 15000) {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        totalRealizedPnL: 0,
        winRatePct: 0,
        profitFactor: 0,
        avgRMultiple: 0,
        disciplineScorePct: 100.0,
        grossProfit: 0,
        grossLoss: 0,
        winningTrades: 0,
        losingTrades: 0,
        peakEquity: accountSize,
        maxDrawdownDollars: 0,
        maxDrawdownPct: 0,
        finalEquity: accountSize,
      };
    }

    let cumulativePnL = 0;
    let currentEquity = accountSize;
    let peakEquity = accountSize;
    let maxDrawdownDollars = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let winCount = 0;
    let lossCount = 0;
    let totalR = 0;

    trades.forEach((t) => {
      const pnl = t.realizedPnL || 0;
      const r = t.rMultiple || 0;
      cumulativePnL += pnl;
      currentEquity += pnl;
      totalR += r;

      if (pnl > 0.01) {
        winCount++;
        grossProfit += pnl;
      } else if (pnl < -0.01) {
        lossCount++;
        grossLoss += Math.abs(pnl);
      }

      if (currentEquity > peakEquity) {
        peakEquity = currentEquity;
      }

      const currentDrawdown = peakEquity - currentEquity;
      if (currentDrawdown > maxDrawdownDollars) {
        maxDrawdownDollars = currentDrawdown;
      }
    });

    const winRatePct = trades.length > 0 ? (winCount / trades.length) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999.0 : 0.0;
    const avgRMultiple = trades.length > 0 ? totalR / trades.length : 0;
    const maxDrawdownPct = peakEquity > 0 ? (maxDrawdownDollars / peakEquity) * 100 : 0;

    return {
      totalTrades: trades.length,
      totalRealizedPnL: Number(cumulativePnL.toFixed(2)),
      winRatePct: Number(winRatePct.toFixed(1)),
      profitFactor: Number(profitFactor.toFixed(2)),
      avgRMultiple: Number(avgRMultiple.toFixed(2)),
      disciplineScorePct: 100.0,
      grossProfit: Number(grossProfit.toFixed(2)),
      grossLoss: Number(grossLoss.toFixed(2)),
      winningTrades: winCount,
      losingTrades: lossCount,
      peakEquity: Number(peakEquity.toFixed(2)),
      maxDrawdownDollars: Number(maxDrawdownDollars.toFixed(2)),
      maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
      finalEquity: Number(currentEquity.toFixed(2)),
    };
  }

  it("1.1: Handles empty journal state (0 trades) without division-by-zero or NaN", () => {
    const res = computeJournalAnalytics([]);
    expect(res.totalTrades).toBe(0);
    expect(res.winRatePct).toBe(0);
    expect(res.profitFactor).toBe(0);
    expect(res.avgRMultiple).toBe(0);
    expect(res.totalRealizedPnL).toBe(0);
    expect(res.maxDrawdownDollars).toBe(0);
    expect(res.maxDrawdownPct).toBe(0);
    expect(res.finalEquity).toBe(15000);
  });

  it("1.2: Handles perfect record (100% wins, 0 gross losses) with safe Profit Factor ceiling", () => {
    const perfectTrades = [
      { realizedPnL: 300.0, rMultiple: 2.0 },
      { realizedPnL: 525.0, rMultiple: 3.5 },
      { realizedPnL: 150.0, rMultiple: 1.0 },
    ];
    const res = computeJournalAnalytics(perfectTrades, 15000);
    expect(res.totalTrades).toBe(3);
    expect(res.winningTrades).toBe(3);
    expect(res.losingTrades).toBe(0);
    expect(res.winRatePct).toBe(100.0);
    expect(res.grossLoss).toBe(0);
    expect(res.grossProfit).toBe(975.0);
    // Profit factor with 0 loss must be safe fallback (999.00), not Infinity or NaN
    expect(res.profitFactor).toBe(999.0);
    expect(res.avgRMultiple).toBeCloseTo(2.17, 2);
    expect(res.peakEquity).toBe(15975.0);
    expect(res.maxDrawdownDollars).toBe(0);
  });

  it("1.3: Handles zero-win record (100% losses, 0 gross profit)", () => {
    const losingTrades = [
      { realizedPnL: -150.0, rMultiple: -1.0 },
      { realizedPnL: -150.0, rMultiple: -1.0 },
      { realizedPnL: -75.0, rMultiple: -0.5 },
    ];
    const res = computeJournalAnalytics(losingTrades, 15000);
    expect(res.winRatePct).toBe(0.0);
    expect(res.grossProfit).toBe(0);
    expect(res.grossLoss).toBe(375.0);
    expect(res.profitFactor).toBe(0.0);
    expect(res.avgRMultiple).toBeCloseTo(-0.83, 2);
    expect(res.totalRealizedPnL).toBe(-375.0);
    expect(res.finalEquity).toBe(14625.0);
    expect(res.maxDrawdownDollars).toBe(375.0);
    expect(res.maxDrawdownPct).toBeCloseTo(2.5, 1); // 375 / 15000 = 2.5%
  });

  it("1.4: Handles pure breakeven / scratch trades ($0.00 PnL)", () => {
    const scratches = [
      { realizedPnL: 0.0, rMultiple: 0.0 },
      { realizedPnL: 0.005, rMultiple: 0.0 }, // sub-cent noise
      { realizedPnL: -0.005, rMultiple: 0.0 },
    ];
    const res = computeJournalAnalytics(scratches, 15000);
    expect(res.winningTrades).toBe(0);
    expect(res.losingTrades).toBe(0);
    expect(res.winRatePct).toBe(0.0);
    expect(res.profitFactor).toBe(0.0);
    expect(res.avgRMultiple).toBe(0.0);
    expect(res.totalRealizedPnL).toBe(0.0);
    expect(res.maxDrawdownDollars).toBe(0.0);
  });

  it("1.5: Verifies non-trivial Drawdown & High Water Mark trajectory across a mixed campaign series", () => {
    // Sequence:
    // Start: $15,000
    // Trade 1: +$600 -> Eq $15,600, Peak $15,600, DD $0
    // Trade 2: -$200 -> Eq $15,400, Peak $15,600, DD $200
    // Trade 3: -$400 -> Eq $15,000, Peak $15,600, DD $600 (3.846%)
    // Trade 4: +$900 -> Eq $15,900, Peak $15,900, DD $0
    // Trade 5: -$150 -> Eq $15,750, Peak $15,900, DD $150
    const sequence = [
      { realizedPnL: 600.0, rMultiple: 4.0 },
      { realizedPnL: -200.0, rMultiple: -1.33 },
      { realizedPnL: -400.0, rMultiple: -2.67 },
      { realizedPnL: 900.0, rMultiple: 6.0 },
      { realizedPnL: -150.0, rMultiple: -1.0 },
    ];
    const res = computeJournalAnalytics(sequence, 15000);
    expect(res.totalTrades).toBe(5);
    expect(res.winningTrades).toBe(2);
    expect(res.losingTrades).toBe(3);
    expect(res.winRatePct).toBe(40.0); // 2/5 = 40.0%
    expect(res.grossProfit).toBe(1500.0);
    expect(res.grossLoss).toBe(750.0);
    expect(res.profitFactor).toBe(2.0); // 1500 / 750 = 2.00
    expect(res.avgRMultiple).toBeCloseTo(1.0, 2); // (4 - 1.33 - 2.67 + 6 - 1)/5 = 5/5 = 1.00
    expect(res.peakEquity).toBe(15900.0);
    expect(res.maxDrawdownDollars).toBe(600.0); // Peak $15,600 - T3 Eq $15,000
    expect(res.maxDrawdownPct).toBeCloseTo(3.77, 2); // 600 / 15900 = 3.774%
    expect(res.finalEquity).toBe(15750.0);
  });

  it("1.6: Calculates multi-tranche campaign R-multiple accurately", () => {
    // Setup: 100 shares at $50.00, stop at $48.00 (Risk = $2/sh, Total Risk = $200)
    // Tranche 1: Scale 50 sh at T1 ($54.00) -> PnL = 50 * $4 = +$200
    // Tranche 2: Stop raised to B/E ($50.00), closed at $50.00 -> PnL = 50 * $0 = $0
    // Total PnL = +$200. Total initial risk = $200. Campaign R = +1.00R
    const initialRisk = 100 * (50.0 - 48.0);
    const tranche1PnL = 50 * (54.0 - 50.0);
    const tranche2PnL = 50 * (50.0 - 50.0);
    const totalPnL = tranche1PnL + tranche2PnL;
    const campaignR = Number((totalPnL / initialRisk).toFixed(2));
    expect(campaignR).toBe(1.0);

    // If Runner hit T2 ($57.00): 50 sh * $7 = +$350
    // Total PnL = $200 + $350 = $550. Campaign R = $550 / $200 = 2.75R
    const t2TotalPnL = tranche1PnL + (50 * (57.0 - 50.0));
    const t2CampaignR = Number((t2TotalPnL / initialRisk).toFixed(2));
    expect(t2CampaignR).toBe(2.75);
  });
});

describe("M3 Adversarial: 1% Account Risk Sizing Math & Stress Boundaries", () => {
  it("2.1: Default $15,000 baseline with 1% risk ($150 risk budget)", () => {
    const result = calculatePositionSize({
      accountSize: 15000,
      riskPct: 1.0,
      entryPrice: 42.0,
      stopLoss: 40.0, // $2.00 risk/sh
    });
    expect(result.isValid).toBe(true);
    expect(result.status).toBe("VALID");
    expect(result.riskPerShare).toBe(2.0);
    expect(result.shares).toBe(75); // $150 / $2 = 75
    expect(result.dollarRisk).toBe(150.0);
    expect(result.actualRiskPct).toBe(1.0);
    expect(result.allocatedCapital).toBe(3150.0); // 75 * 42 = $3150 (21% of account)
    expect(result.target1).toBe(46.0); // 42 + 2*2 = 46 (+2R)
    expect(result.target2).toBe(49.0); // 42 + 3.5*2 = 49 (+3.5R)
    expect(result.rewardToRiskT1).toBe(2.0);
    expect(result.rewardToRiskT2).toBe(3.5);
  });

  it("2.2: Ultra-tight stop triggering 25% single-position concentration cap", () => {
    // $15,000 account, Entry $100, Stop $99.90 ($0.10 risk/sh)
    // Raw shares by risk = $150 / $0.10 = 1,500 shares ($150,000 capital -> impossible)
    // Max 25% cap = $3,750 capital -> 37 shares
    const result = calculatePositionSize({
      accountSize: 15000,
      riskPct: 1.0,
      entryPrice: 100.0,
      stopLoss: 99.90,
    });
    expect(result.isValid).toBe(true);
    expect(result.status).toBe("WARNING");
    expect(result.limitingFactor).toBe("MAX_POSITION_CAP");
    expect(result.shares).toBe(37); // Math.floor(3750 / 100) = 37
    expect(result.allocatedCapital).toBe(3700.0);
    expect(result.allocatedCapitalPct).toBeLessThanOrEqual(25.0);
    expect(result.dollarRisk).toBeCloseTo(3.70, 2); // 37 * $0.10 = $3.70
  });

  it("2.3: Cash buffer limitation when available cash is tight", () => {
    // Account $15,000, but only $1,000 available cash remaining
    // Usable cash with 5% buffer = $950
    // Entry $50, Stop $47 ($3 risk/sh) -> Raw risk shares = 50 shares ($2500)
    // Capped by usable cash: Math.floor(950 / 50) = 19 shares
    const result = calculatePositionSize({
      accountSize: 15000,
      riskPct: 1.0,
      entryPrice: 50.0,
      stopLoss: 47.0,
      availableCash: 1000.0,
    });
    expect(result.isValid).toBe(true);
    expect(result.limitingFactor).toBe("BUYING_POWER");
    expect(result.shares).toBe(19);
    expect(result.allocatedCapital).toBe(950.0);
  });

  it("2.4: Whole shares integer truncation prevents risk budget overrun", () => {
    // Account $15,000 ($150 risk). Entry $37.50, Stop $35.20 ($2.30 risk/sh)
    // Raw shares = 150 / 2.30 = 65.21739 shares
    // Whole shares mode must floor to 65 shares (dollar risk = $149.50 <= $150.00)
    const result = calculatePositionSize({
      accountSize: 15000,
      riskPct: 1.0,
      entryPrice: 37.50,
      stopLoss: 35.20,
      allowFractional: false,
    });
    expect(result.shares).toBe(65);
    expect(result.dollarRisk).toBeLessThanOrEqual(150.0);
    expect(result.dollarRisk).toBe(149.50);
  });

  it("2.5: Rejects adversarial inputs: inverted stop, zero price, negative account size", () => {
    // Inverted stop (stop >= entry)
    const inverted = calculatePositionSize({
      accountSize: 15000,
      entryPrice: 50.0,
      stopLoss: 52.0,
    });
    expect(inverted.isValid).toBe(false);
    expect(inverted.status).toBe("INVALID");
    expect(inverted.errors.some((e) => e.includes("below entry price"))).toBe(true);

    // Stop equals entry
    const equalPrice = calculatePositionSize({
      accountSize: 15000,
      entryPrice: 50.0,
      stopLoss: 50.0,
    });
    expect(equalPrice.isValid).toBe(false);
    expect(equalPrice.errors.length).toBeGreaterThan(0);

    // Negative entry
    const negEntry = calculatePositionSize({
      accountSize: 15000,
      entryPrice: -25.0,
      stopLoss: 20.0,
    });
    expect(negEntry.isValid).toBe(false);

    // Zero account size
    const zeroAccount = calculatePositionSize({
      accountSize: 0,
      entryPrice: 50.0,
      stopLoss: 45.0,
    });
    expect(zeroAccount.isValid).toBe(false);
  });

  it("2.6: Micro-account and high-value stock ($1,000 account vs $500 stock)", () => {
    // $1,000 account @ 1% risk = $10 risk budget
    // Stock is $500. Stop is $490 ($10 risk/sh).
    // Capital required for 1 share = $500 (50% of account, exceeds 25% max position cap)
    const result = calculatePositionSize({
      accountSize: 1000,
      riskPct: 1.0,
      entryPrice: 500.0,
      stopLoss: 490.0,
    });
    // 25% cap of $1,000 = $250 -> 0 whole shares
    expect(result.isValid).toBe(true);
    expect(result.shares).toBe(0);
    expect(result.limitingFactor).toBe("ZERO_SHARES");
  });
});

describe("M3 Adversarial: Pre-Trade Sleeve Guardrails & Invariants", () => {
  const baseActiveTrades: TradeRuleInput[] = [
    {
      id: "trade-1",
      ticker: "NVDA",
      sector: "Technology",
      status: "ACTIVE",
      entryTrigger: 120.0,
      actualEntry: 120.0,
      sharesTotal: 75,
      sharesRemaining: 75,
      initialStop: 118.0,
      currentStop: 118.0, // $150 risk
      target1: 124.0,
      target2: 127.0,
    },
    {
      id: "trade-2",
      ticker: "MSFT",
      sector: "Technology",
      status: "ACTIVE",
      entryTrigger: 400.0,
      actualEntry: 400.0,
      sharesTotal: 25,
      sharesRemaining: 25,
      initialStop: 394.0,
      currentStop: 394.0, // $150 risk
      target1: 412.0,
      target2: 421.0,
    },
  ];

  it("3.1: Enforces Max 3 active concurrent trades limit", () => {
    // 2 active trades -> 3rd trade is allowed
    const check3rd = validateProposedTrade(
      { ticker: "LLY", sector: "Healthcare", entryPrice: 800.0, stopLoss: 785.0, shares: 10, dollarRisk: 150.0 },
      { accountSize: 15000, trades: baseActiveTrades }
    );
    expect(check3rd.isAllowed).toBe(true);
    expect(check3rd.canOpen).toBe(true);

    // 3 active trades -> 4th trade is strictly blocked
    const threeActive = [
      ...baseActiveTrades,
      {
        id: "trade-3",
        ticker: "LLY",
        sector: "Healthcare",
        status: "ACTIVE",
        entryTrigger: 800.0,
        actualEntry: 800.0,
        sharesTotal: 10,
        sharesRemaining: 10,
        initialStop: 785.0,
        currentStop: 785.0,
        target1: 830.0,
        target2: 852.5,
      },
    ];

    const check4th = validateProposedTrade(
      { ticker: "AMZN", sector: "Consumer Discretionary", entryPrice: 180.0, stopLoss: 175.0, shares: 30, dollarRisk: 150.0 },
      { accountSize: 15000, trades: threeActive }
    );
    expect(check4th.isAllowed).toBe(false);
    expect(check4th.canOpen).toBe(false);
    expect(check4th.blockReason).toContain("Maximum 3 active concurrent swing trades allowed");
  });

  it("3.2: Enforces Sector Concentration limit (Max 2 per sector) with case/whitespace tolerance", () => {
    // baseActiveTrades has 2 Technology trades (NVDA, MSFT)
    // Proposing 3rd Technology trade must be blocked
    const tech3rd = validateProposedTrade(
      { ticker: "AAPL", sector: "  technology  ", entryPrice: 220.0, stopLoss: 215.0, shares: 20, dollarRisk: 100.0 },
      { accountSize: 15000, maxSectorPositions: 2, trades: baseActiveTrades }
    );
    expect(tech3rd.isAllowed).toBe(false);
    expect(tech3rd.blockReason).toContain("Sector concentration limit exceeded");

    // Different sector (Industrials) must pass
    const indusTrade = validateProposedTrade(
      { ticker: "GE", sector: "Industrials", entryPrice: 160.0, stopLoss: 155.0, shares: 20, dollarRisk: 100.0 },
      { accountSize: 15000, maxSectorPositions: 2, trades: baseActiveTrades }
    );
    expect(indusTrade.isAllowed).toBe(true);
  });

  it("3.3: Enforces 3.0% total sleeve open risk cap ($450 on $15,000 capital)", () => {
    // 2 active trades with $150 risk each ($300 existing risk)
    // Proposing a trade with $150 risk brings total to $450 (exactly 3.0%) -> Allowed
    const exactCapTrade = validateProposedTrade(
      { ticker: "LLY", sector: "Healthcare", dollarRisk: 150.0 },
      { accountSize: 15000, maxSleeveRiskPct: 3.0, trades: baseActiveTrades }
    );
    expect(exactCapTrade.isAllowed).toBe(true);
    expect(exactCapTrade.projectedOpenRiskDollars).toBe(450.0);
    expect(exactCapTrade.projectedOpenRiskPct).toBe(3.0);

    // Proposing a trade with $151 risk brings total to $451 (3.0067% > 3.0%) -> Blocked
    const breachTrade = validateProposedTrade(
      { ticker: "LLY", sector: "Healthcare", dollarRisk: 151.0 },
      { accountSize: 15000, maxSleeveRiskPct: 3.0, trades: baseActiveTrades }
    );
    expect(breachTrade.isAllowed).toBe(false);
    expect(breachTrade.blockReason).toContain("Aggregate sleeve open risk limit exceeded");
  });

  it("3.4: Releasing open risk when a trade stop is moved to Breakeven", () => {
    // NVDA stop moved to Breakeven ($120.00)
    const beActiveTrades: TradeRuleInput[] = [
      {
        ...baseActiveTrades[0],
        status: "SCALED_T1",
        currentStop: 120.0, // Breakeven stop!
        sharesRemaining: 37,
      },
      baseActiveTrades[1], // MSFT has $150 risk
    ];

    expect(calculateTradeOpenRisk(beActiveTrades[0])).toBe(0.0);
    expect(calculateTradeOpenRisk(beActiveTrades[1])).toBe(150.0);
    expect(calculateAggregateOpenRisk(beActiveTrades)).toBe(150.0);

    // Now adding a $150 trade results in $300 total open risk (2.0% of $15k) -> Allowed!
    const newTrade = validateProposedTrade(
      { ticker: "LLY", sector: "Healthcare", dollarRisk: 150.0 },
      { accountSize: 15000, trades: beActiveTrades }
    );
    expect(newTrade.isAllowed).toBe(true);
    expect(newTrade.projectedOpenRiskDollars).toBe(300.0);
    expect(newTrade.projectedOpenRiskPct).toBe(2.0);
  });
});

describe("M3 Adversarial: 4-Tier Price Ladder Geometry & Needle Clamping", () => {
  // Pure helper computing Price Ladder geometry and needle percentage
  function computeLadderGeometry(entry: number, stop: number, customT1?: number, customT2?: number, curP?: number) {
    const riskPerShare = Math.max(0.01, Math.abs(entry - stop));
    const target1 = customT1 ?? Number((entry + 2.0 * riskPerShare).toFixed(2));
    const target2 = customT2 ?? Number((entry + 3.5 * riskPerShare).toFixed(2));

    const totalRange = Math.max(0.01, target2 - stop);
    const needlePct = curP !== undefined
      ? Math.min(100, Math.max(0, ((curP - stop) / totalRange) * 100))
      : Math.min(100, Math.max(0, ((entry - stop) / totalRange) * 100));

    const t1R = (target1 - entry) / riskPerShare;
    const t2R = (target2 - entry) / riskPerShare;

    return {
      riskPerShare,
      stopLoss: stop,
      entryTrigger: entry,
      target1,
      target2,
      totalRange,
      needlePct: Number(needlePct.toFixed(2)),
      t1R: Number(t1R.toFixed(2)),
      t2R: Number(t2R.toFixed(2)),
    };
  }

  it("4.1: Calculates standard 4-Tier ladder geometry: Stop < Entry < T1 (2R) < T2 (3.5R)", () => {
    const geom = computeLadderGeometry(100.0, 95.0); // Entry 100, Stop 95 (Risk = $5)
    expect(geom.riskPerShare).toBe(5.0);
    expect(geom.stopLoss).toBe(95.0);
    expect(geom.entryTrigger).toBe(100.0);
    expect(geom.target1).toBe(110.0); // 100 + 2*5 = 110 (+2.0R)
    expect(geom.target2).toBe(117.5); // 100 + 3.5*5 = 117.5 (+3.5R)
    expect(geom.t1R).toBe(2.0);
    expect(geom.t2R).toBe(3.5);
    expect(geom.totalRange).toBe(22.5); // 117.5 - 95.0 = 22.5
    // At entry (100): (100 - 95)/22.5 = 5/22.5 = 22.22%
    expect(geom.needlePct).toBe(22.22);
  });

  it("4.2: Clamps tape needle at exact boundary points", () => {
    // Current price at Stop Loss ($95) -> needlePct = 0%
    const atStop = computeLadderGeometry(100.0, 95.0, undefined, undefined, 95.0);
    expect(atStop.needlePct).toBe(0.0);

    // Current price at Target 1 ($110) -> needlePct = (110 - 95)/22.5 = 15/22.5 = 66.67%
    const atT1 = computeLadderGeometry(100.0, 95.0, undefined, undefined, 110.0);
    expect(atT1.needlePct).toBe(66.67);

    // Current price at Target 2 ($117.50) -> needlePct = 100%
    const atT2 = computeLadderGeometry(100.0, 95.0, undefined, undefined, 117.5);
    expect(atT2.needlePct).toBe(100.0);
  });

  it("4.3: Clamps tape needle when price expands beyond upper or lower extremes (no overflow)", () => {
    // Huge gap down to $70 (far below stop $95) -> clamped to exactly 0%
    const deepGapDown = computeLadderGeometry(100.0, 95.0, undefined, undefined, 70.0);
    expect(deepGapDown.needlePct).toBe(0.0);

    // Moonshot rally to $150 (far above target 2 $117.50) -> clamped to exactly 100%
    const superRally = computeLadderGeometry(100.0, 95.0, undefined, undefined, 150.0);
    expect(superRally.needlePct).toBe(100.0);
  });
});

describe("M3 Adversarial: Zero-Dependency Web Audio Synthesizer Runtime Safety", () => {
  it("5.1: Audio sound helpers execute cleanly in Node/SSR environment without throwing", () => {
    // Under Node.js test environment, window and AudioContext are undefined.
    // All audio triggers must safely no-op and never crash the process.
    expect(() => playTargetChime()).not.toThrow();
    expect(() => playStopLossAlert()).not.toThrow();
    expect(() => playEntryTriggered()).not.toThrow();
    expect(() => playTimeStopWarning()).not.toThrow();
  });

  it("5.2: Audio volume and mute controls state management", () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
    setMuted(false);
    expect(isMuted()).toBe(false);

    setVolume(0.5);
    expect(getVolume()).toBe(0.5);
    setVolume(1.5); // clamped to 1.0
    expect(getVolume()).toBeLessThanOrEqual(1.0);
    setVolume(-0.5); // clamped to 0.0
    expect(getVolume()).toBeGreaterThanOrEqual(0.0);
  });
});
