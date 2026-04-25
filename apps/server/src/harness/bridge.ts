import { HarnessApiError } from "@t3tools/contracts";
import { Effect } from "effect";

export interface HarnessBridgeOptions {
  readonly daemonUrl?: string;
}

export class HarnessBridge {
  readonly daemonUrl: string;

  constructor(options: HarnessBridgeOptions = {}) {
    this.daemonUrl = normalizeDaemonUrl(
      options.daemonUrl ?? process.env.HARNESS_DAEMON_URL ?? "http://127.0.0.1:3001",
    );
  }

  dashboard() {
    return this.call("dashboard", undefined, "query");
  }

  runSnapshot(runId: string) {
    return this.call("runSnapshot", { runId }, "query");
  }

  workflowGraph(runId: string) {
    return this.runSnapshot(runId).pipe(
      Effect.map((snapshot) => projectWorkflowGraph(runId, snapshot)),
    );
  }

  startRun(input: unknown) {
    return this.call("startRun", input, "mutation");
  }

  submitArtifact(input: unknown) {
    return this.call("submitArtifact", input, "mutation");
  }

  decideApproval(input: unknown) {
    return this.call("decideApproval", input, "mutation");
  }

  startNextExecutionBatch(input: unknown) {
    return this.call("startNextExecutionBatch", input, "mutation");
  }

  approveExecutionBatchStart(input: unknown) {
    return this.call("approveExecutionBatchStart", input, "mutation");
  }

  completeExecutionBatch(input: unknown) {
    return this.call("completeExecutionBatch", input, "mutation");
  }

  failExecutionBatch(input: unknown) {
    return this.call("failExecutionBatch", input, "mutation");
  }

  overrideExecutionBatch(input: unknown) {
    return this.call("overrideExecutionBatch", input, "mutation");
  }

  private call(procedure: string, input: unknown, operation: "query" | "mutation") {
    return Effect.tryPromise({
      try: async () => {
        const url = new URL(`/trpc/${procedure}`, this.daemonUrl);
        const init: RequestInit = {
          method: operation === "query" ? "GET" : "POST",
          headers: { "content-type": "application/json" },
        };

        if (operation === "query") {
          if (input !== undefined) {
            url.searchParams.set("input", JSON.stringify({ json: input }));
          }
        } else {
          init.body = JSON.stringify({ json: input });
        }

        const response = await fetch(url, init);
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new HarnessApiError({
            message: formatDaemonError(response.status, payload),
            status: response.status,
            cause: payload,
          });
        }
        return unwrapTrpcPayload(payload);
      },
      catch: (cause) =>
        isHarnessApiError(cause)
          ? cause
          : new HarnessApiError({
              message: "Harness daemon request failed.",
              status: 502,
              cause,
            }),
    });
  }
}

function isHarnessApiError(cause: unknown): cause is HarnessApiError {
  return cause !== null && typeof cause === "object" && "_tag" in cause && cause._tag === "HarnessApiError";
}

function normalizeDaemonUrl(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function unwrapTrpcPayload(payload: unknown): unknown {
  if (
    payload !== null &&
    typeof payload === "object" &&
    "result" in payload &&
    payload.result !== null &&
    typeof payload.result === "object" &&
    "data" in payload.result
  ) {
    const data = payload.result.data;
    if (data !== null && typeof data === "object" && "json" in data) {
      return data.json;
    }
    return data;
  }
  return payload;
}

function formatDaemonError(status: number, payload: unknown) {
  const message =
    payload !== null &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error !== null &&
    typeof payload.error === "object" &&
    "message" in payload.error
      ? String(payload.error.message)
      : "Harness daemon request failed.";
  return `${message} (HTTP ${status})`;
}

function projectWorkflowGraph(runId: string, snapshot: unknown) {
  const record = snapshot && typeof snapshot === "object" ? snapshot as Record<string, unknown> : {};
  const run = record.run && typeof record.run === "object" ? record.run as Record<string, unknown> : {};
  const stages = Array.isArray(record.stages) ? record.stages as Array<Record<string, unknown>> : [];
  const blockers: string[] = [];
  const nodes = stages.map((stage) => {
    const id = String(stage.id ?? "unknown");
    const missing = Array.isArray(stage.missingArtifacts) ? stage.missingArtifacts.map(String) : [];
    if (missing.length > 0) blockers.push(`${id}: missing ${missing.join(", ")}`);
    return {
      id: `stage:${id}`,
      label: id,
      kind: "stage",
      status: String(stage.state ?? "pending"),
    };
  });
  const edges = stages.slice(1).map((stage, index) => ({
    id: `edge:${String(stages[index]?.id ?? index)}:${String(stage.id ?? index + 1)}`,
    from: `stage:${String(stages[index]?.id ?? index)}`,
    to: `stage:${String(stage.id ?? index + 1)}`,
    label: "next",
  }));
  return {
    runId,
    currentStage: String(run.stage ?? ""),
    nodes,
    edges,
    blockers,
  };
}
