import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import AdminHeader from '../src/components/admin/AdminHeader';
import AdminSidebar from '../src/components/admin/AdminSidebar';

vi.mock('../src/auth', () => ({ useAuth: () => ({ logout: vi.fn() }) }));

it('상단에는 도서관 바로가기와 관리자 계정·로그아웃을, 관리자 업무는 왼쪽 메뉴에 둔다', () => {
  // 헤더는 저장된 로그인 아이디를 계정 버튼에 표시합니다.
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (key === 'loginId' ? 'libadmin' : null),
  });
  const render = (element: React.ReactElement) =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={['/admin/participants']}>{element}</MemoryRouter>,
    );
  const header = render(<AdminHeader />);
  const sidebar = render(<AdminSidebar />);

  // 네이비 상단 바: 도서관 홈·학교 홈페이지·메인페이지 문의 앵커
  expect(header).toContain('Hankuk University of Foreign Studies · Global Campus Library');
  expect(header).toContain('href="https://lib.hufs.ac.kr/global/"');
  expect(header).toContain('href="https://www.hufs.ac.kr/"');
  expect(header).toContain('href="/#contact"');

  // 흰색 관리자 헤더: 대시보드로 가는 제목, 계정 메뉴 버튼, 로그아웃 아이콘 버튼
  const adminHeader = header.match(/<header\b[^>]*>([\s\S]*?)<\/header>/)?.[1] ?? '';
  expect(adminHeader).toContain('href="/admin"');
  expect(adminHeader).toContain('독서마라톤 관리자');
  expect(adminHeader).toContain('aria-haspopup="dialog"');
  expect(adminHeader).toContain('aria-expanded="false"');
  expect(adminHeader).toContain('libadmin');
  expect(adminHeader).toContain('aria-label="관리자 계정 로그아웃"');
  // 계정 팝오버는 열기 전에는 렌더링하지 않습니다.
  expect(adminHeader).not.toContain('사용자 화면 보기');

  expect(sidebar).not.toContain('href="/"');
  expect(sidebar).not.toContain('화면 이동');
  expect(sidebar).not.toContain('사용자 화면 보기');
  expect(sidebar).toContain('참가·기록');
  expect(sidebar).toContain('운영 관리');
  expect(sidebar).toContain('분석');
  expect(sidebar).toContain('aria-current="page"');
  expect(sidebar).toContain('href="/admin/participants"');
  vi.unstubAllGlobals();
});
