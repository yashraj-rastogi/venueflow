import { Venue, CrowdSnapshot, Notification } from '@/types';

export const SAMPLE_VENUES: Venue[] = [
  // ── 1. MetLife Stadium — New York/NJ ────────────────────────────────────────
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

  // ── 2. SoFi Stadium — Los Angeles, CA ───────────────────────────────────────
  {
    id: 'sofi-stadium',
    name: 'SoFi Stadium',
    city: 'Inglewood, CA',
    capacity: 70000,
    lat: 33.9535,
    lng: -118.3392,
    imageUrl: '/venue-sofi.jpg',
    riskProfile: {
      climateRisks: ['wildfire_smoke', 'extreme_heat', 'seismic_risk', 'air_quality_hazard'],
      transitVulnerabilities: ['LAX_transit_congestion', 'I-405_gridlock', 'limited_rail_access'],
      heatThresholdF: 95,
    },
    sections: [
      { id: 's100', name: 'Section 100', level: 1, zones: ['zone-a'] },
      { id: 's200', name: 'Section 200', level: 2, zones: ['zone-b'] },
    ],
    zones: [
      {
        id: 'zone-a', name: 'Lower Bowl', capacity: 25000, currentCount: 12000, density: 0.48,
        coordinates: [{ lat: 33.953, lng: -118.34 }, { lat: 33.954, lng: -118.338 }],
        areaM2: 5500, egressWidthM: 20, isStepFree: true, phase: 'circulation',
      },
      {
        id: 'zone-b', name: 'Upper Deck', capacity: 20000, currentCount: 6000, density: 0.30,
        coordinates: [{ lat: 33.952, lng: -118.34 }, { lat: 33.955, lng: -118.338 }],
        areaM2: 4400, egressWidthM: 16, isStepFree: false, phase: 'egress',
      },
    ],
    amenities: [
      { id: 'rest-1', type: 'restroom', name: 'Main Restroom', location: { lat: 33.953, lng: -118.339 }, section: 's100', waitTime: 4, predictedWaitTime: 4, trend: 'stable', isOpen: true },
      { id: 'conc-1', type: 'concession', name: 'Food Court 1', location: { lat: 33.954, lng: -118.34 }, section: 's100', waitTime: 6, predictedWaitTime: 5, trend: 'decreasing', isOpen: true },
    ],
  },

  // ── 3. AT&T Stadium — Dallas, TX ────────────────────────────────────────────
  {
    id: 'att-stadium',
    name: 'AT&T Stadium',
    city: 'Arlington, TX',
    capacity: 80000,
    lat: 32.7479,
    lng: -97.0944,
    imageUrl: '/venue-att.jpg',
    riskProfile: {
      climateRisks: ['extreme_heat_wave', 'tornado_risk', 'severe_thunderstorm', 'flash_flooding'],
      transitVulnerabilities: ['limited_rail_access', 'highway_gridlock', 'parking_bottleneck'],
      heatThresholdF: 100, // Dallas 100°F+ trigger from spec
    },
    sections: [
      { id: 's100', name: 'Lower Sideline', level: 1, zones: ['zone-a', 'zone-b'] },
      { id: 's200', name: 'Mezzanine', level: 2, zones: ['zone-c'] },
      { id: 's300', name: 'Upper Deck', level: 3, zones: ['zone-d'] },
    ],
    zones: [
      {
        id: 'zone-a', name: 'North Sideline', capacity: 14000, currentCount: 9800, density: 0.70,
        coordinates: [{ lat: 32.749, lng: -97.095 }, { lat: 32.750, lng: -97.093 }],
        areaM2: 3000, egressWidthM: 14, isStepFree: true, phase: 'circulation',
      },
      {
        id: 'zone-b', name: 'South Sideline', capacity: 14000, currentCount: 11200, density: 0.80,
        coordinates: [{ lat: 32.746, lng: -97.095 }, { lat: 32.747, lng: -97.093 }],
        areaM2: 3000, egressWidthM: 14, isStepFree: true, phase: 'circulation',
      },
      {
        id: 'zone-c', name: 'Mezzanine Level', capacity: 18000, currentCount: 7200, density: 0.40,
        coordinates: [{ lat: 32.747, lng: -97.096 }, { lat: 32.749, lng: -97.093 }],
        areaM2: 4000, egressWidthM: 12, isStepFree: false, phase: 'circulation',
      },
      {
        id: 'zone-d', name: 'Upper Deck', capacity: 20000, currentCount: 16000, density: 0.80,
        coordinates: [{ lat: 32.746, lng: -97.096 }, { lat: 32.750, lng: -97.092 }],
        areaM2: 4500, egressWidthM: 10, isStepFree: false, phase: 'egress',
      },
    ],
    amenities: [
      { id: 'rest-n1', type: 'restroom', name: 'North Concourse Restroom', location: { lat: 32.750, lng: -97.094 }, section: 's100', waitTime: 7, predictedWaitTime: 9, trend: 'increasing', isOpen: true },
      { id: 'rest-s1', type: 'restroom', name: 'South Restroom', location: { lat: 32.746, lng: -97.094 }, section: 's100', waitTime: 4, predictedWaitTime: 4, trend: 'stable', isOpen: true },
      { id: 'conc-1', type: 'concession', name: 'East Concession', location: { lat: 32.748, lng: -97.093 }, section: 's100', waitTime: 11, predictedWaitTime: 14, trend: 'increasing', isOpen: true },
      { id: 'med-1', type: 'gate', name: 'Gate C (Main)', location: { lat: 32.749, lng: -97.092 }, section: 's100', waitTime: 3, predictedWaitTime: 3, trend: 'stable', isOpen: true },
    ],
  },

  // ── 4. NRG Stadium — Houston, TX ────────────────────────────────────────────
  {
    id: 'nrg-stadium',
    name: 'NRG Stadium',
    city: 'Houston, TX',
    capacity: 72220,
    lat: 29.6847,
    lng: -95.4107,
    imageUrl: '/venue-nrg.jpg',
    riskProfile: {
      climateRisks: ['high_humidity', 'tropical_hurricane', 'flash_flooding', 'heat_illness_risk'],
      transitVulnerabilities: ['METRORail_limited_capacity', 'I-610_loop_congestion', 'flooding_road_closures'],
      heatThresholdF: 98,
    },
    sections: [
      { id: 's100', name: 'Club Level', level: 1, zones: ['zone-a', 'zone-b'] },
      { id: 's200', name: 'Upper Bowl', level: 2, zones: ['zone-c'] },
    ],
    zones: [
      {
        id: 'zone-a', name: 'East Club', capacity: 16000, currentCount: 9600, density: 0.60,
        coordinates: [{ lat: 29.685, lng: -95.410 }, { lat: 29.686, lng: -95.409 }],
        areaM2: 3500, egressWidthM: 12, isStepFree: true, phase: 'circulation',
      },
      {
        id: 'zone-b', name: 'West Club', capacity: 16000, currentCount: 8000, density: 0.50,
        coordinates: [{ lat: 29.684, lng: -95.412 }, { lat: 29.685, lng: -95.411 }],
        areaM2: 3500, egressWidthM: 12, isStepFree: true, phase: 'circulation',
      },
      {
        id: 'zone-c', name: 'Upper Bowl', capacity: 30000, currentCount: 21000, density: 0.70,
        coordinates: [{ lat: 29.683, lng: -95.412 }, { lat: 29.686, lng: -95.409 }],
        areaM2: 6600, egressWidthM: 18, isStepFree: false, phase: 'egress',
      },
    ],
    amenities: [
      { id: 'rest-1', type: 'restroom', name: 'Main Level Restroom', location: { lat: 29.685, lng: -95.410 }, section: 's100', waitTime: 6, predictedWaitTime: 8, trend: 'increasing', isOpen: true },
      { id: 'conc-1', type: 'concession', name: 'Club Concession', location: { lat: 29.685, lng: -95.411 }, section: 's100', waitTime: 5, predictedWaitTime: 5, trend: 'stable', isOpen: true },
    ],
  },

  // ── 5. Hard Rock Stadium — Miami, FL ────────────────────────────────────────
  {
    id: 'hard-rock-stadium',
    name: 'Hard Rock Stadium',
    city: 'Miami Gardens, FL',
    capacity: 65326,
    lat: 25.9580,
    lng: -80.2389,
    imageUrl: '/venue-hardrock.jpg',
    riskProfile: {
      climateRisks: ['coastal_flooding', 'hurricane_risk', 'extreme_humidity', 'thunderstorm'],
      transitVulnerabilities: ['MIA_airport_surge', 'limited_rail_access', 'Dolphin_Expressway_gridlock'],
      heatThresholdF: 95,
    },
    sections: [
      { id: 's100', name: 'Lower Deck', level: 1, zones: ['zone-a', 'zone-b'] },
      { id: 's200', name: 'Club Level', level: 2, zones: ['zone-c'] },
    ],
    zones: [
      {
        id: 'zone-a', name: 'North End Zone', capacity: 12000, currentCount: 7200, density: 0.60,
        coordinates: [{ lat: 25.959, lng: -80.239 }, { lat: 25.960, lng: -80.238 }],
        areaM2: 2600, egressWidthM: 10, isStepFree: true, phase: 'ingress',
      },
      {
        id: 'zone-b', name: 'South End Zone', capacity: 12000, currentCount: 5400, density: 0.45,
        coordinates: [{ lat: 25.957, lng: -80.239 }, { lat: 25.958, lng: -80.238 }],
        areaM2: 2600, egressWidthM: 10, isStepFree: true, phase: 'ingress',
      },
      {
        id: 'zone-c', name: 'Club Level', capacity: 20000, currentCount: 14000, density: 0.70,
        coordinates: [{ lat: 25.957, lng: -80.240 }, { lat: 25.960, lng: -80.238 }],
        areaM2: 4400, egressWidthM: 14, isStepFree: true, phase: 'circulation',
      },
    ],
    amenities: [
      { id: 'rest-1', type: 'restroom', name: 'North Restroom', location: { lat: 25.959, lng: -80.239 }, section: 's100', waitTime: 8, predictedWaitTime: 10, trend: 'increasing', isOpen: true },
      { id: 'conc-1', type: 'concession', name: 'Club Level Bar', location: { lat: 25.958, lng: -80.239 }, section: 's200', waitTime: 9, predictedWaitTime: 7, trend: 'decreasing', isOpen: true },
    ],
  },

  // ── 6. Mercedes-Benz Stadium — Atlanta, GA ───────────────────────────────────
  {
    id: 'mercedes-benz-stadium',
    name: 'Mercedes-Benz Stadium',
    city: 'Atlanta, GA',
    capacity: 71000,
    lat: 33.7553,
    lng: -84.4006,
    imageUrl: '/venue-mb.jpg',
    riskProfile: {
      climateRisks: ['extreme_summer_heat', 'urban_heat_island', 'thunderstorm', 'ice_storm_winter'],
      transitVulnerabilities: ['MARTA_saturation', 'downtown_pedestrian_bottleneck', 'I-20_I-75_interchange'],
      heatThresholdF: 98,
    },
    sections: [
      { id: 's100', name: 'Field Level', level: 1, zones: ['zone-a', 'zone-b'] },
      { id: 's200', name: 'Club Suites', level: 2, zones: ['zone-c'] },
      { id: 's300', name: 'Upper Canopy', level: 3, zones: ['zone-d'] },
    ],
    zones: [
      {
        id: 'zone-a', name: 'Field North', capacity: 10000, currentCount: 8500, density: 0.85,
        coordinates: [{ lat: 33.756, lng: -84.401 }, { lat: 33.757, lng: -84.400 }],
        areaM2: 2200, egressWidthM: 10, isStepFree: true, phase: 'ingress',
      },
      {
        id: 'zone-b', name: 'Field South', capacity: 10000, currentCount: 7000, density: 0.70,
        coordinates: [{ lat: 33.754, lng: -84.401 }, { lat: 33.755, lng: -84.400 }],
        areaM2: 2200, egressWidthM: 10, isStepFree: true, phase: 'ingress',
      },
      {
        id: 'zone-c', name: 'Club Suites', capacity: 15000, currentCount: 4500, density: 0.30,
        coordinates: [{ lat: 33.754, lng: -84.402 }, { lat: 33.757, lng: -84.400 }],
        areaM2: 3300, egressWidthM: 8, isStepFree: true, phase: 'circulation',
      },
      {
        id: 'zone-d', name: 'Upper Canopy', capacity: 22000, currentCount: 17600, density: 0.80,
        coordinates: [{ lat: 33.753, lng: -84.402 }, { lat: 33.757, lng: -84.399 }],
        areaM2: 4900, egressWidthM: 12, isStepFree: false, phase: 'egress',
      },
    ],
    amenities: [
      { id: 'rest-1', type: 'restroom', name: 'Field Restroom A', location: { lat: 33.756, lng: -84.400 }, section: 's100', waitTime: 9, predictedWaitTime: 12, trend: 'increasing', isOpen: true },
      { id: 'conc-1', type: 'concession', name: 'Ponce City Eats', location: { lat: 33.755, lng: -84.401 }, section: 's100', waitTime: 13, predictedWaitTime: 11, trend: 'decreasing', isOpen: true },
      { id: 'med-1', type: 'gate', name: 'Gate 1 (MARTA)', location: { lat: 33.756, lng: -84.402 }, section: 's100', waitTime: 4, predictedWaitTime: 6, trend: 'increasing', isOpen: true },
    ],
  },

  // ── 7. Allegiant Stadium — Las Vegas, NV (kept from original) ───────────────
  {
    id: 'allegiant-stadium',
    name: 'Allegiant Stadium',
    city: 'Las Vegas, NV',
    capacity: 65000,
    lat: 36.0909,
    lng: -115.1833,
    imageUrl: '/venue-allegiant.jpg',
    riskProfile: {
      climateRisks: ['extreme_heat_desert', 'dust_storm', 'flash_flood_risk'],
      transitVulnerabilities: ['Las_Vegas_Blvd_gridlock', 'limited_transit_options'],
      heatThresholdF: 105,
    },
    sections: [
      { id: 's100', name: 'Main Floor', level: 1, zones: ['zone-a'] },
    ],
    zones: [
      {
        id: 'zone-a', name: 'Main Bowl', capacity: 40000, currentCount: 28000, density: 0.70,
        coordinates: [{ lat: 36.091, lng: -115.184 }, { lat: 36.092, lng: -115.182 }],
        areaM2: 8800, egressWidthM: 22, isStepFree: true, phase: 'circulation',
      },
    ],
    amenities: [
      { id: 'rest-1', type: 'restroom', name: 'Central Restroom', location: { lat: 36.091, lng: -115.183 }, section: 's100', waitTime: 9, predictedWaitTime: 11, trend: 'increasing', isOpen: true },
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
