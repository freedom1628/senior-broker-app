"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

export interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  maxHeight?: string;
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  maxHeight = "max-h-[90vh]",
}) => {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xl p-0 sm:p-4 animate-in fade-in duration-200">
      
      {/* Backdrop tap to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Sheet Container */}
      <div
        className={`relative z-10 w-full max-w-xl rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0E131F] p-6 shadow-2xl space-y-4 overflow-y-auto ${maxHeight} animate-in slide-in-from-bottom duration-300`}
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20 sm:hidden -mt-2 mb-2" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center space-x-2.5">
            {Icon && (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-sky-400">
                <Icon className="h-4 w-4" />
              </div>
            )}
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">{title}</h3>
              {subtitle && <p className="text-xs text-neutral-400 font-mono">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-white/[0.08] hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sheet Content */}
        <div className="pt-2">{children}</div>
      </div>
    </div>
  );
};
