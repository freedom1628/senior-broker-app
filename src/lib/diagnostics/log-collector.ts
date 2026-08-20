"use client";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "STATE" | "NETWORK";
  category: string;
  message: string;
  data?: any;
}

const MAX_LOGS = 250;
const logBuffer: LogEntry[] = [];
let isInitialized = false;

export function addDiagnosticLog(
  level: LogEntry["level"],
  category: string,
  message: string,
  data?: any
): void {
  const entry: LogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    data: data ? sanitizeData(data) : undefined,
  };

  logBuffer.unshift(entry);
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.pop();
  }

  // Also persist last 50 logs to sessionStorage for dump across page reloads
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem("senior_broker_diag_logs", JSON.stringify(logBuffer.slice(0, 50)));
    } catch (e) {}
  }
}

function sanitizeData(data: any): any {
  try {
    if (typeof data !== "object" || data === null) return data;
    // Redact sensitive keys
    const clone = JSON.parse(JSON.stringify(data));
    const redactKeys = ["key", "apiKey", "geminiKey", "anthropicKey", "openaiKey", "passcode", "password"];
    
    function walk(obj: any) {
      if (!obj || typeof obj !== "object") return;
      for (const k of Object.keys(obj)) {
        if (redactKeys.some((rk) => k.toLowerCase().includes(rk.toLowerCase()))) {
          obj[k] = "[REDACTED]";
        } else if (typeof obj[k] === "object") {
          walk(obj[k]);
        }
      }
    }
    walk(clone);
    return clone;
  } catch (e) {
    return String(data);
  }
}

export function initDiagnosticLogger(): void {
  if (typeof window === "undefined" || isInitialized) return;
  isInitialized = true;

  // Restore prior session logs
  try {
    const raw = sessionStorage.getItem("senior_broker_diag_logs");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        logBuffer.push(...parsed);
      }
    }
  } catch (e) {}

  addDiagnosticLog("INFO", "SYSTEM", "Diagnostic logger initialized");

  // Intercept Global Window Errors
  window.addEventListener("error", (event) => {
    addDiagnosticLog("ERROR", "WINDOW_ERROR", event.message || "Unknown error", {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error ? event.error.stack || event.error.message : undefined,
    });
  });

  // Intercept Unhandled Promise Rejections
  window.addEventListener("unhandledrejection", (event) => {
    addDiagnosticLog("ERROR", "UNHANDLED_PROMISE", String(event.reason?.message || event.reason || "Unhandled Promise Rejection"), {
      stack: event.reason?.stack,
    });
  });

  // Hook Console methods safely
  const originalError = console.error;
  console.error = (...args: any[]) => {
    try {
      const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      addDiagnosticLog("ERROR", "CONSOLE", msg);
    } catch (e) {}
    originalError.apply(console, args);
  };

  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    try {
      const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      addDiagnosticLog("WARN", "CONSOLE", msg);
    } catch (e) {}
    originalWarn.apply(console, args);
  };
}

export function getDiagnosticLogs(): LogEntry[] {
  return [...logBuffer];
}

export function clearDiagnosticLogs(): void {
  logBuffer.length = 0;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem("senior_broker_diag_logs");
    } catch (e) {}
  }
}

export function generateApplicationDiagnosticDump(): string {
  if (typeof window === "undefined") return "Diagnostics only available in browser.";

  const now = new Date().toISOString();
  let userProfile: any = null;
  try {
    const rawUser = localStorage.getItem("senior_broker_user") || sessionStorage.getItem("senior_broker_user");
    if (rawUser) userProfile = JSON.parse(rawUser);
  } catch (e) {}

  // Gather LocalStorage inventory
  const storageInventory: Record<string, { sizeBytes: number; itemsCount?: number }> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("senior_broker") || key.startsWith("sb_"))) {
        const val = localStorage.getItem(key) || "";
        let itemsCount: number | undefined = undefined;
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) itemsCount = parsed.length;
        } catch (e) {}
        storageInventory[key] = {
          sizeBytes: val.length,
          itemsCount,
        };
      }
    }
  } catch (e) {}

  // Gather custom positions summary
  let customPositions: any[] = [];
  try {
    const raw = localStorage.getItem("senior_broker_custom_positions");
    if (raw) customPositions = JSON.parse(raw);
  } catch (e) {}

  const activeCount = customPositions.filter((t) => t.status === "ACTIVE" || t.status === "SCALED_T1").length;
  const closedCount = customPositions.filter((t) => t.status === "CLOSED").length;
  const pendingCount = customPositions.filter((t) => t.status === "PENDING_ENTRY").length;

  const dumpObject = {
    generatedAt: now,
    appVersion: "Senior Broker 2.0-Turbopack",
    environment: {
      url: window.location.href,
      userAgent: navigator.userAgent,
      online: navigator.onLine,
      screen: `${window.innerWidth}x${window.innerHeight}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    userSession: {
      isAuthenticated: !!userProfile,
      email: userProfile?.email || "anonymous/offline",
      name: userProfile?.name || "N/A",
      authProvider: userProfile?.authProvider || "PIN",
    },
    portfolioStorageState: {
      totalStoredPositions: customPositions.length,
      activePositions: activeCount,
      pendingWatch: pendingCount,
      closedCampaigns: closedCount,
      sampleTickers: customPositions.map((t) => `${t.ticker} (${t.status || "ACTIVE"})`),
      storageKeys: storageInventory,
    },
    recentLogsCount: logBuffer.length,
    recentLogs: logBuffer.slice(0, 100),
  };

  return JSON.stringify(dumpObject, null, 2);
}
