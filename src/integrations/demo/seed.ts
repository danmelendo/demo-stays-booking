// ─────────────────────────────────────────────────────────────────────────────
// Demo seed data — in-memory dataset that replaces the Supabase backend so the
// app can be run and explored WITHOUT any server, credentials or migrations.
//
// The data mirrors the real Postgres schema (see src/integrations/supabase/types.ts)
// but uses plain string ids and anonymised, example values. It is loaded into
// memory and persisted to localStorage so changes (new bookings, edited rates,
// status changes…) survive a page reload. Use resetDemoDb() to wipe it.
// ─────────────────────────────────────────────────────────────────────────────

export type Row = Record<string, any>;
export type DemoDb = Record<string, Row[]>;

const STORAGE_KEY = "demo-stays-db";
const STORAGE_VERSION = 15; // bump to force a reseed when the shape changes

// The catalogue is a coliving network: each property is an "urbanización"
// (community) whose bookable assets are whole apartments (pisos), private rooms
// (habitaciones) or shared rooms (habitaciones compartidas). Asset type is
// derived from the room's capacity/jacuzzi so the seed stays compact.
function deriveAssetType(
  jacuzzi: "always" | "none",
  capacity: number,
): "apartment" | "room" | "shared_room" {
  if (capacity >= 4) return "apartment";
  if (jacuzzi === "none") return "shared_room";
  return "room";
}

// Coliving asset features surfaced as badges in the app/web (replacing the old
// "jacuzzi" tag inherited from the by-the-hour hotel product). Deterministic per
// asset so they're stable across reseeds; every asset includes cleaning.
function deriveFeatures(slug: string, assetType: "apartment" | "room" | "shared_room"): string[] {
  const h = [...slug].reduce((a, c) => a + c.charCodeAt(0), 0);
  const pool = [
    "pets_allowed",
    "terrace",
    "bright",
    "balcony",
    "furnished",
    "elevator",
    "ac",
    "wifi",
  ];
  const f = new Set<string>([
    "cleaning_included",
    pool[h % pool.length],
    pool[(h + 3) % pool.length],
  ]);
  if (assetType === "apartment") f.add("terrace");
  if (assetType === "shared_room") f.add("furnished");
  return [...f];
}

export const DEMO_USER_ID = "demo-user-admin";

// Guest identity used by the white-label mobile app ("Stays"). Separate from the
// staff DEMO_USER_ID above: the mobile product authenticates loyalty members, not
// reception/admin users.
export const DEMO_MEMBER_ID = "member-demo-alex";

// ── Rate groups ──────────────────────────────────────────────────────────────
const RATE_GROUPS = [
  { id: "rg-grey", name: "Tarifa Signature" },
  { id: "rg-ruta66", name: "Tarifa Superior" },
  { id: "rg-music", name: "Tarifa Clásica" },
  { id: "rg-dubai", name: "Tarifa Clásica Plus" },
  { id: "rg-hollywood", name: "Tarifa Esencial" },
  { id: "rg-maldivas", name: "Tarifa Sin Jacuzzi" },
  { id: "rg-tokyo", name: "Tarifa Sin Jacuzzi Lite" },
];

// ── Hourly rates [duration_min, with_jacuzzi, without_jacuzzi] ────────────────
const HOURLY: Record<string, [number, number | null, number | null][]> = {
  "rg-grey": [
    [60, 53, 48],
    [90, 68, 58],
    [120, 78, 68],
    [150, 92, 72],
    [180, 102, 88],
    [210, 108, 93],
    [240, 113, 98],
    [270, 118, 102],
    [300, 132, 108],
    [330, 138, 112],
    [360, 148, 128],
  ],
  "rg-ruta66": [
    [60, 48, 43],
    [90, 58, 52],
    [120, 68, 58],
    [150, 72, 62],
    [180, 92, 78],
    [210, 98, 83],
    [240, 102, 88],
    [270, 108, 92],
    [300, 122, 98],
    [330, 128, 102],
    [360, 138, 118],
  ],
  "rg-music": [
    [60, 43, 38],
    [90, 52, 48],
    [120, 62, 52],
    [150, 68, 58],
    [180, 88, 72],
    [210, 92, 78],
    [240, 98, 82],
    [270, 102, 88],
    [300, 118, 92],
    [330, 122, 98],
    [360, 132, 122],
  ],
  "rg-dubai": [
    [60, 45, 40],
    [90, 55, 50],
    [120, 65, 55],
    [150, 70, 60],
    [180, 90, 75],
    [210, 95, 80],
    [240, 100, 85],
    [270, 105, 90],
    [300, 120, 95],
    [330, 125, 100],
    [360, 135, 125],
  ],
  "rg-hollywood": [
    [60, 43, 35],
    [90, 52, 40],
    [120, 62, 45],
    [150, 68, 50],
    [180, 88, 55],
    [210, 92, 60],
    [240, 98, 65],
    [270, 102, 70],
    [300, 118, 75],
    [330, 122, 80],
    [360, 132, 85],
  ],
  "rg-maldivas": [
    [60, null, 38],
    [90, null, 43],
    [120, null, 48],
    [150, null, 53],
    [180, null, 58],
    [210, null, 63],
    [240, null, 68],
    [270, null, 73],
    [300, null, 78],
    [330, null, 83],
    [360, null, 88],
  ],
  "rg-tokyo": [
    [60, null, 35],
    [90, null, 40],
    [120, null, 45],
    [150, null, 50],
    [180, null, 55],
    [210, null, 60],
    [240, null, 65],
    [270, null, 70],
    [300, null, 75],
    [330, null, 80],
    [360, null, 85],
  ],
};

// ── Overnight rates (only groups that offer noche completa) ───────────────────
const OVERNIGHT: Record<string, [string, number][]> = {
  "rg-grey": [
    ["10:00:00", 120],
    ["11:00:00", 130],
    ["12:00:00", 140],
  ],
  "rg-ruta66": [
    ["10:00:00", 120],
    ["11:00:00", 130],
    ["12:00:00", 140],
  ],
  "rg-music": [
    ["10:00:00", 110],
    ["11:00:00", 120],
    ["12:00:00", 130],
  ],
  "rg-dubai": [
    ["10:00:00", 110],
    ["11:00:00", 120],
    ["12:00:00", 130],
  ],
};

