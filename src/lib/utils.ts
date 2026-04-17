import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DensityLevel } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

export function getDensityBg(density: number): string {
  if (density < 0.3) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (density < 0.7) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  return 'bg-red-500/20 text-red-400 border-red-500/30';
}

export function formatWaitTime(minutes: number): string {
  if (minutes === 0) return 'No wait';
  if (minutes < 2) return '< 2 min';
  return `${minutes} min`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}

export function getTrendIcon(trend: 'increasing' | 'stable' | 'decreasing'): string {
  return trend === 'increasing' ? '↑' : trend === 'decreasing' ? '↓' : '→';
}

export function getTrendColor(trend: 'increasing' | 'stable' | 'decreasing'): string {
  return trend === 'increasing' ? 'text-red-400' : trend === 'decreasing' ? 'text-emerald-400' : 'text-blue-400';
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}
