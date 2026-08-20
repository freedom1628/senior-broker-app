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

// Memory debounce cache to prevent sound sirens or repeated audio loops
const RECENT_AUDIO_ALERTS = new Map<string, number>();

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
  const alertKey = `${notification.ticker}-${notification.type}`;
  const now = Date.now();
  const lastPlayed = RECENT_AUDIO_ALERTS.get(alertKey) || 0;

  // Debounce audio: Never play the same audio alert more than once every 10 minutes
  if (now - lastPlayed < 10 * 60 * 1000) {
    return;
  }
  RECENT_AUDIO_ALERTS.set(alertKey, now);

  // 1. Play soft, non-intrusive audio feedback
  try {
    if (notification.type === "TARGET_1_HIT" || notification.type === "TARGET_2_HIT") {
      playTargetChime();
    } else if (notification.type === "STOP_ALERT") {
      // Soft gentle warning
      playStopLossAlert();
    } else {
      playEntryTriggered();
    }
  } catch (e) {
    // Non-fatal
  }

  // 2. Trigger Web Push / Browser notification
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
