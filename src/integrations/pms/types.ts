// ─────────────────────────────────────────────────────────────────────────────
// PMS connector — domain DTOs
//
// These are the *integration types*: the shape the mobile app ("Stays") speaks,
// fully decoupled from how any particular PMS stores its data. The Demo Stays
// connector maps its Supabase-shaped rows onto these; another PMS connector would
// map its own API onto the very same types. The app never sees a raw PMS row.
// ─────────────────────────────────────────────────────────────────────────────

export interface PmsProvince {
  id: string;
  name: string;
  /** HSL triplet (e.g. "256 70% 60%") used to theme the province visually. */
  accent: string;
  tagline: string;
  propertyCount: number;
}

/** Which brand an asset belongs to: flex-living vs student residences. */
export type PropertyBrand = "living" | "campus";

export interface PmsProperty {
  id: string;
  name: string;
  /** Brand the property is marketed under (drives discovery filtering). */
  brand: PropertyBrand;
  provinceId: string;
  provinceName: string;
  city: string;
  address: string;
  rating: number;
  amenities: string[];
  description: string;
  accent: string;
  /** Cheapest nightly price across the property's rooms, for "desde X €". */
  fromPrice: number | null;
  /** Cheapest rental rates (night/week/month) across the property's rooms. */
  fromRates: RentalRates | null;
}

/** Rental rates for an asset: per night, per week and per month. */
export interface RentalRates {
  night: number;
  week: number;
  month: number;
}

/** Occupancy band for a property over a date window, used for dynamic pricing. */
export type OccupancyBand = "low" | "medium" | "high";

/**
 * Price preview for a property over selected dates: how full it is, the resulting
 * occupancy surcharge, and the cheapest available occupancy-adjusted rates. This
 * is what resolves the catalogue's indeterminate ranges into a concrete "for your
 * dates" price.
 */
export interface PricePreview {
  available: number;
  totalRooms: number;
  /** 0–100, share of rooms blocked over the window. */
  occupancyPct: number;
  band: OccupancyBand;
  /** Occupancy-driven surcharge already baked into the rates below. */
  surchargePct: number;
  nights: number;
  /** Cheapest available asset's occupancy-adjusted rates (null if none free). */
  fromRates: RentalRates | null;
  /** Cheapest available stay total for the selected dates (null if none free). */
  fromTotal: number | null;
}

export type AssetType = "apartment" | "room" | "shared_room";

/** Coliving asset features (badges), e.g. "cleaning_included", "pets_allowed". */
export type AssetFeature =
  | "cleaning_included"
  | "pets_allowed"
  | "terrace"
  | "bright"
  | "balcony"
  | "furnished"
  | "elevator"
  | "ac"
  | "wifi";

export interface PmsRoom {
  id: string;
  propertyId: string;
  name: string;
  /** Whole apartment (piso), private room (habitación) or shared room. */
  assetType: AssetType;
  features: AssetFeature[];
  capacity: number;
  rateGroupId: string | null;
  imageUrl: string | null;
  allowsOvernight: boolean;
}

export interface AvailabilityQuery {
  propertyId: string;
  /** yyyy-MM-dd */
  checkIn: string;
  /** yyyy-MM-dd */
  checkOut: string;
  guests: number;
}

export interface RoomOffer {
  room: PmsRoom;
  available: boolean;
  nights: number;
  /** Total stay price for the selected dates. */
  price: number;
  pricePerNight: number;
  /** Rental rates (night/week/month) for this asset. */
  rates: RentalRates;
}

export type BookingStatus =
  | "held" // prebooking holding the room (not paid)
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "expired";

export interface Prebooking {
  id: string;
  memberId: string;
  propertyId: string;
  propertyName: string;
  roomId: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  total: number;
  deposit: number;
  status: BookingStatus;
  /** ISO timestamp the hold expires (only while status === "held"). */
  holdExpiresAt: string | null;
  isPrebooking: boolean;
  createdAt: string;
}

export type Reservation = Prebooking; // same shape; status distinguishes them

export interface LoyaltyTier {
  id: string;
  name: string;
  minPoints: number;
  pointsPerEuro: number;
  perks: string[];
}

