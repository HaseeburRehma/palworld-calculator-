"use client";

/**
 * Save-file import page.
 *
 * Strict client-side flow:
 *   1. User drops a .sav file. We validate the extension + size before
 *      reading bytes; reject obvious non-saves.
 *   2. Buffer is transferred (zero copy) to the parse worker.
 *   3. Worker parses, streams progress, returns ParsedPals + diagnostics.
 *   4. User reviews preview (virtualized — saves can be huge), picks a
 *      merge mode, commits.
 *   5. Roster is merged via `mergeImport` and persisted to localStorage.
 *
 * No network calls happen during this flow. The dev-mode network sentinel
 * (`useNetworkSentinel`) warns loudly if anything tries.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";

import { Card } from "@/components/ui/Card";
import { ElementBadge } from "@/components/ElementBadge";
import { PalImage } from "@/components/PalImage";
import { PassiveBadge } from "@/components/PassiveBadge";
import { getPalById } from "@/lib/data/pals";
import { getPassiveById } from "@/lib/data/passives";
import { useNetworkSentinel } from "@/lib/util/useNetworkSentinel";
import {
  loadRoster,
  mergeImport,
  saveRoster,
  type MergeMode,
} from "@/lib/roster";
import { createParseClient } from "@/lib/workers/parseClient";
import type { ParseResult, ParseProgress, ParsedPal } from "@/lib/save";
import type { Pal, PassiveSkill } from "@/types/pal";

type Phase =
  | { kind: "idle" }
  | { kind: "reading"; fileName: string }
  | { kind: "parsing"; fileName: string; progress: ParseProgress | null }
  | { kind: "preview"; fileName: string; result: ParseResult }
  | { kind: "committed"; summary: CommitSummary }
  | { kind: "error"; message: string };

interface CommitSummary {
  fileName: string;
  added: number;
  skippedDuplicates: number;
  skippedUnmapped: number;
  keptNotInImport: number;
  totalAfter: number;
}

const ACCEPT_EXTENSIONS = [".sav"];
const MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024; // 250 MB

export default function ImportPage() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mergeMode, setMergeMode] = useState<MergeMode>("smart");

  // Dev-mode warning if anything tries to call out during this flow.
  useNetworkSentinel(true);

  // Pathfind/parse client lifecycle.
  const clientRef = useRef<ReturnType<typeof createParseClient> | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    clientRef.current = createParseClient();
    return () => {
      clientRef.current?.dispose();
      clientRef.current = null;
    };
  }, []);

  const handleFile = async (file: File) => {
    setPhase({ kind: "reading", fileName: file.name });
    setSelected(new Set());

    const lowerName = file.name.toLowerCase();
    if (!ACCEPT_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      setPhase({
        kind: "error",
        message: `Wrong file type — expected one of ${ACCEPT_EXTENSIONS.join(", ")}.`,
      });
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setPhase({
        kind: "error",
        message: `File is ${formatBytes(file.size)}; max supported is ${formatBytes(MAX_FILE_SIZE_BYTES)}.`,
      });
      return;
    }

    let buffer: ArrayBuffer;
    try {
      buffer = await file.arrayBuffer();
    } catch (e) {
      setPhase({ kind: "error", message: `Couldn't read file: ${(e as Error).message}` });
      return;
    }

    setPhase({ kind: "parsing", fileName: file.name, progress: null });

    const client = clientRef.current;
    if (!client) {
      setPhase({ kind: "error", message: "Parser not available." });
      return;
    }

    cancelRef.current?.();
    const job = client.run(buffer, {
      onProgress: (p) =>
        setPhase((curr) =>
          curr.kind === "parsing" ? { ...curr, progress: p } : curr,
        ),
    });
    cancelRef.current = job.cancel;

    try {
      const { result, completed } = await job.promise;
      if (!completed) {
        setPhase({ kind: "idle" });
        return;
      }
      // Default selection: every mapped, player-owned Pal.
      const initialSelection = new Set(
        result.pals.filter((p) => p.isPlayerOwned && p.palId !== null).map((p) => p.rawId),
      );
      setSelected(initialSelection);
      setPhase({ kind: "preview", fileName: file.name, result });
    } catch (e) {
      setPhase({
        kind: "error",
        message: `Parsing failed: ${(e as Error).message}`,
      });
    }
  };

  const handleCommit = () => {
    if (phase.kind !== "preview") return;
    // loadRoster falls back to an empty roster when storage is unavailable.
    const start = loadRoster();
    const merged = mergeImport(start, phase.result.pals, {
      mode: mergeMode,
      selectedRawIds: selected,
    });
    saveRoster(merged.roster);
    setPhase({
      kind: "committed",
      summary: {
        fileName: phase.fileName,
        added: merged.stats.added,
        skippedDuplicates: merged.stats.skippedDuplicates,
        skippedUnmapped: merged.stats.skippedUnmapped,
        keptNotInImport: merged.stats.keptNotInImport,
        totalAfter: merged.stats.totalAfter,
      },
    });
  };

  const handleCancel = () => {
    cancelRef.current?.();
    setPhase({ kind: "idle" });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Import a save file</h1>
        <p className="mt-1 max-w-prose text-sm text-[rgb(var(--muted))]">
          Drop your Palworld <code>.sav</code> file below to populate your roster automatically.
          Saves are usually under{" "}
          <code>
            %LOCALAPPDATA%\Pal\Saved\SaveGames\&lt;steamId&gt;\&lt;worldId&gt;\Level.sav
          </code>{" "}
          on Windows.
        </p>
      </header>

      <PrivacyBanner />

      {phase.kind === "idle" && <DropZone onFile={handleFile} />}

      {phase.kind === "reading" && (
        <Card className="text-sm text-[rgb(var(--muted))]">Reading {phase.fileName}…</Card>
      )}

      {phase.kind === "parsing" && (
        <ParsingPanel fileName={phase.fileName} progress={phase.progress} onCancel={handleCancel} />
      )}

      {phase.kind === "error" && (
        <Card className="border-rose-500/40 bg-rose-500/10 text-sm text-rose-700 dark:text-rose-300">
          <p>
            <strong>Couldn&apos;t import.</strong> {phase.message}
          </p>
          <button
            type="button"
            onClick={() => setPhase({ kind: "idle" })}
            className="mt-2 rounded-md border border-rose-500/40 px-3 py-1 text-xs hover:bg-rose-500/15"
          >
            Try another file
          </button>
        </Card>
      )}

      {phase.kind === "preview" && (
        <PreviewPanel
          result={phase.result}
          selected={selected}
          setSelected={setSelected}
          mergeMode={mergeMode}
          setMergeMode={setMergeMode}
          onCommit={handleCommit}
          onStartOver={() => setPhase({ kind: "idle" })}
        />
      )}

      {phase.kind === "committed" && (
        <CommittedPanel
          summary={phase.summary}
          onAnother={() => setPhase({ kind: "idle" })}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Privacy banner                                                            */
