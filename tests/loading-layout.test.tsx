import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import MyReadingLogsPage from '../src/pages/logs/MyReadingLogsPage';
import NoticesPage from '../src/pages/notices/NoticesPage';
import ReadingLogWritePage from '../src/pages/logs/ReadingLogWritePage';
import NoticeDetailPage from '../src/pages/notices/NoticeDetailPage';

vi.mock('../src/auth', () => ({ useAuth: () => ({ user: null }) }));

it('최초 조회 중에도 화면 제목과 탐색 요소를 유지하고 영역에 맞게 자리를 확보한다', () => {
  for (const [page, anchor, shape] of [
    [<MyReadingLogsPage />, '나의 서재', 'metrics'],
    [<NoticesPage />, '공지사항 제목 검색', 'row'],
    [<ReadingLogWritePage />, '독서일지 작성', 'field'],
    [<NoticeDetailPage />, '공지사항 목록', 'block'],
  ] as const) {
    const html = renderToStaticMarkup(<MemoryRouter>{page}</MemoryRouter>);
    expect(html).toContain(anchor);
    expect(html).toContain('role="status"');
    expect(html).toContain('content-skeleton__layout" aria-hidden="true"');
    expect(html).toContain('content-skeleton__' + shape);
  }
});
