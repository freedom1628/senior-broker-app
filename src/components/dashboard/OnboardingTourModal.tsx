"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  Sparkles,
  ShieldCheck,
  GraduationCap,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
  Sliders,
  DollarSign,
  Clock,
  Layers,
} from "lucide-react";

interface OnboardingTourModalProps {
  isOpen: boolean;
  onClose: (dontShowAgain: boolean) => void;
}

export const OnboardingTourModal: React.FC<OnboardingTourModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(true);

  if (!isOpen) return null;

  const slides = [
    {
      badge: "Welcome to Senior Broker",
      title: "Your AI Swing Trading Coach",
      subtitle: "Dedicated to managing your agile swing sleeve (<1% of total wealth / $15,000 default)",
      icon: TrendingUp,
      color: "from-sky-500 to-indigo-600",
      content: (
        <div className="space-y-4 text-xs sm:text-sm text-neutral-300 leading-relaxed">
          <p>
            Senior Broker is not an ordinary stock tracker — it is an active <strong>risk desk coach</strong> built to guide and audit your short-to-medium term swing trades (holding 3 days to 4 weeks).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-3.5 space-y-1">
              <span className="font-mono font-bold text-sky-400 block">1. Dedicated $15k Sleeve</span>
              <p className="text-neutral-400 text-xs">Keeps your swing capital isolated from your long-term wealth.</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-3.5 space-y-1">
              <span className="font-mono font-bold text-emerald-400 block">2. Strict 1% Risk Rule</span>
              <p className="text-neutral-400 text-xs">Limits loss to $150 per idea so you survive any losing streak.</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      badge: "Step 1: Daily Guidance",
      title: "AI Coach Feed & 1-Click Actions",
      subtitle: "Real-time tactical intelligence on what to hold, scale, or cut",
      icon: Sparkles,
      color: "from-emerald-500 to-teal-600",
      content: (
        <div className="space-y-4 text-xs sm:text-sm text-neutral-300 leading-relaxed">
          <p>
            Every morning and throughout the trading day, the <strong>AI Coach Feed</strong> cross-checks your active holdings against live quotes and provides 1-click decisions:
          </p>
          <div className="space-y-2.5 pt-1 font-mono text-xs">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-start space-x-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Scale 50% at Target 1 ($2:1 R:R$):</strong>
                <p className="text-neutral-300 mt-0.5">Locks in +1.0R profit and automatically moves your stop to Breakeven for a risk-free 'Free Roll' on runners.</p>
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start space-x-2.5">
              <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Time-Stop Warnings:</strong>
                <p className="text-neutral-300 mt-0.5">Flags positions stalling for 5–7 sessions without follow-through so you can exit and free up buying power.</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      badge: "Step 2: Position Management",
      title: "Log Active & Historical Trades",
      subtitle: "Effortless position sizing and complete campaign history tracking",
      icon: Layers,
      color: "from-purple-500 to-indigo-600",
      content: (
        <div className="space-y-4 text-xs sm:text-sm text-neutral-300 leading-relaxed">
          <p>
            Click <strong>+ Add Position</strong> to track any trade. You can choose between:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
            <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-3 space-y-1">
              <span className="font-bold text-emerald-400 block font-mono">Active Position</span>
              <p className="text-neutral-400 text-[11px]">Currently open holding. Auto-calculates 1% risk position size.</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-3 space-y-1">
              <span className="font-bold text-sky-400 block font-mono">Pending Watch Order</span>
              <p className="text-neutral-400 text-[11px]">Triggers alert when breakout entry price is touched.</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-3 space-y-1">
              <span className="font-bold text-purple-400 block font-mono">Past Closed Move</span>
              <p className="text-neutral-400 text-[11px]">Log previous exits/stops to track win rate &amp; balance.</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      badge: "Step 3: Frontier Intelligence",
      title: "Multi-LLM Opportunity Screener",
      subtitle: "Discover high-conviction swing setups with consensus scoring",
      icon: Sliders,
      color: "from-blue-500 to-cyan-600",
      content: (
        <div className="space-y-4 text-xs sm:text-sm text-neutral-300 leading-relaxed">
          <p>
            Screen the market daily across <strong>Google Gemini 3.7 Flash</strong>, <strong>Claude Sonnet 5 / Opus</strong>, and <strong>OpenAI 5.6</strong>:
          </p>
          <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-3.5 space-y-2 text-xs">
            <div className="flex items-center space-x-2 text-sky-400 font-mono font-bold">
              <Sparkles className="h-4 w-4" />
              <span>1-Click Prompt Station</span>
            </div>
            <p className="text-neutral-300 text-[11px]">
              Copy the prop desk research prompt to run deep research in paid web chats, then paste the report to instantly generate visual price ladders and conviction scores.
            </p>
          </div>
        </div>
      ),
    },
    {
      badge: "Step 4: Investor Growth",
      title: "Learning Center & Strategy Mastery",
      subtitle: "Visual lessons and interactive risk sizing calculators",
      icon: GraduationCap,
      color: "from-amber-500 to-orange-600",
      content: (
        <div className="space-y-4 text-xs sm:text-sm text-neutral-300 leading-relaxed">
          <p>
            Master the mathematical edge in the <strong>Learning Center</strong>:
          </p>
          <ul className="space-y-2 text-xs text-neutral-300 list-disc list-inside">
            <li><strong>The 1% Math:</strong> How position sizing guarantees survival through 10-loss streaks.</li>
            <li><strong>Asymmetric 2:1 Scaling:</strong> The mechanics of the Free Roll equation.</li>
            <li><strong>Sizing Sandbox:</strong> Interactive simulator to test entry and stop levels before trading.</li>
          </ul>
        </div>
      ),
    },
  ];

  const slide = slides[currentSlide];
  const Icon = slide.icon;
  const isLast = currentSlide === slides.length - 1;

  const handleFinish = () => {
    onClose(dontShowAgain);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-2xl p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0C101A]/95 p-6 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
          <div className="flex items-center space-x-2.5">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr ${slide.color} shadow-md`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-sky-400">
                {slide.badge}
              </span>
              <div className="text-[10px] text-neutral-400 font-mono">
                Slide {currentSlide + 1} of {slides.length}
              </div>
            </div>
          </div>
          <button
            onClick={handleFinish}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-white/[0.08] hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Slide Body */}
        <div className="space-y-4 min-h-[220px]">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {slide.title}
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              {slide.subtitle}
            </p>
          </div>

          <div className="pt-2">
            {slide.content}
          </div>
        </div>

        {/* Slide Navigation & Progress Indicator */}
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-5">
          {/* Progress dots */}
          <div className="flex items-center space-x-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all ${
                  currentSlide === idx ? "w-6 bg-white" : "w-2 bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center space-x-2">
            {currentSlide > 0 && (
              <button
                type="button"
                onClick={() => setCurrentSlide((prev) => prev - 1)}
                className="flex items-center space-x-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-white/[0.08] transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
            )}

            {!isLast ? (
              <button
                type="button"
                onClick={() => setCurrentSlide((prev) => prev + 1)}
                className="flex items-center space-x-1.5 rounded-full bg-white px-5 py-2 text-xs font-semibold text-neutral-900 shadow hover:bg-neutral-100 transition active:scale-95"
              >
                <span>Next</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="flex items-center space-x-1.5 rounded-full bg-emerald-500 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition active:scale-95"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Enter Trading Desk</span>
              </button>
            )}
          </div>
        </div>

        {/* Don't show again toggle */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center space-x-2 text-[11px] text-neutral-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-0"
            />
            <span>Don't show this walkthrough automatically on launch</span>
          </label>
          <button
            onClick={handleFinish}
            className="text-[11px] text-neutral-500 hover:text-neutral-300 underline"
          >
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
};
