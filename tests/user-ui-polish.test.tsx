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

  it('계정 설정은 가입 이메일을 읽기 전용으로 표시하고 초기 저장을 막는다', () => {
    const html = render(<AccountSettingsPage />);
    expect(html).toContain('<label for="account-email">이메일</label>');
    expect(html).toMatch(/<input id="account-email" type="email"[^>]*readOnly=""/);
    expect(html).not.toContain('account-email-note');
    expect(html).not.toContain('인증 코드 발송');
    expect(html).not.toContain('account-email-code');
    expect(html).toContain(
      '<button class="account-button account-button--primary" disabled="">정보 저장</button>',
    );
    expect(html).toContain(
      '<button class="account-button account-button--primary" disabled="">비밀번호 변경</button>',
    );
  });

  it('계정 설정은 연결된 탭과 비밀번호 보기 버튼을 제공하고 비활성 패널을 숨긴다', () => {
    const html = render(<AccountSettingsPage />);
    expect(html).toContain('role="tablist" aria-label="계정 설정"');
    expect(html).toContain(
      'role="tab" aria-selected="true" aria-controls="account-settings-profile-panel"',
    );
    expect(html).toContain('aria-labelledby="account-settings-password-tab" hidden=""');
    for (const label of ['현재 비밀번호', '새 비밀번호', '새 비밀번호 확인']) {
      expect(html).toContain(`aria-label="${label} 보기"`);
    }
    expect(html).not.toContain('account-grid');
  });
});
