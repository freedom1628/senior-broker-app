"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Header } from "@/components/layout/Header";
import { TabNavigation } from "@/components/layout/TabNavigation";
import { MobileNav } from "@/components/layout/MobileNav";
import { PortfolioSummaryCard } from "@/components/dashboard/PortfolioSummaryCard";
import { CoachFeed } from "@/components/dashboard/CoachFeed";
import { LearningCenter } from "@/components/dashboard/LearningCenter";
import { RegimeBanner } from "@/components/dashboard/RegimeBanner";
import { MultiModelCompare } from "@/components/dashboard/MultiModelCompare";
import { ActiveTradesPanel } from "@/components/dashboard/ActiveTradesPanel";
import { TradeJournal } from "@/components/dashboard/TradeJournal";
import { ImportModal } from "@/components/dashboard/ImportModal";
import { SettingsModal } from "@/components/dashboard/SettingsModal";
import { AddTradeModal } from "@/components/dashboard/AddTradeModal";
import { NotificationCenter } from "@/components/dashboard/NotificationCenter";
import { OnboardingTourModal } from "@/components/dashboard/OnboardingTourModal";
import { SignInView } from "@/components/auth/SignInView";
import { DeskLockOverlay } from "@/components/auth/DeskLockOverlay";
import { triggerNotificationAlert } from "@/lib/notifications/notification-service";
import {
  syncProfileTradesWithServer,
  loadProfileTradesFromStorage,
  saveProfileTradesToStorage,
  upsertProfileTrade,
  removeProfileTrade,
  clearAllProfileTrades,
} from "@/lib/storage/profile-vault";
import { NavigationTab } from "@/types";
import {
  Sliders,
  Shield,
  Key,
  DollarSign,
  User as UserIcon,
  CheckCircle2,
  Lock,
  Smartphone,
} from "lucide-react";

