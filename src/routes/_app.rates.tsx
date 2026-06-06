import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useRateGroups, useDynamicRules, eur, DURATION_LABELS } from "@/lib/data";
import { useRoles } from "@/lib/roles";
import { Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/rates")({
  component: RatesPage,
});

function RatesPage() {
  const { isAdmin, loading: rolesLoading } = useRoles();
  const { data: groups } = useRateGroups();
  const [groupId, setGroupId] = useState<string>("");

  if (rolesLoading) return null;
  if (!isAdmin) return <Navigate to="/today" />;

  const currentGroup = groups?.find((g) => g.id === groupId) ?? groups?.[0];
  const effectiveId = currentGroup?.id ?? "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tarifas</h1>
        <p className="text-sm text-muted-foreground">Tablas base, noche completa y reglas dinámicas</p>
      </div>

      <Tabs defaultValue="hourly">
        <TabsList>
          <TabsTrigger value="hourly">Por horas</TabsTrigger>
          <TabsTrigger value="overnight">Noche completa</TabsTrigger>
          <TabsTrigger value="third">3ª persona</TabsTrigger>
          <TabsTrigger value="dynamic">Dinámicas</TabsTrigger>
        </TabsList>

        <TabsContent value="hourly" className="space-y-3">
          <Select value={effectiveId} onValueChange={setGroupId}>
            <SelectTrigger className="max-w-sm"><SelectValue placeholder="Grupo de tarifa" /></SelectTrigger>
            <SelectContent>{groups?.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
          </Select>
          {effectiveId && <HourlyTable groupId={effectiveId} />}
        </TabsContent>

        <TabsContent value="overnight" className="space-y-3">
          <Select value={effectiveId} onValueChange={setGroupId}>
            <SelectTrigger className="max-w-sm"><SelectValue placeholder="Grupo de tarifa" /></SelectTrigger>
            <SelectContent>{groups?.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
          </Select>
          {effectiveId && <OvernightTable groupId={effectiveId} />}
        </TabsContent>

        <TabsContent value="third"><ThirdPersonTable /></TabsContent>
        <TabsContent value="dynamic"><DynamicRulesPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function HourlyTable({ groupId }: { groupId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["rate_hourly", groupId],
    queryFn: async () => {
      const { data, error } = await supabase.from("rate_hourly").select("*").eq("rate_group_id", groupId).order("duration_min");
      if (error) throw error;
      return data;
    },
  });
  const update = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: "price_with_jacuzzi" | "price_without_jacuzzi"; value: number | null }) => {
      const patch = field === "price_with_jacuzzi" ? { price_with_jacuzzi: value } : { price_without_jacuzzi: value };
      const { error } = await supabase.from("rate_hourly").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rate_hourly", groupId] }),
  });
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr><th className="p-2 text-left">Duración</th><th className="p-2 text-right">Con jacuzzi</th><th className="p-2 text-right">Sin jacuzzi</th></tr>
          </thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="p-2">{DURATION_LABELS[r.duration_min]}</td>
                <td className="p-2 text-right">
                  <Input type="number" defaultValue={r.price_with_jacuzzi ?? ""} className="h-8 text-right tabular-nums max-w-[100px] ml-auto"
                    onBlur={(e) => update.mutate({ id: r.id, field: "price_with_jacuzzi", value: e.target.value ? Number(e.target.value) : null })} />
                </td>
                <td className="p-2 text-right">
                  <Input type="number" defaultValue={r.price_without_jacuzzi ?? ""} className="h-8 text-right tabular-nums max-w-[100px] ml-auto"
                    onBlur={(e) => update.mutate({ id: r.id, field: "price_without_jacuzzi", value: e.target.value ? Number(e.target.value) : null })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function OvernightTable({ groupId }: { groupId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["rate_overnight", groupId],
    queryFn: async () => {
      const { data, error } = await supabase.from("rate_overnight").select("*").eq("rate_group_id", groupId).order("checkout_time");
      if (error) throw error;
      return data;
    },
  });
  const update = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const { error } = await supabase.from("rate_overnight").update({ price: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rate_overnight", groupId] }),
  });
  if (!data?.length) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Este grupo no tiene tarifa de noche completa.</CardContent></Card>;
  }
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr><th className="p-2 text-left">Hora salida</th><th className="p-2 text-right">Precio</th></tr>
          </thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="p-2 font-mono">{r.checkout_time.slice(0, 5)}</td>
                <td className="p-2 text-right">
                  <Input type="number" defaultValue={r.price} className="h-8 text-right tabular-nums max-w-[100px] ml-auto"
                    onBlur={(e) => update.mutate({ id: r.id, value: Number(e.target.value) })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function ThirdPersonTable() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["rate_third"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rate_third_person").select("*").order("duration_min");
      if (error) throw error;
      return data;
    },
  });
  const update = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const { error } = await supabase.from("rate_third_person").update({ surcharge: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rate_third"] }),
  });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Suplemento por persona adicional</CardTitle><CardDescription>Se aplica desde la 3ª persona, por persona y por tramo horario.</CardDescription></CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr><th className="p-2 text-left">Duración</th><th className="p-2 text-right">Suplemento</th></tr>
          </thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="p-2">{DURATION_LABELS[r.duration_min]}</td>
                <td className="p-2 text-right">
                  <Input type="number" defaultValue={r.surcharge} className="h-8 text-right tabular-nums max-w-[100px] ml-auto"
                    onBlur={(e) => update.mutate({ id: r.id, value: Number(e.target.value) })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function DynamicRulesPanel() {
  const qc = useQueryClient();
  const { data } = useDynamicRules();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"occupancy" | "date">("occupancy");
  const [name, setName] = useState("");
  const [multiplier, setMultiplier] = useState(15);
  const [threshold, setThreshold] = useState(70);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const config = type === "occupancy" ? { threshold } : { from, to };
      const { error } = await supabase.from("dynamic_rules").insert({
        type, name, multiplier, config: config as never, active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dynamic_rules"] }); setOpen(false); toast.success("Regla creada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("dynamic_rules").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dynamic_rules"] }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dynamic_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dynamic_rules"] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Las reglas se aplican sobre la tarifa base + suplementos. Las de fecha y ocupación se acumulan.
        </p>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nueva regla</Button>
      </div>

      <div className="grid gap-2">
        {data?.map((r) => {
          const cfg = r.config as { threshold?: number; from?: string; to?: string };
          return (
            <Card key={r.id}>
              <CardContent className="p-3 flex items-center gap-3 flex-wrap">
                <Badge variant="outline">{r.type === "occupancy" ? "Ocupación" : "Fecha"}</Badge>
                <div className="font-medium">{r.name}</div>
                <div className="text-sm text-muted-foreground">
                  {r.type === "occupancy" ? `≥ ${cfg.threshold}% ocupación` : `${cfg.from} → ${cfg.to}`}
                </div>
                <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">+{r.multiplier}%</div>
                <div className="ml-auto flex items-center gap-2">
                  <Switch checked={r.active} onCheckedChange={(active) => toggle.mutate({ id: r.id, active })} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!data?.length && <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Sin reglas. Crea la primera.</CardContent></Card>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva regla dinámica</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as "occupancy" | "date")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="occupancy">Por ocupación</SelectItem>
                  <SelectItem value="date">Por fecha</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. San Valentín, Alta ocupación" /></div>
            <div className="space-y-1.5"><Label>Recargo (%)</Label><Input type="number" value={multiplier} onChange={(e) => setMultiplier(Number(e.target.value))} /></div>
            {type === "occupancy" ? (
              <div className="space-y-1.5"><Label>Umbral de ocupación (%)</Label><Input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} /></div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5"><Label>Desde</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Hasta</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={!name}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

void eur;
