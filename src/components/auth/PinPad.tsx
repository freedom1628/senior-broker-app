"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Delete, Sparkles, ShieldAlert } from "lucide-react";
import { playEntryTriggered } from "@/lib/audio/sound-effects";

interface PinPadProps {
  onComplete: (pin: string) => void;
  title?: string;
  subtitle?: string;
  error?: string | null;
  isLoading?: boolean;
  defaultPasscodeHint?: string; // e.g. "8888"
  showQuickDemoButton?: boolean;
}

export const PinPad: React.FC<PinPadProps> = ({
  onComplete,
  title = "Enter Desk PIN",
  subtitle = "4-digit security passcode",
  error,
  isLoading = false,
  defaultPasscodeHint = "8888",
  showQuickDemoButton = true,
}) => {
  const [pin, setPin] = useState<string>("");
  const [isShaking, setIsShaking] = useState<boolean>(false);

  // Trigger error shake animation and reset pin
  useEffect(() => {
    if (error) {
      setIsShaking(true);
      setPin("");
      const timer = setTimeout(() => setIsShaking(false), 500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleDigit = useCallback((digit: string) => {
    if (isLoading || pin.length >= 4) return;
    try {
      playEntryTriggered();
    } catch {}

    const nextPin = pin + digit;
    setPin(nextPin);
    if (nextPin.length === 4) {
      setTimeout(() => onComplete(nextPin), 150);
    }
  }, [pin, isLoading, onComplete]);

  const handleBackspace = useCallback(() => {
    if (isLoading || pin.length === 0) return;
    setPin((prev) => prev.slice(0, -1));
  }, [isLoading, pin]);

  const handleClear = useCallback(() => {
    if (isLoading) return;
    setPin("");
  }, [isLoading]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Escape") {
        handleClear();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDigit, handleBackspace, handleClear]);

  const fillDemoPin = () => {
    const targetPin = defaultPasscodeHint || "8888";
    setPin(targetPin);
    try {
      playEntryTriggered();
    } catch {}
    setTimeout(() => onComplete(targetPin), 150);
  };

  return (
    <div className="flex flex-col items-center space-y-6 w-full max-w-xs mx-auto">
      {/* Title & Subtitle */}
      <div className="text-center space-y-1">
        <h3 className="text-lg font-semibold text-white tracking-tight">{title}</h3>
        <p className="text-xs text-neutral-400 font-mono">{subtitle}</p>
      </div>

      {/* 4-Slot PIN Visual Display */}
      <div className={`flex items-center justify-center space-x-4 py-2 ${isShaking ? "animate-shake" : ""}`}>
        {[0, 1, 2, 3].map((index) => {
          const isFilled = pin.length > index;
          return (
            <div
              key={index}
              className={`h-4 w-4 rounded-full transition-all duration-200 ${
                isFilled
                  ? "bg-gradient-to-tr from-sky-400 to-emerald-400 scale-125 shadow-lg shadow-sky-500/50"
                  : error
                  ? "border-2 border-rose-500 bg-rose-500/20"
                  : "border border-white/20 bg-white/5"
              }`}
            />
          );
        })}
      </div>

      {/* Error / Feedback Message */}
      {error && (
        <div className="flex items-center space-x-2 text-xs text-rose-400 font-mono bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-1.5 animate-fadeIn">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Interactive 3x4 Numpad */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleDigit(digit)}
            disabled={isLoading || pin.length >= 4}
            className="flex h-14 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl font-mono font-semibold text-white shadow-sm hover:bg-white/[0.12] hover:border-white/20 active:scale-95 transition disabled:opacity-40"
          >
            {digit}
          </button>
        ))}

        {/* Clear Button */}
        <button
          type="button"
          onClick={handleClear}
          disabled={isLoading || pin.length === 0}
          className="flex h-14 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-xs font-mono text-neutral-400 hover:text-white hover:bg-white/[0.08] active:scale-95 transition disabled:opacity-30"
        >
          CLEAR
        </button>

        {/* '0' Digit */}
        <button
          type="button"
          onClick={() => handleDigit("0")}
          disabled={isLoading || pin.length >= 4}
          className="flex h-14 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl font-mono font-semibold text-white shadow-sm hover:bg-white/[0.12] hover:border-white/20 active:scale-95 transition disabled:opacity-40"
        >
          0
        </button>

        {/* Backspace Button */}
        <button
          type="button"
          onClick={handleBackspace}
          disabled={isLoading || pin.length === 0}
          className="flex h-14 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-neutral-400 hover:text-white hover:bg-white/[0.08] active:scale-95 transition disabled:opacity-30"
        >
          <Delete className="h-5 w-5" />
        </button>
      </div>

      {/* Quick 1-Click Demo Fill */}
      {showQuickDemoButton && (
        <button
          type="button"
          onClick={fillDemoPin}
          className="flex items-center space-x-1.5 text-xs text-sky-400 hover:text-sky-300 font-mono bg-sky-500/10 border border-sky-500/20 px-3 py-1.5 rounded-full hover:bg-sky-500/20 transition active:scale-95"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Quick Demo Unlock (PIN: {defaultPasscodeHint})</span>
        </button>
      )}
    </div>
  );
};
