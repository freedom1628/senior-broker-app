// Auto Position Sizer & Risk Modeling Engine
// Implements 1% Account Risk Model ($150 risk on $15,000 default capital)
// with buying power caps, cash buffers, ATR volatility stops, and asymmetric target ladders.

export const DEFAULT_ACCOUNT_SIZE = 15000.0;
export const DEFAULT_RISK_PCT = 1.0;
export const DEFAULT_ATR_MULTIPLIER = 2.0;
export const DEFAULT_CASH_BUFFER_PCT = 0.05; // 5% cash buffer
export const DEFAULT_MAX_POSITION_PCT = 25.0; // Max 25% account capital in 1 position

export interface SizingInput {
  accountSize?: number; // Dedicated swing capital (default $15,000)
  riskPct?: number; // Target risk percentage (default 1.0% = $150)
  entryPrice: number; // Planned entry price
  stopLoss?: number; // Hard stop loss price
  atr?: number; // 14-day Average True Range (optional dynamic stop)
  atrMultiplier?: number; // Multiplier for ATR stop (default 2.0x)
  target1?: number; // Optional custom T1 override (defaults to 2.0R)
  target2?: number; // Optional custom T2 override (defaults to 3.5R)
  availableCash?: number; // Cash available in sleeve (defaults to accountSize)
  cashAvailable?: number; // Alias for availableCash
  cashBufferPct?: number; // Cash safety reserve buffer (default 0.05 = 5%)
  maxPositionPct?: number; // Maximum capital concentration in single stock (default 25.0%)
  maxCapitalPctPerTrade?: number; // Alias for maxPositionPct
  allowFractional?: boolean; // Enable fractional share calculation (default false)
  roundLot?: boolean; // Round down to nearest 10-share block (default false)
}

export type SizingLimitingFactor =
  | "RISK_BUDGET"
  | "BUYING_POWER"
  | "MAX_POSITION_CAP"
  | "ZERO_SHARES";

