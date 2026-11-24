import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ReadingLogDetailView from '../src/components/admin/readingLogs/ReadingLogDetailView';
import ReadingLogQueueList from '../src/components/admin/readingLogs/ReadingLogQueueList';
import {
  logDetailParams,
  logListParams,
  parseLogId,
  readLogListState,
  writeLogListState,
} from '../src/components/admin/readingLogs/readingLogParams';
import {
  DEFAULT_LOG_SORT,
  INITIAL_LOG_SEARCH,
  nextPendingLog,
} from '../src/components/admin/readingLogs/readingLogTable';
import type { AdminReadingLogResponse } from '../src/types/adminReadingLogApi';

const log: AdminReadingLogResponse = {
  readingLogId: 41,
  eventId: 6,
  eventTitle: '제6회 독서마라톤',
  participationId: 2,
  userId: 3,
  userName: '김도서',
  studentNo: '20260001',
  courseId: 1,
  courseName: '하프 코스',
  readingDate: '2026-11-20',
  createdAt: '2026-11-21T09:10:00.123456',
  updatedAt: '2026-11-21T09:10:00.123456',
  status: 'SUBMITTED',
  totalReadPages: 120,
  convertedDistanceMeter: 600,
  memo: '메모',
  adminComment: null,
  reviewedAt: null,
  recommendedRejectReasons: [],
  books: [],
};

describe('독서일지 목록 상태 URL', () => {
  it('기본값은 URL에 쓰지 않고, 바꾼 조건은 그대로 읽어 복원한다', () => {
    const base = new URLSearchParams('eventId=6');
    const state = {
      status: 'ALL' as const,
      search: {
        ...INITIAL_LOG_SEARCH,
        query: '사피엔스',
        from: '2026-11-01',
        to: '2026-11-15',
        course: '풀 코스',
        sort: { column: 'userName' as const, direction: 'descending' as const },
      },
      page: 6,
      pageSize: 50,
    };
    const written = writeLogListState(base, state);
    expect(written.get('eventId')).toBe('6');
    expect(written.get('page')).toBe('7');
    expect(readLogListState(written)).toEqual(state);
    expect(
      writeLogListState(base, {
        status: 'SUBMITTED',
        search: INITIAL_LOG_SEARCH,
        page: 0,
        pageSize: 20,
      }).toString(),
    ).toBe('eventId=6');
  });

  it('잘못된 상태·정렬·날짜·행 수·페이지는 기본값으로 읽는다', () => {
    const state = readLogListState(
      new URLSearchParams('status=DONE&sort=hack&from=2026-13&size=999&page=-3'),
    );
    expect(state.status).toBe('SUBMITTED');
    expect(state.search.sort).toEqual(DEFAULT_LOG_SORT);
    expect(state.search.from).toBe('');
    expect(state.pageSize).toBe(20);
    expect(state.page).toBe(0);
  });

  it('상세 URL은 목록 조건과 상태를 명시해 두고, 목록 URL은 일지 ID만 뺀다', () => {
    const list = readLogListState(new URLSearchParams('q=김&page=3'));
    const detail = logDetailParams(new URLSearchParams('eventId=6&q=김&page=3'), list, 41);
    expect(detail.get('status')).toBe('SUBMITTED');
    expect(detail.get('logId')).toBe('41');
    expect(detail.get('q')).toBe('김');
    expect(logListParams(detail).toString()).toBe('eventId=6&q=%EA%B9%80&page=3');
  });

  it('일지 ID가 양의 정수가 아니면 잘못된 ID로 구분한다', () => {
    expect(parseLogId(null)).toBeNull();
    expect(parseLogId('41')).toBe(41);
    expect(parseLogId('abc')).toBeNaN();
    expect(parseLogId('-1')).toBeNaN();
  });
});

