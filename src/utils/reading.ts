export function formatDistance(distance: number) {
  return distance >= 1000
    ? `${(distance / 1000).toFixed(2)}km`
    : `${distance.toLocaleString()}m`;
}

export function getProgressRate(totalDistance: number, targetDistance: number) {
  return Math.min(Math.round((totalDistance / targetDistance) * 100), 100);
}