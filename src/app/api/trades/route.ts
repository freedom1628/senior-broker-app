import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed-data";

export async function GET(req: Request) {
  try {
    let user = await prisma.user.findFirst();
    if (!user) {
      await ensureSeedData();
      user = await prisma.user.findFirst();
    }

    if (!user) {
      return NextResponse.json({ trades: [], metrics: null });
    }

    const trades = await prisma.trade.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const activeTrades = trades.filter((t: any) => t.status === "ACTIVE" || t.status === "SCALED_T1");
    const pendingTrades = trades.filter((t: any) => t.status === "PENDING_ENTRY");
    const closedTrades = trades.filter((t: any) => t.status === "CLOSED");

    // Metrics Calculation
    const totalRealizedPnL = closedTrades.reduce((sum: number, t: any) => sum + (t.realizedPnL || 0), 0);
    const winTrades = closedTrades.filter((t: any) => (t.realizedPnL || 0) > 0);
    const lossTrades = closedTrades.filter((t: any) => (t.realizedPnL || 0) < 0);
    const winRate = closedTrades.length > 0 ? (winTrades.length / closedTrades.length) * 100 : 0;
    const avgRMultiple =
      closedTrades.length > 0
        ? closedTrades.reduce((sum: number, t: any) => sum + (t.rMultiple || 0), 0) / closedTrades.length
        : 0;

    const totalGains = winTrades.reduce((sum: number, t: any) => sum + (t.realizedPnL || 0), 0);
    const totalLosses = Math.abs(lossTrades.reduce((sum: number, t: any) => sum + (t.realizedPnL || 0), 0));
    const profitFactor = totalLosses > 0 ? totalGains / totalLosses : totalGains > 0 ? 99.0 : 0.0;

    // Open Risk Calculation
    const openRiskDollars = activeTrades.reduce((sum: number, t: any) => {
      const entry = t.actualEntry || t.entryTrigger;
      const stop = t.currentStop;
      const riskPerShare = Math.max(0.01, Math.abs(entry - stop));
      return sum + riskPerShare * (t.sharesRemaining || t.sharesTotal);
    }, 0);

    const openRiskPct = user.accountSize > 0 ? (openRiskDollars / user.accountSize) * 100 : 0;

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
        profitFactor: Number(profitFactor.toFixed(2)),
        disciplineScore: 100.0,
        openPositionCount: activeTrades.length,
        openRiskDollars: Number(openRiskDollars.toFixed(2)),
        openRiskPct: Number(openRiskPct.toFixed(2)),
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

    let user = await prisma.user.findFirst();
    if (!user) {
      await ensureSeedData();
      user = await prisma.user.findFirst();
    }
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: "trader@broker.com",
          name: "Senior Trader",
          accountSize: 15000.0,
          riskPerTrade: 1.0,
        },
      });
    }

    const {
      candidateId,
      ticker,
      companyName,
      sector = "Technology",
      status = "ACTIVE",
      setupType = "Catalyst Continuation",
      entryTrigger,
      actualEntry,
      entryDate,
      closedDate,
      closedPrice,
      exitReason,
      realizedPnL,
      rMultiple,
      sharesTotal,
      sharesRemaining,
      initialStop,
      currentStop,
      target1,
      target2,
      rrRatio,
      timeStopSessions = 6,
      notes,
    } = body;

    const parsedEntry = parseFloat(entryTrigger || actualEntry);
    const parsedStop = parseFloat(initialStop || currentStop);

    if (isNaN(parsedEntry) || isNaN(parsedStop) || parsedEntry <= 0 || parsedStop <= 0) {
      return NextResponse.json(
        { error: "Invalid entry or stop loss price. Both must be positive numbers." },
        { status: 400 }
      );
    }

    const riskPerShare = Math.max(0.01, Math.abs(parsedEntry - parsedStop));
    const parsedT1 = parseFloat(target1) || Number((parsedEntry + 2.0 * riskPerShare).toFixed(2));
    const parsedT2 = parseFloat(target2) || Number((parsedEntry + 3.5 * riskPerShare).toFixed(2));
    const parsedShares = Math.max(0.001, parseFloat(sharesTotal) || 1);
    const parsedRR = parseFloat(rrRatio?.toString() || ((parsedT1 - parsedEntry) / riskPerShare).toFixed(2));

    const isClosed = status === "CLOSED";

    const trade = await prisma.trade.create({
      data: {
        userId: user.id,
        ticker: ticker.toUpperCase().trim(),
        companyName: companyName ? companyName.trim() : `${ticker.toUpperCase().trim()} Inc.`,
        sector: sector ? sector.trim() : "Technology",
        status: status || "ACTIVE",
        setupType: setupType || "Catalyst Continuation",
        entryTrigger: parsedEntry,
        entryCondition: isClosed ? "Historical Trade Logged" : "Manual Entry Logged",
        actualEntry: parsedEntry,
        entryDate: entryDate ? new Date(entryDate) : (status === "ACTIVE" || isClosed ? new Date() : null),
        closedDate: isClosed ? (closedDate ? new Date(closedDate) : new Date()) : null,
        closedPrice: isClosed ? (closedPrice ? parseFloat(closedPrice) : null) : null,
        exitReason: isClosed ? (exitReason || "STOP_LOSS_EXECUTED") : null,
        realizedPnL: isClosed ? (realizedPnL !== undefined ? parseFloat(realizedPnL) : 0) : null,
        rMultiple: isClosed ? (rMultiple !== undefined ? parseFloat(rMultiple) : 0) : null,
        sharesTotal: parsedShares,
        sharesRemaining: isClosed ? 0 : (sharesRemaining !== undefined ? parseFloat(sharesRemaining) : parsedShares),
        initialStop: parsedStop,
        currentStop: currentStop ? parseFloat(currentStop) : parsedStop,
        target1: parsedT1,
        target2: parsedT2,
        rrRatio: parsedRR,
        timeStopSessions: parseInt(timeStopSessions?.toString() || "6", 10) || 6,
        sessionsElapsed: 0,
        notes: notes || (isClosed ? "Historical campaign logged" : "Manual trade entry"),
      },
    });

    if (candidateId) {
      try {
        await prisma.candidateSetup.update({
          where: { id: candidateId },
          data: { status: "PROMOTED" },
        });
      } catch (e) {}
    }

    return NextResponse.json({ success: true, trade });
  } catch (error: any) {
    console.error("Error creating trade:", error);
    return NextResponse.json({ error: error?.message || "Failed to create trade" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const {
      tradeId,
      action,
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

    if (action === "UPDATE_DETAILS") {
      updatedData = {
        actualEntry: body.actualEntry !== undefined ? parseFloat(body.actualEntry) : existing.actualEntry,
        closedPrice: body.closedPrice !== undefined ? parseFloat(body.closedPrice) : existing.closedPrice,
        initialStop: body.initialStop !== undefined ? parseFloat(body.initialStop) : existing.initialStop,
        currentStop: body.currentStop !== undefined ? parseFloat(body.currentStop) : existing.currentStop,
        sharesTotal: body.sharesTotal !== undefined ? parseFloat(body.sharesTotal) : existing.sharesTotal,
        entryDate: body.entryDate ? new Date(body.entryDate) : existing.entryDate,
        closedDate: body.closedDate ? new Date(body.closedDate) : existing.closedDate,
        exitReason: body.exitReason || existing.exitReason,
        realizedPnL: body.realizedPnL !== undefined ? parseFloat(body.realizedPnL) : existing.realizedPnL,
        rMultiple: body.rMultiple !== undefined ? parseFloat(body.rMultiple) : existing.rMultiple,
        notes: body.notes !== undefined ? body.notes : existing.notes,
      };
    } else if (action === "ACTIVATE") {
      updatedData = {
        status: "ACTIVE",
        actualEntry: fillPrice || existing.entryTrigger,
        entryDate: new Date(),
        sharesRemaining: existing.sharesTotal,
        sessionsElapsed: 0,
      };
    } else if (action === "SCALE_T1") {
      const scaleShares = Math.ceil(existing.sharesTotal / 2);
      const remaining = Math.max(1, existing.sharesTotal - scaleShares);
      const effectiveEntry = existing.actualEntry || existing.entryTrigger;
      const profitPerShare = (fillPrice || existing.target1) - effectiveEntry;
      const scaledPnL = Number((profitPerShare * scaleShares).toFixed(2));

      updatedData = {
        status: "SCALED_T1",
        sharesRemaining: remaining,
        currentStop: effectiveEntry,
        realizedPnL: Number(((existing.realizedPnL || 0) + scaledPnL).toFixed(2)),
        notes: (existing.notes ? existing.notes + " | " : "") + `Scaled ${scaleShares} shares at $${(fillPrice || existing.target1).toFixed(2)}. Stop moved to breakeven ($${effectiveEntry.toFixed(2)}).`,
      };
    } else if (action === "UPDATE_STOP") {
      const parsedNewStop = parseFloat(newStop);
      if (isNaN(parsedNewStop)) {
        return NextResponse.json({ error: "Invalid stop price" }, { status: 400 });
      }

      updatedData = {
        currentStop: parsedNewStop,
        notes: (existing.notes ? existing.notes + " | " : "") + `Stop raised to $${parsedNewStop.toFixed(2)}.`,
      };
    } else if (action === "CLOSE_TRADE" || action === "EXIT_STALE") {
      const exitP = closePrice || existing.currentStop;
      const effectiveEntry = existing.actualEntry || existing.entryTrigger;
      const totalGain = (exitP - effectiveEntry) * existing.sharesTotal;
      const riskPerShare = Math.max(0.01, Math.abs(effectiveEntry - existing.initialStop));
      const totalRisk = riskPerShare * existing.sharesTotal;
      const rMult = totalRisk > 0 ? totalGain / totalRisk : 0;

      updatedData = {
        status: "CLOSED",
        closedDate: new Date(),
        closedPrice: exitP,
        exitReason: exitReason || (action === "EXIT_STALE" ? "TIME_STOP_EXIT" : "MANUAL_EXIT"),
        realizedPnL: Number(totalGain.toFixed(2)),
        rMultiple: Number(rMult.toFixed(2)),
        sharesRemaining: 0,
        notes: (existing.notes ? existing.notes + " | " : "") + `Closed position at $${exitP.toFixed(2)}. Return: ${totalGain >= 0 ? "+" : ""}$${totalGain.toFixed(2)} (${rMult.toFixed(2)}R).`,
      };
    } else if (action === "INCREMENT_SESSION") {
      updatedData = {
        sessionsElapsed: (existing.sessionsElapsed || 0) + 1,
      };
    } else if (action === "CANCEL_ORDER") {
      updatedData = {
        status: "CANCELLED",
        closedDate: new Date(),
        notes: (existing.notes ? existing.notes + " | " : "") + "Order cancelled.",
      };
    }

    const updated = await prisma.trade.update({
      where: { id: tradeId },
      data: updatedData,
    });

    return NextResponse.json({ success: true, trade: updated });
  } catch (error: any) {
    console.error("Error updating trade:", error);
    return NextResponse.json({ error: error?.message || "Failed to update trade" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clearAll = searchParams.get("clearAll");
    const id = searchParams.get("id");

    if (clearAll === "true") {
      const user = await prisma.user.findFirst();
      if (user) {
        const trades = await prisma.trade.findMany({ where: { userId: user.id } });
        for (const t of trades) {
          await prisma.trade.delete({ where: { id: t.id } });
        }
      }
      return NextResponse.json({ success: true, cleared: true });
    }

    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    await prisma.trade.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting trade:", error);
    return NextResponse.json({ error: error?.message || "Failed to delete trade" }, { status: 500 });
  }
}
