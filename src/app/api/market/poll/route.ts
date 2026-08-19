import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMultipleQuotes } from "@/lib/market/quotes";
import { evaluateTrade, TradeEvaluation } from "@/lib/market/rule-engine";

export async function POST() {
  try {
    const user = await prisma.user.findFirst({
      where: { email: "trader@broker.com" },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const openTrades = await prisma.trade.findMany({
      where: {
        userId: user.id,
        status: { in: ["PENDING_ENTRY", "ACTIVE", "SCALED_T1"] },
      },
    });

    if (openTrades.length === 0) {
      return NextResponse.json({ evaluatedCount: 0, alerts: [] });
    }

    const tickers: string[] = Array.from(new Set(openTrades.map((t: any) => t.ticker as string)));
    const quotes = await getMultipleQuotes(tickers);

    const alerts: TradeEvaluation[] = [];

    for (const trade of openTrades) {
      const quote = quotes[trade.ticker.toUpperCase()];
      if (quote) {
        const evaluation = evaluateTrade(trade, quote);
        if (evaluation.alertType) {
          alerts.push(evaluation);

          // Record alert in DB if not duplicate recently
          const existingRecent = await prisma.alertNotification.findFirst({
            where: {
              userId: user.id,
              ticker: trade.ticker,
              type: evaluation.alertType,
              createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }, // 30m debounce
            },
          });

          if (!existingRecent && evaluation.alertTitle && evaluation.alertMessage) {
            await prisma.alertNotification.create({
              data: {
                userId: user.id,
                ticker: trade.ticker,
                type: evaluation.alertType,
                title: evaluation.alertTitle,
                message: evaluation.alertMessage,
              },
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      evaluatedCount: openTrades.length,
      alerts,
    });
  } catch (error) {
    console.error("Error in market poll endpoint:", error);
    return NextResponse.json({ error: "Failed to poll market" }, { status: 500 });
  }
}
