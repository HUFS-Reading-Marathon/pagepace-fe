import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import AdminSidebar from '../src/components/admin/AdminSidebar';
import { legacyTabSearch } from '../src/routes/legacyTabSearch';

describe('관리자 도서 확인 요청 → 문의·FAQ 관리 도서 문의 탭', () => {
  it('이전 주소의 행사·요청 번호·목록 조건을 그대로 넘기고 탭만 정한다', () => {
    expect(legacyTabSearch('?eventId=6&requestId=12&status=ALL&sort=newest', 'books')).toBe(
      '?view=books&eventId=6&requestId=12&status=ALL&sort=newest',
    );
    // 이전 주소에 다른 view 값이 있어도 도서 문의 탭으로 엽니다.
    expect(legacyTabSearch('?view=pending&eventId=6', 'books')).toBe('?view=books&eventId=6');
    expect(legacyTabSearch('', 'books')).toBe('?view=books');
  });

  it('사이드바에는 도서 확인 요청 메뉴가 없고, 이전 주소에서는 문의·FAQ 관리가 활성이다', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/admin/book-requests']}>
        <AdminSidebar />
      </MemoryRouter>,
    );
    expect(html).not.toContain('도서 확인 요청');
    expect(html).not.toContain('href="/admin/book-requests"');
    expect(html).toContain(
      `class="admin-sidebar__link admin-sidebar__link--active" href="/admin/inquiries"`,
    );
  });
});
