"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Bell,
  Sliders,
  Settings as SettingsIcon,
  Plus,
  TrendingUp,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Smartphone,
  LogOut,
  User,
  DollarSign,
  Lock,
  Volume2,
  VolumeX,
  HelpCircle,
  GraduationCap,
} from "lucide-react";
import { isMuted, setMuted } from "@/lib/audio/sound-effects";

interface HeaderProps {
  onOpenImport: () => void;
  onOpenSettings: () => void;
  onOpenAddTrade: () => void;
  onOpenNotifications: () => void;
  onSignOut: () => void;
  onLockDesk?: () => void;
  onOpenTour?: () => void;
  unreadAlertsCount: number;
  marketQuotes: Record<string, any>;
  onRefreshQuotes: () => void;
  isPolling: boolean;
  accountSize: number;
  riskPerTrade: number;
  currentUser?: { email: string; name: string } | null;
  activeTab?: any;
  onNavigateTab?: (tab: any) => void;
  activeTrades?: any[];
}

export const Header: React.FC<HeaderProps> = ({
  onOpenImport,
  onOpenSettings,
  onOpenAddTrade,
  onOpenNotifications,
  onSignOut,
  onLockDesk,
  onOpenTour,
  unreadAlertsCount,
  marketQuotes,
  onRefreshQuotes,
  isPolling,
  accountSize,
  riskPerTrade,
  currentUser,
  activeTrades = [],
}) => {
  const spy = marketQuotes["SPY"];
  const qqq = marketQuotes["QQQ"];
  const vix = marketQuotes["VIX"];

  const [soundMuted, setSoundMuted] = useState(false);

  useEffect(() => {
    try {
      setSoundMuted(isMuted());
    } catch (e) {}
  }, []);

  const handleToggleSound = () => {
    const nextState = !soundMuted;
    setSoundMuted(nextState);
    setMuted(nextState);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#070A0F]/85 backdrop-blur-2xl transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Left: Brand & Capital Quick-Pill */}
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-md shadow-sky-500/20">
            <TrendingUp className="h-5 w-5 text-white stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-base font-semibold tracking-tight text-white">
                Senior Broker
              </span>
              <button
                type="button"
                onClick={onOpenSettings}
                title="Click to edit capital and risk %"
                className="flex items-center space-x-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-300 hover:bg-emerald-500/20 transition active:scale-95"
              >
                <span>${accountSize.toLocaleString()}</span>
                <span className="text-neutral-400">•</span>
                <span>{riskPerTrade}% Risk</span>
              </button>
            </div>
            <p className="hidden text-xs text-neutral-400 sm:block">
              Proprietary Swing Trading Intelligence &amp; Risk Desk
            </p>
          </div>
        </div>

        {/* Center: Live Running Ticker (Indices + User Positions) */}
        <div className="hidden lg:flex items-center space-x-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 backdrop-blur-md max-w-xl overflow-x-auto no-scrollbar">
          
          {/* Major Indices */}
          {spy && (
            <div className="flex items-center space-x-1.5 px-2 text-xs shrink-0">
              <span className="font-mono font-medium text-neutral-400">SPY</span>
              <span className="font-mono font-semibold text-white">${spy.price.toFixed(2)}</span>
              <span className={`font-mono text-[11px] ${spy.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {spy.change >= 0 ? "+" : ""}{spy.changePct.toFixed(2)}%
              </span>
            </div>
          )}
          <div className="h-3 w-px bg-white/10 shrink-0" />
          {qqq && (
            <div className="flex items-center space-x-1.5 px-2 text-xs shrink-0">
              <span className="font-mono font-medium text-neutral-400">QQQ</span>
              <span className="font-mono font-semibold text-white">${qqq.price.toFixed(2)}</span>
              <span className={`font-mono text-[11px] ${qqq.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {qqq.change >= 0 ? "+" : ""}{qqq.changePct.toFixed(2)}%
              </span>
            </div>
          )}
          <div className="h-3 w-px bg-white/10 shrink-0" />
          {vix && (
            <div className="flex items-center space-x-1.5 px-2 text-xs shrink-0">
              <span className="font-mono font-medium text-neutral-400">VIX</span>
              <span className="font-mono font-semibold text-sky-400">{vix.price.toFixed(2)}</span>
            </div>
          )}

          {/* User's Active Position Tickers */}
          {activeTrades.map((trade) => {
            const sym = trade.ticker.toUpperCase();
            const quote = marketQuotes[sym];
            const price = quote?.price || trade.entryTrigger;
            const change = quote?.change ?? 0;
            const changePct = quote?.changePct ?? 0;
            const isNasdaq = ["AAPL", "NVDA", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "GLBE", "TWLO", "LITE", "CRWV"].includes(sym);
            const indexLabel = isNasdaq ? "QQQ" : "SPY";

            return (
              <React.Fragment key={trade.id || sym}>
                <div className="h-3 w-px bg-white/10 shrink-0" />
                <div className="flex items-center space-x-1.5 px-2 text-xs shrink-0">
                  <span className="font-mono font-bold text-sky-300">{sym}</span>
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/10 text-neutral-400">{indexLabel}</span>
                  <span className="font-mono font-semibold text-white">${price.toFixed(2)}</span>
                  <span className={`font-mono text-[11px] ${change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {change >= 0 ? "+" : ""}{changePct.toFixed(2)}%
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          
          {/* Add Position Button */}
          <button
            type="button"
            onClick={onOpenAddTrade}
            className="flex items-center space-x-1.5 rounded-full bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-400 transition active:scale-95"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>Add Position</span>
          </button>

          {/* Ingest Research Button */}
          <button
            type="button"
            onClick={onOpenImport}
            className="hidden sm:flex items-center space-x-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-900 shadow-sm hover:bg-neutral-100 transition active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5 text-sky-600" />
            <span>AI Research</span>
          </button>

          {/* Interactive Walkthrough / Tour Button */}
          {onOpenTour && (
            <button
              type="button"
              onClick={onOpenTour}
              title="How to Use App (Apple-style Walkthrough)"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-sky-500/20 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 transition active:scale-95"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          )}

          {/* Sound Toggle (Mute / Unmute) */}
          <button
            type="button"
            onClick={handleToggleSound}
            title={soundMuted ? "Sound is Muted (Click to Unmute)" : "Sound is Active (Click to Mute)"}
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition active:scale-95 ${
              soundMuted
                ? "border-neutral-700 bg-neutral-800/40 text-neutral-500"
                : "border-sky-500/30 bg-sky-500/10 text-sky-400"
            }`}
          >
            {soundMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {/* Live Market Tape Status Indicator */}
          <button
            type="button"
            onClick={onRefreshQuotes}
            title="Market Tape Connected (Click to Refresh)"
            className="hidden md:flex items-center space-x-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-white/[0.08] transition active:scale-95"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <RefreshCw className="h-3 w-3 text-neutral-400" />
          </button>

          {/* Notifications Bell */}
          <button
            type="button"
            onClick={onOpenNotifications}
            title="Notifications"
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
            type="button"
            onClick={onOpenSettings}
            title="Settings & Diagnostics"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08] transition active:scale-95"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>

          {/* Sign Out */}
          <button
            type="button"
            onClick={onSignOut}
            title="Sign Out / Switch Desk"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition active:scale-95"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
