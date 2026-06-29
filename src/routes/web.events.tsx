import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PartyPopper, MapPin, Users, CalendarDays, Plug } from "lucide-react";
import { cms } from "@/integrations/cms";
import { accentGradient, EVENT_CATEGORY_LABELS } from "@/lib/stays";
import { EventCoverArt } from "@/components/cover-art";
import type { EventCategory, CommunityEvent } from "@/integrations/cms";

export const Route = createFileRoute("/web/events")({
  component: WebEvents,
});

const CATEGORIES: EventCategory[] = ["social", "wellness", "cultural", "sport", "market"];

function WebEvents() {
  const [category, setCategory] = useState<EventCategory | null>(null);

  const { data: events, isLoading } = useQuery({
    queryKey: ["cms", "events-web-all"],
    queryFn: () => cms.listEvents({ upcomingOnly: true }),
  });

  const visible = (events ?? []).filter((e) => (category ? e.category === category : true));

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
        <PartyPopper className="h-7 w-7 text-[var(--brand)]" /> Comunidad
      </h1>
      <p className="mt-1 text-neutral-500">La agenda de planes y eventos de todas las urbanizaciones.</p>
      <div className="mt-3 inline-flex items-center gap-1.5  bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
        <Plug className="h-3 w-3" /> Eventos servidos por {cms.cmsName} vía API
      </div>

      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
        <Chip active={category === null} onClick={() => setCategory(null)} label="Todos" />
        {CATEGORIES.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)} label={EVENT_CATEGORY_LABELS[c]} />
        ))}
      </div>

      {isLoading && <p className="py-16 text-center text-neutral-400">Cargando agenda…</p>}

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
      {!isLoading && visible.length === 0 && (
        <p className="py-16 text-center text-neutral-400">No hay eventos en esta categoría.</p>
      )}
    </div>
  );
}

function EventCard({ event }: { event: CommunityEvent }) {
  return (
    <div className="overflow-hidden  bg-white shadow-sm ring-1 ring-neutral-100">
      <div className="relative h-28 overflow-hidden" style={{ background: accentGradient(event.accent) }}>
        <EventCoverArt category={event.category} />
        <div className="absolute inset-0 bg-black/10" />
        <span className="absolute left-3 top-3  bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-800">
          {EVENT_CATEGORY_LABELS[event.category]}
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-semibold leading-tight">{event.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{event.summary}</p>
        <div className="mt-3 space-y-1 text-xs text-neutral-500">
          <p className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {new Date(event.startsAt).toLocaleString("es-ES", {
              weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
            })}
          </p>
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {event.location} · {event.communityName.replace("Demo Stays · ", "")}
          </p>
          <p className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> {event.attending}/{event.capacity} apuntados
          </p>
        </div>
        <a
          href="/stays/community"
          className="mt-4 inline-block  bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
        >
          Apuntarme en la app
        </a>
      </div>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0  px-4 py-2 text-sm font-medium transition ${
        active ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 ring-1 ring-neutral-200"
      }`}
    >
      {label}
    </button>
  );
}
