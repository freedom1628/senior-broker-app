import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed-data";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { clientTrades = [], userEmail } = body;

    let user = await prisma.user.findFirst({
      where: userEmail ? { email: userEmail } : undefined,
    });

    if (!user) {
      await ensureSeedData();
      user = await prisma.user.findFirst({
        where: userEmail ? { email: userEmail } : undefined,
      });
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userEmail || "trader@broker.com",
          name: "Senior Trader",
          accountSize: 15000.0,
          riskPerTrade: 1.0,
        },
      });
    }

    // Get current server trades for user
    const serverTrades = await prisma.trade.findMany({
      where: { userId: user.id },
    });

    const serverTradeMap = new Map<string, any>();
    serverTrades.forEach((t: any) => serverTradeMap.set(t.id, t));

    // Re-hydrate any client trades that are missing on the server (e.g. after worker update or cold start)
    for (const ct of clientTrades) {
      if (ct && ct.id && !serverTradeMap.has(ct.id)) {
        try {
          const created = await prisma.trade.create({
            data: {
              id: ct.id,
              userId: user.id,
              ticker: (ct.ticker || "UNKNOWN").toUpperCase().trim(),
              companyName: ct.companyName || `${ct.ticker} Corporation`,
              sector: ct.sector || "Technology",
              status: ct.status || "ACTIVE",
              setupType: ct.setupType || "Catalyst Continuation",
              entryTrigger: ct.entryTrigger || ct.actualEntry || 100,
              entryCondition: ct.entryCondition || "Profile Synced",
              actualEntry: ct.actualEntry || ct.entryTrigger || 100,
              entryDate: ct.entryDate ? new Date(ct.entryDate) : new Date(),
              closedDate: ct.closedDate ? new Date(ct.closedDate) : null,
              closedPrice: ct.closedPrice !== undefined ? parseFloat(ct.closedPrice) : null,
              exitReason: ct.exitReason || null,
              realizedPnL: ct.realizedPnL !== undefined ? parseFloat(ct.realizedPnL) : null,
              rMultiple: ct.rMultiple !== undefined ? parseFloat(ct.rMultiple) : null,
              sharesTotal: ct.sharesTotal || 1,
              sharesRemaining: ct.sharesRemaining !== undefined ? ct.sharesRemaining : (ct.status === "CLOSED" ? 0 : ct.sharesTotal || 1),
              initialStop: ct.initialStop || 95,
              currentStop: ct.currentStop || ct.initialStop || 95,
              target1: ct.target1 || 110,
              target2: ct.target2 || 120,
              rrRatio: ct.rrRatio || 2.0,
              timeStopSessions: ct.timeStopSessions || 6,
              sessionsElapsed: ct.sessionsElapsed || 0,
              notes: ct.notes || "",
            },
          });
          serverTradeMap.set(created.id, created);
        } catch (err) {
          console.error("Error hydrating trade into server store:", err);
        }
      }
    }

    const allMergedTrades = Array.from(serverTradeMap.values());

    return NextResponse.json({
      success: true,
      syncedCount: allMergedTrades.length,
      trades: allMergedTrades,
    });
  } catch (error: any) {
    console.error("Error in trade sync:", error);
    return NextResponse.json({ error: error?.message || "Sync failed" }, { status: 500 });
  }
}
