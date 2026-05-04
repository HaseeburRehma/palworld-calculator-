import type { PassiveSkill } from "@/types/pal";

const TIER_CLASSES: Record<PassiveSkill["tier"], string> = {
  positive: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-300",
  negative: "bg-rose-500/15 text-rose-700 border-rose-500/40 dark:text-rose-300",
  neutral: "bg-slate-500/15 text-slate-700 border-slate-500/40 dark:text-slate-300",
};

interface Props {
  passive: PassiveSkill;
  /** Click handler — used by the multi-select for "remove this chip". */
  onRemove?: () => void;
  /** Render compactly (no rank suffix). */
  compact?: boolean;
}

export function PassiveBadge({ passive, onRemove, compact = false }: Props) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium " +
        TIER_CLASSES[passive.tier]
      }
      title={passive.effect}
    >
      <span>{passive.name}</span>
      {!compact && passive.rank > 1 && (
        <span aria-label={`rank ${passive.rank}`} className="opacity-70">
          ·{passive.rank}
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${passive.name}`}
          className="ml-0.5 rounded-full px-1 text-base leading-none hover:bg-black/10 dark:hover:bg-white/10"
        >
          ×
        </button>
      )}
    </span>
  );
}