/* -------------------------------------------------------------------------- */

function PrivacyBanner() {
  return (
    <Card className="border-emerald-500/40 bg-emerald-500/5 text-sm">
      <p className="font-medium text-emerald-700 dark:text-emerald-300">
        Your save file never leaves your device.
      </p>
      <p className="mt-1 text-[rgb(var(--muted))]">
        Parsing happens entirely in your browser. Open your browser&apos;s
        DevTools → Network tab while you import to verify zero outbound
        requests.{" "}
        <Link href="/privacy" className="text-emerald-700 hover:underline dark:text-emerald-300">
          How this works →
        </Link>
      </p>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Drop zone                                                                 */
/* -------------------------------------------------------------------------- */

function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [hover, setHover] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={
        "rounded-lg border-2 border-dashed p-8 text-center transition-colors " +
        (hover
          ? "border-[rgb(var(--ring))] bg-[rgb(var(--background))]"
          : "border-[rgb(var(--border))] bg-[rgb(var(--card))]")
      }
    >
      <p className="text-base font-medium">Drop a .sav file here</p>
      <p className="mt-1 text-sm text-[rgb(var(--muted))]">
        or{" "}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="font-medium text-[rgb(var(--foreground))] underline-offset-2 hover:underline"
        >
          choose a file
        </button>
        . Up to {formatBytes(MAX_FILE_SIZE_BYTES)}.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".sav"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Parsing panel                                                             */
/* -------------------------------------------------------------------------- */

function ParsingPanel({
  fileName,
  progress,
  onCancel,
}: {
  fileName: string;
  progress: ParseProgress | null;
  onCancel: () => void;
}) {
  const phaseLabel = progress
    ? progress.phase === "decompress"
      ? "Decompressing…"
      : progress.phase === "parse"
        ? "Reading save data…"
        : "Extracting Pals…"
    : "Starting…";
  const pct = progress ? Math.round(progress.progress * 100) : 0;
  return (
    <Card className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span>{fileName}</span>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[rgb(var(--muted))] hover:underline"
        >
          Cancel
        </button>
      </div>
      <div className="text-xs text-[rgb(var(--muted))]">{phaseLabel}</div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--background))]"
      >
        <div
          className="h-full bg-[rgb(var(--foreground))] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Preview panel — virtualized list                                          */
/* -------------------------------------------------------------------------- */

interface PreviewProps {
  result: ParseResult;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  mergeMode: MergeMode;
  setMergeMode: (m: MergeMode) => void;
  onCommit: () => void;
  onStartOver: () => void;
}

function PreviewPanel({
  result,
  selected,
  setSelected,
  mergeMode,
  setMergeMode,
  onCommit,
  onStartOver,
}: PreviewProps) {
  const [filter, setFilter] = useState<"all" | "mapped" | "unmapped">("all");
  const [hideNoPassives, setHideNoPassives] = useState(false);
  const [hideLowLevel, setHideLowLevel] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [copied, setCopied] = useState(false);

  const visible = useMemo(() => {
    return result.pals.filter((p) => {
      if (!p.isPlayerOwned) return false;
      if (filter === "mapped" && p.palId === null) return false;
      if (filter === "unmapped" && p.palId !== null) return false;
      if (hideNoPassives && p.passives.length === 0) return false;
      if (hideLowLevel && p.level < 5) return false;
      return true;
    });
  }, [result.pals, filter, hideNoPassives, hideLowLevel]);

  const toggleOne = (rawId: string) => {
    const next = new Set(selected);
    if (next.has(rawId)) next.delete(rawId);
    else next.add(rawId);
    setSelected(next);
  };

  const selectAllVisible = () => {
    const next = new Set(selected);
    for (const p of visible) if (p.palId !== null) next.add(p.rawId);
    setSelected(next);
  };
  const clearAllVisible = () => {
    const next = new Set(selected);
    for (const p of visible) next.delete(p.rawId);
    setSelected(next);
  };

  const copyDiagnostics = async () => {
    const text = formatDiagnostics(result);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy these diagnostics into a bug report:", text);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">
            Found {result.pals.filter((p) => p.isPlayerOwned).length} player-owned Pals
          </h2>
          <p className="text-xs text-[rgb(var(--muted))]">
            {result.saveVersion}
            {result.detectedGameVersion && ` · engine ${result.detectedGameVersion}`}
          </p>
        </div>
        {result.errors.some((e) => !e.fatal) && (
          <ul className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
            {result.errors.map((e, i) => (
              <li key={i}>
                <strong>{e.code}:</strong> {e.message}
              </li>
            ))}
          </ul>
        )}
        {result.pals.filter((p) => p.isPlayerOwned).length === 0 && (
          <p className="text-sm text-[rgb(var(--muted))]">
            Looks like there are no player-owned Pals in this save yet. Catch some and try
            again!
          </p>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              Show:
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-2 py-1 text-sm"
              >
                <option value="all">All</option>
                <option value="mapped">Mapped only</option>
                <option value="unmapped">Unmapped only</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={hideNoPassives}
                onChange={(e) => setHideNoPassives(e.target.checked)}
              />
              Hide no-passive Pals
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={hideLowLevel}
                onChange={(e) => setHideLowLevel(e.target.checked)}
              />
              Hide level &lt; 5
            </label>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <button type="button" onClick={selectAllVisible} className="hover:underline">
              Select all visible
            </button>
            <button type="button" onClick={clearAllVisible} className="hover:underline">
              Clear visible
            </button>
            <span className="text-[rgb(var(--muted))]">{selected.size} selected</span>
          </div>
        </div>

        <PreviewList visible={visible} selected={selected} onToggle={toggleOne} />
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base font-semibold">Merge mode</h2>
        <div className="space-y-2 text-sm">
          {(
            [
              {
                value: "smart",
                label: "Smart merge",
                description:
                  "Add new Pals; skip exact duplicates; keep existing Pals not in this save.",
              },
              {
                value: "append",
                label: "Add to my roster",
                description: "Add every selected Pal — may produce duplicates.",
              },
              {
                value: "replace",
                label: "Replace my roster",
                description: "Clear existing entries first, then write the selected Pals.",
              },
            ] as const
          ).map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name="merge-mode"
                value={opt.value}
                checked={mergeMode === opt.value}
                onChange={() => setMergeMode(opt.value)}
                className="mt-1"
              />
              <div>
                <div className="font-medium">{opt.label}</div>
                <div className="text-xs text-[rgb(var(--muted))]">{opt.description}</div>
              </div>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={onStartOver}
            className="text-sm text-[rgb(var(--muted))] hover:underline"
          >
            ← Choose a different file
          </button>
          <button
            type="button"
            onClick={onCommit}
            disabled={selected.size === 0}
            className={
              "rounded-md bg-[rgb(var(--foreground))] px-3 py-1.5 text-sm font-medium " +
              "text-[rgb(var(--background))] disabled:opacity-50"
            }
          >
            Import {selected.size} Pal{selected.size === 1 ? "" : "s"}
          </button>
        </div>
      </Card>

      <Card>
        <button
          type="button"
          onClick={() => setShowDiagnostics((s) => !s)}
          aria-expanded={showDiagnostics}
          className="text-sm font-medium hover:underline"
        >
          {showDiagnostics ? "Hide" : "Show"} parsing details
        </button>
        {showDiagnostics && (
          <div className="mt-3 space-y-3 text-xs">
            <div>
              <p className="text-[rgb(var(--muted))]">Unmapped Pal ids: {result.unmappedPalIds.length}</p>
              {result.unmappedPalIds.length > 0 && (
                <p className="mt-1 font-mono">{result.unmappedPalIds.join(", ")}</p>
              )}
            </div>
            <div>
              <p className="text-[rgb(var(--muted))]">
                Unmapped passive ids: {result.unmappedPassiveIds.length}
              </p>
              {result.unmappedPassiveIds.length > 0 && (
                <p className="mt-1 font-mono">{result.unmappedPassiveIds.join(", ")}</p>
              )}
            </div>
            {result.warnings.length > 0 && (
              <ul className="space-y-1">
                {result.warnings.map((w, i) => (
                  <li key={i}>
                    <strong>{w.code}:</strong> {w.message}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={copyDiagnostics}
              className="rounded-md border border-[rgb(var(--border))] px-2.5 py-1 text-xs hover:border-[rgb(var(--ring))]"
            >
              {copied ? "Copied!" : "Copy diagnostics"}
            </button>
            <p className="text-[rgb(var(--muted))]">
              Diagnostics include only counts and id strings — never your save bytes.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Virtualized preview list                                                  */
/* -------------------------------------------------------------------------- */

function PreviewList({
  visible,
  selected,
  onToggle,
}: {
  visible: ReadonlyArray<ParsedPal>;
  selected: Set<string>;
  onToggle: (rawId: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });

  if (visible.length === 0) {
    return (
      <p className="text-sm text-[rgb(var(--muted))]">
        Nothing matches the current filters.
      </p>
    );
  }

  return (
    <div
      ref={parentRef}
      className="max-h-[24rem] overflow-y-auto rounded-md border border-[rgb(var(--border))]"
    >
      <div
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        className="relative w-full"
      >
        {rowVirtualizer.getVirtualItems().map((vrow) => {
          const pal = visible[vrow.index]!;
          return (
            <div
              key={pal.rawId + ":" + vrow.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${vrow.size}px`,
                transform: `translateY(${vrow.start}px)`,
              }}
            >
              <PreviewRow pal={pal} selected={selected.has(pal.rawId)} onToggle={onToggle} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PreviewRow({
  pal,
  selected,
  onToggle,
}: {
  pal: ParsedPal;
  selected: boolean;
  onToggle: (rawId: string) => void;
}) {
  const palRecord: Pal | undefined = pal.palId ? getPalById(pal.palId) : undefined;
  const passiveObjs = pal.passives
    .map((id) => getPassiveById(id))
    .filter((p): p is PassiveSkill => Boolean(p));
  const unmapped = pal.palId === null;

  return (
    <label
      className={
        "flex h-full items-center gap-3 border-b border-[rgb(var(--border))] px-3 " +
        (unmapped ? "bg-amber-500/5" : "")
      }
    >
      <input
        type="checkbox"
        checked={selected}
        disabled={unmapped}
        onChange={() => onToggle(pal.rawId)}
      />
      {palRecord ? <PalImage pal={palRecord} /> : <UnmappedTile />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">
            {palRecord?.name ?? pal.rawId}
          </span>
          <span className="text-xs text-[rgb(var(--muted))]">Lv {pal.level}</span>
          {pal.gender && (
            <span className="text-xs text-[rgb(var(--muted))]">·{pal.gender}</span>
          )}
          {unmapped && (
            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
              unmapped
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {palRecord?.elements.map((e) => <ElementBadge key={e} element={e} />)}
          {passiveObjs.map((p) => (
            <PassiveBadge key={p.id} passive={p} compact />
          ))}
          {pal.unmappedPassiveCount > 0 && (
            <span className="text-[10px] text-amber-700 dark:text-amber-300">
              +{pal.unmappedPassiveCount} unmapped
            </span>
          )}
        </div>
      </div>
    </label>
  );
}

function UnmappedTile() {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-xs font-mono text-amber-700 dark:text-amber-300">
      ??
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Committed panel                                                           */
/* -------------------------------------------------------------------------- */

function CommittedPanel({
  summary,
  onAnother,
}: {
  summary: CommitSummary;
  onAnother: () => void;
}) {
  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">Imported {summary.added} Pals</h2>
      <ul className="space-y-1 text-sm text-[rgb(var(--muted))]">
        <li>From: {summary.fileName}</li>
        {summary.skippedDuplicates > 0 && (
          <li>Skipped {summary.skippedDuplicates} exact duplicate(s)</li>
        )}
        {summary.skippedUnmapped > 0 && (
          <li>Skipped {summary.skippedUnmapped} unmapped Pal(s)</li>
        )}
        {summary.keptNotInImport > 0 && (
          <li>Kept {summary.keptNotInImport} existing Pal(s) not present in this save</li>
        )}
        <li>Roster total now: {summary.totalAfter}</li>
      </ul>
      <div className="flex gap-3 pt-1">
        <Link
          href="/roster"
          className={
            "rounded-md bg-[rgb(var(--foreground))] px-3 py-1.5 text-sm font-medium " +
            "text-[rgb(var(--background))]"
          }
        >
          View my roster
        </Link>
        <button
          type="button"
          onClick={onAnother}
          className="rounded-md border border-[rgb(var(--border))] px-3 py-1.5 text-sm hover:border-[rgb(var(--ring))]"
        >
          Import another file
        </button>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDiagnostics(result: ParseResult): string {
  const lines: string[] = [];
  lines.push(`saveVersion: ${result.saveVersion}`);
  lines.push(`detectedGameVersion: ${result.detectedGameVersion ?? "(unknown)"}`);
  lines.push(`pals: ${result.pals.length}`);
  lines.push(`unmappedPalIds (${result.unmappedPalIds.length}): ${result.unmappedPalIds.join(", ")}`);
  lines.push(
    `unmappedPassiveIds (${result.unmappedPassiveIds.length}): ${result.unmappedPassiveIds.join(", ")}`,
  );
  if (result.warnings.length > 0) {
    lines.push("warnings:");
    for (const w of result.warnings) lines.push(`  - ${w.code}: ${w.message}`);
  }
  if (result.errors.length > 0) {
    lines.push("errors:");
    for (const e of result.errors) lines.push(`  - ${e.code} (fatal=${e.fatal}): ${e.message}`);
  }
  return lines.join("\n");
}
