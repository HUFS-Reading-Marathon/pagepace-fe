import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AdminReviewTarget } from '../src/api/adminReadingLogApi';
import ReadingLogQueueList from '../src/components/admin/readingLogs/ReadingLogQueueList';
import {
  logDetailParams,
  readLogListState,
} from '../src/components/admin/readingLogs/readingLogParams';
import {
  DEFAULT_LOG_SORT,
  INITIAL_LOG_SEARCH,
  nextPendingLog,
  visibleLogs,
} from '../src/components/admin/readingLogs/readingLogTable';
import ReviewTargetTable from '../src/components/admin/reviews/ReviewTargetTable';
import {
  INITIAL_REVIEW_SEARCH,
  reviewFilterCounts,
  visibleReviewTargets,
} from '../src/components/admin/reviews/reviewTargetFilters';
import { clampPage } from '../src/components/admin/table/pagination';
import { nextCandidateId } from '../src/components/admin/table/queueNavigation';
import type { AdminReadingLogResponse } from '../src/types/adminReadingLogApi';

/** 가상 참가자 40명이 30일 동안 매일 낸 일지 1,200건 (대기 120 · 승인 1,050 · 반려 30) */
function bulkLogs() {
  const logs: AdminReadingLogResponse[] = [];
  for (let day = 0; day < 30; day += 1) {
    for (let person = 0; person < 40; person += 1) {
      const id = 10_000 + day * 40 + person;
      const date = `2026-11-${String(day + 1).padStart(2, '0')}`;
      logs.push({
        readingLogId: id,
        participationId: person + 1,
        userId: person + 1,
        userName: person === 0 ? '남궁가람솔빛나래하늘누리' : `참가자${person}`,
        studentNo: `2026${String(80000 + person)}`,
        eventId: 8,
        eventTitle: '제8회',
        courseId: 1 + (person % 3),
        courseName: ['단축', '하프', '풀'][person % 3],
        readingDate: date,
        totalReadPages: 30,
        convertedDistanceMeter: 150,
        // 최근 3일(120건)은 대기, 그 전 기록 중 30건은 반려, 나머지 1,050건은 승인
        status:
          day >= 27
            ? 'SUBMITTED'
            : person === 7 || (person === 8 && day < 3)
              ? 'REJECTED'
              : 'APPROVED',
        adminComment: null,
        reviewedAt: null,
        // 같은 분에 여러 건이 제출되어도 순서가 흔들리지 않는지 보려고 제출 시각을 겹칩니다.
        createdAt: `${date}T20:${String(person % 3).padStart(2, '0')}:00`,
        updatedAt: `${date}T20:00:00`,
        recommendedRejectReasons: [],
        books: [
          {
            readingLogBookId: id,
            libraryBookId: 5000 + (person % 23),
            bookTitle:
              person === 1
                ? '아주 긴 제목의 교양서: 읽은 쪽수를 거리로 바꾸는 도서관 독서마라톤의 모든 것'
                : `도서${person % 23}`,
            author: '가상 저자',
            publisher: null,
            isbn: null,
            coverImageUrl: null,
            totalBookPages: 300,
            submittedReadPages: 30,
            existingApprovedReadPages: 0,
            expectedApprovedReadPages: 30,
            remainingPagesAfterApproval: 270,
            completedAfterApproval: false,
            pageExceeded: false,
            warningMessage: null,
            displayOrder: 0,
          },
        ],
      });
    }
  }
  return logs;
}