export interface SizingResult {
  isValid: boolean;
  status: "VALID" | "WARNING" | "INVALID";
  shares: number;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskPerShare: number;
  dollarRisk: number;
  actualRiskPct: number;
  allocatedCapital: number;
  allocatedCapitalPct: number;
  rewardToRisk: number; // Reward-to-Risk ratio for Target 1
  rewardToRiskT1: number; // Reward-to-Risk ratio for Target 1
  rewardToRiskT2: number; // Reward-to-Risk ratio for Target 2
  blendedExpectedR: number; // (0.5 * T1_R) + (0.5 * T2_R)
  limitingFactor: SizingLimitingFactor;
  isAtrDerivedStop: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Calculates exact share allocation and execution ladders based on 1% account risk
 * and capital guardrails.
 */
export function calculatePositionSize(input: SizingInput): SizingResult {
  const accountSize = Math.max(0, input.accountSize ?? DEFAULT_ACCOUNT_SIZE);
  const riskPct = Math.max(0, input.riskPct ?? DEFAULT_RISK_PCT);
  const cashBufferPct = input.cashBufferPct ?? DEFAULT_CASH_BUFFER_PCT;
  const maxPositionPct = input.maxPositionPct ?? input.maxCapitalPctPerTrade ?? DEFAULT_MAX_POSITION_PCT;
  const availableCash = input.cashAvailable ?? input.availableCash ?? accountSize;
  const entryPrice = input.entryPrice;
  const allowFractional = input.allowFractional ?? false;
  const roundLot = input.roundLot ?? false;

  const warnings: string[] = [];
  const errors: string[] = [];

  // Validation 1: Account Capital
  if (accountSize <= 0 || isNaN(accountSize)) {
    errors.push("Account size must be greater than zero.");
  }

  // Validation 2: Entry Price
  if (entryPrice <= 0 || isNaN(entryPrice)) {
    errors.push("Entry price must be a positive number.");
  }

  // Determine Stop Loss (Explicit vs ATR-Derived vs Fallback)
  let stopLoss = input.stopLoss;
  let isAtrDerivedStop = false;

  if (stopLoss === undefined || stopLoss === null || isNaN(stopLoss)) {
    if (input.atr !== undefined && input.atr > 0) {
      const multiplier = input.atrMultiplier ?? DEFAULT_ATR_MULTIPLIER;
      stopLoss = Number((entryPrice - (input.atr * multiplier)).toFixed(2));
      isAtrDerivedStop = true;
    } else if (entryPrice > 0) {
      // 5.0% technical stop fallback
      stopLoss = Number((entryPrice * 0.95).toFixed(2));
      warnings.push("Stop loss not provided; defaulted to 5% technical pivot stop.");
    } else {
      stopLoss = 0;
    }
  }

  // Validation 3: Stop Loss Price Bounds
  if (stopLoss <= 0 || isNaN(stopLoss)) {
    errors.push("Stop loss must be greater than zero.");
  }
  if (entryPrice > 0 && stopLoss >= entryPrice) {
    errors.push("Stop loss must be strictly below entry price for long trades.");
  }

  const rawDiff = entryPrice > 0 && stopLoss > 0 ? entryPrice - stopLoss : 0;
  if (entryPrice > 0 && stopLoss > 0 && rawDiff <= 0) {
    errors.push("Risk per share cannot be zero.");
  }

  // If any errors exist, return invalid result
  if (errors.length > 0) {
    return {
      isValid: false,
      status: "INVALID",
      shares: 0,
      entryPrice: Math.max(0, entryPrice || 0),
      stopLoss: Math.max(0, stopLoss || 0),
      target1: 0,
      target2: 0,
      riskPerShare: 0,
      dollarRisk: 0,
      actualRiskPct: 0,
      allocatedCapital: 0,
      allocatedCapitalPct: 0,
      rewardToRisk: 0,
      rewardToRiskT1: 0,
      rewardToRiskT2: 0,
      blendedExpectedR: 0,
      limitingFactor: "ZERO_SHARES",
      isAtrDerivedStop,
      warnings,
      errors,
    };
  }

  // Math Calculations
  const riskBudget = (accountSize * riskPct) / 100.0;
  const riskPerShare = Number(rawDiff.toFixed(4));

  // Raw Risk-Based Share Sizing
  const rawSharesByRisk = riskBudget / riskPerShare;

  // Capital Limitations:
  // 1. Available cash with safety buffer
  const usableCash = Math.max(0, availableCash * (1 - cashBufferPct));
  // 2. Max position concentration cap (e.g. 25% of account)
  const maxPositionCapital = (accountSize * maxPositionPct) / 100.0;
  const effectiveCapitalLimit = Math.min(usableCash, maxPositionCapital);
  const rawSharesByCapital = effectiveCapitalLimit / entryPrice;

  let limitingFactor: SizingLimitingFactor = "RISK_BUDGET";
  let targetShares = rawSharesByRisk;

  if (rawSharesByCapital < rawSharesByRisk) {
    targetShares = rawSharesByCapital;
    limitingFactor = usableCash <= maxPositionCapital ? "BUYING_POWER" : "MAX_POSITION_CAP";
    warnings.push(
      limitingFactor === "BUYING_POWER"
        ? "Capped by available cash/buying power buffer."
        : `Position size capped at ${maxPositionPct}% single-position concentration limit.`
    );
  }

  // Formatting & Rounding Shares
  let finalShares: number;
  if (allowFractional) {
    finalShares = Number(targetShares.toFixed(4));
  } else if (roundLot) {
    finalShares = Math.floor(targetShares / 10) * 10;
  } else {
    finalShares = Math.floor(targetShares);
  }

  if (finalShares <= 0) {
    finalShares = 0;
    limitingFactor = "ZERO_SHARES";
    if (availableCash < entryPrice) {
      errors.push("Insufficient cash available to purchase minimum 1 share.");
      return {
        isValid: false,
        status: "INVALID",
        shares: 0,
        entryPrice,
        stopLoss: stopLoss!,
        target1: 0,
        target2: 0,
        riskPerShare,
        dollarRisk: 0,
        actualRiskPct: 0,
        allocatedCapital: 0,
        allocatedCapitalPct: 0,
        rewardToRisk: 0,
        rewardToRiskT1: 0,
        rewardToRiskT2: 0,
        blendedExpectedR: 0,
        limitingFactor: "ZERO_SHARES",
        isAtrDerivedStop,
        warnings,
        errors,
      };
    }
    warnings.push("Calculated shares is 0. Entry price or risk per share exceeds allocated budget.");
  }

  const dollarRisk = Number((finalShares * riskPerShare).toFixed(2));
  const actualRiskPct = accountSize > 0 ? Number(((dollarRisk / accountSize) * 100).toFixed(4)) : 0;
  const allocatedCapital = Number((finalShares * entryPrice).toFixed(2));
  const allocatedCapitalPct = accountSize > 0 ? Number(((allocatedCapital / accountSize) * 100).toFixed(2)) : 0;

  // Targets Calculation (2.0R for T1, 3.5R for T2 runner)
  const target1 = input.target1 !== undefined && input.target1 > 0
    ? input.target1
    : Number((entryPrice + (2.0 * riskPerShare)).toFixed(2));

  const target2 = input.target2 !== undefined && input.target2 > 0
    ? input.target2
    : Number((entryPrice + (3.5 * riskPerShare)).toFixed(2));

  const rewardToRiskT1 = riskPerShare > 0 ? Number(((target1 - entryPrice) / riskPerShare).toFixed(2)) : 0;
  const rewardToRiskT2 = riskPerShare > 0 ? Number(((target2 - entryPrice) / riskPerShare).toFixed(2)) : 0;
  const blendedExpectedR = Number(((0.5 * rewardToRiskT1) + (0.5 * rewardToRiskT2)).toFixed(2));

  const status = warnings.length > 0 && finalShares > 0 ? "WARNING" : "VALID";

  return {
    isValid: true,
    status,
    shares: finalShares,
    entryPrice,
    stopLoss: stopLoss!,
    target1,
    target2,
    riskPerShare,
    dollarRisk,
    actualRiskPct,
    allocatedCapital,
    allocatedCapitalPct,
    rewardToRisk: rewardToRiskT1,
    rewardToRiskT1,
    rewardToRiskT2,
    blendedExpectedR,
    limitingFactor,
    isAtrDerivedStop,
    warnings,
    errors: [],
  };
}
