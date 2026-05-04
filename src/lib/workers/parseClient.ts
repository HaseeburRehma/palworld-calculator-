/**
 * Main-thread wrapper around the parse worker.
 *
 *   const client = createParseClient();
 *   const job = client.run(buffer, { onProgress, timeoutMs: 60_000 });
 *   const result = await job.promise;
 *   job.cancel();
 *   client.dispose();
 *
 * Behavior:
 *   - Transfers the ArrayBuffer to the worker (zero copy, main thread loses access).
 *   - Streams progress to the supplied callback.
 *   - 60-second default timeout; on timeout the worker is terminated and the
 *     promise rejects with a clean error.
 *   - Sync fallback runs the parser on the main thread when Worker is
 *     unavailable (tests, SSR). This is fine — the algorithm is the same.
 */

import { newUuid } from "@/lib/util/uuid";
import { parseSaveFile, type ParseResult, type ParseProgress } from "@/lib/save";
import type {
  ParseClientMessage,
  ParseWorkerMessage,
} from "./parse-protocol";

export interface ParseClientResult {
  result: ParseResult;
  completed: boolean;
}

export interface ParseRunOptions {
  onProgress?: (p: ParseProgress) => void;
  /** Hard cap. Worker is terminated and promise rejects on overrun. Default 60s. */
  timeoutMs?: number;
}

export interface ParseRunHandle {
  jobId: string;
  promise: Promise<ParseClientResult>;
  cancel: () => void;
}

export interface ParseClient {
  run(buffer: ArrayBuffer, opts?: ParseRunOptions): ParseRunHandle;
  dispose(): void;
}

const DEFAULT_TIMEOUT_MS = 60_000;

export function createParseClient(): ParseClient {
  if (typeof Worker === "undefined") return makeSyncClient();
  try {
    return makeWorkerClient();
  } catch {
    return makeSyncClient();
  }
}

/* -------------------------------------------------------------------------- */

function makeWorkerClient(): ParseClient {
  const worker = new Worker(
    new URL("../../workers/parse.worker.ts", import.meta.url),
    { type: "module" },
  );

  type Pending = {
    resolve: (r: ParseClientResult) => void;
    reject: (e: Error) => void;
    onProgress?: (p: ParseProgress) => void;
    cancelled: boolean;
    timeout: ReturnType<typeof setTimeout>;
  };
  const pending = new Map<string, Pending>();

  worker.onmessage = (e: MessageEvent<ParseWorkerMessage>) => {
    const msg = e.data;
    const entry = pending.get(msg.jobId);
    if (!entry) return;
    switch (msg.type) {
      case "progress":
        entry.onProgress?.(msg.progress);
        return;
      case "result":
        clearTimeout(entry.timeout);
        entry.resolve({ result: msg.result, completed: !entry.cancelled });
        pending.delete(msg.jobId);
        return;
      case "cancelled":
        clearTimeout(entry.timeout);
        entry.resolve({
          result: emptyResult(),
          completed: false,
        });
        pending.delete(msg.jobId);
        return;
      case "error":
        clearTimeout(entry.timeout);
        entry.reject(new Error(msg.message));
        pending.delete(msg.jobId);
        return;
    }
  };

  worker.onerror = (e) => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timeout);
      entry.reject(new Error(e.message ?? "Parse worker errored"));
    }
    pending.clear();
  };

  return {
    run(buffer, opts = {}) {
      const jobId = newUuid();
      const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const promise = new Promise<ParseClientResult>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(jobId);
          worker.postMessage({ type: "cancel", jobId } satisfies ParseClientMessage);
          reject(new Error(`Parse timed out after ${timeoutMs} ms.`));
        }, timeoutMs);

        pending.set(jobId, {
          resolve,
          reject,
          onProgress: opts.onProgress,
          cancelled: false,
          timeout,
        });
        // Transfer ownership of the buffer — main thread loses it after this.
        worker.postMessage({ type: "run", jobId, buffer } satisfies ParseClientMessage, [buffer]);
      });
      return {
        jobId,
        promise,
        cancel: () => {
          const entry = pending.get(jobId);
          if (entry) entry.cancelled = true;
          worker.postMessage({ type: "cancel", jobId } satisfies ParseClientMessage);
        },
      };
    },
    dispose() {
      for (const entry of pending.values()) clearTimeout(entry.timeout);
      pending.clear();
      worker.terminate();
    },
  };
}

/* -------------------------------------------------------------------------- */

function makeSyncClient(): ParseClient {
  return {
    run(buffer, opts = {}) {
      const jobId = newUuid();
      let cancelled = false;
      const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const promise = (async () => {
        const timer = setTimeout(() => {
          cancelled = true;
        }, timeoutMs);
        try {
          const result = await parseSaveFile(buffer, {
            onProgress: (p) => {
              if (!cancelled) opts.onProgress?.(p);
            },
          });
          if (cancelled) return { result: emptyResult(), completed: false };
          return { result, completed: true };
        } finally {
          clearTimeout(timer);
        }
      })();
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

function emptyResult(): ParseResult {
  return {
    saveVersion: "unknown",
    detectedGameVersion: null,
    pals: [],
    warnings: [],
    errors: [],
    unmappedPalIds: [],
    unmappedPassiveIds: [],
  };
}
