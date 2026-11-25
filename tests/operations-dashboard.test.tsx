import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import AdminOperationsDashboardPage from '../src/pages/admin/AdminOperationsDashboardPage';

it('운영 현황 업무 카드는 카드 전체가 처리 대기 목록 링크이고, 불러오는 중에는 0건으로 보이지 않는다', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/admin']}>
      <AdminOperationsDashboardPage />
    </MemoryRouter>,
  );

  expect(html).toContain('처리가 필요한 참가신청·독서일지·서평을 확인할 수 있습니다.');
  expect(html).not.toContain('오래 기다린');

  const cards = [
    ...html.matchAll(/<a\b[^>]*class="admin-operations__queue"[^>]*>([\s\S]*?)<\/a>/g),
  ];
  expect(cards).toHaveLength(3);
  expect(cards.map((card) => card[0].match(/href="([^"]+)"/)?.[1])).toEqual([
    '/admin/participants?status=APPLIED',
    '/admin/logs',
    '/admin/reviews?tab=manual',
  ]);
  for (const [card, inner] of cards) {
    expect(card).toContain('aria-busy="true"');
    expect(card).toMatch(/aria-label="0[123] [^"]+, 건수를 불러오는 중"/);
    // 카드 안에 다른 링크·버튼을 겹쳐 두지 않습니다.
    expect(inner).not.toMatch(/<(a|button)\b/);
    expect(inner).not.toContain('0<small>건</small>');
  }
  // 미리보기 목록·외 N건·대기 일수·하단 버튼을 두지 않습니다.
  expect(html).not.toMatch(/queue-(row|list|more|action)|가장 오래 대기|외 \d+건/);
});
