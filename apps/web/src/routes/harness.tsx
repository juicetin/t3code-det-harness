import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import {
  decideHarnessApproval,
  getHarnessDashboard,
  getHarnessWorkflowGraph,
  startHarnessRun,
} from "../harness/api";

export const Route = createFileRoute("/harness")({
  component: HarnessRouteView,
});

function HarnessRouteView() {
  const queryClient = useQueryClient();
  const [request, setRequest] = useState("");
  const dashboard = useQuery({
    queryKey: ["harness", "dashboard"],
    queryFn: getHarnessDashboard,
    refetchInterval: 3000,
  });
  const activeRunId = dashboard.data?.active?.run.id ?? null;
  const graph = useQuery({
    queryKey: ["harness", "workflow-graph", activeRunId],
    queryFn: () => getHarnessWorkflowGraph(activeRunId ?? ""),
    enabled: activeRunId !== null,
    refetchInterval: 3000,
  });
  const startRun = useMutation({
    mutationFn: startHarnessRun,
    onSuccess: async () => {
      setRequest("");
      await queryClient.invalidateQueries({ queryKey: ["harness"] });
    },
  });
  const decideApproval = useMutation({
    mutationFn: decideHarnessApproval,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["harness"] });
    },
  });

  const active = dashboard.data?.active ?? null;
  const pendingApprovals = active?.approvals.filter((approval) => approval.status === "pending") ?? [];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          the-harness
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Harness control plane</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          This screen is backed by the harness daemon through the T3 server bridge. T3 renders and
          interacts; the daemon owns stages, gates, artifacts, approvals, batches, and events.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Start request</h2>
          <textarea
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            className="mt-3 min-h-28 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"
            placeholder="Describe the product/code change you want the harness to run..."
          />
          <button
            type="button"
            disabled={request.trim().length === 0 || startRun.isPending}
            onClick={() => startRun.mutate(request.trim())}
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start harness run
          </button>
          {startRun.error ? (
            <p className="mt-2 text-sm text-destructive">{startRun.error.message}</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Daemon status</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {dashboard.isLoading
              ? "Loading daemon state..."
              : dashboard.error
                ? dashboard.error.message
                : `${dashboard.data?.runs.length ?? 0} run(s) known`}
          </p>
          {active ? (
            <div className="mt-4 rounded-xl border border-border bg-background p-3 text-sm">
              <p className="font-medium">Active run {active.run.id.slice(0, 8)}</p>
              <p className="mt-1 text-muted-foreground">
                {active.run.status} at {active.run.stage}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {active ? (
        <section className="grid gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Stages</h2>
            <div className="mt-4 flex flex-col gap-2">
              {active.stages.map((stage) => (
                <div
                  key={stage.id}
                  className="rounded-xl border border-border bg-background p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{stage.id}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{stage.state}</span>
                  </div>
                  {stage.missingArtifacts.length > 0 ? (
                    <p className="mt-2 text-xs text-destructive">
                      Missing: {stage.missingArtifacts.join(", ")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold">Workflow graph</h2>
              <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {(graph.data?.nodes ?? []).map((node) => (
                  <div key={node.id} className="rounded-xl border border-border bg-background p-3">
                    <p className="text-sm font-medium">{node.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{node.status}</p>
                  </div>
                ))}
              </div>
              {graph.data?.blockers.length ? (
                <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
                  <p className="text-sm font-medium text-destructive">Blockers</p>
                  <ul className="mt-2 space-y-1 text-sm text-destructive">
                    {graph.data.blockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold">Pending approvals</h2>
              {pendingApprovals.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No pending approvals.</p>
              ) : (
                <div className="mt-4 flex flex-col gap-3">
                  {pendingApprovals.map((approval) => (
                    <div key={approval.id} className="rounded-xl border border-border bg-background p-3">
                      <p className="text-sm font-medium">{approval.gate}</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                          onClick={() =>
                            decideApproval.mutate({
                              approvalId: approval.id,
                              status: "approved",
                              rationale: "Approved from T3 harness control plane.",
                            })
                          }
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
                          onClick={() =>
                            decideApproval.mutate({
                              approvalId: approval.id,
                              status: "rejected",
                              rationale: "Rejected from T3 harness control plane.",
                            })
                          }
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      ) : null}
    </main>
  );
}

