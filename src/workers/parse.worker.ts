/// <reference lib="webworker" />
/**
 * Save-file parsing worker.
 *
 * Receives an ArrayBuffer (transferred — the main thread loses access),
 * runs `parseSaveFile`, streams progress updates, then posts the result.
 *
 * The buffer is discarded as soon as the parse completes — never copied
 * to indexed storage, never written to disk, never sent over the network.
 * The `/privacy` page documents this guarantee; this file is the
 * implementation that backs it.
 */

import { parseSaveFile } from "@/lib/save";
import type {
  ParseClientMessage,
  ParseWorkerMessage,
} from "@/lib/workers/parse-protocol";

const cancelled = new Set<string>();

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async (e: MessageEvent<ParseClientMessage>) => {
  const msg = e.data;
  if (msg.type === "cancel") {
    cancelled.add(msg.jobId);
    return;
  }
  if (msg.type !== "run") return;

  const { jobId, buffer } = msg;

  try {
    const result = await parseSaveFile(buffer, {
      onProgress: (progress) => {
        if (cancelled.has(jobId)) return;
        send({ type: "progress", jobId, progress });
      },
    });

    if (cancelled.has(jobId)) {
      cancelled.delete(jobId);
      send({ type: "cancelled", jobId });
      return;
    }
    send({ type: "result", jobId, result });
  } catch (err) {
    send({
      type: "error",
      jobId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

function send(msg: ParseWorkerMessage): void {
  self.postMessage(msg);
}

export {};
