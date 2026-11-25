import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import AdminHeader from '../src/components/admin/AdminHeader';
import AdminSidebar from '../src/components/admin/AdminSidebar';
import AdminLayout from '../src/layouts/AdminLayout';
import {
  ADMIN_SIDEBAR_STORAGE_KEY,
  readSidebarCollapsed,
  saveSidebarCollapsed,
} from '../src/layouts/adminSidebarState';
import { Route, Routes } from 'react-router-dom';

vi.mock('../src/auth', () => ({ useAuth: () => ({ logout: vi.fn() }) }));

it('네이비 상단 바 한 줄에 도서관 홈·메인 홈·로그아웃을, 관리자 업무는 왼쪽 메뉴에 둔다', () => {
  const render = (element: React.ReactElement) =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={['/admin/participants']}>{element}</MemoryRouter>,
    );
  const header = render(<AdminHeader sidebarCollapsed={false} onToggleSidebar={() => {}} />);
  const sidebar = render(<AdminSidebar />);

  // 헤더는 네이비 상단 바 하나뿐이며, 본문 바로가기 링크를 유지합니다.
  expect(header.match(/<header\b/g)).toHaveLength(1);
  expect(header).toContain('class="topbar admin-topbar"');
  expect(header).toContain('href="#admin-main"');
  expect(header).toContain('Hankuk University of Foreign Studies · Global Campus Library');

  const menu = header.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? '';
  expect(menu.match(/<(?:a|button)\b/g)).toHaveLength(3);
  expect(menu).toContain('href="https://lib.hufs.ac.kr/global/"');
  expect(menu).toContain('도서관 홈');
  expect(menu).toMatch(/<a\b[^>]*href="\/"[^>]*>메인 홈<\/a>/);
  expect(menu).toMatch(/<button\b[^>]*>[\s\S]*로그아웃<\/button>/);

  // 제거한 요소: 두 번째 흰색 헤더, 학교 홈페이지·문의 링크, 계정 메뉴
  expect(header).not.toContain('site-header');
  expect(header).not.toContain('독서마라톤 관리자');
  expect(header).not.toContain('학교 홈페이지');
  expect(header).not.toContain('/#contact');
  expect(header).not.toContain('aria-haspopup');

  expect(sidebar).not.toContain('href="/"');
  expect(sidebar).not.toContain('화면 이동');
  expect(sidebar).not.toContain('사용자 화면 보기');
  expect(sidebar).toContain('참가·기록');
  expect(sidebar).toContain('운영 관리');
  expect(sidebar).toContain('분석');
  expect(sidebar).toContain('aria-current="page"');
  expect(sidebar).toContain('href="/admin/participants"');
});

afterEach(() => vi.unstubAllGlobals());

function stubStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  return values;
}

it('사이드바 접기 버튼은 상태에 맞는 이름과 aria-expanded·aria-controls를 가진다', () => {
  const render = (collapsed: boolean) =>
    renderToStaticMarkup(
      <MemoryRouter>
        <AdminHeader sidebarCollapsed={collapsed} onToggleSidebar={() => {}} />
      </MemoryRouter>,
    );
  const open = render(false);
  expect(open).toContain('aria-label="관리자 메뉴 접기"');
  expect(open).toContain('aria-expanded="true"');
  expect(open).toContain('aria-controls="admin-sidebar"');
  const closed = render(true);
  expect(closed).toContain('aria-label="관리자 메뉴 펼치기"');
  expect(closed).toContain('aria-expanded="false"');
});

it('접힌 사이드바는 inert라 안의 링크에 포커스가 가지 않고, 활성 메뉴의 aria-current는 유지된다', () => {
  const render = (hidden: boolean) =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={['/admin/logs']}>
        <AdminSidebar id="admin-sidebar" hidden={hidden} />
      </MemoryRouter>,
    );
  expect(render(false)).not.toContain('inert');
  const hidden = render(true);
  expect(hidden).toMatch(/<aside id="admin-sidebar" class="admin-sidebar" inert="">/);
  expect(hidden).toMatch(
    /aria-current="page"[^>]*href="\/admin\/logs"|href="\/admin\/logs"[^>]*aria-current="page"/,
  );
});

it('사이드바 접힘 상태는 관리자 전용 키에 저장되고, 처음 방문하면 펼친 상태다', () => {
  const values = stubStorage();
  expect(readSidebarCollapsed()).toBe(false);
  saveSidebarCollapsed(true);
  expect(values.get(ADMIN_SIDEBAR_STORAGE_KEY)).toBe('true');
  expect(values.get('pagepaceAccessToken')).toBeUndefined();
  expect(readSidebarCollapsed()).toBe(true);

  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('blocked');
    },
  });
  expect(readSidebarCollapsed()).toBe(false);
});

it('저장된 접힘 상태로 관리자 레이아웃을 열면 사이드바가 접힌 채로 그려진다', () => {
  stubStorage({ [ADMIN_SIDEBAR_STORAGE_KEY]: 'true' });
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<p>본문</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  expect(html).toContain('class="admin-layout admin-layout--sidebar-collapsed"');
  expect(html).toContain('inert=""');
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain('<p>본문</p>');
});

it('사이드바 접기 버튼은 상단 바 맨 왼쪽(.wrap 밖)에 있고, 두 문구를 겹쳐 두어 현재 상태 문구만 보인다', () => {
  const render = (collapsed: boolean) =>
    renderToStaticMarkup(
      <MemoryRouter>
        <AdminHeader sidebarCollapsed={collapsed} onToggleSidebar={() => {}} />
      </MemoryRouter>,
    );
  const open = render(false);
  // 버튼이 제목·링크를 담은 가운데 정렬 컨테이너보다 앞, 그 바깥에 있습니다.
  expect(open).toMatch(
    /<div class="admin-topbar__bar"><button id="admin-sidebar-toggle"[\s\S]*?<\/button><div class="wrap topbar-inner admin-topbar__inner">/,
  );
  expect(open).toContain('<span data-active="true">메뉴 접기</span><span>메뉴 펼치기</span>');
  expect(render(true)).toContain(
    '<span>메뉴 접기</span><span data-active="true">메뉴 펼치기</span>',
  );
});

it('그룹 제목은 행 전체가 버튼이고 aria-controls로 메뉴 묶음을 가리키며, 열린 그룹은 inert가 아니다', () => {
  const render = (collapsibleGroups: boolean) =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={['/admin/logs']}>
        <AdminSidebar collapsibleGroups={collapsibleGroups} />
      </MemoryRouter>,
    );
  const html = render(true);
  const buttons = [
    ...html.matchAll(/<button[^>]*aria-controls="([^"]+)"[^>]*><span>([^<]+)<\/span>/g),
  ];
  expect(buttons.map((match) => match[2])).toEqual(['참가·기록', '운영 관리', '분석']);
  for (const [, panelId] of buttons) {
    expect(html).toContain(`id="${panelId}" class="admin-sidebar__panel" data-open="true"`);
  }
  expect(html).not.toContain('inert');
  // 메뉴 이름·순서는 그대로입니다(도서 확인 요청은 문의·FAQ 관리의 도서 문의 탭으로 통합).
  expect(
    [...html.matchAll(/class="admin-sidebar__link[^"]*"[^>]*>([^<]+)</g)].map((m) => m[1]),
  ).toEqual([
    '운영 현황',
    '참가자 관리',
    '독서일지 검토',
    '서평 확인',
    '행사/코스 설정',
    '대회 현황·랭킹',
    '공지사항 관리',
    '문의·FAQ 관리',
    '결과 보고서',
    '운영 통계',
  ]);
});
