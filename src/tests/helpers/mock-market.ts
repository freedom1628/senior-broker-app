// Mock Market Data Generator, Price Tick Stream, and Session Progression Emulator
// Provides deterministic and dynamic price simulations for swing trading strategy testing

import { QuoteData } from "../../lib/market/quotes";

export interface MarketTick {
  ticker: string;
  price: number;
  high: number;
  low: number;
  volume: number;
  timestamp: string;
  sessionIndex: number;
}

export type TickListener = (tick: MarketTick) => void;

export class MockMarketEngine {
  private quotes: Map<string, QuoteData> = new Map();
  private sessionIndex: number = 1;
  private currentDate: Date = new Date("2026-08-19T09:30:00Z");
  private tickListeners: Set<TickListener> = new Set();

  constructor() {
    this.seedDefaultQuotes();
  }

  public seedDefaultQuotes(): void {
    const defaultData: Record<string, Partial<QuoteData>> = {
      ATRO: { name: "Astronics Corporation", price: 88.95, prevClose: 87.37, high: 92.49, low: 85.0, volume: 1240000 },
      MTRN: { name: "Materion Corporation", price: 284.1, prevClose: 286.85, high: 289.4, low: 281.8, volume: 450000 },
      LITE: { name: "Lumentum Holdings Inc.", price: 948.5, prevClose: 940.0, high: 955.0, low: 932.0, volume: 8200000 },
      GLBE: { name: "Global-e Online Ltd.", price: 43.1, prevClose: 42.6, high: 43.99, low: 42.1, volume: 3800000 },
      NIQ: { name: "NIQ Global Intelligence", price: 16.45, prevClose: 16.25, high: 16.9, low: 16.1, volume: 15400000 },
      CRWV: { name: "CoreWeave Inc.", price: 91.8, prevClose: 92.0, high: 94.5, low: 88.0, volume: 4200000 },
      HALO: { name: "Halozyme Therapeutics", price: 97.4, prevClose: 97.0, high: 104.0, low: 95.8, volume: 1600000 },
      TWLO: { name: "Twilio Inc.", price: 243.5, prevClose: 241.0, high: 254.0, low: 238.0, volume: 3100000 },
      SPY: { name: "SPDR S&P 500 ETF Trust", price: 774.2, prevClose: 772.66, high: 775.4, low: 771.8, volume: 48000000 },
      QQQ: { name: "Invesco QQQ Trust", price: 726.8, prevClose: 724.52, high: 728.5, low: 723.1, volume: 34000000 },
      VIX: { name: "CBOE Volatility Index", price: 14.85, prevClose: 15.28, high: 15.6, low: 14.65, volume: 0 },
    };

    for (const [sym, data] of Object.entries(defaultData)) {
      const price = data.price || 100.0;
      const prevClose = data.prevClose || price;
      const change = Number((price - prevClose).toFixed(2));
      const changePct = Number(((change / prevClose) * 100).toFixed(2));

      this.quotes.set(sym, {
        ticker: sym,
        name: data.name || `${sym} Corp`,
        price,
        change,
        changePct,
        high: data.high || price * 1.02,
        low: data.low || price * 0.98,
        volume: data.volume || 1000000,
        prevClose,
        lastUpdated: this.currentDate.toISOString(),
      });
    }
  }

  public getQuote(ticker: string): QuoteData {
    const sym = ticker.toUpperCase();
    if (this.quotes.has(sym)) {
      return { ...this.quotes.get(sym)! };
    }
    // Auto-generate realistic quote for unknown ticker
    const fallback: QuoteData = {
      ticker: sym,
      name: `${sym} Corporation`,
      price: 100.0,
      change: 0.0,
      changePct: 0.0,
      high: 102.0,
      low: 98.0,
      volume: 1000000,
      prevClose: 100.0,
      lastUpdated: this.currentDate.toISOString(),
    };
    this.quotes.set(sym, fallback);
    return { ...fallback };
  }

  public getAllQuotes(): Record<string, QuoteData> {
    const res: Record<string, QuoteData> = {};
    for (const [k, v] of this.quotes.entries()) {
      res[k] = { ...v };
    }
    return res;
  }

  public setPrice(ticker: string, newPrice: number): QuoteData {
    const sym = ticker.toUpperCase();
    const existing = this.getQuote(sym);
    const price = Number(newPrice.toFixed(2));
    const change = Number((price - existing.prevClose).toFixed(2));
    const changePct = Number(((change / existing.prevClose) * 100).toFixed(2));
    const high = Math.max(existing.high, price);
    const low = Math.min(existing.low, price);

    const updated: QuoteData = {
      ...existing,
      price,
      change,
      changePct,
      high,
      low,
      lastUpdated: this.currentDate.toISOString(),
    };

    this.quotes.set(sym, updated);
    this.emitTick(sym, updated);
    return { ...updated };
  }

  public simulateGapDown(ticker: string, gapPct: number): QuoteData {
    const quote = this.getQuote(ticker);
    const newPrice = quote.price * (1 - Math.abs(gapPct) / 100);
    return this.setPrice(ticker, newPrice);
  }

  public simulateBreakout(ticker: string, targetPrice: number, steps: number = 3): QuoteData[] {
    const startQuote = this.getQuote(ticker);
    const stepDiff = (targetPrice - startQuote.price) / steps;
    const history: QuoteData[] = [];

    for (let i = 1; i <= steps; i++) {
      const interimPrice = startQuote.price + stepDiff * i;
      const q = this.setPrice(ticker, interimPrice);
      history.push(q);
    }
    return history;
  }

  public advanceSession(days: number = 1): { sessionIndex: number; date: Date } {
    let daysAdded = 0;
    while (daysAdded < days) {
      this.currentDate.setDate(this.currentDate.getDate() + 1);
      const dayOfWeek = this.currentDate.getDay();
      // Skip Saturday (6) and Sunday (0) for market trading sessions
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysAdded++;
        this.sessionIndex++;
      }
    }

    // Reset daily high/low and set prevClose to current price for new session
    for (const [sym, quote] of this.quotes.entries()) {
      this.quotes.set(sym, {
        ...quote,
        prevClose: quote.price,
        change: 0,
        changePct: 0,
        high: quote.price,
        low: quote.price,
        lastUpdated: this.currentDate.toISOString(),
      });
    }

    return { sessionIndex: this.sessionIndex, date: new Date(this.currentDate) };
  }

  public getSessionInfo(): { sessionIndex: number; date: Date; dateIso: string } {
    return {
      sessionIndex: this.sessionIndex,
      date: new Date(this.currentDate),
      dateIso: this.currentDate.toISOString(),
    };
  }

  public subscribeTicks(listener: TickListener): () => void {
    this.tickListeners.add(listener);
    return () => {
      this.tickListeners.delete(listener);
    };
  }

  private emitTick(ticker: string, quote: QuoteData): void {
    const tick: MarketTick = {
      ticker,
      price: quote.price,
      high: quote.high,
      low: quote.low,
      volume: quote.volume,
      timestamp: quote.lastUpdated,
      sessionIndex: this.sessionIndex,
    };
    for (const listener of this.tickListeners) {
      try {
        listener(tick);
      } catch (err) {
        console.error("Error in tick listener:", err);
      }
    }
  }

  public reset(): void {
    this.quotes.clear();
    this.sessionIndex = 1;
    this.currentDate = new Date("2026-08-19T09:30:00Z");
    this.tickListeners.clear();
    this.seedDefaultQuotes();
  }
}

export const globalMockMarket = new MockMarketEngine();
