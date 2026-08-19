"use client";

import React, { useState } from "react";
import {
  GraduationCap,
  Calculator,
  TrendingUp,
  ShieldAlert,
  Clock,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  ArrowRight,
  BookOpen,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface LearningCenterProps {
  accountSize: number;
  riskPerTrade: number;
}

export const LearningCenter: React.FC<LearningCenterProps> = ({
  accountSize,
  riskPerTrade,
}) => {
  const [activeTab, setActiveTab] = useState<"LESSONS" | "CALCULATOR">("LESSONS");
  const [expandedLesson, setExpandedLesson] = useState<number | null>(0);

  // Calculator state
  const [calcEntry, setCalcEntry] = useState("100.00");
  const [calcStop, setCalcStop] = useState("95.00");
  const [calcCapital, setCalcCapital] = useState(accountSize.toString());
  const [calcRiskPct, setCalcRiskPct] = useState(riskPerTrade.toString());

  const capitalNum = parseFloat(calcCapital) || 15000;
  const riskPctNum = parseFloat(calcRiskPct) || 1.0;
  const entryNum = parseFloat(calcEntry) || 100;
  const stopNum = parseFloat(calcStop) || 95;

  const riskBudget = capitalNum * (riskPctNum / 100);
  const riskPerShare = Math.max(0.01, Math.abs(entryNum - stopNum));
  const calculatedShares = entryNum > stopNum ? Math.floor(riskBudget / riskPerShare) : 0;
  const totalAllocated = calculatedShares * entryNum;
  const target1 = entryNum + (2.0 * riskPerShare);
  const target2 = entryNum + (3.5 * riskPerShare);
  const t1GainPct = ((target1 - entryNum) / entryNum) * 100;
  const stopLossPct = ((entryNum - stopNum) / entryNum) * 100;

  const lessons = [
    {
      title: "1. The 1% Golden Risk Rule (The Mathematical Edge)",
      subtitle: "Why risking less than 1% ensures long-term account survival",
      tag: "Risk Management",
      icon: ShieldAlert,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-neutral-300">
          <p>
            Professional prop desk swing traders never risk more than <strong>1.0% of dedicated trading capital</strong> on any single idea (e.g. <strong>${(capitalNum * 0.01).toFixed(0)} on a ${capitalNum.toLocaleString()} sleeve</strong>).
          </p>
          <div className="rounded-xl border border-white/[0.08] bg-black/40 p-3.5 font-mono text-[11px] space-y-1">
            <div className="text-sky-400 font-bold">Position Size Formula:</div>
            <div>Shares = (Dedicated Capital × 0.01) ÷ |Entry Price - Hard Stop Loss|</div>
          </div>
          <p>
            <strong>Why this matters:</strong> If you experience an unexpected streak of 5 consecutive losses, your portfolio only dips ~4.9%, allowing you to recover fully on the next winning breakout. If you risk 10% per trade, a 5-loss streak causes a devastating -41% drawdown requiring an unrealistic +70% return just to break even.
          </p>
        </div>
      ),
    },
    {
      title: "2. The 50% Scale & 'Free Roll' Mechanism",
      subtitle: "Taking 50% profit at 2:1 R:R and trailing stop to Breakeven",
      tag: "Profit Taking",
      icon: TrendingUp,
      color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-neutral-300">
          <p>
            When a swing trade reaches <strong>Target 1</strong> ($R:R \ge 2.0$), the Senior Broker strategy strictly commands you to <strong>sell 50% of your shares</strong> and immediately adjust your stop loss to <strong>Breakeven ($Entry Price)</strong>.
          </p>
          <div className="rounded-xl border border-white/[0.08] bg-black/40 p-3.5 font-mono text-[11px] space-y-1">
            <div className="text-emerald-400 font-bold">The Free Roll Equation:</div>
            <div>1st Half Profit Locked: +1.0R (e.g. +$150)</div>
            <div>2nd Half Worst Case: $0.00 (Breakeven Exit)</div>
            <div>Net Trade Result: +0.5R minimum guaranteed profit with unlimited upside on Target 2 runners!</div>
          </div>
          <p>
            This eliminates emotional anxiety, protects accumulated gains, and finances your risk for future trades.
          </p>
        </div>
      ),
    },
    {
      title: "3. Time Stops vs. Price Stops (Opportunity Cost)",
      subtitle: "Why 5–7 sessions without follow-through warrants an exit",
      tag: "Capital Efficiency",
      icon: Clock,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-neutral-300">
          <p>
            A breakout or catalyst continuation should exhibit immediate follow-through momentum within <strong>3 to 5 trading sessions</strong>.
          </p>
          <p>
            If a stock chops sideways for <strong>5 to 7 sessions</strong> without moving toward Target 1, it indicates institutional buyers are not stepping in. Even if your hard stop loss was not hit, exiting stale positions frees up buying power to deploy into active high-velocity setups.
          </p>
        </div>
      ),
    },
    {
      title: "4. Dedicated Swing Sleeve Principle (<1% of Wealth)",
      subtitle: "Operating an autonomous, agile sleeve without endangering long-term assets",
      tag: "Portfolio Strategy",
      icon: Layers,
      color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-neutral-300">
          <p>
            This app is tailored for your <strong>dedicated swing trading sleeve ($15,000 default)</strong>, which represents less than 1% of your overall net worth.
          </p>
          <p>
            By segregating your swing trading capital from your long-term buy-and-hold index/retirement accounts, you can execute disciplined tactical moves (holding 3 days to 4 weeks) with high agility, zero leverage, and complete peace of mind.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0C101A]/80 p-6 backdrop-blur-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Investor Learning &amp; Concept Center
            </h2>
            <p className="text-xs text-neutral-400 font-mono">
              Master the mathematical edge, position sizing, and institutional trade rules
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex rounded-full bg-black/40 p-1 border border-white/[0.08]">
          <button
            onClick={() => setActiveTab("LESSONS")}
            className={`flex items-center space-x-2 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              activeTab === "LESSONS"
                ? "bg-white text-neutral-900 shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Core Lessons</span>
          </button>
          <button
            onClick={() => setActiveTab("CALCULATOR")}
            className={`flex items-center space-x-2 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              activeTab === "CALCULATOR"
                ? "bg-white text-neutral-900 shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Calculator className="h-3.5 w-3.5" />
            <span>Position Sizing Sandbox</span>
          </button>
        </div>
      </div>

      {/* TAB 1: LESSONS */}
      {activeTab === "LESSONS" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lessons.map((lesson, idx) => {
            const Icon = lesson.icon;
            const isExpanded = expandedLesson === idx;
            return (
              <div
                key={idx}
                className="rounded-3xl border border-white/[0.08] bg-[#0E121D]/90 p-5 backdrop-blur-xl shadow-md transition hover:border-white/20"
              >
                <div
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => setExpandedLesson(isExpanded ? null : idx)}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${lesson.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-400">
                          {lesson.tag}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-white mt-0.5">
                        {lesson.title}
                      </h3>
                      <p className="text-xs text-neutral-400">
                        {lesson.subtitle}
                      </p>
                    </div>
                  </div>
                  <button className="text-neutral-400 hover:text-white p-1">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-white/[0.06] animate-in fade-in duration-150">
                    {lesson.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: CALCULATOR SANDBOX */}
      {activeTab === "CALCULATOR" && (
        <div className="rounded-3xl border border-white/[0.08] bg-[#0E121D]/90 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center space-x-2">
                <Calculator className="h-5 w-5 text-emerald-400" />
                <span>Interactive Trade Risk &amp; Sizing Simulator</span>
              </h3>
              <p className="text-xs text-neutral-400">
                Test different entry and stop loss scenarios to observe mathematical position sizing
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                Dedicated Capital ($)
              </label>
              <input
                type="number"
                value={calcCapital}
                onChange={(e) => setCalcCapital(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                Risk Per Trade (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={calcRiskPct}
                onChange={(e) => setCalcRiskPct(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                Entry Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={calcEntry}
                onChange={(e) => setCalcEntry(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-rose-400 mb-1">
                Stop Loss Level ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={calcStop}
                onChange={(e) => setCalcStop(e.target.value)}
                className="w-full rounded-xl border border-rose-500/30 bg-black/50 px-3.5 py-2.5 font-mono text-sm text-rose-300 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Results Summary Box */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-2xl border border-white/[0.08] bg-black/40 p-5 font-mono text-xs">
            <div className="space-y-1">
              <span className="text-neutral-400 block uppercase">1. Calculated Shares</span>
              <span className="text-2xl font-bold text-emerald-400">{calculatedShares} shares</span>
              <p className="text-[11px] text-neutral-500">Capital: ${(totalAllocated).toLocaleString()} ({( (totalAllocated / capitalNum) * 100 ).toFixed(1)}% of sleeve)</p>
            </div>

            <div className="space-y-1">
              <span className="text-neutral-400 block uppercase">2. Max Dollar Risk</span>
              <span className="text-2xl font-bold text-amber-400">${(calculatedShares * riskPerShare).toFixed(2)}</span>
              <p className="text-[11px] text-neutral-500">{stopLossPct.toFixed(2)}% drop from entry to stop</p>
            </div>

            <div className="space-y-1">
              <span className="text-neutral-400 block uppercase">3. Target 1 (2:1 R:R)</span>
              <span className="text-2xl font-bold text-sky-400">${target1.toFixed(2)}</span>
              <p className="text-[11px] text-neutral-500">+{t1GainPct.toFixed(2)}% gain • Lock +${(calculatedShares * 0.5 * (target1 - entryNum)).toFixed(0)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
