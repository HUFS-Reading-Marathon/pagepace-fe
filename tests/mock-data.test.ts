import { beforeEach, describe, expect, it } from 'vitest';
import { MOCK_MODE } from '../src/mocks/mockMode';
import { createMockDb, participationTotals, MOCK_ADMIN_LOGIN } from '../src/mocks/mockDb';
import { handleMockRequest, resetMockDb } from '../src/mocks/mockHandlers';

async function call(path: string, init: RequestInit & { token?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.token) headers.set('Authorization', `Bearer ${init.token}`);
  const response = await handleMockRequest(path, { ...init, headers });
  return { status: response.status, payload: await response.json() };
}

async function login(studentNo = MOCK_ADMIN_LOGIN) {
  const { payload } = await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ studentNo, password: 'any' }),
  });
  return payload.data.accessToken as string;
}

const json = (body: object): RequestInit => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('목데이터 모드 설정', () => {
  it('환경 변수를 켜지 않으면 꺼져 있다', () => {
    expect(MOCK_MODE).toBe(false);
  });
});

describe('목데이터 초기 상태', () => {
  it('고정 시드라 몇 번을 만들어도 같은 데이터가 나온다', () => {
    expect(JSON.stringify(createMockDb())).toBe(JSON.stringify(createMockDb()));
  });

  it('행사 3개와 코스·참가자·독서일지·공지 수량, 다양한 상태를 갖춘다', () => {
    const db = createMockDb();
    expect(db.events.map((event) => event.status)).toEqual([
      'IN_PROGRESS',
      'APPLICATION_OPEN',
      'FINALIZED',
    ]);
    expect(db.courses).toHaveLength(9);
    const current = db.applications.filter((item) => item.eventId === 6);
    expect(current).toHaveLength(48);
    expect(new Set(current.map((item) => item.status))).toEqual(
      new Set(['APPLIED', 'APPROVED', 'REJECTED', 'CANCELLED']),
    );
    const logs = db.logs.filter(
      (log) =>
        db.participations.find((item) => item.participationId === log.participationId)!.eventId ===
        6,
    );
    expect(logs.length).toBeGreaterThanOrEqual(60);
    // 상한 110 + 판본 연결된 도서 요청이 만든 검토 대기 일지 1건
    expect(logs.length).toBeLessThanOrEqual(111);
    expect(new Set(logs.map((log) => log.status))).toEqual(
      new Set(['SUBMITTED', 'APPROVED', 'REJECTED']),
    );
    expect(logs.some((log) => log.books.length > 1)).toBe(true);
    expect(db.notices.length).toBeGreaterThanOrEqual(10);
    expect(
      db.notices.some((notice) => notice.content.startsWith('<!-- pagepace:markdown -->')),
    ).toBe(true);
    expect(db.notices.some((notice) => !notice.content.startsWith('<!--'))).toBe(true);
    expect(new Set(db.importBatches[0].rows.map((row) => row.status))).toEqual(
      new Set([
        'MATCHED',
        'NEEDS_REVIEW',
        'ALREADY_APPLIED',
        'BOOK_VERIFIED',
        'NO_CREDIT',
        'UNMATCHED',
        'INVALID',
        'EXCLUDED',
      ]),
    );
  });

  it('완주자와 미완주자가 함께 있고, 이름·학번·이메일은 가상 값이다', () => {
    const db = createMockDb();
    const totals = db.participations
      .filter((item) => item.eventId === 6)
      .map((item) => participationTotals(db, item));
    expect(totals.some((item) => item.status === 'COMPLETED')).toBe(true);
    expect(totals.some((item) => item.status === 'APPROVED')).toBe(true);
    for (const user of db.users) {
      if (user.email) expect(user.email.endsWith('@example.com')).toBe(true);
      if (user.phone) expect(user.phone.startsWith('010-0000-')).toBe(true);
    }
  });
});

