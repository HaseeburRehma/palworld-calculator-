"use client";

import { useId, useMemo, useState } from "react";
import type { Pal } from "@/types/pal";
import { ElementBadge } from "./ElementBadge";

interface Props {
  label: string;
  pals: ReadonlyArray<Pal>;
  value: Pal | null;
  onChange: (pal: Pal | null) => void;
  placeholder?: string;
}

/**
 * Searchable Pal dropdown. Hand-built so we don't pull in a UI library yet.
 *
 * Behavior:
 *   - Click the trigger or focus the input to open.
 *   - Typing filters by name, slug, or paldex number.
 *   - Up/Down arrows + Enter to select; Esc to close.
 *   - Click outside closes the dropdown.
 */
export function PalSelect({
  label,
  pals,
  value,
  onChange,
  placeholder = "Search Pals…",
}: Props) {
  const inputId = useId();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pals;
    return pals.filter((p) => {
      const paldex = String(p.paldexNo);
      return (
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        paldex === q ||
        paldex.padStart(3, "0").includes(q)
      );
    });
  }, [pals, query]);

  const selectAt = (idx: number) => {
    const pal = filtered[idx];
    if (!pal) return;
    onChange(pal);
    setQuery("");
    setOpen(false);
  };

  return (
    <div
      className="relative"
      onBlur={(e) => {
        // Close when focus leaves the entire control.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setOpen(false);
        }
      }}
    >
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-[rgb(var(--foreground))]"
      >
        {label}
      </label>

      <div className="mt-1">
        {value && !open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={
              "flex w-full items-center justify-between gap-3 rounded-md border " +
              "border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 text-left " +
              "hover:border-[rgb(var(--ring))]"
            }
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span className="flex items-center gap-2 truncate">
              <span className="font-medium">{value.name}</span>
              <span className="text-xs text-[rgb(var(--muted))]">
                #{String(value.paldexNo).padStart(3, "0")}
              </span>
            </span>
            <span className="flex shrink-0 gap-1">
              {value.elements.map((e) => (
                <ElementBadge key={e} element={e} />
              ))}
            </span>
            <span aria-hidden className="ml-auto pl-2 text-[rgb(var(--muted))]">
              ▾
            </span>
          </button>
        ) : (
          <input
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            placeholder={placeholder}
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
                setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIdx((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                selectAt(activeIdx);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            className={
              "block w-full rounded-md border border-[rgb(var(--border))] " +
              "bg-[rgb(var(--card))] px-3 py-2"
            }
          />
        )}
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
              No Pals match “{query}”.
            </li>
          )}
          {filtered.map((pal, idx) => {
            const isActive = idx === activeIdx;
            const isSelected = value?.id === pal.id;
            return (
              <li
                key={pal.id}
                role="option"
                aria-selected={isSelected}
                className={
                  "flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm " +
                  (isActive ? "bg-[rgb(var(--background))]" : "")
                }
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseDown={(e) => {
                  // mousedown (not click) fires before blur, so the dropdown
                  // can react before focus leaves.
                  e.preventDefault();
                  selectAt(idx);
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-10 shrink-0 text-xs text-[rgb(var(--muted))]">
                    #{String(pal.paldexNo).padStart(3, "0")}
                  </span>
                  <span className="truncate font-medium">{pal.name}</span>
                </span>
                <span className="flex shrink-0 gap-1">
                  {pal.elements.map((e) => (
                    <ElementBadge key={e} element={e} />
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {value && (
        <button
          type="button"
          className="mt-1 text-xs text-[rgb(var(--muted))] hover:underline"
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
