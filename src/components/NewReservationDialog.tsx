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
import { calculatePrice, type PriceBreakdown } from "@/lib/pricing";
import { toast } from "sonner";
import { CalendarIcon, Gift, Plus, Minus, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStart?: Date;
  defaultRoomId?: string;
  mode?: "standard" | "admin" | "public";
  onPublicCreated?: (reservationId: string) => void;
}

export function NewReservationDialog({ open, onOpenChange, defaultStart, defaultRoomId, mode = "standard", onPublicCreated }: Props) {
  const isAdmin = mode === "admin";
  const isPublic = mode === "public";
  const qc = useQueryClient();
  const { data: rooms } = useRooms();
  const { data: extras } = useExtras();

  const timeOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const startMin = isAdmin ? 0 : 22 * 60;
    const endMin = 24 * 60;
    for (let minutes = startMin; minutes < endMin; minutes += 15) {
      const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
      const mm = String(minutes % 60).padStart(2, "0");
      const value = `${hh}:${mm}`;
      opts.push({ value, label: value });
    }
    return opts;
  }, [isAdmin]);

  const clampStartTimeToAllowed = (value: string) => {
    if (!value) return value;
    if (isAdmin) return value; // admin: free hours
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
  const [isOvernight, setIsOvernight] = useState(false);
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

  useEffect(() => {
    if (!open) return;
    const d = defaultStart ?? new Date();
setDate(format(d, "yyyy-MM-dd"));    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(Math.floor(d.getMinutes() / 15) * 15).padStart(2, "0");
    setTime(clampStartTimeToAllowed(`${hh}:${mm}`));
    setDuration(120);
    setIsOvernight(false);
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
  }, [open, defaultStart, defaultRoomId]);

  const startAt = useMemo(() => (date && time ? new Date(`${date}T${time}:00`) : null), [date, time]);
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
    if (isAdmin) return;
    if (!overnightAllowed && isOvernight) setIsOvernight(false);
  }, [overnightAllowed, isOvernight, isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    if (!isOvernight) return;
    if (time !== "22:00") setTime("22:00");
  }, [isOvernight, time]);

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
    calculatePrice({
      rateGroupId,
      durationMin: pricingDuration,
      withJacuzzi,
      isOvernight,
      overnightCheckout: isOvernight ? "10:00:00" : undefined,
      people,
      startAt,
      extras: selectedExtras,
    })
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
  }, [rateGroupId, pricingDuration, withJacuzzi, isOvernight, people, startAt, selectedExtras]);

  const create = useMutation({
    mutationFn: async () => {
      if (!startAt || !roomId) throw new Error("Datos incompletos");
      if (!isAdmin && !rateGroupId) throw new Error("Datos incompletos");
      if (!isAdmin && !breakdown) throw new Error("Datos incompletos");
      if (!isAdmin && !isOvernightAllowed(startAt)) {
        throw new Error(
          "Las reservas para jueves, viernes y sábado deben realizarse por teléfono o WhatsApp."
        );
      }
      if (!isAdmin && isOvernight && (breakdown?.base ?? 0) <= 0)
        throw new Error("Tarifa de noche completa no configurada");
      if (isPublic && (!customerName || !customerEmail)) {
        throw new Error("Nombre y email son obligatorios");
      }

      // Customer (find by phone or create)
      let customerId: string | null = null;
      if (customerPhone || customerName || customerEmail) {
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

      const { data: reservation, error } = await supabase
        .from("reservations")
        .insert({
          room_id: roomId,
          customer_id: customerId,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          with_jacuzzi: withJacuzzi,
          people,
          is_overnight: isOvernight,
          base_price: useOverride ? finalTotal : (breakdown?.base ?? 0),
          third_person_surcharge: breakdown?.thirdPerson ?? 0,
          dynamic_surcharge: breakdown?.dynamicSurcharge ?? 0,
          dynamic_reason: useOverride ? "Precio manual (admin)" : (breakdown?.dynamicReason ?? null),
          extras_total: breakdown?.extrasTotal ?? 0,
          total: finalTotal,
          internal_notes: notes || null,
          manual_override: isAdmin,
          created_by_role: isAdmin ? "admin" : isPublic ? "public" : "reception",
        })
        .select("id")
        .single();
      if (error) throw error;

      // Insert extras
      const rows = selectedExtras.map((e) => ({
        reservation_id: reservation.id,
        extra_id: e.extraId,
        qty: e.qty,
        unit_price: e.price,
        is_gift: false,
      }));
      if (breakdown) {
        for (const giftId of breakdown.giftedExtraIds) {
          if (!rows.some((r) => r.extra_id === giftId)) {
            rows.push({ reservation_id: reservation.id, extra_id: giftId, qty: 1, unit_price: 0, is_gift: true });
          }
        }
      }
      if (rows.length > 0) {
        const { error: e2 } = await supabase.from("reservation_extras").insert(rows);
        if (e2) throw e2;
      }

      // Trigger confirmation email when public booking with email
      if (isPublic && customerEmail) {
        try {
          await supabase.functions.invoke("send-reservation-confirmation", {
            body: { reservation_id: reservation.id },
          });
        } catch (e) {
          console.warn("email send failed", e);
        }
      }

      return reservation.id;
    },
    onSuccess: (id) => {
      toast.success(isPublic ? "¡Reserva confirmada! Te hemos enviado un email." : "Reserva creada");
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
            <DialogTitle>{isAdmin ? "Reserva manual (admin)" : isPublic ? "Reserva tu habitación" : "Nueva reserva"}</DialogTitle>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-lg font-semibold tabular-nums">{breakdown ? eur(breakdown.total) : "—"}</div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left col: when + room */}
            <div className="space-y-4">
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
                  <Select value={time} onValueChange={(v) => setTime(clampStartTimeToAllowed(v))} disabled={isOvernight}>
                    <SelectTrigger><SelectValue placeholder="HH:MM" /></SelectTrigger>
                    <SelectContent className="max-h-[40vh]">
                      {timeOptions.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Noche completa</div>
                  <div className="text-xs text-muted-foreground">
                    {overnightAllowed ? "Disponible (dom-mié) · 22:00–10:00" : "Solo dom-mié · 22:00–10:00"}
                  </div>
                </div>
                <Switch checked={isOvernight} onCheckedChange={setOvernightChecked} disabled={!isAdmin && !overnightAllowed} />
              </div>

              {isOvernight ? (
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

              {isAdmin && (
                <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                  <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">Override admin</div>
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
                  <div className="text-[10px] text-muted-foreground">Esta reserva se marca como manual y se salta la separación de 15 min.</div>
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
          <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
            <div className="font-semibold text-foreground mb-1">CONDICIONES GENERALES</div>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Todos los extras están sujetos a disponibilidad</li>
              <li>Algunos servicios requieren reserva previa</li>
              <li>Los precios pueden variar en función de la demanda</li>
              <li>Se recomienda consultar antes de la reserva para confirmar disponibilidad</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={!roomId || !startAt || create.isPending}>
            {create.isPending ? "Creando..." : "Crear reserva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Avoid unused import
export const _ = useQuery;