describe('목 API', () => {
  beforeEach(() => resetMockDb());

  it('로그인 없이는 관리자 API를 쓸 수 없고, 참가자 계정은 거절된다', async () => {
    expect((await call('/api/admin/events')).status).toBe(401);
    const userToken = await login(createMockDb().users[1].studentNo);
    expect((await call('/api/admin/events', { token: userToken })).status).toBe(403);
  });

  it('참가자 관리·독서일지·랭킹의 같은 참가자 정보가 서로 일치한다', async () => {
    const token = await login();
    const roster = (await call('/api/admin/participations/roster?eventId=6', { token })).payload
      .data;
    const logs = (await call('/api/admin/reading-logs?eventId=6', { token })).payload.data;
    const rankings = (await call('/api/admin/rankings?eventId=6', { token })).payload.data;
    expect(roster).toHaveLength(48);
    for (const log of logs) {
      const row = roster.find(
        (item: { participationId: number }) => item.participationId === log.participationId,
      );
      expect(row).toBeTruthy();
      expect([row.name, row.studentNo, row.courseName]).toEqual([
        log.userName,
        log.studentNo,
        log.courseName,
      ]);
    }
    const ranked = rankings.map(
      (item: { participationId: number; name: string; distance: number }) => [
        item.name,
        item.distance,
      ],
    );
    for (const [name] of ranked) {
      expect(roster.some((item: { name: string }) => item.name === name)).toBe(true);
    }
    const distances = rankings.map((item: { distance: number }) => item.distance);
    expect([...distances].sort((left, right) => right - left)).toEqual(distances);
    const ties = rankings.filter(
      (item: { rank: number }, _: number, list: { rank: number }[]) =>
        list.filter((other) => other.rank === item.rank).length > 1,
    );
    expect(ties.length).toBeGreaterThanOrEqual(2);
  });

  it('독서일지 승인은 목 상태와 집계에 반영되고, 다시 처리하면 충돌을 알린다', async () => {
    const token = await login();
    const pending = (await call('/api/admin/reading-logs?eventId=6&status=SUBMITTED', { token }))
      .payload.data;
    const target = pending.find(
      (log: { books: { pageExceeded: boolean }[] }) => !log.books.some((book) => book.pageExceeded),
    );
    const before = (await call('/api/admin/participations?eventId=6', { token })).payload.data.find(
      (item: { participationId: number }) => item.participationId === target.participationId,
    );

    const approved = await call(`/api/admin/reading-logs/${target.readingLogId}/approve`, {
      method: 'PATCH',
      token,
      ...json({ expectedUpdatedAt: target.updatedAt }),
    });
    expect(approved.status).toBe(200);
    expect(approved.payload.data.status).toBe('APPROVED');

    const after = (await call('/api/admin/participations?eventId=6', { token })).payload.data.find(
      (item: { participationId: number }) => item.participationId === target.participationId,
    );
    expect(after.totalPages).toBe(before.totalPages + target.totalReadPages);

    const again = await call(`/api/admin/reading-logs/${target.readingLogId}/reject`, {
      method: 'PATCH',
      token,
      ...json({ reason: '중복', expectedUpdatedAt: target.updatedAt }),
    });
    expect(again.status).toBe(409);
  });

  it('지원하지 않는 기능은 성공처럼 보이지 않고 501로 알린다', async () => {
    const token = await login();
    const upload = await call('/api/admin/review-imports?eventId=6', {
      method: 'POST',
      token,
      body: new FormData(),
    });
    expect(upload.status).toBe(501);
    expect(upload.payload.success).toBe(false);
    const unknown = await call('/api/admin/not-implemented', { token });
    expect(unknown.status).toBe(501);
  });

  it('공지 저장은 목 상태에만 남고 초기화하면 처음 상태로 돌아간다', async () => {
    const token = await login();
    const created = await call('/api/admin/notices', {
      method: 'POST',
      token,
      ...json({
        title: '목 공지',
        content: '본문',
        bodyColor: 'DEFAULT',
        pinned: false,
        visible: true,
      }),
    });
    expect(created.status).toBe(200);
    expect(
      (await call('/api/notices')).payload.data.some(
        (notice: { title: string }) => notice.title === '목 공지',
      ),
    ).toBe(true);
    resetMockDb();
    expect(
      (await call('/api/notices')).payload.data.some(
        (notice: { title: string }) => notice.title === '목 공지',
      ),
    ).toBe(false);
  });
});

