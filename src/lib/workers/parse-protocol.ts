/**
 * Wire format for the parse worker. Mirrors `protocol.ts` (pathfind worker)
 * — kept separate so types stay narrow and either worker can evolve
 * independently.
 */

import type { ParseResult, ParseProgress } from "@/lib/save";

export interface RunParseMessage {
  type: "run";
  jobId: string;
  /** Transferred ownership — the worker owns the buffer after postMessage. */
  buffer: ArrayBuffer;
}

export interface CancelParseMessage {
  type: "cancel";
  jobId: string;
}

export type ParseClientMessage = RunParseMessage | CancelParseMessage;

export interface ParseProgressMessage {
  type: "progress";
  jobId: string;
  progress: ParseProgress;
}

export interface ParseResultMessage {
  type: "result";
  jobId: string;
  result: ParseResult;
}

export interface ParseErrorMessage {
  type: "error";
  jobId: string;
  message: string;
}

export interface ParseCancelledMessage {
  type: "cancelled";
  jobId: string;
}

export type ParseWorkerMessage =
  | ParseProgressMessage
  | ParseResultMessage
  | ParseErrorMessage
  | ParseCancelledMessage;
