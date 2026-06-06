// Compact list of a reservation's extras for staff. Decoration phrases the
// customer entered (bed + glass/LED screen) are highlighted so reception can
// set up the room. Fed by a `reservation_extras(...)` embed; see usage.
export interface ReservationExtraItem {
  qty: number;
  is_gift: boolean;
  bed_message: string | null;
  screen_message: string | null;
  extras: { name: string; category: string } | null;
}

export function ReservationExtrasInfo({ items }: { items: ReservationExtraItem[] | null | undefined }) {
  if (!items?.length) return null;
  return (
    <div className="w-full mt-1 space-y-1">
      {items.map((it, i) => {
        const name = it.extras?.name ?? "Extra";
        const bed = it.bed_message?.trim();
        const screen = it.screen_message?.trim();
        return (
          <div key={i} className="text-xs">
            <span className="text-muted-foreground">
              {it.is_gift ? "🎁 " : "• "}{name}{it.qty > 1 ? ` ×${it.qty}` : ""}
            </span>
            {(bed || screen) && (
              <div className="mt-0.5 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-800 dark:text-amber-200">
                {bed && <div><span className="font-medium">Cama:</span> “{bed}”</div>}
                {screen && <div><span className="font-medium">Cristal / pantalla LED:</span> “{screen}”</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
