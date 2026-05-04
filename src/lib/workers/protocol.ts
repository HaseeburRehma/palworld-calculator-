/**
 * Wire format for the pathfind worker.
 *
 * Lives in its own file so both the worker and the client can import the
 * types without dragging in `pathfind.ts` (and its `Pal` data) on either
 * side. The worker imports the algorithm; the main thread imports the
 * client wrapper. They meet here.
 */

import type { BreedingPlan, OwnedPal } from "@/types/pal";
import type { PathfindDiagnostics } from "@/lib/breeding/pathfind";

/* -------------------------------------------------------------------------- */
/*  Main thread → Worker                                                      */
/* -------------------------------------------------------------------------- */

export interface RunMessage {
  type: "run";
  /** Correlates request and response. */
  jobId: string;
  payload: RunPayload;
}

export interface RunPayload {
  /** The user's roster. */
  roster: OwnedPal[];
  targetPalId: string;
  desiredPassiveIds: string[];
}

export interface CancelMessage {
  type: "cancel";
  jobId: string;
}

export type ClientMessage = RunMessage | CancelMessage;

/* -------------------------------------------------------------------------- */
/*  Worker → Main thread                                                      */
/* -------------------------------------------------------------------------- */

export interface ResultMessage {
  type: "result";
  jobId: string;
  plans: BreedingPlan[];
  warnings: string[];
  diagnostics: PathfindDiagnostics;
}

export interface ProgressMessage {
  type: "progress";
  jobId: string;
  /** "Phase A: searching species graph", "Phase B: scoring 7 candidates", etc. */
  message: string;
}

export interface ErrorMessage {
  type: "error";
  jobId: string;
  message: string;
}

export interface CancelledMessage {
  type: "cancelled";
  jobId: string;
}

export type WorkerMessage =
  | ResultMessage
  | ProgressMessage
  | ErrorMessage
  | CancelledMessage;
