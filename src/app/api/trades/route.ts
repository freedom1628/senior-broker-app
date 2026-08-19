import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed-data";

export async function GET() {
  try {
    await ensureSeedData();

    let user = await prisma.user.findFirst();
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

    const trades = await prisma.trade.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const activeTrades = trades.filter((t: any) => t.status === "ACTIVE" || t.status === "SCALED_T1");
    const pendingTrades = trades.filter((t: any) => t.status === "PENDING_ENTRY");
    const closedTrades = trades.filter((t: any) => t.status === "CLOSED");

    // Portfolio metrics
    const totalRealizedPnL = closedTrades.reduce((acc: number, t: any) => acc + (t.realizedPnL || 0), 0);
    const winTrades = closedTrades.filter((t: any) => (t.realizedPnL || 0) > 0);
    const winRate = closedTrades.length > 0 ? (winTrades.length / closedTrades.length) * 100 : 0;
    const avgRMultiple = closedTrades.length > 0
      ? closedTrades.reduce((acc: number, t: any) => acc + (t.rMultiple || 0), 0) / closedTrades.length
      : 0;

    // Gross profit and loss for Profit Factor
    const grossProfit = closedTrades
      .filter((t: any) => (t.realizedPnL || 0) > 0)
      .reduce((acc: number, t: any) => acc + (t.realizedPnL || 0), 0);
    const grossLoss = closedTrades
      .filter((t: any) => (t.realizedPnL || 0) < 0)
      .reduce((acc: number, t: any) => acc + Math.abs(t.realizedPnL || 0), 0);
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999.0 : 0.0;

    // Open risk calculations
    let openRiskDollars = 0;
    activeTrades.forEach((t: any) => {
      const effectiveEntry = t.actualEntry || t.entryTrigger;
      if (t.currentStop < effectiveEntry) {
        const remaining = t.sharesRemaining > 0 ? t.sharesRemaining : t.sharesTotal;
        openRiskDollars += (effectiveEntry - t.currentStop) * remaining;
      }
    });

    const accountSize = user.accountSize || 15000.0;
    const openRiskPct = (openRiskDollars / accountSize) * 100;

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
      sharesTotal,
      initialStop,
      currentStop,
      target1,
      target2,
      rrRatio,
      timeStopSessions = 6,
      notes,
    } = body;

    const parsedEntry = parseFloat(entryTrigger);
    const parsedStop = parseFloat(initialStop);

    if (isNaN(parsedEntry) || isNaN(parsedStop) || parsedEntry <= 0 || parsedStop <= 0) {
      return NextResponse.json(
        { error: "Invalid entry or stop loss price. Both must be positive numbers." },
        { status: 400 }
      );
    }

    if (parsedStop >= parsedEntry) {
      return NextResponse.json(
        { error: "Discipline Rule Violation: Hard Stop Loss must be strictly below Entry Price for long swing trades." },
        { status: 400 }
      );
    }

    const riskPerShare = Math.max(0.01, Math.abs(parsedEntry - parsedStop));
    const parsedT1 = parseFloat(target1) || Number((parsedEntry + 2.0 * riskPerShare).toFixed(2));
    const parsedT2 = parseFloat(target2) || Number((parsedEntry + 3.5 * riskPerShare).toFixed(2));
    const parsedShares = Math.max(1, Math.floor(parseFloat(sharesTotal) || 1));
    const parsedRR = parseFloat(rrRatio?.toString() || ((parsedT1 - parsedEntry) / riskPerShare).toFixed(2));

    const trade = await prisma.trade.create({
      data: {
        userId: user.id,
        ticker: ticker.toUpperCase().trim(),
        companyName: companyName ? companyName.trim() : `${ticker.toUpperCase().trim()} Inc.`,
        sector: sector ? sector.trim() : "Technology",
        status: status || "ACTIVE",
        setupType: setupType || "Catalyst Continuation",
        entryTrigger: parsedEntry,
        entryCondition: "Manual Entry Logged",
        actualEntry: status === "ACTIVE" ? (actualEntry ? parseFloat(actualEntry) : parsedEntry) : null,
        entryDate: status === "ACTIVE" ? new Date() : null,
        sharesTotal: parsedShares,
        sharesRemaining: parsedShares,
        initialStop: parsedStop,
        currentStop: currentStop ? parseFloat(currentStop) : parsedStop,
        target1: parsedT1,
        target2: parsedT2,
        rrRatio: parsedRR,
        timeStopSessions: parseInt(timeStopSessions?.toString() || "6", 10) || 6,
        sessionsElapsed: 0,
        notes: notes || "Manual trade entry",
      },
    });

    if (candidateId) {
      try {
        await prisma.candidateSetup.update({
          where: { id: candidateId },
          data: { status: "PROMOTED" },
        });
      } catch (e) {
        // non-fatal if candidate not in db
      }
    }

    // Add alert notification
    try {
      await prisma.alertNotification.create({
        data: {
          userId: user.id,
          ticker: trade.ticker,
          type: "ENTRY_TRIGGERED",
          title: status === "ACTIVE" ? `Position Opened: ${trade.ticker}` : `Watching Order: ${trade.ticker}`,
          message: status === "ACTIVE"
            ? `Entered ${trade.sharesTotal} shares at $${(trade.actualEntry || trade.entryTrigger).toFixed(2)}. Hard stop active at $${trade.initialStop.toFixed(2)}.`
            : `Watch trigger active at $${trade.entryTrigger.toFixed(2)}. Alert will trigger when touched.`,
        },
      });
    } catch (e) {
      // non-fatal
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
      action, // "ACTIVATE" | "SCALE_T1" | "UPDATE_STOP" | "CLOSE_TRADE" | "EXIT_STALE" | "INCREMENT_SESSION" | "CANCEL_ORDER"
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
        sharesRemaining: existing.sharesTotal,
        sessionsElapsed: 0,
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
        realizedPnL: Number(((existing.realizedPnL || 0) + scaledPnL).toFixed(2)),
        notes: (existing.notes ? existing.notes + " | " : "") + `Scaled ${scaleShares} shares at $${(fillPrice || existing.target1).toFixed(2)}. Stop moved to breakeven ($${effectiveEntry.toFixed(2)}).`,
      };
    } else if (action === "UPDATE_STOP") {
      const parsedNewStop = parseFloat(newStop);
      if (isNaN(parsedNewStop)) {
        return NextResponse.json({ error: "Invalid stop price" }, { status: 400 });
      }

      // Invariant: Stop can only be tightened upward, never widened downward
      if (parsedNewStop < existing.currentStop) {
        return NextResponse.json(
          {
            error: `Discipline Rule Violation: Cannot widen stop downward from $${existing.currentStop.toFixed(2)} to $${parsedNewStop.toFixed(2)}`,
          },
          { status: 400 }
        );
      }

      updatedData = {
        currentStop: parsedNewStop,
        notes: (existing.notes ? existing.notes + " | " : "") + `Stop adjusted to $${parsedNewStop.toFixed(2)}.`,
      };
    } else if (action === "INCREMENT_SESSION") {
      updatedData = {
        sessionsElapsed: existing.sessionsElapsed + 1,
      };
    } else if (action === "CLOSE_TRADE" || action === "EXIT_STALE") {
      const effectiveClose = closePrice || existing.currentStop;
      const effectiveEntry = existing.actualEntry || existing.entryTrigger;
      const riskPerShare = Math.max(0.01, Math.abs(effectiveEntry - existing.initialStop));
      const remainingShares = existing.sharesRemaining;
      const finalLegPnL = (effectiveClose - effectiveEntry) * remainingShares;
      const totalPnL = Number(((existing.realizedPnL || 0) + finalLegPnL).toFixed(2));
      const totalRisk = riskPerShare * existing.sharesTotal;
      const rMultiple = Number((totalPnL / totalRisk).toFixed(2));

      const reason = exitReason || (action === "EXIT_STALE" ? "TIME_STOP_EXIT" : "MANUAL");

      updatedData = {
        status: "CLOSED",
        sharesRemaining: 0,
        closedPrice: effectiveClose,
        closedDate: new Date(),
        realizedPnL: totalPnL,
        rMultiple,
        exitReason: reason,
        notes: (existing.notes ? existing.notes + " | " : "") + (notes || `Closed at $${effectiveClose.toFixed(2)} (${reason}).`),
      };
    } else if (action === "CANCEL_ORDER") {
      updatedData = {
        status: "CANCELLED",
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
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    await prisma.trade.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting trade:", error);
    return NextResponse.json({ error: "Failed to delete trade" }, { status: 500 });
  }
}
