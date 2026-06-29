// ─────────────────────────────────────────────────────────────────────────────
// Brand layer — one tech base, two brands.
//
// The email's core ask: two distinct brands (a flex-living brand and a student-
// residences brand) sharing the SAME booking engine, payments and management
// stack. This module is the demo's answer: a single config object swaps name,
// accent colour, copy and which properties are shown, while every screen, the PMS
// connector and the mock backend stay identical. The active brand is persisted in
// localStorage and exposes its accent as the `--brand` CSS variable, so the whole
// app/web re-skins live from the switcher.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type BrandId = "living" | "campus";

export interface Brand {
  id: BrandId;
  /** Full brand name shown in headers. */
  name: string;
  /** Short label for the switcher pill. */
  short: string;
  /** Primary accent (hex). Drives the `--brand` CSS variable. */
  accent: string;
  /** HSL triplet used for hero gradients (matches the accent hue). */
  heroAccent: string;
  /** Uppercase eyebrow shown above hero/section titles. */
  eyebrow: string;
  /** One-line positioning. */
  tagline: string;
  /** Who the brand is for (used in copy). */
  audience: string;
  /** Public-web hero copy. */
  heroTitle: string;
  heroSubtitle: string;
  /** Word used for a bookable stay ("piso" vs "habitación / estudio"). */
  unitWord: string;
  /** Seed `brand` tag the discovery filters on. */
  propertyBrand: BrandId;
}

export const BRANDS: Record<BrandId, Brand> = {
  living: {
    id: "living",
    name: "Stays Living",
    short: "Living",
    accent: "#556B2F",
    heroAccent: "82 28% 32%",
    eyebrow: "Stays Living · Flex living",
    tagline: "Flex living para profesionales y nómadas",
    audience: "profesionales y nómadas",
    heroTitle: "Vive sin ataduras, cambia de ciudad cuando quieras",
    heroSubtitle:
      "Pisos y habitaciones flex living listos para entrar, con servicios incluidos y una comunidad que se mueve contigo.",
    unitWord: "piso",
    propertyBrand: "living",
  },
  campus: {
    id: "campus",
    name: "Stays Campus",
    short: "Campus",
    accent: "#7C3AED",
    heroAccent: "262 60% 40%",
    eyebrow: "Stays Campus · Residencias",
    tagline: "Residencias de estudiantes con vida de campus",
    audience: "estudiantes",
    heroTitle: "Tu residencia, tu gente, tu curso",
    heroSubtitle:
      "Estudios y habitaciones en residencias de estudiantes con zonas de estudio, eventos y todo incluido. Reserva tu plaza para el curso.",
    unitWord: "estudio",
    propertyBrand: "campus",
  },
};

const DEFAULT_BRAND: BrandId = "living";
const KEY = "stays-brand";

interface BrandCtx {
  brand: Brand;
  brandId: BrandId;
  setBrand: (id: BrandId) => void;
}

const Ctx = createContext<BrandCtx | null>(null);

function readBrand(): BrandId {
  if (typeof window === "undefined") return DEFAULT_BRAND;
  const v = window.localStorage.getItem(KEY);
  return v === "living" || v === "campus" ? v : DEFAULT_BRAND;
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brandId, setBrandIdState] = useState<BrandId>(readBrand);
  const brand = BRANDS[brandId];

  // Persist + expose the accent as a global CSS variable so every `var(--brand)`
  // utility (and toasts/portals outside the React tree) re-skins instantly.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY, brandId);
    document.documentElement.style.setProperty("--brand", brand.accent);
  }, [brandId, brand.accent]);

  const value = useMemo<BrandCtx>(
    () => ({ brand, brandId, setBrand: setBrandIdState }),
    [brand, brandId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBrand() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useBrand must be used inside BrandProvider");
  return c;
}
