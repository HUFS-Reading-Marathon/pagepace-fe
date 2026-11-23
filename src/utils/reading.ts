import { METERS_PER_PAGE } from '../constants/reading';

export function formatDistance(distance: number) {
  if (distance < 1000) return `${distance.toLocaleString()}m`;
  return `${(distance / 1000).toFixed(distance % 10 === 0 ? 2 : 3)}km`;
}

export function getProgressRate(totalDistance: number, targetDistance: number) {
  if (targetDistance <= 0 || totalDistance <= 0) return 0;
  const rate = Math.round((totalDistance * 1000) / targetDistance) / 10;
  return totalDistance < targetDistance ? Math.min(rate, 99.9) : rate;
}

export function getCreditedPages(distance: number) {
  return Math.floor(distance / METERS_PER_PAGE);
}
