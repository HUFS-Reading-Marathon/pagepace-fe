import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../src/api/apiClient';
import { approveAdminReadingLog, rejectAdminReadingLog } from '../src/api/adminReadingLogApi';
import NoticeBody from '../src/components/notices/NoticeBody';
import ReadingLogReviewPanel from '../src/components/admin/readingLogs/ReadingLogReviewPanel';
import type { AdminReadingLogResponse } from '../src/types/adminReadingLogApi';

vi.mock('../src/api/apiClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/api/apiClient')>()),
  apiRequest: vi.fn(),
}));

const log: AdminReadingLogResponse = {
  readingLogId: 1,
  participationId: 3,
  userId: 5,
  studentNo: 'demo',
  userName: '독자',
  eventId: 1,
  eventTitle: '대회',
  courseId: 2,
  courseName: '단축',
  readingDate: '2026-11-23',
  totalReadPages: 5,
  convertedDistanceMeter: 25,
  status: 'SUBMITTED',
  adminComment: null,
  reviewedAt: null,
  createdAt: '2026-11-23T10:30:00',
  updatedAt: '2026-11-23T10:30:00',
  recommendedRejectReasons: [],
  books: [
    {
      readingLogBookId: 2,
      libraryBookId: 123,
      bookTitle: '예시',
      author: null,
      publisher: null,
      isbn: null,
      coverImageUrl: null,
      totalBookPages: 25,
      submittedReadPages: 5,
      existingApprovedReadPages: 0,
      expectedApprovedReadPages: 5,
      remainingPagesAfterApproval: 20,
      completedAfterApproval: false,
      pageExceeded: false,
      warningMessage: null,
      displayOrder: 1,
    },
  ],
};
function renderLog(item: AdminReadingLogResponse) {
  return renderToStaticMarkup(
    <ReadingLogReviewPanel
      log={item}
      disabled={false}
      onApprove={async () => true}
      onReject={async () => true}
    />,
  );
}
describe('사서의 일지 처리와 공지 서식', () => {
  it('체크박스 없이 승인·반려할 수 있고 해당 서지 상세를 연다', () => {
    const html = renderLog(log);
    expect(html).toContain('https://lib.hufs.ac.kr/global/search/i-discovery/123');
    expect(html).toContain('>승인</button>');
    expect(html).toContain('>반려</button>');
    expect(html).not.toContain('checkbox');
    expect(renderLog({ ...log, status: 'APPROVED' })).not.toContain('>승인</button>');
  });
  it('서지번호가 없는 이전 기록은 도서관 검색으로 연결한다', () => {
    const html = renderLog({
      ...log,
      books: log.books.map((book) => ({ ...book, libraryBookId: null })),
    });
    expect(html).toContain('https://lib.hufs.ac.kr/global/search/i-discovery?ALL=');
  });
  it('일지에 기록된 메모와 해당 도서의 쪽수 초과를 검토할 수 있다', () => {
    const books = log.books.map((book) => ({
      ...book,
      pageExceeded: true,
      warningMessage: '전체 쪽수 초과',
    }));
    const html = renderLog({ ...log, books, memo: '첫째 줄\n둘째 줄' });
    expect(html).toContain('첫째 줄\n둘째 줄');
    expect(html).toContain('전체 쪽수 초과');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>승인<\/button>/);
    expect(renderLog({ ...log, books, status: 'APPROVED' })).not.toContain('전체 쪽수 초과');
  });
  it('승인과 반려에 실제 검토한 버전의 마이크로초를 보존해 보낸다', async () => {
    const expectedUpdatedAt = '2026-11-23T16:20:04.758643';
    await approveAdminReadingLog(7, expectedUpdatedAt);
    await rejectAdminReadingLog(7, { reason: ' 사유 ', expectedUpdatedAt });
    for (const [action, body] of [
      ['approve', { expectedUpdatedAt }],
      ['reject', { reason: '사유', expectedUpdatedAt }],
    ] as const) {
      expect(apiRequest).toHaveBeenCalledWith(
        '/api/admin/reading-logs/7/' + action,
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify(body) }),
      );
    }
  });
  it('공지 서식은 줄바꿈을 유지하고 작성한 문자열을 그대로 표시한다', () => {
    const html = renderToStaticMarkup(
      <NoticeBody content={'첫 줄\n\n  끝 <b>원문</b>'} color="RED" />,
    );
    expect(html).toContain('data-color="RED"');
    expect(html).toContain('첫 줄\n\n  끝 &lt;b&gt;원문&lt;/b&gt;');
  });
});
