/**
 * weatherService.ts — OpenWeatherMap climate risk integration
 *
 * Checks live weather for venue location every 30 minutes during events.
 * Automatically pushes venue-specific alerts based on climate risk profiles
 * defined in VenueRiskProfile (e.g. Dallas triggers at 100°F, Houston at thunderstorm).
 *
 * env: OPENWEATHERMAP_API_KEY=your_key_here
 */

import { Venue, WeatherAlert } from '@/types';
import { computeWeatherRisk } from '@/lib/crowdEngine';

const OWM_BASE = 'https://api.openweathermap.org/data/2.5';
const API_KEY  = process.env.OPENWEATHERMAP_API_KEY ?? '';

// ── OpenWeatherMap response types ─────────────────────────────────────────────

interface OWMResponse {
  weather: { id: number; main: string; description: string }[];
  main   : { temp: number; feels_like: number; humidity: number };
  wind   : { speed: number };
  name   : string;
}

// ── Kelvin → Fahrenheit ───────────────────────────────────────────────────────

function kelvinToF(k: number): number {
  return (k - 273.15) * 9 / 5 + 32;
}

// ── Fetch current weather for a venue ────────────────────────────────────────

export async function fetchVenueWeather(venue: Venue): Promise<OWMResponse | null> {
  if (!API_KEY) {
    console.info('[Weather] No API key — weather alerts disabled');
    return null;
  }

  try {
    const url = `${OWM_BASE}/weather?lat=${venue.lat}&lon=${venue.lng}&appid=${API_KEY}`;
    const res  = await fetch(url, { next: { revalidate: 1800 } }); // 30-min cache
    if (!res.ok) return null;
    return await res.json() as OWMResponse;
  } catch {
    return null;
  }
}

// ── Build alerts from weather data ───────────────────────────────────────────

export function buildWeatherAlerts(venue: Venue, weather: OWMResponse): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  const tempF       = kelvinToF(weather.main.temp);
  const weatherCode = weather.weather[0]?.id ?? 800;
  const now         = Date.now();
  const ONE_HOUR    = 3_600_000;

  // Extreme heat — uses venue-specific threshold from risk profile
  const heatThreshold = venue.riskProfile?.heatThresholdF ?? 100;
  if (tempF >= heatThreshold) {
    alerts.push({
      id       : `heat-${venue.id}-${now}`,
      venueId  : venue.id,
      type     : 'extreme_heat',
      severity : tempF >= 105 ? 'emergency' : tempF >= 100 ? 'warning' : 'watch',
      message  : `🌡️ Extreme heat at ${venue.name}: ${Math.round(tempF)}°F. Activate cooling stations and increase hydration distribution.`,
      tempF,
      issuedAt : now,
      expiresAt: now + ONE_HOUR * 3,
    });
  }

  // Thunderstorm (weather code 200–232)
  if (weatherCode >= 200 && weatherCode < 300) {
    alerts.push({
      id       : `storm-${venue.id}-${now}`,
      venueId  : venue.id,
      type     : 'thunderstorm',
      severity : 'warning',
      message  : `⛈️ Thunderstorm warning at ${venue.name}. Activate lightning delay protocol. Clear outdoor areas immediately.`,
      issuedAt : now,
      expiresAt: now + ONE_HOUR * 2,
    });
  }

  // Heavy rain (code 502+)
  if (weatherCode >= 502 && weatherCode < 600) {
    alerts.push({
      id       : `rain-${venue.id}-${now}`,
      venueId  : venue.id,
      type     : 'flooding',
      severity : 'advisory',
      message  : `🌧️ Heavy rain at ${venue.name}. Monitor drainage in lower concourse zones. Slippery surface alert.`,
      issuedAt : now,
      expiresAt: now + ONE_HOUR,
    });
  }

  // High winds (>35 mph = 15.6 m/s)
  if (weather.wind.speed > 15.6) {
    alerts.push({
      id       : `wind-${venue.id}-${now}`,
      venueId  : venue.id,
      type     : 'thunderstorm',
      severity : 'watch',
      message  : `💨 High wind advisory at ${venue.name}: ${Math.round(weather.wind.speed * 2.237)} mph. Secure banners and check outdoor structures.`,
      issuedAt : now,
      expiresAt: now + ONE_HOUR,
    });
  }

  return alerts;
}

// ── Combined check: fetch + build + return weather risk factor ────────────────

export async function checkVenueWeather(venue: Venue): Promise<{
  alerts      : WeatherAlert[];
  riskFactor  : number;
  tempF       : number | null;
}> {
  const weather = await fetchVenueWeather(venue);
  if (!weather) return { alerts: [], riskFactor: 0, tempF: null };

  const tempF      = kelvinToF(weather.main.temp);
  const weatherCode = weather.weather[0]?.id ?? 800;
  const riskFactor  = computeWeatherRisk(tempF, weatherCode);
  const alerts      = buildWeatherAlerts(venue, weather);

  return { alerts, riskFactor, tempF };
}
