export interface QuoteData {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  volume: number;
  prevClose: number;
  lastUpdated: string;
}

// Stable, deterministic quote store with zero artificial jitter
const QUOTE_CACHE: Record<string, QuoteData> = {
  ATRO: {
    ticker: "ATRO",
    name: "Astronics Corporation",
    price: 88.95,
    change: 1.58,
    changePct: 1.81,
    high: 92.49,
    low: 85.00,
    volume: 1240000,
    prevClose: 87.37,
    lastUpdated: new Date().toISOString(),
  },
  MTRN: {
    ticker: "MTRN",
    name: "Materion Corporation",
    price: 284.10,
    change: -2.75,
    changePct: -0.96,
    high: 289.40,
    low: 281.80,
    volume: 450000,
    prevClose: 286.85,
    lastUpdated: new Date().toISOString(),
  },
  LITE: {
    ticker: "LITE",
    name: "Lumentum Holdings Inc.",
    price: 948.50,
    change: 8.50,
    changePct: 0.90,
    high: 955.00,
    low: 932.00,
    volume: 8200000,
    prevClose: 940.00,
    lastUpdated: new Date().toISOString(),
  },
  GLBE: {
    ticker: "GLBE",
    name: "Global-e Online Ltd.",
    price: 43.10,
    change: 0.50,
    changePct: 1.17,
    high: 43.99,
    low: 42.10,
    volume: 3800000,
    prevClose: 42.60,
    lastUpdated: new Date().toISOString(),
  },
  NIQ: {
    ticker: "NIQ",
    name: "NIQ Global Intelligence",
    price: 16.45,
    change: 0.20,
    changePct: 1.23,
    high: 16.90,
    low: 16.10,
    volume: 15400000,
    prevClose: 16.25,
    lastUpdated: new Date().toISOString(),
  },
  CRWV: {
    ticker: "CRWV",
    name: "CoreWeave Inc.",
    price: 91.80,
    change: -0.20,
    changePct: -0.22,
    high: 94.50,
    low: 88.00,
    volume: 4200000,
    prevClose: 92.00,
    lastUpdated: new Date().toISOString(),
  },
  HALO: {
    ticker: "HALO",
    name: "Halozyme Therapeutics",
    price: 97.40,
    change: 0.40,
    changePct: 0.41,
    high: 104.00,
    low: 95.80,
    volume: 1600000,
    prevClose: 97.00,
    lastUpdated: new Date().toISOString(),
  },
  TWLO: {
    ticker: "TWLO",
    name: "Twilio Inc.",
    price: 243.50,
    change: 2.50,
    changePct: 1.04,
    high: 254.00,
    low: 238.00,
    volume: 3100000,
    prevClose: 241.00,
    lastUpdated: new Date().toISOString(),
  },
  SPY: {
    ticker: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    price: 774.20,
    change: 1.54,
    changePct: 0.20,
    high: 775.40,
    low: 771.80,
    volume: 48000000,
    prevClose: 772.66,
    lastUpdated: new Date().toISOString(),
  },
  QQQ: {
    ticker: "QQQ",
    name: "Invesco QQQ Trust",
    price: 726.80,
    change: 2.28,
    changePct: 0.31,
    high: 728.50,
    low: 723.10,
    volume: 34000000,
    prevClose: 724.52,
    lastUpdated: new Date().toISOString(),
  },
  VIX: {
    ticker: "VIX",
    name: "CBOE Volatility Index",
    price: 14.85,
    change: -0.43,
    changePct: -2.81,
    high: 15.60,
    low: 14.65,
    volume: 0,
    prevClose: 15.28,
    lastUpdated: new Date().toISOString(),
  },
};

export async function getQuote(ticker: string): Promise<QuoteData> {
  const sym = ticker.toUpperCase().trim();
  if (QUOTE_CACHE[sym]) {
    // Return stable, consistent quote without random jitter
    return {
      ...QUOTE_CACHE[sym],
      lastUpdated: new Date().toISOString(),
    };
  }

  // Fallback for custom user symbols (stable)
  return {
    ticker: sym,
    name: `${sym} Inc.`,
    price: 100.0,
    change: 0.0,
    changePct: 0.0,
    high: 100.0,
    low: 100.0,
    volume: 1000000,
    prevClose: 100.0,
    lastUpdated: new Date().toISOString(),
  };
}

export async function getMultipleQuotes(tickers: string[]): Promise<Record<string, QuoteData>> {
  const results: Record<string, QuoteData> = {};
  for (const t of tickers) {
    results[t.toUpperCase().trim()] = await getQuote(t);
  }
  return results;
}
