// ============ VenueFlow Core Types ============

// ── Forward declarations needed by VenueComplex ─────────────────────────────
export type PlanTier = 'starter' | 'pro' | 'enterprise';

// ═══════════════════════════════════════════════════════════════════════════════
// VENUE COMPLEX — Multi-Concurrent-Event Architecture (v2)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A physical building that hosts multiple concurrent events across distinct spaces.
 * Examples: Bharat Mandap, convention centres, university campuses, airport terminals.
 * A standard single-event stadium is modelled as a VenueComplex with one VenueSpace.
 */
export interface VenueComplex {
  id               : string;    // e.g. "bharat-mandap"
  name             : string;    // "Bharat Mandap Convention Centre"
  city             : string;
  address          : string;
  totalCapacity    : number;
  floors           : number;    // number of physical floors
  lat              : number;
  lng              : number;
  /** Org ID of the facility manager (ITPO, venue owner). Has complex_admin role. */
  complexAdminOrgId: string;
  imageUrl        ?: string;
  plan             : PlanTier;  // billing tier for the facility
}

/**
 * A named physical area within a VenueComplex.
 * Can be an exclusive event space (Hall A) or shared infrastructure (corridor, restroom block).
 */
export interface VenueSpace {
  id             : string;    // e.g. "hall-a-floor1"
  complexId      : string;
  name           : string;    // "Hall A — Floor 1"
  floor          : number;
  capacity       : number;
  /**
   * If true, this space is shared infrastructure (corridor, restroom, food court).
   * Shared spaces belong to no single event — all attendees can see their density.
   */
  isShared       : boolean;
  coordinates    : LatLng[];  // floor plan polygon for indoor map
  /** Set when a SpaceEvent goes live in this space; cleared when the event ends. */
  currentEventId?: string;
  amenities      : Amenity[];
  isStepFree    ?: boolean;
  imageUrl      ?: string;
}

/**
 * An event hosted in a specific VenueSpace, owned by a specific Organisation.
 * Multiple SpaceEvents can be live simultaneously in different spaces of the same complex.
 */
export interface SpaceEvent {
  id                 : string;
  complexId          : string;
  spaceId            : string;
  orgId              : string;
  name               : string;
  type               : 'conference' | 'concert' | 'expo' | 'summit' | 'workshop' | 'other';
  date               : number;
  status             : 'upcoming' | 'live' | 'ended';
  expectedAttendance : number;
  actualAttendance  ?: number;
  currentPhaseId    ?: EventPhaseId;
  /** Canonical check-in URL printed on QR codes at this space's entrance gate. */
  checkinUrl         : string;   // /checkin/{complexId}/space/{spaceId}?event={id}
  description       ?: string;
  createdAt          : number;
}

// ── Realtime helper types (used in hooks) ────────────────────────────────────

/** Live crowd data slice for a single VenueSpace, read from RTDB complex_crowd. */
export interface SpaceCrowdSlice {
  spaceId  : string;
  eventId ?: string;
  orgId   ?: string;
  density  : number;   // 0–1
  count    : number;
  capacity : number;
  status   : 'normal' | 'warning' | 'congested';
  spaceName: string;
}

/** Live guest position tick, written to RTDB guest_positions on each QR scan. */
export interface GuestPositionTick {
  sessionId     : string;
  spaceId       : string;
  zoneId        : string;
  floor         : number;
  updatedAt     : number;
  locationSource: 'qr' | 'manual';
}

// ── FCM Push & Analytics ─────────────────────────────────────────────────────

/** FCM registration token for a staff member — stored under their venue's staff push_tokens sub-collection. */
export interface StaffPushToken {
  uid         : string;    // Firebase Auth UID
  venueId     : string;
  orgId       : string;
  fcmToken    : string;    // FCM registration token
  registeredAt: number;
  deviceHint ?: string;   // e.g. "Android Chrome 126"
}

/**
 * Periodic crowd analytics snapshot saved during a live event.
 * Powers historical analytics dashboards and post-event reports.
 */
export interface AnalyticsSnapshot {
  venueId     : string;
  complexId  ?: string;    // set for complex events
  eventId    ?: string;
  timestamp   : number;
  totalCount  : number;
  peakZoneId  : string;
  peakDensity : number;
  avgWaitTime : number;    // average across all open amenities
  zones       : Record<string, { density: number; count: number }>;
}

