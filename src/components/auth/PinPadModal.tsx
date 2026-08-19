"use client";

import React from "react";
import { X, ShieldCheck } from "lucide-react";
import { PinPad } from "./PinPad";

interface PinPadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (pin: string) => void;
  title?: string;
  subtitle?: string;
  error?: string | null;
  isLoading?: boolean;
}

export const PinPadModal: React.FC<PinPadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = "Authorize Action",
  subtitle = "Enter 4-digit PIN to confirm",
  error,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#0E131F] p-6 shadow-2xl space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-1.5 text-neutral-400 hover:bg-white/[0.08] hover:text-white transition"
        >
          <X className="h-4 w-4" />
        </button>

        <PinPad
          onComplete={onSuccess}
          title={title}
          subtitle={subtitle}
          error={error}
          isLoading={isLoading}
        />

        <div className="flex items-center justify-center space-x-1.5 text-[10px] text-neutral-500 font-mono pt-2 border-t border-white/[0.06]">
          <ShieldCheck className="h-3 w-3 text-emerald-400" />
          <span>Desk Security Protection</span>
        </div>
      </div>
    </div>
  );
};
