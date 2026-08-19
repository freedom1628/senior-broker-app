"use client";

import React from "react";
import {
  Bell,
  CheckCheck,
  X,
  Volume2,
  TrendingUp,
  ShieldAlert,
  Clock,
  Sparkles,
} from "lucide-react";
import { playTargetChime, playStopLossAlert, playEntryTriggered } from "@/lib/audio/sound-effects";
import { requestPushPermission } from "@/lib/notifications/notification-service";

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: any[];
  onMarkAllRead: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md h-full bg-[#0E121D] border-l border-white/10 p-6 flex flex-col justify-between shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div>
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <div className="flex items-center space-x-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]">
                <Bell className="h-4 w-4 text-sky-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Notifications &amp; Alerts</h3>
                <span className="text-xs text-neutral-400 font-mono">
                  {notifications.filter(n => !n.isRead).length} unread alerts
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={onMarkAllRead}
                title="Mark all as read"
                className="rounded-full p-1.5 text-neutral-400 hover:bg-white/[0.08] hover:text-white transition"
              >
                <CheckCheck className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-neutral-400 hover:bg-white/[0.08] hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Sound Testing & Permissions Strip */}
          <div className="my-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-neutral-400">
                Audio Chimes (Apple Web Audio)
              </span>
              <button
                onClick={requestPushPermission}
                className="text-[11px] text-sky-400 hover:underline font-mono"
              >
                Enable Push
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={playTargetChime}
                className="flex-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 py-1.5 text-[11px] font-mono text-emerald-300 hover:bg-emerald-500/20 transition active:scale-95"
              >
                Test T1 Chime
              </button>
              <button
                onClick={playStopLossAlert}
                className="flex-1 rounded-xl bg-rose-500/10 border border-rose-500/20 py-1.5 text-[11px] font-mono text-rose-300 hover:bg-rose-500/20 transition active:scale-95"
              >
                Test Stop Warning
              </button>
              <button
                onClick={playEntryTriggered}
                className="flex-1 rounded-xl bg-sky-500/10 border border-sky-500/20 py-1.5 text-[11px] font-mono text-sky-300 hover:bg-sky-500/20 transition active:scale-95"
              >
                Test Entry Ping
              </button>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto space-y-3 my-2 pr-1">
          {notifications.length === 0 ? (
            <div className="py-20 text-center text-neutral-500 text-xs">
              No recent notifications
            </div>
          ) : (
            notifications.map((n) => {
              const isTarget = n.type.includes("TARGET");
              const isStop = n.type.includes("STOP");
              const isEntry = n.type.includes("ENTRY");

              return (
                <div
                  key={n.id}
                  className={`rounded-2xl border p-4 transition ${
                    n.isRead
                      ? "border-white/[0.04] bg-white/[0.01] opacity-75"
                      : "border-white/[0.1] bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                        isTarget
                          ? "bg-emerald-500/20 text-emerald-400"
                          : isStop
                          ? "bg-rose-500/20 text-rose-400"
                          : "bg-sky-500/20 text-sky-400"
                      }`}
                    >
                      {isTarget && <TrendingUp className="h-4 w-4" />}
                      {isStop && <ShieldAlert className="h-4 w-4" />}
                      {isEntry && <Sparkles className="h-4 w-4" />}
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">
                          {n.title}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-300 leading-relaxed">
                        {n.message}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/[0.06] text-center">
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-white/[0.06] py-2.5 text-xs font-semibold text-white hover:bg-white/[0.1] transition"
          >
            Close Notification Drawer
          </button>
        </div>
      </div>
    </div>
  );
};
