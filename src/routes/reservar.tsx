import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Bath, Droplet, Users, CalendarIcon, Sparkles,
  ShieldCheck, CheckCircle2, CreditCard, Plus, Minus, Gift,
  Phone, ChevronRight, Tv, Moon, Clock, Star, Flame, MapPin, Globe,
} from "lucide-react";
import { toast } from "sonner";
import { calculatePrice, type PriceBreakdown } from "@/lib/pricing";
import { DURATIONS, DURATION_LABELS, eur, isOvernightAllowed } from "@/lib/data";

// Placeholder images for fallback
import extraChampagne from "@/assets/extra-champagne.jpg";
import extraDecoration from "@/assets/extra-decoration.jpg";

// Map to dynamically resolve room images from /public/imagenes
const ROOM_IMAGES_MAP: Record<string, Record<string, string>> = {
  central: {
    "Grey": "/imagenes/rooms/central-grey.svg",
    "Ocean": "/imagenes/rooms/central-ocean.svg",
    "Paris": "/imagenes/rooms/central-paris.svg",
    "Safari": "/imagenes/rooms/central-safari.svg",
    "Tokyo": "/imagenes/rooms/central-tokyo.svg",
  },
  norte: {
    "Empire State": "/imagenes/rooms/norte-empire-state.svg",
    "Grey": "/imagenes/rooms/norte-grey.svg",
    "Hollywood": "/imagenes/rooms/norte-hollywood.svg",
    "Music": "/imagenes/rooms/norte-music.svg",
    "Route 66": "/imagenes/rooms/norte-route-66.svg",
  },
  sur: {
    "Dubai": "/imagenes/rooms/sur-dubai.svg",
    "Grey": "/imagenes/rooms/sur-grey.svg",
    "Maldivas": "/imagenes/rooms/sur-maldivas.svg",
    "New York": "/imagenes/rooms/sur-new-york.svg",
    "Tu y yo": "/imagenes/rooms/sur-tu-y-yo.svg",
  },
};

export const Route = createFileRoute("/reservar")({
  component: PublicReservePage,
  head: () => ({
    meta: [
      { title: "Reserva · Demo Stays" },
      { name: "description", content: "Habitaciones temáticas con jacuzzi en el centro de Madrid. Reserva online en 2 minutos. Solo +18." },
    ],
  }),
});

type Step = "search" | "room-detail" | "details" | "payment" | "done";

interface RoomLite {
  id: string;
  name: string;
  building: string;
  capacity: number;
  jacuzzi: "always" | "optional" | "none";
  has_tv: boolean;
  has_swing: boolean;
  rate_group_id: string | null;
}

interface ExtraLite {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
}

function getRoomImage(r: { name: string; building: string }) {
  const building = r.building.toLowerCase();
  const roomName = r.name;
  
  const buildingMap = ROOM_IMAGES_MAP[building as keyof typeof ROOM_IMAGES_MAP];
  if (buildingMap && buildingMap[roomName]) {
    return buildingMap[roomName];
  }
  
  // Fallback: return a generic placeholder (e.g., a data URL or default image)
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect fill='%23ccc' width='400' height='300'/%3E%3Ctext x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='20' fill='%23999'%3EHabitación%3C/text%3E%3C/svg%3E";
}

// Decoration images per tier, keyed by price (Especial 20 €, Plus 30 €,
// Premium 50 €, Premium Deluxe 145 €). Premium (50 €) has no dedicated photo
// yet, so it falls back to the generic decoration image.
const DECORATION_IMAGES_BY_PRICE: Record<number, string> = {
  20: "/imagenes/decorations/especial.svg",        // Especial
  30: "/imagenes/decorations/plus.svg",            // Plus
  145: "/imagenes/decorations/premium-deluxe.svg", // Premium Deluxe
};

function getExtraImage(ex: ExtraLite) {
  if (ex.category === "decoration") {
    return DECORATION_IMAGES_BY_PRICE[Number(ex.price)] ?? extraDecoration;
  }
  if (/cava|moet|champ|juve/i.test(ex.name)) return extraChampagne;
  return null;
}

const EXTRA_CATEGORY_LABELS: Record<string, string> = {
  decoration: "Decoración",
  drinks: "Bebidas",
  hookah: "Cachimba",
  accessories: "Accesorios",
};

// Decorations above the basic "Especial" (20 €) — i.e. Plus (30 €), Premium
// (50 €) and Premium Deluxe (145 €) — include personalised phrases that staff
// set up in the room, so the customer must enter them when selecting one.
const DECORATION_FREE_MESSAGE_MAX_PRICE = 20;
const BED_MESSAGE_MAX_WORDS = 2;
const SCREEN_MESSAGE_MAX_WORDS = 10;

function decorationNeedsMessage(ex: ExtraLite) {
  return ex.category === "decoration" && Number(ex.price) > DECORATION_FREE_MESSAGE_MAX_PRICE;
}

// Debug discount code: reduces the total by 99.9% so the Redsys deposit drops to
// the gateway minimum (0.01 €), letting us test the real TPV with a tiny charge.
// NOTE: validated client-side only — it is visible in the JS bundle and amounts
// are not enforced server-side. Remove/disable before opening real sales.
const DEBUG_DISCOUNT_CODE = "RMDEBUG999";
const DEBUG_DISCOUNT_PCT = 0.999;
const REDSYS_MIN_EUR = 0.01;

