import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed-data";

export async function GET() {
  try {
    await ensureSeedData();

    const user = await prisma.user.findFirst({
      where: { email: "trader@broker.com" },
      include: {
        researchRuns: {
          orderBy: { date: "desc" },
          take: 1,
          include: {
            candidates: {
              orderBy: { score: "desc" },
            },
          },
        },
      },
    });

    const latestRun = user?.researchRuns[0];

    return NextResponse.json({
      user: {
        id: user?.id,
        email: user?.email,
        name: user?.name,
        accountSize: user?.accountSize || 10000.0,
        riskPerTrade: user?.riskPerTrade || 1.0,
      },
      researchRun: latestRun,
      candidates: latestRun?.candidates || [],
    });
  } catch (error) {
    console.error("Failed to load current research:", error);
    return NextResponse.json({ error: "Failed to load research" }, { status: 500 });
  }
}
