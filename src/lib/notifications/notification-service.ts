import { playTargetChime, playStopLossAlert, playEntryTriggered } from "@/lib/audio/sound-effects";

export interface AppNotification {
  id: string;
  ticker: string;
  type: "ENTRY_TRIGGERED" | "STOP_ALERT" | "TARGET_1_HIT" | "TARGET_2_HIT" | "TIME_STOP_WARNING";
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
}

export function requestPushPermission() {
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }
}

export function triggerNotificationAlert(notification: {
  ticker: string;
  type: "ENTRY_TRIGGERED" | "STOP_ALERT" | "TARGET_1_HIT" | "TARGET_2_HIT" | "TIME_STOP_WARNING";
  title: string;
  message: string;
}) {
  // 1. Play synthesized Apple-style audio chime
  if (notification.type === "TARGET_1_HIT" || notification.type === "TARGET_2_HIT") {
    playTargetChime();
  } else if (notification.type === "STOP_ALERT") {
    playStopLossAlert();
  } else {
    playEntryTriggered();
  }

  // 2. Trigger Web Push / Browser notification (works on Android Chrome, iOS Web App, and desktop)
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      try {
        new Notification(notification.title, {
          body: notification.message,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
        });
      } catch (e) {
        console.warn("Browser notification failed:", e);
      }
    }
  }
}
