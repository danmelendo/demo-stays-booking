// ─────────────────────────────────────────────────────────────────────────────
// DemoCmsClient — reference CMS client
//
// Serves community events from an in-memory dataset (the stand-in for a headless
// CMS endpoint). RSVPs are persisted in localStorage so "voy / no voy" survives a
// reload without a backend. A real client would call the CMS HTTP/GraphQL API and
// post RSVPs to the PMS.
// ─────────────────────────────────────────────────────────────────────────────

import type { CmsClient } from "./client";
import type { CommunityEvent, EventCategory } from "./types";

const RSVP_KEY = "stays-cms-rsvp";

const COMMUNITY_NAMES: Record<string, string> = {
  "prop-madrid-central": "Demo Stays · Gran Vía",
  "prop-madrid-norte": "Demo Stays · Chamartín",
  "prop-madrid-sur": "Demo Stays · Atocha",
  "prop-bcn-gotic": "Demo Stays · Gótico",
  "prop-valencia-marina": "Demo Stays · Marina",
  "prop-sevilla-triana": "Demo Stays · Triana",
  "prop-malaga-centro": "Demo Stays · Soho",
  "prop-bilbao-abando": "Demo Stays · Abando",
};

// Earthy olive/green/bronze accents to match the cream + black + olive theme.
const CATEGORY_ACCENT: Record<EventCategory, string> = {
  social: "40 30% 40%",
  wellness: "120 25% 32%",
  cultural: "75 25% 32%",
  sport: "160 22% 32%",
  market: "30 35% 40%",
};

// [communityId, title, summary, category, dayOffset, hour, location, capacity, attending]
type EventDef = [string, string, string, EventCategory, number, number, string, number, number];

const EVENT_DEFS: EventDef[] = [
  ["prop-madrid-central", "Cena de bienvenida vecinal", "Tapas y presentaciones en la azotea", "social", 2, 21, "Azotea · Gran Vía", 40, 28],
  ["prop-madrid-central", "Yoga al amanecer", "Sesión guiada para empezar el día", "wellness", 4, 8, "Jardín interior", 20, 14],
  ["prop-madrid-central", "Cineclub: clásicos europeos", "Proyección + coloquio", "cultural", 9, 20, "Sala común", 30, 17],
  ["prop-madrid-norte", "Torneo de pádel", "Dobles abiertos, todos los niveles", "sport", 3, 18, "Pistas Chamartín", 16, 12],
  ["prop-madrid-norte", "Mercadillo de intercambio", "Trae lo que no usas, llévate algo nuevo", "market", 6, 11, "Patio central", 60, 35],
  ["prop-madrid-sur", "Club de lectura", "Comentamos la novela del mes", "cultural", 5, 19, "Biblioteca Atocha", 18, 9],
  ["prop-madrid-sur", "Brunch de domingo", "Comunidad y café de especialidad", "social", 7, 12, "Cafetería común", 35, 22],
  ["prop-bcn-gotic", "Ruta de tapas por el Gótico", "Quedada gastronómica de vecinos", "social", 2, 20, "Plaça Reial", 25, 19],
  ["prop-bcn-gotic", "Taller de cerámica", "Iníciate al torno con un ceramista local", "cultural", 8, 17, "Taller planta baja", 12, 11],
  ["prop-valencia-marina", "Voley playa al atardecer", "Partidos amistosos en la Malvarrosa", "sport", 3, 19, "Playa Malvarrosa", 24, 16],
  ["prop-valencia-marina", "Meditación frente al mar", "Mindfulness guiado", "wellness", 6, 8, "Paseo marítimo", 20, 10],
  ["prop-sevilla-triana", "Noche de flamenco", "Cante y baile en el patio", "cultural", 4, 21, "Patio Triana", 50, 41],
  ["prop-sevilla-triana", "Mercado de productores", "Productos locales de la huerta", "market", 10, 10, "Calle Betis", 80, 30],
  ["prop-malaga-centro", "Ruta de arte urbano por el Soho", "Visita guiada por murales", "cultural", 5, 18, "Barrio Soho", 22, 13],
  ["prop-malaga-centro", "Aperitivo en la azotea", "Sunset con vistas al puerto", "social", 1, 20, "Azotea Soho", 40, 31],
  ["prop-bilbao-abando", "Visita al Guggenheim", "Entrada de grupo + paseo por la ría", "cultural", 7, 11, "Museo Guggenheim", 20, 15],
  ["prop-bilbao-abando", "Running por la ría", "5K suave para vecinos", "sport", 3, 9, "Ría de Bilbao", 30, 18],
];

function loadRsvps(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(RSVP_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveRsvps(set: Set<string>) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(RSVP_KEY, JSON.stringify([...set]));
  }
}

function buildEvents(): CommunityEvent[] {
  const now = new Date();
  return EVENT_DEFS.map(([communityId, title, summary, category, dayOffset, hour, location, capacity, attending], i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, 0, 0, 0);
    return {
      id: `evt-${i + 1}`,
      communityId,
      communityName: COMMUNITY_NAMES[communityId] ?? "Comunidad",
      title,
      summary,
      description: `${summary}. Una actividad abierta a residentes de ${COMMUNITY_NAMES[communityId] ?? "la comunidad"}; apúntate para reservar tu plaza y conocer a tus vecinos.`,
      category,
      startsAt: d.toISOString(),
      location,
      capacity,
      attending,
      accent: CATEGORY_ACCENT[category],
      going: false,
    };
  });
}

export class DemoCmsClient implements CmsClient {
  readonly cmsName = "Stays CMS";
  private events = buildEvents();

  private decorate(e: CommunityEvent, rsvps: Set<string>): CommunityEvent {
    const going = rsvps.has(e.id);
    return { ...e, going, attending: e.attending + (going ? 1 : 0) };
  }

  async listEvents(filter?: { communityId?: string; upcomingOnly?: boolean }): Promise<CommunityEvent[]> {
    const rsvps = loadRsvps();
    const nowMs = Date.now();
    return this.events
      .filter((e) => (filter?.communityId ? e.communityId === filter.communityId : true))
      .filter((e) => (filter?.upcomingOnly ? new Date(e.startsAt).getTime() >= nowMs : true))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .map((e) => this.decorate(e, rsvps));
  }

  async getEvent(id: string): Promise<CommunityEvent | null> {
    const e = this.events.find((x) => x.id === id);
    return e ? this.decorate(e, loadRsvps()) : null;
  }

  async setRsvp(eventId: string, going: boolean): Promise<CommunityEvent> {
    const rsvps = loadRsvps();
    if (going) rsvps.add(eventId);
    else rsvps.delete(eventId);
    saveRsvps(rsvps);
    const e = this.events.find((x) => x.id === eventId);
    if (!e) throw new Error("Evento no encontrado");
    return this.decorate(e, rsvps);
  }
}
