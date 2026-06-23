import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { eur, STATUS_LABELS, STATUS_COLORS, useRooms } from "@/lib/data";
import { NewReservationDialog } from "@/components/NewReservationDialog";
import { ExtendCleaningButton } from "@/components/ExtendCleaningButton";
import { ReservationExtrasInfo, type ReservationExtraItem } from "@/components/ReservationExtrasInfo";
import { Plus, LogIn, LogOut, Clock, BedDouble } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/today")({
  component: TodayPage,
});

function TodayPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: rooms } = useRooms();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: reservations } = useQuery({
    queryKey: ["reservations", "today"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, rooms(id,name,building), customers(id,name,phone), reservation_extras(qty,is_gift,bed_message,screen_message,extras(name,category))")
        .gte("start_at", today.toISOString())
        .lt("start_at", tomorrow.toISOString())
        .order("start_at");
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

  // Traditional-hotel stays checking out today (multi-night reservations start
  // on an earlier day, so the arrivals query above never surfaces them).
  const { data: departures } = useQuery({
    queryKey: ["reservations", "departures-today"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, rooms(id,name,building), customers(id,name,phone)")
        .eq("is_overnight", true)
        .gte("end_at", today.toISOString())
        .lt("end_at", tomorrow.toISOString())
        .order("end_at");
      if (error) throw error;
      return (data ?? []).filter((r) => r.status === "confirmed" || r.status === "in_progress");
    },
    refetchInterval: 30_000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("reservations").update({ status: status as never }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      toast.success("Estado actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const now = new Date();
  const occupied = reservations?.filter((r) => r.status === "in_progress").length ?? 0;
  const upcoming = reservations?.filter(
    (r) => r.status === "confirmed" && new Date(r.start_at) > now && new Date(r.start_at).getTime() - now.getTime() < 60 * 60 * 1000,
  ) ?? [];
  const totalRooms = rooms?.filter((r) => r.active).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hoy</h1>
          <p className="text-sm text-muted-foreground">
            {today.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nueva reserva
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Reservas hoy" value={String(reservations?.length ?? 0)} />
        <StatCard label="Habitaciones ocupadas" value={`${occupied}/${totalRooms}`} />
        <StatCard label="Próximas (1h)" value={String(upcoming.length)} />
        <StatCard label="Salidas hoy (noches)" value={String(departures?.length ?? 0)} />
        <StatCard
          label="Caja del día"
          value={eur(reservations?.reduce((s, r) => s + Number(r.total), 0))}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reservas de hoy</CardTitle>
        </CardHeader>
        <CardContent>
          {!reservations?.length && (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No hay reservas para hoy. Crea una nueva con el botón de arriba.
            </div>
          )}
          <div className="space-y-2">
            {reservations?.map((r) => {
              const start = new Date(r.start_at);
              const end = new Date(r.end_at);
              const nightsSpan = r.is_overnight ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000)) : 0;
              return (
                <div key={r.id} className="flex items-center gap-3 rounded-md border p-3 flex-wrap">
                  <div className="text-sm font-mono tabular-nums">
                    {start.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} →{" "}
                    {end.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="font-medium">{r.rooms?.building} · {r.rooms?.name}</div>
                  {nightsSpan > 0 && (
                    <Badge variant="outline" className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30">
                      {nightsSpan} {nightsSpan === 1 ? "noche" : "noches"}
                    </Badge>
                  )}
                  <div className="text-sm text-muted-foreground">
                    {r.customers?.name ?? "Sin nombre"} {r.customers?.phone ? `· ${r.customers.phone}` : ""}
                  </div>
                  <Badge variant="outline" className={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                  <div className="ml-auto flex items-center gap-1">
                    {/* Web pública: importe ya cobrado al TPV (depósito con promos) */}
                    {r.created_by_role === "public" && r.deposit_paid && (
                      <span className="text-xs text-emerald-700 dark:text-emerald-300 mr-1" title="Pagado online al TPV">
                        web {eur(Number(r.paid_amount))}
                      </span>
                    )}
                    <span className="text-sm font-medium tabular-nums mr-2">{eur(Number(r.total))}</span>
                    {r.status === "confirmed" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: r.id, status: "in_progress" })}>
                        <LogIn className="h-3.5 w-3.5 mr-1" /> Check-in
                      </Button>
                    )}
                    {r.status === "in_progress" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: r.id, status: "completed" })}>
                        <LogOut className="h-3.5 w-3.5 mr-1" /> Check-out
                      </Button>
                    )}
                    {r.status !== "cancelled" && r.status !== "no_show" && r.status !== "rejected" && (
                      <ExtendCleaningButton reservationId={r.id} currentCleaning={(r as { cleaning_minutes?: number }).cleaning_minutes ?? 15} />
                    )}
                  </div>
                  <ReservationExtrasInfo
                    items={(r as { reservation_extras?: ReservationExtraItem[] }).reservation_extras}
                    notes={(r as { internal_notes?: string | null }).internal_notes}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Traditional-hotel stays checking out today (started on earlier days) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BedDouble className="h-4 w-4" /> Salidas de hoy (estancias por noches)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!departures?.length && (
            <div className="text-sm text-muted-foreground">Sin salidas de estancias por noches hoy.</div>
          )}
          <div className="space-y-2">
            {departures?.map((r) => {
              const start = new Date(r.start_at);
              const end = new Date(r.end_at);
              const nightsSpan = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
              return (
                <div key={r.id} className="flex items-center gap-3 rounded-md border p-3 flex-wrap">
                  <div className="text-sm font-mono tabular-nums">
                    Salida {end.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="font-medium">{r.rooms?.building} · {r.rooms?.name}</div>
                  <Badge variant="outline" className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30">
                    {nightsSpan} {nightsSpan === 1 ? "noche" : "noches"}
                  </Badge>
                  <div className="text-sm text-muted-foreground">
                    {r.customers?.name ?? "Sin nombre"} {r.customers?.phone ? `· ${r.customers.phone}` : ""}
                  </div>
                  <Badge variant="outline" className={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                  <div className="ml-auto flex items-center gap-1">
                    <span className="text-sm font-medium tabular-nums mr-2">{eur(Number(r.total))}</span>
                    {r.status === "in_progress" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: r.id, status: "completed" })}>
                        <LogOut className="h-3.5 w-3.5 mr-1" /> Check-out
                      </Button>
                    )}
                    <ExtendCleaningButton reservationId={r.id} currentCleaning={(r as { cleaning_minutes?: number }).cleaning_minutes ?? 15} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Próximas llegadas (1h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!upcoming.length && <div className="text-sm text-muted-foreground">Sin llegadas próximas.</div>}
          <div className="space-y-2">
            {upcoming.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span className="font-mono">{new Date(r.start_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>
                <span>{r.rooms?.building} · {r.rooms?.name}</span>
                <span className="text-muted-foreground">{r.customers?.name ?? ""}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <NewReservationDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
