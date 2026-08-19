"use client";

import React from "react";
import {
  Sparkles,
  TrendingUp,
  Layers,
  GraduationCap,
  BookOpen,
  Sliders,
} from "lucide-react";
import { NavigationTab, NavigationBadgeCounts } from "@/types";

export interface TabNavigationProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  counts?: Partial<NavigationBadgeCounts>;
  className?: string;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onSelectTab,
  counts = {},
  className = "",
}) => {
  const tabs: {
    id: NavigationTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeCount?: number;
    badgeTone?: "emerald" | "sky" | "rose" | "amber";
  }[] = [
    {
      id: "COACH",
      label: "AI Coach Feed",
      icon: Sparkles,
      badgeCount: counts.highUrgencyMoves,
      badgeTone: "sky",
    },
    {
      id: "POSITIONS",
      label: "Positions",
      icon: TrendingUp,
      badgeCount: counts.activePositions,
      badgeTone: "emerald",
    },
    {
      id: "SCREENER",
      label: "AI Screener",
      icon: Layers,
      badgeCount: counts.candidateSetups,
      badgeTone: "sky",
    },
    {
      id: "LEARNING",
      label: "Learning Center",
      icon: GraduationCap,
    },
    {
      id: "JOURNAL",
      label: "Trade Journal",
      icon: BookOpen,
    },
    {
      id: "SETTINGS",
      label: "Settings & Risk",
      icon: Sliders,
    },
  ];

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="flex flex-wrap items-center rounded-full bg-[#0E131F]/90 p-1.5 border border-white/[0.08] shadow-2xl backdrop-blur-2xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`group relative flex items-center space-x-2 rounded-full px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-white text-neutral-900 shadow-md scale-[1.02]"
                  : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <Icon
                className={`h-4 w-4 transition-colors ${
                  isActive
                    ? "text-neutral-900"
                    : tab.id === "COACH"
                    ? "text-sky-400"
                    : tab.id === "POSITIONS"
                    ? "text-emerald-400"
                    : tab.id === "SCREENER"
                    ? "text-indigo-400"
                    : tab.id === "LEARNING"
                    ? "text-purple-400"
                    : tab.id === "JOURNAL"
                    ? "text-amber-400"
                    : "text-neutral-400"
                }`}
              />
              <span>{tab.label}</span>

              {tab.badgeCount !== undefined && tab.badgeCount > 0 && (
                <span
                  className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-mono font-bold ${
                    isActive
                      ? "bg-neutral-900 text-white"
                      : tab.badgeTone === "emerald"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                  }`}
                >
                  {tab.badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
