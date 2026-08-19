import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await prisma.user.findFirst({
      where: { email: "trader@broker.com" },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const notifications = await prisma.alertNotification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const unreadCount = notifications.filter((n: any) => !n.isRead).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { notificationId, markAll } = body;

    const user = await prisma.user.findFirst({
      where: { email: "trader@broker.com" },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (markAll) {
      await prisma.alertNotification.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true },
      });
    } else if (notificationId) {
      await prisma.alertNotification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating notifications:", error);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}
