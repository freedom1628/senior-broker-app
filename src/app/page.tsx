"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { RegimeBanner } from "@/components/dashboard/RegimeBanner";
import { MultiModelCompare } from "@/components/dashboard/MultiModelCompare";
import { ActiveTradesPanel } from "@/components/dashboard/ActiveTradesPanel";
import { TradeJournal } from "@/components/dashboard/TradeJournal";
import { DailyReportPanel } from "@/components/dashboard/DailyReportPanel";
import { ImportModal } from "@/components/dashboard/ImportModal";
import { SettingsModal } from "@/components/dashboard/SettingsModal";
import { AddTradeModal } from "@/components/dashboard/AddTradeModal";
import { NotificationCenter } from "@/components/dashboard/NotificationCenter";
import { SignInView } from "@/components/auth/SignInView";
import { triggerNotificationAlert } from "@/lib/notifications/notification-service";
import {
  Sparkles,
  TrendingUp,
  BookOpen,
  FileText,
  Layers,
  Activity,
  ShieldCheck,
  RefreshCw,
  LogOut,
  Plus,
} from "lucide-react";

export default function Home() {
  // Authentication State — Defaults to false for security
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<{ email: string; name: string } | null>(null);

  // Check cached session on mount
  useEffect(() => {
    const cachedAuth = localStorage.getItem("senior_broker_auth");
    const cachedUser = localStorage.getItem("senior_broker_user");
    if (cachedAuth === "true" && cachedUser) {
      try {
        setCurrentUser(JSON.parse(cachedUser));
        setIsAuthenticated(true);
      } catch (e) {
        setIsAuthenticated(false);
      }
    }
  }, []);

  // App Navigation State
  const [activeTab, setActiveTab] = useState<"REPORT" | "RESEARCH" | "TRADES" | "JOURNAL">("REPORT");
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
  const [accountSize, setAccountSize] = useState<number>(10000);
  const [riskPerTrade, setRiskPerTrade] = useState<number>(1.0);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  // Modals
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddTradeOpen, setIsAddTradeOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

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
        setAccountSize(data.user.accountSize || 10000);
        setRiskPerTrade(data.user.riskPerTrade || 1.0);
      }
    } catch (err) {
      console.error("Error loading research:", err);
    }
  }, []);

  // 2. Fetch Trades Data
  const loadTrades = useCallback(async () => {
    try {
      const res = await fetch("/api/trades");
      const data = await res.json();
      if (data.trades) {
        setActiveTrades(data.activeTrades || []);
        setPendingTrades(data.pendingTrades || []);
        setClosedTrades(data.closedTrades || []);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch (err) {
      console.error("Error loading trades:", err);
    }
  }, []);

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

  // Handle Sign Out
  const handleSignOut = () => {
    localStorage.removeItem("senior_broker_auth");
    localStorage.removeItem("senior_broker_user");
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  // If not authenticated, render Sign In View
  if (!isAuthenticated) {
    return (
      <SignInView
        onAuthenticated={(u) => {
          localStorage.setItem("senior_broker_auth", "true");
          localStorage.setItem("senior_broker_user", JSON.stringify(u));
          setCurrentUser(u);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  // Promote Candidate Setup to Trade
  const handlePromoteToTrade = async (setup: any, mode: "PENDING_ENTRY" | "ACTIVE") => {
    try {
      const res = await fetch("/api/trades", {
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

      const data = await res.json();
      if (data.success) {
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
        setActiveTab("TRADES");
      }
    } catch (err) {
      console.error("Error promoting setup to trade:", err);
    }
  };

  // Scale 50% at Target 1
  const handleScaleT1 = async (tradeId: string, fillPrice?: number) => {
    try {
      const res = await fetch("/api/trades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeId,
          action: "SCALE_T1",
          fillPrice,
        }),
      });
      const data = await res.json();
      if (data.success) {
        triggerNotificationAlert({
          ticker: data.trade.ticker,
          type: "TARGET_1_HIT",
          title: `T1 Scaled: ${data.trade.ticker}`,
          message: `Took 50% profit. Stop Loss moved strictly to Breakeven ($${data.trade.currentStop.toFixed(2)}).`,
        });
        loadTrades();
        loadDailyReport();
      }
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
      const res = await fetch("/api/trades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeId,
          action: "CLOSE_TRADE",
          exitReason,
          closePrice,
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadTrades();
        loadDailyReport();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Activate Pending Trade
  const handleActivatePending = async (tradeId: string, fillPrice?: number) => {
    try {
      const res = await fetch("/api/trades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeId,
          action: "ACTIVATE",
          fillPrice,
        }),
      });
      const data = await res.json();
      if (data.success) {
        triggerNotificationAlert({
          ticker: data.trade.ticker,
          type: "ENTRY_TRIGGERED",
          title: `Trade Filled: ${data.trade.ticker}`,
          message: `Order filled at $${(fillPrice || data.trade.entryTrigger).toFixed(2)}. Hard stop active.`,
        });
        loadTrades();
        loadDailyReport();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Trade
  const handleDeleteTrade = async (tradeId: string) => {
    try {
      await fetch(`/api/trades?id=${tradeId}`, { method: "DELETE" });
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

  const unreadAlertsCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-[#070A0F] text-slate-100 flex flex-col">
      
      {/* Header */}
      <Header
        onOpenImport={() => setIsImportOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAddTrade={() => setIsAddTradeOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onSignOut={handleSignOut}
        unreadAlertsCount={unreadAlertsCount}
        marketQuotes={marketQuotes}
        onRefreshQuotes={pollMarketData}
        isPolling={isPolling}
        accountSize={accountSize}
        riskPerTrade={riskPerTrade}
        currentUser={currentUser}
      />

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Navigation Tabs (Apple-style pill segmented control) */}
        <div className="flex items-center justify-center">
          <div className="flex flex-wrap rounded-full bg-[#0E131F] p-1.5 border border-white/[0.08] shadow-lg backdrop-blur-2xl">
            
            <button
              onClick={() => setActiveTab("REPORT")}
              className={`flex items-center space-x-2 rounded-full px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold transition ${
                activeTab === "REPORT"
                  ? "bg-white text-neutral-900 shadow-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <FileText className="h-4 w-4 text-sky-500" />
              <span>Daily Moves To Consider</span>
            </button>

            <button
              onClick={() => setActiveTab("RESEARCH")}
              className={`flex items-center space-x-2 rounded-full px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold transition ${
                activeTab === "RESEARCH"
                  ? "bg-white text-neutral-900 shadow-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span>Multi-AI Deep Research</span>
            </button>

            <button
              onClick={() => setActiveTab("TRADES")}
              className={`flex items-center space-x-2 rounded-full px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold transition ${
                activeTab === "TRADES"
                  ? "bg-white text-neutral-900 shadow-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span>Positions ({activeTrades.length + pendingTrades.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("JOURNAL")}
              className={`flex items-center space-x-2 rounded-full px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold transition ${
                activeTab === "JOURNAL"
                  ? "bg-white text-neutral-900 shadow-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <BookOpen className="h-4 w-4 text-purple-400" />
              <span>Journal</span>
            </button>
          </div>
        </div>

        {/* TAB 1: DAILY REPORT */}
        {activeTab === "REPORT" && (
          <DailyReportPanel
            report={dailyReport}
            onRefreshReport={() => {
              loadDailyReport();
              pollMarketData();
            }}
            onNavigateToTrades={() => setActiveTab("TRADES")}
            onOpenAddTrade={() => setIsAddTradeOpen(true)}
            onOpenImport={() => setIsImportOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        {/* TAB 2: RESEARCH */}
        {activeTab === "RESEARCH" && (
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

        {/* TAB 3: LIVE TRADES & WATCHLIST */}
        {activeTab === "TRADES" && (
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

        {/* TAB 4: JOURNAL & ANALYTICS */}
        {activeTab === "JOURNAL" && (
          <div className="animate-in fade-in duration-200">
            <TradeJournal
              closedTrades={closedTrades}
              metrics={metrics}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      <AddTradeModal
        isOpen={isAddTradeOpen}
        onClose={() => setIsAddTradeOpen(false)}
        onTradeAdded={() => {
          loadTrades();
          loadDailyReport();
          setActiveTab("TRADES");
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
      />

      <NotificationCenter
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllNotificationsRead}
      />
    </div>
  );
}
