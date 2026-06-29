import type { RentalRates } from "@/integrations/pms";
import { eur0, priceBand } from "@/lib/stays";

// Rental pricing display for coliving assets. Prices are *indeterminate* in the
// catalogue: each period (month/night/week) shows an orientation range, not a
// fixed figure, because the real price depends on dates and occupancy (resolved
// in the price preview). The monthly range is the headline (coliving framing).
export function RentalPrice({
  rates,
  align = "left",
  hint = true,
}: {
  rates: RentalRates;
  align?: "left" | "right";
  /** Show the "según fechas y ocupación" caption. */
  hint?: boolean;
}) {
  const m = priceBand(rates.month);
  const n = priceBand(rates.night);
  const w = priceBand(rates.week);
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <p className="text-base font-semibold leading-tight text-neutral-900">
        {eur0(m.from)}–{eur0(m.to)}
        <span className="text-xs font-normal text-neutral-400">/mes</span>
      </p>
      <p className="text-[11px] leading-tight text-neutral-500">
        {eur0(n.from)}–{eur0(n.to)}/noche · {eur0(w.from)}–{eur0(w.to)}/sem
      </p>
      {hint && (
        <p className="text-[10px] leading-tight text-neutral-400">según fechas y ocupación</p>
      )}
    </div>
  );
}
