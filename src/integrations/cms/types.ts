// ─────────────────────────────────────────────────────────────────────────────
// CMS connector — domain types
//
// Community events are content, not PMS data, so they come from a separate CMS
// endpoint (headless CMS: Contentful/Strapi/Sanity…). The "Stays" app and the
// public web read events through this client; the demo ships a reference
// implementation backed by an in-memory dataset. Each community (urbanización)
// has its own event feed.
// ─────────────────────────────────────────────────────────────────────────────

export type EventCategory = "social" | "wellness" | "cultural" | "sport" | "market";

export interface CommunityEvent {
  id: string;
  /** Maps to a PMS property/community id (e.g. "prop-madrid-central"). */
  communityId: string;
  communityName: string;
  title: string;
  summary: string;
  description: string;
  category: EventCategory;
  /** ISO datetime of the event start. */
  startsAt: string;
  location: string;
  capacity: number;
  attending: number;
  /** HSL accent triplet for theming the card. */
  accent: string;
  /** Whether the current member has RSVP'd (filled in by the demo client). */
  going: boolean;
}
