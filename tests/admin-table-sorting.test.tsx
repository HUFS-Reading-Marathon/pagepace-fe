import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AdminReviewTarget } from '../src/api/adminReadingLogApi';
import type { RosterRow } from '../src/api/adminRosterApi';
import type { BookRequest } from '../src/api/bookRequestApi';
import type { ImportedReview } from '../src/api/reviewImportApi';
import BookRequestTable from '../src/components/admin/bookRequests/BookRequestTable';
import {
  bookRequestCounts,
  INITIAL_BOOK_REQUEST_SEARCH,
  readBookRequestListState,
  visibleBookRequests,
  writeBookRequestListState,
} from '../src/components/admin/bookRequests/bookRequestList';
import {
  INITIAL_LOG_SEARCH,
  visibleLogs,
} from '../src/components/admin/readingLogs/readingLogTable';
import {
  DEFAULT_REVIEW_IMPORT_SORT,
  sortForView,
  sortImportRows,
} from '../src/components/admin/reviews/reviewImportSort';
import {
  INITIAL_REVIEW_SEARCH,
  readReviewListState,
  visibleReviewTargets,
} from '../src/components/admin/reviews/reviewTargetFilters';
import { compareBy, nextSort, sortRows, timeValue } from '../src/components/admin/table/sorting';
import type { AdminReadingLogResponse } from '../src/types/adminReadingLogApi';
import { sortedRoster } from '../src/utils/participantRoster';

describe('공통 컬럼 정렬 규칙', () => {
  it('같은 컬럼을 다시 누르면 방향을 바꾸고, 다른 컬럼은 오름차순으로 시작한다', () => {
    const first = nextSort({ column: 'a', direction: 'ascending' }, 'a');
    expect(first).toEqual({ column: 'a', direction: 'descending' });
    expect(nextSort(first, 'a')).toEqual({ column: 'a', direction: 'ascending' });
    expect(nextSort(first, 'b')).toEqual({ column: 'b', direction: 'ascending' });
  });

  it('숫자는 크기로(5 < 20 < 100), 문자열은 한글·영문·숫자를 자연스럽게 비교한다', () => {
    const numbers = [100, 5, 20];
    expect([...numbers].sort((a, b) => compareBy(a, b, 'ascending'))).toEqual([5, 20, 100]);
    expect([...numbers].sort((a, b) => compareBy(a, b, 'descending'))).toEqual([100, 20, 5]);
    // 참가자 관리와 같은 한국어 정렬 규칙: 한글이 영문보다 앞이고, 숫자는 자연 정렬입니다.
    const titles = ['도서10', 'Book', '도서2', '가나', 'apple'];
    expect([...titles].sort((a, b) => compareBy(a, b, 'ascending'))).toEqual([
      '가나',
      '도서2',
      '도서10',
      'apple',
      'Book',
    ]);
  });

  it('값이 없으면 정렬 방향과 관계없이 마지막에 두고, 같은 값은 보조 기준으로 순서를 고정한다', () => {
    const rows = [
      { id: 3, v: 10 },
      { id: 1, v: null },
      { id: 2, v: 10 },
      { id: 4, v: 5 },
    ];
    const ids = (direction: 'ascending' | 'descending') =>
      sortRows(
        rows,
        { column: 'v', direction },
        (row) => row.v,
        (a, b) => a.id - b.id,
      ).map((row) => row.id);
    expect(ids('ascending')).toEqual([4, 2, 3, 1]);
    expect(ids('descending')).toEqual([2, 3, 4, 1]);
  });

  it('날짜는 형식이 달라도 실제 시각으로 비교하고, 해석할 수 없으면 값 없음으로 본다', () => {
    expect(timeValue('2026-11-05')).toBeLessThan(timeValue('2026-11-05T00:00:01')!);
    expect(timeValue('2026-11-05T13:00:00')).toBeLessThan(timeValue('2026-11-10T09:00:00')!);
    expect(timeValue('')).toBeNull();
    expect(timeValue('알 수 없음')).toBeNull();
  });
});

const request = (patch: Partial<BookRequest>): BookRequest => ({
  id: 1,
  eventId: 6,
  participationId: 1,
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
  title: '책',
  author: '저자',
  publisher: '출판사',
  isbn: '',
  note: '',
  ...patch,
});