// ── Nightly rates (traditional-hotel mode) [price, weekend_price Fri/Sat] ──────
// Used by the public portal's "Hotel tradicional" booking mode: full nights
// with check-in 15:00 / check-out 12:00, priced per night.
const NIGHTLY: Record<string, [number, number]> = {
  "rg-grey": [135, 165],
  "rg-ruta66": [120, 145],
  "rg-music": [105, 128],
  "rg-dubai": [110, 132],
  "rg-hollywood": [95, 115],
  "rg-maldivas": [85, 102],
  "rg-tokyo": [75, 90],
};

// ── Third person surcharge (global, per extra person and time slot) ───────────
const THIRD: [number, number][] = [
  [60, 15],
  [90, 25],
  [120, 30],
  [150, 40],
  [180, 45],
  [210, 55],
  [240, 60],
  [270, 70],
  [300, 75],
  [330, 85],
  [360, 90],
];

// ── Rooms ─────────────────────────────────────────────────────────────────────
// [building, name, rate_group_id, jacuzzi, capacity]
const ROOM_DEFS: [string, string, string, "always" | "none", number][] = [
  ["Central", "Aurora", "rg-grey", "always", 2],
  ["Central", "Coral", "rg-music", "always", 2],
  ["Central", "Jade", "rg-music", "always", 2],
  ["Central", "Ambar", "rg-music", "always", 2],
  ["Central", "Zen", "rg-tokyo", "none", 2],
  ["Norte", "Skyline", "rg-music", "always", 2],
  ["Norte", "Pizarra", "rg-grey", "always", 2],
  ["Norte", "Estelar", "rg-hollywood", "always", 4],
  ["Norte", "Ritmo", "rg-music", "always", 2],
  ["Norte", "Nomada", "rg-ruta66", "always", 2],
  ["Sur", "Oasis", "rg-dubai", "always", 2],
  ["Sur", "Onyx", "rg-grey", "always", 2],
  ["Sur", "Laguna", "rg-maldivas", "none", 2],
  ["Sur", "Metropolis", "rg-dubai", "always", 4],
  ["Sur", "Eden", "rg-dubai", "always", 2],
];

// ── Extras ─────────────────────────────────────────────────────────────────────
const EXTRAS = [
  {
    id: "ex-deco-especial",
    category: "decoration",
    name: "Decoración Especial",
    price: 20,
    description: "Pétalos, velas LED y globos de bienvenida.",
    sort_order: 1,
  },
  {
    id: "ex-deco-plus",
    category: "decoration",
    name: "Decoración Plus",
    price: 30,
    description: "Incluye frase personalizada en la cama y en la pantalla.",
    sort_order: 2,
  },
  {
    id: "ex-deco-premium",
    category: "decoration",
    name: "Decoración Premium",
    price: 50,
    description: "Montaje premium con frases personalizadas.",
    sort_order: 3,
  },
  {
    id: "ex-deco-deluxe",
    category: "decoration",
    name: "Decoración Premium Deluxe",
    price: 145,
    description: "Montaje de lujo con frases personalizadas y detalles especiales.",
    sort_order: 4,
  },
  {
    id: "ex-cava",
    category: "drinks",
    name: "Cava Juvé & Camps",
    price: 25,
    description: null,
    sort_order: 5,
  },
  {
    id: "ex-moet",
    category: "drinks",
    name: "Botella Moët & Chandon",
    price: 60,
    description: null,
    sort_order: 6,
  },
  {
    id: "ex-vino",
    category: "drinks",
    name: "Botella de vino",
    price: 18,
    description: null,
    sort_order: 7,
  },
  {
    id: "ex-cachimba",
    category: "hookah",
    name: "Cachimba",
    price: 20,
    description: null,
    sort_order: 8,
  },
  {
    id: "ex-petalos",
    category: "accessories",
    name: "Pétalos de rosa extra",
    price: 10,
    description: null,
    sort_order: 9,
  },
  {
    id: "ex-globos",
    category: "accessories",
    name: "Pack de globos",
    price: 15,
    description: null,
    sort_order: 10,
  },
  {
    id: "ex-servicio",
    category: "services",
    name: "Servicio personalizado",
    price: 0,
    description: "Precio fijado por recepción.",
    sort_order: 11,
  },
];

