import { expect, it } from 'vitest';
import type { AdminEvent } from '../src/types/adminEvent';
import { getReadingLogQueuePage, type AdminReadingLog } from '../src/types/adminReadingLog';
import { resolveAdminQueueEvent } from '../src/utils/adminEvent';

it('업무 링크가 지정한 회차를 선택하고, 사라진 회차면 다른 회차로 대체하지 않는다', () => {
  const events = [
    { eventId: 5, status: 'IN_PROGRESS' },
    { eventId: 4, status: 'FINALIZED' },
  ] as AdminEvent[];
  expect(resolveAdminQueueEvent(events, '4')).toBe(events[1]);
  expect(resolveAdminQueueEvent(events, '7')).toBeUndefined();
  expect(resolveAdminQueueEvent(events, '')).toBeUndefined();
});

it('검토 중인 일지가 속한 25건만 표시하고 페이지 경계에서 정확한 일지로 이동한다', () => {
  const logs: AdminReadingLog[] = Array.from({ length: 382 }, (_, i) => ({
    id: String(i + 1),
    participantName: '참가자',
    studentNumber: String(i + 1),
    readingDate: '2026-11-01',
    submittedAt: '2026-11-01T12:00:00',
    status: 'submit',
    books: [],
  }));
  const first = getReadingLogQueuePage(logs, -1);
  expect(first).toMatchObject({
    pageNumber: 1,
    pageCount: 16,
    previousPageId: null,
    nextPageId: '26',
  });
  expect(first.visibleLogs).toHaveLength(25);
  const next = getReadingLogQueuePage(logs, 25);
  expect(next).toMatchObject({ pageNumber: 2, previousPageId: '1', nextPageId: '51' });
  expect(next.visibleLogs[0].id).toBe(first.nextPageId);
  const last = getReadingLogQueuePage(logs, 381);
  expect(last).toMatchObject({
    pageStart: 375,
    pageNumber: 16,
    previousPageId: '351',
    nextPageId: null,
  });
  expect(last.visibleLogs).toHaveLength(7);
  expect(last.visibleLogs.at(-1)?.id).toBe('382');
});
