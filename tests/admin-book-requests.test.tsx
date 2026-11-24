import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { BookRequest } from '../src/api/bookRequestApi';
import BookRequestDetail from '../src/components/admin/bookRequests/BookRequestDetail';
import BookRequestProcessPanel from '../src/components/admin/bookRequests/BookRequestProcessPanel';
import BookRequestTable from '../src/components/admin/bookRequests/BookRequestTable';
import {
  bookRequestCounts,
  INITIAL_BOOK_REQUEST_SEARCH,
  parseRequestId,
  readBookRequestListState,
  visibleBookRequests,
  writeBookRequestListState,
  type BookRequestSearch,
} from '../src/components/admin/bookRequests/bookRequestList';

const base: BookRequest = {
  id: 1,
  eventId: 6,
  participationId: 10,
  status: 'PENDING',
  createdAt: '2026-11-05T13:00:00',
  reviewedAt: null,
  rejectReason: null,
  readingLogId: null,
  studentNo: '202591016',
  participantName: '김다온',
  readingDate: '2026-11-04',
  readPages: 80,
  reason: 'EBOOK',
  title: '전자책으로 읽은 경제 교양서',
  author: '가상 저자',
  publisher: '가상 출판사',
  isbn: '979-11-90000-00-1',
  note: '종이책 쪽수를 확인해 주세요.',
};
const linked: BookRequest = {
  ...base,
  id: 2,
  status: 'LINKED',
  participantName: '이이관',
  title: '이관된 책',
  isbn: '',
  createdAt: '2026-11-03T09:00:00',
  reviewedAt: '2026-11-04T10:00:00',
  readingLogId: 77,
};
const rejected: BookRequest = {
  ...base,
  id: 3,
  status: 'REJECTED',
  participantName: '박반려',
  title: '반려된 책',
  createdAt: '2026-11-05T13:00:00',
  rejectReason: '판본을 확인할 수 없습니다.',
};
const later: BookRequest = {
  ...base,
  id: 4,
  participantName: '최나중',
  title: '나중 책',
  createdAt: '2026-11-09T08:00:00',
};
const rows = [later, rejected, linked, base];

describe('도서 확인 요청 목록 조건', () => {
  const ids = (patch: Partial<BookRequestSearch>) =>
    visibleBookRequests(rows, { ...INITIAL_BOOK_REQUEST_SEARCH, ...patch }).map((row) => row.id);

  it('처음에는 확인 대기(PENDING)만 요청 오래된 순으로 보여 주고, 처리 기록은 서버 상태값으로 거른다', () => {
    expect(ids({})).toEqual([1, 4]);
    expect(ids({ filter: 'LINKED' })).toEqual([2]);
    expect(ids({ filter: 'REJECTED' })).toEqual([3]);
    // 요청 시각이 같으면 요청 번호 순으로 고정합니다.
    expect(ids({ filter: 'ALL' })).toEqual([2, 1, 3, 4]);
    expect(ids({ filter: 'ALL', sort: 'newest' })).toEqual([4, 3, 1, 2]);
    expect(bookRequestCounts(rows)).toEqual({ PENDING: 2, LINKED: 1, REJECTED: 1, ALL: 4 });
  });

  it('이름·학번·도서명과 하이픈을 뺀 ISBN으로 찾는다', () => {
    expect(ids({ filter: 'ALL', query: '박반' })).toEqual([3]);
    expect(ids({ query: '202591016' })).toEqual([1, 4]);
    expect(ids({ query: '나중' })).toEqual([4]);
    expect(ids({ filter: 'ALL', query: '9791190000001' })).toEqual([1, 3, 4]);
    expect(ids({ query: '979-11-9000' })).toEqual([1, 4]);
    expect(ids({ query: '없는 책' })).toEqual([]);
  });

  it('목록 조건을 URL에 담고 기본값은 생략하며 행사·상세 파라미터는 그대로 둔다', () => {
    const state = {
      search: { filter: 'REJECTED' as const, query: '반려', sort: 'newest' as const },
      page: 1,
      pageSize: 50,
    };
    const written = writeBookRequestListState(new URLSearchParams('eventId=6&requestId=3'), state);
    expect(written.get('eventId')).toBe('6');
    expect(written.get('requestId')).toBe('3');
    expect(readBookRequestListState(written)).toEqual(state);
    expect(
      writeBookRequestListState(new URLSearchParams('eventId=6'), {
        search: INITIAL_BOOK_REQUEST_SEARCH,
        page: 0,
        pageSize: 20,
      }).toString(),
    ).toBe('eventId=6');
    // 서버에 없는 상태값이나 잘못된 쪽 크기는 기본값으로 돌립니다.
    expect(readBookRequestListState(new URLSearchParams('status=APPROVED&size=7'))).toEqual({
      search: INITIAL_BOOK_REQUEST_SEARCH,
      page: 0,
      pageSize: 20,
    });
    expect(parseRequestId(null)).toBeNull();
    expect(parseRequestId('12')).toBe(12);
    expect(parseRequestId('abc')).toBeNaN();
    expect(parseRequestId('0')).toBeNaN();
  });
});

