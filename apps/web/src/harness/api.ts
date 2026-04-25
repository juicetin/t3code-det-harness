import {
  type HarnessDashboard,
  type HarnessRunSnapshot,
  type HarnessWorkflowGraph,
} from "@t3tools/contracts";

async function requestHarness<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/harness/${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : `Harness request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
  return payload as T;
}

export function getHarnessDashboard() {
  return requestHarness<HarnessDashboard>("dashboard");
}

export function getHarnessRunSnapshot(runId: string) {
  return requestHarness<HarnessRunSnapshot>(
    `run-snapshot?runId=${encodeURIComponent(runId)}`,
  );
}

export function getHarnessWorkflowGraph(runId: string) {
  return requestHarness<HarnessWorkflowGraph>(
    `workflow-graph?runId=${encodeURIComponent(runId)}`,
  );
}

export function startHarnessRun(userRequest: string) {
  return requestHarness("start-run", {
    method: "POST",
    body: JSON.stringify({ userRequest }),
  });
}

export function decideHarnessApproval(input: {
  readonly approvalId: string;
  readonly status: "approved" | "rejected" | "waived";
  readonly rationale?: string;
}) {
  return requestHarness("decide-approval", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

