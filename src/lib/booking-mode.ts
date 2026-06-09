import { useState } from "react";

// Public-portal booking mode. "hourly" is the original product (themed rooms
// by the hour); "nightly" showcases the same platform running as a traditional
// hotel: date-range stays priced per night, check-in 15:00 / check-out 12:00.
// The choice only affects the public flow and persists per browser.
export type BookingMode = "hourly" | "nightly";

const KEY = "demo-stays-booking-mode";

export const NIGHTLY_CHECKIN_HOUR = 15; // 15:00
export const NIGHTLY_CHECKOUT_HOUR = 12; // 12:00

export function getBookingMode(): BookingMode {
  if (typeof window === "undefined") return "hourly";
  return window.localStorage.getItem(KEY) === "nightly" ? "nightly" : "hourly";
}

export function useBookingMode(): [BookingMode, (m: BookingMode) => void] {
  const [mode, setModeState] = useState<BookingMode>(getBookingMode);
  const setMode = (m: BookingMode) => {
    setModeState(m);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, m);
  };
  return [mode, setMode];
}
