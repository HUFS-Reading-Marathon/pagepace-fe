import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import AboutPage from '../src/pages/info/AboutPage';
import CoursesPage from '../src/pages/info/CoursesPage';
import GuidePage from '../src/pages/info/GuidePage';
import ProcessGuide from '../src/components/main/ProcessGuide';
import { PROCESS_STEPS } from '../src/pages/main/mainPageContent';

vi.mock('../src/auth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));

const render = (element: React.ReactElement, path = '/') =>
  renderToStaticMarkup(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);

it('행사안내·코스 및 혜택·참여방법은 공통 제목 영역과 기존 .wrap 본문을 쓴다', () => {
  for (const [element, title] of [
    [<AboutPage />, '행사안내'],
    [<CoursesPage />, '코스 및 혜택'],
    [<GuidePage />, '참여방법'],
  ] as const) {
    const html = render(element);
    expect(html).toMatch(/<main id="main" class="wrap user-page info-page">/);
    expect(html).toContain(`<h1>${title}</h1>`);
  }
});

it('행사 데이터를 불러오기 전에는 코스 표 대신 불러오는 중 안내를 보여 준다', () => {
  const html = render(<CoursesPage />);
  expect(html).toContain('코스 정보를 불러오는 중입니다.');
  expect(html).not.toContain('program-table');
});

it('참여방법은 메인페이지와 같은 단계·문구(PROCESS_STEPS)를 그대로 쓴다', () => {
  const html = render(<ProcessGuide />);
  expect(html.match(/class="process-step"/g)).toHaveLength(PROCESS_STEPS.length);
  for (const step of PROCESS_STEPS) {
    expect(html).toContain(`<h3>${step.title}</h3>`);
    expect(html).toContain(step.desc);
  }
  const guide = render(<GuidePage />);
  expect(guide).toContain('참여 전 확인사항');
});
