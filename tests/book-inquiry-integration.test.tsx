import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BookRequest } from '../src/api/bookRequestApi';
import { createMockDb } from '../src/mocks/mockDb';
import { handleMockRequest, resetMockDb } from '../src/mocks/mockHandlers';
import {
  bookInquiryErrors,
  bookInquiryResult,
  bookInquiryStatusLabel,
  pageBookInquiries,
  readBookInquiryPrefill,
} from '../src/pages/inquiries/bookInquiryState';
import AdminSidebar from '../src/components/admin/AdminSidebar';
import { legacyBookRequestTarget, legacyTabSearch } from '../src/routes/legacyTabSearch';

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

describe('사용자 도서 문의(도서 확인 요청) 상태', () => {
  const row = (patch: Partial<BookRequest>): BookRequest => ({
    id: 1,
    eventId: 6,
    participationId: 1,
    readingDate: '2026-11-20',
    readPages: 30,
    reason: 'NOT_HELD',
    title: '긴긴밤',
    author: '',
    publisher: '',
    isbn: '978-89-546-7715-8',
    note: '',
    status: 'PENDING',
    createdAt: '2026-11-20T10:00:00',
    reviewedAt: null,
    rejectReason: null,
    readingLogId: null,
    studentNo: '20261125',
    participantName: '김가람',
    ...patch,
  });

  it('기존 상태 모델(대기·이관·반려)과 라벨을 그대로 쓰고 결과 문구를 실제 상태에 맞춘다', () => {
    expect(bookInquiryStatusLabel('PENDING')).toBe('도서 확인 대기');
    expect(bookInquiryStatusLabel('LINKED')).toBe('일지 심사로 이관');
    expect(bookInquiryStatusLabel('REJECTED')).toBe('반려');
    expect(bookInquiryResult(row({ status: 'LINKED' }))).toContain('독서일지 검토에서 승인되면');
    expect(bookInquiryResult(row({ status: 'REJECTED', rejectReason: '판본 불일치' }))).toBe(
      '판본 불일치',
    );
    expect(bookInquiryResult(row({ status: 'REJECTED', rejectReason: null }))).toBe(
      '반려 사유가 등록되지 않았습니다.',
    );
  });

  it('도서명·ISBN(하이픈 무시)으로 찾고 10건씩 나누며 범위를 벗어난 쪽은 마지막 쪽으로 맞춘다', () => {
    const rows = Array.from({ length: 23 }, (_, index) =>
      row({ id: index + 1, title: index === 4 ? '밝은 밤' : `책 ${index + 1}` }),
    );
    expect(pageBookInquiries(rows, '', 0)).toMatchObject({ total: 23, pages: 3, page: 0 });
    expect(pageBookInquiries(rows, '', 0).items).toHaveLength(10);
    expect(pageBookInquiries(rows, '', 9)).toMatchObject({ page: 2 });
    expect(pageBookInquiries(rows, '', 9).items).toHaveLength(3);
    expect(pageBookInquiries(rows, '밝은', 0).items.map((item) => item.id)).toEqual([5]);
    expect(pageBookInquiries(rows, '9788954677158', 0).total).toBe(23);
  });

  it('입력값은 서버 규칙(도서명, 쪽수 1~400, 사유 필수)으로 검사한다', () => {
    const form = {
      title: '긴긴밤',
      readPages: '35',
      reason: 'NOT_HELD' as const,
      isbn: '',
      note: '',
    };
    expect(bookInquiryErrors(form)).toEqual({});
    expect(
      Object.keys(bookInquiryErrors({ ...form, title: ' ', readPages: '', reason: '' })),
    ).toEqual(['title', 'readPages', 'reason']);
    expect(bookInquiryErrors({ ...form, readPages: '401' }).readPages).toBeDefined();
    expect(bookInquiryErrors({ ...form, readPages: '2.5' }).readPages).toBeDefined();
  });

  it('이전 /book-requests 주소의 책 제목·ISBN을 작성 화면에 넘기고, 없으면 도서 문의 목록을 연다', () => {
    expect(legacyBookRequestTarget('?title=긴긴밤')).toBe(
      `/inquiries/books/new?title=${encodeURIComponent('긴긴밤').replace(/%20/g, '+')}`,
    );
    expect(legacyBookRequestTarget('?isbn=9788954677158&foo=1')).toBe(
      '/inquiries/books/new?isbn=9788954677158',
    );
    expect(legacyBookRequestTarget('')).toBe('/inquiries?view=books');
    expect(readBookInquiryPrefill(new URLSearchParams('title=%20긴긴밤%20'))).toEqual({
      title: '긴긴밤',
      isbn: '',
    });
  });
});

describe('목데이터 사용자 도서 문의 API(서버 정책과 같게)', () => {
  beforeEach(() => resetMockDb());

  async function call(path: string, init: RequestInit & { token?: string } = {}) {
    const headers = new Headers(init.headers);
    if (init.token) headers.set('Authorization', `Bearer ${init.token}`);
    const response = await handleMockRequest(path, { ...init, headers });
    return { status: response.status, payload: await response.json() };
  }
  const login = async (studentNo: string) =>
    (
      await call('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ studentNo, password: 'any' }),
      })
    ).payload.data.accessToken as string;

  it('본인 참가 회차의 요청만 보이고, 다른 참가자의 요청은 내려 주지 않는다', async () => {
    const db = createMockDb();
    const owner = db.bookRequests[0];
    const ownerUser = db.users.find((item) => item.studentNo === owner.studentNo)!;
    const mine = await call(`/api/me/book-requests?eventId=${owner.eventId}`, {
      token: await login(ownerUser.studentNo),
    });
    expect(mine.status).toBe(200);
    const ownIds = db.bookRequests
      .filter((item) => item.participationId === owner.participationId)
      .map((item) => item.id);
    expect(mine.payload.data.map((item: BookRequest) => item.id).sort()).toEqual(ownIds.sort());

    const other = db.users.find(
      (item) =>
        item.role === 'USER' &&
        db.participations.some((p) => p.userId === item.userId && p.eventId === owner.eventId) &&
        !db.bookRequests.some((request) => request.studentNo === item.studentNo),
    )!;
    const theirs = await call(`/api/me/book-requests?eventId=${owner.eventId}`, {
      token: await login(other.studentNo),
    });
    expect(theirs.payload.data).toEqual([]);
  });

  it('도서 문의는 일반 공개 문의 목록에 섞이지 않는다', async () => {
    const db = createMockDb();
    const publicItems = (await call('/api/inquiries?kind=QUESTION&q=&page=0')).payload.data.items;
    const titles = publicItems.map((item: { title: string }) => item.title);
    for (const request of db.bookRequests) expect(titles).not.toContain(request.title);
  });
});
