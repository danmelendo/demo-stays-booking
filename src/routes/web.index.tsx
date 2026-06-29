import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, DoorClosed, Users, Star, MapPin, ArrowRight, PartyPopper } from "lucide-react";
import { pms } from "@/integrations/pms";
import { cms } from "@/integrations/cms";
import { useBrand } from "@/lib/brand";
import { accentGradient, eur, priceBand, EVENT_CATEGORY_LABELS } from "@/lib/stays";

export const Route = createFileRoute("/web/")({
  component: WebHome,
});

const ASSET_PROPS = [
  {
    icon: Building2,
    title: "Pisos completos",
    desc: "Tu espacio entero en una urbanización con servicios.",
  },
  {
    icon: DoorClosed,
    title: "Habitaciones privadas",
    desc: "Tu habitación, zonas comunes compartidas.",
  },
  { icon: Users, title: "Habitaciones compartidas", desc: "La opción más social y asequible." },
];

function WebHome() {
  const { brand, brandId } = useBrand();
  const { data: communities } = useQuery({
    queryKey: ["pms", "properties-web", brandId],
    queryFn: () => pms.listProperties({ brand: brandId }),
  });
  const { data: events } = useQuery({
    queryKey: ["cms", "events-web"],
    queryFn: () => cms.listEvents({ upcomingOnly: true }),
  });

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ background: accentGradient(brand.heroAccent) }}
        />
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative mx-auto max-w-6xl px-5 py-20 text-white sm:py-28">
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-white/80">
            {brand.eyebrow}
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
            {brand.heroTitle}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">{brand.heroSubtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/web/communities"
              className="inline-flex items-center gap-2  bg-white px-6 py-3 font-semibold text-neutral-900"
            >
              {brandId === "campus" ? "Ver residencias" : "Explorar comunidades"}{" "}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="/stays"
              className="inline-flex items-center gap-2  border border-white/40 px-6 py-3 font-semibold text-white"
            >
              Abrir la app
            </a>
          </div>
        </div>
      </section>

      {/* Asset types */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-2xl font-bold tracking-tight">Elige cómo quieres vivir</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {ASSET_PROPS.map((a) => (
            <div key={a.title} className=" bg-white p-6 shadow-sm ring-1 ring-neutral-100">
              <span className="flex h-11 w-11 items-center justify-center  bg-[#e7ead3] text-[var(--brand)]">
                <a.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold">{a.title}</h3>
              <p className="mt-1 text-sm text-neutral-500">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured communities */}
      <section className="mx-auto max-w-6xl px-5 py-6">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Comunidades destacadas</h2>
          <Link to="/web/communities" className="text-sm font-medium text-[var(--brand)]">
            Ver todas
          </Link>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(communities ?? []).slice(0, 6).map((c) => (
            <Link
              key={c.id}
              to="/web/community/$communityId"
              params={{ communityId: c.id }}
              className="group overflow-hidden  bg-white shadow-sm ring-1 ring-neutral-100 transition hover:shadow-md"
            >
              <div className="relative h-40" style={{ background: accentGradient(c.accent) }}>
                <div className="absolute inset-0 bg-black/10" />
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-white">
                  <div>
                    <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider opacity-90">
                      <MapPin className="h-3 w-3" /> {c.provinceName}
                    </p>
                    <h3 className="text-lg font-semibold">{c.name}</h3>
                  </div>
                  <span className="flex items-center gap-1  bg-white/90 px-2 py-0.5 text-xs font-semibold text-neutral-800">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {c.rating.toFixed(1)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <p className="line-clamp-1 pr-2 text-sm text-neutral-500">{c.description}</p>
                {c.fromPrice != null && (
                  <span className="shrink-0 text-right text-sm font-semibold">
                    {eur(priceBand(c.fromPrice).from)}–{eur(priceBand(c.fromPrice).to)}
                    <span className="text-xs font-normal text-neutral-400">/noche</span>
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Community life */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex items-end justify-between">
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <PartyPopper className="h-6 w-6 text-[var(--brand)]" /> Próximos eventos
          </h2>
          <Link to="/web/events" className="text-sm font-medium text-[var(--brand)]">
            Ver agenda
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(events ?? []).slice(0, 4).map((e) => (
            <div key={e.id} className="overflow-hidden  bg-white shadow-sm ring-1 ring-neutral-100">
              <div className="h-20" style={{ background: accentGradient(e.accent) }} />
              <div className="p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--brand)]">
                  {EVENT_CATEGORY_LABELS[e.category]}
                </span>
                <h3 className="mt-1 font-semibold leading-tight">{e.title}</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  {new Date(e.startsAt).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  · {e.communityName.replace("Demo Stays · ", "")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