describe('도서 확인 요청 표', () => {
  const render = (props: Partial<React.ComponentProps<typeof BookRequestTable>> = {}) =>
    renderToStaticMarkup(
      <BookRequestTable
        rows={[base, later]}
        total={2}
        page={0}
        pageSize={20}
        search={INITIAL_BOOK_REQUEST_SEARCH}
        counts={bookRequestCounts(rows)}
        loading={false}
        busy={false}
        error=""
        hasLoaded
        onSearch={vi.fn()}
        onReset={vi.fn()}
        onRefresh={vi.fn()}
        onPage={vi.fn()}
        onPageSize={vi.fn()}
        onOpen={vi.fn()}
        {...props}
      />,
    );

  it('전체 너비 표에 요청 정보 열과 검토 버튼, 상태 필터 건수, 공통 페이지 이동을 둔다', () => {
    const html = render();
    const headings = Array.from(
      html.match(/<thead>(.*?)<\/thead>/s)![1].matchAll(/<th\b[^>]*>(.*?)<\/th>/gs),
      (match) => match[1],
    );
    expect(headings).toEqual([
      '순번',
      '참가자',
      '학번·사번',
      '요청 도서명',
      '저자',
      '요청 독서량',
      '요청일',
      '상태',
      '검토',
    ]);
    expect(html).toContain('80쪽');
    expect(html).toContain('2026-11-05 13:00');
    expect(html).toContain('>검토하기</button>');
    expect(html).toContain('도서 확인 대기 (2)');
    expect(html).toContain('일지 심사로 이관 (1)');
    expect(html).toContain('1–2 / 2건');
    expect(html).toContain('placeholder="이름, 학번, 도서명, ISBN 검색"');
  });

  it('처리된 요청은 상세 보기로 열고, 빈 목록·검색 결과 없음·조회 실패를 구분한다', () => {
    expect(
      render({ rows: [linked], search: { ...INITIAL_BOOK_REQUEST_SEARCH, filter: 'LINKED' } }),
    ).toContain('>상세 보기</button>');
    expect(render({ rows: [], total: 0 })).toContain('확인 대기 중인 요청이 없습니다.');
    expect(
      render({ rows: [], total: 0, search: { ...INITIAL_BOOK_REQUEST_SEARCH, query: '없음' } }),
    ).toContain('조건에 맞는 요청이 없습니다.');
    const failed = render({ rows: [], total: 0, error: '서버 오류', hasLoaded: false });
    expect(failed).toContain('도서 확인 요청을 불러오지 못했습니다.');
    expect(failed).not.toContain('확인 대기 중인 요청이 없습니다.');
    const stale = render({ error: '다시 불러오지 못했습니다.' });
    expect(stale).toContain('아래는 마지막으로 불러온 목록입니다.');
    expect(stale).toContain('김다온');
  });
});

describe('도서 확인 요청 상세', () => {
  const renderDetail = (request: BookRequest, children?: React.ReactNode) =>
    renderToStaticMarkup(
      <MemoryRouter>
        <BookRequestDetail
          request={request}
          position={{ index: 0, total: 2 }}
          onList={vi.fn()}
          onNext={vi.fn()}
        >
          {children}
        </BookRequestDetail>
      </MemoryRouter>,
    );

  it('참가자·요청 정보·요청 도서·요청 내용을 나눠 보여 주고 이전·다음 이동 막대를 둔다', () => {
    const html = renderDetail(base);
    expect(html).toContain('aria-label="요청 이동"');
    expect(html).toContain('1 / 2');
    expect(html).toMatch(/<h2[^>]*>김다온<small>202591016<\/small><\/h2>/);
    for (const heading of ['요청 정보', '요청 도서', '참가자 요청 내용']) {
      expect(html).toContain(`>${heading}</h3>`);
    }
    for (const label of [
      '요청 사유',
      '독서일',
      '요청 독서량',
      '요청일',
      '도서명',
      '저자',
      '출판사',
      'ISBN',
    ]) {
      expect(html).toContain(`<dt>${label}</dt>`);
    }
    expect(html).toContain('전자책과 실물 판본 확인');
    expect(html).toContain('979-11-90000-00-1');
    expect(html).not.toContain('처리 일시');
  });

  it('처리된 요청은 처리 일시·반려 사유·이관된 일지 링크를 보여 준다', () => {
    expect(renderDetail(rejected)).toContain('>반려 사유</h3>');
    const html = renderDetail(linked);
    expect(html).toContain('<dt>처리 일시</dt>');
    expect(html).toContain('href="/admin/logs?eventId=6&amp;logId=77"');
  });

  it('처리 영역은 검색 입력과 관리자 보조 버튼을 한 줄에 두고, 반려 사유가 없으면 반려 버튼을 끈다', () => {
    const html = renderToStaticMarkup(
      <BookRequestProcessPanel
        request={base}
        processing={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(html).toMatch(
      /<form class="book-request-process__search">[\s\S]*<input[^>]*value="979-11-90000-00-1"[\s\S]*<button type="submit" class="admin-button">소장 서지 검색<\/button><\/form>/,
    );
    expect(html).toMatch(
      /<button type="button" class="admin-button admin-button--danger" disabled="">요청 반려<\/button>/,
    );
    expect(html).toContain('maxLength="1000"');
    // 판본을 고르기 전에는 이관 버튼을 두지 않습니다.
    expect(html).not.toContain('일지 심사로 이관');
  });
});
