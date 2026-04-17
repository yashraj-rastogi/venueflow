// ============ VenueFlow Core Types ============

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
}

export interface Zone {
  id: string;
  name: string;
  capacity: number;
  currentCount: number;
  density: number; // 0–1
  coordinates: LatLng[];
  color?: string;
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
  type: 'fastest' | 'least_crowded';
  waypoints: LatLng[];
  estimatedTime: number; // minutes
  crowdLevel: 'low' | 'medium' | 'high';
  instructions: string[];
}

export interface NavigationRequest {
  start: string; // section ID
  destination: string; // amenity ID or exit
  preference: 'fastest' | 'least_crowded';
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
