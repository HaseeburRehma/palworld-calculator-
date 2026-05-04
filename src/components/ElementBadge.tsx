import type { Element } from "@/types/pal";

const ELEMENT_CLASSES: Record<Element, string> = {
  Neutral: "bg-element-neutral/15 text-element-neutral border-element-neutral/40",
  Fire: "bg-element-fire/15 text-element-fire border-element-fire/40",
  Water: "bg-element-water/15 text-element-water border-element-water/40",
  Grass: "bg-element-grass/15 text-element-grass border-element-grass/40",
  Electric: "bg-element-electric/15 text-element-electric border-element-electric/40",
  Ice: "bg-element-ice/15 text-element-ice border-element-ice/40",
  Ground: "bg-element-ground/15 text-element-ground border-element-ground/40",
  Dark: "bg-element-dark/15 text-element-dark border-element-dark/40",
  Dragon: "bg-element-dragon/15 text-element-dragon border-element-dragon/40",
};

export function ElementBadge({ element }: { element: Element }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium " +
        ELEMENT_CLASSES[element]
      }
    >
      {element}
    </span>
  );
}
