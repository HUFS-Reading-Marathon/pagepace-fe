import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import MyRecordDashboard from '../src/components/main/MyRecordDashboard';
import type { MyRecordSummary } from '../src/pages/main/mainPageContent';
import { formatDistance, formatPreciseDistance, getProgressRate } from '../src/utils/reading';

// origin/main(8b8ac7f) src/utils/reading.ts의 구현을 그대로 옮긴 기준값입니다.
const mainFormatDistance = (distance: number) =>
  distance >= 1000 ? `${(distance / 1000).toFixed(2)}km` : `${distance.toLocaleString()}m`;
const mainProgressRate = (total: number, target: number) =>
  Math.min(Math.round((total / target) * 100), 100);

const record = (patch: Partial<MyRecordSummary> = {}): MyRecordSummary => ({
  course: '하프 코스',
  targetDistance: 21_095,
  totalDistance: 1_005,
  totalPages: 201,
  approvedLogs: 3,
  lastSubmittedAt: '2026. 11. 20.',
  ...patch,
});

describe('메인페이지 나의 기록 카드 (main 기준 유지)', () => {
  it('거리·달성률 계산이 main 구현과 5m 단위 전 구간에서 같다', () => {
    for (let distance = 0; distance <= 60_000; distance += 5) {
      expect(formatDistance(distance)).toBe(mainFormatDistance(distance));
      expect(getProgressRate(distance, 42_195)).toBe(mainProgressRate(distance, 42_195));
    }
  });

  it('카드는 main과 같은 거리 문구와 100% 이하 달성률을 보여 준다', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <MyRecordDashboard record={record({ totalDistance: 25_000 })} />
      </MemoryRouter>,
    );
    expect(html).toContain(`<strong>${mainFormatDistance(25_000)}</strong>`);
    expect(html).toContain(`목표 거리 ${mainFormatDistance(21_095)} 중 100% 달성했습니다.`);
    expect(html).toContain('width:100%');
    expect(html).toContain('<dt>인정 페이지</dt><dd>201쪽</dd>');
  });

  it('정밀 거리 표시는 신규 화면용 함수로만 제공한다', () => {
    expect(formatDistance(1_005)).toBe(mainFormatDistance(1_005));
    expect(formatPreciseDistance(1_005)).toBe('1.005km');
    expect(formatPreciseDistance(1_010)).toBe('1.01km');
  });
});
