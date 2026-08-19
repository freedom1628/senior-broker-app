import { NextResponse } from "next/server";
import { getMultipleQuotes, getQuote } from "@/lib/market/quotes";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tickersParam = searchParams.get("tickers");

    if (!tickersParam) {
      // Default core index & watch basket
      const defaultQuotes = await getMultipleQuotes(["SPY", "QQQ", "VIX", "ATRO", "MTRN", "LITE", "GLBE", "NIQ", "CRWV", "HALO", "TWLO"]);
      return NextResponse.json({ quotes: defaultQuotes });
    }

    const tickers = tickersParam.split(",").map(t => t.trim().toUpperCase());
    const quotes = await getMultipleQuotes(tickers);

    return NextResponse.json({ quotes });
  } catch (error) {
    console.error("Error in quotes API:", error);
    return NextResponse.json({ error: "Failed to fetch quotes" }, { status: 500 });
  }
}
