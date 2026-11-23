import { describe, expect, it } from 'vitest';
import { defaultColumnWidths } from '../src/components/admin/participants/rosterColumns';
import { CHECK_WIDTH } from '../src/components/admin/table/tableColumns';
import { middleEllipsis } from '../src/components/admin/table/useTableCellText';

describe('참가자 명단 열 너비', () => {
  it('작은 화면은 가로 스크롤에 필요한 최소 열 너비를 유지한다', () => {
    const compact = defaultColumnWidths(390);
    expect(defaultColumnWidths(826)).toEqual(compact);
    expect(compact).toMatchObject({ number: 44, name: 84, department: 128, phone: 124 });
    expect(defaultColumnWidths(1040)).toMatchObject({ name: 96, department: 164, phone: 156 });
  });
  it('전체 너비를 여러 열에 나누고 순번과 체크박스 간격을 유지한다', () => {
    const desktop = defaultColumnWidths(1040);
    for (const viewport of [826, 827, 931, 1039, 1040, 1041, 1277, 1440, 1920, 2559]) {
      const widths = defaultColumnWidths(viewport);
      expect(CHECK_WIDTH + Object.values(widths).reduce((sum, value) => sum + value, 0)).toBe(
        viewport,
      );
      expect(widths.number).toBe(desktop.number);
    }
    const wide = defaultColumnWidths(1440);
    const added = 1440 - 1040;
    expect(wide.name - desktop.name).toBeLessThan(added / 10);
    for (const key of Object.keys(desktop) as Array<keyof typeof desktop>) {
      expect(wide[key] - desktop[key]).toBeLessThan(added / 5);
      if (key !== 'number') expect(wide[key]).toBeGreaterThan(desktop[key]);
    }
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