// ── Customers ──────────────────────────────────────────────────────────────────
const CUSTOMERS = [
  {
    id: "cust-1",
    name: "Laura Gómez",
    phone: "+34 600 111 222",
    email: "laura@example.com",
    no_contact: false,
    notes: null,
  },
  {
    id: "cust-2",
    name: "Carlos Ruiz",
    phone: "+34 600 333 444",
    email: "carlos@example.com",
    no_contact: false,
    notes: null,
  },
  {
    id: "cust-3",
    name: "María López",
    phone: "+34 600 555 666",
    email: "maria@example.com",
    no_contact: false,
    notes: "Cliente habitual.",
  },
  {
    id: "cust-4",
    name: "Pareja Aniversario",
    phone: null,
    email: "pareja@example.com",
    no_contact: true,
    notes: "Prefiere no recibir contacto.",
  },
  {
    id: "cust-5",
    name: "David Sanz",
    phone: "+34 600 777 888",
    email: "david@example.com",
    no_contact: false,
    notes: null,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Multi-property catalogue for the mobile app's "Discovery across provinces".
// The PMS is modelled as a chain: provinces → properties → rooms. The three
// original buildings (Central/Norte/Sur) become Madrid properties; the rest are
// new properties in other Spanish provinces. The mobile app reaches all of this
// only through the PMS connector (src/integrations/pms/), never these rows.
// ─────────────────────────────────────────────────────────────────────────────

// [id, name, hero accent (hsl), tagline]
// Earthy olive/green accents (paired with the cream + black theme) — muted and
// dark so the gradient heroes read formal, with enough hue variation per province.
const PROVINCES: [string, string, string, string][] = [
  ["madrid", "Madrid", "82 28% 32%", "La capital, sin descanso"],
  ["barcelona", "Barcelona", "150 22% 28%", "Mediterráneo y modernismo"],
  ["valencia", "Valencia", "68 30% 34%", "Sol, huerta y Turia"],
  ["sevilla", "Sevilla", "100 20% 30%", "Sur, azahar y arte"],
  ["malaga", "Málaga", "160 22% 30%", "Costa del Sol"],
  ["vizcaya", "Vizcaya", "120 18% 26%", "Bilbao y el Cantábrico"],
];

// [id, name, province_id, city, address, rating, amenities[], description, brand]
// `brand` tags each asset to one of the two demo brands sharing this backend:
// "living" (flex-living, professionals/nomads) or "campus" (student residences).
// Discovery filters by the active brand; everything else (engine, payments,
// management) is identical.
type PropBrand = "living" | "campus";
const PROPERTY_DEFS: [
  string,
  string,
  string,
  string,
  string,
  number,
  string[],
  string,
  PropBrand,
][] = [
  [
    "prop-madrid-central",
    "Living · Gran Vía",
    "madrid",
    "Madrid",
    "Gran Vía, 1",
    4.8,
    ["wifi", "parking", "spa", "bar"],
    "Pisos y habitaciones flex living en el corazón de Madrid, a un paso de Gran Vía.",
    "living",
  ],
  [
    "prop-madrid-norte",
    "Living · Chamartín",
    "madrid",
    "Madrid",
    "Pº de la Castellana, 200",
    4.6,
    ["wifi", "gym", "parking"],
    "Flex living con servicios y buenas conexiones en la zona norte.",
    "living",
  ],
  [
    "prop-madrid-sur",
    "Living · Atocha",
    "madrid",
    "Madrid",
    "Ronda de Atocha, 15",
    4.5,
    ["wifi", "bar", "petfriendly"],
    "Junto a Atocha y el barrio de las Letras.",
    "living",
  ],
  [
    "prop-bcn-gotic",
    "Living · Gótico",
    "barcelona",
    "Barcelona",
    "Carrer de Ferran, 22",
    4.7,
    ["wifi", "rooftop", "bar"],
    "En pleno Barrio Gótico, entre Las Ramblas y el mar.",
    "living",
  ],
  [
    "prop-valencia-marina",
    "Living · Marina",
    "valencia",
    "Valencia",
    "Av. del Puerto, 80",
    4.6,
    ["wifi", "pool", "parking", "petfriendly"],
    "Frente a la Marina y la playa de la Malvarrosa.",
    "living",
  ],
  [
    "prop-sevilla-triana",
    "Residencia Triana",
    "sevilla",
    "Sevilla",
    "Calle Betis, 5",
    4.7,
    ["wifi", "study", "events"],
    "Residencia de estudiantes a orillas del Guadalquivir, en el alma de Triana.",
    "campus",
  ],
  [
    "prop-malaga-centro",
    "Residencia Soho",
    "malaga",
    "Málaga",
    "Calle Tomás Heredia, 9",
    4.5,
    ["wifi", "study", "gym"],
    "Residencia universitaria en el barrio del arte de Málaga, junto al puerto.",
    "campus",
  ],
  [
    "prop-bilbao-abando",
    "Residencia Abando",
    "vizcaya",
    "Bilbao",
    "Gran Vía Don Diego, 40",
    4.6,
    ["wifi", "study", "events"],
    "Residencia de estudiantes entre el Guggenheim y el Casco Viejo bilbaíno.",
    "campus",
  ],
];

// Original rooms (ROOM_DEFS) are Madrid; map their building to a Madrid property.
const BUILDING_TO_PROPERTY: Record<string, string> = {
  Central: "prop-madrid-central",
  Norte: "prop-madrid-norte",
  Sur: "prop-madrid-sur",
};

// Rooms for the new (non-Madrid) properties. [property_id, name, rate_group_id,
// jacuzzi, capacity, image_slug]. Images reuse the existing room SVG placeholders.
const EXTRA_PROPERTY_ROOMS: [string, string, string, "always" | "none", number, string][] = [
  ["prop-bcn-gotic", "Rambla", "rg-grey", "always", 2, "central-aurora"],
  ["prop-bcn-gotic", "Born", "rg-music", "always", 2, "central-coral"],
  ["prop-bcn-gotic", "Tibidabo", "rg-ruta66", "always", 3, "norte-skyline"],
  ["prop-bcn-gotic", "Barceloneta", "rg-tokyo", "none", 2, "central-zen"],
  ["prop-valencia-marina", "Albufera", "rg-dubai", "always", 2, "sur-laguna"],
  ["prop-valencia-marina", "Malvarrosa", "rg-music", "always", 2, "sur-oasis"],
  ["prop-valencia-marina", "Turia", "rg-hollywood", "always", 4, "sur-metropolis"],
  ["prop-sevilla-triana", "Giralda", "rg-grey", "always", 2, "sur-onyx"],
  ["prop-sevilla-triana", "Betis", "rg-music", "always", 2, "norte-ritmo"],
  ["prop-sevilla-triana", "Alcázar", "rg-maldivas", "none", 2, "central-jade"],
  ["prop-malaga-centro", "Picasso", "rg-grey", "always", 2, "central-ambar"],
  ["prop-malaga-centro", "Gibralfaro", "rg-dubai", "always", 2, "sur-eden"],
  ["prop-malaga-centro", "Pedregalejo", "rg-tokyo", "none", 3, "norte-nomada"],
  ["prop-bilbao-abando", "Guggenheim", "rg-ruta66", "always", 2, "norte-pizarra"],
  ["prop-bilbao-abando", "Arriaga", "rg-music", "always", 2, "norte-estelar"],
];

// ── Loyalty club ──────────────────────────────────────────────────────────────
// [id, name, min_points, multiplier (pts per €), perks[]]
const LOYALTY_TIERS: [string, string, number, number, string[]][] = [
  ["tier-bronce", "Bronce", 0, 1, ["1 punto por €", "Check-in exprés"]],
  ["tier-plata", "Plata", 500, 1.25, ["1,25 puntos por €", "Late checkout 13:00", "Wifi premium"]],
  [
    "tier-oro",
    "Oro",
    1500,
    1.5,
    ["1,5 puntos por €", "Upgrade según disponibilidad", "Desayuno incluido"],
  ],
  [
    "tier-platino",
    "Platino",
    4000,
    2,
    ["2 puntos por €", "Upgrade garantizado", "Atención VIP 24/7"],
  ],
];

// [id, name, cost_points, category, description]
const REWARDS: [string, string, number, string, string][] = [
  [
    "rw-latecheckout",
    "Late checkout 14:00",
    300,
    "estancia",
    "Sal con calma: salida ampliada hasta las 14:00.",
  ],
  ["rw-welcome", "Botella de bienvenida", 450, "extra", "Cava frío esperándote en la habitación."],
  [
    "rw-upgrade",
    "Upgrade de habitación",
    900,
    "estancia",
    "Sube de categoría según disponibilidad al llegar.",
  ],
  [
    "rw-night",
    "Noche de regalo",
    2500,
    "estancia",
    "Una noche gratis en cualquier propiedad Demo Stays.",
  ],
];

// ── Common spaces (zonas comunes) ───────────────────────────────────────────
// Tenant-bookable shared amenities, per property. Both brands have content so
// the Zonas comunes screen is populated whichever brand is active.
// [id, property_id, name, kind, capacity, description, open_hour, close_hour, €/h]
const COMMON_SPACES: [string, string, string, string, number, string, number, number, number][] = [
  [
    "cs-central-cowork",
    "prop-madrid-central",
    "Sala coworking",
    "coworking",
    12,
    "Mesas amplias, monitores y cabinas de llamada.",
    8,
    22,
    0,
  ],
  [
    "cs-central-rooftop",
    "prop-madrid-central",
    "Azotea & BBQ",
    "rooftop",
    20,
    "Terraza con barbacoa y vistas a Gran Vía.",
    11,
    23,
    8,
  ],
  [
    "cs-norte-gym",
    "prop-madrid-norte",
    "Gimnasio",
    "gym",
    8,
    "Cardio, peso libre y zona funcional.",
    7,
    23,
    0,
  ],
  [
    "cs-bcn-lounge",
    "prop-bcn-gotic",
    "Sala común",
    "lounge",
    16,
    "Sofás, cocina compartida y mesa de juegos.",
    8,
    24,
    0,
  ],
  [
    "cs-sevilla-study",
    "prop-sevilla-triana",
    "Sala de estudio",
    "study",
    24,
    "Zona silenciosa con enchufes en cada plaza y wifi.",
    8,
    24,
    0,
  ],
  [
    "cs-sevilla-events",
    "prop-sevilla-triana",
    "Sala polivalente",
    "events",
    40,
    "Para talleres, charlas y fiestas de residentes.",
    10,
    22,
    5,
  ],
  [
    "cs-sevilla-laundry",
    "prop-sevilla-triana",
    "Lavandería",
    "laundry",
    4,
    "Lavadoras y secadoras por turnos.",
    7,
    23,
    2,
  ],
];

// ── Tenant management data (invoices, incidents, space bookings) ─────────────
// Populates the resident's management hub on first open. Independent of the room
// catalogue; property names are referenced as plain labels (a real PMS would key
// these to property ids).
function buildTenantData(now: Date) {
  const day = (off: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + off);
    return d.toISOString().slice(0, 10);
  };

  const invoice = (
    id: string,
    number: string,
    concept: string,
    propertyName: string,
    issuedOff: number,
    dueOff: number,
    amount: number,
    status: string,
    vat = 0.21,
  ): Row => {
    const net = Math.round((amount / (1 + vat)) * 100) / 100;
    return {
      id,
      member_id: DEMO_MEMBER_ID,
      number,
      concept,
      property_name: propertyName,
      issued_at: day(issuedOff),
      due_at: day(dueOff),
      net,
      tax: Math.round((amount - net) * 100) / 100,
      amount,
      status,
    };
  };

  const invoices: Row[] = [
    invoice(
      "inv-jul",
      "FAC-2026-0051",
      "Renta mensual · julio",
      "Living · Gótico",
      -2,
      13,
      720,
      "pending",
    ),
    invoice(
      "inv-jun",
      "FAC-2026-0042",
      "Renta mensual · junio",
      "Living · Gótico",
      -32,
      -17,
      720,
      "paid",
    ),
    invoice(
      "inv-sumin",
      "FAC-2026-0039",
      "Suministros · mayo",
      "Living · Gótico",
      -40,
      -25,
      64.5,
      "paid",
    ),
    invoice(
      "inv-may",
      "FAC-2026-0031",
      "Renta mensual · mayo",
      "Living · Gótico",
      -63,
      -48,
      720,
      "paid",
    ),
    invoice(
      "inv-cowork",
      "FAC-2026-0055",
      "Reserva azotea & BBQ",
      "Living · Gran Vía",
      -6,
      -6,
      16,
      "overdue",
    ),
  ];

  const ts = (off: number, hour = 10) => {
    const d = new Date(now);
    d.setDate(d.getDate() + off);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  const incidents: Row[] = [
    {
      id: "inc-internet",
      member_id: DEMO_MEMBER_ID,
      property_name: "Living · Gótico",
      category: "internet",
      title: "Wifi intermitente en el dormitorio",
      description: "La conexión se cae varias veces al día en la habitación.",
      status: "in_progress",
      created_at: ts(-3, 9),
      updates: [
        {
          at: ts(-1, 12),
          status: "in_progress",
          note: "Técnico asignado. Visita prevista en 48 h.",
        },
        {
          at: ts(-3, 9),
          status: "open",
          note: "Incidencia registrada. El equipo de gestión la revisará.",
        },
      ],
    },
    {
      id: "inc-heating",
      member_id: DEMO_MEMBER_ID,
      property_name: "Living · Gótico",
      category: "heating",
      title: "El radiador del salón no calienta",
      description: "No da calor desde el fin de semana.",
      status: "resolved",
      created_at: ts(-20, 18),
      updates: [
        {
          at: ts(-17, 11),
          status: "resolved",
          note: "Purgado y reparado. Confirmado por el inquilino.",
        },
        { at: ts(-19, 10), status: "in_progress", note: "Mantenimiento en camino." },
        {
          at: ts(-20, 18),
          status: "open",
          note: "Incidencia registrada. El equipo de gestión la revisará.",
        },
      ],
    },
  ];

  const space_bookings: Row[] = [
    {
      id: "sp-seed-cowork",
      member_id: DEMO_MEMBER_ID,
      space_id: "cs-central-cowork",
      date: day(2),
      start_hour: 10,
      end_hour: 13,
      guests: 1,
      total: 0,
      status: "confirmed",
      created_at: ts(-1, 16),
    },
  ];

  return { invoices, incidents, space_bookings };
}

// The seeded demo member, so the mobile app looks alive on first open.
const DEMO_MEMBER = {
  id: DEMO_MEMBER_ID,
  name: "Alex Río",
  email: "alex@stays.example",
  phone: "+34 600 123 456",
  member_number: "ST-2024-0042",
};

function iso(d: Date) {
  return d.toISOString();
}

function at(base: Date, dayOffset: number, hour: number, minute = 0) {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// Reservations are generated relative to "now" so the Today/Calendar views are
// always populated whenever the demo is first opened.
function buildReservations(now: Date) {
  const soon = new Date(now.getTime() + 30 * 60_000); // within the "next 1h" stat
  const soonEnd = new Date(soon.getTime() + 2 * 60 * 60_000);

  const defs: Array<{
    id: string;
    room_id: string;
    customer_id: string | null;
    start: Date;
    end: Date;
    status: string;
    total: number;
    base: number;
    role: string;
    overnight?: boolean;
    people?: number;
    deposit_paid?: boolean;
    cleaning?: number;
    extras?: {
      extra_id: string;
      qty: number;
      unit_price: number;
      is_gift?: boolean;
      bed_message?: string | null;
      screen_message?: string | null;
    }[];
  }> = [
    {
      id: "res-1",
      room_id: "room-central-aurora",
      customer_id: "cust-1",
      start: at(now, 0, 14, 0),
      end: at(now, 0, 16, 0),
      status: "completed",
      total: 78,
      base: 78,
      role: "reception",
      deposit_paid: true,
    },
    {
      id: "res-2",
      room_id: "room-norte-ritmo",
      customer_id: "cust-2",
      start: at(now, 0, 20, 30),
      end: at(now, 0, 22, 30),
      status: "in_progress",
      total: 87,
      base: 62,
      role: "public",
      deposit_paid: true,
      cleaning: 30,
      extras: [{ extra_id: "ex-cava", qty: 1, unit_price: 25 }],
    },
    {
      id: "res-3",
      room_id: "room-sur-oasis",
      customer_id: "cust-3",
      start: soon,
      end: soonEnd,
      status: "confirmed",
      total: 95,
      base: 65,
      role: "public",
      deposit_paid: true,
      extras: [
        {
          extra_id: "ex-deco-plus",
          qty: 1,
          unit_price: 30,
          bed_message: "Te amo",
          screen_message: "Feliz aniversario",
        },
      ],
    },
    {
      id: "res-4",
      room_id: "room-sur-metropolis",
      customer_id: "cust-5",
      start: at(now, 0, 23, 0),
      end: at(now, 1, 1, 0),
      status: "confirmed",
      total: 65,
      base: 65,
      role: "admin",
      deposit_paid: true,
    },
    {
      id: "res-5",
      room_id: "room-central-aurora",
      customer_id: "cust-4",
      start: at(now, 1, 22, 0),
      end: at(now, 2, 10, 0),
      status: "confirmed",
      total: 120,
      base: 120,
      role: "public",
      overnight: true,
      deposit_paid: true,
    },
    {
      id: "res-6",
      room_id: "room-norte-estelar",
      customer_id: "cust-1",
      start: at(now, -1, 19, 0),
      end: at(now, -1, 22, 0),
      status: "completed",
      total: 88,
      base: 88,
      role: "reception",
      deposit_paid: true,
    },
    {
      id: "res-7",
      room_id: "room-sur-eden",
      customer_id: "cust-3",
      start: at(now, -2, 21, 0),
      end: at(now, -2, 23, 0),
      status: "completed",
      total: 110,
      base: 65,
      role: "public",
      deposit_paid: true,
      extras: [
        {
          extra_id: "ex-deco-premium",
          qty: 1,
          unit_price: 50,
          bed_message: "Para ti",
          screen_message: "Feliz cumpleaños mi amor",
        },
        { extra_id: "ex-cava", qty: 1, unit_price: 0, is_gift: true },
      ],
    },
    {
      id: "res-8",
      room_id: "room-central-coral",
      customer_id: null,
      start: at(now, 0, 22, 0),
      end: at(now, 1, 0, 0),
      status: "pending",
      total: 62,
      base: 62,
      role: "public",
      deposit_paid: false,
    },
  ];

  const reservations: Row[] = [];
  const reservationExtras: Row[] = [];

  for (const d of defs) {
    reservations.push({
      id: d.id,
      room_id: d.room_id,
      customer_id: d.customer_id,
      start_at: iso(d.start),
      end_at: iso(d.end),
      with_jacuzzi: true,
      people: d.people ?? 2,
      is_overnight: !!d.overnight,
      cleaning_minutes: d.cleaning ?? 15,
      base_price: d.base,
      third_person_surcharge: 0,
      dynamic_surcharge: 0,
      dynamic_reason: null,
      extras_total: (d.extras ?? []).reduce(
        (s, e) => s + (e.is_gift ? 0 : e.qty * e.unit_price),
        0,
      ),
      total: d.total,
      deposit_amount: Math.round(d.total * 0.3 * 100) / 100,
      deposit_paid: d.deposit_paid ?? false,
      paid_amount: d.deposit_paid ? Math.round(d.total * 0.3 * 100) / 100 : 0,
      status: d.status,
      internal_notes: null,
      manual_override: d.role === "admin",
      created_by: null,
      created_by_role: d.role,
      redsys_order: d.deposit_paid ? `DEMO-${d.id}` : null,
      created_at: iso(d.start),
      updated_at: iso(d.start),
    });
    for (const [i, e] of (d.extras ?? []).entries()) {
      reservationExtras.push({
        id: `${d.id}-ex-${i}`,
        reservation_id: d.id,
        extra_id: e.extra_id,
        qty: e.qty,
        unit_price: e.unit_price,
        is_gift: e.is_gift ?? false,
        bed_message: e.bed_message ?? null,
        screen_message: e.screen_message ?? null,
        created_at: iso(d.start),
      });
    }
  }

  return { reservations, reservationExtras };
}

// Bookings, signatures, loyalty ledger and journal for the seeded demo member,
// so the mobile app (trips, club, journal) is populated on first open. Mirrors
// the same `reservations` shape used by reception, plus a `member_id` column the
// connector filters on for "my trips".
function buildMemberData(now: Date, rooms: Row[]) {
  const nowIso = iso(now);
  const roomBy = (id: string) => rooms.find((r) => r.id === id);

  // A past, completed stay (Madrid) and an upcoming confirmed one (Barcelona).
  const pastRoom = roomBy("room-central-aurora")!;
  const nextRoom = rooms.find((r) => r.property_id === "prop-bcn-gotic")!;

  const pastStart = at(now, -21, 22, 0);
  const pastEnd = at(now, -20, 10, 0);
  const nextStart = at(now, 14, 16, 0);
  const nextEnd = at(now, 15, 12, 0);

  const memberReservations: Row[] = [
    {
      id: "res-member-past",
      room_id: pastRoom.id,
      customer_id: null,
      member_id: DEMO_MEMBER_ID,
      property_id: pastRoom.property_id,
      start_at: iso(pastStart),
      end_at: iso(pastEnd),
      with_jacuzzi: true,
      people: 2,
      is_overnight: true,
      cleaning_minutes: 15,
      base_price: 120,
      third_person_surcharge: 0,
      dynamic_surcharge: 0,
      dynamic_reason: null,
      extras_total: 0,
      total: 120,
      deposit_amount: 36,
      deposit_paid: true,
      paid_amount: 36,
      status: "completed",
      internal_notes: null,
      manual_override: false,
      is_prebooking: false,
      hold_expires_at: null,
      created_by: null,
      created_by_role: "member",
      redsys_order: "DEMO-member-past",
      created_at: iso(at(now, -28, 12, 0)),
      updated_at: iso(pastEnd),
    },
    {
      id: "res-member-next",
      room_id: nextRoom.id,
      customer_id: null,
      member_id: DEMO_MEMBER_ID,
      property_id: nextRoom.property_id,
      start_at: iso(nextStart),
      end_at: iso(nextEnd),
      with_jacuzzi: nextRoom.jacuzzi === "always",
      people: 2,
      is_overnight: true,
      cleaning_minutes: 15,
      base_price: 130,
      third_person_surcharge: 0,
      dynamic_surcharge: 0,
      dynamic_reason: null,
      extras_total: 0,
      total: 130,
      deposit_amount: 39,
      deposit_paid: true,
      paid_amount: 39,
      status: "confirmed",
      internal_notes: null,
      manual_override: false,
      is_prebooking: false,
      hold_expires_at: null,
      created_by: null,
      created_by_role: "member",
      redsys_order: "DEMO-member-next",
      created_at: nowIso,
      updated_at: nowIso,
    },
  ];
  const memberExtras: Row[] = [];

  // The past stay was signed at check-in.
  const signatures: Row[] = [
    {
      id: "sig-member-past",
      reservation_id: "res-member-past",
      doc_type: "checkin_contract",
      signer_name: DEMO_MEMBER.name,
      signature_data: null,
      status: "signed",
      signed_at: iso(pastStart),
      created_at: iso(pastStart),
    },
  ];

  const loyalty_accounts: Row[] = [
    {
      id: "loyalty-demo",
      member_id: DEMO_MEMBER_ID,
      points: 740,
      lifetime_points: 1240,
      tier_id: "tier-plata",
      member_since: iso(at(now, -200, 12, 0)),
      created_at: nowIso,
    },
  ];

  const loyalty_transactions: Row[] = [
    {
      id: "lt-1",
      member_id: DEMO_MEMBER_ID,
      type: "earn",
      points: 150,
      reason: "Estancia · Demo Stays Gran Vía",
      reservation_id: "res-member-past",
      created_at: iso(pastEnd),
    },
    {
      id: "lt-2",
      member_id: DEMO_MEMBER_ID,
      type: "earn",
      points: 500,
      reason: "Bono de bienvenida",
      reservation_id: null,
      created_at: iso(at(now, -200, 12, 5)),
    },
    {
      id: "lt-3",
      member_id: DEMO_MEMBER_ID,
      type: "redeem",
      points: -300,
      reason: "Canje · Late checkout 14:00",
      reservation_id: null,
      created_at: iso(at(now, -40, 18, 0)),
    },
    {
      id: "lt-4",
      member_id: DEMO_MEMBER_ID,
      type: "earn",
      points: 390,
      reason: "Estancias anteriores",
      reservation_id: null,
      created_at: iso(at(now, -120, 12, 0)),
    },
  ];

  const je = (
    id: string,
    ref: string,
    propertyId: string | null,
    event: string,
    at_: Date,
    payload: Row = {},
  ): Row => ({
    id,
    booking_ref: ref,
    member_id: DEMO_MEMBER_ID,
    property_id: propertyId,
    event_type: event,
    actor: "member",
    payload,
    created_at: iso(at_),
  });
  const booking_journal: Row[] = [
    je("jr-1", "res-member-past", pastRoom.property_id, "prebooked", at(now, -28, 12, 0), {
      room: pastRoom.name,
    }),
    je("jr-2", "res-member-past", pastRoom.property_id, "confirmed", at(now, -28, 12, 2), {
      deposit: 36,
    }),
    je("jr-3", "res-member-past", pastRoom.property_id, "signed", pastStart, {
      doc: "checkin_contract",
    }),
    je("jr-4", "res-member-past", pastRoom.property_id, "checked_in", pastStart, {}),
    je("jr-5", "res-member-past", pastRoom.property_id, "points_earned", pastEnd, { points: 150 }),
    je("jr-6", "res-member-next", nextRoom.property_id, "confirmed", now, {
      room: nextRoom.name,
      deposit: 39,
    }),
  ];

  return {
    memberReservations,
    memberExtras,
    signatures,
    loyalty_accounts,
    loyalty_transactions,
    booking_journal,
  };
}

export function buildSeedDb(): DemoDb {
  const now = new Date();
  const nowIso = iso(now);

  const rate_groups = RATE_GROUPS.map((g) => ({ ...g, created_at: nowIso }));

  const rate_hourly: Row[] = [];
  for (const [groupId, rows] of Object.entries(HOURLY)) {
    for (const [duration, withJ, withoutJ] of rows) {
      rate_hourly.push({
        id: `rh-${groupId}-${duration}`,
        rate_group_id: groupId,
        duration_min: duration,
        price_with_jacuzzi: withJ,
        price_without_jacuzzi: withoutJ,
      });
    }
  }

  const rate_overnight: Row[] = [];
  for (const [groupId, rows] of Object.entries(OVERNIGHT)) {
    for (const [checkout, price] of rows) {
      rate_overnight.push({
        id: `ro-${groupId}-${checkout}`,
        rate_group_id: groupId,
        checkout_time: checkout,
        price,
      });
    }
  }

  const rate_nightly: Row[] = Object.entries(NIGHTLY).map(([groupId, [price, weekend]]) => ({
    id: `rn-${groupId}`,
    rate_group_id: groupId,
    price,
    weekend_price: weekend,
  }));

  const rate_third_person: Row[] = THIRD.map(([duration, surcharge]) => ({
    id: `rt-${duration}`,
    duration_min: duration,
    surcharge,
  }));

  const rooms: Row[] = ROOM_DEFS.map(([building, name, groupId, jacuzzi, capacity], i) => {
    const slug = `${building}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return {
      id: `room-${slug}`,
      building,
      property_id: BUILDING_TO_PROPERTY[building] ?? null,
      name,
      jacuzzi,
      capacity,
      asset_type: deriveAssetType(jacuzzi, capacity),
      features: deriveFeatures(slug, deriveAssetType(jacuzzi, capacity)),
      status: "available",
      rate_group_id: groupId,
      // Only rate groups with overnight pricing can offer "noche completa";
      // the rest are hourly-only so reception can demo the per-room toggle.
      allows_overnight: groupId in OVERNIGHT,
      description: null,
      image_url: `/imagenes/rooms/${slug}.svg`,
      has_tv: true,
      has_swing: name === "Estelar" || name === "Oasis",
      active: true,
      sort_order: i,
      created_at: nowIso,
    };
  });

  // Rooms for the new provinces' properties (Barcelona, Valencia, Sevilla…).
  EXTRA_PROPERTY_ROOMS.forEach(([propertyId, name, groupId, jacuzzi, capacity, imageSlug], j) => {
    const propSlug = propertyId.replace(/^prop-/, "");
    rooms.push({
      id: `room-${propSlug}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      building: PROPERTY_DEFS.find((p) => p[0] === propertyId)?.[1] ?? propertyId,
      property_id: propertyId,
      name,
      jacuzzi,
      capacity,
      asset_type: deriveAssetType(jacuzzi, capacity),
      features: deriveFeatures(`${propSlug}-${name}`, deriveAssetType(jacuzzi, capacity)),
      status: "available",
      rate_group_id: groupId,
      allows_overnight: groupId in OVERNIGHT,
      description: null,
      image_url: `/imagenes/rooms/${imageSlug}.svg`,
      has_tv: true,
      has_swing: false,
      active: true,
      sort_order: 100 + j,
      created_at: nowIso,
    });
  });

  const provinces: Row[] = PROVINCES.map(([id, name, accent, tagline], i) => ({
    id,
    name,
    accent,
    tagline,
    sort_order: i,
    created_at: nowIso,
  }));

  const properties: Row[] = PROPERTY_DEFS.map(
    ([id, name, provinceId, city, address, rating, amenities, description, brand], i) => ({
      id,
      name,
      province_id: provinceId,
      city,
      address,
      rating,
      amenities,
      description,
      brand,
      image_url: null, // mobile app derives a hero from province accent + first room
      active: true,
      sort_order: i,
      created_at: nowIso,
    }),
  );

  const loyalty_tiers: Row[] = LOYALTY_TIERS.map(([id, name, minPoints, multiplier, perks], i) => ({
    id,
    name,
    min_points: minPoints,
    points_per_euro: multiplier,
    perks,
    sort_order: i,
    created_at: nowIso,
  }));

  const rewards: Row[] = REWARDS.map(([id, name, cost, category, description], i) => ({
    id,
    name,
    cost_points: cost,
    category,
    description,
    active: true,
    sort_order: i,
    created_at: nowIso,
  }));

  const members: Row[] = [{ ...DEMO_MEMBER, created_at: nowIso }];

  const common_spaces: Row[] = COMMON_SPACES.map(
    (
      [id, propertyId, name, kind, capacity, description, openHour, closeHour, pricePerHour],
      i,
    ) => ({
      id,
      property_id: propertyId,
      name,
      kind,
      capacity,
      description,
      open_hour: openHour,
      close_hour: closeHour,
      price_per_hour: pricePerHour,
      active: true,
      sort_order: i,
      created_at: nowIso,
    }),
  );

  const { invoices, incidents, space_bookings } = buildTenantData(now);

  const {
    memberReservations,
    memberExtras,
    signatures,
    loyalty_accounts,
    loyalty_transactions,
    booking_journal,
  } = buildMemberData(now, rooms);

  const extras: Row[] = EXTRAS.map((e) => ({
    ...e,
    active: true,
    image_url: null,
    created_at: nowIso,
  }));

  const gift_thresholds: Row[] = [
    { id: "gt-1", min_extras_total: 80, gift_extra_id: "ex-cava", active: true },
  ];

  const dynamic_rules: Row[] = [
    {
      id: "dr-occ",
      type: "occupancy",
      name: "Alta ocupación",
      config: { threshold: 70 },
      multiplier: 15,
      active: false,
      created_at: nowIso,
    },
    {
      id: "dr-sanvalentin",
      type: "date",
      name: "San Valentín",
      config: { from: "2027-02-13", to: "2027-02-14" },
      multiplier: 20,
      active: false,
      created_at: nowIso,
    },
  ];

  const customers: Row[] = CUSTOMERS.map((c) => ({ ...c, created_at: nowIso }));

  // Promo codes: a percentage code with no expiry, a fixed single-use code, and
  // an already-expired one so the "Archivados" section has content.
  const promo_codes: Row[] = [
    {
      id: "promo-verano15",
      code: "VERANO15",
      discount_type: "percent",
      discount_value: 15,
      valid_from: nowIso,
      valid_until: null,
      single_use: false,
      max_uses: null,
      times_used: 4,
      active: true,
      archived: false,
      created_at: nowIso,
    },
    {
      id: "promo-bienvenida",
      code: "BIENVENIDA10",
      discount_type: "fixed",
      discount_value: 10,
      valid_from: nowIso,
      valid_until: null,
      single_use: true,
      max_uses: 1,
      times_used: 0,
      active: true,
      archived: false,
      created_at: nowIso,
    },
    {
      id: "promo-navidad",
      code: "NAVIDAD20",
      discount_type: "percent",
      discount_value: 20,
      valid_from: new Date(now.getTime() - 90 * 86_400_000).toISOString(),
      valid_until: new Date(now.getTime() - 30 * 86_400_000).toISOString(),
      single_use: false,
      max_uses: null,
      times_used: 12,
      active: false,
      archived: true,
      created_at: nowIso,
    },
  ];

  const { reservations, reservationExtras } = buildReservations(now);

  // One room kept occupied over the mobile app's default search window
  // (7→8 days out) so the "Avísame cuando se libere" availability-watch flow has
  // something to watch. Cancelling/checking it out from the panel frees the room
  // and fires the guest's notification.
  const watchDemoReservations: Row[] = [
    {
      id: "res-occupied-coral",
      room_id: "room-central-coral",
      property_id: "prop-madrid-central",
      customer_id: "cust-2",
      member_id: null,
      start_at: iso(at(now, 7, 15, 0)),
      end_at: iso(at(now, 8, 12, 0)),
      with_jacuzzi: true,
      people: 2,
      is_overnight: true,
      cleaning_minutes: 15,
      base_price: 105,
      third_person_surcharge: 0,
      dynamic_surcharge: 0,
      dynamic_reason: null,
      extras_total: 0,
      total: 105,
      deposit_amount: 31.5,
      deposit_paid: true,
      paid_amount: 31.5,
      status: "confirmed",
      internal_notes: "Ocupación demo (para avisos de disponibilidad)",
      manual_override: false,
      is_prebooking: false,
      hold_expires_at: null,
      created_by: null,
      created_by_role: "reception",
      redsys_order: "DEMO-occupied-coral",
      created_at: nowIso,
      updated_at: nowIso,
    },
  ];

  // Occupancy for the price-preview demo: block some rooms over the default
  // discovery window (≈7→14 days out) so the property page shows a live
  // occupancy band and the matching dynamic surcharge. Gran Vía → medium,
  // Residencia Triana → high (leaving one asset free).
  const occ = (id: string, roomId: string, propertyId: string, total: number): Row => ({
    id,
    room_id: roomId,
    property_id: propertyId,
    customer_id: null,
    member_id: null,
    start_at: iso(at(now, 7, 15, 0)),
    end_at: iso(at(now, 14, 12, 0)),
    with_jacuzzi: false,
    people: 2,
    is_overnight: true,
    cleaning_minutes: 15,
    base_price: total,
    third_person_surcharge: 0,
    dynamic_surcharge: 0,
    dynamic_reason: null,
    extras_total: 0,
    total,
    deposit_amount: Math.round(total * 0.3 * 100) / 100,
    deposit_paid: true,
    paid_amount: Math.round(total * 0.3 * 100) / 100,
    status: "confirmed",
    internal_notes: "Ocupación demo (para previsualización de precio)",
    manual_override: false,
    is_prebooking: false,
    hold_expires_at: null,
    created_by: null,
    created_by_role: "reception",
    redsys_order: `DEMO-${id}`,
    created_at: nowIso,
    updated_at: nowIso,
  });
  const occupancyDemoReservations: Row[] = [
    occ("res-occ-granvia", "room-central-zen", "prop-madrid-central", 690),
    occ("res-occ-triana-1", "room-sevilla-triana-giralda", "prop-sevilla-triana", 640),
    occ("res-occ-triana-2", "room-sevilla-triana-betis", "prop-sevilla-triana", 620),
  ];

  const user_roles: Row[] = [
    { id: "ur-1", user_id: DEMO_USER_ID, role: "admin", created_at: nowIso },
  ];

  return {
    rate_groups,
    rate_hourly,
    rate_overnight,
    rate_nightly,
    rate_third_person,
    rooms,
    extras,
    gift_thresholds,
    dynamic_rules,
    customers,
    promo_codes,
    // Reception-created reservations plus the demo member's mobile bookings share
    // one `reservations` table — the connector filters by `member_id`.
    reservations: [
      ...reservations,
      ...memberReservations,
      ...watchDemoReservations,
      ...occupancyDemoReservations,
    ],
    reservation_extras: [...reservationExtras, ...memberExtras],
    user_roles,
    audit_log: [],
    // ── Mobile app / loyalty domain ──
    provinces,
    properties,
    members,
    loyalty_tiers,
    loyalty_accounts,
    loyalty_transactions,
    rewards,
    signatures,
    booking_journal,
    availability_watches: [],
    // ── Tenant management domain (zonas comunes, facturas, incidencias) ──
    common_spaces,
    space_bookings,
    invoices,
    incidents,
  };
}

// ── Persistence ────────────────────────────────────────────────────────────────
function canPersist() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadDb(): DemoDb {
  if (!canPersist()) return buildSeedDb();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === STORAGE_VERSION && parsed.db) {
        return parsed.db as DemoDb;
      }
    }
  } catch {
    /* fall through to reseed */
  }
  const fresh = buildSeedDb();
  saveDb(fresh);
  return fresh;
}

export function saveDb(db: DemoDb) {
  if (!canPersist()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, db }));
  } catch {
    /* ignore quota / serialization errors */
  }
}

export function resetDemoDb() {
  if (canPersist()) window.localStorage.removeItem(STORAGE_KEY);
}
