import { EquityDataPoint, TimeframeOption, PortfolioSummaryMetrics } from "@/types";

export const MOCK_EQUITY_SERIES: Record<TimeframeOption, EquityDataPoint[]> = {
  "1D": [
    { timestamp: "2026-08-19T09:30:00Z", timeLabel: "09:30 AM", equity: 15000.0, changeDollars: 0, changePct: 0 },
    { timestamp: "2026-08-19T10:30:00Z", timeLabel: "10:30 AM", equity: 15045.2, changeDollars: 45.2, changePct: 0.3 },
    { timestamp: "2026-08-19T11:30:00Z", timeLabel: "11:30 AM", equity: 15112.5, changeDollars: 112.5, changePct: 0.75 },
    { timestamp: "2026-08-19T12:30:00Z", timeLabel: "12:30 PM", equity: 15089.0, changeDollars: 89.0, changePct: 0.59 },
    { timestamp: "2026-08-19T13:30:00Z", timeLabel: "01:30 PM", equity: 15185.4, changeDollars: 185.4, changePct: 1.24 },
    { timestamp: "2026-08-19T14:30:00Z", timeLabel: "02:30 PM", equity: 15270.0, changeDollars: 270.0, changePct: 1.8 },
    { timestamp: "2026-08-19T15:30:00Z", timeLabel: "03:30 PM", equity: 15310.8, changeDollars: 310.8, changePct: 2.07 },
    { timestamp: "2026-08-19T16:00:00Z", timeLabel: "04:00 PM", equity: 15340.5, changeDollars: 340.5, changePct: 2.27 },
  ],
  "1W": [
    { timestamp: "2026-08-15T16:00:00Z", timeLabel: "Fri (Prev)", equity: 14920.0, changeDollars: -80.0, changePct: -0.53 },
    { timestamp: "2026-08-16T16:00:00Z", timeLabel: "Mon", equity: 15050.0, changeDollars: 50.0, changePct: 0.33 },
    { timestamp: "2026-08-17T16:00:00Z", timeLabel: "Tue", equity: 15120.0, changeDollars: 120.0, changePct: 0.8 },
    { timestamp: "2026-08-18T16:00:00Z", timeLabel: "Wed", equity: 15210.0, changeDollars: 210.0, changePct: 1.4 },
    { timestamp: "2026-08-19T16:00:00Z", timeLabel: "Today", equity: 15340.5, changeDollars: 340.5, changePct: 2.27 },
  ],
  "1M": [
    { timestamp: "2026-07-20T16:00:00Z", timeLabel: "Jul 20", equity: 14650.0, changeDollars: -350.0, changePct: -2.33 },
    { timestamp: "2026-07-27T16:00:00Z", timeLabel: "Jul 27", equity: 14820.0, changeDollars: -180.0, changePct: -1.2 },
    { timestamp: "2026-08-03T16:00:00Z", timeLabel: "Aug 03", equity: 14980.0, changeDollars: -20.0, changePct: -0.13 },
    { timestamp: "2026-08-10T16:00:00Z", timeLabel: "Aug 10", equity: 15160.0, changeDollars: 160.0, changePct: 1.07 },
    { timestamp: "2026-08-19T16:00:00Z", timeLabel: "Aug 19", equity: 15340.5, changeDollars: 340.5, changePct: 2.27 },
  ],
  "1Y": [
    { timestamp: "2025-08-19T16:00:00Z", timeLabel: "Q3 '25", equity: 13500.0, changeDollars: -1500.0, changePct: -10.0 },
    { timestamp: "2025-11-19T16:00:00Z", timeLabel: "Q4 '25", equity: 14100.0, changeDollars: -900.0, changePct: -6.0 },
    { timestamp: "2026-02-19T16:00:00Z", timeLabel: "Q1 '26", equity: 14600.0, changeDollars: -400.0, changePct: -2.67 },
    { timestamp: "2026-05-19T16:00:00Z", timeLabel: "Q2 '26", equity: 15000.0, changeDollars: 0.0, changePct: 0.0 },
    { timestamp: "2026-08-19T16:00:00Z", timeLabel: "Q3 '26", equity: 15340.5, changeDollars: 340.5, changePct: 2.27 },
  ],
};

