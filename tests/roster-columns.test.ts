import { describe, expect, it } from 'vitest';
import {
  defaultColumnWidths,
  middleEllipsis,
} from '../src/components/admin/participants/rosterColumns';

describe('참가자 명단 열 너비', () => {
  it('넓은 화면에서도 순번과 연락처의 폭은 고정하고 여유 공간은 긴 항목에 배정한다', () => {
    const narrow = defaultColumnWidths(360);
    const wide = defaultColumnWidths(1440);
    expect(wide.number).toBe(narrow.number);
    expect(wide.phone).toBe(narrow.phone);
    expect(wide.department).toBeGreaterThan(narrow.department);
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
