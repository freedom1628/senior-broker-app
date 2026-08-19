"use client";

import React, { useState } from "react";
import { Trade } from "@/lib/storage/types";
import { X, Download, FileText, Check, Copy, FileSpreadsheet, Code } from "lucide-react";

export interface JournalExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  closedTrades: Trade[];
  accountSize?: number;
}

export const JournalExportModal: React.FC<JournalExportModalProps> = ({
  isOpen,
  onClose,
  closedTrades = [],
  accountSize = 15000,
}) => {
  const [copiedMd, setCopiedMd] = useState(false);

  if (!isOpen) return null;

  // Export 1: CSV
  const handleDownloadCSV = () => {
    const headers = [
      "Ticker",
      "CompanyName",
      "SetupType",
      "EntryPrice",
      "InitialStop",
      "ClosedPrice",
      "SharesTotal",
      "RealizedPnL",
      "RMultiple",
      "SessionsElapsed",
      "ExitReason",
      "ClosedDate",
      "Notes",
    ];

    const rows = closedTrades.map((t) => [
      t.ticker,
      `"${t.companyName.replace(/"/g, '""')}"`,
      `"${t.setupType || "Swing"}"`,
      t.actualEntry || t.entryTrigger,
      t.initialStop,
      t.closedPrice || t.actualEntry || t.entryTrigger,
      t.sharesTotal,
      t.realizedPnL || 0,
      t.rMultiple || 0,
      t.sessionsElapsed || 0,
      `"${t.exitReason || "CLOSED"}"`,
      `"${t.closedDate || t.createdAt || ""}"`,
      `"${(t.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `senior_broker_trade_journal_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export 2: JSON Snapshot
  const handleDownloadJSON = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            accountSize,
            totalTrades: closedTrades.length,
            trades: closedTrades,
          },
          null,
          2
        )
      );
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `senior_broker_journal_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export 3: Markdown Format
  const handleCopyMarkdown = () => {
    const totalPnL = closedTrades.reduce((acc, t) => acc + (t.realizedPnL || 0), 0);
    const wins = closedTrades.filter((t) => (t.realizedPnL || 0) > 0).length;
    const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;
    const avgR = closedTrades.length > 0 ? closedTrades.reduce((acc, t) => acc + (t.rMultiple || 0), 0) / closedTrades.length : 0;

    const lines: string[] = [];
    lines.push(`# Senior Broker — Closed Swing Trade Journal`);
    lines.push(`**Exported:** ${new Date().toUTCString()}`);
    lines.push(`**Total Campaigns:** ${closedTrades.length} | **Win Rate:** ${winRate.toFixed(1)}% | **Realized P&L:** $${totalPnL.toFixed(2)} | **Avg R:** +${avgR.toFixed(2)}R`);
    lines.push(``);
    lines.push(`| Ticker | Setup | Fill | Stop | Exit | Realized P&L | R-Multiple | Sessions | Reason |`);
    lines.push(`|---|---|---|---|---|---|---|---|---|`);

    closedTrades.forEach((t) => {
      const entry = t.actualEntry || t.entryTrigger;
      const exit = t.closedPrice || entry;
      lines.push(
        `| **${t.ticker}** | ${t.setupType || "Swing"} | $${entry.toFixed(2)} | $${t.initialStop.toFixed(2)} | $${exit.toFixed(2)} | ${
          (t.realizedPnL || 0) >= 0 ? "+" : ""
        }$${(t.realizedPnL || 0).toFixed(2)} | ${
          t.rMultiple ? `+${t.rMultiple.toFixed(2)}R` : "--"
        } | ${t.sessionsElapsed || 0}s | ${t.exitReason || "CLOSED"} |`
      );
    });

    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0E1322] p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center space-x-2.5">
            <Download className="h-5 w-5 text-sky-400" />
            <h3 className="text-base font-semibold text-white">
              Export Swing Trade Journal
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-white/[0.08] hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-neutral-300">
          Export {closedTrades.length} historical swing campaigns for external analysis, spreadsheet logging, or note-taking archives.
        </p>

        <div className="space-y-2.5">
          {/* Option 1: CSV */}
          <button
            type="button"
            onClick={handleDownloadCSV}
            className="w-full flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-xs hover:bg-white/[0.06] transition text-left group"
          >
            <div className="flex items-center space-x-3">
              <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
              <div>
                <div className="font-semibold text-white group-hover:text-emerald-300">Download CSV Spreadsheet</div>
                <div className="text-[11px] text-neutral-400">Excel, Google Sheets &amp; Numbers format</div>
              </div>
            </div>
            <Download className="h-4 w-4 text-neutral-400 group-hover:text-white" />
          </button>

          {/* Option 2: JSON Snapshot */}
          <button
            type="button"
            onClick={handleDownloadJSON}
            className="w-full flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-xs hover:bg-white/[0.06] transition text-left group"
          >
            <div className="flex items-center space-x-3">
              <Code className="h-5 w-5 text-purple-400" />
              <div>
                <div className="font-semibold text-white group-hover:text-purple-300">Download JSON Data Snapshot</div>
                <div className="text-[11px] text-neutral-400">Complete raw structured trade object backup</div>
              </div>
            </div>
            <Download className="h-4 w-4 text-neutral-400 group-hover:text-white" />
          </button>

          {/* Option 3: Markdown Copy */}
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="w-full flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-xs hover:bg-white/[0.06] transition text-left group"
          >
            <div className="flex items-center space-x-3">
              <FileText className="h-5 w-5 text-sky-400" />
              <div>
                <div className="font-semibold text-white group-hover:text-sky-300">Copy Formatted Markdown</div>
                <div className="text-[11px] text-neutral-400">Formatted for Obsidian, Notion &amp; Apple Notes</div>
              </div>
            </div>
            {copiedMd ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4 text-neutral-400 group-hover:text-white" />
            )}
          </button>
        </div>

        <div className="pt-2 border-t border-white/[0.06] text-right">
          <button
            onClick={onClose}
            className="rounded-full bg-white/[0.08] px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-white/[0.15] transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default JournalExportModal;