export function generateDynamicEquityCurve(
  startingCapital: number = 15000,
  floatingPnL: number = 0,
  timeframe: TimeframeOption = "1D"
): EquityDataPoint[] {
  const baseSeries = MOCK_EQUITY_SERIES[timeframe] || MOCK_EQUITY_SERIES["1D"];
  if (!baseSeries || baseSeries.length === 0) return [];

  const currentEquity = startingCapital + floatingPnL;
  const lastIndex = baseSeries.length - 1;

  return baseSeries.map((pt, idx) => {
    if (idx === lastIndex) {
      const delta = currentEquity - startingCapital;
      const pct = startingCapital > 0 ? (delta / startingCapital) * 100 : 0;
      return {
        ...pt,
        equity: Number(currentEquity.toFixed(2)),
        changeDollars: Number(delta.toFixed(2)),
        changePct: Number(pct.toFixed(2)),
      };
    }
    const ratio = pt.equity / 15000.0;
    const scaledEquity = Number((startingCapital * ratio).toFixed(2));
    const delta = scaledEquity - startingCapital;
    const pct = startingCapital > 0 ? (delta / startingCapital) * 100 : 0;
    return {
      ...pt,
      equity: scaledEquity,
      changeDollars: Number(delta.toFixed(2)),
      changePct: Number(pct.toFixed(2)),
    };
  });
}

export function computePortfolioSummaryMetrics(
  accountSize: number = 15000,
  activeTrades: any[] = [],
  marketQuotes: Record<string, any> = {},
  maxSleeveRiskPct: number = 3.0
): PortfolioSummaryMetrics {
  const validActiveTrades = activeTrades.filter(
    (t) => t && (t.status === "ACTIVE" || t.status === "SCALED_T1")
  );

  let allocatedCapital = 0;
  let floatingPnL = 0;
  let openRiskDollars = 0;

  for (const trade of validActiveTrades) {
    const sym = (trade.ticker || "").toUpperCase();
    const quote = marketQuotes[sym];
    const entry = trade.actualEntry || trade.entryTrigger || 0;
    const currentPrice = quote?.price ?? entry;
    const shares = trade.sharesRemaining !== undefined ? trade.sharesRemaining : (trade.sharesTotal || 0);

    allocatedCapital += entry * shares;
    floatingPnL += (currentPrice - entry) * shares;

    // Invariant: if current stop is ratcheted at or above entry, open risk is $0.00
    const currentStop = trade.currentStop ?? trade.initialStop ?? entry;
    if (currentStop < entry) {
      openRiskDollars += (entry - currentStop) * shares;
    }
  }

  const cashAvailable = Math.max(0, accountSize - allocatedCapital);
  const totalSleeveValue = accountSize + floatingPnL;
  const floatingPnLPct = accountSize > 0 ? (floatingPnL / accountSize) * 100 : 0;
  const openRiskPct = accountSize > 0 ? (openRiskDollars / accountSize) * 100 : 0;
  const isRiskSafe = openRiskPct <= maxSleeveRiskPct;
  const riskCapacityRemaining = Math.max(0, Number((maxSleeveRiskPct - openRiskPct).toFixed(2)));

  return {
    dedicatedCapital: Number(accountSize.toFixed(2)),
    allocatedCapital: Number(allocatedCapital.toFixed(2)),
    cashAvailable: Number(cashAvailable.toFixed(2)),
    openRiskDollars: Number(openRiskDollars.toFixed(2)),
    openRiskPct: Number(openRiskPct.toFixed(2)),
    floatingPnL: Number(floatingPnL.toFixed(2)),
    floatingPnLPct: Number(floatingPnLPct.toFixed(2)),
    totalSleeveValue: Number(totalSleeveValue.toFixed(2)),
    activePositionsCount: validActiveTrades.length,
    isRiskSafe,
    riskCapacityRemaining,
  };
}
