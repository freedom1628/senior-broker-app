"use client";

import { Trade } from "./types";

export function getActiveUserEmail(explicitEmail?: string): string {
  if (explicitEmail && explicitEmail.trim()) {
    return explicitEmail.toLowerCase().trim();
  }
  if (typeof window !== "undefined") {
    try {
      const rawUser = localStorage.getItem("senior_broker_user") || sessionStorage.getItem("senior_broker_user");
      if (rawUser) {
        const u = JSON.parse(rawUser);
        if (u && u.email) return u.email.toLowerCase().trim();
      }
    } catch (e) {}
  }
  return "trader@broker.com";
}

export function getProfileKey(email?: string): string {
  const resolved = getActiveUserEmail(email);
  const normalized = resolved.replace(/[^a-z0-9_]/g, "_");
  return `senior_broker_profile_trades_${normalized}`;
}

export function loadProfileTradesFromStorage(email?: string): Trade[] {
  if (typeof window === "undefined") return [];

  const resolved = getActiveUserEmail(email);
  const primaryKey = getProfileKey(resolved);
  const candidateKeys = [
    primaryKey,
    "senior_broker_custom_positions",
    "senior_broker_profile_trades_default_trader",
    "senior_broker_profile_trades_alex_jones_trader_gmail_com",
    "senior_broker_profile_trades_trader_broker_com",
    "sb_trades",
  ];

  const tradeMap = new Map<string, Trade>();

  // Gather trades from all candidate storage keys to guarantee zero data loss
  for (const key of candidateKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && (item.ticker || item.id)) {
              const tradeId = item.id || `trade-${item.ticker}-${item.actualEntry || item.entryTrigger}-${item.entryDate || Date.now()}`;
              if (!tradeMap.has(tradeId)) {
                tradeMap.set(tradeId, { ...item, id: tradeId });
              }
            }
          }
        }
      }
    } catch (e) {}
  }

  const allFound = Array.from(tradeMap.values());
  if (allFound.length > 0) {
    try {
      localStorage.setItem(primaryKey, JSON.stringify(allFound));
      localStorage.setItem("senior_broker_custom_positions", JSON.stringify(allFound));
    } catch (e) {}
  }

  return allFound;
}

export function saveProfileTradesToStorage(trades: Trade[], email?: string): void {
  if (typeof window === "undefined") return;
  const resolved = getActiveUserEmail(email);
  const primaryKey = getProfileKey(resolved);

  try {
    const json = JSON.stringify(trades);
    localStorage.setItem(primaryKey, json);
    localStorage.setItem("senior_broker_custom_positions", json);
    localStorage.setItem("sb_trades", json);
  } catch (e) {
    console.warn("Error saving profile trades:", e);
  }
}

export function upsertProfileTrade(trade: Trade, email?: string): Trade[] {
  const resolved = getActiveUserEmail(email);
  const existing = loadProfileTradesFromStorage(resolved);
  const tradeId = trade.id || `trade-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const preparedTrade: Trade = { ...trade, id: tradeId };

  const idx = existing.findIndex((t) => t.id === tradeId || (t.ticker === trade.ticker && t.entryDate === trade.entryDate && t.status === trade.status));
  let updated: Trade[];
  if (idx !== -1) {
    updated = [...existing];
    updated[idx] = { ...updated[idx], ...preparedTrade };
  } else {
    updated = [preparedTrade, ...existing];
  }

  saveProfileTradesToStorage(updated, resolved);
  return updated;
}

export function removeProfileTrade(tradeId: string, email?: string): Trade[] {
  const resolved = getActiveUserEmail(email);
  const existing = loadProfileTradesFromStorage(resolved);
  const updated = existing.filter((t) => t.id !== tradeId);
  saveProfileTradesToStorage(updated, resolved);
  return updated;
}

export function clearAllProfileTrades(email?: string): void {
  if (typeof window === "undefined") return;
  const resolved = getActiveUserEmail(email);
  const primaryKey = getProfileKey(resolved);

  try {
    localStorage.removeItem(primaryKey);
    localStorage.removeItem("senior_broker_custom_positions");
    localStorage.removeItem("senior_broker_profile_trades_default_trader");
    localStorage.removeItem("senior_broker_profile_trades_alex_jones_trader_gmail_com");
    localStorage.removeItem("senior_broker_profile_trades_trader_broker_com");
    localStorage.removeItem("sb_trades");
    localStorage.removeItem("senior_broker_positions_v1");
  } catch (e) {}
}

export async function syncProfileTradesWithServer(email?: string): Promise<Trade[]> {
  const resolved = getActiveUserEmail(email);
  const localTrades = loadProfileTradesFromStorage(resolved);

  try {
    const res = await fetch("/api/trades/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientTrades: localTrades,
        userEmail: resolved,
      }),
    });

    const data = await res.json();
    if (data.trades && Array.isArray(data.trades) && data.trades.length > 0) {
      const map = new Map<string, Trade>();
      localTrades.forEach((t) => map.set(t.id, t));
      data.trades.forEach((t: Trade) => {
        if (!map.has(t.id)) {
          map.set(t.id, t);
        } else {
          map.set(t.id, { ...map.get(t.id)!, ...t });
        }
      });

      const merged = Array.from(map.values());
      saveProfileTradesToStorage(merged, resolved);
      return merged;
    }
  } catch (err) {
    console.warn("Server sync unreachable, operating from local profile vault:", err);
  }

  return localTrades;
}
