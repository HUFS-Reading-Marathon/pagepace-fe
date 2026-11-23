import { describe, expect, it } from 'vitest';
import {
  CHECK_WIDTH,
  defaultColumnWidths,
  middleEllipsis,
} from '../src/components/admin/participants/rosterColumns';

describe('참가자 명단 열 너비', () => {
  it('넓은 화면의 여유 공간이 짧은 이름이나 소속에 몰리지 않는다', () => {
    const narrow = defaultColumnWidths(390);
    const wide = defaultColumnWidths(1440);
    expect(wide.name).toBe(96);
    expect(wide.department).toBe(164);
    expect(wide.number).toBe(narrow.number);
    expect(narrow.phone).toBeGreaterThanOrEqual(124);
    expect(defaultColumnWidths(2200)).toEqual(wide);
    const intermediate = defaultColumnWidths(931);
    expect(CHECK_WIDTH + Object.values(intermediate).reduce((sum, value) => sum + value, 0)).toBe(
      931,
    );
    expect(intermediate.name).toBeGreaterThan(narrow.name);
    expect(intermediate.name).toBeLessThan(wide.name);
  });
  it('양쪽 끝을 남기고 실제 글자 너비를 기준으로 중간만 생략한다', () => {
    const measure = (text: string) => Array.from(text).reduce((n, c) => n + (c === 'W' ? 3 : 1), 0);
    expect(middleEllipsis('WWabcXYZ', 8, measure)).toBe('WW…Z');
    const text = '국제금융경영학과';
    expect(middleEllipsis(text, 5, (s) => s.length)).toBe('국제…학과');
    expect(middleEllipsis(text, 16, (s) => s.length)).toBe(text);
  });
  it('결합 문자를 자르지 않는다', () => {
    const text = '👨‍👩‍👦의 교육과정 담당자';
    const size = (s: string) => Array.from(new Intl.Segmenter('ko').segment(s)).length;
    expect(middleEllipsis(text, 3, size)).toBe('👨‍👩‍👦…자');
  });
});
