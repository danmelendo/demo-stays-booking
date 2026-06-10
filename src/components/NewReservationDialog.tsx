import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DURATIONS, DURATION_LABELS, eur, isOvernightAllowed, useExtras, useRooms } from "@/lib/data";
import { calculatePrice, calculateNightlyPrice, type PriceBreakdown } from "@/lib/pricing";
import { NIGHTLY_CHECKIN_HOUR, NIGHTLY_CHECKOUT_HOUR } from "@/lib/booking-mode";
import { toast } from "sonner";
import { CalendarIcon, Gift, Plus, Minus, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStart?: Date;
  defaultRoomId?: string;
  mode?: "standard" | "admin" | "public";
  onPublicCreated?: (reservationId: string) => void;
  /** When set, the dialog edits this existing reservation instead of creating one. */
  editReservationId?: string;
}

export function NewReservationDialog({ open, onOpenChange, defaultStart, defaultRoomId, mode = "standard", onPublicCreated, editReservationId }: Props) {
  const isAdmin = mode === "admin";
  const isPublic = mode === "public";
  const isEdit = !!editReservationId;
  const qc = useQueryClient();
  const { data: rooms } = useRooms();
  const { data: extras } = useExtras();

  const timeOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    // Only the public booking flow is limited to 22:00–24:00; staff (reception
    // and admin) can pick any hour.
    const startMin = isPublic ? 22 * 60 : 0;
    const endMin = 24 * 60;
    for (let minutes = startMin; minutes < endMin; minutes += 15) {
      const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
      const mm = String(minutes % 60).padStart(2, "0");
      const value = `${hh}:${mm}`;
      opts.push({ value, label: value });
    }
    return opts;
  }, [isPublic]);

  const clampStartTimeToAllowed = (value: string) => {
    if (!value) return value;
    if (!isPublic) return value; // staff: free hours
    const [hhRaw, mmRaw] = value.split(":");
    const hh = Number(hhRaw);
    const mm = Number(mmRaw);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return "22:00";
    const minutes = hh * 60 + mm;
    if (minutes < 22 * 60 || minutes >= 24 * 60) return "22:00";
    const normalizedMinutes = Math.floor(mm / 15) * 15;
    return `${String(hh).padStart(2, "0")}:${String(normalizedMinutes).padStart(2, "0")}`;
  };

  const normalizeTimeTo15Min = (value: string) => {
    // value: "HH:MM" (native <input type="time">)
    if (!value) return value;
    const [hhRaw, mmRaw] = value.split(":");
    const hh = Number(hhRaw);
    const mm = Number(mmRaw);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return value;
    const normalizedMinutes = Math.floor(mm / 15) * 15;
    return `${String(hh).padStart(2, "0")}:${String(normalizedMinutes).padStart(2, "0")}`;
  };

  const parseDateFromInput = (value: string) => {
    if (!value) return undefined;
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };

  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [duration, setDuration] = useState<number>(120);
  const [cleaningMinutes, setCleaningMinutes] = useState<number>(15);
  const [isOvernight, setIsOvernight] = useState(false);
  // Stay type: "hours" is the original product; "nights" books full nights like
  // a traditional hotel (check-in 15:00 / check-out 12:00, priced per night).
  const [stayType, setStayType] = useState<"hours" | "nights">("hours");
  const [nightsCount, setNightsCount] = useState(1);
  const isNightStay = stayType === "nights";
  const [roomId, setRoomId] = useState<string>("");
  const [withJacuzzi, setWithJacuzzi] = useState(false);
  const [people, setPeople] = useState(2);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [extraQty, setExtraQty] = useState<Record<string, number>>({});
  const [extraPrice, setExtraPrice] = useState<Record<string, string>>({});
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [overrideTotal, setOverrideTotal] = useState<string>("");
  const [overrideEnd, setOverrideEnd] = useState<string>(""); // datetime-local for admin
  const [loadedCustomerId, setLoadedCustomerId] = useState<string | null>(null); // edit mode

  useEffect(() => {
    if (!open) return;
    if (editReservationId) return; // edit mode populates from the existing reservation
    const d = defaultStart ?? new Date();
setDate(format(d, "yyyy-MM-dd"));    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(Math.floor(d.getMinutes() / 15) * 15).padStart(2, "0");
    setTime(clampStartTimeToAllowed(`${hh}:${mm}`));
    setDuration(120);
    setCleaningMinutes(15);
    setIsOvernight(false);
    setStayType("hours");
    setNightsCount(1);
    setRoomId(defaultRoomId ?? "");
    setWithJacuzzi(false);
    setPeople(2);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setNotes("");
    setExtraQty({});
    setExtraPrice({});
    setBreakdown(null);
    setOverrideTotal("");
    setOverrideEnd("");
    setLoadedCustomerId(null);
  }, [open, defaultStart, defaultRoomId, editReservationId]);

  // Edit mode: load the existing reservation + its extras and prefill the form.
  useEffect(() => {
    if (!open || !editReservationId) return;
    let cancel = false;
    (async () => {
      const { data: r, error } = await supabase
        .from("reservations")
        .select("*, customers(name,phone,email), reservation_extras(extra_id,qty,unit_price,is_gift)")
        .eq("id", editReservationId)
        .single();
      if (error || !r || cancel) return;
      const s = new Date(r.start_at);
      const e = new Date(r.end_at);
      setDate(format(s, "yyyy-MM-dd"));
      setTime(`${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`);
      // Nightly stays (traditional-hotel mode) start at the hotel check-in hour;
      // the hourly product's "noche completa" starts at 22:00.
      const nightly = !!r.is_overnight && s.getHours() === NIGHTLY_CHECKIN_HOUR;
      setStayType(nightly ? "nights" : "hours");
      setNightsCount(nightly ? Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000)) : 1);
      setIsOvernight(nightly ? false : !!r.is_overnight);
      setDuration(Math.max(60, Math.round((e.getTime() - s.getTime()) / 60000)));
      setCleaningMinutes(Math.max(15, r.cleaning_minutes ?? 15));
      setRoomId(r.room_id);
      setWithJacuzzi(!!r.with_jacuzzi);
      setPeople(r.people ?? 2);
      setLoadedCustomerId(r.customer_id ?? null);
      const cust = Array.isArray(r.customers) ? r.customers[0] : r.customers;
      setCustomerName(cust?.name ?? "");
      setCustomerPhone(cust?.phone ?? "");
      setCustomerEmail(cust?.email ?? "");
      setNotes(r.internal_notes ?? "");
      const qty: Record<string, number> = {};
      const price: Record<string, string> = {};
      for (const row of (r.reservation_extras ?? []) as { extra_id: string; qty: number; unit_price: number; is_gift: boolean }[]) {
        if (row.is_gift) continue; // gifts are re-applied automatically by pricing
        qty[row.extra_id] = row.qty;
        price[row.extra_id] = Number(row.unit_price).toFixed(2).replace(".", ",");
      }
      setExtraQty(qty);
      setExtraPrice(price);
    })();
    return () => { cancel = true; };
  }, [open, editReservationId]);

  const startAt = useMemo(() => {
    if (isNightStay) return date ? new Date(`${date}T${String(NIGHTLY_CHECKIN_HOUR).padStart(2, "0")}:00:00`) : null;
    return date && time ? new Date(`${date}T${time}:00`) : null;
  }, [date, time, isNightStay]);

  const nightlyEndAt = useMemo(() => {
    if (!isNightStay || !startAt) return null;
    const e = new Date(startAt);
    e.setDate(e.getDate() + Math.max(1, nightsCount));
    e.setHours(NIGHTLY_CHECKOUT_HOUR, 0, 0, 0);
    return e;
  }, [isNightStay, startAt, nightsCount]);
  const overnightAllowed = startAt ? isOvernightAllowed(startAt) : false;
  const pricingDuration = useMemo(() => {
    // Pricing is defined in Supabase in 30-min steps (60, 90, 120, ...).
    // For 15-min UI increments, bill the next available step:
    // 1h15 -> 1h30, 1h45 -> 2h, etc.
    const min = 60;
    const max = 360;
    const clamped = Math.min(max, Math.max(min, duration));
    const rounded = Math.ceil(clamped / 30) * 30;
    return Math.min(max, Math.max(min, rounded));
  }, [duration]);

  useEffect(() => {
    if (!isPublic) return;
    if (!overnightAllowed && isOvernight) setIsOvernight(false);
  }, [overnightAllowed, isOvernight, isPublic]);

  useEffect(() => {
    if (!isPublic) return;
    if (!isOvernight) return;
    if (time !== "22:00") setTime("22:00");
  }, [isOvernight, time, isPublic]);

  const room = useMemo(() => rooms?.find((r) => r.id === roomId), [rooms, roomId]);
  const rateGroupId = room?.rate_group_id ?? null;
  useEffect(() => {
    if (room?.jacuzzi === "none") setWithJacuzzi(false);
    if (room?.jacuzzi === "always") setWithJacuzzi(true);
  }, [room]);

  const selectedExtras = useMemo(() => {
    if (!extras) return [];
    return Object.entries(extraQty)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => {
        const ex = extras.find((e) => e.id === id)!;
        const base = Number(ex.price);
        const manualRaw = ex.category === "services" ? (extraPrice[id] ?? "") : "";
        const manual = Number.parseFloat(manualRaw.replace(",", "."));
        const unitPrice = ex.category === "services" && Number.isFinite(manual) ? manual : base;
        return { extraId: id, qty: q, price: unitPrice, name: ex.name };
      });
  }, [extras, extraPrice, extraQty]);

  // recompute price
  useEffect(() => {
    if (!rateGroupId || !startAt) {
      setBreakdown(null);
      return;
    }
    let cancel = false;
    const promise = isNightStay
      ? (nightlyEndAt
          ? calculateNightlyPrice({ rateGroupId, checkIn: startAt, checkOut: nightlyEndAt, extras: selectedExtras })
          : Promise.resolve(null))
      : calculatePrice({
          rateGroupId,
          durationMin: pricingDuration,
          withJacuzzi,
          isOvernight,
          overnightCheckout: isOvernight ? "10:00:00" : undefined,
          people,
          startAt,
          extras: selectedExtras,
        });
    promise
      .then((b) => {
        if (!cancel) setBreakdown(b);
      })
      .catch((e: unknown) => {
        if (cancel) return;
        setBreakdown(null);
        toast.error(e instanceof Error ? e.message : "Error calculando precio");
      });
    return () => {
      cancel = true;
    };
  }, [rateGroupId, pricingDuration, withJacuzzi, isOvernight, isNightStay, nightlyEndAt, people, startAt, selectedExtras]);

  const create = useMutation({
    mutationFn: async () => {
      if (!startAt || !roomId) throw new Error("Datos incompletos");
      if (!isAdmin && !rateGroupId) throw new Error("Datos incompletos");
      if (!isAdmin && !breakdown) throw new Error("Datos incompletos");
      if (isPublic && !isOvernightAllowed(startAt)) {
        throw new Error(
          "Las reservas para jueves, viernes y sábado deben realizarse por teléfono o WhatsApp."
        );
      }
      if (!isAdmin && isOvernight && (breakdown?.base ?? 0) <= 0)
        throw new Error("Tarifa de noche completa no configurada");
      if (!isAdmin && isNightStay && (breakdown?.base ?? 0) <= 0)
        throw new Error("Tarifa por noches no configurada");
      if (isPublic && (!customerName || !customerEmail)) {
        throw new Error("Nombre y email son obligatorios");
      }

      // Customer. In edit mode, update the already-linked customer in place;
      // otherwise find by phone/email or create.
      let customerId: string | null = isEdit ? loadedCustomerId : null;
      if (isEdit && loadedCustomerId) {
        await supabase
          .from("customers")
          .update({ name: customerName || null, phone: customerPhone || null, email: customerEmail || null })
          .eq("id", loadedCustomerId);
      } else if (customerPhone || customerName || customerEmail) {
        if (customerPhone) {
          const { data: existing } = await supabase
            .from("customers")
            .select("id")
            .eq("phone", customerPhone)
            .maybeSingle();
          if (existing) customerId = existing.id;
        }
        if (!customerId && customerEmail) {
          const { data: existing } = await supabase
            .from("customers")
            .select("id")
            .eq("email", customerEmail)
            .maybeSingle();
          if (existing) customerId = existing.id;
        }
        if (!customerId) {
          const { data: c, error } = await supabase
            .from("customers")
            .insert({ name: customerName || null, phone: customerPhone || null, email: customerEmail || null })
            .select("id")
            .single();
          if (error) throw error;
          customerId = c.id;
        }
      }

      let endAt: Date;
      if (isAdmin && overrideEnd) {
        endAt = new Date(overrideEnd);
        if (Number.isNaN(endAt.getTime()) || endAt <= startAt) throw new Error("Hora de salida inválida");
      } else if (isNightStay) {
        if (!nightlyEndAt) throw new Error("Datos incompletos");
        endAt = nightlyEndAt;
      } else {
        endAt = new Date(startAt);
        if (isOvernight) {
          endAt.setDate(endAt.getDate() + 1);
          endAt.setHours(10, 0, 0, 0);
        } else {
          endAt.setMinutes(endAt.getMinutes() + duration);
        }
      }

      const overrideNum = Number.parseFloat(overrideTotal.replace(",", "."));
      const useOverride = isAdmin && Number.isFinite(overrideNum);
      const finalTotal = useOverride ? overrideNum : (breakdown?.total ?? 0);

      const reservationFields = {
        room_id: roomId,
        customer_id: customerId,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        with_jacuzzi: withJacuzzi,
        people,
        is_overnight: isNightStay ? true : isOvernight,
        base_price: useOverride ? finalTotal : (breakdown?.base ?? 0),
        third_person_surcharge: breakdown?.thirdPerson ?? 0,
        dynamic_surcharge: breakdown?.dynamicSurcharge ?? 0,
        dynamic_reason: useOverride ? "Precio manual (admin)" : (breakdown?.dynamicReason ?? null),
        extras_total: breakdown?.extrasTotal ?? 0,
        total: finalTotal,
        internal_notes: notes || null,
        cleaning_minutes: Math.max(15, cleaningMinutes || 15),
      };

      let reservationId: string;
      if (isEdit && editReservationId) {
        // Update existing reservation (preserve manual_override / created_by_role).
        const { error: upErr } = await supabase
          .from("reservations")
          .update(reservationFields)
          .eq("id", editReservationId);
        if (upErr) throw upErr;
        reservationId = editReservationId;
        // Replace the extras with the current selection.
        await supabase.from("reservation_extras").delete().eq("reservation_id", reservationId);
      } else {
        const { data: reservation, error } = await supabase
          .from("reservations")
          .insert({
            ...reservationFields,
            manual_override: isAdmin,
            created_by_role: isAdmin ? "admin" : isPublic ? "public" : "reception",
          })
          .select("id")
          .single();
        if (error) throw error;
        reservationId = reservation.id;
      }

      // Insert extras
      const rows = selectedExtras.map((e) => ({
        reservation_id: reservationId,
        extra_id: e.extraId,
        qty: e.qty,
        unit_price: e.price,
        is_gift: false,
      }));
      if (breakdown) {
        for (const giftId of breakdown.giftedExtraIds) {
          if (!rows.some((r) => r.extra_id === giftId)) {
            rows.push({ reservation_id: reservationId, extra_id: giftId, qty: 1, unit_price: 0, is_gift: true });
          }
        }
      }
      if (rows.length > 0) {
        const { error: e2 } = await supabase.from("reservation_extras").insert(rows);
        if (e2) throw e2;
      }

      // Trigger confirmation email when public booking with email
      if (isPublic && !isEdit && customerEmail) {
        try {
          await supabase.functions.invoke("send-reservation-confirmation", {
            body: { reservation_id: reservationId },
          });
        } catch (e) {
          console.warn("email send failed", e);
        }
      }

      return reservationId;
    },
    onSuccess: (id) => {
      toast.success(isEdit ? "Reserva actualizada" : isPublic ? "¡Reserva confirmada! Te hemos enviado un email." : "Reserva creada");
      qc.invalidateQueries({ queryKey: ["reservations"] });
      onOpenChange(false);
      if (isPublic) onPublicCreated?.(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const incExtra = (id: string, delta: number) => {
    setExtraQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + delta) }));
  };

  const setExtraManualPrice = (id: string, value: string) => {
    setExtraPrice((p) => ({ ...p, [id]: value }));
  };

  const setOvernightChecked = (checked: boolean) => {
    setIsOvernight(checked);
    if (checked) {
      setTime("22:00");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col min-h-0">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle>{isEdit ? "Editar reserva" : isAdmin ? "Reserva manual (admin)" : isPublic ? "Reserva tu habitación" : "Nueva reserva"}</DialogTitle>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-lg font-semibold tabular-nums">{breakdown ? eur(breakdown.total) : "—"}</div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
          {isAdmin && (
            <div className="mb-4 space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
              <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">Override admin</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fin reserva (opcional)</Label>
                  <Input
                    type="datetime-local"
                    value={overrideEnd}
                    onChange={(e) => setOverrideEnd(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Total final € (opcional)</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="Calculado automáticamente"
                    value={overrideTotal}
                    onChange={(e) => setOverrideTotal(e.target.value)}
                  />
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground">Esta reserva se marca como manual y se salta la separación de limpieza entre reservas.</div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left col: when + room */}
            <div className="space-y-4">
              {!isPublic && (
                <div className="space-y-1.5">
                  <Label>Tipo de estancia</Label>
                  <Select value={stayType} onValueChange={(v) => setStayType(v as "hours" | "nights")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hours">Por horas</SelectItem>
                      <SelectItem value="nights">Por noches (hotel tradicional)</SelectItem>
                    </SelectContent>
                  </Select>
                  {isNightStay && (
                    <div className="text-[10px] text-muted-foreground">
                      Check-in {NIGHTLY_CHECKIN_HOUR}:00 · check-out {NIGHTLY_CHECKOUT_HOUR}:00 · precio por noche (fin de semana aparte).
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Fecha</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                        {date || <span className="text-muted-foreground">Selecciona fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
  mode="single"
  selected={parseDateFromInput(date)}
  onSelect={(d) => setDate(d ? format(d, "yyyy-MM-dd") : "")}
  initialFocus
/>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label>Hora entrada</Label>
                  {isNightStay ? (
                    <div className="flex h-9 items-center rounded-md border px-3 text-sm text-muted-foreground">
                      {NIGHTLY_CHECKIN_HOUR}:00 (check-in)
                    </div>
                  ) : (
                  <Select value={time} onValueChange={(v) => setTime(clampStartTimeToAllowed(v))} disabled={isOvernight}>
                    <SelectTrigger><SelectValue placeholder="HH:MM" /></SelectTrigger>
                    <SelectContent className="max-h-[40vh]">
                      {timeOptions.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  )}
                </div>
              </div>

              {!isNightStay && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Noche completa</div>
                  <div className="text-xs text-muted-foreground">
                    {overnightAllowed ? "Disponible (dom-mié) · 22:00–10:00" : "Solo dom-mié · 22:00–10:00"}
                  </div>
                </div>
                <Switch checked={isOvernight} onCheckedChange={setOvernightChecked} disabled={isPublic && !overnightAllowed} />
              </div>
              )}

              {isNightStay ? (
                <div className="space-y-1.5">
                  <Label>Noches</Label>
                  <Select value={String(nightsCount)} onValueChange={(v) => setNightsCount(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-[40vh]">
                      {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "noche" : "noches"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {nightlyEndAt && (
                    <div className="text-[10px] text-muted-foreground">
                      Salida: {nightlyEndAt.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })} · {NIGHTLY_CHECKOUT_HOUR}:00
                    </div>
                  )}
                </div>
              ) : isOvernight ? (
                <div className="space-y-1.5">
                  <Label>Hora de salida</Label>
                  <div className="text-sm">10:00 AM</div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Duración</Label>
                  <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map((d) => (
                        <SelectItem key={d} value={String(d)}>{DURATION_LABELS[d]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!isPublic && (
                <div className="space-y-1.5">
                  <Label>Limpieza tras la reserva (min)</Label>
                  <Input
                    type="number"
                    min={15}
                    step={5}
                    value={cleaningMinutes}
                    onChange={(e) => setCleaningMinutes(Math.max(15, Number(e.target.value) || 15))}
                  />
                  <div className="text-[10px] text-muted-foreground">
                    Mínimo 15 min. La habitación queda no reservable durante este tiempo; amplíalo si necesita más limpieza.
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Habitación</Label>
                <Select value={roomId} onValueChange={setRoomId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona habitación" /></SelectTrigger>
                  <SelectContent>
                    {rooms?.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.building} · {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!isOvernight && (
                <div className="space-y-1.5">
                  <Label>Personas</Label>
                  <Select value={String(people)} onValueChange={(v) => setPeople(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Cliente {isPublic && <span className="text-xs text-muted-foreground">(nombre y email obligatorios)</span>}</Label>
                <Input placeholder="Nombre" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                <Input placeholder="Teléfono" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                <Input placeholder={isPublic ? "Email" : "Email (opcional)"} type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
              </div>

              {!isPublic && (
                <div className="space-y-1.5">
                  <Label>Notas internas</Label>
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              )}
            </div>

            {/* Right col: extras + summary */}
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Habitación</span><span className="tabular-nums">{eur(breakdown?.base)}</span></div>
                {(breakdown?.thirdPerson ?? 0) > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Suplemento personas</span><span className="tabular-nums">{eur(breakdown?.thirdPerson)}</span></div>
                )}
                {(breakdown?.dynamicSurcharge ?? 0) > 0 && (
                  <div className="flex justify-between text-amber-700 dark:text-amber-400">
                    <span>Recargo dinámico {breakdown?.dynamicReason ? `· ${breakdown.dynamicReason}` : ""}</span>
                    <span className="tabular-nums">{eur(breakdown?.dynamicSurcharge)}</span>
                  </div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Extras</span><span className="tabular-nums">{eur(breakdown?.extrasTotal)}</span></div>
                <Separator />
                <div className="flex justify-between text-base font-semibold"><span>Total</span><span className="tabular-nums">{eur(breakdown?.total)}</span></div>
              </div>

              <Separator />

              <div>
                <Label className="text-sm font-semibold">Extras</Label>
                <div className="mt-2 space-y-3">
                  {(["decoration", "drinks", "hookah", "accessories", "services"] as const).map((cat) => {
                    const items = extras?.filter((e) => e.category === cat && e.active) ?? [];
                    if (!items.length) return null;
                    const labels: Record<string, string> = {
                      decoration: "Decoración", drinks: "Bebidas", hookah: "Cachimba",
                      accessories: "Accesorios", services: "Servicios",
                    };
                    return (
                      <div key={cat}>
                        <div className="text-xs font-medium text-muted-foreground mb-1">{labels[cat]}</div>
                        <div className="space-y-1">
                          {items.map((ex) => {
                            const q = extraQty[ex.id] ?? 0;
                            const isGifted = breakdown?.giftedExtraIds.includes(ex.id);
                            return (
                              <div key={ex.id} className="flex items-center justify-between gap-2 text-sm rounded-md border px-2 py-1.5">
                                <div className="min-w-0 flex-1">
                                  <div className="truncate flex items-center gap-1.5">
                                    {ex.name}
                                    {isGifted && q === 0 && (
                                      <Badge variant="outline" className="gap-1 text-[10px]"><Gift className="h-3 w-3" />Regalo</Badge>
                                    )}
                                  </div>
                                  {cat === "decoration" && ex.description && (
                                    <div className="text-xs text-muted-foreground/90 leading-snug">{ex.description}</div>
                                  )}
                                  {cat === "services" ? (
                                    <div className="mt-1 flex items-center gap-2">
                                      <div className="text-xs text-muted-foreground shrink-0">Precio</div>
                                      <Input
                                        inputMode="decimal"
                                        type="text"
                                        pattern="^\\d+(?:[\\.,]\\d{0,2})?$"
                                        placeholder="0,00"
                                        className="h-7 w-28 tabular-nums"
                                        value={extraPrice[ex.id] ?? Number(ex.price).toFixed(2).replace(".", ",")}
                                        onChange={(e) => setExtraManualPrice(ex.id, e.target.value)}
                                      />
                                      <div className="text-xs text-muted-foreground">€</div>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground">{eur(Number(ex.price))}</div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => incExtra(ex.id, -1)}><Minus className="h-3 w-3" /></Button>
                                  <span className="w-6 text-center text-sm tabular-nums">{q}</span>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => incExtra(ex.id, 1)}><Plus className="h-3 w-3" /></Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>

        <div className="px-6 pb-3">
          <details className="rounded-lg border bg-muted/20 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none px-3 py-2 font-semibold text-foreground">
              Condiciones generales
            </summary>
            <ul className="list-disc pl-7 pr-3 pb-3 space-y-0.5">
              <li>Todos los extras están sujetos a disponibilidad</li>
              <li>Algunos servicios requieren reserva previa</li>
              <li>Los precios pueden variar en función de la demanda</li>
              <li>Se recomienda consultar antes de la reserva para confirmar disponibilidad</li>
            </ul>
          </details>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={!roomId || !startAt || create.isPending}>
            {create.isPending ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear reserva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Avoid unused import
export const _ = useQuery;
