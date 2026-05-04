/// <reference lib="webworker" />
/**
 * Pathfind Web Worker.
 *
 * Imports the data tables and the pure pathfinder. Runs synchronously in the
 * worker thread, so we get a smooth UI even when the search takes 100+ ms.
 *
 * The worker can be invoked many times by the main thread; each call carries
 * a `jobId` so cancellation lines up. We treat cancellation as cooperative:
 * since the search is fast (< 1s), we simply "drop" the result of any in-flight
 * job whose id has been cancelled. No partial work is wasted because the
 * worker is single-threaded — the next message is queued.
 */

import { allPals } from "@/lib/data/pals";
import { allPassives } from "@/lib/data/passives";
import { getParentPairsFor } from "@/lib/data/reverse-index";
import {
  findBreedingPlans,
  type PathfindRequest,
} from "@/lib/breeding/pathfind";
import type { ClientMessage, WorkerMessage } from "@/lib/workers/protocol";

const cancelledJobs = new Set<string>();

// Build the reverse index map once at boot — the worker is long-lived.
const reverseIndex: ReadonlyMap<string, ReadonlyArray<{ parentA: string; parentB: string }>> =
  new Map(
    allPals.map((p) => [p.id, getParentPairsFor(p.id)] as const),
  );

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (e: MessageEvent<ClientMessage>) => {
  const msg = e.data;
  if (msg.type === "cancel") {
    cancelledJobs.add(msg.jobId);
    return;
  }
  if (msg.type !== "run") return;

  const { jobId, payload } = msg;
  try {
    const request: PathfindRequest = {
      roster: payload.roster,
      targetPalId: payload.targetPalId,
      desiredPassiveIds: payload.desiredPassiveIds,
      pals: allPals,
      reverseIndex,
      passives: allPassives,
    };

    // The search is fast and synchronous — no progress mid-flight is needed
    // for typical inputs. If we ever extend it (e.g. broader feeder search),
    // sprinkle `postProgress(...)` checkpoints inside `findBreedingPlans`.
    const result = findBreedingPlans(request);

    if (cancelledJobs.has(jobId)) {
      cancelledJobs.delete(jobId);
      send({ type: "cancelled", jobId });
      return;
    }

    send({
      type: "result",
      jobId,
      plans: result.plans,
      warnings: result.warnings,
      diagnostics: result.diagnostics,
    });
  } catch (err) {
    send({
      type: "error",
      jobId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

function send(msg: WorkerMessage): void {
  self.postMessage(msg);
}

// Make this a module — required for `import` syntax in worker context.
export {};
