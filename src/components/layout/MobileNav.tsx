"use client";

import React from "react";
import {
  Sparkles,
  TrendingUp,
  Layers,
  GraduationCap,
  BookOpen,
  Plus,
  Sliders,
} from "lucide-react";
import { NavigationTab, NavigationBadgeCounts } from "@/types";

export interface MobileNavProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  counts?: Partial<NavigationBadgeCounts>;
  onOpenAddTrade?: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onSelectTab,
  counts = {},
  onOpenAddTrade,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden border-t border-white/[0.08] bg-[#070A0F]/95 backdrop-blur-2xl px-2 py-1.5 shadow-2xl safe-area-bottom">
      <div className="flex items-center justify-around">
        {/* Coach */}
        <button
          type="button"
          onClick={() => onSelectTab("COACH")}
          className={`flex flex-col items-center justify-center p-1.5 transition ${
            activeTab === "COACH" ? "text-sky-400 font-semibold" : "text-neutral-400 hover:text-white"
          }`}
        >
          <Sparkles className="h-5 w-5" />
          <span className="text-[10px] mt-0.5">Coach</span>
        </button>

        {/* Positions */}
        <button
          type="button"
          onClick={() => onSelectTab("POSITIONS")}
          className={`relative flex flex-col items-center justify-center p-1.5 transition ${
            activeTab === "POSITIONS" ? "text-emerald-400 font-semibold" : "text-neutral-400 hover:text-white"
          }`}
        >
          <TrendingUp className="h-5 w-5" />
          <span className="text-[10px] mt-0.5">Trades</span>
          {counts.activePositions !== undefined && counts.activePositions > 0 && (
            <span className="absolute top-0.5 right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white px-0.5">
              {counts.activePositions}
            </span>
          )}
        </button>

        {/* Center Elevated Add Button */}
        {onOpenAddTrade && (
          <button
            type="button"
            onClick={onOpenAddTrade}
            className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 active:scale-95 transition"
            aria-label="Add Trade"
          >
            <Plus className="h-6 w-6 stroke-[3]" />
          </button>
        )}

        {/* Screener */}
        <button
          type="button"
          onClick={() => onSelectTab("SCREENER")}
          className={`flex flex-col items-center justify-center p-1.5 transition ${
            activeTab === "SCREENER" ? "text-indigo-400 font-semibold" : "text-neutral-400 hover:text-white"
          }`}
        >
          <Layers className="h-5 w-5" />
          <span className="text-[10px] mt-0.5">Screener</span>
        </button>

        {/* Journal */}
        <button
          type="button"
          onClick={() => onSelectTab("JOURNAL")}
          className={`flex flex-col items-center justify-center p-1.5 transition ${
            activeTab === "JOURNAL" ? "text-amber-400 font-semibold" : "text-neutral-400 hover:text-white"
          }`}
        >
          <BookOpen className="h-5 w-5" />
          <span className="text-[10px] mt-0.5">Journal</span>
        </button>

        {/* Settings / Learning Menu */}
        <button
          type="button"
          onClick={() => onSelectTab("SETTINGS")}
          className={`flex flex-col items-center justify-center p-1.5 transition ${
            activeTab === "SETTINGS" ? "text-white font-semibold" : "text-neutral-400 hover:text-white"
          }`}
        >
          <Sliders className="h-5 w-5" />
          <span className="text-[10px] mt-0.5">Settings</span>
        </button>
      </div>
    </nav>
  );
};
