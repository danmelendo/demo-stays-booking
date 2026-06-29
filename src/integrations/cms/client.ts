// ─────────────────────────────────────────────────────────────────────────────
// CMS connector — integration contract
//
// The "Comunidad" sections of the app and the public web read community events
// only through this interface. Demo Stays ships a reference implementation
// (DemoCmsClient) over an in-memory dataset; pointing at a real headless CMS
// means writing another `CmsClient` and swapping the singleton in ./index.ts.
// ─────────────────────────────────────────────────────────────────────────────

import type { CommunityEvent } from "./types";

export interface CmsClient {
  /** Human-readable id of the CMS behind this client (shown in the UI). */
  readonly cmsName: string;

  /** Events for one community, or across all communities when omitted. */
  listEvents(filter?: { communityId?: string; upcomingOnly?: boolean }): Promise<CommunityEvent[]>;
  getEvent(id: string): Promise<CommunityEvent | null>;

  /** Toggle the current member's RSVP for an event; returns the updated event. */
  setRsvp(eventId: string, going: boolean): Promise<CommunityEvent>;
}
