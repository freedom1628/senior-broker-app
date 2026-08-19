"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Bell,
  Sliders,
  PlusCircle,
  TrendingUp,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Smartphone,
  LogOut,
  User,
} from "lucide-react";
import { triggerNotificationAlert } from "@/lib/notifications/notification-service";

interface HeaderProps {
  onOpenImport: () => void;
  onOpenSettings: () => void;
  onOpenNotifications: () => void;
  onSignOut: () => void;
  unreadAlertsCount: number;
  marketQuotes: Record<string, any>;
  onRefreshQuotes: () => void;
  isPolling: boolean;
  currentUser?: { email: string; name: string } | null;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenImport,
  onOpenSettings,
  onOpenNotifications,
  onSignOut,
  unreadAlertsCount,
  marketQuotes,
  onRefreshQuotes,
  isPolling,
  currentUser,
}) => {
  const spy = marketQuotes["SPY"];
  const qqq = marketQuotes["QQQ"];
  const vix = marketQuotes["VIX"];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#070A0F]/80 backdrop-blur-2xl transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Left: Brand & Regime Badge */}
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-md shadow-sky-500/20">
            <TrendingUp className="h-5 w-5 text-white stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-base font-semibold tracking-tight text-white">
                Senior Broker
              </span>
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-sky-400">
                PRO DESK
              </span>
            </div>
            <p className="hidden text-xs text-neutral-400 sm:block">
              Proprietary Swing Trading Intelligence &amp; Risk Desk
            </p>
          </div>
        </div>

        {/* Center: Live Index Ribbon (Apple-style pill) */}
        <div className="hidden lg:flex items-center space-x-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 backdrop-blur-md">
          {spy && (
            <div className="flex items-center space-x-1.5 px-2 text-xs">
              <span className="font-mono font-medium text-neutral-400">SPY</span>
              <span className="font-mono font-semibold text-white">${spy.price.toFixed(2)}</span>
              <span className={`font-mono text-[11px] ${spy.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {spy.change >= 0 ? "+" : ""}{spy.changePct.toFixed(2)}%
              </span>
            </div>
          )}
          <div className="h-3 w-px bg-white/10" />
          {qqq && (
            <div className="flex items-center space-x-1.5 px-2 text-xs">
              <span className="font-mono font-medium text-neutral-400">QQQ</span>
              <span className="font-mono font-semibold text-white">${qqq.price.toFixed(2)}</span>
              <span className={`font-mono text-[11px] ${qqq.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {qqq.change >= 0 ? "+" : ""}{qqq.changePct.toFixed(2)}%
              </span>
            </div>
          )}
          <div className="h-3 w-px bg-white/10" />
          {vix && (
            <div className="flex items-center space-x-1.5 px-2 text-xs">
              <span className="font-mono font-medium text-neutral-400">VIX</span>
              <span className="font-mono font-semibold text-sky-400">{vix.price.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2.5">
          {/* Live Polling Status Indicator */}
          <button
            onClick={onRefreshQuotes}
            title="Market polling is active"
            className="flex items-center space-x-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/[0.08] transition"
          >
            <span className={`h-2 w-2 rounded-full ${isPolling ? "bg-emerald-400 animate-pulse" : "bg-neutral-500"}`} />
            <span className="hidden sm:inline font-mono text-[11px]">LIVE TAPE</span>
            <RefreshCw className={`h-3 w-3 text-neutral-400 ${isPolling ? "animate-spin" : ""}`} />
          </button>

          {/* New Multi-AI Research Button */}
          <button
            onClick={onOpenImport}
            className="flex items-center space-x-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-900 shadow-sm hover:bg-neutral-100 transition active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5 text-sky-600" />
            <span>Ingest Research</span>
          </button>

          {/* Notifications Bell */}
          <button
            onClick={onOpenNotifications}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08] transition active:scale-95"
          >
            <Bell className="h-4 w-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-md shadow-rose-500/50">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08] transition active:scale-95"
          >
            <Sliders className="h-4 w-4" />
          </button>

          {/* Sign Out / Lock Desk */}
          <button
            onClick={onSignOut}
            title="Lock Desk / Sign Out"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition active:scale-95"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