describe('도서 확인 요청 컬럼 정렬', () => {
  const rows = [
    request({ id: 1, readPages: 100, studentNo: '0012345', title: '도서10' }),
    request({ id: 2, readPages: 5, studentNo: 'M7013', title: '도서2', status: 'REJECTED' }),
    request({ id: 3, readPages: 20, studentNo: '0002', title: 'Alpha', status: 'LINKED' }),
  ];
  const ids = (column: string, direction: 'ascending' | 'descending' = 'ascending') =>
    visibleBookRequests(rows, {
      ...INITIAL_BOOK_REQUEST_SEARCH,
      filter: 'ALL',
      sort: { column: column as never, direction },
    }).map((row) => row.id);

  it('요청 독서량은 숫자로, 도서명은 자연 정렬로, 학번은 앞자리 0을 지킨 식별자로 정렬한다', () => {
    expect(ids('readPages')).toEqual([2, 3, 1]);
    expect(ids('readPages', 'descending')).toEqual([1, 3, 2]);
    expect(ids('title')).toEqual([2, 1, 3]);
    expect(ids('studentNo')).toEqual([3, 1, 2]);
    // 학번은 숫자로 바꾸지 않으므로 화면 값이 그대로 남습니다.
    expect(
      visibleBookRequests(rows, { ...INITIAL_BOOK_REQUEST_SEARCH, filter: 'ALL' })[0].studentNo,
    ).toBe('0012345');
  });

  it('상태는 확인 대기 → 일지 심사로 이관 → 반려 순서로 정렬한다', () => {
    expect(ids('status')).toEqual([1, 3, 2]);
    expect(ids('status', 'descending')).toEqual([2, 3, 1]);
  });

  it('검색·상태 필터를 거친 전체 목록을 정렬한 뒤 쪽을 나눈다(현재 쪽만 정렬하지 않음)', () => {
    const many = Array.from({ length: 45 }, (_, index) =>
      request({ id: index + 1, readPages: ((index * 37) % 45) + 1 }),
    );
    const sorted = visibleBookRequests(many, {
      ...INITIAL_BOOK_REQUEST_SEARCH,
      sort: { column: 'readPages', direction: 'descending' },
    });
    expect(sorted.slice(0, 20).map((row) => row.readPages)).toEqual(
      Array.from({ length: 20 }, (_, index) => 45 - index),
    );
    expect(sorted.slice(40).map((row) => row.readPages)).toEqual([5, 4, 3, 2, 1]);
  });

  it('정렬은 sort·dir 주소로 남기고, 이전 주소의 sort=newest도 최근 요청 순으로 연다', () => {
    const state = {
      search: {
        ...INITIAL_BOOK_REQUEST_SEARCH,
        sort: { column: 'readPages' as const, direction: 'descending' as const },
      },
      page: 0,
      pageSize: 20,
    };
    const written = writeBookRequestListState(new URLSearchParams('eventId=6'), state);
    expect(written.toString()).toBe('eventId=6&sort=readPages&dir=desc');
    expect(readBookRequestListState(written).search.sort).toEqual(state.search.sort);
    expect(readBookRequestListState(new URLSearchParams('sort=newest')).search.sort).toEqual({
      column: 'createdAt',
      direction: 'descending',
    });
    expect(
      readBookRequestListState(new URLSearchParams('sort=password&dir=desc')).search.sort,
    ).toEqual(INITIAL_BOOK_REQUEST_SEARCH.sort);
  });

  it('정렬할 수 있는 컬럼 제목만 버튼이고 현재 정렬 컬럼에 aria-sort를 둔다(순번·검토 제외)', () => {
    const html = renderToStaticMarkup(
      <BookRequestTable
        rows={rows}
        total={3}
        page={0}
        pageSize={20}
        search={{
          ...INITIAL_BOOK_REQUEST_SEARCH,
          sort: { column: 'readPages', direction: 'descending' },
        }}
        counts={bookRequestCounts(rows)}
        loading={false}
        busy={false}
        error=""
        hasLoaded
        onSearch={vi.fn()}
        onSort={vi.fn()}
        onReset={vi.fn()}
        onRefresh={vi.fn()}
        onPage={vi.fn()}
        onPageSize={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    const head = html.match(/<thead>(.*?)<\/thead>/s)![1];
    expect(head.match(/class="roster-sort"/g)).toHaveLength(7);
    expect(head).toMatch(/<th scope="col" data-column="number">순번<\/th>/);
    expect(head).toMatch(/<th scope="col" data-column="action">검토<\/th>/);
    expect(head).toMatch(/data-column="readPages" aria-sort="descending">/);
    expect(head.match(/aria-sort=/g)).toHaveLength(1);
    // 별도의 정렬 드롭다운은 두지 않습니다.
    expect(html).not.toContain('aria-label="정렬"');
  });
});

const target = (patch: Partial<AdminReviewTarget>): AdminReviewTarget => ({
  participantBookId: 1,
  participationId: 1,
  userId: 1,
  userName: '김서평',
  studentNo: '20260001',
  bookTitle: '코스모스',
  author: '칼 세이건',
  approvedReadPages: 120,
  distanceToCreditMeter: 600,
  reviewSearchUrl: null,
  reviewSubmittedAt: '2026-11-20T10:00:00',
  reviewVerified: false,
  reviewVerifiedAt: null,
  ...patch,
});

describe('서평 개별 확인 컬럼 정렬', () => {
  const rows = [
    target({ participantBookId: 1, distanceToCreditMeter: 1075 }),
    target({ participantBookId: 2, distanceToCreditMeter: 96, reviewSubmittedAt: null }),
    target({
      participantBookId: 3,
      distanceToCreditMeter: 0,
      reviewVerified: true,
      reviewSubmittedAt: '2026-11-01T09:00:00',
    }),
  ];
  const ids = (column: string, direction: 'ascending' | 'descending' = 'ascending') =>
    visibleReviewTargets(rows, {
      ...INITIAL_REVIEW_SEARCH,
      filter: 'all',
      sort: { column: column as never, direction },
    }).map((row) => row.participantBookId);

  it('미인정 거리는 표시 문자열("1,075m")이 아니라 숫자로 정렬한다', () => {
    expect(ids('distance')).toEqual([3, 2, 1]);
    expect(ids('distance', 'descending')).toEqual([1, 2, 3]);
  });

  it('서평 시각을 모르는 대상은 어느 방향이든 마지막이고, 상태는 확인 대기 → 확인 완료 순이다', () => {
    expect(ids('date')).toEqual([3, 1, 2]);
    expect(ids('date', 'descending')).toEqual([1, 3, 2]);
    // 같은 상태끼리는 서평 시각 순(시각 모름은 마지막)으로 고정합니다.
    expect(ids('status')).toEqual([1, 2, 3]);
  });

  it('이전 주소의 rsort=newest는 서평 시각 최근 순으로 연다', () => {
    expect(readReviewListState(new URLSearchParams('rsort=newest')).search.sort).toEqual({
      column: 'date',
      direction: 'descending',
    });
    expect(
      readReviewListState(new URLSearchParams('rsort=distance&rdir=desc')).search.sort,
    ).toEqual({ column: 'distance', direction: 'descending' });
  });
});

describe('엑셀 대조·독서일지·참가자 상태 정렬', () => {
  const importRow = (id: number, sourceRow: number, patch: Partial<ImportedReview> = {}) =>
    ({
      id,
      sourceRow,
      memberName: '이름',
      memberNo: '001',
      bookTitle: '책',
      libraryBookId: 1,
      bibliographicInfo: null,
      reviewTitle: null,
      content: null,
      sourceUpdatedAt: '2026-01-01T00:00:00',
      status: 'MATCHED',
      warnings: [],
      verification: null,
      candidates: [],
      ...patch,
    }) as ImportedReview;

  it('엑셀 행은 원본 행 번호로 정렬하고, 후보가 정해지지 않은 행의 인정 쪽수는 마지막에 둔다', () => {
    const candidate = (pages: number) => ({
      participantBookId: pages,
      name: '이름',
      studentNo: '001',
      bookTitle: '책',
      libraryBookId: 1,
      approvedPages: pages,
      uncreditedPages: pages,
      distanceToCreditMeter: pages * 5,
      matchType: 'LIBRARY_ID' as const,
    });
    const rows = [
      importRow(1, 100, { candidates: [candidate(20)] }),
      importRow(2, 5, { candidates: [candidate(100)] }),
      importRow(3, 20, { candidates: [candidate(5), candidate(6)] }),
    ];
    expect(sortImportRows(rows, DEFAULT_REVIEW_IMPORT_SORT).map((row) => row.sourceRow)).toEqual([
      5, 20, 100,
    ]);
    expect(
      sortImportRows(rows, { column: 'pages', direction: 'descending' }).map((row) => row.id),
    ).toEqual([2, 1, 3]);
    // 보기에 없는 컬럼으로 정렬 중이면 원본 행 순서로 돌아갑니다.
    expect(sortForView({ column: 'result', direction: 'ascending' }, 'ready')).toEqual(
      DEFAULT_REVIEW_IMPORT_SORT,
    );
  });

  it('독서일지 상태는 검토 대기 → 승인 → 반려 순서로 정렬한다', () => {
    const log = (readingLogId: number, status: AdminReadingLogResponse['status']) =>
      ({
        readingLogId,
        status,
        createdAt: '2026-11-01T10:00:00',
        books: [],
        userName: '이름',
        studentNo: '1',
        courseName: '코스',
        totalReadPages: 10,
      }) as unknown as AdminReadingLogResponse;
    const rows = [log(1, 'REJECTED'), log(2, 'APPROVED'), log(3, 'SUBMITTED')];
    expect(
      visibleLogs(rows, {
        ...INITIAL_LOG_SEARCH,
        sort: { column: 'status', direction: 'ascending' },
      }).map((row) => row.status),
    ).toEqual(['SUBMITTED', 'APPROVED', 'REJECTED']);
  });

  it('참가자 상태는 승인 대기 → 승인 → 완주 → 반려 → 참가 취소 순서로 정렬한다', () => {
    const roster = (serialNo: number, status: string) =>
      ({
        serialNo,
        applicationId: serialNo,
        participationId: null,
        name: `참가자${serialNo}`,
        studentNo: String(serialNo),
        applicationStatus: status,
        participationStatus: null,
        registeredAt: '2026-11-01T09:00:00',
      }) as unknown as RosterRow;
    const rows = [
      roster(1, 'CANCELLED'),
      roster(2, 'REJECTED'),
      roster(3, 'APPROVED'),
      roster(4, 'APPLIED'),
    ];
    const sorted = sortedRoster(
      rows,
      { query: '', status: '', course: '', affiliation: '' } as never,
      { column: 'status', direction: 'ascending' },
    );
    expect(sorted.map((row) => row.applicationStatus)).toEqual([
      'APPLIED',
      'APPROVED',
      'REJECTED',
      'CANCELLED',
    ]);
  });
});
