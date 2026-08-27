export const workClasses = [
  'mechanical',
  'implementation',
  'architecture',
  'security',
  'review',
] as const;

export const riskLevels = ['low', 'standard', 'critical'] as const;
export const orchestrationModes = ['codex-native', 'claude-adaptive'] as const;
export const modelTiers = ['Luna', 'Terra', 'Sol', 'Sonnet', 'Opus'] as const;

export type WorkClass = (typeof workClasses)[number];
export type RiskLevel = (typeof riskLevels)[number];
export type OrchestrationMode = (typeof orchestrationModes)[number];
export type ModelTier = (typeof modelTiers)[number];
export type Provider = 'codex' | 'claude';
export type ReasoningEffort = 'low' | 'medium' | 'high';
export type SafetyLane = 'standard' | 'elevated' | 'critical';
export type ReviewVerdict = 'approved' | 'changes-requested';
export type ReviewAuditStatus = 'ready' | 'stale' | 'needs-review' | 'blocked';
export type RunStageStatus = 'complete' | 'active' | 'gated' | 'blocked';
export type ReleaseGateStatus = 'ready' | 'waiting' | 'blocked';

export interface ProviderAvailability {
  claude: boolean;
  codex: boolean;
}

export interface TaskScenario {
  brief: string;
  workClass: WorkClass;
  risk: RiskLevel;
  orchestrationMode: OrchestrationMode;
  unavailableModel: ModelTier | null;
  availability: ProviderAvailability;
}

export interface AgentAssignment {
  provider: Provider;
  model: string;
  role: 'writer' | 'reviewer';
}

export interface RouteDecision {
  writer: AgentAssignment;
  reviewer: AgentAssignment;
  reasoningEffort: ReasoningEffort;
  safetyLane: SafetyLane;
  signals: string[];
  fallback: string;
  reviewerIndependence: 'cross-provider' | 'fresh-session';
  confidence: 'guided' | 'needs-input';
}

export interface PlanRevision {
  id: string;
  label: string;
}

export interface ReviewRecord {
  id: string;
  provider: Provider;
  model: string;
  revisionId: string;
  verdict: ReviewVerdict;
  summary: string;
  findings: ReviewFinding[];
}

export interface ReviewFinding {
  id: string;
  requirement: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  nextAction: string;
}

export interface ReviewAudit {
  status: ReviewAuditStatus;
  currentReviews: ReviewRecord[];
  staleReviews: ReviewRecord[];
  nextAction: string;
}

export interface RunStage {
  label: string;
  description: string;
  status: RunStageStatus;
}

export interface WriterLease {
  status: 'active' | 'reserved' | 'none';
  owner: AgentAssignment;
  scope: string;
  statement: string;
}

export interface EvidenceRecord {
  id: string;
  source: string;
  result: 'passed' | 'waiting' | 'blocked';
  gate: string;
  detail: string;
}

export interface DemoRun {
  stages: RunStage[];
  writerLease: WriterLease;
  evidence: EvidenceRecord[];
  releaseGate: ReleaseGateStatus;
}
