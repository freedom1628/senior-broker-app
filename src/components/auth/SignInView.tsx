"use client";

import React, { useState } from "react";
import { TrendingUp, ShieldCheck, Key, User as UserIcon, Mail, Lock, Sparkles, CheckCircle2 } from "lucide-react";
import { PinPad } from "./PinPad";
import { GoogleOAuthModal } from "./GoogleOAuthModal";
import { useAuth } from "@/context/AuthContext";
import { User } from "@/types/auth";

interface SignInViewProps {
  onAuthenticated?: (user: { email: string; name: string }) => void;
}

export const SignInView: React.FC<SignInViewProps> = ({ onAuthenticated }) => {
  const { loginWithPin, loginWithGoogle, registerDeskAccount, error: authError, clearError } = useAuth();

  const [activeMode, setActiveMode] = useState<"PIN" | "REGISTER">("PIN");
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form fields for registration
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPin, setRegPin] = useState("");
  const [regConfirmPin, setRegConfirmPin] = useState("");

  const effectiveError = localError || authError;

  // Handle PIN Login from PinPad
  const handlePinSubmit = async (pin: string) => {
    setIsLoading(true);
    setLocalError(null);
    clearError();

    const res = await loginWithPin(pin);
    setIsLoading(false);

    if (res.success) {
      if (onAuthenticated) {
        onAuthenticated({
          email: pin === "8888" ? "alex.jones.trader@gmail.com" : "trader@broker.com",
          name: pin === "8888" ? "Alex Jones (Swing Desk)" : "Senior Desk Trader",
        });
      }
    } else {
      setLocalError(res.error || "Invalid PIN. Try default: 8888 or 1234");
    }
  };

  // Handle Google OAuth Selected Account
  const handleGoogleAccountSelected = async (account: Partial<User>) => {
    setIsLoading(true);
    setLocalError(null);
    clearError();

    const res = await loginWithGoogle(account);
    setIsLoading(false);

    if (res.success) {
      if (onAuthenticated) {
        onAuthenticated({
          email: account.email || "alex.jones.trader@gmail.com",
          name: account.name || "Alex Jones",
        });
      }
    } else {
      setLocalError(res.error || "Google authentication failed");
    }
  };

  // Handle Account Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!regEmail.includes("@")) {
      setLocalError("Please enter a valid email address.");
      return;
    }
    if (regPin.length < 4) {
      setLocalError("Passcode must be at least 4 digits.");
      return;
    }
    if (regPin !== regConfirmPin) {
      setLocalError("Passcodes do not match.");
      return;
    }

    setIsLoading(true);
    const res = await registerDeskAccount(regName, regEmail, regPin);
    setIsLoading(false);

    if (res.success) {
      setSuccessMsg("Desk account registered! Unlocking terminal...");
      if (onAuthenticated) {
        onAuthenticated({
          email: regEmail.toLowerCase().trim(),
          name: regName.trim() || "Senior Trader",
        });
      }
    } else {
      setLocalError(res.error || "Registration failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#070A0F] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-sky-500/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      {/* Main Glass Card */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-[#0C101A]/85 p-8 sm:p-10 backdrop-blur-2xl shadow-2xl space-y-6">
        
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/25">
            <TrendingUp className="h-7 w-7 text-white stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Senior Broker
          </h1>
          <p className="text-xs text-neutral-400 font-mono">
            Multi-AI Swing Trading Platform • Secure Terminal
          </p>
        </div>

        {/* Google 1-Click Fast Access Button */}
        <button
          type="button"
          onClick={() => setIsGoogleModalOpen(true)}
          disabled={isLoading}
          className="w-full flex items-center justify-center space-x-3 rounded-2xl bg-white py-3.5 text-xs font-semibold text-neutral-900 shadow hover:bg-neutral-100 transition active:scale-95 disabled:opacity-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.35 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.97 0 12s.45 3.85 1.24 5.42l4.04-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="flex items-center space-x-3 text-xs text-neutral-500 font-mono">
          <div className="flex-1 h-px bg-white/10" />
          <span>OR DESK PIN / PASSCODE</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Mode Selector (PIN Pad vs Create Passcode) */}
        <div className="flex rounded-2xl bg-black/50 p-1 border border-white/[0.08]">
          <button
            type="button"
            onClick={() => {
              setActiveMode("PIN");
              setLocalError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
              activeMode === "PIN"
                ? "bg-white text-neutral-900 shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            4-Digit PIN
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveMode("REGISTER");
              setLocalError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
              activeMode === "REGISTER"
                ? "bg-white text-neutral-900 shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* PIN Pad Mode */}
        {activeMode === "PIN" && (
          <div className="pt-1">
            <PinPad
              onComplete={handlePinSubmit}
              title="Unlock Trading Desk"
              subtitle="Enter 4-digit PIN (default: 8888 or 1234)"
              error={effectiveError}
              isLoading={isLoading}
              defaultPasscodeHint="8888"
              showQuickDemoButton={true}
            />
          </div>
        )}

        {/* Registration Form Mode */}
        {activeMode === "REGISTER" && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                Your Name / Trader Handle
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-3 h-4 w-4 text-neutral-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Jones"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 pl-10 pr-3.5 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                Trading Email *
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-neutral-500" />
                <input
                  type="email"
                  required
                  placeholder="your.email@gmail.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 pl-10 pr-3.5 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                Create 4-Digit PIN *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-neutral-500" />
                <input
                  type="password"
                  required
                  maxLength={6}
                  placeholder="••••"
                  value={regPin}
                  onChange={(e) => setRegPin(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 pl-10 pr-3.5 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
                Confirm PIN *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-neutral-500" />
                <input
                  type="password"
                  required
                  maxLength={6}
                  placeholder="••••"
                  value={regConfirmPin}
                  onChange={(e) => setRegConfirmPin(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 pl-10 pr-3.5 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {effectiveError && (
              <p className="text-xs text-rose-400 font-mono bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5">
                {effectiveError}
              </p>
            )}

            {successMsg && (
              <p className="text-xs text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-white/[0.08] border border-white/10 py-3.5 text-xs font-semibold text-white hover:bg-white/[0.14] transition active:scale-95 disabled:opacity-50"
            >
              <Key className="h-3.5 w-3.5 text-sky-400" />
              <span>Create Account &amp; Unlock Desk</span>
            </button>
          </form>
        )}

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 flex items-center space-x-2.5 text-[11px] text-neutral-400 font-mono">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Sessions are protected with client-side encryption.</span>
        </div>
      </div>

      {/* Google OAuth Modal */}
      <GoogleOAuthModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        onSelectAccount={handleGoogleAccountSelected}
      />
    </div>
  );
};
