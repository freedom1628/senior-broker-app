import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed-data";

export async function GET() {
  try {
    await ensureSeedData();

    let user = await prisma.user.findFirst();
    const accountSize = user?.accountSize || 15000.0;

    const closedTrades = await prisma.trade.findMany({
      where: {
        userId: user?.id,
        status: "CLOSED",
      },
      orderBy: { closedDate: "asc" },
    });

    let cumulativePnL = 0;
    let currentEquity = accountSize;
    let peakEquity = accountSize;
    let maxDrawdownDollars = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let winCount = 0;
    let totalR = 0;

    const equityDataPoints = [
      {
        tradeIndex: 0,
        date: "Deposit",
        cumulativePnL: 0,
        totalEquity: accountSize,
        highWaterMark: accountSize,
        drawdownDollars: 0,
      },
    ];

    closedTrades.forEach((t: any, idx: number) => {
      const pnl = t.realizedPnL || 0;
      const r = t.rMultiple || 0;
      cumulativePnL += pnl;
      currentEquity += pnl;
      totalR += r;

      if (pnl > 0.01) {
        winCount++;
        grossProfit += pnl;
      } else if (pnl < -0.01) {
        grossLoss += Math.abs(pnl);
      }

      if (currentEquity > peakEquity) {
        peakEquity = currentEquity;
      }

      const currentDrawdown = peakEquity - currentEquity;
      if (currentDrawdown > maxDrawdownDollars) {
        maxDrawdownDollars = currentDrawdown;
      }

      equityDataPoints.push({
        tradeIndex: idx + 1,
        date: t.closedDate ? new Date(t.closedDate).toISOString().split("T")[0] : `Trade ${idx + 1}`,
        cumulativePnL: Number(cumulativePnL.toFixed(2)),
        totalEquity: Number(currentEquity.toFixed(2)),
        highWaterMark: Number(peakEquity.toFixed(2)),
        drawdownDollars: Number(currentDrawdown.toFixed(2)),
      });
    });

    const winRate = closedTrades.length > 0 ? (winCount / closedTrades.length) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999.0 : 0.0;
    const avgRMultiple = closedTrades.length > 0 ? totalR / closedTrades.length : 0;
    const maxDrawdownPct = peakEquity > 0 ? (maxDrawdownDollars / peakEquity) * 100 : 0;

    return NextResponse.json({
      closedTrades,
      analytics: {
        totalTrades: closedTrades.length,
        totalRealizedPnL: Number(cumulativePnL.toFixed(2)),
        winRatePct: Number(winRate.toFixed(1)),
        profitFactor: Number(profitFactor.toFixed(2)),
        avgRMultiple: Number(avgRMultiple.toFixed(2)),
        disciplineScorePct: 100.0,
      },
      equitySeries: {
        dataPoints: equityDataPoints,
        peakEquity: Number(peakEquity.toFixed(2)),
        maxDrawdownDollars: Number(maxDrawdownDollars.toFixed(2)),
        maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
        finalEquity: Number(currentEquity.toFixed(2)),
      },
    });
  } catch (error) {
    console.error("Error generating journal analytics:", error);
    return NextResponse.json({ error: "Failed to generate journal analytics" }, { status: 500 });
  }
}
