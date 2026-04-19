/**
 * formatters.ts — Central data formatting utilities for VenueFlow
 * All numbers from Firebase RTDB pass through these before display.
 */

/** Format a crowd count. Always en-US locale to prevent SSR/client mismatch. */
export function fmtCount(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('en-US');
}

/** Format a 0–1 density float as a percentage string e.g. "67%" */
export function fmtPct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;
}

/** Format a wait time in minutes */
export function fmtWait(minutes: number | null | undefined): string {
  if (minutes == null || isNaN(minutes)) return '—';
  if (minutes <= 0) return 'No wait';
  if (minutes < 2) return '< 2 min';
  return `${Math.round(minutes)} min`;
}

/** Human-readable density label */
export function fmtDensityLabel(n: number | null | undefined): 'Low' | 'Moderate' | 'High' | '—' {
  if (n == null || isNaN(n)) return '—';
  if (n < 0.3) return 'Low';
  if (n < 0.7) return 'Moderate';
  return 'High';
}

/** Density color — matches existing getDensityColor but handles null */
export function fmtDensityColor(n: number | null | undefined): string {
  if (n == null) return 'var(--text-3)';
  if (n < 0.3) return '#10B981';
  if (n < 0.7) return '#F59E0B';
  return '#EF4444';
}

/** Format a timestamp to a relative "X min ago" string */
export function fmtTimeAgo(ts: number | null | undefined): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

/** Capitalise first letter */
export function fmtCapitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