function countWords(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

interface DecoMessage {
  bed: string;
  screen: string;
}

const STEPS = [
  { key: "search", label: "Buscar" },
  { key: "room-detail", label: "Tu habitación" },
  { key: "details", label: "Tus datos" },
  { key: "payment", label: "Pago" },
];

const STEP_INDEX: Record<Step, number> = {
  search: 0,
  "room-detail": 1,
  details: 2,
  payment: 3,
  done: 4,
};

const BUILDINGS: { value: string; label: string; address: string }[] = [
  {
    value: "central",
    label: "Sede Central",
    address: "Calle Demo, 1 · Sede Central",
  },
  {
    value: "norte",
    label: "Sede Norte",
    address: "Sede Norte",
  },
  {
    value: "sur",
    label: "Sede Sur",
    address: "Avenida Demo, 15 · Sede Sur",
  },
];

const CONTACTS: Record<string, { phones: { number: string; href: string }[]; email: string; address: string }> = {
  central: {
    phones: [
      { number: "900 000 001", href: "tel:+34900000001" },
      { number: "900 000 002", href: "tel:+34900000002" },
    ],
    email: "reservas@demostays.example",
    address: "Calle Demo, 1 · Sede Central",
  },
  norte: {
    phones: [
      { number: "900 000 010", href: "tel:+34900000010" },
      { number: "900 000 011", href: "tel:+34900000011" },
    ],
    email: "reservas@demostays.example",
    address: "Sede Norte",
  },
  sur: {
    phones: [
      { number: "900 000 020", href: "tel:+34900000020" },
      { number: "900 000 021", href: "tel:+34900000021" },
    ],
    email: "reservas@demostays.example",
    address: "Avenida Demo, 15 · Sede Sur",
  },
};

// ─────────────────────────────────────────────
// Styles (injected once via <style> tag)
// ─────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:wght@300;400;500&display=swap');

  .rm-page {
    --gold: #b8975a;
    --gold-light: #d4b483;
    --gold-dark: #8a6e3e;
    --ink: #1a1410;
    --ink-mid: #3d3328;
    --ink-soft: #7a6e62;
    --cream: #faf7f2;
    --cream-dark: #f0ead8;
    --warm-white: #fffdf9;
    --border: rgba(184,151,90,0.25);
    --border-strong: rgba(184,151,90,0.5);
    font-family: 'DM Sans', sans-serif;
    background: var(--cream);
    color: var(--ink);
    min-height: 100svh;
  }

  .rm-page * { box-sizing: border-box; }
  .rm-page *:where(:not(input):not(button):not(select):not(textarea)) { margin: 0; padding: 0; }

  .rm-serif { font-family: 'Cormorant Garamond', Georgia, serif; }

  /* Header */
  .rm-header {
    position: sticky; top: 0; z-index: 50;
    background: var(--ink);
    border-bottom: 1px solid var(--gold-dark);
  }
  .rm-header-inner {
    max-width: 1100px; margin: 0 auto;
    padding: 0 24px;
    height: 64px;
    display: flex; align-items: center; gap: 20px;
  }
  .rm-logo {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px; font-weight: 600; letter-spacing: 0.08em;
    color: var(--gold);
    text-transform: uppercase;
    white-space: nowrap;
  }
  .rm-logo span { color: #fff; }
  .rm-help {
    margin-left: auto;
    display: flex; align-items: center; gap: 8px;
    color: rgba(255,255,255,0.6); font-size: 13px;
  }
  .rm-help a { color: var(--gold-light); text-decoration: none; font-weight: 500; }

  /* Age banner */
  .rm-age-banner {
    background: var(--gold);
    text-align: center;
    padding: 7px 16px;
    font-size: 12px; font-weight: 500; letter-spacing: 0.05em;
    color: var(--ink);
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }

  /* Step indicator */
  .rm-steps {
    background: var(--warm-white);
    border-bottom: 1px solid var(--border);
  }
  .rm-steps-inner {
    max-width: 1100px; margin: 0 auto;
    padding: 0 24px;
    display: flex; align-items: center;
    height: 52px; gap: 0;
  }
  .rm-step {
    display: flex; align-items: center; gap: 10px;
    padding: 0 4px;
    font-size: 13px;
    color: var(--ink-soft);
    flex-shrink: 0;
  }
  .rm-step-num {
    width: 24px; height: 24px; border-radius: 50%;
    border: 1.5px solid currentColor;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 500;
    flex-shrink: 0;
  }
  .rm-step.active { color: var(--gold-dark); font-weight: 500; }
  .rm-step.active .rm-step-num { background: var(--gold); border-color: var(--gold); color: #fff; }
  .rm-step.done { color: var(--ink-mid); }
  .rm-step.done .rm-step-num { background: var(--ink-mid); border-color: var(--ink-mid); color: #fff; }
  .rm-step-sep { flex: 1; height: 1px; background: var(--border); min-width: 12px; max-width: 60px; }

  /* Main layout */
  .rm-main {
    max-width: 1100px; margin: 0 auto;
    padding: 40px 24px 80px;
  }

  /* ── SEARCH STEP ── */
  .rm-hero { text-align: center; margin-bottom: 48px; }
  .rm-hero-eyebrow {
    font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--gold); font-weight: 500; margin-bottom: 12px;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .rm-hero h1 {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(38px, 7vw, 68px);
    font-weight: 500; line-height: 1.08;
    color: var(--ink);
    margin-bottom: 16px;
  }
  .rm-hero h1 em { font-style: italic; color: var(--gold-dark); }
  .rm-hero p { font-size: 16px; color: var(--ink-soft); max-width: 480px; margin: 0 auto; line-height: 1.65; }

  .rm-search-card {
    background: var(--warm-white);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 32px;
    max-width: 720px; margin: 0 auto 32px;
    box-shadow: 0 4px 40px rgba(26,20,16,0.06);
  }
  @media (max-width: 600px) {
    .rm-search-card { padding: 20px 16px; border-radius: 12px; }
    .rm-card { padding: 20px 16px; }
  }
  .rm-search-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  @media (max-width: 600px) {
    .rm-search-grid { grid-template-columns: 1fr; }
  }
  .rm-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .rm-label {
    font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;
    font-weight: 500; color: var(--ink-soft);
  }

  .rm-overnight-row {
    grid-column: 1 / -1;
    display: flex; align-items: center; justify-content: space-between;
    background: var(--cream);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px 18px;
  }
  .rm-overnight-row-label { font-size: 14px; font-weight: 500; color: var(--ink); }
  .rm-overnight-row-sub { font-size: 12px; color: var(--ink-soft); margin-top: 2px; }

  .rm-btn-primary {
    grid-column: 1 / -1;
    background: var(--ink);
    color: var(--gold-light);
    border: none;
    border-radius: 10px;
    height: 52px;
    font-size: 14px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    font-family: 'DM Sans', sans-serif;
  }
  .rm-btn-primary:hover { background: var(--gold-dark); color: #fff; }

  .rm-trust {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 12px; max-width: 720px; margin: 0 auto;
  }
  @media (max-width: 520px) { .rm-trust { grid-template-columns: 1fr; } }
  .rm-trust-item {
    background: var(--warm-white);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    text-align: center;
  }
  .rm-trust-icon { font-size: 22px; margin-bottom: 8px; }
  .rm-trust-title { font-size: 14px; font-weight: 500; color: var(--ink); margin-bottom: 4px; }
  .rm-trust-sub { font-size: 12px; color: var(--ink-soft); }

  /* ── ROOMS STEP ── */
  .rm-section-header { margin-bottom: 28px; }
  .rm-section-header h2 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 36px; font-weight: 500; color: var(--ink);
    margin-bottom: 6px;
  }
  .rm-section-header p { font-size: 14px; color: var(--ink-soft); }

  .rm-rooms-list { display: flex; flex-direction: column; gap: 0; }

  .rm-room-card {
    background: var(--warm-white);
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
    transition: border-color 0.2s, box-shadow 0.2s;
    margin-bottom: 20px;
  }
  .rm-room-card:hover { border-color: var(--border-strong); box-shadow: 0 8px 40px rgba(26,20,16,0.09); }

  .rm-room-top {
    display: grid;
    grid-template-columns: 300px 1fr auto;
  }
  @media (max-width: 680px) {
    .rm-room-top { grid-template-columns: 1fr; }
  }

  .rm-room-img {
    aspect-ratio: 4/3;
    object-fit: cover;
    width: 100%; height: 100%;
    display: block;
  }
  @media (max-width: 680px) { .rm-room-img { max-height: 220px; } }

  .rm-room-info { padding: 24px; }
  .rm-room-building {
    font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--gold); font-weight: 500; margin-bottom: 6px;
  }
  .rm-room-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: 26px; font-weight: 500; color: var(--ink);
    margin-bottom: 12px; line-height: 1.1;
  }
  .rm-room-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
  .rm-badge {
    display: inline-flex; align-items: center; gap: 5px;
    background: var(--cream); border: 1px solid var(--border);
    border-radius: 20px; padding: 4px 10px;
    font-size: 12px; color: var(--ink-mid);
  }
  .rm-room-desc { font-size: 13px; color: var(--ink-soft); line-height: 1.6; }

  .rm-room-cta {
    padding: 24px;
    border-left: 1px solid var(--border);
    display: flex; flex-direction: column;
    align-items: flex-end; justify-content: space-between;
    gap: 16px; min-width: 160px;
  }
  @media (max-width: 680px) {
    .rm-room-cta {
      border-left: none; border-top: 1px solid var(--border);
      flex-direction: row; align-items: center;
      padding: 16px 24px;
    }
  }
  .rm-price-from { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-soft); }
  .rm-price-amount {
    font-family: 'Cormorant Garamond', serif;
    font-size: 34px; font-weight: 500; color: var(--ink);
    line-height: 1;
  }
  .rm-btn-select {
    background: var(--gold);
    color: var(--ink);
    border: none; border-radius: 8px;
    padding: 12px 24px;
    font-size: 13px; font-weight: 500; letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.2s;
    font-family: 'DM Sans', sans-serif;
    white-space: nowrap;
  }
  .rm-btn-select:hover { background: var(--gold-dark); color: #fff; }

  /* Extras dentro de la habitación */
  .rm-room-extras {
    border-top: 1px solid var(--border);
    padding: 0 24px 24px;
  }
  .rm-extras-toggle {
    width: 100%;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: 16px 0;
    display: flex; align-items: center; justify-content: space-between;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    color: var(--ink-mid); font-size: 13px; font-weight: 500;
  }
  .rm-extras-toggle:hover { color: var(--gold-dark); }

  .rm-extras-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
    padding-top: 16px;
  }

  .rm-extra-item {
    border: 1.5px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    transition: border-color 0.15s;
    cursor: pointer;
    background: var(--warm-white);
  }
  .rm-extra-item.selected { border-color: var(--gold); background: rgba(184,151,90,0.04); }
  .rm-extra-img { width: 100%; height: 90px; object-fit: cover; display: block; }
  .rm-extra-body { padding: 10px 12px; }
  .rm-extra-name { font-size: 13px; font-weight: 500; color: var(--ink); margin-bottom: 2px; line-height: 1.3; }
  .rm-extra-desc { font-size: 11px; color: var(--ink-soft); line-height: 1.4; margin-bottom: 8px; }
  .rm-extra-footer { display: flex; align-items: center; justify-content: space-between; }
  .rm-extra-price { font-family: 'Cormorant Garamond', serif; font-size: 18px; font-weight: 500; color: var(--gold-dark); }
  .rm-extra-qty { display: flex; align-items: center; gap: 6px; }
  .rm-qty-btn {
    width: 26px; height: 26px; border-radius: 50%;
    border: 1px solid var(--border-strong);
    background: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: var(--ink-mid); transition: background 0.15s;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px; line-height: 1;
  }
  .rm-qty-btn:hover { background: var(--gold); border-color: var(--gold); color: #fff; }
  .rm-qty-val { font-size: 14px; font-weight: 500; min-width: 18px; text-align: center; color: var(--ink); }

  /* Jacuzzi toggle en detail */
  .rm-jacuzzi-toggle {
    display: flex; align-items: center; justify-content: space-between;
    background: var(--cream); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px 18px; margin-bottom: 24px;
  }

  /* ── LAYOUT CON SIDEBAR ── */
  .rm-layout { display: grid; grid-template-columns: 1fr 340px; gap: 32px; align-items: start; }
  @media (max-width: 860px) { .rm-layout { grid-template-columns: 1fr; } }

  /* Form card */
  .rm-card {
    background: var(--warm-white);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 32px;
  }
  .rm-card h2 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 28px; font-weight: 500; color: var(--ink);
    margin-bottom: 24px;
  }

  .rm-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 600px) { .rm-form-grid { grid-template-columns: 1fr; } }
  .rm-form-full { grid-column: 1 / -1; }

  .rm-check-row {
    display: flex; align-items: flex-start; gap: 10px;
    cursor: pointer; padding: 4px 0;
  }
  .rm-check-row span { font-size: 13px; color: var(--ink-mid); line-height: 1.5; }

  /* Summary sidebar */
  .rm-summary {
    background: var(--ink);
    color: #fff;
    border-radius: 16px;
    padding: 28px;
    position: sticky; top: 80px;
  }
  .rm-summary-room-img { width: 100%; height: 140px; object-fit: cover; border-radius: 10px; margin-bottom: 16px; }
  .rm-summary-label {
    font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--gold-light); font-weight: 500;
  }
  .rm-summary-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px; color: #fff; margin: 4px 0 16px;
  }
  .rm-summary-row {
    display: flex; justify-content: space-between;
    font-size: 13px; color: rgba(255,255,255,0.6);
    padding: 5px 0;
  }
  .rm-summary-row-val { color: rgba(255,255,255,0.9); }
  .rm-summary-divider { border: none; border-top: 1px solid rgba(255,255,255,0.12); margin: 12px 0; }
  .rm-summary-total {
    display: flex; justify-content: space-between;
    font-size: 15px; font-weight: 500; color: #fff;
    padding: 6px 0;
  }
  .rm-summary-total-val {
    font-family: 'Cormorant Garamond', serif;
    font-size: 26px; color: var(--gold-light);
  }
  .rm-summary-deposit {
    font-size: 12px; color: rgba(255,255,255,0.45);
    margin-top: 6px; text-align: right;
  }

  /* Payment step */
  .rm-payment-box {
    background: var(--cream);
    border: 1px solid var(--border);
    border-radius: 12px; padding: 20px; margin-bottom: 20px;
  }
  .rm-payment-row { display: flex; justify-content: space-between; font-size: 14px; padding: 6px 0; color: var(--ink-mid); }
  .rm-payment-row-val { font-weight: 500; color: var(--ink); }
  .rm-payment-highlight {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 8px 0 0; border-top: 1px solid var(--border); margin-top: 4px;
    font-weight: 500;
  }
  .rm-payment-amount {
    font-family: 'Cormorant Garamond', serif;
    font-size: 32px; color: var(--gold-dark);
  }
  .rm-demo-notice {
    background: rgba(184,151,90,0.08); border: 1px solid var(--border);
    border-radius: 8px; padding: 12px 14px;
    font-size: 12px; color: var(--gold-dark); margin-bottom: 20px;
  }

  /* Done */
  .rm-done {
    text-align: center; max-width: 480px; margin: 60px auto; padding: 0 16px;
  }
  .rm-done-icon {
    width: 72px; height: 72px; border-radius: 50%;
    background: rgba(184,151,90,0.12); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 24px;
    color: var(--gold);
  }
  .rm-done h2 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 42px; font-weight: 500; color: var(--ink); margin-bottom: 14px;
  }
  .rm-done p { font-size: 15px; color: var(--ink-soft); line-height: 1.65; margin-bottom: 8px; }
  .rm-done-ref { font-size: 12px; color: var(--ink-soft); margin-top: 4px; letter-spacing: 0.06em; }

  /* Back button */
  .rm-back {
    background: none; border: 1px solid rgba(255,255,255,0.2);
    color: rgba(255,255,255,0.7); border-radius: 7px;
    padding: 6px 14px; font-size: 12px; cursor: pointer;
    margin-left: auto;
    font-family: 'DM Sans', sans-serif;
    transition: border-color 0.15s, color 0.15s;
  }
  .rm-back:hover { border-color: var(--gold-light); color: var(--gold-light); }

  /* Continue btn in layout */
  .rm-btn-continue {
    width: 100%;
    background: var(--ink); color: var(--gold-light);
    border: none; border-radius: 10px;
    height: 52px;
    font-size: 13px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase;
    cursor: pointer; transition: background 0.2s;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    font-family: 'DM Sans', sans-serif;
    margin-top: 20px;
  }
  .rm-btn-continue:hover { background: var(--gold-dark); color: #fff; }
  .rm-btn-continue:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Building select */
  .rm-building-select {
    display: flex; align-items: center; gap: 10px;
    background: var(--warm-white);
    border: 1px solid var(--border-strong);
    border-radius: 10px; padding: 10px 14px;
    cursor: pointer; width: 100%;
    font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--ink);
    appearance: none; -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a6e3e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
    padding-right: 32px;
    transition: border-color 0.15s;
  }
  .rm-building-select:focus { outline: none; border-color: var(--gold); }
  .rm-building-select:hover:not(:disabled) { border-color: var(--gold); }
  .rm-building-select:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Unavailable room overlay */
  .rm-room-card.rm-unavailable { opacity: 1; pointer-events: none; }
  .rm-room-card.rm-unavailable .rm-room-img { filter: grayscale(60%); }
  .rm-room-card.rm-unavailable .rm-room-name,
  .rm-room-card.rm-unavailable .rm-room-desc { opacity: 0.5; }
  .rm-room-card.rm-unavailable .rm-room-cta { opacity: 0.4; }
  .rm-unavailable-overlay {
    position: absolute; inset: 0;
    background: rgba(250,247,242,0.6);
    display: flex; align-items: center; justify-content: center;
    border-radius: 16px;
  }
  .rm-unavailable-pill {
    background: var(--ink); color: #fff;
    border-radius: 30px; padding: 8px 20px;
    font-size: 13px; font-weight: 500; letter-spacing: 0.04em;
    display: flex; align-items: center; gap: 7px;
  }


  /* Footer */
  .rm-footer {
    background: var(--ink); color: rgba(255,255,255,0.4);
    text-align: center; padding: 20px 24px;
    font-size: 12px; line-height: 1.7;
    border-top: 1px solid rgba(184,151,90,0.2);
  }
  .rm-footer strong { color: var(--gold-light); }

  /* Decoration message inputs */
  .rm-deco-msg {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed var(--border);
    display: flex; flex-direction: column; gap: 10px;
  }
  .rm-deco-msg-field { display: flex; flex-direction: column; gap: 4px; }
  .rm-deco-msg-label {
    font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
    font-weight: 500; color: var(--gold-dark);
  }
  .rm-deco-msg-input {
    width: 100%;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    color: var(--ink);
    background: var(--warm-white);
  }
  .rm-deco-msg-input:focus { outline: none; border-color: var(--gold); }
  .rm-deco-msg-input.rm-invalid { border-color: #c0392b; background: rgba(192,57,43,0.05); }
  .rm-deco-msg-hint { font-size: 10px; color: var(--ink-soft); }
  .rm-deco-msg-hint.rm-over { color: #c0392b; }
`;

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
function PublicReservePage() {
  const [step, setStep] = useState<Step>("search");

  // search
  const [date, setDate] = useState("");
  const [time, setTime] = useState("22:00");
  const [duration, setDuration] = useState(120);
  const [isOvernight, setIsOvernight] = useState(false);
  const [people, setPeople] = useState(2);
  const [building, setBuilding] = useState("central");

  // room
  const [room, setRoom] = useState<RoomLite | null>(null);
  const [withJacuzzi, setWithJacuzzi] = useState(false);
  const [expandedExtrasRoom, setExpandedExtrasRoom] = useState<string | null>(null);

  // extras (shared across rooms in search, then locked after select)
  const [extraQty, setExtraQty] = useState<Record<string, number>>({});
  // Personalised phrases per decoration extra id (bed + glass/LED screen)
  const [decoMessages, setDecoMessages] = useState<Record<string, DecoMessage>>({});
  // Discount code (debug): see DEBUG_DISCOUNT_CODE
  const [discountInput, setDiscountInput] = useState("");
  const [discountPct, setDiscountPct] = useState(0);

  // customer
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [adult, setAdult] = useState(false);
  const [noContact, setNoContact] = useState(false);

  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [didSearch, setDidSearch] = useState(false);
  const roomsRef = useRef<HTMLDivElement>(null);
  const isFirstHistoryEntry = useRef(true);
  const handlingPop = useRef(false);
  const payingGuard = useRef(false);

  const startAt = useMemo(() => (date && time ? new Date(`${date}T${time}:00`) : null), [date, time]);
  const overnightAllowed = startAt ? isOvernightAllowed(startAt) : false;

  const endAt = useMemo(() => {
    if (!startAt) return null;
    const e = new Date(startAt);
    if (isOvernight) { e.setDate(e.getDate() + 1); e.setHours(10, 0, 0, 0); }
    else { e.setMinutes(e.getMinutes() + duration); }
    return e;
  }, [startAt, isOvernight, duration]);

  const pricingDuration = useMemo(() => {
    const c = Math.min(360, Math.max(60, duration));
    return Math.min(360, Math.max(60, Math.ceil(c / 30) * 30));
  }, [duration]);

  const { data: rooms } = useQuery({
    queryKey: ["public-rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms").select("id,name,building,capacity,jacuzzi,has_tv,has_swing,rate_group_id")
        .eq("active", true).order("sort_order");
      if (error) throw error;
      return data as RoomLite[];
    },
  });

  const { data: rateHourly } = useQuery({
    queryKey: ["public-rate-hourly"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rate_hourly").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: extras } = useQuery({
    queryKey: ["public-extras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extras").select("id,name,description,price,category")
        .eq("active", true).order("sort_order");
      if (error) throw error;
      return (data as ExtraLite[]).filter(e => e.category !== "services" && Number(e.price) > 0);
    },
  });

  const fromPriceByRoom = useMemo(() => {
    const map = new Map<string, number>();
    if (!rooms || !rateHourly) return map;
    const cheapestByGroup = new Map<string, number>();
    for (const r of rateHourly as { rate_group_id: string; price_without_jacuzzi: number | null; price_with_jacuzzi: number | null }[]) {
      const candidates = [Number(r.price_without_jacuzzi ?? Infinity), Number(r.price_with_jacuzzi ?? Infinity)].filter(n => Number.isFinite(n));
      if (!candidates.length) continue;
      const best = Math.min(...candidates);
      const cur = cheapestByGroup.get(r.rate_group_id);
      if (cur === undefined || best < cur) cheapestByGroup.set(r.rate_group_id, best);
    }
    for (const room of rooms) {
      if (room.rate_group_id) {
        const p = cheapestByGroup.get(room.rate_group_id);
        if (p !== undefined) map.set(room.id, p);
      }
    }
    return map;
  }, [rooms, rateHourly]);

  const { data: conflicts } = useQuery({
    queryKey: ["public-conflicts", startAt?.toISOString(), endAt?.toISOString()],
    enabled: !!startAt && !!endAt,
    queryFn: async () => {
      if (!startAt || !endAt) return new Set<string>();
      const padStart = new Date(startAt.getTime() - 15 * 60_000);
      const padEnd = new Date(endAt.getTime() + 15 * 60_000);
      const sixtyMinutesAgo = new Date(Date.now() - 60 * 60_000).toISOString();
      const { data, error } = await supabase
        .from("reservations").select("room_id,status,deposit_paid,created_at")
        .gte("end_at", padStart.toISOString())
        .lte("start_at", padEnd.toISOString())
        .or(`deposit_paid.eq.true,created_at.gte.${sixtyMinutesAgo}`);
      if (error) throw error;
      const blocked = new Set<string>();
      for (const r of data ?? []) {
        if (r.status === "cancelled" || r.status === "no_show" || r.status === "rejected") continue;
        blocked.add(r.room_id);
      }
      return blocked;
    },
  });

  useEffect(() => {
    if (!room?.rate_group_id || !startAt) { setBreakdown(null); return; }
    if (step !== "room-detail" && step !== "details" && step !== "payment") return;
    let cancel = false;
    const selectedExtras = Object.entries(extraQty)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => {
        const ex = extras?.find(e => e.id === id);
        return { extraId: id, qty: q, price: Number(ex?.price ?? 0) };
      });
    calculatePrice({
      rateGroupId: room.rate_group_id,
      durationMin: pricingDuration,
      withJacuzzi: room.jacuzzi === "always" ? true : room.jacuzzi === "none" ? false : withJacuzzi,
      isOvernight,
      overnightCheckout: isOvernight ? "10:00:00" : undefined,
      people,
      startAt,
      extras: selectedExtras,
    })
      .then(b => { if (!cancel) setBreakdown(b); })
      .catch(() => { if (!cancel) setBreakdown(null); });
    return () => { cancel = true; };
  }, [room, withJacuzzi, isOvernight, people, startAt, pricingDuration, extras, extraQty, step]);

  const goSearch = () => {
    if (!date || !time) return toast.error("Selecciona fecha y hora");
    setRoom(null);
    setStep("search");
    setDidSearch(true);
  };

  const availableRooms = useMemo(() => {
    if (!rooms) return [];

    return rooms.filter((r) => {
      const roomBuilding = String(r.building ?? "")
        .trim()
        .toLowerCase();

      const selectedBuilding = String(building ?? "")
        .trim()
        .toLowerCase();

      return roomBuilding.includes(selectedBuilding);
    });
  }, [rooms, people, building]);

  useEffect(() => {
    if (didSearch && availableRooms.length > 0) {
      roomsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setDidSearch(false);
    }
  }, [didSearch, availableRooms.length]);

  useEffect(() => {
    if (rooms) {
      const uniqueBuildings = [...new Set(rooms.map(r => r.building))];
      console.log("UNIQUE BUILDINGS:", uniqueBuildings);
    }
  }, [rooms]);

  const selectRoom = (r: RoomLite) => {
    setRoom(r);
    setWithJacuzzi(r.jacuzzi === "always");
    setStep("room-detail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Sync step changes into browser history so the back button works
  useEffect(() => {
    if (handlingPop.current) { handlingPop.current = false; return; }
    if (isFirstHistoryEntry.current) {
      isFirstHistoryEntry.current = false;
      window.history.replaceState({ step }, "");
      return;
    }
    window.history.pushState({ step }, "");
  }, [step]);

  // Handle browser back/forward button
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = (e.state as { step?: Step } | null)?.step;
      if (!s) return;
      handlingPop.current = true;
      setStep(s);
      if (s === "search") setRoom(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const handleBack = () => {
    if (step === "search") return;
    if (step === "room-detail") { setStep("search"); setRoom(null); }
    else if (step === "details") setStep("room-detail");
    else if (step === "payment") setStep("details");
  };

  const submitDetails = () => {
    if (!customerName.trim() || !customerEmail.trim()) return toast.error("Nombre y email obligatorios");
    if (!adult) return toast.error("Debes confirmar que eres mayor de 18 años");
    setStep("payment");
  };

  const createReservation = async () => {
    if (!room || !startAt || !endAt || !breakdown) return;
    if (payingGuard.current) return;
    payingGuard.current = true;
    setPaying(true);
    let createdReservationId: string | null = null;
    try {
      // Find-or-create customer by email (SECURITY DEFINER RPC) to avoid
      // duplicate customer rows from repeated public bookings.
      const { data: customerId, error: customerErr } = await supabase.rpc(
        "find_or_create_customer" as never,
        {
          p_name: customerName,
          p_email: customerEmail,
          p_phone: customerPhone || null,
          p_no_contact: noContact,
        } as never,
      );
      if (customerErr || !customerId) throw customerErr ?? new Error("No se pudo registrar el cliente");

      const total = payableTotal;
      const deposit = depositAmount;
      const { data: reservation, error: rerr } = await supabase.from("reservations").insert({
        room_id: room.id, customer_id: customerId as unknown as string,
        start_at: startAt.toISOString(), end_at: endAt.toISOString(),
        with_jacuzzi: room.jacuzzi === "always" ? true : room.jacuzzi === "none" ? false : withJacuzzi,
        people, is_overnight: isOvernight,
        base_price: breakdown.base, third_person_surcharge: breakdown.thirdPerson,
        dynamic_surcharge: breakdown.dynamicSurcharge, dynamic_reason: breakdown.dynamicReason,
        extras_total: breakdown.extrasTotal, total,
        deposit_amount: deposit, deposit_paid: false,
        status: "pending", manual_override: false, created_by_role: "public",
        internal_notes: discountPct > 0 ? "Reserva de prueba — descuento debug −99,9%" : null,
      }).select("id").single();
      if (rerr) throw rerr;
      createdReservationId = reservation.id;

      const rows = Object.entries(extraQty).filter(([, q]) => q > 0).map(([extraId, qty]) => {
        const ex = extras?.find(e => e.id === extraId);
        const msg = ex && decorationNeedsMessage(ex) ? decoMessages[extraId] : undefined;
        return {
          reservation_id: reservation.id, extra_id: extraId, qty,
          unit_price: Number(ex?.price ?? 0), is_gift: false,
          bed_message: msg?.bed.trim() || null,
          screen_message: msg?.screen.trim() || null,
        };
      });
      for (const giftId of breakdown.giftedExtraIds) {
        if (!rows.some(r => r.extra_id === giftId))
          rows.push({ reservation_id: reservation.id, extra_id: giftId, qty: 1, unit_price: 0, is_gift: true, bed_message: null, screen_message: null });
      }
      if (rows.length > 0) await supabase.from("reservation_extras").insert(rows);

      // Initiate Redsys payment — edge function returns signed form fields
      const { data: redsysData, error: redsysErr } = await supabase.functions.invoke(
        "create-redsys-payment",
        { body: { reservation_id: reservation.id } },
      );
      if (redsysErr) {
        let msg = "Error al procesar el pago";
        try {
          // FunctionsHttpError.context is the raw Response (body not yet consumed)
          const ctx = (redsysErr as any).context;
          if (ctx?.json) {
            const body = await ctx.json();
            msg = body?.error ?? body?.message ?? msg;
          } else if ((redsysErr as any).message) {
            msg = (redsysErr as any).message;
          }
        } catch { /* ignore */ }
        console.error("[pago] error de edge function:", redsysErr);
        throw new Error(msg);
      }
      // Bypass mode: edge function marked the reservation as paid directly
      if (redsysData?.bypass) {
        window.location.href = redsysData.redirectUrl ?? "/";
        return;
      }

      if (!redsysData?.action || !redsysData?.formFields) {
        throw new Error("Respuesta inesperada del servidor de pagos");
      }

      // Auto-submit form to Redsys TPV (browser navigates away)
      const form = document.createElement("form");
      form.method = "POST";
      form.action = redsysData.action;
      form.style.display = "none";
      for (const [name, value] of Object.entries(redsysData.formFields as Record<string, string>)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
      // Note: setPaying(false) intentionally omitted — browser navigates away
    } catch (e: any) {
      if (createdReservationId) {
        await supabase.from("reservation_extras").delete().eq("reservation_id", createdReservationId);
        await supabase.from("reservations").delete().eq("id", createdReservationId);
      }
      const msg = e?.message ?? e?.details ?? e?.hint ?? JSON.stringify(e) ?? "Error al procesar el pago";
      console.error("[pago] excepción en createReservation:", e);
      toast.error(msg);
      setPaying(false);
      payingGuard.current = false;
    }
  };

  const currentStepIdx = STEP_INDEX[step] ?? 0;

  // Total actually charged, after any discount code, and the 30% deposit taken
  // online (floored at the Redsys minimum when a debug discount is active).
  const payableTotal = useMemo(
    () => (breakdown ? Math.round(breakdown.total * (1 - discountPct) * 100) / 100 : 0),
    [breakdown, discountPct],
  );
  const depositAmount = useMemo(() => {
    const d = Math.round(payableTotal * 0.3 * 100) / 100;
    return discountPct > 0 ? Math.max(REDSYS_MIN_EUR, d) : d;
  }, [payableTotal, discountPct]);

  const applyDiscount = () => {
    const code = discountInput.trim().toUpperCase();
    if (code === DEBUG_DISCOUNT_CODE) {
      setDiscountPct(DEBUG_DISCOUNT_PCT);
      toast.success("Código aplicado (debug −99,9%)");
    } else {
      setDiscountPct(0);
      toast.error("Código de descuento no válido");
    }
  };

  const extrasTotalSelected = useMemo(() => {
    return Object.entries(extraQty).reduce((s, [id, q]) => {
      const ex = extras?.find(e => e.id === id);
      return s + q * Number(ex?.price ?? 0);
    }, 0);
  }, [extraQty, extras]);

  const changeQty = (id: string, delta: number) =>
    setExtraQty(p => ({ ...p, [id]: Math.max(0, (p[id] ?? 0) + delta) }));

  const setDecoMessage = (id: string, field: keyof DecoMessage, value: string) =>
    setDecoMessages(p => {
      const cur = p[id] ?? { bed: "", screen: "" };
      return { ...p, [id]: { ...cur, [field]: value } };
    });

  // Decorations the customer has actually added that require phrases
  const selectedDecoNeedingMessage = useMemo(
    () => (extras ?? []).filter(e => decorationNeedsMessage(e) && (extraQty[e.id] ?? 0) > 0),
    [extras, extraQty],
  );

  // Returns an error message if any required phrase is missing or too long
  const validateDecoMessages = (): string | null => {
    for (const ex of selectedDecoNeedingMessage) {
      const m = decoMessages[ex.id] ?? { bed: "", screen: "" };
      if (!m.bed.trim() || !m.screen.trim())
        return `Escribe la frase de la cama y de la pantalla para «${ex.name}»`;
      if (countWords(m.bed) > BED_MESSAGE_MAX_WORDS)
        return `La frase en la cama de «${ex.name}» admite máximo ${BED_MESSAGE_MAX_WORDS} palabras`;
      if (countWords(m.screen) > SCREEN_MESSAGE_MAX_WORDS)
        return `La frase en la pantalla de «${ex.name}» admite máximo ${SCREEN_MESSAGE_MAX_WORDS} palabras`;
    }
    return null;
  };

  // Inputs shown under a decoration card once it has been added to the order
  const renderDecoMessageInputs = (ex: ExtraLite) => {
    if (!decorationNeedsMessage(ex) || (extraQty[ex.id] ?? 0) <= 0) return null;
    const m = decoMessages[ex.id] ?? { bed: "", screen: "" };
    const bedOver = countWords(m.bed) > BED_MESSAGE_MAX_WORDS;
    const screenOver = countWords(m.screen) > SCREEN_MESSAGE_MAX_WORDS;
    return (
      <div className="rm-deco-msg" onClick={e => e.stopPropagation()}>
        <div className="rm-deco-msg-field">
          <label className="rm-deco-msg-label">Frase en la cama (máx. {BED_MESSAGE_MAX_WORDS} palabras) *</label>
          <input
            className={`rm-deco-msg-input${bedOver ? " rm-invalid" : ""}`}
            value={m.bed}
            maxLength={40}
            placeholder="Ej. Te amo"
            onChange={e => setDecoMessage(ex.id, "bed", e.target.value)}
          />
          {bedOver && <span className="rm-deco-msg-hint rm-over">Máximo {BED_MESSAGE_MAX_WORDS} palabras</span>}
        </div>
        <div className="rm-deco-msg-field">
          <label className="rm-deco-msg-label">Frase en el cristal o pantalla LED (máx. {SCREEN_MESSAGE_MAX_WORDS} palabras) *</label>
          <input
            className={`rm-deco-msg-input${screenOver ? " rm-invalid" : ""}`}
            value={m.screen}
            maxLength={120}
            placeholder="Ej. Feliz aniversario mi amor"
            onChange={e => setDecoMessage(ex.id, "screen", e.target.value)}
          />
          {screenOver && <span className="rm-deco-msg-hint rm-over">Máximo {SCREEN_MESSAGE_MAX_WORDS} palabras</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="rm-page">
      <style>{CSS}</style>

      {/* Age banner */}
      <div className="rm-age-banner">
        <ShieldCheck size={14} />
        Reservas exclusivas para mayores de 18 años · Solo adultos
      </div>

      {/* Header */}
      <header className="rm-header">
        <div className="rm-header-inner">
          <div className="rm-logo">Rooms <span>Madrid</span></div>

          {step !== "search" && step !== "done" && (
            <button className="rm-back" onClick={handleBack}>← Atrás</button>
          )}

          <a
            href="https://www.demostays.example/"
            target="_blank"
            rel="noreferrer"
            style={{
              marginLeft: "auto",
              display: "flex", alignItems: "center", gap: 6,
              background: "var(--gold)", color: "var(--ink)",
              borderRadius: 7, padding: "6px 14px",
              fontSize: 12, fontWeight: 500, letterSpacing: "0.05em",
              textDecoration: "none", whiteSpace: "nowrap",
              transition: "background 0.2s",
            }}
          >
            <Globe size={13} />
            demostays.example
          </a>

          <div className="rm-help" style={{ marginLeft: 12 }}>
            <Phone size={13} />
            <span>¿Reservas?</span>
            <a href={CONTACTS[building]?.phones[0]?.href ?? "tel:+34900000001"}>
              {CONTACTS[building]?.phones[0]?.number ?? "900 000 001"}
            </a>
          </div>
        </div>
      </header>

      {/* Step indicator */}
      {step !== "done" && (
        <div className="rm-steps">
          <div className="rm-steps-inner">
            {STEPS.map((s, i) => (
              <div key={s.key} style={{ display: "contents" }}>
                <div className={`rm-step ${i === currentStepIdx ? "active" : i < currentStepIdx ? "done" : ""}`}>
                  <div className="rm-step-num">{i < currentStepIdx ? "✓" : i + 1}</div>
                  <span>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className="rm-step-sep" />}
              </div>
            ))}
          </div>
        </div>
      )}

      <main className="rm-main">

        {/* ── STEP 1: SEARCH ── */}
        {step === "search" && (
          <section>
            <div className="rm-hero">
              <div className="rm-hero-eyebrow">
                <Star size={12} />
                Madrid · Habitaciones temáticas
                <Star size={12} />
              </div>
              <h1 className="rm-serif">Tu escapada <em>perfecta</em><br />empieza aquí</h1>
              <p>Habitaciones únicas con jacuzzi en el centro de Madrid. Sin registro, con confirmación inmediata.</p>
            </div>

            <div className="rm-search-card">
              <div className="rm-search-grid">
                <div className="rm-field">
                  <label className="rm-label">Fecha</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                        {date || <span className="text-muted-foreground">Selecciona fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date ? new Date(`${date}T00:00:00`) : undefined}
                        onSelect={d => setDate(d ? format(d, "yyyy-MM-dd") : "")}
                        disabled={d => d < new Date(new Date().toDateString())}
                        contactPhones={CONTACTS[building]?.phones}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="rm-field">
                  <label className="rm-label" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <MapPin size={11} />Localización
                  </label>
                  <select
                    className="rm-building-select"
                    value={building}
                    onChange={e => setBuilding(e.target.value)}
                  >
                    {BUILDINGS.map(b => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                  {building !== "all" && (
                    <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <MapPin size={10} />
                      {BUILDINGS.find(b => b.value === building)?.address}
                    </div>
                  )}
                </div>

                <div className="rm-field">
                  <label className="rm-label">Hora de entrada</label>
                  <select
                    className="rm-building-select"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                  >
                    {isOvernight
                      ? Array.from({ length: 8 }, (_, i) => {
                          const totalMin = 22 * 60 + i * 15;
                          const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
                          const mm = String(totalMin % 60).padStart(2, "0");
                          const val = `${hh}:${mm}`;
                          return <option key={val} value={val}>{val}</option>;
                        })
                      : Array.from({ length: 96 }, (_, i) => {
                          const totalMin = i * 15;
                          const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
                          const mm = String(totalMin % 60).padStart(2, "0");
                          const val = `${hh}:${mm}`;
                          return <option key={val} value={val}>{val}</option>;
                        })
                    }
                  </select>
                </div>

                <div className="rm-overnight-row">
                  <div>
                    <div className="rm-overnight-row-label">
                      <Moon size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                      Noche completa
                    </div>
                    <div className="rm-overnight-row-sub">
                      {overnightAllowed ? "Disponible dom–mié · 22:00 – 10:00" : "Solo dom–mié · 22:00 – 10:00"}
                    </div>
                  </div>
                  <Switch
                    checked={isOvernight}
                    onCheckedChange={v => { setIsOvernight(v); if (v && time < "22:00") setTime("22:00"); }}
                    disabled={!overnightAllowed}
                  />
                </div>

                {!isOvernight && (
                  <div className="rm-field">
                    <label className="rm-label">Duración</label>
                    <select
                      className="rm-building-select"
                      value={String(duration)}
                      onChange={e => setDuration(Number(e.target.value))}
                    >
                      {DURATIONS.map(d => <option key={d} value={String(d)}>{DURATION_LABELS[d]}</option>)}
                    </select>
                  </div>
                )}

                <div className="rm-field">
                  <label className="rm-label">Personas</label>
                  <select
                    className="rm-building-select"
                    value={String(people)}
                    onChange={e => setPeople(Number(e.target.value))}
                  >
                    {[2, 3, 4].map(n => <option key={n} value={String(n)}>{n} personas</option>)}
                  </select>
                </div>

                <button
                  className="rm-btn-primary"
                  onClick={goSearch}
                  disabled={!date || !time}
                >
                  Ver habitaciones disponibles <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Available rooms list (shown after date selected) */}
            {date && availableRooms.length > 0 && (
              <div ref={roomsRef} style={{ marginTop: 40 }}>
                <div className="rm-section-header">
                  <h2 className="rm-serif">Habitaciones disponibles</h2>
                  <p>
                    {startAt?.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                    {" · "}{time}{" · "}
                    {isOvernight ? "Noche completa" : DURATION_LABELS[pricingDuration]}
                    {" · "}{people} {people === 1 ? "persona" : "personas"}
                  </p>
                </div>

                <div className="rm-rooms-list">
                  {availableRooms.map(r => {
                    const fromPrice = fromPriceByRoom.get(r.id);
                    const unavailable = conflicts?.has(r.id);
                    const isExpanded = expandedExtrasRoom === r.id;
                    const roomExtras = extras?.filter(e => e.category !== "services") ?? [];
                    const selectedInRoom = roomExtras.filter(e => (extraQty[e.id] ?? 0) > 0);

                    return (
                      <div key={r.id} className={`rm-room-card${unavailable ? " rm-unavailable" : ""}`} style={{ position: "relative" }}>
                        {unavailable && (
                          <div className="rm-unavailable-overlay">
                            <div className="rm-unavailable-pill" style={{ flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 20px", textAlign: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <span style={{ fontSize: 16 }}>🔒</span>
                                No disponible para este horario
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12, opacity: 0.85 }}>
                                {CONTACTS[building]?.phones.map((p, i) => (
                                  <a key={i} href={p.href} style={{ color: "var(--gold-light)", textDecoration: "none", fontWeight: 500 }}>
                                    {p.number}
                                  </a>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="rm-room-top">
                          <img src={getRoomImage(r)} alt={r.name} className="rm-room-img" loading="lazy" />
                          <div className="rm-room-info">
                            <div className="rm-room-building">RM {r.building}</div>
                            <div className="rm-room-name rm-serif">{r.name}</div>
                            <div className="rm-room-badges">
                              <span className="rm-badge"><Users size={11} />{r.capacity}+ personas</span>
                              {r.jacuzzi !== "none" && <span className="rm-badge"><Bath size={11} />Con jacuzzi</span>}
                              {r.jacuzzi === "none" && <span className="rm-badge"><Droplet size={11} />Sin jacuzzi</span>}
                              {r.has_tv && <span className="rm-badge"><Tv size={11} />TV</span>}
                              {r.has_swing && <span className="rm-badge"><Sparkles size={11} />Columpio</span>}
                            </div>
                            <div className="rm-room-desc">
                              Habitación temática para {r.capacity} personas.
                              {r.has_swing ? " Incluye columpio del amor." : ""}
                              {r.has_tv ? " Pantalla disponible." : ""}
                            </div>
                          </div>
                          <div className="rm-room-cta">
                            <div>
                              {fromPrice !== undefined ? (
                                <>
                                  <div className="rm-price-from">desde</div>
                                  <div className="rm-price-amount rm-serif">{eur(fromPrice)}</div>
                                </>
                              ) : (
                                <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>Consultar</div>
                              )}
                            </div>
                            <button
                              className="rm-btn-select"
                              onClick={() => !unavailable && selectRoom(r)}
                              disabled={!!unavailable}
                              style={unavailable ? { opacity: 0.35, cursor: "not-allowed" } : {}}
                            >
                              {unavailable ? "No disponible" : "Elegir esta"}
                            </button>
                          </div>
                        </div>

                        {/* Extras section inside card */}
                        {roomExtras.length > 0 && (
                          <div className="rm-room-extras">
                            <button
                              className="rm-extras-toggle"
                              onClick={() => setExpandedExtrasRoom(isExpanded ? null : r.id)}
                            >
                              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Gift size={14} />
                                Añadir extras
                                {selectedInRoom.length > 0 && (
                                  <span style={{ background: "var(--gold)", color: "var(--ink)", borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 600 }}>
                                    {selectedInRoom.length} seleccionado{selectedInRoom.length > 1 ? "s" : ""}
                                  </span>
                                )}
                              </span>
                              <span style={{ fontSize: 20, lineHeight: 1, color: "var(--ink-soft)" }}>{isExpanded ? "−" : "+"}</span>
                            </button>

                            {isExpanded && (
                              <>
                                {(["decoration", "hookah", "accessories", "drinks"] as const).map(cat => {
                                  const items = roomExtras.filter(e => e.category === cat);
                                  if (!items.length) return null;
                                  return (
                                    <div key={cat} style={{ marginBottom: 20 }}>
                                      <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gold)", fontWeight: 500, marginBottom: 10, marginTop: 16 }}>
                                        {EXTRA_CATEGORY_LABELS[cat] ?? cat}
                                      </div>
                                      <div className="rm-extras-grid">
                                        {items.map(ex => {
                                          const q = extraQty[ex.id] ?? 0;
                                          const img = getExtraImage(ex);
                                          return (
                                            <div key={ex.id} className={`rm-extra-item${q > 0 ? " selected" : ""}`}>
                                              {img && <img src={img} alt={ex.name} className="rm-extra-img" loading="lazy" />}
                                              <div className="rm-extra-body">
                                                <div className="rm-extra-name">{ex.name}</div>
                                                {ex.description && <div className="rm-extra-desc">{ex.description}</div>}
                                                <div className="rm-extra-footer">
                                                  <div className="rm-extra-price rm-serif">{eur(Number(ex.price))}</div>
                                                  <div className="rm-extra-qty">
                                                    <button className="rm-qty-btn" onClick={e => { e.stopPropagation(); changeQty(ex.id, -1); }}>−</button>
                                                    <span className="rm-qty-val">{q}</span>
                                                    <button className="rm-qty-btn" onClick={e => { e.stopPropagation(); changeQty(ex.id, 1); }}>+</button>
                                                  </div>
                                                </div>
                                                {renderDecoMessageInputs(ex)}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                                {extrasTotalSelected > 0 && (
                                  <div style={{ paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>Extras seleccionados</span>
                                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: "var(--gold-dark)", fontWeight: 500 }}>{eur(extrasTotalSelected)}</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!date && (
              <div className="rm-trust" style={{ marginTop: 40 }}>
                <div className="rm-trust-item">
                  <div className="rm-trust-icon"><Clock size={22} color="var(--gold)" /></div>
                  <div className="rm-trust-title">Sin registro</div>
                  <div className="rm-trust-sub">Reserva en 2 minutos.</div>
                </div>
                <div className="rm-trust-item">
                  <div className="rm-trust-icon"><CreditCard size={22} color="var(--gold)" /></div>
                  <div className="rm-trust-title">Solo 30% online</div>
                  <div className="rm-trust-sub">El resto al llegar.</div>
                </div>
                <div className="rm-trust-item">
                  <div className="rm-trust-icon"><Flame size={22} color="var(--gold)" /></div>
                  <div className="rm-trust-title">Confirmación al instante</div>
                  <div className="rm-trust-sub">Email en segundos.</div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── STEP 2: ROOM DETAIL + extras confirm ── */}
        {step === "room-detail" && room && (
          <div className="rm-layout">
            <div>
              {/* Room hero */}
              <div className="rm-card" style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
                <img src={getRoomImage(room)} alt={room.name} style={{ width: "100%", height: 260, objectFit: "cover", display: "block" }} />
                <div style={{ padding: "24px 28px" }}>
                  <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--gold)", fontWeight: 500, marginBottom: 6 }}>RM {room.building}</div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 500, color: "var(--ink)", marginBottom: 12 }}>{room.name}</div>
                  <div className="rm-room-badges">
                    <span className="rm-badge"><Users size={11} />{room.capacity}+ personas</span>
                    {room.jacuzzi !== "none" && <span className="rm-badge"><Bath size={11} />Con jacuzzi</span>}
                    {room.has_tv && <span className="rm-badge"><Tv size={11} />TV</span>}
                    {room.has_swing && <span className="rm-badge"><Sparkles size={11} />Columpio</span>}
                  </div>

                </div>
              </div>

              {/* Extras confirmation */}
              {extras && extras.length > 0 && (
                <div className="rm-card">
                  <h2 className="rm-serif" style={{ marginBottom: 6 }}>Extras para tu estancia</h2>
                  <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 24 }}>Opcional — puedes continuar sin añadir nada.</p>

                  {(["decoration", "hookah", "accessories", "drinks"] as const).map(cat => {
                    const items = extras.filter(e => e.category === cat);
                    if (!items.length) return null;
                    return (
                      <div key={cat} style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gold)", fontWeight: 500, marginBottom: 12 }}>
                          {EXTRA_CATEGORY_LABELS[cat]}
                        </div>
                        <div className="rm-extras-grid">
                          {items.map(ex => {
                            const q = extraQty[ex.id] ?? 0;
                            const img = getExtraImage(ex);
                            const isGift = breakdown?.giftedExtraIds.includes(ex.id);
                            return (
                              <div key={ex.id} className={`rm-extra-item${q > 0 ? " selected" : ""}`}>
                                {img && <img src={img} alt={ex.name} className="rm-extra-img" loading="lazy" />}
                                <div className="rm-extra-body">
                                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4, marginBottom: 2 }}>
                                    <div className="rm-extra-name">{ex.name}</div>
                                    {isGift && q === 0 && (
                                      <span style={{ background: "var(--cream-dark)", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 500, color: "var(--gold-dark)", whiteSpace: "nowrap" }}>
                                        <Gift size={9} style={{ display: "inline", marginRight: 3 }} />Regalo
                                      </span>
                                    )}
                                  </div>
                                  {ex.description && <div className="rm-extra-desc">{ex.description}</div>}
                                  <div className="rm-extra-footer">
                                    <div className="rm-extra-price rm-serif">{eur(Number(ex.price))}</div>
                                    <div className="rm-extra-qty">
                                      <button className="rm-qty-btn" onClick={() => changeQty(ex.id, -1)}>−</button>
                                      <span className="rm-qty-val">{q}</span>
                                      <button className="rm-qty-btn" onClick={() => changeQty(ex.id, 1)}>+</button>
                                    </div>
                                  </div>
                                  {renderDecoMessageInputs(ex)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                className="rm-btn-continue"
                onClick={() => {
                  const err = validateDecoMessages();
                  if (err) return toast.error(err);
                  setStep("details");
                }}
              >
                Continuar con mis datos <ChevronRight size={16} />
              </button>
            </div>
            <SummaryBar room={room} startAt={startAt} endAt={endAt} people={people} isOvernight={isOvernight} duration={pricingDuration} breakdown={breakdown} />
          </div>
        )}

        {/* ── STEP 3: DETAILS ── */}
        {step === "details" && room && (
          <div className="rm-layout">
            <div className="rm-card">
              <h2 className="rm-serif">Tus datos</h2>
              <div className="rm-form-grid">
                <div className="rm-field">
                  <label className="rm-label">Nombre completo *</label>
                  <Input value={customerName} onChange={e => setCustomerName(e.target.value)} maxLength={100} />
                </div>
                <div className="rm-field">
                  <label className="rm-label">Email *</label>
                  <Input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} maxLength={255} />
                </div>
                <div className="rm-field rm-form-full">
                  <label className="rm-label">Teléfono (opcional)</label>
                  <Input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} maxLength={30} />
                </div>
              </div>

              <Separator style={{ margin: "24px 0" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label className="rm-check-row">
                  <Checkbox checked={adult} onCheckedChange={v => setAdult(v === true)} />
                  <span>Confirmo que soy <strong>mayor de 18 años</strong> y acepto las condiciones de reserva. *</span>
                </label>
                <label className="rm-check-row">
                  <Checkbox checked={noContact} onCheckedChange={v => setNoContact(v === true)} />
                  <span>No quiero recibir comunicaciones comerciales.</span>
                </label>
              </div>

              <button className="rm-btn-continue" onClick={submitDetails}>
                Continuar al pago <ChevronRight size={16} />
              </button>
            </div>
            <SummaryBar room={room} startAt={startAt} endAt={endAt} people={people} isOvernight={isOvernight} duration={pricingDuration} breakdown={breakdown} />
          </div>
        )}

        {/* ── STEP 4: PAYMENT ── */}
        {step === "payment" && room && breakdown && (
          <div className="rm-layout">
            <div className="rm-card">
              <h2 className="rm-serif">Pago del depósito</h2>
              <p style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 24, lineHeight: 1.65 }}>
                Para confirmar tu reserva solo necesitas pagar el <strong>30%</strong> ahora. El resto lo pagas en el hotel al llegar.
              </p>

              <div className="rm-payment-box">
                <div className="rm-payment-row">
                  <span>Total reserva</span>
                  <span className="rm-payment-row-val">{eur(payableTotal)}</span>
                </div>
                {discountPct > 0 && (
                  <div className="rm-payment-row">
                    <span>Descuento aplicado</span>
                    <span className="rm-payment-row-val" style={{ color: "var(--gold-dark)" }}>
                      −{(discountPct * 100).toLocaleString("es-ES")}% (antes {eur(breakdown.total)})
                    </span>
                  </div>
                )}
                <div className="rm-payment-row">
                  <span>A pagar en el hotel</span>
                  <span className="rm-payment-row-val">{eur(Math.max(0, payableTotal - depositAmount))}</span>
                </div>
                <div className="rm-payment-highlight">
                  <span style={{ fontSize: 14 }}>Depósito ahora (30%)</span>
                  <span className="rm-payment-amount rm-serif">{eur(depositAmount)}</span>
                </div>
              </div>

              {/* Discount code */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "flex-end" }}>
                <div className="rm-field" style={{ flex: 1 }}>
                  <label className="rm-label">Código de descuento</label>
                  <Input
                    value={discountInput}
                    onChange={e => setDiscountInput(e.target.value)}
                    placeholder="Introduce tu código"
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); applyDiscount(); } }}
                  />
                </div>
                <Button type="button" variant="outline" onClick={applyDiscount}>Aplicar</Button>
              </div>

              <button className="rm-btn-primary" style={{ display: "flex" }} onClick={createReservation} disabled={paying}>
                {paying ? "Redirigiendo al TPV…" : `Pagar ${eur(depositAmount)} con tarjeta`}
              </button>

              <p style={{ fontSize: 11, color: "var(--ink-soft)", textAlign: "center", marginTop: 10 }}>
                Pago seguro procesado por Redsys · Redirección al TPV de tu banco
              </p>
            </div>
            <SummaryBar room={room} startAt={startAt} endAt={endAt} people={people} isOvernight={isOvernight} duration={pricingDuration} breakdown={breakdown} />
          </div>
        )}

        {/* ── STEP 5: DONE ── */}
        {step === "done" && (
          <div className="rm-done">
            <div className="rm-done-icon"><CheckCircle2 size={32} /></div>
            <h2 className="rm-serif">¡Reserva<br />confirmada!</h2>
            <p>
              Te hemos enviado un email de confirmación a <strong>{customerEmail}</strong> con todos los detalles.
              Si no lo encuentras, revisa la carpeta de spam.
            </p>
            <p className="rm-done-ref">Referencia: {reservationId?.slice(0, 8)?.toUpperCase()}</p>
            <div style={{ marginTop: 32 }}>
              <button
                className="rm-btn-primary"
                style={{ maxWidth: 280, margin: "0 auto" }}
                onClick={() => {
                  setStep("search"); setRoom(null); setExtraQty({}); setDecoMessages({});
                  setDiscountInput(""); setDiscountPct(0);
                  setReservationId(null); setAdult(false);
                  setCustomerName(""); setCustomerEmail(""); setCustomerPhone("");
                }}
              >
                Hacer otra reserva
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="rm-footer">
        <div>© Demo Stays · Solo +18 · Bebe con responsabilidad</div>
        <div>Pago: <strong>30% online</strong>, resto en el hotel · Confirmación inmediata por email</div>
        <div style={{ marginTop: 8, display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
          {CONTACTS[building]?.phones.map((p, i) => (
            <a key={i} href={p.href} style={{ color: "var(--gold-light)", textDecoration: "none" }}>{p.number}</a>
          ))}
          <a href={`mailto:${CONTACTS[building]?.email}`} style={{ color: "var(--gold-light)", textDecoration: "none" }}>
            {CONTACTS[building]?.email}
          </a>
        </div>
        <div style={{ marginTop: 4, color: "rgba(255,255,255,0.3)" }}>{CONTACTS[building]?.address}</div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────
// Summary sidebar
// ─────────────────────────────────────────────
function SummaryBar({
  room, startAt, endAt, people, isOvernight, duration, breakdown,
}: {
  room: RoomLite;
  startAt: Date | null;
  endAt: Date | null;
  people: number;
  isOvernight: boolean;
  duration: number;
  breakdown: PriceBreakdown | null;
}) {
  return (
    <div className="rm-summary">
      <img src={getRoomImage(room)} alt="" className="rm-summary-room-img" />
      <div className="rm-summary-label">Tu habitación</div>
      <div className="rm-summary-name rm-serif">{room.name} · RM {room.building}</div>

      <hr className="rm-summary-divider" />

      <div className="rm-summary-row">
        <span>Entrada</span>
        <span className="rm-summary-row-val">
          {startAt?.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <div className="rm-summary-row">
        <span>Salida</span>
        <span className="rm-summary-row-val">
          {endAt?.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <div className="rm-summary-row">
        <span>Duración</span>
        <span className="rm-summary-row-val">{isOvernight ? "Noche completa" : DURATION_LABELS[duration]}</span>
      </div>
      <div className="rm-summary-row">
        <span>Personas</span>
        <span className="rm-summary-row-val">{people}</span>
      </div>

      {breakdown && (
        <>
          <hr className="rm-summary-divider" />
          <div className="rm-summary-row">
            <span>Habitación</span>
            <span className="rm-summary-row-val">{eur(breakdown.base)}</span>
          </div>
          {breakdown.thirdPerson > 0 && (
            <div className="rm-summary-row">
              <span>Supl. personas</span>
              <span className="rm-summary-row-val">{eur(breakdown.thirdPerson)}</span>
            </div>
          )}
          {breakdown.dynamicSurcharge > 0 && (
            <div className="rm-summary-row">
              <span>Recargo</span>
              <span className="rm-summary-row-val" style={{ color: "#fcd34d" }}>{eur(breakdown.dynamicSurcharge)}</span>
            </div>
          )}
          {breakdown.extrasTotal > 0 && (
            <div className="rm-summary-row">
              <span>Extras</span>
              <span className="rm-summary-row-val">{eur(breakdown.extrasTotal)}</span>
            </div>
          )}
          <hr className="rm-summary-divider" />
          <div className="rm-summary-total">
            <span>Total</span>
            <span className="rm-summary-total-val rm-serif">{eur(breakdown.total)}</span>
          </div>
          <div className="rm-summary-deposit">
            Depósito 30% online: <strong style={{ color: "var(--gold-light)" }}>{eur(breakdown.total * 0.3)}</strong>
          </div>
        </>
      )}
    </div>
  );
}
