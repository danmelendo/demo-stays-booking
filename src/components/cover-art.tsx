import { PartyPopper, HeartPulse, Drama, Dumbbell, Store, type LucideIcon } from "lucide-react";
import type { EventCategory } from "@/integrations/cms";

// Decorative cover art so community/event cards aren't just a flat colour band.
// Rendered as translucent white SVG over the existing accent gradient, so it
// adapts to every province/category accent without extra image assets.

function Building({ x, y, w, cols, rows }: { x: number; y: number; w: number; cols: number; rows: number }) {
  const h = 200 - y;
  const winW = 6;
  const winH = 8;
  const gapX = (w - cols * winW) / (cols + 1);
  const gapY = (h - 14 - rows * winH) / (rows + 1);
  const windows = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      windows.push(
        <rect
          key={`${r}-${c}`}
          x={x + gapX + c * (winW + gapX)}
          y={y + 10 + gapY + r * (winH + gapY)}
          width={winW}
          height={winH}
          fill="white"
          fillOpacity={0.32}
        />,
      );
    }
  }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="white" fillOpacity={0.16} />
      {windows}
    </g>
  );
}

/** Urbanization skyline silhouette for community/complex covers. */
export function ComplexCoverArt() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <Building x={26} y={118} w={52} cols={3} rows={4} />
      <Building x={86} y={74} w={64} cols={4} rows={6} />
      <Building x={158} y={140} w={40} cols={2} rows={3} />
      <Building x={214} y={128} w={48} cols={3} rows={3} />
      <Building x={300} y={96} w={58} cols={3} rows={5} />
      {/* a couple of trees in the gardens */}
      <g fill="white" fillOpacity={0.18}>
        <circle cx={278} cy={150} r={14} />
        <rect x={276} y={150} width={4} height={26} />
        <circle cx={196} cy={162} r={10} />
        <rect x={194} y={162} width={3} height={20} />
      </g>
    </svg>
  );
}

const EVENT_ICON: Record<EventCategory, LucideIcon> = {
  social: PartyPopper,
  wellness: HeartPulse,
  cultural: Drama,
  sport: Dumbbell,
  market: Store,
};

/** Large translucent category motif for event covers. */
export function EventCoverArt({ category }: { category: EventCategory }) {
  const Icon = EVENT_ICON[category];
  return (
    <Icon
      className="pointer-events-none absolute -bottom-3 -right-2 h-24 w-24 text-white"
      style={{ opacity: 0.22 }}
      strokeWidth={1.25}
      aria-hidden="true"
    />
  );
}
