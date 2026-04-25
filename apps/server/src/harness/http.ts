import { HarnessApiError } from "@t3tools/contracts";
import { Effect, Option } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { ServerAuth } from "../auth/Services/ServerAuth.ts";
import { HarnessBridge } from "./bridge.ts";

const bridge = new HarnessBridge();

const respondToHarnessError = (error: HarnessApiError) =>
  Effect.gen(function* () {
    if (error.status >= 500) {
      yield* Effect.logError("harness route failed", {
        message: error.message,
        cause: error.cause,
      });
    }
    return HttpServerResponse.jsonUnsafe({ error: error.message }, { status: error.status });
  });

const authenticateOwnerSession = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const serverAuth = yield* ServerAuth;
  const session = yield* serverAuth.authenticateHttpRequest(request).pipe(
    Effect.mapError(
      (cause) =>
        new HarnessApiError({
          message: cause.message,
          status: cause.status ?? 401,
          cause,
        }),
    ),
  );
  if (session.role !== "owner") {
    return yield* new HarnessApiError({
      message: "Only owner sessions can use harness controls.",
      status: 403,
    });
  }
  return session;
});

const mapBridgeError = (message: string) => (cause: HarnessApiError) =>
  new HarnessApiError({
    message,
    status: cause.status,
    cause,
  });

const respond = (effect: Effect.Effect<unknown, HarnessApiError, never>, message: string) =>
  Effect.gen(function* () {
    yield* authenticateOwnerSession;
    const result = yield* effect.pipe(Effect.mapError(mapBridgeError(message)));
    return HttpServerResponse.jsonUnsafe(result, { status: 200 });
  }).pipe(Effect.catchTag("HarnessApiError", respondToHarnessError));

const jsonBody = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  return yield* request.json;
});

export const harnessDashboardRouteLayer = HttpRouter.add(
  "GET",
  "/api/harness/dashboard",
  respond(bridge.dashboard(), "Failed to load harness dashboard."),
);

export const harnessRunSnapshotRouteLayer = HttpRouter.add(
  "GET",
  "/api/harness/run-snapshot",
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const url = HttpServerRequest.toURL(request);
    if (Option.isNone(url)) {
      return HttpServerResponse.jsonUnsafe({ error: "Bad Request" }, { status: 400 });
    }
    const runId = url.value.searchParams.get("runId");
    if (!runId) {
      return HttpServerResponse.jsonUnsafe({ error: "Missing runId." }, { status: 400 });
    }
    yield* authenticateOwnerSession;
    const result = yield* bridge.runSnapshot(runId).pipe(
      Effect.mapError(mapBridgeError("Failed to load harness run snapshot.")),
    );
    return HttpServerResponse.jsonUnsafe(result, { status: 200 });
  }).pipe(Effect.catchTag("HarnessApiError", respondToHarnessError)),
);

export const harnessWorkflowGraphRouteLayer = HttpRouter.add(
  "GET",
  "/api/harness/workflow-graph",
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const url = HttpServerRequest.toURL(request);
    if (Option.isNone(url)) {
      return HttpServerResponse.jsonUnsafe({ error: "Bad Request" }, { status: 400 });
    }
    const runId = url.value.searchParams.get("runId");
    if (!runId) {
      return HttpServerResponse.jsonUnsafe({ error: "Missing runId." }, { status: 400 });
    }
    yield* authenticateOwnerSession;
    const result = yield* bridge.workflowGraph(runId).pipe(
      Effect.mapError(mapBridgeError("Failed to load harness workflow graph.")),
    );
    return HttpServerResponse.jsonUnsafe(result, { status: 200 });
  }).pipe(Effect.catchTag("HarnessApiError", respondToHarnessError)),
);

const respondWithBody = (
  handler: (body: unknown) => Effect.Effect<unknown, HarnessApiError, never>,
  message: string,
) =>
  Effect.gen(function* () {
    yield* authenticateOwnerSession;
    const body = yield* jsonBody;
    const result = yield* handler(body).pipe(Effect.mapError(mapBridgeError(message)));
    return HttpServerResponse.jsonUnsafe(result, { status: 200 });
  }).pipe(Effect.catchTag("HarnessApiError", respondToHarnessError));
/*
 * Route order matters: these API routes are registered before the catch-all static/dev route.
 * The harness daemon remains authoritative; this server only bridges authenticated UI calls.
 */
export const harnessStartRunRouteLayer = HttpRouter.add(
  "POST",
  "/api/harness/start-run",
  respondWithBody((body) => bridge.startRun(body), "Failed to start harness run."),
);

export const harnessSubmitArtifactRouteLayer = HttpRouter.add(
  "POST",
  "/api/harness/submit-artifact",
  respondWithBody((body) => bridge.submitArtifact(body), "Failed to submit harness artifact."),
);

export const harnessDecideApprovalRouteLayer = HttpRouter.add(
  "POST",
  "/api/harness/decide-approval",
  respondWithBody((body) => bridge.decideApproval(body), "Failed to decide harness approval."),
);

export const harnessStartBatchRouteLayer = HttpRouter.add(
  "POST",
  "/api/harness/start-batch",
  respondWithBody((body) => bridge.startNextExecutionBatch(body), "Failed to start execution batch."),
);

export const harnessApproveBatchRouteLayer = HttpRouter.add(
  "POST",
  "/api/harness/approve-batch",
  respondWithBody((body) => bridge.approveExecutionBatchStart(body), "Failed to approve execution batch."),
);

export const harnessCompleteBatchRouteLayer = HttpRouter.add(
  "POST",
  "/api/harness/complete-batch",
  respondWithBody((body) => bridge.completeExecutionBatch(body), "Failed to complete execution batch."),
);

export const harnessFailBatchRouteLayer = HttpRouter.add(
  "POST",
  "/api/harness/fail-batch",
  respondWithBody((body) => bridge.failExecutionBatch(body), "Failed to fail execution batch."),
);

export const harnessOverrideBatchRouteLayer = HttpRouter.add(
  "POST",
  "/api/harness/override-batch",
  respondWithBody((body) => bridge.overrideExecutionBatch(body), "Failed to override execution batch."),
);
