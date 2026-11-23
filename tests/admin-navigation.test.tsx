import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import AdminHeader from '../src/components/admin/AdminHeader';
import AdminSidebar from '../src/components/admin/AdminSidebar';

vi.mock('../src/auth', () => ({ useAuth: () => ({ logout: vi.fn() }) }));

it('공개 홈과 로그아웃은 상단에서, 관리자 업무는 왼쪽 메뉴에서 연다', () => {
  const render = (element: React.ReactElement) =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={['/admin/participants']}>{element}</MemoryRouter>,
    );
  const header = render(<AdminHeader />);
  const sidebar = render(<AdminSidebar />);

  const headerActions = header.match(/<header\b[^>]*>([\s\S]*?)<\/header>/)?.[1] ?? '';
  expect(headerActions.match(/<(?:a|button)\b/g)).toHaveLength(2);
  expect(headerActions).toContain('href="/"');
  expect(headerActions).toContain('메인 홈');
  expect(headerActions).toContain('로그아웃');
  expect(sidebar).not.toContain('href="/"');
  expect(sidebar).not.toContain('화면 이동');
  expect(sidebar).not.toContain('사용자 화면 보기');
  expect(sidebar).toContain('참가·기록');
  expect(sidebar).toContain('운영 관리');
  expect(sidebar).toContain('분석');
  expect(sidebar).toContain('aria-current="page"');
  expect(sidebar).toContain('href="/admin/participants"');
});
