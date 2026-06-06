import { supabase } from "@/integrations/supabase/client";
import type { Reservation } from "./data";

export interface PriceBreakdown {
  base: number;
  thirdPerson: number;
  dynamicSurcharge: number;
  dynamicReason: string | null;
  extrasTotal: number;
  giftedExtraIds: string[];
  total: number;
}

export interface PriceInput {
  rateGroupId: string;
  durationMin: number;
  withJacuzzi: boolean;
  isOvernight: boolean;
  overnightCheckout?: string; // HH:MM:SS
  people: number;
  startAt: Date;
  extras: { extraId: string; qty: number; price: number }[];
}

export async function calculatePrice(input: PriceInput): Promise<PriceBreakdown> {
  let base = 0;
  if (input.isOvernight) {
    const { data, error } = await supabase
      .from("rate_overnight")
      .select("price")
      .eq("rate_group_id", input.rateGroupId)
      .eq("checkout_time", "10:00:00")
      .maybeSingle();
    if (error) throw error;
    base = Number(data?.price ?? 0);
  } else {
    const { data, error } = await supabase
      .from("rate_hourly")
      .select("price_with_jacuzzi, price_without_jacuzzi")
      .eq("rate_group_id", input.rateGroupId)
      .eq("duration_min", input.durationMin)
      .maybeSingle();
    if (error) throw error;
    base = Number(
      (input.withJacuzzi ? data?.price_with_jacuzzi : data?.price_without_jacuzzi) ?? 0,
    );
  }

  // Third person surcharge (only hourly)
  let thirdPerson = 0;
  if (!input.isOvernight && input.people > 2) {
    const { data, error } = await supabase
      .from("rate_third_person")
      .select("surcharge")
      .eq("duration_min", input.durationMin)
      .maybeSingle();
    if (error) throw error;
    thirdPerson = Number(data?.surcharge ?? 0) * (input.people - 2);
  }

  // Dynamic surcharge
  const { data: rules, error: rulesError } = await supabase
    .from("dynamic_rules")
    .select("*")
    .eq("active", true);
  if (rulesError) throw rulesError;
  let dynamicSurcharge = 0;
  let dynamicReason: string | null = null;
  if (rules) {
    // Date-based rules
    for (const r of rules) {
      if (r.type !== "date") continue;
      const cfg = r.config as { from?: string; to?: string };
      if (!cfg.from || !cfg.to) continue;
      const d = input.startAt.toISOString().slice(0, 10);
      if (d >= cfg.from && d <= cfg.to) {
        const mult = Number(r.multiplier ?? 0);
        dynamicSurcharge += (base + thirdPerson) * (mult / 100);
        dynamicReason = (dynamicReason ? dynamicReason + " · " : "") + `${r.name} (+${mult}%)`;
      }
    }
    // Occupancy rule
    const occRules = rules.filter((r) => r.type === "occupancy").sort((a, b) => {
      const ta = (a.config as { threshold?: number }).threshold ?? 0;
      const tb = (b.config as { threshold?: number }).threshold ?? 0;
      return tb - ta;
    });
    if (occRules.length > 0) {
      const dayStart = new Date(input.startAt);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const [{ count: occ }, { count: total }] = await Promise.all([
        supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .gte("start_at", dayStart.toISOString())
          .lt("start_at", dayEnd.toISOString())
          .not("status", "in", "(cancelled,no_show)"),
        supabase.from("rooms").select("id", { count: "exact", head: true }).eq("active", true),
      ]);
      const totalRooms = total ?? 1;
      const ratio = ((occ ?? 0) / totalRooms) * 100;
      for (const r of occRules) {
        const cfg = r.config as { threshold?: number };
        if (ratio >= (cfg.threshold ?? 0)) {
          const mult = Number(r.multiplier ?? 0);
          dynamicSurcharge += (base + thirdPerson) * (mult / 100);
          dynamicReason = (dynamicReason ? dynamicReason + " · " : "") + `Ocupación ${Math.round(ratio)}% (+${mult}%)`;
          break;
        }
      }
    }
  }

  // Gifts
  const extrasTotal = input.extras.reduce((s, e) => s + e.qty * e.price, 0);
  const { data: gifts, error: giftsError } = await supabase
    .from("gift_thresholds")
    .select("*")
    .eq("active", true)
    .lte("min_extras_total", extrasTotal)
    .order("min_extras_total", { ascending: false });
  if (giftsError) throw giftsError;
  const giftedExtraIds: string[] = gifts ? gifts.map((g) => g.gift_extra_id) : [];

  const total = base + thirdPerson + dynamicSurcharge + extrasTotal;
  return {
    base: round2(base),
    thirdPerson: round2(thirdPerson),
    dynamicSurcharge: round2(dynamicSurcharge),
    dynamicReason,
    extrasTotal: round2(extrasTotal),
    giftedExtraIds,
    total: round2(total),
  };
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type ReservationWithRoom = Reservation & {
  rooms: { id: string; name: string; building: string } | null;
  customers: { id: string; name: string | null; phone: string | null } | null;
};
