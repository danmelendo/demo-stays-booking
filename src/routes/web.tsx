import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Sparkles, ArrowUpRight } from "lucide-react";
import { useBrand } from "@/lib/brand";
import { BrandSwitcher } from "@/components/BrandSwitcher";

// Public marketing + browse site, aligned with the mobile app. A single codebase
// serves two brands (flex living / student residences) — the active one drives
// the name, accent and copy via the brand layer (src/lib/brand). Public — no
// member identity.
export const Route = createFileRoute("/web")({
  component: WebLayout,
  head: () => ({
    meta: [
      { title: "Stays · Vive en comunidad" },
      {
        name: "description",
        content:
          "Pisos, habitaciones y habitaciones compartidas en urbanizaciones con vida de comunidad y eventos. Reserva desde la app.",
      },
    ],
  }),
});

const NAV = [
  { to: "/web", label: "Inicio", exact: true },
  { to: "/web/communities", label: "Urbanizaciones", exact: false },
  { to: "/web/events", label: "Eventos comunidad", exact: false },
] as const;

function WebLayout() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { brand } = useBrand();

  return (
    <div className="min-h-[100svh] bg-[#efe8d6] text-neutral-900">
      {/* Top bar — single row on tablet/desktop, two rows on phones so nothing
          overflows. The nav drops to a scrollable second row on small screens. */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/85 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-5">
          <div className="flex h-14 items-center gap-2 sm:h-16 sm:gap-4">
            <Link to="/web" className="flex shrink-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[var(--brand)] text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="whitespace-nowrap text-base font-semibold tracking-tight sm:text-lg">
                {brand.name}
              </span>
            </Link>
            {/* Inline nav from desktop up; phones + tablets use the row below */}
            <nav className="no-scrollbar ml-2 hidden min-w-0 items-center gap-1 overflow-x-auto lg:flex">
              {NAV.map((item) => {
                const active = item.exact ? path === item.to : path.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`shrink-0 px-3 py-1.5 text-sm font-medium transition ${
                      active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
              <BrandSwitcher />
              <a
                href="/stays"
                className="inline-flex shrink-0 items-center gap-1 bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white sm:px-4"
              >
                <span className="hidden sm:inline">Abrir app</span>
                <span className="sm:hidden">App</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
          {/* Scrollable nav row on phones + tablets */}
          <nav className="no-scrollbar -mx-4 flex items-center gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
            {NAV.map((item) => {
              const active = item.exact ? path === item.to : path.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`shrink-0 px-3 py-1.5 text-sm font-medium transition ${
                    active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-neutral-500 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {brand.name} · Demo white-label sobre Demo Stays PMS
          </p>
          <div className="flex items-center gap-4">
            <a href="/stays" className="hover:text-neutral-900">
              App
            </a>
            <a href="/today" className="hover:text-neutral-900">
              Panel PMS
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
