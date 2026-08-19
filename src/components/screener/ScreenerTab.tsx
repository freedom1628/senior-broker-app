"use client";

import React, { useState, useEffect, useCallback } from "react";
import { MasterArbiterPlan, MasterSetup, ParsedCandidate } from "@/lib/ai/types";
import { ConsensusArbiterView } from "./ConsensusArbiterView";
import { MultiReportIngestionModal } from "./MultiReportIngestionModal";
import { PromptStation } from "./PromptStation";
import { synthesizeArbiterPlan } from "@/lib/ai/arbiter";
import { parseReportContent } from "@/lib/ai/parser";
import { triggerNotificationAlert } from "@/lib/notifications/notification-service";

export interface ScreenerTabProps {
  accountSize: number;
  riskPerTrade: number;
  marketQuotes: Record<string, any>;
  onPromoteToTrade: (setup: MasterSetup | ParsedCandidate, mode: "PENDING_ENTRY" | "ACTIVE") => void;
  onOpenAddTrade?: () => void;
}

export const ScreenerTab: React.FC<ScreenerTabProps> = ({
  accountSize,
  riskPerTrade,
  marketQuotes,
  onPromoteToTrade,
  onOpenAddTrade,
}) => {
  const [arbiterPlan, setArbiterPlan] = useState<MasterArbiterPlan | null>(null);
  const [isIngestionModalOpen, setIsIngestionModalOpen] = useState<boolean>(false);
  const [isPromptStationOpen, setIsPromptStationOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load latest research on mount
  const loadInitialResearch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/research/current");
      const data = await res.json();

      if (data.researchRun && data.candidates && data.candidates.length > 0) {
        // Construct master setups
        const setups: MasterSetup[] = data.candidates.map((c: any) => {
          const modelsAgreed = c.modelSources ? c.modelSources.split(",").map((s: string) => s.trim()) : [c.modelSource || "Research"];
          const isConsensus = modelsAgreed.length > 1 || c.isConsensusPick || false;
          return {
            ...c,
            consensusCount: modelsAgreed.length,
            modelsAgreed,
            isConsensusPick: isConsensus,
            normalizedShares: c.positionShares,
            normalizedRisk: c.riskAmount,
          };
        });

        setArbiterPlan({
          id: data.researchRun.id,
          marketRegime: data.researchRun.marketRegime || "FAVORABLE",
          regimeNotes: data.researchRun.regimeNotes || "",
          macroFlags: data.researchRun.macroFlags || "",
          consensusHighlight: data.researchRun.arbiterSynthesis || "",
          masterSetups: setups,
          allCandidates: setups,
          modelBreakdowns: {},
          generatedAt: data.researchRun.date,
        });
      } else {
        // Fallback load rich calibrated sample
        const sampleRes = await fetch(`/api/research/sample?accountSize=${accountSize}&riskPercent=${riskPerTrade}`);
        const sampleData = await sampleRes.json();
        if (sampleData.arbiterPlan) {
          setArbiterPlan(sampleData.arbiterPlan);
        }
      }
    } catch (err) {
      console.error("Error loading research in ScreenerTab:", err);
    } finally {
      setIsLoading(false);
    }
  }, [accountSize, riskPerTrade]);

  useEffect(() => {
    loadInitialResearch();
  }, [loadInitialResearch]);

  // Handle research completed from modal
  const handleResearchCompleted = (newPlan: MasterArbiterPlan) => {
    setArbiterPlan(newPlan);
    triggerNotificationAlert({
      ticker: "SCREENER",
      type: "ENTRY_TRIGGERED",
      title: `Research Ingested: ${newPlan.masterSetups.length} Setups`,
      message: `Market Regime: ${newPlan.marketRegime}. Top consensus candidate: ${newPlan.masterSetups[0]?.ticker || "None"}.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Main Arbiter View */}
      <ConsensusArbiterView
        arbiterPlan={arbiterPlan}
        marketQuotes={marketQuotes}
        onPromoteToTrade={onPromoteToTrade}
        onOpenPromptStation={() => setIsPromptStationOpen(true)}
        onOpenIngestModal={() => setIsIngestionModalOpen(true)}
        accountSize={accountSize}
        riskPercent={riskPerTrade}
      />

      {/* Ingestion Modal */}
      <MultiReportIngestionModal
        isOpen={isIngestionModalOpen}
        onClose={() => setIsIngestionModalOpen(false)}
        onResearchCompleted={handleResearchCompleted}
        accountSize={accountSize}
        riskPercent={riskPerTrade}
      />

      {/* Prompt Station Modal */}
      <PromptStation
        isOpen={isPromptStationOpen}
        onClose={() => setIsPromptStationOpen(false)}
        accountSize={accountSize}
        riskPercent={riskPerTrade}
      />
    </div>
  );
};
