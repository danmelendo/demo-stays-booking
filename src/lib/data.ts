import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type Room = Tables["rooms"]["Row"];
export type RateGroup = Tables["rate_groups"]["Row"];
export type RateHourly = Tables["rate_hourly"]["Row"];
export type RateOvernight = Tables["rate_overnight"]["Row"];
export type RateThirdPerson = Tables["rate_third_person"]["Row"];
export type Extra = Tables["extras"]["Row"];
export type Customer = Tables["customers"]["Row"];
export type Reservation = Tables["reservations"]["Row"];
export type ReservationExtra = Tables["reservation_extras"]["Row"];
export type DynamicRule = Tables["dynamic_rules"]["Row"];
export type GiftThreshold = Tables["gift_thresholds"]["Row"];

export const DURATIONS = [60, 90, 120, 150, 180, 240, 300, 360];
export const DURATION_LABELS: Record<number, string> = {
  60: "1h",
  90: "1h 30min",
  120: "2h",
  150: "2h 30min",
  180: "3h",
  240: "4h",
  300: "5h",
  360: "6h",
};
export const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente de pago",
  confirmed: "Confirmada",
  in_progress: "En curso",
  completed: "Finalizada",
  cancelled: "Cancelada",
  no_show: "No-show",
  rejected: "Rechazada",
};
export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  confirmed: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  in_progress: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 line-through",
  no_show: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30",
  rejected: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
};

export function useRooms() {
  return useQuery({
    queryKey: ["rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("*, rate_groups(name)")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useExtras() {
  return useQuery({
    queryKey: ["extras"],
    queryFn: async () => {
      const { data, error } = await supabase.from("extras").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useRateGroups() {
  return useQuery({
    queryKey: ["rate_groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rate_groups").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useDynamicRules() {
  return useQuery({
    queryKey: ["dynamic_rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dynamic_rules").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function eur(n: number | null | undefined) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n ?? 0);
}

export function isOvernightAllowed(date: Date) {
  // Sun(0), Mon(1), Tue(2), Wed(3) entry day
  // Thu/Fri/Sat -> hourly only
  const d = date.getDay();
  return d === 0 || d === 1 || d === 2 || d === 3;
}
