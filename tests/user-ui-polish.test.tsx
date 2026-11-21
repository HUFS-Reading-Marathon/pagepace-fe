import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import NotFoundPage from '../src/pages/error/NotFoundPage';
import MyPage from '../src/pages/my/MyPage';
import AccountSettingsPage from '../src/pages/my/AccountSettingsPage';

vi.mock('../src/auth', () => ({ useAuth: () => ({ logout: () => undefined }) }));

const render = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

describe('사용자 페이지 UI 일관성 보정', () => {
  it('404 페이지는 공통 페이지 컨테이너 안에 제목과 홈 링크를 둔다', () => {
    const html = render(<NotFoundPage />);
    expect(html).toMatch(/^<main class="page-container"><section class="page-section">/);
    expect(html).toContain('<h1>페이지를 찾을 수 없습니다.</h1>');
    expect(html).toContain('href="/"');
  });

  it('나의 현황은 불러오는 동안에도 페이지 제목을 유지하고 상태 문구를 따로 보여 준다', () => {
    const html = render(<MyPage />);
    expect(html).toContain('<h1>나의 현황</h1>');
    expect(html).toContain('<p role="status">나의 현황을 불러오고 있습니다.</p>');
    expect(html).not.toContain('<h1>나의 현황을 불러오고 있습니다.</h1>');
  });

  it('계정 설정 이메일 입력은 라벨과 연결되고 저장 버튼은 주 버튼 스타일을 쓴다', () => {
    const html = render(<AccountSettingsPage />);
    expect(html).toContain('<label for="account-email">이메일</label>');
    expect(html).toMatch(/<input id="account-email" type="email"/);
    expect(html).toContain(
      '<button class="account-button account-button--primary">정보 저장</button>',
    );
    expect(html).toContain(
      '<button class="account-button account-button--primary">비밀번호 변경</button>',
    );
  });
});
