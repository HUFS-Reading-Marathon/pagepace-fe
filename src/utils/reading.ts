import { METERS_PER_PAGE } from '../constants/reading';

/** 메인페이지 "나의 기록" 카드용 거리 표시: 1km 이상은 소수 둘째 자리 (main 기준 동작 유지) */
export function formatDistance(distance: number) {
  return distance >= 1000 ? `${(distance / 1000).toFixed(2)}km` : `${distance.toLocaleString()}m`;
}

/** 5m 단위까지 드러나는 거리 표시: 10m 단위가 아니면 소수 셋째 자리까지 씁니다. */
export function formatPreciseDistance(distance: number) {
  if (distance < 1000) return `${distance.toLocaleString()}m`;
  return `${(distance / 1000).toFixed(distance % 10 === 0 ? 2 : 3)}km`;
}

/** 메인페이지 "나의 기록" 카드용 달성률: 정수 %, 최대 100 (main 기준 동작 유지) */
export function getProgressRate(totalDistance: number, targetDistance: number) {
  return Math.min(Math.round((totalDistance / targetDistance) * 100), 100);
}

/** 소수 첫째 자리 달성률. 목표 전에는 99.9%를 넘기지 않고, 목표를 넘으면 100% 이상을 그대로 돌려줍니다. */
export function getProgressPercent(totalDistance: number, targetDistance: number) {
  if (targetDistance <= 0 || totalDistance <= 0) return 0;
  const rate = Math.round((totalDistance * 1000) / targetDistance) / 10;
  return totalDistance < targetDistance ? Math.min(rate, 99.9) : rate;
}

export function getCreditedPages(distance: number) {
  return Math.floor(distance / METERS_PER_PAGE);
}
