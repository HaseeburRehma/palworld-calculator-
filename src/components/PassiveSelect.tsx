"use client";

import { useId, useMemo, useState } from "react";

import { PassiveBadge } from "./PassiveBadge";
import type { PassiveSkill } from "@/types/pal";

interface Props {
  label: string;
  passives: ReadonlyArray<PassiveSkill>;
  /** Currently selected passives. */
  value: PassiveSkill[];
  onChange: (next: PassiveSkill[]) => void;
  /** Maximum number of selections. Defaults to 4 (Pal passive cap). */
  max?: number;
}

/**
 * Multi-select for passives. Shows selected as chips, with a search box that
 * filters the master list. Selecting a passive that's already in the list
 * removes it (toggle behavior). Caps at `max` selections.
 *
 * Accessibility: label, real input, keyboard navigation. See PalSelect for
 * the same interaction model — this is its multi-select cousin.
 */
export function PassiveSelect({ label, passives, value, onChange, max = 4 }: Props) {
  const inputId = useId();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  const selectedIds = useMemo(() => new Set(value.map((p) => p.id)), [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? passives.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.id.toLowerCase().includes(q) ||
            p.effect.toLowerCase().includes(q),
        )
      : [...passives];
    // Group by tier: positive first, then neutral, then negative.
    const order = { positive: 0, neutral: 1, negative: 2 };
    return list.sort((a, b) => {
      if (order[a.tier] !== order[b.tier]) return order[a.tier] - order[b.tier];
      return a.name.localeCompare(b.name);
    });
  }, [passives, query]);

  const toggle = (passive: PassiveSkill) => {
    if (selectedIds.has(passive.id)) {
      onChange(value.filter((p) => p.id !== passive.id));
    } else {
      if (value.length >= max) return;
      onChange([...value, passive]);
    }
    setQuery("");
    setActiveIdx(0);
  };

  const remove = (id: string) => onChange(value.filter((p) => p.id !== id));

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-[rgb(var(--foreground))]"
      >
        {label}
        <span className="ml-2 text-xs text-[rgb(var(--muted))]">
          {value.length}/{max}
        </span>
      </label>

      <div
        className={
          "mt-1 flex min-h-[2.5rem] flex-wrap items-center gap-1.5 rounded-md border " +
          "border-[rgb(var(--border))] bg-[rgb(var(--card))] px-2 py-1.5 " +
          "focus-within:border-[rgb(var(--ring))]"
        }
      >
        {value.map((p) => (
          <PassiveBadge key={p.id} passive={p} onRemove={() => remove(p.id)} />
        ))}
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder={value.length === 0 ? "Search passives…" : ""}
          disabled={value.length >= max}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIdx(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const pick = filtered[activeIdx];
              if (pick) toggle(pick);
            } else if (e.key === "Escape") {
              setOpen(false);
            } else if (e.key === "Backspace" && query === "" && value.length > 0) {
              // Quick remove of last chip.
              onChange(value.slice(0, -1));
            }
          }}
          className="min-w-[8rem] flex-1 bg-transparent text-sm focus:outline-none"
        />
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className={
            "absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-md border " +
            "border-[rgb(var(--border))] bg-[rgb(var(--card))] shadow-lg"
          }
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-[rgb(var(--muted))]">
              No passives match “{query}”.
            </li>
          )}
          {filtered.map((p, idx) => {
            const isActive = idx === activeIdx;
            const isSelected = selectedIds.has(p.id);
            return (
              <li
                key={p.id}
                role="option"
                aria-selected={isSelected}
                className={
                  "flex cursor-pointer items-start justify-between gap-3 px-3 py-2 text-sm " +
                  (isActive ? "bg-[rgb(var(--background))]" : "") +
                  (isSelected ? " opacity-60" : "")
                }
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggle(p);
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <PassiveBadge passive={p} compact />
                    {isSelected && (
                      <span className="text-xs text-[rgb(var(--muted))]">selected</span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-[rgb(var(--muted))]">
                    {p.effect}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
