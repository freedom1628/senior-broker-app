// Centralized AI & Arbiter TypeScript Schemas and Domain Interfaces
// Supporting Frontier Models: Gemini 3.7 Flash, Claude Sonnet 5/Opus/Fable, OpenAI 5.6/o3

export type MarketRegimeType = "FAVORABLE" | "NEUTRAL" | "HOSTILE";

export interface AIFrontierModel {
  id: string;
  name: string;
  provider: "gemini" | "claude" | "openai";
  description: string;
  isLatest: boolean;
  badgeClass?: string;
}

export interface ParsedCandidate {
  id?: string;
  ticker: string;
  companyName: string;
  setupType: string;
  entryTrigger: number;
  entryCondition: string;
  stopLoss: number;
  stopRationale: string;
  target1: number;
  target2: number;
  rrRatio: number;
  timeStopDays: number;
  positionShares: number;
  riskAmount: number;
  catalystDate: string;
  catalystSummary: string;
  bearCase: string;
  score: number;
  modelSource: string;
}

export interface ParsedReport {
  marketRegime: MarketRegimeType;
  regimeNotes: string;
  macroFlags: string;
  candidates: ParsedCandidate[];
  rawHtml?: string;
  rawText?: string;
  timestamp?: string;
}

export interface MasterSetup extends ParsedCandidate {
  consensusCount: number;
  modelsAgreed: string[];
  isConsensusPick: boolean;
  normalizedShares: number;
  normalizedRisk: number;
  allocatedCapital?: number;
  actualRiskPct?: number;
}

export interface MasterArbiterPlan {
  id?: string;
  marketRegime: MarketRegimeType;
  regimeNotes: string;
  macroFlags: string;
  consensusHighlight: string;
  masterSetups: MasterSetup[];
  allCandidates: ParsedCandidate[];
  modelBreakdowns: {
    gemini?: ParsedReport;
    claude?: ParsedReport;
    chatgpt?: ParsedReport;
    [key: string]: ParsedReport | undefined;
  };
  generatedAt?: string;
}

export interface PriceLadderTier {
  levelName: "TARGET_2" | "TARGET_1" | "ENTRY" | "STOP_LOSS";
  price: number;
  distancePct: number;
  rMultiple: number;
  label: string;
  actionLabel?: string;
  pnlDollars?: number;
}

export interface IngestReportPayload {
  modelSource: string;
  rawText: string;
}

export interface IngestionRequest {
  reports: IngestReportPayload[];
  accountSize?: number;
  riskPercent?: number;
}

export type IngestRequestBody = IngestionRequest;

export interface PromptCustomizerOptions {
  accountSize?: number;
  riskPercent?: number;
  strategyStyle?: "ALL" | "MOMENTUM_BREAKOUT" | "PEAD_CONTINUATION" | "FIRST_PULLBACK" | "HIGH_TIGHT_FLAG";
  targetModel?: "gemini" | "claude" | "openai" | "all";
}
