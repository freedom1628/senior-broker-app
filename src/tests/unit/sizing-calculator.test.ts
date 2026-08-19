// Unit Test Suite 1: Auto Position Sizer & Risk Modeling Engine
// Tests 1% Account Risk Model, Capital Guardrails, ATR Stops, and Dynamic R:R Targets

import { describe, it, expect } from "../helpers/assertions";
import { calculatePositionSize } from "@/lib/portfolio/sizing-calculator";

describe("Unit: Sizing Calculator (1% Account Risk Model)", () => {
  it("1. calculates exact 1% risk position size on $15,000 capital baseline", () => {
    const res = calculatePositionSize({
      accountSize: 15000,
      riskPct: 1.0,
      entryPrice: 50.0,
      stopLoss: 47.0,
    });

    // Dollar Risk = $15,000 * 1% = $150.00
    // Risk Per Share = $50.00 - $47.00 = $3.00
    // Shares = floor(150 / 3) = 50 shares
    // Allocated Capital = 50 * $50 = $2,500.00 (16.67% of account)
    expect(res.isValid).toBe(true);
    expect(res.status).toBe("VALID");
    expect(res.shares).toBe(50);
    expect(res.allocatedCapital).toBe(2500);
    expect(res.dollarRisk).toBe(150.0);
    expect(res.actualRiskPct).toBe(1.0);
    expect(res.riskPerShare).toBe(3.0);
    expect(res.target1).toBe(56.0); // 2.0R (+ $6.00)
    expect(res.target2).toBe(60.5); // 3.5R (+ $10.50)
    expect(res.rewardToRiskT1).toBe(2.0);
    expect(res.rewardToRiskT2).toBe(3.5);
    expect(res.blendedExpectedR).toBe(2.75);
    expect(res.limitingFactor).toBe("RISK_BUDGET");
    expect(res.errors).toHaveLength(0);
  });

  it("2. rejects inverted stop loss (stop price greater than or equal to entry)", () => {
    const res1 = calculatePositionSize({
      accountSize: 15000,
      entryPrice: 100.0,
      stopLoss: 105.0,
    });
    expect(res1.isValid).toBe(false);
    expect(res1.status).toBe("INVALID");
    expect(res1.shares).toBe(0);
    expect(res1.errors.some((e) => e.includes("strictly below entry"))).toBe(true);

    const res2 = calculatePositionSize({
      accountSize: 15000,
      entryPrice: 100.0,
      stopLoss: 100.0,
    });
    expect(res2.isValid).toBe(false);
    expect(res2.status).toBe("INVALID");
    expect(res2.shares).toBe(0);
  });

  it("3. rejects zero or negative stop loss price", () => {
    const resZero = calculatePositionSize({
      accountSize: 15000,
      entryPrice: 100.0,
      stopLoss: 0,
    });
    expect(resZero.isValid).toBe(false);
    expect(resZero.status).toBe("INVALID");
    expect(resZero.errors.some((e) => e.includes("greater than zero"))).toBe(true);

    const resNeg = calculatePositionSize({
      accountSize: 15000,
      entryPrice: 100.0,
      stopLoss: -10.0,
    });
    expect(resNeg.isValid).toBe(false);
    expect(resNeg.shares).toBe(0);
  });

  it("4. rejects zero or negative entry price", () => {
    const resZero = calculatePositionSize({
      accountSize: 15000,
      entryPrice: 0,
      stopLoss: 90,
    });
    expect(resZero.isValid).toBe(false);
    expect(resZero.errors.some((e) => e.includes("positive number"))).toBe(true);

    const resNeg = calculatePositionSize({
      accountSize: 15000,
      entryPrice: -50,
      stopLoss: 40,
    });
    expect(resNeg.isValid).toBe(false);
  });

  it("5. rejects zero or negative account size", () => {
    const res = calculatePositionSize({
      accountSize: 0,
      entryPrice: 100,
      stopLoss: 95,
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.includes("Account size"))).toBe(true);
  });

  it("6. caps shares when tight stop exceeds available buying power and cash buffer", () => {
    // $500 stock with $1 stop ($499). Mathematical risk shares = 150 shares ($75,000).
    // Available cash = $2,500 with 5% buffer = $2,375 usable (< $3,750 25% max position cap).
    // Capped by buying power: floor($2,375 / 500) = 4 shares.
    const res = calculatePositionSize({
      accountSize: 15000,
      riskPct: 1.0,
      entryPrice: 500.0,
      stopLoss: 499.0,
      availableCash: 2500,
      cashBufferPct: 0.05,
    });

    expect(res.isValid).toBe(true);
    expect(res.shares).toBe(4);
    expect(res.allocatedCapital).toBe(2000);
    expect(res.dollarRisk).toBe(4.0);
    expect(res.status).toBe("WARNING");
    expect(res.limitingFactor).toBe("BUYING_POWER");
  });

  it("7. caps shares at single position concentration limit (25% default)", () => {
    // $100 stock with $0.50 stop ($99.50).
    // Risk budget = $150 / $0.50 = 300 shares ($30,000 capital, 200% account).
    // Max 25% concentration cap = $3,750 / $100 = 37 shares.
    const res = calculatePositionSize({
      accountSize: 15000,
      riskPct: 1.0,
      entryPrice: 100.0,
      stopLoss: 99.5,
      availableCash: 50000, // unlimited cash
      maxPositionPct: 25.0,
    });

    expect(res.isValid).toBe(true);
    expect(res.shares).toBe(37);
    expect(res.allocatedCapital).toBe(3700);
    expect(res.allocatedCapitalPct).toBeLessThanOrEqual(25.0);
    expect(res.limitingFactor).toBe("MAX_POSITION_CAP");
    expect(res.warnings.some((w) => w.includes("concentration limit"))).toBe(true);
  });

  it("8. floors fractional shares to whole integer to prevent risk over-allocation", () => {
    // $150 risk budget / $3.50 risk per share = 42.857 shares.
    // Must floor to 42 shares ($147 risk), never round up to 43 shares ($150.50 risk).
    const res = calculatePositionSize({
      accountSize: 15000,
      riskPct: 1.0,
      entryPrice: 45.0,
      stopLoss: 41.5,
      allowFractional: false,
    });

    expect(res.shares).toBe(42);
    expect(res.dollarRisk).toBe(147.0);
    expect(res.dollarRisk).toBeLessThanOrEqual(150.0);
  });

  it("9. supports fractional shares mode when requested", () => {
    const res = calculatePositionSize({
      accountSize: 15000,
      riskPct: 1.0,
      entryPrice: 45.0,
      stopLoss: 41.5, // risk/share = $3.50
      allowFractional: true,
    });

    expect(res.shares).toBeCloseTo(42.8571, 3);
    expect(res.dollarRisk).toBeCloseTo(150.0, 1);
  });

  it("10. supports round lot (10-share block) rounding", () => {
    // 37.5 shares floored to nearest 10 = 30 shares
    const res = calculatePositionSize({
      accountSize: 15000,
      riskPct: 1.0,
      entryPrice: 50.0,
      stopLoss: 46.0, // $4 risk/share -> 150/4 = 37.5
      roundLot: true,
    });

    expect(res.shares).toBe(30);
    expect(res.dollarRisk).toBe(120.0);
  });

  it("11. computes dynamic stop loss using 2.0x ATR when stop loss is omitted", () => {
    const res = calculatePositionSize({
      accountSize: 15000,
      entryPrice: 100.0,
      atr: 3.5,
      atrMultiplier: 2.0,
    });

    // Effective Stop = 100 - (3.5 * 2) = 93.00
    // Risk Per Share = $7.00
    // Shares = floor(150 / 7) = 21 shares
    expect(res.isAtrDerivedStop).toBe(true);
    expect(res.stopLoss).toBe(93.0);
    expect(res.riskPerShare).toBe(7.0);
    expect(res.shares).toBe(21);
    expect(res.target1).toBe(114.0); // 100 + (2 * 7)
    expect(res.target2).toBe(124.5); // 100 + (3.5 * 7)
  });

  it("12. falls back to 5% technical pivot stop when both stop and ATR are omitted", () => {
    const res = calculatePositionSize({
      accountSize: 15000,
      entryPrice: 80.0,
    });

    // 5% below $80 = $76.00
    expect(res.isAtrDerivedStop).toBe(false);
    expect(res.stopLoss).toBe(76.0);
    expect(res.riskPerShare).toBe(4.0);
    expect(res.shares).toBe(37); // floor(150 / 4)
    expect(res.warnings.some((w) => w.includes("5% technical pivot stop"))).toBe(true);
  });

  it("13. rejects order when available cash is insufficient for 1 share", () => {
    const res = calculatePositionSize({
      accountSize: 15000,
      entryPrice: 1000.0,
      stopLoss: 950.0,
      availableCash: 500.0,
    });

    expect(res.isValid).toBe(false);
    expect(res.status).toBe("INVALID");
    expect(res.shares).toBe(0);
    expect(res.errors.some((e) => e.includes("Insufficient cash"))).toBe(true);
  });

  it("14. scales risk budget dynamically with custom risk percentage", () => {
    // 0.5% risk on $15k = $75 risk
    const resHalf = calculatePositionSize({
      accountSize: 15000,
      riskPct: 0.5,
      entryPrice: 100,
      stopLoss: 90, // $10 risk/share
    });
    expect(resHalf.shares).toBe(7);
    expect(resHalf.dollarRisk).toBe(70);

    // 2.0% risk on $15k = $300 risk
    const resDouble = calculatePositionSize({
      accountSize: 15000,
      riskPct: 2.0,
      entryPrice: 100,
      stopLoss: 90,
    });
    expect(resDouble.shares).toBe(30);
    expect(resDouble.dollarRisk).toBe(300);
  });
});
