import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Star, Users, ArrowRight, PartyPopper, CalendarDays } from "lucide-react";
import { pms } from "@/integrations/pms";
import { cms } from "@/integrations/cms";
import {
  accentGradient, dateOffset, AMENITY_LABELS, ASSET_TYPE_LABELS, ASSET_TYPE_SHORT,
  FEATURE_LABELS, EVENT_CATEGORY_LABELS,
} from "@/lib/stays";
import { RentalPrice } from "@/components/RentalPrice";
import { ComplexCoverArt } from "@/components/cover-art";
import type { AssetType } from "@/integrations/pms";

export const Route = createFileRoute("/web/community/$communityId")({
  component: WebCommunityDetail,
});

const ASSET_FILTERS: { label: string; value: AssetType | null }[] = [
  { label: "Todos", value: null },
  { label: "Pisos", value: "apartment" },
  { label: "Habitaciones privadas", value: "room" },
  { label: "Compartidas", value: "shared_room" },
];

function WebCommunityDetail() {
  const { communityId } = Route.useParams();
  const [checkIn, setCheckIn] = useState(dateOffset(7));
  const [checkOut, setCheckOut] = useState(dateOffset(14));
  const [assetType, setAssetType] = useState<AssetType | null>(null);

  const { data: community } = useQuery({
    queryKey: ["pms", "property", communityId],
    queryFn: () => pms.getProperty(communityId),
  });
  const { data: offers } = useQuery({
    queryKey: ["pms", "availability", communityId, checkIn, checkOut],
    queryFn: () => pms.searchAvailability({ propertyId: communityId, checkIn, checkOut, guests: 1 }),
  });
  const { data: events } = useQuery({
    queryKey: ["cms", "events", communityId],
    queryFn: () => cms.listEvents({ communityId, upcomingOnly: true }),
  });

  const filteredOffers = (offers ?? []).filter(
    (o) => assetType === null || o.room.assetType === assetType,
  );

  return (
    <div>
      {/* Hero */}
      <div className="relative h-64 overflow-hidden" style={{ background: community ? accentGradient(community.accent) : "#ddd" }}>
        <ComplexCoverArt />
        <div className="absolute inset-0 bg-black/20" />
        {community && (
          <div className="absolute bottom-6 left-0 right-0">
            <div className="mx-auto max-w-6xl px-5 text-white">
              <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider opacity-90">
                <MapPin className="h-3.5 w-3.5" /> {community.provinceName} · {community.city}
              </p>
              <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{community.name}</h1>
              <p className="mt-1 flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {community.rating.toFixed(1)} ·{" "}
                {community.address}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-6xl px-5 py-8">
        {community && (
          <>
            <p className="max-w-2xl text-neutral-600">{community.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {community.amenities.map((a) => (
                <span key={a} className=" bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                  {AMENITY_LABELS[a] ?? a}
                </span>
              ))}
            </div>
          </>
        )}

        {/* ── Date + filter bar ── */}
        <div className="mt-8 flex flex-wrap items-end gap-4  bg-white p-4 shadow-sm ring-1 ring-neutral-100">
          <div className="flex items-end gap-3">
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                <CalendarDays className="h-3 w-3" /> Entrada
              </span>
              <input
                type="date"
                value={checkIn}
                min={dateOffset(0)}
                onChange={(e) => setCheckIn(e.target.value)}
                className="border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                <CalendarDays className="h-3 w-3" /> Salida
              </span>
              <input
                type="date"
                value={checkOut}
                min={checkIn}
                onChange={(e) => setCheckOut(e.target.value)}
                className="border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {ASSET_FILTERS.map((f) => (
              <button
                key={f.label}
                onClick={() => setAssetType(f.value)}
                className={`px-3 py-2 text-sm font-medium transition ${
                  assetType === f.value
                    ? "bg-[var(--brand)] text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-3">
          {/* Assets */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold tracking-tight">Alojamientos disponibles</h2>
            <p className="text-sm text-neutral-500">
              {assetType ? ASSET_TYPE_LABELS[assetType] : "Pisos, habitaciones y habitaciones compartidas."}
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {filteredOffers.map((o) => (
                <Link
                  key={o.room.id}
                  to="/web/room/$roomId"
                  params={{ roomId: o.room.id }}
                  search={{ communityId, checkIn, checkOut }}
                  className="group overflow-hidden  bg-white shadow-sm ring-1 ring-neutral-100 transition hover:shadow-md"
                >
                  <div className="relative h-36 overflow-hidden bg-neutral-100">
                    {o.room.imageUrl ? (
                      <img src={o.room.imageUrl} alt={o.room.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-neutral-300">
                        <span className="text-4xl font-bold">{o.room.name.charAt(0)}</span>
                      </div>
                    )}
                    <span className="absolute left-3 top-3 bg-[var(--brand)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      {ASSET_TYPE_SHORT[o.room.assetType]}
                    </span>
                    {!o.available && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="bg-white/90 px-3 py-1 text-xs font-semibold text-neutral-700">Ocupado</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold">{o.room.name}</h3>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
                      <Users className="h-3 w-3" /> {o.room.capacity} habitaciones
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {o.room.features.slice(0, 4).map((fe) => (
                        <span key={fe} className="bg-[#e7ead3] px-2 py-0.5 text-[10px] font-medium text-[#3f4d24]">
                          {FEATURE_LABELS[fe]}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        {o.available ? (
                          <RentalPrice rates={o.rates} />
                        ) : (
                          <p className="text-sm font-medium text-amber-600">Ocupado ahora</p>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1  bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white">
                        Ver <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
              {filteredOffers.length === 0 && (
                <p className="col-span-2 py-8 text-center text-sm text-neutral-400">
                  Sin alojamientos para los filtros seleccionados.
                </p>
              )}
            </div>
          </div>

          {/* Community events */}
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <PartyPopper className="h-5 w-5 text-[var(--brand)]" /> Comunidad
            </h2>
            <p className="text-sm text-neutral-500">Eventos servidos por {cms.cmsName}.</p>
            <div className="mt-5 space-y-3">
              {(events ?? []).map((e) => (
                <Link
                  key={e.id}
                  to="/web/event/$eventId"
                  params={{ eventId: e.id }}
                  className=" block bg-white p-4 shadow-sm ring-1 ring-neutral-100 transition hover:shadow-md"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--brand)]">
                    {EVENT_CATEGORY_LABELS[e.category]}
                  </span>
                  <h3 className="mt-0.5 font-semibold leading-tight">{e.title}</h3>
                  <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Date(e.startsAt).toLocaleString("es-ES", {
                      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">{e.attending}/{e.capacity} apuntados</p>
                </Link>
              ))}
              {events && events.length === 0 && (
                <p className="text-sm text-neutral-400">Sin eventos próximos.</p>
              )}
              <Link to="/web/events" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand)]">
                Ver toda la agenda <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