export interface LoyaltyAccount {
  memberId: string;
  points: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  nextTier: LoyaltyTier | null;
  /** Points still needed to reach nextTier (0 if top tier). */
  pointsToNextTier: number;
  memberSince: string;
  memberNumber: string;
}

export interface LoyaltyTransaction {
  id: string;
  type: "earn" | "redeem";
  points: number;
  reason: string;
  reservationId: string | null;
  createdAt: string;
}

export interface Reward {
  id: string;
  name: string;
  costPoints: number;
  category: string;
  description: string;
}

export type SignatureDocType = "checkin_contract" | "terms";

export interface SignatureDoc {
  id: string;
  reservationId: string;
  docType: SignatureDocType;
  signerName: string;
  signatureData: string | null; // data URL
  status: "pending" | "signed";
  signedAt: string | null;
}

export type JournalEventType =
  | "prebooked"
  | "confirmed"
  | "signed"
  | "checked_in"
  | "cancelled"
  | "points_earned"
  | "reward_redeemed";

export interface JournalEntry {
  id: string;
  bookingRef: string;
  memberId: string | null;
  propertyId: string | null;
  eventType: JournalEventType;
  actor: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  memberNumber: string;
}

// ── Common spaces (zonas comunes) ────────────────────────────────────────────
// Tenant-bookable shared amenities of a property (coworking, gym, lounge…). The
// management app lets a resident reserve a time slot; a real PMS would expose the
// same as an amenity-booking resource.
export type CommonSpaceKind =
  | "coworking"
  | "gym"
  | "lounge"
  | "rooftop"
  | "study"
  | "events"
  | "laundry";

export interface CommonSpace {
  id: string;
  propertyId: string;
  propertyName: string;
  name: string;
  kind: CommonSpaceKind;
  capacity: number;
  description: string;
  /** Bookable window (24h clock) the slot picker offers. */
  openHour: number;
  closeHour: number;
  /** € per hour; 0 = included for residents. */
  pricePerHour: number;
}

export type SpaceBookingStatus = "confirmed" | "cancelled";

export interface SpaceBooking {
  id: string;
  memberId: string;
  spaceId: string;
  spaceName: string;
  spaceKind: CommonSpaceKind;
  propertyName: string;
  /** yyyy-MM-dd */
  date: string;
  startHour: number;
  endHour: number;
  guests: number;
  total: number;
  status: SpaceBookingStatus;
  createdAt: string;
}

// ── Invoices (facturas) ──────────────────────────────────────────────────────
export type InvoiceStatus = "paid" | "pending" | "overdue";

export interface Invoice {
  id: string;
  memberId: string;
  number: string;
  concept: string;
  propertyName: string | null;
  /** yyyy-MM-dd */
  issuedAt: string;
  dueAt: string;
  /** Net + tax = amount. */
  net: number;
  tax: number;
  amount: number;
  status: InvoiceStatus;
}

// ── Incidents (incidencias) ──────────────────────────────────────────────────
export type IncidentCategory =
  | "plumbing"
  | "electrical"
  | "appliance"
  | "heating"
  | "internet"
  | "cleaning"
  | "other";

export type IncidentStatus = "open" | "in_progress" | "resolved";

export interface IncidentUpdate {
  at: string;
  status: IncidentStatus;
  note: string;
}

export interface Incident {
  id: string;
  memberId: string;
  propertyName: string | null;
  category: IncidentCategory;
  title: string;
  description: string;
  status: IncidentStatus;
  createdAt: string;
  /** Status history, newest first, so the tenant sees progress. */
  updates: IncidentUpdate[];
}

export type WatchStatus = "watching" | "available" | "cancelled";

// A guest's request to be notified when an occupied room frees up for given
// dates. A real PMS would push this via an availability webhook; here the
// connector re-checks availability on demand (pollWatches).
export interface AvailabilityWatch {
  id: string;
  memberId: string;
  propertyId: string;
  propertyName: string;
  roomId: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  status: WatchStatus;
  createdAt: string;
  notifiedAt: string | null;
}
