/**
 * Main-thread wrapper around the pathfind worker.
 *
 * Hides the message-passing protocol behind a small Promise-y API:
 *
 *   const client = createPathfindClient();
 *   const job = client.run({ roster, targetPalId, desiredPassiveIds }, {
 *     onProgress: (msg) => setProgress(msg),
 *   });
 *   const result = await job.promise;
 *   // optionally: job.cancel();
 *
 * Falls back to running the algorithm on the main thread when the runtime
 * doesn't have Workers (older test environments, SSR). This keeps the UI
 * code simple and avoids feature-detect noise at every call site.
 */

import { newUuid } from "@/lib/util/uuid";
import { findBreedingPlans } from "@/lib/breeding/pathfind";
import { allPals } from "@/lib/data/pals";
import { allPassives } from "@/lib/data/passives";
import { getParentPairsFor } from "@/lib/data/reverse-index";
import type {
  ClientMessage,
  RunPayload,
  WorkerMessage,
} from "./protocol";
import type { BreedingPlan, OwnedPal } from "@/types/pal";
import type { PathfindDiagnostics } from "@/lib/breeding/pathfind";

export interface PathfindResult {
  plans: BreedingPlan[];
  warnings: string[];
  diagnostics: PathfindDiagnostics;
  /** True when the job ran to completion before any cancel call landed. */
  completed: boolean;
}

export interface RunOptions {
  /** Called whenever the worker emits a progress event. */
  onProgress?: (message: string) => void;
}

export interface RunHandle {
  jobId: string;
  promise: Promise<PathfindResult>;
  cancel: () => void;
}

export interface PathfindClient {
  run(payload: RunPayload, opts?: RunOptions): RunHandle;
  /** Tear down the worker (e.g. on unmount). Idempotent. */
  dispose(): void;
}

/**
 * Builds a client around either a real Worker or a synchronous fallback.
 * The choice is made at creation time and stays stable.
 */
export function createPathfindClient(): PathfindClient {
  if (typeof Worker === "undefined") {
    return makeSyncClient();
  }
  try {
    return makeWorkerClient();
  } catch {
    // Build-time worker URL might fail under some bundlers; fall back gracefully.
    return makeSyncClient();
  }
}

/* -------------------------------------------------------------------------- */
/*  Real worker client                                                        */
/* -------------------------------------------------------------------------- */

function makeWorkerClient(): PathfindClient {
  const worker = new Worker(
    new URL("../../workers/pathfind.worker.ts", import.meta.url),
    { type: "module" },
  );

  type Pending = {
    resolve: (r: PathfindResult) => void;
    reject: (e: Error) => void;
    onProgress?: (message: string) => void;
    cancelled: boolean;
  };
  const pending = new Map<string, Pending>();

  worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
    const msg = e.data;
    const entry = pending.get(msg.jobId);
    if (!entry) return;

    switch (msg.type) {
      case "progress":
        entry.onProgress?.(msg.message);
        return;
      case "result":
        entry.resolve({
          plans: msg.plans,
          warnings: msg.warnings,
          diagnostics: msg.diagnostics,
          completed: !entry.cancelled,
        });
        pending.delete(msg.jobId);
        return;
      case "cancelled":
        entry.resolve({
          plans: [],
          warnings: ["Search cancelled."],
          diagnostics: { candidatePathsExplored: 0, hitDepthLimit: false, durationMs: 0 },
          completed: false,
        });
        pending.delete(msg.jobId);
        return;
      case "error":
        entry.reject(new Error(msg.message));
        pending.delete(msg.jobId);
        return;
    }
  };

  worker.onerror = (e) => {
    // Reject every in-flight job — the worker is in a bad state.
    for (const [, entry] of pending) {
      entry.reject(new Error(e.message ?? "Pathfind worker errored"));
    }
    pending.clear();
  };

  return {
    run(payload, opts = {}) {
      const jobId = newUuid();
      const promise = new Promise<PathfindResult>((resolve, reject) => {
        pending.set(jobId, {
          resolve,
          reject,
          onProgress: opts.onProgress,
          cancelled: false,
        });
        const msg: ClientMessage = { type: "run", jobId, payload };
        worker.postMessage(msg);
      });
      return {
        jobId,
        promise,
        cancel: () => {
          const entry = pending.get(jobId);
          if (entry) entry.cancelled = true;
          const cancelMsg: ClientMessage = { type: "cancel", jobId };
          worker.postMessage(cancelMsg);
        },
      };
    },
    dispose() {
      worker.terminate();
      pending.clear();
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Sync fallback (no Worker available — tests, SSR, prerendering)            */
/* -------------------------------------------------------------------------- */

function makeSyncClient(): PathfindClient {
  return {
    run(payload) {
      const jobId = newUuid();
      const reverseIndex = new Map(
        allPals.map((p) => [p.id, getParentPairsFor(p.id)] as const),
      );
      let cancelled = false;
      const promise = new Promise<PathfindResult>((resolve) => {
        // Defer to a microtask so callers can attach `cancel` first.
        Promise.resolve().then(() => {
          if (cancelled) {
            resolve({
              plans: [],
              warnings: ["Search cancelled."],
              diagnostics: { candidatePathsExplored: 0, hitDepthLimit: false, durationMs: 0 },
              completed: false,
            });
            return;
          }
          const r = findBreedingPlans({
            roster: payload.roster as OwnedPal[],
            targetPalId: payload.targetPalId,
            desiredPassiveIds: payload.desiredPassiveIds,
            pals: allPals,
            reverseIndex,
            passives: allPassives,
          });
          resolve({ ...r, completed: !cancelled });
        });
      });
      return {
        jobId,
        promise,
        cancel: () => {
          cancelled = true;
        },
      };
    },
    dispose() {
      /* no-op */
    },
  };
}
