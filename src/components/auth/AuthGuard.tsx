"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { Lock } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requiredRole?: "SENIOR_TRADER" | "DESK_ANALYST" | "OBSERVER";
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  fallback,
}) => {
  const { isAuthenticated, isLocked, lockDesk } = useAuth();

  if (!isAuthenticated || isLocked) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-center space-y-3">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
          <Lock className="h-5 w-5" />
        </div>
        <h4 className="text-sm font-semibold text-white">Desk Authentication Required</h4>
        <p className="text-xs text-neutral-400 font-mono">Unlock your desk to access trade execution and risk parameters.</p>
        <button
          onClick={lockDesk}
          className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-neutral-900 shadow hover:bg-neutral-100 transition"
        >
          Unlock Desk
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