/** Climate and transit risk profile for a host-city venue */
export interface VenueRiskProfile {
  /** e.g. ["wildfire_smoke", "extreme_heat", "seismic"] */
  climateRisks: string[];
  /** e.g. ["NJ_Transit_saturation", "LAX_congestion"] */
  transitVulnerabilities: string[];
  /** Fahrenheit threshold that triggers a heat-wave alert, e.g. 100 for Dallas */
  heatThresholdF?: number;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  capacity: number;
  lat: number;
  lng: number;
  zones: Zone[];
  amenities: Amenity[];
  sections: Section[];
  imageUrl?: string;
  /** Host-city environmental and transit risk profile */
  riskProfile?: VenueRiskProfile;
}

export interface Zone {
  id: string;
  name: string;
  capacity: number;
  currentCount: number;
  density: number; // 0–1 occupancy ratio
  coordinates: LatLng[];
  color?: string;
  // ── DIM-ICE physical fields (spec requirement) ──────────────────────────
  /** Floor area in m² — used to compute physical density ρ = N/A */
  areaM2?: number;
  /** Total egress width in metres — used for flow rate F = N/(W·t) */
  egressWidthM?: number;
  /** true = wheelchair-accessible / step-free (no stairs or escalators) */
  isStepFree?: boolean;
  /** Ingress-Circulation-Egress phase classification */
  phase?: 'ingress' | 'circulation' | 'egress';
}

// ── DIM-ICE Safety Metrics ───────────────────────────────────────────────────
/** Computed output of the DIM-ICE safety evaluation for a zone */
export interface SafetyMetrics {
  /** Physical crowd density ρ = N/A (people/m²). Spec threshold: ≤ 4.5 */
  physicalDensity: number;
  /** Egress flow rate F = N/(W·t) (pax/min). Spec threshold: ≥ 25 */
  flowRate: number;
  /** Evaluated safety phase */
  dimIcePhase: 'safe' | 'warning' | 'critical';
  /** Whether crowd management staff reallocation is triggered */
  staffReallocationNeeded: boolean;
}

export interface Amenity {
  id: string;
  type: 'restroom' | 'concession' | 'merchandise' | 'gate' | 'elevator';
  name: string;
  location: LatLng;
  section: string;
  waitTime: number; // minutes
  predictedWaitTime: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  capacity?: number;
  isOpen: boolean;
}

export interface Section {
  id: string;
  name: string;
  level: number;
  zones: string[];
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface CrowdSnapshot {
  timestamp: number;
  venueId: string;
  totalCount: number;
  zones: {
    [zoneId: string]: {
      density: number;
      count: number;
      capacity: number;
    };
  };
}

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'emergency';
  title: string;
  message: string;
  timestamp: number;
  section?: string;
  read: boolean;
}

export interface RouteOption {
  id: string;
  type: 'fastest' | 'least_crowded' | 'wheelchair';
  waypoints: LatLng[];
  estimatedTime: number; // minutes
  crowdLevel: 'low' | 'medium' | 'high';
  instructions: string[];
}

export interface NavigationRequest {
  start: string; // section ID
  destination: string; // amenity ID or exit
  preference: 'fastest' | 'least_crowded' | 'wheelchair';
  venueId: string;
}

export interface WaitTimePrediction {
  predictedWait: number;
  confidence: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  reasoning: string;
}

export type DensityLevel = 'low' | 'medium' | 'high';

export function getDensityLevel(density: number): DensityLevel {
  if (density < 0.3) return 'low';
  if (density < 0.7) return 'medium';
  return 'high';
}

export function getDensityColor(density: number): string {
  if (density < 0.3) return '#10B981';
  if (density < 0.7) return '#F59E0B';
  return '#EF4444';
}

// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-TENANT SAAS TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type StaffRole = 'viewer' | 'staff' | 'admin' | 'owner';
// Note: PlanTier is declared at the top of this file (before VenueComplex) and is already exported.

/** A venue operating company (customer of VenueFlow SaaS) */
export interface Organization {
  id          : string;
  name        : string;
  slug        : string;         // URL-safe identifier e.g. "nfl-giants"
  plan        : PlanTier;
  ownerEmail  : string;
  createdAt   : number;
  venueIds    : string[];
  /** IDs of VenueComplexes this org manages as a ComplexAdmin (facility owner). */
  complexIds ?: string[];
  logoUrl    ?: string;
  domain     ?: string;         // e.g. "giants.com" for domain verification
}

