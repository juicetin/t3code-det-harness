import { Schema } from "effect";
import { IsoDateTime, NonNegativeInt, TrimmedNonEmptyString } from "./baseSchemas.ts";

export const HarnessRunStatus = Schema.Literals([
  "created",
  "running",
  "blocked",
  "completed",
  "cancelled",
  "failed",
]);
export type HarnessRunStatus = typeof HarnessRunStatus.Type;

export const HarnessStageState = Schema.Literals(["done", "current", "blocked", "pending"]);
export type HarnessStageState = typeof HarnessStageState.Type;

export const HarnessApprovalStatus = Schema.Literals([
  "pending",
  "approved",
  "rejected",
  "waived",
]);
export type HarnessApprovalStatus = typeof HarnessApprovalStatus.Type;

export const HarnessBatchStatus = Schema.Literals([
  "planned",
  "pending_human",
  "open",
  "blocked",
  "completed",
  "overridden",
]);
export type HarnessBatchStatus = typeof HarnessBatchStatus.Type;

export const HarnessGateSeverity = Schema.Literals(["hard", "threshold", "advisory"]);
export type HarnessGateSeverity = typeof HarnessGateSeverity.Type;

export const HarnessQualityStatus = Schema.Literals([
  "passed",
  "failed",
  "missing_command",
  "missing_parser",
  "missing_implementation",
  "advisory",
  "blocked",
]);
export type HarnessQualityStatus = typeof HarnessQualityStatus.Type;

export const HarnessRunSummary = Schema.Struct({
  id: TrimmedNonEmptyString,
  status: HarnessRunStatus,
  stage: TrimmedNonEmptyString,
  userRequest: Schema.String,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type HarnessRunSummary = typeof HarnessRunSummary.Type;

export const HarnessArtifactSummary = Schema.Struct({
  id: TrimmedNonEmptyString,
  runId: TrimmedNonEmptyString,
  stage: TrimmedNonEmptyString,
  kind: TrimmedNonEmptyString,
  status: TrimmedNonEmptyString,
  source: Schema.NullOr(Schema.String),
  createdAt: IsoDateTime,
});
export type HarnessArtifactSummary = typeof HarnessArtifactSummary.Type;

export const HarnessApprovalSummary = Schema.Struct({
  id: TrimmedNonEmptyString,
  runId: TrimmedNonEmptyString,
  gate: TrimmedNonEmptyString,
  status: HarnessApprovalStatus,
  rationale: Schema.NullOr(Schema.String),
  createdAt: IsoDateTime,
});
export type HarnessApprovalSummary = typeof HarnessApprovalSummary.Type;

export const HarnessStageNode = Schema.Struct({
  id: TrimmedNonEmptyString,
  state: HarnessStageState,
  blocked: Schema.Boolean,
  missingArtifacts: Schema.Array(TrimmedNonEmptyString),
  requiredArtifacts: Schema.Array(TrimmedNonEmptyString),
  requiredTools: Schema.Array(TrimmedNonEmptyString),
  approval: Schema.NullOr(HarnessApprovalSummary),
});
export type HarnessStageNode = typeof HarnessStageNode.Type;

export const HarnessWorkflowGraphNode = Schema.Struct({
  id: TrimmedNonEmptyString,
  label: TrimmedNonEmptyString,
  kind: Schema.Literals(["stage", "artifact", "approval", "batch", "session", "quality"]),
  status: TrimmedNonEmptyString,
});
export type HarnessWorkflowGraphNode = typeof HarnessWorkflowGraphNode.Type;

export const HarnessWorkflowGraphEdge = Schema.Struct({
  id: TrimmedNonEmptyString,
  from: TrimmedNonEmptyString,
  to: TrimmedNonEmptyString,
  label: Schema.optional(TrimmedNonEmptyString),
});
export type HarnessWorkflowGraphEdge = typeof HarnessWorkflowGraphEdge.Type;

export const HarnessWorkflowGraph = Schema.Struct({
  runId: TrimmedNonEmptyString,
  currentStage: TrimmedNonEmptyString,
  nodes: Schema.Array(HarnessWorkflowGraphNode),
  edges: Schema.Array(HarnessWorkflowGraphEdge),
  blockers: Schema.Array(TrimmedNonEmptyString),
});
export type HarnessWorkflowGraph = typeof HarnessWorkflowGraph.Type;

export const HarnessExecutionBatch = Schema.Struct({
  id: TrimmedNonEmptyString,
  runId: TrimmedNonEmptyString,
  batchPlanId: TrimmedNonEmptyString,
  sequence: NonNegativeInt,
  title: TrimmedNonEmptyString,
  status: HarnessBatchStatus,
  allowedFiles: Schema.Array(TrimmedNonEmptyString),
  verificationCommands: Schema.Array(TrimmedNonEmptyString),
  smokeCommands: Schema.Array(TrimmedNonEmptyString),
  dependencies: Schema.Array(TrimmedNonEmptyString),
  commitHash: Schema.NullOr(Schema.String),
});
export type HarnessExecutionBatch = typeof HarnessExecutionBatch.Type;

export const HarnessCommandRun = Schema.Struct({
  id: TrimmedNonEmptyString,
  runId: TrimmedNonEmptyString,
  batchId: Schema.NullOr(TrimmedNonEmptyString),
  command: TrimmedNonEmptyString,
  status: HarnessQualityStatus,
  exitCode: Schema.NullOr(Schema.Number),
  startedAt: IsoDateTime,
  completedAt: Schema.NullOr(IsoDateTime),
  outputSummary: Schema.NullOr(Schema.String),
});
export type HarnessCommandRun = typeof HarnessCommandRun.Type;

export const HarnessQualityResult = Schema.Struct({
  id: TrimmedNonEmptyString,
  runId: TrimmedNonEmptyString,
  batchId: Schema.NullOr(TrimmedNonEmptyString),
  tool: TrimmedNonEmptyString,
  status: HarnessQualityStatus,
  severity: HarnessGateSeverity,
  threshold: Schema.NullOr(Schema.String),
  observed: Schema.NullOr(Schema.String),
  summary: Schema.String,
});
export type HarnessQualityResult = typeof HarnessQualityResult.Type;

export const HarnessRunSnapshot = Schema.Struct({
  run: HarnessRunSummary,
  stages: Schema.Array(HarnessStageNode),
  artifacts: Schema.Array(HarnessArtifactSummary),
  approvals: Schema.Array(HarnessApprovalSummary),
  executionBatches: Schema.Array(HarnessExecutionBatch),
});
export type HarnessRunSnapshot = typeof HarnessRunSnapshot.Type;

export const HarnessDashboard = Schema.Struct({
  runs: Schema.Array(HarnessRunSummary),
  active: Schema.NullOr(HarnessRunSnapshot),
});
export type HarnessDashboard = typeof HarnessDashboard.Type;

export class HarnessApiError extends Schema.TaggedErrorClass<HarnessApiError>()("HarnessApiError", {
  message: TrimmedNonEmptyString,
  status: NonNegativeInt,
  cause: Schema.optional(Schema.Unknown),
}) {}
