import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import Footer from '../src/components/layout/Footer';
import Header from '../src/components/layout/Header';

vi.mock('../src/auth', () => ({
  useAuth: () => ({ user: null, isAuthenticated: false, isInitializing: false, logout: vi.fn() }),
  isAdminRole: () => false,
}));

const render = (path: string, element: React.ReactElement = <Header />) =>
  renderToStaticMarkup(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);
const mainNav = (html: string) => html.match(/<nav class="global-nav"[^>]*>([\s\S]*?)<\/nav>/)![1];

it('주메뉴는 메뉴명·순서를 그대로 두고 독립 페이지로 이동한다', () => {
  const links = [...mainNav(render('/')).matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
    .slice(0, 5)
    .map((match) => `${match[2]} ${match[1]}`);
  expect(links).toEqual([
    '행사안내 /about',
    '코스 및 혜택 /courses',
    '참여방법 /guide',
    '공지사항 /notices',
    '대회 현황 /status',
  ]);
});

it('현재 경로로 활성 메뉴를 정하고, 공지 상세에서도 공지사항을 활성화한다', () => {
  const active = (path: string) =>
    [...mainNav(render(path)).matchAll(/aria-current="page"[^>]*>([^<]+)</g)].map(
      (match) => match[1],
    );
  expect(active('/')).toEqual([]);
  expect(active('/about')).toEqual(['행사안내']);
  expect(active('/courses')).toEqual(['코스 및 혜택']);
  expect(active('/guide')).toEqual(['참여방법']);
  expect(active('/notices')).toEqual(['공지사항']);
  expect(active('/notices/3')).toEqual(['공지사항']);
  expect(active('/status')).toEqual(['대회 현황']);
});

it('상단 문의 링크와 푸터 문의는 기존 /#contact를 유지하고, 푸터 안내 링크는 독립 페이지로 간다', () => {
  expect(render('/')).toContain('href="/#contact"');
  const footer = render('/', <Footer />);
  for (const href of ['/about', '/courses', '/guide', '/status', '/#contact'])
    expect(footer).toContain(`href="${href}"`);
});