/** Staff member scoped to a venue */
export interface StaffMember {
  uid       : string;          // Firebase Auth UID
  email     : string;
  name      : string;
  role      : StaffRole;
  venueId   : string;
  orgId     : string;
  joinedAt  : number;
  isOnDuty  : boolean;
  avatarUrl?: string;
}

// ── Event phases (drives realistic crowd simulation curve) ───────────────────
export type EventPhaseId = 'doors_open' | 'pre_game' | 'first_half' | 'halftime' | 'second_half' | 'post_game' | 'egress';

export interface EventPhase {
  id               : EventPhaseId;
  label            : string;
  durationMins     : number;
  /** 0–1 target fill ratio per zone type for this phase */
  zoneFillRatios   : {
    ingress     : number;
    circulation : number;
    egress      : number;
  };
}

/** A live or scheduled event at a venue */
export interface VenueEvent {
  id                : string;
  venueId           : string;
  orgId             : string;
  name              : string;       // e.g. "Giants vs Cowboys — Week 4"
  type              : 'nfl' | 'nba' | 'concert' | 'soccer' | 'other';
  date              : number;       // Unix timestamp (event start)
  expectedAttendance: number;
  status            : 'upcoming' | 'live' | 'ended';
  currentPhaseId   ?: EventPhaseId;
  phaseStartedAt   ?: number;       // When current phase began
  actualAttendance ?: number;       // Set when event ends
  weatherRiskFactor?: number;       // 0–1 (heat/rain reduces fill rate)
  description      ?: string;       // e.g. "Regular season championship match"
  specialInstructions?: string;    // e.g. "Gates open at 5:00 PM. Clear bag policy in effect."
  createdAt         : number;
}

/** Staff-reported incident */
export interface Incident {
  id         : string;
  venueId    : string;
  orgId      : string;
  zoneId    ?: string;
  type       : 'overcrowding' | 'medical' | 'security' | 'weather' | 'amenity_failure' | 'other';
  severity   : 'low' | 'medium' | 'high' | 'critical';
  description: string;
  reportedBy : string;   // staff UID
  reportedAt : number;
  status     : 'open' | 'acknowledged' | 'resolved';
  resolvedAt?: number;
}

/** Anonymous guest session created at QR check-in */
export interface GuestSession {
  id              : string;
  venueId         : string;
  eventId        ?: string;            // links session to a specific VenueEvent
  // ── Venue Complex fields (v2) ─────────────────────────────────────────────
  /** Set when the guest checks in to a VenueComplex. Undefined for legacy single-venue sessions. */
  complexId      ?: string;
  /** The specific VenueSpace the guest is in (e.g. "hall-a-floor1"). */
  spaceId        ?: string;
  /** Floor number within the complex (0 = ground). */
  floor          ?: number;
  /** How the most recent location update was received. */
  locationSource ?: 'qr' | 'manual';
  // ── Standard fields ───────────────────────────────────────────────────────
  zoneId          : string;
  section        ?: string;
  seat           ?: string;
  language        : string;
  createdAt       : number;
  lastSeenAt      : number;
  /**
   * Privacy TTL — Unix ms timestamp after which this session should be auto-deleted.
   * Set to createdAt + 86_400_000 (24 hours) on creation.
   * Cloud Scheduler calls POST /api/sessions/cleanup every 6h to remove expired sessions.
   */
  expiresAt       : number;
}

/** Weather alert for a venue */
export interface WeatherAlert {
  id         : string;
  venueId    : string;
  type       : 'extreme_heat' | 'thunderstorm' | 'tornado_watch' | 'hurricane' | 'flooding' | 'air_quality';
  severity   : 'advisory' | 'watch' | 'warning' | 'emergency';
  message    : string;
  tempF     ?: number;
  issuedAt   : number;
  expiresAt  : number;
}

/** Partner API key for external integrations */
export interface ApiKey {
  id        : string;
  venueId   : string;
  orgId     : string;
  keyHash   : string;   // bcrypt hash (never store raw key)
  label     : string;   // e.g. "Scoreboard Integration"
  createdAt : number;
  lastUsedAt: number;
}