describe('대량 독서일지 검토', () => {
  const logs = bulkLogs();
  const pending = logs.filter((log) => log.status === 'SUBMITTED');

  it('상태별 건수는 대기 120·승인 1,050·반려 30이다', () => {
    const count = (status: string) => logs.filter((log) => log.status === status).length;
    expect([count('SUBMITTED'), count('APPROVED'), count('REJECTED')]).toEqual([120, 1050, 30]);
  });

  it('1,200건 중 검토 대기만 기본으로 보고, 제출 오래된 순으로 같은 시각도 순서가 고정된다', () => {
    expect(logs).toHaveLength(1200);
    expect(pending).toHaveLength(120);
    const first = visibleLogs(pending, INITIAL_LOG_SEARCH).map((log) => log.readingLogId);
    const again = visibleLogs([...pending].reverse(), INITIAL_LOG_SEARCH).map(
      (log) => log.readingLogId,
    );
    expect(again).toEqual(first);
    const created = visibleLogs(pending, INITIAL_LOG_SEARCH).map((log) => log.createdAt);
    expect([...created].sort()).toEqual(created);
  });

  it('120건을 20건씩 6쪽으로 나누고, 처리로 마지막 쪽이 비면 남은 마지막 쪽으로 보정한다', () => {
    expect(Math.ceil(pending.length / 20)).toBe(6);
    expect(clampPage(5, 120, 20)).toBe(5);
    expect(clampPage(5, 100, 20)).toBe(4);
    // 마지막 쪽에 1건만 남은 경우
    expect(clampPage(6, 121, 20)).toBe(6);
    expect(clampPage(6, 120, 20)).toBe(5);
  });

  it('한 쪽의 마지막 일지를 처리하면 다음 쪽 첫 일지로 이어 가고 그 쪽 번호로 목록 위치를 옮긴다', () => {
    const rows = visibleLogs(pending, INITIAL_LOG_SEARCH);
    const lastOfFirstPage = rows[19];
    const after = rows.filter((row) => row !== lastOfFirstPage);
    const next = nextPendingLog(rows, lastOfFirstPage.readingLogId, after);
    expect(next).toBe(rows[20].readingLogId);
    const position = after.findIndex((row) => row.readingLogId === next);
    expect(Math.floor(position / 20)).toBe(0);
    const state = readLogListState(new URLSearchParams());
    expect(logDetailParams(new URLSearchParams(), { ...state, page: 1 }, next!).get('page')).toBe(
      '2',
    );
  });

  it('20건을 연속 처리하면 다음 대상이 매번 남은 대기 일지 안에서 정해지고 대기 수가 20건 준다', () => {
    let remaining = visibleLogs(pending, INITIAL_LOG_SEARCH);
    let current = remaining[0].readingLogId;
    const visited: number[] = [];
    for (let step = 0; step < 20; step += 1) {
      visited.push(current);
      const before = remaining;
      remaining = remaining.filter((row) => row.readingLogId !== current);
      const next = nextPendingLog(before, current, remaining);
      expect(next).not.toBeNull();
      current = next!;
    }
    expect(new Set(visited).size).toBe(20);
    expect(remaining).toHaveLength(100);
    expect(visited).toEqual(
      visibleLogs(pending, INITIAL_LOG_SEARCH)
        .slice(0, 20)
        .map((row) => row.readingLogId),
    );
  });

  it('검색 결과가 없으면 빈 목록이고, 긴 이름·도서명으로도 찾는다', () => {
    expect(visibleLogs(logs, { ...INITIAL_LOG_SEARCH, query: '없는사람' })).toHaveLength(0);
    expect(
      visibleLogs(pending, { ...INITIAL_LOG_SEARCH, query: '남궁가람' }).every(
        (log) => log.userName === '남궁가람솔빛나래하늘누리',
      ),
    ).toBe(true);
    expect(visibleLogs(pending, { ...INITIAL_LOG_SEARCH, query: '모든 것' })).toHaveLength(3);
  });

  it('목록 표는 받은 행(현재 쪽)만 그리고 1,200건 전체를 DOM에 만들지 않는다', () => {
    const rows = visibleLogs(logs, { ...INITIAL_LOG_SEARCH, sort: DEFAULT_LOG_SORT }).slice(0, 20);
    const html = renderToStaticMarkup(
      <ReadingLogQueueList
        rows={rows}
        total={1200}
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
        canSelect={() => false}
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
    expect(html.match(/class="log-queue__row"/g)).toHaveLength(20);
    expect(html).toContain('1–20 / 1,200건');
  });
});

describe('대량 서평 개별 확인', () => {
  const targets: AdminReviewTarget[] = Array.from({ length: 600 }, (_, index) => ({
    participantBookId: 20_000 + index,
    participationId: 1 + (index % 40),
    userId: 1 + (index % 40),
    userName: `참가자${index % 40}`,
    studentNo: `2026${80000 + (index % 40)}`,
    bookTitle: `도서${index % 23}`,
    author: '가상 저자',
    approvedReadPages: 90,
    distanceToCreditMeter: index % 5 === 0 ? 450 : 0,
    reviewSearchUrl: null,
    reviewSubmittedAt:
      index % 7 === 0 ? null : `2026-11-${String((index % 28) + 1).padStart(2, '0')}T09:00:00`,
    reviewVerified: index % 5 !== 0,
    reviewVerifiedAt: index % 5 !== 0 ? '2026-11-29T10:00:00' : null,
  }));

  it('확인 완료가 많아도 기본 목록은 확인 대기만 보여 주고 건수를 나눠 센다', () => {
    const counts = reviewFilterCounts(targets);
    expect(counts).toEqual({ pending: 120, verified: 480, all: 600 });
    const rows = visibleReviewTargets(targets, INITIAL_REVIEW_SEARCH);
    expect(rows).toHaveLength(120);
    expect(rows.every((row) => !row.reviewVerified)).toBe(true);
  });

  it('확인 후 다음 대상은 같은 조건의 남은 대기 대상 안에서 페이지 경계를 넘어 이어진다', () => {
    const rows = visibleReviewTargets(targets, INITIAL_REVIEW_SEARCH).map(
      (row) => row.participantBookId,
    );
    const after = rows.filter((id) => id !== rows[19]);
    expect(nextCandidateId(rows, rows[19], after)).toBe(rows[20]);
  });

  it('표는 현재 쪽의 행만 그린다', () => {
    const rows = visibleReviewTargets(targets, INITIAL_REVIEW_SEARCH).slice(0, 20);
    const html = renderToStaticMarkup(
      <ReviewTargetTable
        rows={rows}
        total={120}
        page={0}
        pageSize={20}
        search={INITIAL_REVIEW_SEARCH}
        counts={reviewFilterCounts(targets)}
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
      />,
    );
    expect(html.match(/class="review-targets__open"/g)).toHaveLength(20);
    expect(html).toContain('확인 완료 (480)');
  });
});
