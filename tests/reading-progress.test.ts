import { describe, expect, it } from 'vitest';
import { getProgressPercent, getProgressRate } from '../src/utils/reading';

describe('달성률 계산', () => {
  it('메인페이지 나의 기록 카드는 main과 같이 정수 %로 표시하고 100을 넘지 않는다', () => {
    expect(getProgressRate(12_345, 42_195)).toBe(29);
    expect(getProgressRate(50_000, 42_195)).toBe(100);
  });

  it('세부 화면용 달성률은 소수 첫째 자리까지 계산하고 목표 전에는 100%로 올림하지 않는다', () => {
    expect(getProgressPercent(12_345, 42_195)).toBe(29.3);
    expect(getProgressPercent(42_190, 42_195)).toBe(99.9);
    expect(getProgressPercent(50_000, 42_195)).toBe(118.5);
    expect(getProgressPercent(100, 0)).toBe(0);
  });
});
