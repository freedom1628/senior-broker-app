import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed-data";

export async function GET() {
  try {
    await ensureSeedData();

    const user = await prisma.user.findFirst({
      where: { email: "trader@broker.com" },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const trades = await prisma.trade.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const activeTrades = trades.filter(t => t.status === "ACTIVE" || t.status === "SCALED_T1");
    const pendingTrades = trades.filter(t => t.status === "PENDING_ENTRY");
    const closedTrades = trades.filter(t => t.status === "CLOSED");

    // Portfolio metrics
    const totalRealizedPnL = closedTrades.reduce((acc, t) => acc + (t.realizedPnL || 0), 0);
    const winTrades = closedTrades.filter(t => (t.realizedPnL || 0) > 0);
    const winRate = closedTrades.length > 0 ? (winTrades.length / closedTrades.length) * 100 : 0;
    const avgRMultiple = closedTrades.length > 0
      ? closedTrades.reduce((acc, t) => acc + (t.rMultiple || 0), 0) / closedTrades.length
      : 0;

    return NextResponse.json({
      trades,
      activeTrades,
      pendingTrades,
      closedTrades,
      metrics: {
        totalRealizedPnL: Number(totalRealizedPnL.toFixed(2)),
        winRate: Number(winRate.toFixed(1)),
        totalTrades: closedTrades.length,
        avgRMultiple: Number(avgRMultiple.toFixed(2)),
        openPositionCount: activeTrades.length,
      },
    });
  } catch (error) {
    console.error("Error fetching trades:", error);
    return NextResponse.json({ error: "Failed to fetch trades" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const user = await prisma.user.findFirst({
      where: { email: "trader@broker.com" },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const {
      candidateId,
      ticker,
      companyName,
      status = "PENDING_ENTRY",
      setupType,
      entryTrigger,
      actualEntry,
      sharesTotal,
      initialStop,
      currentStop,
      target1,
      target2,
      rrRatio,
      timeStopSessions = 6,
      notes,
    } = body;

    const trade = await prisma.trade.create({
      data: {
        userId: user.id,
        ticker: ticker.toUpperCase(),
        companyName: companyName || `${ticker} Corp`,
        status,
        setupType: setupType || "Catalyst Continuation",
        entryTrigger,
        actualEntry: status === "ACTIVE" ? (actualEntry || entryTrigger) : null,
        entryDate: status === "ACTIVE" ? new Date() : null,
        sharesTotal,
        sharesRemaining: sharesTotal,
        initialStop,
        currentStop: currentStop || initialStop,
        target1,
        target2,
        rrRatio: rrRatio || 2.0,
        timeStopSessions,
        sessionsElapsed: 0,
        notes,
      },
    });

    if (candidateId) {
      await prisma.candidateSetup.update({
        where: { id: candidateId },
        data: { status: "PROMOTED" },
      });
    }

    // Add alert notification
    await prisma.alertNotification.create({
      data: {
        userId: user.id,
        ticker: trade.ticker,
        type: status === "ACTIVE" ? "ENTRY_TRIGGERED" : "ENTRY_TRIGGERED",
        title: status === "ACTIVE" ? `Position Opened: ${trade.ticker}` : `Watching Order: ${trade.ticker}`,
        message: status === "ACTIVE"
          ? `Entered ${trade.sharesTotal} shares at $${(actualEntry || entryTrigger).toFixed(2)}. Hard stop active at $${initialStop.toFixed(2)}.`
          : `Watch trigger active at $${entryTrigger.toFixed(2)}. Alert will trigger when touched.`,
      },
    });

    return NextResponse.json({ success: true, trade });
  } catch (error) {
    console.error("Error creating trade:", error);
    return NextResponse.json({ error: "Failed to create trade" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const {
      tradeId,
      action, // "ACTIVATE" | "SCALE_T1" | "UPDATE_STOP" | "CLOSE_TRADE" | "INCREMENT_SESSION"
      fillPrice,
      newStop,
      closePrice,
      exitReason,
      notes,
    } = body;

    const existing = await prisma.trade.findUnique({
      where: { id: tradeId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    let updatedData: any = {};

    if (action === "ACTIVATE") {
      updatedData = {
        status: "ACTIVE",
        actualEntry: fillPrice || existing.entryTrigger,
        entryDate: new Date(),
      };
    } else if (action === "SCALE_T1") {
      // Sell 50% shares, adjust stop to Breakeven
      const scaleShares = Math.ceil(existing.sharesTotal / 2);
      const remaining = Math.max(1, existing.sharesTotal - scaleShares);
      const effectiveEntry = existing.actualEntry || existing.entryTrigger;
      const profitPerShare = (fillPrice || existing.target1) - effectiveEntry;
      const scaledPnL = Number((profitPerShare * scaleShares).toFixed(2));

      updatedData = {
        status: "SCALED_T1",
        sharesRemaining: remaining,
        currentStop: effectiveEntry, // Move stop strictly to Breakeven
        realizedPnL: (existing.realizedPnL || 0) + scaledPnL,
        notes: (existing.notes ? existing.notes + " | " : "") + `Scaled ${scaleShares} shares at $${(fillPrice || existing.target1).toFixed(2)}. Stop moved to breakeven ($${effectiveEntry.toFixed(2)}).`,
      };
    } else if (action === "UPDATE_STOP") {
      updatedData = {
        currentStop: newStop,
        notes: (existing.notes ? existing.notes + " | " : "") + `Stop adjusted to $${newStop.toFixed(2)}.`,
      };
    } else if (action === "INCREMENT_SESSION") {
      updatedData = {
        sessionsElapsed: existing.sessionsElapsed + 1,
      };
    } else if (action === "CLOSE_TRADE") {
      const effectiveClose = closePrice || existing.currentStop;
      const effectiveEntry = existing.actualEntry || existing.entryTrigger;
      const riskPerShare = Math.max(0.01, Math.abs(effectiveEntry - existing.initialStop));
      const remainingShares = existing.sharesRemaining;
      const finalLegPnL = (effectiveClose - effectiveEntry) * remainingShares;
      const totalPnL = Number(((existing.realizedPnL || 0) + finalLegPnL).toFixed(2));
      const totalRisk = riskPerShare * existing.sharesTotal;
      const rMultiple = Number((totalPnL / totalRisk).toFixed(2));

      updatedData = {
        status: "CLOSED",
        sharesRemaining: 0,
        closedPrice: effectiveClose,
        closedDate: new Date(),
        realizedPnL: totalPnL,
        rMultiple,
        exitReason: exitReason || "MANUAL",
        notes: (existing.notes ? existing.notes + " | " : "") + (notes || `Closed at $${effectiveClose.toFixed(2)} (${exitReason || "Manual"}).`),
      };
    }

    const updated = await prisma.trade.update({
      where: { id: tradeId },
      data: updatedData,
    });

    return NextResponse.json({ success: true, trade: updated });
  } catch (error) {
    console.error("Error updating trade:", error);
    return NextResponse.json({ error: "Failed to update trade" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    await prisma.trade.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting trade:", error);
    return NextResponse.json({ error: "Failed to delete trade" }, { status: 500 });
  }
}