describe('독서일지 상세 검토 화면', () => {
  const render = (props: Partial<React.ComponentProps<typeof ReadingLogDetailView>> = {}) =>
    renderToStaticMarkup(
      <ReadingLogDetailView
        log={log}
        position={{ index: 2, total: 15 }}
        onList={vi.fn()}
        onPrevious={vi.fn()}
        {...props}
      >
        <p>검토 영역</p>
      </ReadingLogDetailView>,
    );

  it('목록·이전·다음 이동과 참가자·코스·독서일·제출일·제출 독서량을 보여 준다', () => {
    const html = render();
    expect(html).toContain('목록으로');
    expect(html).toContain('3 / 15');
    expect(html).toMatch(/<button[^>]*>이전 일지<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>다음 일지<\/button>/);
    expect(html).toContain('김도서');
    expect(html).toContain('하프 코스');
    expect(html).toContain('2026-11-20');
    expect(html).toContain('120쪽');
    // 제출 쪽수 환산값을 인정 거리처럼 보이지 않게 구분한다
    expect(html).toContain('제출 기준 환산 거리');
    expect(html).toContain('서평 확인 후 인정');
    expect(html).toContain('<p>검토 영역</p>');
  });

  it('현재 목록 조건에 없는 일지는 알리고, 불러오지 못하면 오류만 보여 준다', () => {
    expect(render({ position: null })).toContain('현재 목록 조건에 포함되지 않은 일지입니다');
    const failed = render({ log: null, error: '독서일지를 찾을 수 없습니다.' });
    expect(failed).toContain('role="alert"');
    expect(failed).not.toContain('검토 영역');
  });

  it('목록에서 승인·반려된 일지는 상세 보기로 연다', () => {
    const html = renderToStaticMarkup(
      <ReadingLogQueueList
        rows={[log, { ...log, readingLogId: 42, status: 'APPROVED' }]}
        total={2}
        page={0}
        pageSize={20}
        filter="ALL"
        query=""
        from=""
        to=""
        course=""
        sort={DEFAULT_LOG_SORT}
        selectedIds={new Set()}
        loading={false}
        processing={false}
        error=""
        feedback=""
        canSelect={() => true}
        onSelectionChange={vi.fn()}
        onApproveSelection={vi.fn()}
        onFilter={vi.fn()}
        onQuery={vi.fn()}
        onDates={vi.fn()}
        onSort={vi.fn()}
        onReset={vi.fn()}
        onPage={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    expect(html).toContain('>검토하기</button>');
    expect(html).toContain('>상세 보기</button>');
    expect(html).not.toContain('log-review__books');
  });
});

describe('독서일지 연속 검토', () => {
  const rows = [11, 12, 13, 14, 15].map((id) => ({ ...log, readingLogId: id }));
  const without = (...ids: number[]) => rows.filter((row) => !ids.includes(row.readingLogId));

  it('처리한 일지 다음 순서의 대기 일지로 이어 간다', () => {
    expect(nextPendingLog(rows, 12, without(12))).toBe(13);
  });

  it('뒤쪽 후보가 모두 처리됐으면 가장 가까운 앞쪽 대기 일지로 간다', () => {
    expect(nextPendingLog(rows, 14, without(14, 15))).toBe(13);
    expect(nextPendingLog(rows, 15, without(15))).toBe(14);
  });

  it('다른 관리자가 처리한 후보는 건너뛰고, 처리한 일지가 아직 목록에 있어도 다시 고르지 않는다', () => {
    expect(nextPendingLog(rows, 11, without(12, 13))).toBe(14);
    expect(nextPendingLog(rows, 11, rows)).toBe(12);
  });

  it('남은 대기 일지가 없으면 이동하지 않고, 새로 들어온 일지만 있으면 그 일지로 간다', () => {
    expect(nextPendingLog(rows, 11, [])).toBeNull();
    expect(nextPendingLog([rows[0]], 11, [{ ...log, readingLogId: 99 }])).toBe(99);
  });

  it('처리 후 자동 이동 옵션은 작은 체크박스로 상세 화면 하단에 둔다', () => {
    const html = renderToStaticMarkup(
      <ReadingLogDetailView
        log={log}
        position={{ index: 0, total: 3 }}
        onList={vi.fn()}
        autoNext={{ checked: true, onChange: vi.fn() }}
      >
        <p>검토 영역</p>
      </ReadingLogDetailView>,
    );
    expect(html).toMatch(
      /<p>검토 영역<\/p><label class="log-detail__auto"><input type="checkbox" checked=""/,
    );
    expect(html).toContain('처리 후 다음 대기 일지로 이동');
    const without = renderToStaticMarkup(
      <ReadingLogDetailView log={log} position={null} onList={vi.fn()} />,
    );
    expect(without).not.toContain('log-detail__auto');
  });
});
