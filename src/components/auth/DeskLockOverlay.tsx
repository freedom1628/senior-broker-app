"use client";

import React, { useState } from "react";
import { Lock, LogOut, User as UserIcon } from "lucide-react";
import { PinPad } from "@/components/auth/PinPad";
import { useAuth } from "@/context/AuthContext";

export const DeskLockOverlay: React.FC = () => {
  const { currentUser, isLocked, unlockDesk, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isLocked) return null;

  const handlePinSubmit = async (pin: string) => {
    setLoading(true);
    setError(null);
    const res = await unlockDesk(pin);
    if (!res.success) {
      setError(res.error || "Incorrect PIN");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070A0F]/90 backdrop-blur-2xl p-4 animate-in fade-in duration-300">
      
      {/* Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-[#0C101A]/90 p-8 shadow-2xl space-y-6 text-center">
        
        {/* User Avatar & Lock Icon */}
        <div className="relative mx-auto h-20 w-20">
          {currentUser?.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              className="h-20 w-20 rounded-full object-cover border-2 border-sky-500/50 shadow-lg shadow-sky-500/20"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.08] border border-white/20 text-white">
              <UserIcon className="h-8 w-8" />
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-black shadow-md">
            <Lock className="h-4 w-4 stroke-[2.5]" />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">{currentUser?.name || "Senior Trader"}</h2>
          <p className="text-xs text-neutral-400 font-mono">{currentUser?.email || "trader@broker.com"}</p>
        </div>

        {/* Numpad */}
        <PinPad
          onComplete={handlePinSubmit}
          title="Desk Locked"
          subtitle="Enter 4-digit PIN to resume trading session"
          error={error}
          isLoading={loading}
          defaultPasscodeHint="8888"
          showQuickDemoButton={true}
        />

        {/* Switch User / Logout */}
        <div className="pt-2 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={logout}
            className="flex items-center justify-center space-x-1.5 text-xs text-neutral-400 hover:text-rose-400 font-mono transition mx-auto"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Switch Trader Account / Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
