"use client";

import React, { useState } from "react";
import { TrendingUp, ShieldCheck, Lock, ArrowRight, Sparkles, Key } from "lucide-react";

interface SignInViewProps {
  onAuthenticated: (user: { email: string; name: string }) => void;
}

export const SignInView: React.FC<SignInViewProps> = ({ onAuthenticated }) => {
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleSignIn = () => {
    setLoading(true);
    // In production with NEXTAUTH configured, this redirects to Google OAuth:
    // signIn("google")
    setTimeout(() => {
      onAuthenticated({
        email: "trader@broker.com",
        name: "Senior Desk Trader",
      });
      setLoading(false);
    }, 600);
  };

  const handlePasscodeSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please provide your trading desk email.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      onAuthenticated({
        email,
        name: email.split("@")[0].toUpperCase() + " Trader",
      });
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#070A0F] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-sky-500/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      {/* Main Glass Sign-In Card */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-[#0C101A]/80 p-8 sm:p-10 backdrop-blur-2xl shadow-2xl space-y-6">
        
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

        {/* Security Notice */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 flex items-center space-x-3 text-xs text-neutral-300">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Server session encrypted. Sensitive trade and API data protected.</span>
        </div>

        {/* Google OAuth Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center space-x-3 rounded-2xl bg-white py-3.5 text-sm font-semibold text-neutral-900 shadow hover:bg-neutral-100 transition active:scale-95 disabled:opacity-50"
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
          <span>OR DESK PASSKEY</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Passkey / Direct Desk Login */}
        <form onSubmit={handlePasscodeSignIn} className="space-y-3.5">
          <div>
            <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
              Trader Email / Desk ID
            </label>
            <input
              type="email"
              placeholder="trader@broker.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">
              Security PIN / Passcode
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 font-mono">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 rounded-xl bg-white/[0.08] border border-white/10 py-3 text-xs font-semibold text-white hover:bg-white/[0.14] transition active:scale-95"
          >
            <Lock className="h-3.5 w-3.5 text-sky-400" />
            <span>Authenticate Trader Session</span>
          </button>
        </form>

        <p className="text-[11px] text-center text-neutral-500 font-mono">
          Proprietary Trading Desk Protocol • Long-Only Risk Engine
        </p>
      </div>
    </div>
  );
};