describe('대량 검토 목데이터', () => {
  it.each(['large', 'large-pending', 'large-single', 'large-empty'] as const)(
    '%s: 40명이 30일 동안 낸 1,200건과 상태별 건수를 맞추고 ID가 겹치지 않는다',
    async (variant) => {
      const { addLargeReviewEvent, LARGE_EVENT_ID, LARGE_EXPECTED, LARGE_BOOK_REQUESTS } =
        await import('../src/mocks/mockLargeData');
      const db = createMockDb();
      const before = db.logs.length;
      addLargeReviewEvent(db, variant);
      const participationIds = new Set(
        db.participations.filter((p) => p.eventId === LARGE_EVENT_ID).map((p) => p.participationId),
      );
      expect(participationIds.size).toBe(40);
      const logs = db.logs.filter((log) => participationIds.has(log.participationId));
      expect(logs).toHaveLength(1200);
      expect(db.logs).toHaveLength(before + 1200);
      const counts = { SUBMITTED: 0, APPROVED: 0, REJECTED: 0 };
      for (const log of logs) counts[log.status] += 1;
      expect(counts).toEqual(LARGE_EXPECTED[variant]);
      // 도서 확인 요청: 확인 대기 건수는 variant별, 처리 기록은 이관 6·반려 4건이며 요청 번호가 겹치지 않는다
      const requests = db.bookRequests.filter((item) => item.eventId === LARGE_EVENT_ID);
      const requestCounts = { PENDING: 0, LINKED: 0, REJECTED: 0 };
      for (const item of requests) requestCounts[item.status] += 1;
      expect(requestCounts).toEqual({
        PENDING: LARGE_BOOK_REQUESTS[variant],
        LINKED: 6,
        REJECTED: 4,
      });
      expect(new Set(db.bookRequests.map((item) => item.id)).size).toBe(db.bookRequests.length);
      for (const item of requests) expect(participationIds.has(item.participationId)).toBe(true);
      // ID 정합성: 일지·참가·참가 도서·사용자 ID가 다른 행사와 겹치지 않는다
      for (const key of ['readingLogId'] as const)
        expect(new Set(db.logs.map((log) => log[key])).size).toBe(db.logs.length);
      expect(new Set(db.participantBooks.map((b) => b.participantBookId)).size).toBe(
        db.participantBooks.length,
      );
      expect(new Set(db.users.map((u) => u.userId)).size).toBe(db.users.length);
      for (const log of logs) {
        const p = db.participations.find((item) => item.participationId === log.participationId)!;
        expect(db.users.some((u) => u.userId === p.userId)).toBe(true);
        for (const line of log.books)
          expect(db.library.some((b) => b.libraryBookId === line.libraryBookId)).toBe(true);
      }
      // 승인 누적은 책 전체 쪽수를 넘지 않는다(쪽수 초과는 검토 대기 일지에만 둔다)
      const approved = new Map<string, number>();
      for (const log of logs.filter((item) => item.status === 'APPROVED'))
        for (const line of log.books) {
          const k = log.participationId + ':' + line.libraryBookId;
          approved.set(k, (approved.get(k) ?? 0) + line.submittedReadPages);
        }
      for (const [k, pages] of approved) {
        const book = db.library.find((b) => b.libraryBookId === Number(k.split(':')[1]))!;
        expect(pages).toBeLessThanOrEqual(book.pageCount);
      }
      expect(logs.some((log) => log.books.length > 1)).toBe(true);
    },
  );
});
