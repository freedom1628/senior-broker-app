"use client";

import { Trade } from "./types";

export function getProfileKey(email?: string): string {
  const normalizedEmail = (email || "default_trader").toLowerCase().trim().replace(/[^a-z0-9_]/g, "_");
  return `senior_broker_profile_trades_${normalizedEmail}`;
}

export function getProfileSettingsKey(email?: string): string {
  const normalizedEmail = (email || "default_trader").toLowerCase().trim().replace(/[^a-z0-9_]/g, "_");
  return `senior_broker_profile_settings_${normalizedEmail}`;
}

export function loadProfileTradesFromStorage(email?: string): Trade[] {
  if (typeof window === "undefined") return [];
  try {
    const key = getProfileKey(email);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }

    // Fallback check legacy global key
    const fallbackRaw = localStorage.getItem("senior_broker_custom_positions");
    if (fallbackRaw) {
      const parsedFallback = JSON.parse(fallbackRaw);
      if (Array.isArray(parsedFallback) && parsedFallback.length > 0) {
        // Migrate to profile key
        localStorage.setItem(key, JSON.stringify(parsedFallback));
        return parsedFallback;
      }
    }
  } catch (e) {
    console.warn("Error reading profile trades from storage:", e);
  }
  return [];
}

export function saveProfileTradesToStorage(trades: Trade[], email?: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = getProfileKey(email);
    localStorage.setItem(key, JSON.stringify(trades));
    // Also mirror to global custom positions key for compatibility
    localStorage.setItem("senior_broker_custom_positions", JSON.stringify(trades));
  } catch (e) {
    console.warn("Error saving profile trades to storage:", e);
  }
}

export function upsertProfileTrade(trade: Trade, email?: string): Trade[] {
  const existing = loadProfileTradesFromStorage(email);
  const tradeId = trade.id || `trade-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const preparedTrade = { ...trade, id: tradeId };

  const idx = existing.findIndex((t) => t.id === tradeId);
  let updated: Trade[];
  if (idx !== -1) {
    updated = [...existing];
    updated[idx] = { ...updated[idx], ...preparedTrade };
  } else {
    updated = [preparedTrade, ...existing];
  }

  saveProfileTradesToStorage(updated, email);
  return updated;
}

export function removeProfileTrade(tradeId: string, email?: string): Trade[] {
  const existing = loadProfileTradesFromStorage(email);
  const updated = existing.filter((t) => t.id !== tradeId);
  saveProfileTradesToStorage(updated, email);
  return updated;
}

export function clearAllProfileTrades(email?: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = getProfileKey(email);
    localStorage.removeItem(key);
    localStorage.removeItem("senior_broker_custom_positions");
    localStorage.removeItem("senior_broker_positions_v1");
  } catch (e) {}
}

export async function syncProfileTradesWithServer(email?: string): Promise<Trade[]> {
  const localTrades = loadProfileTradesFromStorage(email);

  try {
    // 1. Post local trades to sync endpoint to re-hydrate server edge memory if updated
    const res = await fetch("/api/trades/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientTrades: localTrades,
        userEmail: email,
      }),
    });

    const data = await res.json();
    if (data.trades && Array.isArray(data.trades)) {
      // Merge unique by ID
      const map = new Map<string, Trade>();
      localTrades.forEach((t) => map.set(t.id, t));
      data.trades.forEach((t: Trade) => {
        if (!map.has(t.id)) {
          map.set(t.id, t);
        } else {
          // Merge newer server updates
          map.set(t.id, { ...map.get(t.id)!, ...t });
        }
      });

      const merged = Array.from(map.values());
      saveProfileTradesToStorage(merged, email);
      return merged;
    }
  } catch (err) {
    console.warn("Failed to sync with server, using local profile vault:", err);
  }

  return localTrades;
}
