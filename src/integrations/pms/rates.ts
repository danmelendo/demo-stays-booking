// ─────────────────────────────────────────────────────────────────────────────
// Rental rate derivation
//
// Coliving assets are rented by the night, week or month — longer stays are
// cheaper per night. The PMS only stores a base nightly price, so the connector
// derives the weekly/monthly rental rates from it with a long-stay discount.
// Centralised here so the discount policy lives in one place.
// ─────────────────────────────────────────────────────────────────────────────

import type { RentalRates } from "./types";

// Effective nights paid per period (the rest is the long-stay discount):
// a week ≈ 15% off (pay 6/7 nights), a month ≈ 30% off (pay 21/30 nights).
const WEEK_DISCOUNT = 0.85;
const MONTH_DISCOUNT = 0.7;

const MONTHLY_CAP = 1600;

/** Derive nightly/weekly/monthly rental rates from a base nightly price. */
export function rentalRates(nightly: number): RentalRates {
  const night = Math.round(nightly);
  const month = Math.min(MONTHLY_CAP, Math.round(nightly * 30 * MONTH_DISCOUNT));
  return {
    night,
    week: Math.round(nightly * 7 * WEEK_DISCOUNT),
    month,
  };
}