function DeskHome() {
  const { isAuthenticated, isLocked, currentUser, lockDesk, logout, updateDeskPin } = useAuth();

  // App Navigation State (6 core views)
  const [activeTab, setActiveTab] = useState<NavigationTab>("COACH");
  const [researchData, setResearchData] = useState<any | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [activeTrades, setActiveTrades] = useState<any[]>([]);
  const [pendingTrades, setPendingTrades] = useState<any[]>([]);
  const [closedTrades, setClosedTrades] = useState<any[]>([]);
  const [dailyReport, setDailyReport] = useState<any | null>(null);
  const [metrics, setMetrics] = useState<any>({
    totalRealizedPnL: 0,
    winRate: 0,
    totalTrades: 0,
    avgRMultiple: 0,
    openPositionCount: 0,
  });
  const [marketQuotes, setMarketQuotes] = useState<Record<string, any>>({});
  const [notifications, setNotifications] = useState<any[]>([]);
  const [accountSize, setAccountSize] = useState<number>(15000);
  const [riskPerTrade, setRiskPerTrade] = useState<number>(1.0);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  // In-page Settings State for SETTINGS view
  const [pinChangeOld, setPinChangeOld] = useState("");
  const [pinChangeNew, setPinChangeNew] = useState("");
  const [pinChangeMsg, setPinChangeMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Modals
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddTradeOpen, setIsAddTradeOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);

  // Check tour completion on first mount
  useEffect(() => {
    try {
      const tourDone = localStorage.getItem("senior_broker_tour_completed");
      if (!tourDone) {
        setIsTourOpen(true);
      }
    } catch (e) {}
  }, []);

  // 1. Fetch Research Data
  const loadResearch = useCallback(async () => {
    try {
      const res = await fetch("/api/research/current");
      const data = await res.json();
      if (data.researchRun) {
        setResearchData(data.researchRun);
        setCandidates(data.candidates || []);
      }
      if (data.user) {
        setAccountSize(data.user.accountSize || 15000);
        setRiskPerTrade(data.user.riskPerTrade || 1.0);
      }
    } catch (err) {
      console.error("Error loading research:", err);
    }
  }, []);

  // 2. Fetch Trades Data (Profile Vault + Cloud Sync across App Updates)
  const loadTrades = useCallback(async () => {
    try {
      const email = currentUser?.email || "trader@broker.com";
      const allTrades = await syncProfileTradesWithServer(email);

      const active = allTrades.filter((t: any) => t.status === "ACTIVE" || t.status === "SCALED_T1");
      const pending = allTrades.filter((t: any) => t.status === "PENDING_ENTRY");
      const closed = allTrades.filter((t: any) => t.status === "CLOSED");

      setActiveTrades(active);
      setPendingTrades(pending);
      setClosedTrades(closed);

      const totalRealized = closed.reduce((acc: number, t: any) => acc + (t.realizedPnL || 0), 0);
      const winCount = closed.filter((t: any) => (t.realizedPnL || 0) > 0).length;
      const winRateVal = closed.length > 0 ? (winCount / closed.length) * 100 : 0;
      const avgR = closed.length > 0 ? closed.reduce((acc: number, t: any) => acc + (t.rMultiple || 0), 0) / closed.length : 0;

      setMetrics({
        totalRealizedPnL: Number(totalRealized.toFixed(2)),
        winRate: Number(winRateVal.toFixed(1)),
        totalTrades: closed.length,
        avgRMultiple: Number(avgR.toFixed(2)),
        openPositionCount: active.length,
      });
    } catch (err) {
      console.error("Error loading trades:", err);
    }
  }, [currentUser]);

  // 3. Fetch Daily Moves Action Report
  const loadDailyReport = useCallback(async () => {
    try {
      const res = await fetch("/api/portfolio/daily-report");
      const data = await res.json();
      if (data.report) {
        setDailyReport(data.report);
      }
    } catch (err) {
      console.error("Error loading daily report:", err);
    }
  }, []);

  // 4. Fetch Notifications
  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications);
      }
    } catch (err) {
      console.error("Error loading notifications:", err);
    }
  }, []);

  // 5. Fetch Market Quotes & Poll Triggers
  const pollMarketData = useCallback(async () => {
    setIsPolling(true);
    try {
      const tickersToWatch = Array.from(
        new Set([
          "SPY",
          "QQQ",
          "VIX",
          ...candidates.map((c) => c.ticker),
          ...activeTrades.map((t) => t.ticker),
          ...pendingTrades.map((t) => t.ticker),
        ])
      );

      const quotesRes = await fetch(`/api/market/quotes?tickers=${tickersToWatch.join(",")}`);
      const quotesData = await quotesRes.json();
      if (quotesData.quotes) {
        setMarketQuotes(quotesData.quotes);
      }

      // Check trade triggers and alerts
      const pollRes = await fetch("/api/market/poll", { method: "POST" });
      const pollData = await pollRes.json();

      if (pollData.alerts && pollData.alerts.length > 0) {
        for (const alert of pollData.alerts) {
          triggerNotificationAlert({
            ticker: alert.ticker,
            type: alert.alertType,
            title: alert.alertTitle,
            message: alert.alertMessage,
          });
        }
        loadNotifications();
        loadTrades();
        loadDailyReport();
      }
    } catch (err) {
      console.error("Error in market poll:", err);
    } finally {
      setTimeout(() => setIsPolling(false), 800);
    }
  }, [candidates, activeTrades, pendingTrades, loadNotifications, loadTrades, loadDailyReport]);

  // Initial Load when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadResearch();
      loadTrades();
      loadDailyReport();
      loadNotifications();
    }
  }, [isAuthenticated, loadResearch, loadTrades, loadDailyReport, loadNotifications]);

  // Periodic Market Polling (every 15 seconds)
  useEffect(() => {
    if (isAuthenticated) {
      pollMarketData();
      const interval = setInterval(pollMarketData, 15000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, pollMarketData]);

  // Promote Candidate Setup to Trade
  const handlePromoteToTrade = async (setup: any, mode: "PENDING_ENTRY" | "ACTIVE") => {
    try {
      await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: setup.id,
          ticker: setup.ticker,
          companyName: setup.companyName,
          status: mode,
          setupType: setup.setupType,
          entryTrigger: setup.entryTrigger,
          actualEntry: mode === "ACTIVE" ? setup.entryTrigger : undefined,
          sharesTotal: setup.positionShares,
          initialStop: setup.stopLoss,
          currentStop: setup.stopLoss,
          target1: setup.target1,
          target2: setup.target2,
          rrRatio: setup.rrRatio,
          timeStopSessions: setup.timeStopDays || 6,
          notes: setup.catalystSummary,
        }),
      });

      triggerNotificationAlert({
        ticker: setup.ticker,
        type: "ENTRY_TRIGGERED",
        title: mode === "ACTIVE" ? `Position Opened: ${setup.ticker}` : `Watch Order Set: ${setup.ticker}`,
        message: mode === "ACTIVE"
          ? `Allocated ${setup.positionShares} shares. Hard stop strictly at $${setup.stopLoss.toFixed(2)}.`
          : `Watching for entry trigger at $${setup.entryTrigger.toFixed(2)}.`,
      });
      loadTrades();
      loadResearch();
      loadDailyReport();
      setActiveTab("POSITIONS");
    } catch (err) {
      console.error("Error promoting setup to trade:", err);
    }
  };

  // Scale 50% at Target 1
  const handleScaleT1 = async (tradeId: string, fillPrice?: number) => {
    try {
      await fetch("/api/trades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeId,
          action: "SCALE_T1",
          fillPrice,
        }),
      });
      loadTrades();
      loadDailyReport();
    } catch (err) {
      console.error("Error scaling T1:", err);
    }
  };

  // Update Stop Loss
  const handleUpdateStop = async (tradeId: string, newStop: number) => {
    try {
      await fetch("/api/trades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeId,
          action: "UPDATE_STOP",
          newStop,
        }),
      });
      loadTrades();
      loadDailyReport();
    } catch (err) {
      console.error(err);
    }
  };

  // Close Trade
  const handleCloseTrade = async (tradeId: string, exitReason: string, closePrice?: number) => {
    try {
      await fetch("/api/trades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeId,
          action: "CLOSE_TRADE",
          exitReason,
          closePrice,
        }),
      });
      loadTrades();
      loadDailyReport();
    } catch (err) {
      console.error(err);
    }
  };

  // Activate Pending Trade
  const handleActivatePending = async (tradeId: string, fillPrice?: number) => {
    try {
      await fetch("/api/trades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeId,
          action: "ACTIVATE",
          fillPrice,
        }),
      });
      loadTrades();
      loadDailyReport();
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Trade
  const handleDeleteTrade = async (tradeId: string) => {
    try {
      await fetch(`/api/trades?id=${tradeId}`, { method: "DELETE" });
      removeProfileTrade(tradeId, currentUser?.email);
      loadTrades();
      loadDailyReport();
    } catch (err) {
      console.error(err);
    }
  };

  // Mark all notifications read
  const handleMarkAllNotificationsRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      loadNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeMsg(null);
    if (!pinChangeNew || pinChangeNew.length < 4) {
      setPinChangeMsg({ text: "New PIN must be at least 4 digits.", error: true });
      return;
    }
    const res = await updateDeskPin(pinChangeOld, pinChangeNew);
    if (res.success) {
      setPinChangeMsg({ text: "Desk PIN updated successfully!", error: false });
      setPinChangeOld("");
      setPinChangeNew("");
    } else {
      setPinChangeMsg({ text: res.error || "Failed to update PIN", error: true });
    }
  };

  const unreadAlertsCount = notifications.filter((n) => !n.isRead).length;
  const highUrgencyCount = dailyReport?.highUrgencyMoves?.length || 0;

  // Render Sign In if unauthenticated
  if (!isAuthenticated) {
    return <SignInView />;
  }

  return (
    <div className="min-h-screen bg-[#070A0F] text-slate-100 flex flex-col pb-20 sm:pb-8">
      {/* Header */}
      <Header
        onOpenImport={() => setIsImportOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAddTrade={() => setIsAddTradeOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onSignOut={logout}
        onLockDesk={lockDesk}
        onOpenTour={() => setIsTourOpen(true)}
        unreadAlertsCount={unreadAlertsCount}
        marketQuotes={marketQuotes}
        onRefreshQuotes={pollMarketData}
        isPolling={isPolling}
        accountSize={accountSize}
        riskPerTrade={riskPerTrade}
        currentUser={currentUser}
        activeTab={activeTab}
        onNavigateTab={(t) => setActiveTab(t)}
        activeTrades={activeTrades}
      />

      {/* Main Content Container */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* 1. Public.com Minimalist Portfolio Summary Card with Recharts Sparkline */}
        <PortfolioSummaryCard
          accountSize={accountSize}
          riskPerTrade={riskPerTrade}
          activeTrades={activeTrades}
          marketQuotes={marketQuotes}
          onOpenAddTrade={() => setIsAddTradeOpen(true)}
          onOpenImport={() => setIsImportOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onNavigateToTab={(t) => setActiveTab(t)}
        />

        {/* 2. 6-View Pill Segmented Navigation (Desktop & Tablet) */}
        <div className="hidden sm:block">
          <TabNavigation
            activeTab={activeTab}
            onSelectTab={(tab) => setActiveTab(tab)}
            counts={{
              activePositions: activeTrades.length,
              pendingOrders: pendingTrades.length,
              unreadAlerts: unreadAlertsCount,
              highUrgencyMoves: highUrgencyCount,
              candidateSetups: candidates.length,
            }}
          />
        </div>

        {/* VIEW 1: COACH FEED */}
        {activeTab === "COACH" && (
          <div className="animate-in fade-in duration-200">
            <CoachFeed
              report={dailyReport}
              activeTrades={activeTrades}
              marketQuotes={marketQuotes}
              onRefreshReport={() => {
                loadDailyReport();
                pollMarketData();
              }}
              onScaleT1={handleScaleT1}
              onCloseTrade={handleCloseTrade}
              onOpenAddTrade={() => setIsAddTradeOpen(true)}
              onOpenLearning={() => setActiveTab("LEARNING")}
            />
          </div>
        )}

        {/* VIEW 2: ACTIVE POSITIONS & WATCHLIST */}
        {activeTab === "POSITIONS" && (
          <div className="animate-in fade-in duration-200">
            <ActiveTradesPanel
              activeTrades={activeTrades}
              pendingTrades={pendingTrades}
              marketQuotes={marketQuotes}
              onScaleT1={handleScaleT1}
              onUpdateStop={handleUpdateStop}
              onCloseTrade={handleCloseTrade}
              onActivatePending={handleActivatePending}
              onDeleteTrade={handleDeleteTrade}
              onOpenAddTrade={() => setIsAddTradeOpen(true)}
            />
          </div>
        )}

        {/* VIEW 3: MULTI-LLM RESEARCH & SCREENER */}
        {activeTab === "SCREENER" && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {researchData && (
              <RegimeBanner
                marketRegime={researchData.marketRegime}
                regimeNotes={researchData.regimeNotes}
                macroFlags={researchData.macroFlags}
                arbiterSynthesis={researchData.arbiterSynthesis}
                date={researchData.date}
              />
            )}

            <MultiModelCompare
              candidates={candidates}
              marketQuotes={marketQuotes}
              onPromoteToTrade={handlePromoteToTrade}
              accountSize={accountSize}
            />
          </div>
        )}

        {/* VIEW 4: INVESTOR LEARNING CENTER */}
        {activeTab === "LEARNING" && (
          <div className="animate-in fade-in duration-200">
            <LearningCenter
              accountSize={accountSize}
              riskPerTrade={riskPerTrade}
            />
          </div>
        )}

        {/* VIEW 5: JOURNAL & HISTORICAL PERFORMANCE */}
        {activeTab === "JOURNAL" && (
          <div className="animate-in fade-in duration-200">
            <TradeJournal
              closedTrades={closedTrades}
              metrics={metrics}
            />
          </div>
        )}

        {/* VIEW 6: SETTINGS & RISK ALLOCATION */}
        {activeTab === "SETTINGS" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="rounded-3xl border border-white/[0.08] bg-[#0E131F] p-6 sm:p-8 backdrop-blur-2xl shadow-2xl space-y-6">
              
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06]">
                    <Sliders className="h-5 w-5 text-sky-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Desk Allocation &amp; Security Controls
                    </h3>
                    <p className="text-xs text-neutral-400 font-mono">
                      Configure swing capital, trade sizing, passcodes, and session authentication
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-900 shadow hover:bg-neutral-100 transition active:scale-95"
                >
                  Open Full Settings
                </button>
              </div>

              {/* Grid of Settings Modules */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. Account Risk Sizing */}
                <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-5 space-y-4">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-sky-400 flex items-center space-x-2">
                    <DollarSign className="h-4 w-4" />
                    <span>Sleeve Sizing Parameters</span>
                  </h4>
                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                      <span className="text-neutral-400">Dedicated Swing Capital:</span>
                      <span className="text-white font-bold">${accountSize.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                      <span className="text-neutral-400">1% Max Loss / Trade:</span>
                      <span className="text-amber-400 font-bold">${(accountSize * (riskPerTrade / 100)).toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                      <span className="text-neutral-400">3.0% Max Sleeve Open Risk:</span>
                      <span className="text-emerald-400 font-bold">${(accountSize * 0.03).toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-neutral-400">Max Open Positions:</span>
                      <span className="text-white font-bold">3 Concurrent Trades</span>
                    </div>
                  </div>
                </div>

                {/* 2. PIN Security & Desk Lock */}
                <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-5 space-y-4">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-amber-400 flex items-center space-x-2">
                    <Shield className="h-4 w-4" />
                    <span>Desk PIN &amp; Quick Lock</span>
                  </h4>

                  <form onSubmit={handleUpdatePinSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-neutral-400 font-mono mb-1">
                          Current PIN
                        </label>
                        <input
                          type="password"
                          placeholder="••••"
                          maxLength={6}
                          value={pinChangeOld}
                          onChange={(e) => setPinChangeOld(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-neutral-400 font-mono mb-1">
                          New 4-Digit PIN
                        </label>
                        <input
                          type="password"
                          placeholder="••••"
                          maxLength={6}
                          value={pinChangeNew}
                          onChange={(e) => setPinChangeNew(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    {pinChangeMsg && (
                      <p
                        className={`text-[11px] font-mono p-2 rounded-xl border ${
                          pinChangeMsg.error
                            ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                            : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                        }`}
                      >
                        {pinChangeMsg.text}
                      </p>
                    )}

                    <div className="flex items-center space-x-2 pt-1">
                      <button
                        type="submit"
                        className="flex-1 py-2 text-xs font-semibold rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white transition font-mono"
                      >
                        Update PIN
                      </button>
                      <button
                        type="button"
                        onClick={lockDesk}
                        className="py-2 px-3 text-xs font-semibold rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition font-mono flex items-center space-x-1"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        <span>Lock Desk</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Trader Identity Card */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  {currentUser?.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.name}
                      className="h-10 w-10 rounded-full object-cover border border-white/20"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-white">
                      <UserIcon className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <h5 className="text-sm font-semibold text-white">{currentUser?.name || "Senior Desk Trader"}</h5>
                    <p className="text-xs text-neutral-400 font-mono">{currentUser?.email || "trader@broker.com"}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-[11px] font-mono font-semibold text-emerald-400">
                    Session Active • 256-bit Encrypted
                  </span>
                  <button
                    type="button"
                    onClick={logout}
                    className="rounded-full bg-rose-500/10 border border-rose-500/20 px-3 py-1 text-[11px] font-mono text-rose-300 hover:bg-rose-500/20 transition"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Responsive Mobile Bottom Dock Navigation */}
      <MobileNav
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        counts={{
          activePositions: activeTrades.length,
          pendingOrders: pendingTrades.length,
          unreadAlerts: unreadAlertsCount,
        }}
        onOpenAddTrade={() => setIsAddTradeOpen(true)}
      />

      {/* Desk Lock Screen Overlay (when locked) */}
      <DeskLockOverlay />

      {/* Modals */}
      <AddTradeModal
        isOpen={isAddTradeOpen}
        onClose={() => setIsAddTradeOpen(false)}
        onTradeAdded={() => {
          loadTrades();
          loadDailyReport();
          setActiveTab("POSITIONS");
        }}
        accountSize={accountSize}
        riskPerTrade={riskPerTrade}
      />

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onResearchCompleted={() => {
          loadResearch();
          loadTrades();
          loadDailyReport();
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        accountSize={accountSize}
        riskPerTrade={riskPerTrade}
        onUpdateSettings={({ accountSize: s, riskPerTrade: r }) => {
          setAccountSize(s);
          setRiskPerTrade(r);
          loadResearch();
          loadDailyReport();
        }}
        onResetAllData={() => {
          clearAllProfileTrades(currentUser?.email);
          loadTrades();
          loadDailyReport();
        }}
      />

      <NotificationCenter
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllNotificationsRead}
      />

      {/* Apple-style Interactive Onboarding Walkthrough */}
      <OnboardingTourModal
        isOpen={isTourOpen}
        onClose={(dontShowAgain) => {
          setIsTourOpen(false);
          if (dontShowAgain) {
            try {
              localStorage.setItem("senior_broker_tour_completed", "true");
            } catch (e) {}
          }
        }}
      />
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <DeskHome />
    </AuthProvider>
  );
}
