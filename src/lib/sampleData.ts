import { Venue, CrowdSnapshot, Notification, VenueComplex, VenueSpace, SpaceEvent } from '@/types';

export const SAMPLE_VENUES: Venue[] = [
  // ── Single Demo Venue: MetLife Stadium — New York/NJ ───────────────────────
  {
    id: 'metlife-stadium',
    name: 'MetLife Stadium',
    city: 'East Rutherford, NJ',
    capacity: 82500,
    lat: 40.8135,
    lng: -74.0745,
    imageUrl: '/venue-metlife.jpg',
    riskProfile: {
      climateRisks: ['summer_heat_wave', 'nor_easter_storms', 'high_humidity'],
      transitVulnerabilities: ['NJ_Transit_saturation', 'PATH_congestion', 'Lincoln_Tunnel_backup'],
      heatThresholdF: 95,
    },
    sections: [
      { id: 's100', name: 'Section 100', level: 1, zones: ['zone-a', 'zone-b'] },
      { id: 's200', name: 'Section 200', level: 2, zones: ['zone-c', 'zone-d'] },
      { id: 's300', name: 'Section 300', level: 3, zones: ['zone-e'] },
    ],
    zones: [
      {
        id: 'zone-a', name: 'North Lower', capacity: 8000, currentCount: 6800, density: 0.85,
        coordinates: [{ lat: 40.815, lng: -74.075 }, { lat: 40.816, lng: -74.073 }],
        areaM2: 1800, egressWidthM: 12, isStepFree: false, phase: 'ingress',
      },
      {
        id: 'zone-b', name: 'South Lower', capacity: 8000, currentCount: 4200, density: 0.53,
        coordinates: [{ lat: 40.812, lng: -74.075 }, { lat: 40.813, lng: -74.073 }],
        areaM2: 1800, egressWidthM: 12, isStepFree: false, phase: 'circulation',
      },
      {
        id: 'zone-c', name: 'East Club', capacity: 6000, currentCount: 1400, density: 0.23,
        coordinates: [{ lat: 40.814, lng: -74.072 }, { lat: 40.815, lng: -74.071 }],
        areaM2: 1400, egressWidthM: 8, isStepFree: true, phase: 'circulation',
      },
      {
        id: 'zone-d', name: 'West Club', capacity: 6000, currentCount: 3200, density: 0.53,
        coordinates: [{ lat: 40.814, lng: -74.077 }, { lat: 40.815, lng: -74.076 }],
        areaM2: 1400, egressWidthM: 8, isStepFree: true, phase: 'circulation',
      },
      {
        id: 'zone-e', name: 'Upper Deck', capacity: 12000, currentCount: 9800, density: 0.82,
        coordinates: [{ lat: 40.813, lng: -74.076 }, { lat: 40.815, lng: -74.073 }],
        areaM2: 2600, egressWidthM: 10, isStepFree: false, phase: 'egress',
      },
    ],
    amenities: [
      { id: 'rest-n1', type: 'restroom', name: 'North Restroom A', location: { lat: 40.815, lng: -74.074 }, section: 's100', waitTime: 5, predictedWaitTime: 3, trend: 'decreasing', isOpen: true },
      { id: 'rest-s1', type: 'restroom', name: 'South Restroom B', location: { lat: 40.812, lng: -74.074 }, section: 's100', waitTime: 12, predictedWaitTime: 15, trend: 'increasing', isOpen: true },
      { id: 'conc-1', type: 'concession', name: 'Main Concession Stand', location: { lat: 40.813, lng: -74.075 }, section: 's100', waitTime: 8, predictedWaitTime: 8, trend: 'stable', isOpen: true },
      { id: 'conc-2', type: 'concession', name: 'East Food Court', location: { lat: 40.814, lng: -74.072 }, section: 's200', waitTime: 3, predictedWaitTime: 5, trend: 'increasing', isOpen: true },
      { id: 'merch-1', type: 'merchandise', name: 'Team Store', location: { lat: 40.813, lng: -74.073 }, section: 's100', waitTime: 0, predictedWaitTime: 0, trend: 'stable', isOpen: true },
      { id: 'gate-a', type: 'gate', name: 'Gate A (North)', location: { lat: 40.816, lng: -74.074 }, section: 's100', waitTime: 2, predictedWaitTime: 2, trend: 'stable', isOpen: true },
      { id: 'gate-b', type: 'gate', name: 'Gate B (South)', location: { lat: 40.811, lng: -74.074 }, section: 's100', waitTime: 15, predictedWaitTime: 18, trend: 'increasing', isOpen: true },
    ],
  },
];

// ── Crowd Snapshot ───────────────────────────────────────────────────────────
export const SAMPLE_CROWD_SNAPSHOT: CrowdSnapshot = {
  timestamp: Date.now(),
  venueId: 'metlife-stadium',
  totalCount: 25400,
  zones: {
    'zone-a': { density: 0.85, count: 6800, capacity: 8000 },
    'zone-b': { density: 0.53, count: 4200, capacity: 8000 },
    'zone-c': { density: 0.23, count: 1400, capacity: 6000 },
    'zone-d': { density: 0.53, count: 3200, capacity: 6000 },
    'zone-e': { density: 0.82, count: 9800, capacity: 12000 },
  },
};

