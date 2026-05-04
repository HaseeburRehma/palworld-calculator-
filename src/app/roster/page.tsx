"use client";

/**
 * Owned-Pal roster — local-first, browser-only.
 *
 * The state is held in React + persisted to `localStorage` via `lib/roster`.
 * Everything visible on this page is your own; nothing leaves your machine
 * unless you click Export.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useHydratedStore } from "@/lib/util/useHydratedStore";

import { Card } from "@/components/ui/Card";
import { ElementBadge } from "@/components/ElementBadge";
import { PalImage } from "@/components/PalImage";
import { PalSelect } from "@/components/PalSelect";
import { PassiveBadge } from "@/components/PassiveBadge";
import { PassiveSelect } from "@/components/PassiveSelect";
import { allPals, getPalById } from "@/lib/data/pals";
import { allPassives, getPassiveById } from "@/lib/data/passives";
import {
  addPal,
  emptyRoster,
  exportRoster,
  importRoster,
  loadRoster,
  removePal,
  saveRoster,
  updatePal,
} from "@/lib/roster";
import type {
  Element,
  OwnedPal,
  Pal,
  PassiveSkill,
  Roster,
} from "@/types/pal";

type SortKey = "added" | "name" | "paldex";

export default function RosterPage() {
  const [storageOk, setStorageOk] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);
  const [filterElement, setFilterElement] = useState<Element | "all">("all");
  const [filterPassive, setFilterPassive] = useState<string>("");
  const [filterSource, setFilterSource] = useState<"all" | "manual" | "import">("all");
  const [sortKey, setSortKey] = useState<SortKey>("added");

  // Hydrate from localStorage on mount; skip the first save so we don't
  // clobber the stored value with the seed empty roster before hydration.
  const [roster, setRoster] = useHydratedStore<Roster>(
    () => emptyRoster(),
    () => loadRoster(),
    (r) => setStorageOk(saveRoster(r)),
  );

  const visible = useMemo(
    () => filterAndSort(roster.pals, filterElement, filterPassive, filterSource, sortKey),
    [roster.pals, filterElement, filterPassive, filterSource, sortKey],
  );

  const handleAdd = (input: { palId: string; passives: string[]; nickname: string }) => {
    setRoster((r) => addPal(r, input));
  };
  const handleRemove = (id: string) => setRoster((r) => removePal(r, id));
  const handleUpdate = (id: string, patch: Partial<Omit<OwnedPal, "instanceId">>) => {
    setRoster((r) => updatePal(r, id, patch));
  };

  const handleExport = () => {
    const blob = new Blob([exportRoster(roster)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `palworld-roster-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleImportClick = () => fileInputRef.current?.click();
  const handleImportFile = async (file: File) => {
    setImportError(null);
    const text = await file.text();
    const result = importRoster(text);
    if (!result.ok) {
      setImportError(result.errors.join("; "));
      return;
    }
    setRoster(result.roster);
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Roster</h1>
        <p className="mt-1 max-w-prose text-sm text-[rgb(var(--muted))]">
          List the Pals you own and the passives on each. The pathfinder uses
          this list to find the shortest breeding chain to your goals.
        </p>
        <p className="mt-1 text-xs text-[rgb(var(--muted))]">
          Stored locally in your browser. No account, no server. Click Export
          if you want a backup file.
        </p>
        {!storageOk && (
          <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            Couldn&apos;t save to <code>localStorage</code> — changes will be lost on
            reload. (Private browsing? Storage quota?)
          </p>
        )}
      </header>

      <AddPalForm onAdd={handleAdd} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              Element:
              <select
                value={filterElement}
                onChange={(e) => setFilterElement(e.target.value as Element | "all")}
                className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-2 py-1 text-sm"
              >
                <option value="all">All</option>
                {ELEMENT_OPTIONS.map((el) => (
                  <option key={el} value={el}>
                    {el}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              Passive:
              <select
                value={filterPassive}
                onChange={(e) => setFilterPassive(e.target.value)}
                className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-2 py-1 text-sm"
              >
                <option value="">Any</option>
                {allPassives.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              Source:
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value as typeof filterSource)}
                className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-2 py-1 text-sm"
              >
                <option value="all">Any</option>
                <option value="manual">Manual</option>
                <option value="import">Imported</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              Sort:
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-2 py-1 text-sm"
              >
                <option value="added">Order added</option>
                <option value="name">Name (A–Z)</option>
                <option value="paldex">Paldex #</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleImportClick}
              className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-1.5 text-sm hover:border-[rgb(var(--ring))]"
            >
              Import…
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={roster.pals.length === 0}
              className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-1.5 text-sm hover:border-[rgb(var(--ring))] disabled:opacity-50"
            >
              Export
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImportFile(f);
                e.target.value = ""; // allow re-importing the same file later
              }}
            />
          </div>
        </div>

        {importError && (
          <p
            role="alert"
            className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300"
          >
            Import failed — {importError}
          </p>
        )}

        {roster.pals.length === 0 ? (
          <Card className="text-center text-sm text-[rgb(var(--muted))]">
            <p className="mb-1 font-medium text-[rgb(var(--foreground))]">
              Your roster is empty.
            </p>
            <p>
              Add your first Pal above. Everything stays in your browser — no
              account, no server.
            </p>
          </Card>
        ) : (
          <RosterTable pals={visible} onUpdate={handleUpdate} onRemove={handleRemove} />
        )}
      </section>

      <p className="text-xs text-[rgb(var(--muted))]">
        Ready to plan?{" "}
        <Link
          href="/plan"
          className="font-medium text-[rgb(var(--foreground))] hover:underline"
        >
          Plan a breed →
        </Link>
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Add form                                                                  */
/* -------------------------------------------------------------------------- */

