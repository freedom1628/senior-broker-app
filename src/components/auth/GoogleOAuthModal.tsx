"use client";

import React, { useState } from "react";
import { X, Loader2, ShieldCheck, ArrowRight } from "lucide-react";
import { User } from "@/types/auth";

interface GoogleOAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAccount: (account: Partial<User>) => void;
}

export const GoogleOAuthModal: React.FC<GoogleOAuthModalProps> = ({
  isOpen,
  onClose,
  onSelectAccount,
}) => {
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  if (!isOpen) return null;

  const accounts = [
    {
      name: "Alex Jones",
      email: "alex.jones.trader@gmail.com",
      role: "Senior Swing Trader",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    },
    {
      name: "Senior Desk Fund",
      email: "desk.fund@seniorbroker.ai",
      role: "Institutional Account",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    },
  ];

  const handleChoose = (acc: { name: string; email: string; avatar: string }) => {
    setSelectedEmail(acc.email);
    setIsVerifying(true);
    setTimeout(() => {
      onSelectAccount({
        name: acc.name,
        email: acc.email,
        avatarUrl: acc.avatar,
      });
      setIsVerifying(false);
      onClose();
    }, 600);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail || !customEmail.includes("@")) return;
    setIsVerifying(true);
    setTimeout(() => {
      onSelectAccount({
        name: customName.trim() || customEmail.split("@")[0] + " (Google)",
        email: customEmail.trim().toLowerCase(),
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      });
      setIsVerifying(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0E121E] p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Google Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
          <div className="flex items-center space-x-3">
            <svg className="h-6 w-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.35 24 12 24z" />
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.97 0 12s.45 3.85 1.24 5.42l4.04-3.15z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-white">Sign in with Google</h3>
              <p className="text-[11px] text-neutral-400">to continue to Senior Broker</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-white/[0.08] hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Account Selector */}
        {isVerifying ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 text-sky-400 animate-spin" />
            <p className="text-xs text-neutral-300 font-mono">Verifying OAuth session &amp; unlocking desk...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-neutral-400 font-mono">Choose an account:</p>
            {accounts.map((acc) => (
              <button
                key={acc.email}
                onClick={() => handleChoose(acc)}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 transition text-left active:scale-[0.99]"
              >
                <div className="flex items-center space-x-3">
                  <img
                    src={acc.avatar}
                    alt={acc.name}
                    className="h-10 w-10 rounded-full object-cover border border-white/20"
                  />
                  <div>
                    <p className="text-xs font-semibold text-white">{acc.name}</p>
                    <p className="text-[11px] text-neutral-400 font-mono">{acc.email}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-neutral-500" />
              </button>
            ))}

            {/* Custom Google Account Input Toggle */}
            {!showCustomInput ? (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                className="w-full py-2.5 text-xs text-neutral-400 hover:text-white font-mono transition text-center"
              >
                + Use another Google account
              </button>
            ) : (
              <form onSubmit={handleCustomSubmit} className="space-y-2 pt-2 border-t border-white/[0.06]">
                <input
                  type="text"
                  placeholder="Your Name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
                <input
                  type="email"
                  required
                  placeholder="google.email@gmail.com"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-white text-neutral-900 font-semibold text-xs rounded-xl shadow hover:bg-neutral-100 transition"
                >
                  Continue with this account
                </button>
              </form>
            )}
          </div>
        )}

        <div className="flex items-center space-x-2 text-[11px] text-neutral-500 font-mono pt-2 border-t border-white/[0.06]">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span>Google Identity Services 256-bit Token Handshake</span>
        </div>
      </div>
    </div>
  );
};
