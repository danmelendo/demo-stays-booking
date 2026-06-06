import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRooms, STATUS_COLORS } from "@/lib/data";
import { NewReservationDialog } from "@/components/NewReservationDialog";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
});

const HOUR_HEIGHT = 40; // px per hour
const START_HOUR = 0;
const END_HOUR = 24;

function CalendarPage() {
  const { data: rooms } = useRooms();
  const [day, setDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [open, setOpen] = useState(false);
  const [defaults, setDefaults] = useState<{ start?: Date; roomId?: string }>({});

  const dayEnd = new Date(day);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const { data: reservations } = useQuery({
    queryKey: ["reservations", "calendar", day.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, customers(name,phone)")
        .gte("start_at", new Date(day.getTime() - 12 * 3600 * 1000).toISOString())
        .lt("start_at", new Date(dayEnd.getTime() + 12 * 3600 * 1000).toISOString());
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

  const shiftDay = (delta: number) => {
    const d = new Date(day);
    d.setDate(d.getDate() + delta);
    setDay(d);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftDay(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setDay(d); }}>Hoy</Button>
          <Button variant="outline" size="icon" onClick={() => shiftDay(1)}><ChevronRight className="h-4 w-4" /></Button>
          <h1 className="text-xl font-semibold ml-2 capitalize">
            {day.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </h1>
        </div>
        <Button onClick={() => { setDefaults({ start: day }); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nueva reserva
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-auto">
          <div className="min-w-[900px] relative">
            {/* Header row */}
            <div className="grid sticky top-0 bg-background z-10 border-b" style={{ gridTemplateColumns: `60px repeat(${rooms?.length ?? 0}, minmax(120px, 1fr))` }}>
              <div className="text-xs text-muted-foreground p-2"></div>
              {rooms?.map((r) => (
                <div key={r.id} className="text-xs font-medium p-2 border-l truncate" title={`${r.building} · ${r.name}`}>
                  <div className="text-muted-foreground">{r.building}</div>
                  <div>{r.name}</div>
                </div>
              ))}
            </div>

            {/* Body */}
            <div className="grid relative" style={{ gridTemplateColumns: `60px repeat(${rooms?.length ?? 0}, minmax(120px, 1fr))` }}>
              {/* Hour labels */}
              <div className="relative" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
                {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                  <div key={i} className="absolute left-0 right-0 text-xs text-muted-foreground px-1" style={{ top: i * HOUR_HEIGHT }}>
                    {String(START_HOUR + i).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {rooms?.map((room) => (
                <div
                  key={room.id}
                  className="relative border-l cursor-pointer"
                  style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const minutes = Math.floor((y / HOUR_HEIGHT) * 60 / 15) * 15;
                    const start = new Date(day);
                    start.setMinutes(minutes);
                    setDefaults({ start, roomId: room.id });
                    setOpen(true);
                  }}
                >
                  {/* Hour grid */}
                  {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                    <div key={i} className="absolute left-0 right-0 border-t border-border/40" style={{ top: i * HOUR_HEIGHT }} />
                  ))}
                  {/* Reservations */}
                  {reservations
                    ?.filter((r) => r.room_id === room.id && r.status !== "cancelled" && r.status !== "no_show")
                    .map((r) => {
                      const s = new Date(r.start_at);
                      const e = new Date(r.end_at);
                      const startMin = (s.getTime() - day.getTime()) / 60000;
                      const endMin = (e.getTime() - day.getTime()) / 60000;
                      const top = Math.max(0, (startMin / 60) * HOUR_HEIGHT);
                      const bottom = Math.min((END_HOUR - START_HOUR) * HOUR_HEIGHT, (endMin / 60) * HOUR_HEIGHT);
                      const height = Math.max(20, bottom - top);
                      if (bottom <= 0 || top >= (END_HOUR - START_HOUR) * HOUR_HEIGHT) return null;
                      return (
                        <div
                          key={r.id}
                          className={`absolute left-1 right-1 rounded border px-1.5 py-1 text-[10px] overflow-hidden ${STATUS_COLORS[r.status]}`}
                          style={{ top, height }}
                          onClick={(e) => e.stopPropagation()}
                          title={`${r.customers?.name ?? "Sin nombre"} · ${s.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}–${e.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}`}
                        >
                          <div className="font-medium truncate">
                            {s.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}–{e.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}
                          </div>
                          <div className="truncate">{r.customers?.name ?? ""}</div>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <NewReservationDialog open={open} onOpenChange={setOpen} defaultStart={defaults.start} defaultRoomId={defaults.roomId} />
    </div>
  );
}