const ELEMENT_OPTIONS: Element[] = [
  "Neutral",
  "Fire",
  "Water",
  "Grass",
  "Electric",
  "Ice",
  "Ground",
  "Dark",
  "Dragon",
];

function AddPalForm({
  onAdd,
}: {
  onAdd: (input: { palId: string; passives: string[]; nickname: string }) => void;
}) {
  const [pal, setPal] = useState<Pal | null>(null);
  const [passives, setPassives] = useState<PassiveSkill[]>([]);
  const [nickname, setNickname] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pal) return;
    onAdd({
      palId: pal.id,
      passives: passives.map((p) => p.id),
      nickname,
    });
    setPal(null);
    setPassives([]);
    setNickname("");
  };

  return (
    <form
      onSubmit={submit}
      className={
        "space-y-3 rounded-lg border border-[rgb(var(--border))] " +
        "bg-[rgb(var(--card))] p-4 shadow-sm"
      }
    >
      <h2 className="text-base font-semibold">Add a Pal</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <PalSelect
          label="Species"
          pals={allPals}
          value={pal}
          onChange={setPal}
          placeholder="Search Pals…"
        />
        <PassiveSelect
          label="Passives on this Pal"
          passives={allPassives}
          value={passives}
          onChange={setPassives}
        />
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-sm font-medium">Nickname (optional)</span>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. Sparky"
            className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2"
            maxLength={60}
          />
        </label>
      </div>
      <div>
        <button
          type="submit"
          disabled={!pal}
          className={
            "rounded-md bg-[rgb(var(--foreground))] px-3 py-1.5 text-sm font-medium " +
            "text-[rgb(var(--background))] disabled:opacity-50"
          }
        >
          Add to roster
        </button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Table                                                                     */
/* -------------------------------------------------------------------------- */

function RosterTable({
  pals,
  onUpdate,
  onRemove,
}: {
  pals: ReadonlyArray<OwnedPal>;
  onUpdate: (id: string, patch: Partial<Omit<OwnedPal, "instanceId">>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[rgb(var(--border))]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[rgb(var(--border))] bg-[rgb(var(--background))] text-left text-xs uppercase tracking-wide text-[rgb(var(--muted))]">
            <th className="px-3 py-2 font-medium">Pal</th>
            <th className="px-3 py-2 font-medium">Passives</th>
            <th className="px-3 py-2 font-medium">Nickname</th>
            <th className="px-3 py-2 font-medium" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {pals.map((own) => (
            <RosterRow key={own.instanceId} own={own} onUpdate={onUpdate} onRemove={onRemove} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RosterRow({
  own,
  onUpdate,
  onRemove,
}: {
  own: OwnedPal;
  onUpdate: (id: string, patch: Partial<Omit<OwnedPal, "instanceId">>) => void;
  onRemove: (id: string) => void;
}) {
  const pal = getPalById(own.palId);
  const [editing, setEditing] = useState(false);
  const [draftNickname, setDraftNickname] = useState(own.nickname ?? "");
  const [draftPassives, setDraftPassives] = useState<PassiveSkill[]>(
    () =>
      own.passives
        .map((id) => getPassiveById(id))
        .filter((p): p is PassiveSkill => Boolean(p)),
  );

  if (!pal) {
    // Stale palId (data version drift). Surface it so users can clean up.
    return (
      <tr className="border-t border-[rgb(var(--border))]">
        <td colSpan={3} className="px-3 py-2 text-xs text-[rgb(var(--muted))]">
          Unknown species id <code>{own.palId}</code> — data may have changed.
        </td>
        <td className="px-3 py-2 text-right">
          <button
            type="button"
            onClick={() => onRemove(own.instanceId)}
            className="text-xs text-rose-600 hover:underline dark:text-rose-400"
          >
            Remove
          </button>
        </td>
      </tr>
    );
  }

  const passiveObjs = own.passives
    .map((id) => getPassiveById(id))
    .filter((p): p is PassiveSkill => Boolean(p));

  const save = () => {
    onUpdate(own.instanceId, {
      nickname: draftNickname,
      passives: draftPassives.map((p) => p.id),
    });
    setEditing(false);
  };

  const cancel = () => {
    setDraftNickname(own.nickname ?? "");
    setDraftPassives(passiveObjs);
    setEditing(false);
  };

  return (
    <tr className="border-t border-[rgb(var(--border))] align-top">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2.5">
          <PalImage pal={pal} />
          <div>
            <div className="font-medium">{pal.name}</div>
            <div className="text-xs text-[rgb(var(--muted))]">
              #{String(pal.paldexNo).padStart(3, "0")}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {pal.elements.map((e) => (
                <ElementBadge key={e} element={e} />
              ))}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        {editing ? (
          <PassiveSelect
            label=""
            passives={allPassives}
            value={draftPassives}
            onChange={setDraftPassives}
          />
        ) : passiveObjs.length === 0 ? (
          <span className="text-xs text-[rgb(var(--muted))]">none</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {passiveObjs.map((p) => (
              <PassiveBadge key={p.id} passive={p} compact />
            ))}
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        {editing ? (
          <input
            type="text"
            value={draftNickname}
            onChange={(e) => setDraftNickname(e.target.value)}
            className="w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-2 py-1 text-sm"
            maxLength={60}
          />
        ) : (
          <span className="text-sm">{own.nickname ?? <span className="text-[rgb(var(--muted))]">—</span>}</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {editing ? (
          <div className="flex justify-end gap-2">
            <button type="button" onClick={save} className="text-xs hover:underline">
              Save
            </button>
            <button
              type="button"
              onClick={cancel}
              className="text-xs text-[rgb(var(--muted))] hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setEditing(true)} className="text-xs hover:underline">
              Edit
            </button>
            <button
              type="button"
              onClick={() => onRemove(own.instanceId)}
              className="text-xs text-rose-600 hover:underline dark:text-rose-400"
            >
              Remove
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

/* -------------------------------------------------------------------------- */
/*  Filter / sort                                                             */
/* -------------------------------------------------------------------------- */

function filterAndSort(
  pals: ReadonlyArray<OwnedPal>,
  filterElement: Element | "all",
  filterPassive: string,
  filterSource: "all" | "manual" | "import",
  sortKey: SortKey,
): OwnedPal[] {
  const list = pals.filter((own) => {
    if (filterPassive && !own.passives.includes(filterPassive)) return false;
    if (filterElement !== "all") {
      const pal = getPalById(own.palId);
      if (!pal || !pal.elements.includes(filterElement)) return false;
    }
    if (filterSource !== "all") {
      const src = own.source ?? "manual";
      if (src !== filterSource) return false;
    }
    return true;
  });
  if (sortKey === "added") return list;
  return [...list].sort((a, b) => {
    const palA = getPalById(a.palId);
    const palB = getPalById(b.palId);
    if (!palA || !palB) return 0;
    if (sortKey === "paldex") return palA.paldexNo - palB.paldexNo;
    return palA.name.localeCompare(palB.name);
  });
}
