import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMultipleQuotes } from "@/lib/market/quotes";
import { generateDailyPortfolioReport } from "@/lib/portfolio/daily-report";

export async function GET() {
  try {
    const user = await prisma.user.findFirst({
      where: { email: "trader@broker.com" },
      include: {
        researchRuns: {
          orderBy: { date: "desc" },
          take: 1,
        },
      },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const trades = await prisma.trade.findMany({
      where: { userId: user.id },
    });

    const tickers: string[] = Array.from(new Set(trades.map((t: any) => t.ticker.toUpperCase() as string)));
    const quotes = await getMultipleQuotes(["SPY", "QQQ", "VIX", ...tickers]);

    const latestRegime = user.researchRuns[0]?.marketRegime || "FAVORABLE";

    const dailyReport = generateDailyPortfolioReport(
      trades,
      quotes,
      user.accountSize,
      latestRegime
    );

    return NextResponse.json({ success: true, report: dailyReport });
  } catch (error) {
    console.error("Error generating daily portfolio report:", error);
    return NextResponse.json({ error: "Failed to generate daily report" }, { status: 500 });
  }
}
