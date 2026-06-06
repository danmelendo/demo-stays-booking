import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRooms } from "@/lib/data";
import { useRoles } from "@/lib/roles";
import { Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bath, Droplet, Pencil, Check, X } from "lucide-react";

export const Route = createFileRoute("/_app/rooms")({
  component: RoomsPage,
});

const STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  occupied: "Ocupada",
  cleaning: "Limpieza",
  out_of_service: "Fuera de servicio",
};
const STATUS_STYLES: Record<string, string> = {
  available: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  occupied: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  cleaning: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  out_of_service: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

function RoomsPage() {
  const { isAdmin, loading: rolesLoading } = useRoles();
  const { data: rooms } = useRooms();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  if (rolesLoading) return null;
  if (!isAdmin) return <Navigate to="/today" />;

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("rooms").update({ status: status as never }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("Estado actualizado");
    },
  });

  const updateName = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("rooms").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("Nombre actualizado");
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const confirmEdit = (id: string) => {
    const name = editingName.trim();
    if (!name) return toast.error("El nombre no puede estar vacío");
    updateName.mutate({ id, name });
  };

  const cancelEdit = () => setEditingId(null);

  const buildings = Array.from(new Set(rooms?.map((r) => r.building) ?? []));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Habitaciones</h1>
        <p className="text-sm text-muted-foreground">Estado y catálogo del hotel</p>
      </div>

      {buildings.map((b) => (
        <div key={b} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">RM {b}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {rooms?.filter((r) => r.building === b).map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {editingId === r.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          className="h-7 text-sm font-semibold px-2 flex-1"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") confirmEdit(r.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => confirmEdit(r.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={cancelEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{r.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {r.jacuzzi !== "none" && r.jacuzzi !== "always" && <Bath className="h-4 w-4 text-muted-foreground" />}
                          {r.jacuzzi === "none" && <Droplet className="h-4 w-4 text-muted-foreground" />}
                          <Button
                            size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => startEdit(r.id, r.name)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Capacidad {r.capacity}</span>
                    <span>·</span>
                    <span>{r.jacuzzi === "none" ? "Sin jacuzzi" : "Con jacuzzi"}</span>
                  </div>
                  <Badge variant="outline" className={STATUS_STYLES[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                  <Select value={r.status} onValueChange={(v) => updateStatus.mutate({ id: r.id, status: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
