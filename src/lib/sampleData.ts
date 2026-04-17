import { Venue, CrowdSnapshot, Notification } from '@/types';

export const SAMPLE_VENUES: Venue[] = [
  {
    id: 'metlife-stadium',
    name: 'MetLife Stadium',
    city: 'East Rutherford, NJ',
    capacity: 82500,
    lat: 40.8135,
    lng: -74.0745,
    imageUrl: '/venue-metlife.jpg',
    sections: [
      { id: 's100', name: 'Section 100', level: 1, zones: ['zone-a', 'zone-b'] },
      { id: 's200', name: 'Section 200', level: 2, zones: ['zone-c', 'zone-d'] },
      { id: 's300', name: 'Section 300', level: 3, zones: ['zone-e'] },
    ],
    zones: [
      { id: 'zone-a', name: 'North Lower', capacity: 8000, currentCount: 6800, density: 0.85, coordinates: [{ lat: 40.815, lng: -74.075 }, { lat: 40.816, lng: -74.073 }] },
      { id: 'zone-b', name: 'South Lower', capacity: 8000, currentCount: 4200, density: 0.53, coordinates: [{ lat: 40.812, lng: -74.075 }, { lat: 40.813, lng: -74.073 }] },
      { id: 'zone-c', name: 'East Club', capacity: 6000, currentCount: 1400, density: 0.23, coordinates: [{ lat: 40.814, lng: -74.072 }, { lat: 40.815, lng: -74.071 }] },
      { id: 'zone-d', name: 'West Club', capacity: 6000, currentCount: 3200, density: 0.53, coordinates: [{ lat: 40.814, lng: -74.077 }, { lat: 40.815, lng: -74.076 }] },
      { id: 'zone-e', name: 'Upper Deck', capacity: 12000, currentCount: 9800, density: 0.82, coordinates: [{ lat: 40.813, lng: -74.076 }, { lat: 40.815, lng: -74.073 }] },
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
  {
    id: 'sofi-stadium',
    name: 'SoFi Stadium',
    city: 'Inglewood, CA',
    capacity: 70000,
    lat: 33.9535,
    lng: -118.3392,
    imageUrl: '/venue-sofi.jpg',
    sections: [
      { id: 's100', name: 'Section 100', level: 1, zones: ['zone-a'] },
      { id: 's200', name: 'Section 200', level: 2, zones: ['zone-b'] },
    ],
    zones: [
      { id: 'zone-a', name: 'Lower Bowl', capacity: 25000, currentCount: 12000, density: 0.48, coordinates: [] },
      { id: 'zone-b', name: 'Upper Deck', capacity: 20000, currentCount: 6000, density: 0.3, coordinates: [] },
    ],
    amenities: [
      { id: 'rest-1', type: 'restroom', name: 'Main Restroom', location: { lat: 33.953, lng: -118.339 }, section: 's100', waitTime: 4, predictedWaitTime: 4, trend: 'stable', isOpen: true },
      { id: 'conc-1', type: 'concession', name: 'Food Court 1', location: { lat: 33.954, lng: -118.34 }, section: 's100', waitTime: 6, predictedWaitTime: 5, trend: 'decreasing', isOpen: true },
    ],
  },
  {
    id: 'allegiant-stadium',
    name: 'Allegiant Stadium',
    city: 'Las Vegas, NV',
    capacity: 65000,
    lat: 36.0909,
    lng: -115.1833,
    imageUrl: '/venue-allegiant.jpg',
    sections: [
      { id: 's100', name: 'Main Floor', level: 1, zones: ['zone-a'] },
    ],
    zones: [
      { id: 'zone-a', name: 'Main Bowl', capacity: 40000, currentCount: 28000, density: 0.7, coordinates: [] },
    ],
    amenities: [
      { id: 'rest-1', type: 'restroom', name: 'Central Restroom', location: { lat: 36.091, lng: -115.183 }, section: 's100', waitTime: 9, predictedWaitTime: 11, trend: 'increasing', isOpen: true },
    ],
  },
];

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

export const SAMPLE_NOTIFICATIONS: Notification[] = [
  { id: 'n1', type: 'warning', title: 'High Congestion Alert', message: 'North Lower (Zone A) is at 85% capacity. Consider using South entrance.', timestamp: Date.now() - 120000, section: 's100', read: false },
  { id: 'n2', type: 'success', title: 'Wait Time Dropped', message: 'North Restroom A wait time dropped to 5 minutes — now the shortest in the venue.', timestamp: Date.now() - 240000, read: false },
  { id: 'n3', type: 'info', title: 'Halftime Rush Starting', message: 'Halftime begins in 5 minutes. Concession wait times will increase temporarily.', timestamp: Date.now() - 300000, read: true },
  { id: 'n4', type: 'emergency', title: 'Gate B Delay', message: 'Gate B experiencing delays due to security check. Use Gate A or Gate C.', timestamp: Date.now() - 600000, read: true },
];

// Simulate real-time crowd data updates
export function simulateCrowdUpdate(snapshot: CrowdSnapshot): CrowdSnapshot {
  const updated = { ...snapshot, timestamp: Date.now(), zones: { ...snapshot.zones } };
  for (const zoneId in updated.zones) {
    const zone = { ...updated.zones[zoneId] };
    const delta = (Math.random() - 0.5) * 0.05;
    zone.density = Math.max(0.1, Math.min(0.99, zone.density + delta));
    zone.count = Math.round(zone.density * zone.capacity);
    updated.zones[zoneId] = zone;
  }
  updated.totalCount = Object.values(updated.zones).reduce((s, z) => s + z.count, 0);
  return updated;
}