// ── Sample Notifications ─────────────────────────────────────────────────────
export const SAMPLE_NOTIFICATIONS: Notification[] = [
  { id: 'n1', type: 'warning', title: 'High Congestion Alert', message: 'North Lower (Zone A) is at 85% capacity. Consider using South entrance.', timestamp: Date.now() - 120000, section: 's100', read: false },
  { id: 'n2', type: 'success', title: 'Wait Time Dropped', message: 'North Restroom A wait time dropped to 5 minutes — now the shortest in the venue.', timestamp: Date.now() - 240000, read: false },
  { id: 'n3', type: 'info', title: 'Halftime Rush Starting', message: 'Halftime begins in 5 minutes. Concession wait times will increase temporarily.', timestamp: Date.now() - 300000, read: true },
  { id: 'n4', type: 'emergency', title: 'Gate B Delay', message: 'Gate B experiencing delays due to security check. Use Gate A or Gate C.', timestamp: Date.now() - 600000, read: true },
];

// ── Crowd Simulation ─────────────────────────────────────────────────────────
/** Simulate real-time crowd data updates with mean-reversion drift */
export function simulateCrowdUpdate(snapshot: CrowdSnapshot): CrowdSnapshot {
  const updated = { ...snapshot, timestamp: Date.now(), zones: { ...snapshot.zones } };
  for (const zoneId in updated.zones) {
    const zone = { ...updated.zones[zoneId] };
    const drift = (Math.random() - 0.5) * 0.05;
    const pull  = (0.5 - zone.density) * 0.04; // mean reversion
    zone.density = Math.max(0.1, Math.min(0.99, zone.density + drift + pull));
    zone.count   = Math.round(zone.density * zone.capacity);
    updated.zones[zoneId] = zone;
  }
  updated.totalCount = Object.values(updated.zones).reduce((s, z) => s + z.count, 0);
  return updated;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO COMPLEX: Bharat Mandap — India AI Impact Summit (v2 showcase)
// Only used when complexId === 'bharat-mandap'. Never leaks to real custom venues.
// ═══════════════════════════════════════════════════════════════════════════════

export const SAMPLE_COMPLEX: VenueComplex = {
  id               : 'bharat-mandap',
  name             : 'Bharat Mandap Convention Centre',
  city             : 'New Delhi',
  address          : 'Pragati Maidan, Mathura Road, New Delhi — 110001',
  totalCapacity    : 7000,
  floors           : 4,
  lat              : 28.6196,
  lng              : 77.2408,
  complexAdminOrgId: 'itpo',
  imageUrl         : '/complex-bharat-mandap.jpg',
  plan             : 'enterprise',
};

export const SAMPLE_SPACES: VenueSpace[] = [
  {
    id: 'hall-1-ground', complexId: 'bharat-mandap',
    name: 'Hall 1 — Keynote Stage (Ground Floor)', floor: 0,
    capacity: 2000, isShared: false,
    coordinates: [
      { lat: 28.6200, lng: 77.2404 }, { lat: 28.6205, lng: 77.2404 },
      { lat: 28.6205, lng: 77.2412 }, { lat: 28.6200, lng: 77.2412 },
    ],
    amenities: [
      { id: 'bm-rest-g1', type: 'restroom', name: 'Ground Floor Restroom (Hall 1)', location: { lat: 28.6201, lng: 77.2405 }, section: 'hall-1-ground', waitTime: 3, predictedWaitTime: 6, trend: 'increasing', isOpen: true },
      { id: 'bm-gate-g1', type: 'gate',     name: 'Hall 1 Main Entrance',          location: { lat: 28.6199, lng: 77.2408 }, section: 'hall-1-ground', waitTime: 2, predictedWaitTime: 2, trend: 'stable',   isOpen: true },
    ],
    isStepFree: true,
  },
  {
    id: 'hall-a-floor1', complexId: 'bharat-mandap',
    name: 'Hall A — Technical Tracks (Floor 1)', floor: 1,
    capacity: 500, isShared: false,
    coordinates: [
      { lat: 28.6197, lng: 77.2404 }, { lat: 28.6200, lng: 77.2404 },
      { lat: 28.6200, lng: 77.2409 }, { lat: 28.6197, lng: 77.2409 },
    ],
    amenities: [
      { id: 'bm-rest-a1', type: 'restroom',   name: 'Hall A Restroom',          location: { lat: 28.6198, lng: 77.2405 }, section: 'hall-a-floor1', waitTime: 5, predictedWaitTime: 4, trend: 'decreasing', isOpen: true },
      { id: 'bm-conc-a1', type: 'concession', name: 'Hall A Refreshment Counter', location: { lat: 28.6199, lng: 77.2407 }, section: 'hall-a-floor1', waitTime: 7, predictedWaitTime: 9, trend: 'increasing',  isOpen: true },
    ],
    isStepFree: false,
  },
  {
    id: 'hall-b-floor1', complexId: 'bharat-mandap',
    name: 'Hall B — Startup Expo (Floor 1)', floor: 1,
    capacity: 800, isShared: false,
    coordinates: [
      { lat: 28.6194, lng: 77.2404 }, { lat: 28.6197, lng: 77.2404 },
      { lat: 28.6197, lng: 77.2412 }, { lat: 28.6194, lng: 77.2412 },
    ],
    amenities: [
      { id: 'bm-rest-b1', type: 'restroom', name: 'Hall B Restroom', location: { lat: 28.6195, lng: 77.2406 }, section: 'hall-b-floor1', waitTime: 2, predictedWaitTime: 3, trend: 'stable', isOpen: true },
    ],
    isStepFree: true,
  },
  {
    // Shared corridor — no event owns this; all attendees see its density
    id: 'corridor-north', complexId: 'bharat-mandap',
    name: 'North Corridor & Elevators (Shared)', floor: 1,
    capacity: 400, isShared: true,
    coordinates: [
      { lat: 28.6200, lng: 77.2409 }, { lat: 28.6205, lng: 77.2409 },
      { lat: 28.6205, lng: 77.2412 }, { lat: 28.6200, lng: 77.2412 },
    ],
    amenities: [
      { id: 'bm-elev-n1', type: 'elevator', name: 'North Elevator Bank', location: { lat: 28.6202, lng: 77.2410 }, section: 'corridor-north', waitTime: 1, predictedWaitTime: 3, trend: 'increasing', isOpen: true },
    ],
    isStepFree: true,
  },
];

export const SAMPLE_SPACE_EVENTS: SpaceEvent[] = [
  {
    id: 'evt-keynote', complexId: 'bharat-mandap', spaceId: 'hall-1-ground',
    orgId: 'nasscom', name: 'India AI Impact Summit — Opening Keynote',
    type: 'summit', date: Date.now() - 3_600_000,
    status: 'live', expectedAttendance: 1800,
    currentPhaseId: 'first_half',
    checkinUrl: '/checkin/bharat-mandap/space/hall-1-ground?event=evt-keynote',
    description: 'Opening address by the Minister of Electronics & IT followed by industry leaders.',
    createdAt: Date.now() - 86_400_000,
  },
  {
    id: 'evt-ai-track', complexId: 'bharat-mandap', spaceId: 'hall-a-floor1',
    orgId: 'google-deepmind-india', name: 'AI in Healthcare — Technical Track',
    type: 'conference', date: Date.now() - 2_400_000,
    status: 'live', expectedAttendance: 420,
    currentPhaseId: 'first_half',
    checkinUrl: '/checkin/bharat-mandap/space/hall-a-floor1?event=evt-ai-track',
    description: 'Deep-dive technical sessions on AI applications in diagnostics, drug discovery, and patient care.',
    createdAt: Date.now() - 86_400_000,
  },
  {
    id: 'evt-expo', complexId: 'bharat-mandap', spaceId: 'hall-b-floor1',
    orgId: 'ispirt', name: 'AI Startup Expo — iSPIRT Pavilion',
    type: 'expo', date: Date.now() - 4_200_000,
    status: 'live', expectedAttendance: 650,
    checkinUrl: '/checkin/bharat-mandap/space/hall-b-floor1?event=evt-expo',
    description: 'Over 80 AI startups from across India showcase their products and seek investor connects.',
    createdAt: Date.now() - 86_400_000,
  },
];

/**
 * Demo RTDB crowd snapshot for the Bharat Mandap complex.
 * Used to seed `complex_crowd/bharat-mandap` during local development.
 */
export const SAMPLE_COMPLEX_CROWD = {
  totalCount: 2870,
  shared: {
    'corridor-north': { spaceId: 'corridor-north', density: 0.68, count: 272, capacity: 400, status: 'warning' as const, spaceName: 'North Corridor & Elevators (Shared)' },
  },
  spaces: {
    'hall-1-ground': { spaceId: 'hall-1-ground', eventId: 'evt-keynote',  orgId: 'nasscom',               density: 0.82, count: 1476, capacity: 2000, status: 'congested' as const, spaceName: 'Hall 1 — Main Plenary Auditorium' },
    'hall-a-floor1': { spaceId: 'hall-a-floor1', eventId: 'evt-ai-track', orgId: 'google-deepmind-india', density: 0.74, count: 370,  capacity: 500,  status: 'warning' as const,   spaceName: 'Hall A — Technical Track' },
    'hall-b-floor1': { spaceId: 'hall-b-floor1', eventId: 'evt-expo',     orgId: 'ispirt',                density: 0.47, count: 376,  capacity: 800,  status: 'normal' as const,    spaceName: 'Hall B — Startup Expo' },
  },
};
