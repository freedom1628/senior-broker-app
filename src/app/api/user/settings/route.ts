import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await prisma.user.findFirst({
      where: { email: "trader@broker.com" },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({
      accountSize: user.accountSize,
      riskPerTrade: user.riskPerTrade,
      hasGeminiKey: !!user.geminiKey,
      hasAnthropicKey: !!user.anthropicKey,
      hasOpenaiKey: !!user.openaiKey,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { accountSize, riskPerTrade, geminiKey, anthropicKey, openaiKey } = body;

    const user = await prisma.user.findFirst({
      where: { email: "trader@broker.com" },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const updateData: any = {};
    if (accountSize !== undefined) updateData.accountSize = Number(accountSize);
    if (riskPerTrade !== undefined) updateData.riskPerTrade = Number(riskPerTrade);
    if (geminiKey !== undefined) updateData.geminiKey = geminiKey;
    if (anthropicKey !== undefined) updateData.anthropicKey = anthropicKey;
    if (openaiKey !== undefined) updateData.openaiKey = openaiKey;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      accountSize: updated.accountSize,
      riskPerTrade: updated.riskPerTrade,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
