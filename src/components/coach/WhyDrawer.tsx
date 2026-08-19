"use client";

import React from "react";
import { Sparkles, X, BookOpen, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";

export interface WhyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  ticker?: string;
  rationale: string;
  institutionalRule?: string;
  onOpenLearning?: () => void;
}

export const WhyDrawer: React.FC<WhyDrawerProps> = ({
  isOpen,
  onClose,
  title,
  ticker,
  rationale,
  institutionalRule,
  onOpenLearning,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-3xl border border-sky-500/20 bg-[#0E1320] p-6 sm:p-8 space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-400">
                Institutional Coach Insight
              </span>
              <h3 className="text-base font-semibold text-white">
                {title} {ticker ? `(${ticker})` : ""}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-white/[0.08] hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Rationale Breakdown */}
        <div className="space-y-3 text-xs leading-relaxed text-neutral-300">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase text-sky-400 block">
              Strategic &amp; Mathematical Rationale:
            </span>
            <p>{rationale}</p>
          </div>

          {institutionalRule && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 space-y-1.5">
              <span className="text-[11px] font-mono font-bold uppercase text-emerald-400 flex items-center space-x-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Prop Desk Rule:</span>
              </span>
              <p className="text-emerald-200/90">{institutionalRule}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          {onOpenLearning ? (
            <button
              onClick={() => {
                onClose();
                onOpenLearning();
              }}
              className="flex items-center space-x-1.5 text-xs text-sky-400 hover:underline font-mono"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Explore Learning Center Lesson</span>
            </button>
          ) : <div />}

          <button
            onClick={onClose}
            className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-900 shadow hover:bg-neutral-100 transition"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhyDrawer;
