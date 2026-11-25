/*
 * 목데이터 API. apiClient가 목데이터 모드에서 fetch 대신 이 함수를 부릅니다(개발 서버 전용).
 * 실제 서버로는 요청을 보내지 않으며, 지원하지 않는 요청은 성공처럼 꾸미지 않고 501로 알립니다.
 * 응답 형식은 실제 API와 같은 { success, code, message, data }입니다.
 */
import type { AdminEvent } from '../types/adminEvent';
import type { AdminReadingLogResponse } from '../types/adminReadingLogApi';
import type { AdminReviewTarget, ApprovedBookLog } from '../api/adminReadingLogApi';
import type { ImportedReview, ReviewImportBatch } from '../api/reviewImportApi';
import type { Ranking } from '../api/rankingApi';
import type { RosterRow } from '../api/adminRosterApi';
import type { Inquiry } from '../api/inquiryApi';
import { getAccessToken } from '../auth/authStorage';
import {
  METERS_PER_PAGE,
  approvedPagesFor,
  bookCredit,
  createMockDb,
  participationTotals,
  type MockDb,
  type MockParticipation,
  type MockParticipantBook,
  type MockUser,
} from './mockDb';
import { addLargeReviewEvent, mockDatasetVariant } from './mockLargeData';
import { mockCoverUrl } from './mockCovers';
import { maskName } from '../utils/nameMask';
import { canSubmitReadingLog, koreaToday } from '../utils/eventSelection';
import type { BookRequest } from '../api/bookRequestApi';
import type { MyParticipation } from '../types/participation';
import {
  EXCEL_TYPE,
  booksReport,
  journalsReport,
  participantsReport,
  reportScenario,
  validateReportUpload,
} from './mockReports';

type Body = Record<string, unknown>;

/** 대량 검증 데이터 스위치(mockLargeData.ts)가 켜져 있으면 제8회 행사를 더합니다. */
function createDb() {
  const next = createMockDb();
  const variant = mockDatasetVariant();
  if (variant) addLargeReviewEvent(next, variant);
  return next;
}

let db: MockDb = createDb();

/** 테스트용: 목 상태를 처음으로 되돌립니다. */
export function resetMockDb() {
  db = createDb();
}

/**
 * 검토 실패 재현 스위치(개발 서버 목데이터 모드 전용).
 * localStorage.setItem('pagepace:mock:review-scenario', 'conflict')처럼 지정하고 removeItem으로 되돌립니다.
 * - approve-error: 일지 승인·반려와 서평 확인이 500(서버 오류)으로 실패하고 아무것도 바뀌지 않습니다.
 * - conflict: 다른 관리자가 먼저 바꾼 것처럼 409(READING_LOG_CHANGED·REVIEW_TOTALS_CHANGED)로 실패합니다.
 * - next-list-error: 처리는 성공하고, 바로 다음 목록 조회 한 번만 500으로 실패합니다.
 */
export const REVIEW_SCENARIO_KEY = 'pagepace:mock:review-scenario';
function reviewScenario() {
  try {
    return localStorage.getItem(REVIEW_SCENARIO_KEY);
  } catch {
    return null;
  }
}
let failNextList = false;
function nextListFailure() {
  if (!failNextList) return null;
  failNextList = false;
  return fail(500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다.');
}

/**
 * 운영 현황 조회 실패·지연 재현 스위치(개발 서버 목데이터 모드 전용).
 * localStorage.setItem('pagepace:mock:dashboard-scenario', 'review-error')처럼 지정하고 removeItem으로 되돌립니다.
 * - slow: 참가신청·독서일지·서평 대상 목록 조회가 3초 늦게 응답합니다.
 * - review-error: 서평 확인 대상 목록 조회만 500으로 실패합니다.
 * - list-error: 참가신청 목록 조회가 500으로 실패합니다(운영 현황 전체 조회 실패).
 */
export const DASHBOARD_SCENARIO_KEY = 'pagepace:mock:dashboard-scenario';
const DASHBOARD_LISTS = /^\/api\/admin\/(applications|reading-logs|reading-logs\/review-targets)$/;
async function dashboardScenario(method: string, pathname: string) {
  let scenario: string | null;
  try {
    scenario = localStorage.getItem(DASHBOARD_SCENARIO_KEY);
  } catch {
    return null;
  }
  if (method !== 'GET' || !scenario) return null;
  const list = pathname.match(DASHBOARD_LISTS)?.[1];
  if (!list) return null;
  if (scenario === 'slow') await new Promise((resolve) => setTimeout(resolve, 3000));
  if (
    (scenario === 'review-error' && list === 'reading-logs/review-targets') ||
    (scenario === 'list-error' && list === 'applications')
  ) {
    return fail(500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다.');
  }
  return null;
}

/**
 * 도서 확인 요청 실패·지연 재현 스위치(개발 서버 목데이터 모드 전용).
 * localStorage.setItem('pagepace:mock:book-request-scenario', 'search-error')처럼 지정하고 removeItem으로 되돌립니다.
 * - search-slow: 소장 서지 검색이 2초 늦게 응답합니다.
 * - search-error: 소장 서지 검색이 500으로 실패합니다.
 * - process-error: 이관·반려가 500으로 실패하고 아무것도 바뀌지 않습니다.
 * - conflict: 다른 관리자가 먼저 처리한 것처럼 409(BOOK_REQUEST_PROCESSED)로 실패합니다.
 */
export const BOOK_REQUEST_SCENARIO_KEY = 'pagepace:mock:book-request-scenario';
async function bookRequestScenario(method: string, pathname: string) {
  let scenario: string | null;
  try {
    scenario = localStorage.getItem(BOOK_REQUEST_SCENARIO_KEY);
  } catch {
    return null;
  }
  if (!scenario) return null;
  if (method === 'GET' && pathname === '/api/books/search') {
    if (scenario === 'search-slow') await new Promise((resolve) => setTimeout(resolve, 2000));
    if (scenario === 'search-error')
      return fail(500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다.');
  }
  if (method === 'PATCH' && /^\/api\/admin\/book-requests\/\d+\/(approve|reject)$/.test(pathname)) {
    if (scenario === 'process-error')
      return fail(500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다.');
    if (scenario === 'conflict')
      return fail(
        409,
        'BOOK_REQUEST_PROCESSED',
        '이미 처리된 요청입니다. 현재 상태를 확인해 주세요.',
      );
  }
  return null;
}

const TOKEN_PREFIX = 'mock-token-';
const nowIso = () => new Date().toISOString().slice(0, 19);
const delay = () => new Promise((resolve) => setTimeout(resolve, 120 + Math.random() * 180));

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify({ success: true, code: 'OK', message: '', data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fail(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ success: false, code, message, data: null }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const notFound = (what: string) => fail(404, 'NOT_FOUND', `${what}을(를) 찾을 수 없습니다.`);
const unsupported = (what: string) =>
  fail(501, 'MOCK_UNSUPPORTED', `목데이터 모드에서는 ${what}을(를) 지원하지 않습니다.`);

/* ---------- 조회 도우미 ---------- */

const user = (userId: number) => db.users.find((item) => item.userId === userId)!;
const eventOf = (eventId: number) => db.events.find((item) => item.eventId === eventId);
const courseOf = (courseId: number) => db.courses.find((item) => item.courseId === courseId)!;
const libraryBook = (libraryBookId: number) =>
  db.library.find((item) => item.libraryBookId === libraryBookId)!;
const participationOf = (participationId: number) =>
  db.participations.find((item) => item.participationId === participationId);

function toAuthUser(item: MockUser) {
  return {
    userId: item.userId,
    studentNo: item.studentNo,
    name: item.name,
    email: item.email,
    phone: item.phone,
    affiliationType: item.affiliationType,
    department: item.department,
    role: item.role,
    status: 'ACTIVE',
    active: true,
  };
}

function toPublicEvent(event: AdminEvent) {
  return {
    eventId: event.eventId,
    title: event.title,
    roundNo: event.roundNo,
    applicationStartDate: event.applicationStartDate,
    applicationEndDate: event.applicationEndDate,
    eventStartDate: event.eventStartDate,
    eventEndDate: event.eventEndDate,
    status: event.status,
    description: event.description,
    contactPhone: event.contactPhone,
    contactEmail: event.contactEmail,
    kakaoOpenChatUrl: event.kakaoOpenChatUrl,
  };
}

const coursesFor = (eventId: number) =>
  db.courses
    .filter((course) => course.eventId === eventId)
    .sort((left, right) => left.displayOrder - right.displayOrder);

function stripCourse(course: (typeof db.courses)[number]) {
  const { eventId: _eventId, ...rest } = course;
  void _eventId;
  return rest;
}

function toAdminParticipation(participation: MockParticipation) {
  const totals = participationTotals(db, participation);
  const member = user(participation.userId);
  return {
    participationId: participation.participationId,
    eventId: participation.eventId,
    courseId: participation.courseId,
    courseName: totals.course.name,
    userId: member.userId,
    studentNo: member.studentNo,
    name: member.name,
    department: member.department,
    affiliationType: member.affiliationType,
    status: totals.status,
    totalPages: totals.totalPages,
    totalDistanceMeter: totals.totalDistanceMeter,
    completedAt: totals.completedAt,
  };
}

function toMyParticipation(participation: MockParticipation) {
  const totals = participationTotals(db, participation);
  const event = eventOf(participation.eventId)!;
  return {
    participationId: participation.participationId,
    eventId: event.eventId,
    eventTitle: event.title,
    roundNo: event.roundNo,
    eventStatus: event.status,
    eventStartDate: event.eventStartDate,
    eventEndDate: event.eventEndDate,
    courseId: totals.course.courseId,
    courseName: totals.course.name,
    targetDistanceMeter: totals.course.targetDistanceMeter,
    standardBookCount: totals.course.standardBookCount,
    participationStatus: totals.status,
    totalPages: totals.totalPages,
    totalDistanceMeter: totals.totalDistanceMeter,
    progressRate:
      Math.round((totals.totalDistanceMeter / totals.course.targetDistanceMeter) * 1000) / 10,
    completedAt: totals.completedAt,
    completionRank: null,
    approvedAt: participation.approvedAt,
  };
}

function toApplication(applicationId: number) {
  const application = db.applications.find((item) => item.applicationId === applicationId)!;
  const member = user(application.userId);
  return {
    applicationId: application.applicationId,
    eventId: application.eventId,
    eventTitle: eventOf(application.eventId)!.title,
    courseId: application.courseId,
    courseName: courseOf(application.courseId).name,
    name: member.name,
    studentNo: member.studentNo,
    email: member.email ?? '',
    phone: member.phone,
    affiliationType: member.affiliationType,
    department: member.department,
    status: application.status,
    appliedAt: application.appliedAt,
  };
}

function rosterRows(eventId: number): RosterRow[] {
  const rows: Omit<RosterRow, 'serialNo'>[] = [];
  const row = (
    member: MockUser,
    courseId: number,
    applicationId: number | null,
    participation: MockParticipation | undefined,
    applicationStatus: RosterRow['applicationStatus'],
    registeredAt: string,
    rejectReason: string | null,
  ) => ({
    applicationId,
    participationId: participation?.participationId ?? null,
    eventId,
    courseId,
    courseName: courseOf(courseId).name,
    studentNo: member.studentNo,
    name: member.name,
    email: member.email ?? '',
    phone: member.phone,
    affiliationType: member.affiliationType,
    department: member.department,
    college: member.college,
    grade: member.grade,
    gender: member.gender,
    applicationStatus,
    participationStatus: participation
      ? (participationTotals(db, participation).status as RosterRow['participationStatus'])
      : null,
    registeredAt,
    rejectReason,
  });

  for (const application of db.applications.filter((item) => item.eventId === eventId)) {
    const participation = db.participations.find(
      (item) => item.applicationId === application.applicationId,
    );
    rows.push(
      row(
        user(application.userId),
        participation?.courseId ?? application.courseId,
        application.applicationId,
        participation,
        application.status,
        application.appliedAt,
        application.rejectReason,
      ),
    );
  }
  for (const participation of db.participations.filter(
    (item) => item.eventId === eventId && item.applicationId === null,
  )) {
    rows.push(
      row(
        user(participation.userId),
        participation.courseId,
        null,
        participation,
        null,
        participation.approvedAt,
        null,
      ),
    );
  }
  return rows
    .sort((left, right) => left.registeredAt.localeCompare(right.registeredAt))
    .map((item, index) => ({ ...item, serialNo: index + 1 }));
}

function toAdminLog(log: (typeof db.logs)[number]): AdminReadingLogResponse {
  const participation = participationOf(log.participationId)!;
  const member = user(participation.userId);
  const event = eventOf(participation.eventId)!;
  const course = courseOf(participation.courseId);
  const books = log.books.map((book) => {
    const library = libraryBook(book.libraryBookId);
    const approvedOthers = db.logs
      .filter(
        (item) =>
          item.participationId === log.participationId &&
          item.status === 'APPROVED' &&
          item.readingLogId !== log.readingLogId,
      )
      .flatMap((item) => item.books)
      .filter((item) => item.libraryBookId === book.libraryBookId)
      .reduce((sum, item) => sum + item.submittedReadPages, 0);
    const expected = approvedOthers + book.submittedReadPages;
    const exceeded = expected > library.pageCount;
    return {
      readingLogBookId: book.readingLogBookId,
      libraryBookId: library.libraryBookId,
      bookTitle: library.title,
      author: library.author,
      publisher: library.publisher,
      isbn: library.isbn,
      callNo: library.callNo,
      coverImageUrl: null,
      totalBookPages: library.pageCount,
      submittedReadPages: book.submittedReadPages,
      existingApprovedReadPages: approvedOthers,
      expectedApprovedReadPages: Math.min(expected, library.pageCount),
      remainingPagesAfterApproval: Math.max(0, library.pageCount - expected),
      completedAfterApproval: expected >= library.pageCount,
      pageExceeded: exceeded,
      warningMessage: exceeded
        ? `누적 독서량(${expected}쪽)이 책 전체 페이지 수(${library.pageCount}쪽)를 초과합니다.`
        : null,
      displayOrder: book.displayOrder,
    };
  });
  return {
    readingLogId: log.readingLogId,
    participationId: participation.participationId,
    userId: member.userId,
    studentNo: member.studentNo,
    userName: member.name,
    eventId: event.eventId,
    eventTitle: event.title,
    courseId: course.courseId,
    courseName: course.name,
    readingDate: log.readingDate,
    totalReadPages: log.books.reduce((sum, book) => sum + book.submittedReadPages, 0),
    convertedDistanceMeter:
      log.books.reduce((sum, book) => sum + book.submittedReadPages, 0) * METERS_PER_PAGE,
    status: log.status,
    memo: log.memo,
    adminComment: log.adminComment,
    reviewedAt: log.reviewedAt,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
    books,
    recommendedRejectReasons: [
      '쪽수 중복',
      '도서 정보 불일치',
      '누적 독서량이 책 전체 페이지 수를 초과함',
      '하루 독서량이 400쪽을 초과함',
      '제외 도서에 해당함',
    ],
  };
}

function toReviewTarget(book: MockParticipantBook): AdminReviewTarget {
  const participation = participationOf(book.participationId)!;
  const member = user(participation.userId);
  const library = libraryBook(book.libraryBookId);
  const credit = bookCredit(db, book);
  return {
    participantBookId: book.participantBookId,
    participationId: participation.participationId,
    userId: member.userId,
    userName: member.name,
    studentNo: member.studentNo,
    bookTitle: library.title,
    author: library.author,
    approvedReadPages: credit.approvedPages,
    distanceToCreditMeter: credit.uncreditedPages * METERS_PER_PAGE,
    reviewSearchUrl: `https://lib.hufs.ac.kr/global/?mock-review=${book.participantBookId}`,
    reviewSubmittedAt: book.reviewSubmittedAt,
    reviewVerified: !!credit.evidence,
    reviewVerifiedAt: credit.evidence?.verifiedAt ?? null,
  };
}

const eventBooks = (eventId: number) =>
  db.participantBooks.filter((book) => {
    const participation = participationOf(book.participationId);
    return (
      participation?.eventId === eventId &&
      participation.baseStatus === 'APPROVED' &&
      approvedPagesFor(db, book.participationId, book.libraryBookId) > 0
    );
  });

function toImportedRow(row: (typeof db.importBatches)[number]['rows'][number]): ImportedReview {
  const { candidateBookIds, ...rest } = row;
  return {
    ...rest,
    candidates: candidateBookIds.map((participantBookId) => {
      const book = db.participantBooks.find(
        (item) => item.participantBookId === participantBookId,
      )!;
      const participation = participationOf(book.participationId)!;
      const member = user(participation.userId);
      const library = libraryBook(book.libraryBookId);
      const credit = bookCredit(db, book);
      return {
        participantBookId,
        name: member.name,
        studentNo: member.studentNo,
        bookTitle: library.title,
        libraryBookId: library.libraryBookId,
        approvedPages: credit.approvedPages,
        uncreditedPages: credit.uncreditedPages,
        distanceToCreditMeter: credit.uncreditedPages * METERS_PER_PAGE,
        matchType: row.libraryBookId === library.libraryBookId ? 'LIBRARY_ID' : 'TITLE',
      };
    }),
  };
}

function toBatch(batch: (typeof db.importBatches)[number]): ReviewImportBatch {
  return {
    id: batch.id,
    eventId: batch.eventId,
    eventTitle: eventOf(batch.eventId)!.title,
    filename: batch.filename,
    rowCount: batch.rows.length,
    createdAt: batch.createdAt,
    uploadedBy: batch.uploadedBy,
  };
}

function verifyBook(
  book: MockParticipantBook,
  input: {
    sourceUpdatedAt: string | null;
    sourceContent: string | null;
    note: string | null;
    sourceType: string;
  },
) {
  const credit = bookCredit(db, book);
  const evidence = {
    id: db.seq.evidence++,
    sourceUpdatedAt: input.sourceUpdatedAt,
    creditedPages: credit.approvedPages,
    sourceType: input.sourceType,
    verifiedBy: '도서관 관리자',
    verifiedAt: nowIso(),
    revokedAt: null,
    revokeReason: null,
    sourceContent: input.sourceContent,
    note: input.note,
    revokedBy: null,
  };
  book.evidence.push(evidence);
  // 같은 책을 가리키던 엑셀 대조 행은 '처리 완료'로 바뀝니다.
  for (const batch of db.importBatches) {
    for (const row of batch.rows) {
      if (
        row.candidateBookIds.includes(book.participantBookId) &&
        (row.status === 'MATCHED' || row.status === 'NEEDS_REVIEW')
      ) {
        row.status = 'BOOK_VERIFIED';
      }
    }
  }
  return evidence;
}

function rankingsFor(
  eventId: number,
  courseId: number | null,
  sort: string,
  admin: boolean,
): Ranking[] {
  const rows = db.participations
    .filter((item) => item.eventId === eventId && item.baseStatus === 'APPROVED')
    .filter((item) => !courseId || item.courseId === courseId)
    .map((item) => {
      const totals = participationTotals(db, item);
      const member = user(item.userId);
      return {
        participationId: item.participationId,
        courseId: totals.course.courseId,
        courseName: totals.course.name,
        targetDistance: totals.course.targetDistanceMeter,
        status: totals.status,
        name: member.name,
        ...(admin ? { studentNo: member.studentNo } : {}),
        approvedPages: totals.totalPages,
        distance: totals.totalDistanceMeter,
        progressPercent:
          Math.round((totals.totalDistanceMeter / totals.course.targetDistanceMeter) * 1000) / 10,
        awardStatus: 'NONE' as const,
      };
    })
    .sort(
      (left, right) => right.distance - left.distance || right.approvedPages - left.approvedPages,
    );
  // 공동 순위: 인정 거리와 승인 쪽수가 같으면 같은 순위
  const ranked = rows.map((item, index) => {
    const first = rows.findIndex(
      (other) => other.distance === item.distance && other.approvedPages === item.approvedPages,
    );
    return { ...item, rank: (first === -1 ? index : first) + 1 };
  });
  const sorted =
    sort === 'NAME'
      ? ranked.sort((left, right) => left.name.localeCompare(right.name, 'ko'))
      : ranked;
  // 공개 랭킹은 운영 서버(RankingService)처럼 정렬 후 이름을 가려서 내려 줍니다. 관리자는 전체 이름·학번.
  return admin ? sorted : sorted.map((row) => ({ ...row, name: maskName(row.name) }));
}

function eventSummary(eventId: number, courseId: number | null) {
  const list = db.participations
    .filter((item) => item.eventId === eventId && item.baseStatus === 'APPROVED')
    .filter((item) => !courseId || item.courseId === courseId)
    .map((item) => participationTotals(db, item));
  return {
    eventId,
    courseId,
    participantCount: list.length,
    completedCount: list.filter((item) => item.status === 'COMPLETED').length,
    approvedPages: list.reduce((sum, item) => sum + item.totalPages, 0),
    verifiedDistanceMeter: list.reduce((sum, item) => sum + item.totalDistanceMeter, 0),
    maxDistanceMeter: Math.max(0, ...list.map((item) => item.totalDistanceMeter)),
  };
}

/** 서버와 같이 관리자 목록에서만 작성자 이름을 내려 줍니다(사용자 목록은 authorName: null). */
function inquiryListing(items: Inquiry[], page: number, showAuthor = false) {
  const size = 15;
  const sorted = [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return {
    items: sorted
      .slice(page * size, page * size + size)
      .map((item) => (showAuthor ? item : { ...item, authorName: null })),
    total: sorted.length,
    pages: Math.max(1, Math.ceil(sorted.length / size)),
  };
}

const matches = (value: string | null | undefined, query: string) =>
  (value ?? '').toLowerCase().includes(query.trim().toLowerCase());

/* ---------- 라우팅 ---------- */

type Context = {
  method: string;
  url: URL;
  body: Body;
  rawBody: BodyInit | null | undefined;
  me: MockUser | null;
};
type Handler = (context: Context, match: RegExpMatchArray) => Response | Promise<Response>;

const routes: [string, RegExp, Handler][] = [];
const route = (method: string, pattern: RegExp, handler: Handler) =>
  routes.push([method, pattern, handler]);
const requireAdmin =
  (handler: Handler): Handler =>
  (context, match) => {
    if (!context.me) return fail(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
    if (context.me.role !== 'ADMIN') return fail(403, 'FORBIDDEN', '관리자만 사용할 수 있습니다.');
    return handler(context, match);
  };
const requireUser =
  (handler: Handler): Handler =>
  (context, match) =>
    context.me ? handler(context, match) : fail(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
const numberParam = (url: URL, key: string) => {
  const value = Number(url.searchParams.get(key));
  return Number.isInteger(value) && value > 0 ? value : null;
};

/* 인증: 목 사용자의 학번(관리자는 mockadmin)으로 로그인하며 비밀번호는 확인하지 않습니다. */
route('POST', /^\/api\/auth\/login$/, ({ body }) => {
  const member = db.users.find((item) => item.studentNo === String(body.studentNo ?? '').trim());
  if (!member || !String(body.password ?? '')) {
    return fail(
      401,
      'INVALID_CREDENTIALS',
      '목데이터 계정이 아닙니다. mockadmin 또는 목 참가자 학번으로 로그인하세요.',
    );
  }
  return respond({ accessToken: `${TOKEN_PREFIX}${member.userId}` });
});
route('POST', /^\/api\/auth\/refresh$/, () => {
  // 결과 보고서 'unauthorized' 시나리오: 갱신은 성공시켜, 갱신 뒤에도 보고서 요청만 401을 받는 운영 증상을 재현합니다.
  if (reportScenario() === 'unauthorized') {
    const stored = getAccessToken();
    if (stored?.startsWith(TOKEN_PREFIX)) return respond({ accessToken: stored });
  }
  return fail(401, 'INVALID_REFRESH', '목데이터 모드에서는 다시 로그인해 주세요.');
});
route('POST', /^\/api\/auth\/logout$/, () => respond(null));
route(
  'GET',
  /^\/api\/me$/,
  requireUser(({ me }) => respond(toAuthUser(me!))),
);
route(
  'GET',
  /^\/api\/me\/participations$/,
  requireUser(({ me }) =>
    respond(db.participations.filter((item) => item.userId === me!.userId).map(toMyParticipation)),
  ),
);
route(
  'GET',
  /^\/api\/me\/participations\/current$/,
  requireUser(({ me, url }) => {
    const eventId =
      numberParam(url, 'eventId') ??
      db.events.find((item) => item.status === 'IN_PROGRESS')?.eventId;
    const participation = db.participations.find(
      (item) => item.userId === me!.userId && item.eventId === eventId,
    );
    return participation
      ? respond(toMyParticipation(participation))
      : fail(404, 'PARTICIPATION_NOT_FOUND', '참가 정보가 없습니다.');
  }),
);
/* 사용자: 책별 독서·서평 현황. 서버와 같이 승인 쪽수가 있는 참가 도서만 다루고, 서평 확인(증빙)이 있으면
 * 승인 쪽수 전체를 거리로 인정합니다. 학생의 작성 신고(reviewSubmittedAt)는 확인 여부와 무관합니다. */
function myBooks(me: MockUser, url: URL) {
  const eventId =
    numberParam(url, 'eventId') ?? db.events.find((item) => item.status === 'IN_PROGRESS')?.eventId;
  const participation = db.participations.find(
    (item) => item.userId === me.userId && item.eventId === eventId,
  );
  if (!participation) return null;
  return db.participantBooks
    .filter((book) => book.participationId === participation.participationId)
    .map((book) => {
      const library = libraryBook(book.libraryBookId);
      const credit = bookCredit(db, book);
      const reviewVerified = !!credit.evidence;
      return {
        participantBookId: book.participantBookId,
        participationId: book.participationId,
        libraryBookId: library.libraryBookId,
        bookTitle: library.title,
        author: library.author,
        publisher: library.publisher,
        isbn: library.isbn,
        coverImageUrl: mockCoverUrl(library.title),
        callNo: library.callNo,
        totalBookPages: library.pageCount,
        approvedReadPages: credit.approvedPages,
        remainingPages: Math.max(0, library.pageCount - credit.approvedPages),
        completed: credit.approvedPages >= library.pageCount,
        completedAt: null,
        reviewRequired: credit.approvedPages > 0,
        reviewSearchUrl: `https://lib.hufs.ac.kr/global/search?query=${encodeURIComponent(library.title)}`,
        reviewCompleted: reviewVerified || !!book.reviewSubmittedAt,
        reviewCompletedAt: book.reviewSubmittedAt,
        reviewVerified,
        creditedReadPages: credit.creditedPages,
      };
    })
    .filter((book) => book.approvedReadPages > 0);
}
route(
  'GET',
  /^\/api\/me\/(book-progress|reading-books|review-target-books)$/,
  requireUser(({ me, url }, [, kind]) => {
    const books = myBooks(me!, url);
    if (!books) return fail(404, 'PARTICIPATION_NOT_FOUND', '참가 정보가 없습니다.');
    if (kind === 'reading-books') return respond(books.filter((book) => !book.completed));
    // 서평 대상: 승인 쪽수가 있고 서평 확인(또는 이전 신고)이 없는 책(서버 쿼리와 같음)
    if (kind === 'review-target-books')
      return respond(books.filter((book) => !book.reviewCompleted));
    return respond(books);
  }),
);
/** 사용자 독서일지 응답(목록·상세 공통) */
const toUserLog = (log: MockDb['logs'][number]) => ({
  readingLogId: log.readingLogId,
  participationId: log.participationId,
  readingDate: log.readingDate,
  totalReadPages: log.books.reduce((sum, book) => sum + book.submittedReadPages, 0),
  convertedDistanceMeter:
    log.books.reduce((sum, book) => sum + book.submittedReadPages, 0) * METERS_PER_PAGE,
  status: log.status,
  adminComment: log.adminComment,
  reviewedAt: log.reviewedAt,
  createdAt: log.createdAt,
  updatedAt: log.updatedAt,
  books: log.books.map((book) => {
    const library = libraryBook(book.libraryBookId);
    return {
      readingLogBookId: book.readingLogBookId,
      displayOrder: book.displayOrder,
      libraryBookId: library.libraryBookId,
      bookTitle: library.title,
      author: library.author,
      publisher: library.publisher,
      isbn: library.isbn,
      // 목데이터 전용 표지(src/mocks/covers/). 없으면 null로 두어 대체 표지가 보입니다.
      coverImageUrl: mockCoverUrl(library.title),
      callNo: library.callNo,
      totalBookPages: library.pageCount,
      readPages: book.submittedReadPages,
    };
  }),
});

route(
  'GET',
  /^\/api\/participations\/(\d+)\/reading-logs$/,
  requireUser(({ me }, [, id]) => {
    const participation = participationOf(Number(id));
    if (!participation || (participation.userId !== me!.userId && me!.role !== 'ADMIN'))
      return notFound('참가 정보');
    return respond(
      db.logs.filter((log) => log.participationId === participation.participationId).map(toUserLog),
    );
  }),
);
/* 사용자: 독서일지 한 건(수정 화면). 본인 참가 회차의 일지만 내려 줍니다. */
route(
  'GET',
  /^\/api\/reading-logs\/(\d+)$/,
  requireUser(({ me }, [, id]) => {
    const log = db.logs.find((item) => item.readingLogId === Number(id));
    const participation = log && participationOf(log.participationId);
    if (!log || !participation || participation.userId !== me!.userId)
      return fail(404, 'READING_LOG_NOT_FOUND', '독서일지를 찾을 수 없습니다.');
    return respond(toUserLog(log));
  }),
);

/* 공개 */
const publicEvents = () =>
  db.events.filter((item) => item.publicVisible && !['DRAFT', 'ARCHIVED'].includes(item.status));
route('GET', /^\/api\/events$/, () => respond(publicEvents().map(toPublicEvent)));
route('GET', /^\/api\/events\/current$/, () => {
  const current = publicEvents().find((item) => item.status === 'IN_PROGRESS') ?? publicEvents()[0];
  return current
    ? respond(toPublicEvent(current))
    : fail(404, 'EVENT_NOT_FOUND', '공개된 행사가 없습니다.');
});
route('GET', /^\/api\/events\/(\d+)$/, (_, [, id]) => {
  const event = eventOf(Number(id));
  return event
    ? respond(toPublicEvent(event))
    : fail(404, 'EVENT_NOT_FOUND', '행사를 찾을 수 없습니다.');
});
route('GET', /^\/api\/events\/(\d+)\/courses$/, (_, [, id]) =>
  respond(coursesFor(Number(id)).map(stripCourse)),
);
route('GET', /^\/api\/(admin\/)?events\/(\d+)\/summary$/, ({ url }, [, , id]) =>
  respond(eventSummary(Number(id), numberParam(url, 'courseId'))),
);
route('GET', /^\/api\/notices$/, () => respond(db.notices.filter((item) => item.visible)));
route('GET', /^\/api\/notices\/(\d+)$/, (_, [, id]) => {
  const notice = db.notices.find((item) => item.noticeId === Number(id) && item.visible);
  return notice ? respond(notice) : fail(404, 'NOTICE_NOT_FOUND', '공지사항을 찾을 수 없습니다.');
});
route('GET', /^\/api\/rankings$/, ({ url }) =>
  respond(
    rankingsFor(
      numberParam(url, 'eventId') ?? 0,
      numberParam(url, 'courseId'),
      url.searchParams.get('sort') ?? 'RANK',
      false,
    ),
  ),
);
route('GET', /^\/api\/inquiries$/, ({ url }) => {
  const faq = url.searchParams.get('kind') === 'FAQ';
  const query = url.searchParams.get('q') ?? '';
  const items = db.inquiries.filter(
    (item) =>
      item.kind === (faq ? 'FAQ' : 'QUESTION') &&
      item.publicEntry &&
      (faq || item.answer) &&
      (matches(item.title, query) || matches(item.content, query) || matches(item.answer, query)),
  );
  return respond(inquiryListing(items, Number(url.searchParams.get('page') ?? 0)));
});
route(
  'GET',
  /^\/api\/me\/inquiries$/,
  requireUser(({ me, url }) => {
    const query = url.searchParams.get('q') ?? '';
    const items = db.inquiries.filter(
      (item) =>
        item.kind === 'QUESTION' &&
        item.authorName === me!.name &&
        (matches(item.title, query) || matches(item.content, query) || matches(item.answer, query)),
    );
    return respond(inquiryListing(items, Number(url.searchParams.get('page') ?? 0)));
  }),
);
route(
  'POST',
  /^\/api\/me\/inquiries$/,
  requireUser(({ me, body }) => {
    // 서버와 같이 참가 신청이 승인된 일반 회원만 문의할 수 있습니다.
    const approved = db.applications.some(
      (application) => application.userId === me!.userId && application.status === 'APPROVED',
    );
    if (me!.role !== 'USER' || !approved)
      return fail(403, 'APPROVAL_REQUIRED', '참가 신청이 승인된 회원이 문의할 수 있습니다.');
    const item: Inquiry = {
      id: Math.max(0, ...db.inquiries.map((entry) => entry.id)) + 1,
      kind: 'QUESTION',
      title: String(body.title ?? ''),
      content: String(body.content ?? ''),
      answer: null,
      publicEntry: !!body.publicEntry,
      authorName: me!.name,
      createdAt: nowIso(),
      answeredAt: null,
      version: 1,
    };
    db.inquiries.push(item);
    return respond(item);
  }),
);
/* 사용자: 도서 확인 요청(문의 게시판의 도서 문의). 서버와 같이 본인 참가 회차의 요청만 다룹니다. */
route(
  'GET',
  /^\/api\/me\/book-requests$/,
  requireUser(({ me, url }) => {
    const participation = db.participations.find(
      (item) => item.userId === me!.userId && item.eventId === numberParam(url, 'eventId'),
    );
    if (!participation)
      return fail(404, 'PARTICIPATION_NOT_FOUND', '본인의 참가 정보를 찾을 수 없습니다.');
    return respond(
      db.bookRequests
        .filter((item) => item.participationId === participation.participationId)
        .sort((left, right) => right.id - left.id),
    );
  }),
);
route(
  'POST',
  /^\/api\/me\/book-requests$/,
  requireUser(({ me, body }) => {
    const participation = db.participations.find(
      (item) => item.participationId === Number(body.participationId) && item.userId === me!.userId,
    );
    if (!participation)
      return fail(404, 'PARTICIPATION_NOT_FOUND', '본인의 참가 정보를 찾을 수 없습니다.');
    const today = koreaToday();
    const requested = body.readingDate ? String(body.readingDate) : today;
    if (requested > today)
      return fail(400, 'READING_DATE_IN_FUTURE', '미래 날짜의 독서일지는 제출할 수 없습니다.');
    if (requested !== today)
      return fail(
        400,
        'READING_DATE_PASSED',
        '독서일지는 한국 시간 기준 당일에만 제출할 수 있습니다.',
      );
    const my = toMyParticipation(participation);
    if (!['APPROVED', 'COMPLETED'].includes(my.participationStatus))
      return fail(
        400,
        'PARTICIPATION_NOT_APPROVED',
        '승인된 참가자만 독서일지를 작성할 수 있습니다.',
      );
    if (
      !canSubmitReadingLog(
        {
          ...my,
          participationStatus: my.participationStatus as MyParticipation['participationStatus'],
        },
        today,
      )
    )
      return fail(400, 'READING_LOG_PERIOD_CLOSED', '독서일지 접수기간이 아닙니다.');
    const title = String(body.title ?? '').trim();
    const readPages = Number(body.readPages);
    const reason = String(body.reason ?? '') as BookRequest['reason'];
    if (
      !title ||
      !Number.isInteger(readPages) ||
      readPages < 1 ||
      readPages > 400 ||
      !['NOT_HELD', 'UNKNOWN_PAGES', 'EBOOK'].includes(reason)
    )
      return fail(400, 'INVALID_REQUEST', '입력값을 확인해 주세요.');
    // 서버와 같이 같은 날의 독서일지·도서 확인 요청(반려 제외)은 합계 400쪽, 같은 책은 하루 한 번만 받습니다.
    const sameDay = db.bookRequests.filter(
      (item) =>
        item.participationId === participation.participationId &&
        item.readingDate === today &&
        item.status !== 'REJECTED',
    );
    const loggedToday = db.logs
      .filter(
        (log) =>
          log.participationId === participation.participationId &&
          log.readingDate === today &&
          log.status !== 'REJECTED',
      )
      .reduce(
        (sum, log) => sum + log.books.reduce((pages, book) => pages + book.submittedReadPages, 0),
        0,
      );
    if (sameDay.reduce((sum, item) => sum + item.readPages, loggedToday) + readPages > 400)
      return fail(
        400,
        'DAILY_READ_PAGES_EXCEEDED',
        '같은 날의 독서일지와 도서 확인 요청은 합계 400쪽까지 접수할 수 있습니다.',
      );
    if (sameDay.some((item) => item.title.trim().toLowerCase() === title.toLowerCase()))
      return fail(
        409,
        'BOOK_ALREADY_SUBMITTED_FOR_DAY',
        '같은 날짜의 일지 또는 도서 확인 요청에 이 책이 이미 있습니다.',
      );
    const student = user(participation.userId);
    const request: BookRequest = {
      id: Math.max(0, ...db.bookRequests.map((item) => item.id)) + 1,
      eventId: participation.eventId,
      participationId: participation.participationId,
      readingDate: today,
      readPages,
      reason,
      title,
      author: String(body.author ?? ''),
      publisher: String(body.publisher ?? ''),
      isbn: String(body.isbn ?? ''),
      note: String(body.note ?? ''),
      status: 'PENDING',
      createdAt: nowIso(),
      reviewedAt: null,
      rejectReason: null,
      readingLogId: null,
      studentNo: student.studentNo,
      participantName: student.name,
    };
    db.bookRequests.push(request);
    return respond(request);
  }),
);
route('GET', /^\/api\/books\/search$/, ({ url }) => {
  const query = url.searchParams.get('query') ?? '';
  return respond(
    db.library
      .filter(
        (book) => matches(book.title, query) || matches(book.author, query) || book.isbn === query,
      )
      .slice(0, 20)
      .map((book) => ({
        libraryBookId: book.libraryBookId,
        title: book.title,
        author: book.author,
        publisher: book.publisher,
        isbn: book.isbn,
        pageCount: book.pageCount,
        callNo: book.callNo,
        libraries: ['글로벌캠퍼스 도서관'],
        thumbnailUrl: null,
      })),
  );
});
route('GET', /^\/api\/books\/thumbnail$/, () => respond({ thumbnailUrl: null }));

/* 관리자: 행사·코스 */
route(
  'GET',
  /^\/api\/admin\/events$/,
  requireAdmin(() => respond(db.events)),
);
route(
  'GET',
  /^\/api\/admin\/events\/(\d+)$/,
  requireAdmin((_, [, id]) => {
    const event = eventOf(Number(id));
    return event ? respond(event) : notFound('행사');
  }),
);
route(
  'POST',
  /^\/api\/admin\/events$/,
  requireAdmin(({ body }) => {
    const event = {
      ...(body as unknown as AdminEvent),
      eventId: (db.seq.event += 1),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.events.unshift(event);
    [
      ['단축 코스', 10_000],
      ['하프 코스', 21_100],
      ['풀 코스', 42_195],
    ].forEach(([name, target], order) =>
      db.courses.push({
        eventId: event.eventId,
        courseId: (db.seq.course += 1),
        name: name as string,
        targetDistanceMeter: target as number,
        standardBookCount: 3 + order * 2,
        avgMonthlyReadingCount: 2,
        maxWinners: 30,
        extraLoanCount: 2,
        rewardType: 'GIFT_CARD',
        rewardAmount: 10_000,
        displayOrder: order,
        active: true,
      }),
    );
    return respond(event);
  }),
);
route(
  'PATCH',
  /^\/api\/admin\/events\/(\d+)$/,
  requireAdmin(({ body }, [, id]) => {
    const event = eventOf(Number(id));
    if (!event) return notFound('행사');
    const { confirmStructuralChange: _confirm, ...changes } = body;
    void _confirm;
    Object.assign(event, changes, { updatedAt: nowIso() });
    return respond(event);
  }),
);
route(
  'DELETE',
  /^\/api\/admin\/events\/(\d+)$/,
  requireAdmin((_, [, id]) => {
    const event = eventOf(Number(id));
    if (!event) return notFound('행사');
    event.status = 'ARCHIVED';
    event.publicVisible = false;
    return respond(null);
  }),
);
route(
  'GET',
  /^\/api\/admin\/events\/(\d+)\/courses$/,
  requireAdmin((_, [, id]) => respond(coursesFor(Number(id)).map(stripCourse))),
);
route(
  'POST',
  /^\/api\/admin\/events\/(\d+)\/courses$/,
  requireAdmin(({ body }, [, id]) => {
    const course = {
      ...(body as object),
      eventId: Number(id),
      courseId: (db.seq.course += 1),
      displayOrder: coursesFor(Number(id)).length,
      active: true,
    } as (typeof db.courses)[number];
    db.courses.push(course);
    return respond(stripCourse(course));
  }),
);
route(
  'PATCH',
  /^\/api\/admin\/events\/(\d+)\/courses\/order$/,
  requireAdmin(({ body }, [, id]) => {
    const ids = (body.courseIds as number[]) ?? [];
    ids.forEach((courseId, order) => {
      const course = db.courses.find((item) => item.courseId === courseId);
      if (course) course.displayOrder = order;
    });
    return respond(coursesFor(Number(id)).map(stripCourse));
  }),
);
route(
  'PATCH',
  /^\/api\/admin\/courses\/(\d+)$/,
  requireAdmin(({ body }, [, id]) => {
    const course = db.courses.find((item) => item.courseId === Number(id));
    if (!course) return notFound('코스');
    Object.assign(course, body);
    return respond(stripCourse(course));
  }),
);
route(
  'DELETE',
  /^\/api\/admin\/courses\/(\d+)$/,
  requireAdmin((_, [, id]) => {
    if (
      db.participations.some((item) => item.courseId === Number(id)) ||
      db.applications.some((item) => item.courseId === Number(id))
    ) {
      return fail(409, 'COURSE_IN_USE', '참가자가 있는 코스는 삭제할 수 없습니다.');
    }
    db.courses = db.courses.filter((item) => item.courseId !== Number(id));
    return respond(null);
  }),
);

/* 관리자: 신청·참가자 */
route(
  'GET',
  /^\/api\/admin\/applications$/,
  requireAdmin(({ url }) => {
    const eventId = numberParam(url, 'eventId');
    return respond(
      db.applications
        .filter((item) => !eventId || item.eventId === eventId)
        .map((item) => toApplication(item.applicationId)),
    );
  }),
);
route(
  'GET',
  /^\/api\/admin\/applications\/(\d+)$/,
  requireAdmin((_, [, id]) =>
    db.applications.some((item) => item.applicationId === Number(id))
      ? respond(toApplication(Number(id)))
      : notFound('신청'),
  ),
);
route(
  'PATCH',
  /^\/api\/admin\/applications\/(\d+)\/approve$/,
  requireAdmin((_, [, id]) => {
    const application = db.applications.find((item) => item.applicationId === Number(id));
    if (!application) return notFound('신청');
    if (application.status !== 'APPLIED')
      return fail(409, 'APPLICATION_ALREADY_PROCESSED', '이미 처리된 신청입니다.');
    application.status = 'APPROVED';
    db.participations.push({
      participationId: (db.seq.participation += 1),
      eventId: application.eventId,
      courseId: application.courseId,
      userId: application.userId,
      applicationId: application.applicationId,
      baseStatus: 'APPROVED',
      approvedAt: nowIso(),
    });
    return respond(toApplication(application.applicationId));
  }),
);
route(
  'PATCH',
  /^\/api\/admin\/applications\/(\d+)\/reject$/,
  requireAdmin(({ body }, [, id]) => {
    const application = db.applications.find((item) => item.applicationId === Number(id));
    if (!application) return notFound('신청');
    if (application.status !== 'APPLIED')
      return fail(409, 'APPLICATION_ALREADY_PROCESSED', '이미 처리된 신청입니다.');
    application.status = 'REJECTED';
    application.rejectReason = String(body.reason ?? '');
    return respond(toApplication(application.applicationId));
  }),
);
route(
  'GET',
  /^\/api\/admin\/participations\/roster$/,
  requireAdmin(({ url }) => respond(rosterRows(numberParam(url, 'eventId') ?? 0))),
);
route(
  'GET',
  /^\/api\/admin\/participations$/,
  requireAdmin(({ url }) => {
    const eventId = numberParam(url, 'eventId');
    return respond(
      db.participations
        .filter((item) => !eventId || item.eventId === eventId)
        .map(toAdminParticipation),
    );
  }),
);
route(
  'GET',
  /^\/api\/admin\/participations\/registration-lookup$/,
  requireAdmin(({ url }) => {
    const eventId = numberParam(url, 'eventId');
    const member = db.users.find(
      (item) => item.studentNo === url.searchParams.get('studentNo')?.trim(),
    );
    if (!member)
      return respond({
        studentNo: url.searchParams.get('studentNo'),
        applicationStatus: null,
        participationStatus: null,
        state: 'NEW',
        user: null,
      });
    const application = db.applications.find(
      (item) => item.eventId === eventId && item.userId === member.userId,
    );
    const participation = db.participations.find(
      (item) => item.eventId === eventId && item.userId === member.userId,
    );
    const lookupUser = {
      userId: member.userId,
      studentNo: member.studentNo,
      name: member.name,
      email: member.email,
      phone: member.phone,
      affiliationType: member.affiliationType,
      department: member.department,
      college: member.college,
      grade: member.grade,
      gender: member.gender,
    };
    return respond({
      studentNo: member.studentNo,
      applicationStatus: application?.status ?? null,
      participationStatus: participation ? participationTotals(db, participation).status : null,
      state: application || participation ? 'ALREADY_REGISTERED' : 'EXISTING',
      user: lookupUser,
    });
  }),
);
route(
  'POST',
  /^\/api\/admin\/participations$/,
  requireAdmin(({ body }) => {
    const eventId = Number(body.eventId);
    let userId = Number(body.userId);
    const newUser = body.newUser as Body | undefined;
    if (newUser) {
      userId = db.seq.user += 1;
      db.users.push({
        userId,
        studentNo: String(newUser.studentNo),
        name: String(newUser.name),
        email: (newUser.email as string) || null,
        phone: (newUser.phone as string) || null,
        affiliationType: newUser.affiliationType as MockUser['affiliationType'],
        department: (newUser.department as string) || null,
        college: (body.college as string) || null,
        grade: (body.grade as string) || null,
        gender: (body.gender as string) || null,
        role: 'USER',
      });
    }
    if (db.participations.some((item) => item.eventId === eventId && item.userId === userId)) {
      return fail(409, 'ALREADY_REGISTERED', '이미 이 행사에 참가 중인 회원입니다.');
    }
    const participation: MockParticipation = {
      participationId: (db.seq.participation += 1),
      eventId,
      courseId: Number(body.courseId),
      userId,
      applicationId: null,
      baseStatus: 'APPROVED',
      approvedAt: nowIso(),
    };
    db.participations.push(participation);
    return respond(toAdminParticipation(participation));
  }),
);
route(
  'PATCH',
  /^\/api\/admin\/participations\/(\d+)\/course$/,
  requireAdmin(({ body }, [, id]) => {
    const participation = participationOf(Number(id));
    if (!participation) return notFound('참가 정보');
    participation.courseId = Number(body.courseId);
    return respond(toAdminParticipation(participation));
  }),
);
route(
  'PATCH',
  /^\/api\/admin\/(participations|applications)\/(\d+)$/,
  requireAdmin(({ body }, [, resource, id]) => {
    const target =
      resource === 'participations'
        ? participationOf(Number(id))
        : db.applications.find((item) => item.applicationId === Number(id));
    if (!target) return notFound('참가 정보');
    const member = user(target.userId);
    Object.assign(member, {
      name: body.name ?? member.name,
      email: (body.email as string) || null,
      phone: (body.phone as string) || null,
      affiliationType: body.affiliationType ?? member.affiliationType,
      department: (body.department as string) || null,
      college: (body.college as string) || null,
      grade: (body.grade as string) || null,
      gender: (body.gender as string) || null,
    });
    if (body.courseId) target.courseId = Number(body.courseId);
    return respond(null);
  }),
);
route(
  'GET',
  /^\/api\/admin\/users$/,
  requireAdmin(() =>
    respond(
      db.users
        .filter((item) => item.role === 'USER')
        .map((item) => ({ ...toAuthUser(item), status: 'ACTIVE' })),
    ),
  ),
);

/* 관리자: 독서일지 */
route(
  'GET',
  /^\/api\/admin\/reading-logs$/,
  requireAdmin(({ url }) => {
    const failed = nextListFailure();
    if (failed) return failed;
    const eventId = numberParam(url, 'eventId');
    const status = url.searchParams.get('status');
    return respond(
      db.logs
        .filter((log) => participationOf(log.participationId)?.eventId === eventId)
        .filter((log) => !status || log.status === status)
        .map(toAdminLog),
    );
  }),
);
route(
  'GET',
  /^\/api\/admin\/reading-logs\/review-targets$/,
  requireAdmin(
    ({ url }) =>
      nextListFailure() ??
      respond(eventBooks(numberParam(url, 'eventId') ?? 0).map(toReviewTarget)),
  ),
);
route(
  'GET',
  /^\/api\/admin\/reading-logs\/(\d+)$/,
  requireAdmin((_, [, id]) => {
    const log = db.logs.find((item) => item.readingLogId === Number(id));
    return log ? respond(toAdminLog(log)) : notFound('독서일지');
  }),
);
const reviewLog = (decision: 'APPROVED' | 'REJECTED'): Handler =>
  requireAdmin(({ body }, [, id]) => {
    const log = db.logs.find((item) => item.readingLogId === Number(id));
    if (!log) return notFound('독서일지');
    const scenario = reviewScenario();
    if (scenario === 'approve-error')
      return fail(500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다.');
    if (scenario === 'conflict')
      return fail(
        409,
        'READING_LOG_CHANGED',
        '참가자가 독서일지를 수정했습니다. 다시 확인해 주세요.',
      );
    // 실제 서버와 같은 오류 코드(이미 승인·이미 반려)를 씁니다.
    if (log.status !== 'SUBMITTED')
      return fail(
        409,
        log.status === 'APPROVED' ? 'READING_LOG_ALREADY_APPROVED' : 'READING_LOG_ALREADY_REJECTED',
        '다른 관리자가 이미 처리한 독서일지입니다. 목록을 새로 고쳐 주세요.',
      );
    if (body.expectedUpdatedAt && body.expectedUpdatedAt !== log.updatedAt) {
      return fail(
        409,
        'READING_LOG_CHANGED',
        '참가자가 독서일지를 수정했습니다. 다시 확인해 주세요.',
      );
    }
    log.status = decision;
    log.adminComment = decision === 'REJECTED' ? String(body.reason ?? '') : null;
    log.reviewedAt = nowIso();
    log.updatedAt = log.reviewedAt;
    if (scenario === 'next-list-error') failNextList = true;
    return respond(toAdminLog(log));
  });
route('PATCH', /^\/api\/admin\/reading-logs\/(\d+)\/approve$/, reviewLog('APPROVED'));
route('PATCH', /^\/api\/admin\/reading-logs\/(\d+)\/reject$/, reviewLog('REJECTED'));

/* 관리자: 서평 개별 확인 */
const bookById = (id: string) =>
  db.participantBooks.find((item) => item.participantBookId === Number(id));
route(
  'PATCH',
  /^\/api\/admin\/reading-logs\/review-targets\/(\d+)\/verify$/,
  requireAdmin(({ body }, [, id]) => {
    const book = bookById(id);
    if (!book) return notFound('서평 확인 대상');
    const scenario = reviewScenario();
    if (scenario === 'approve-error')
      return fail(500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다.');
    if (scenario === 'conflict')
      return fail(
        409,
        'REVIEW_TOTALS_CHANGED',
        '승인 분량이 바뀌었습니다. 최신 값을 확인해 주세요.',
      );
    const credit = bookCredit(db, book);
    if (credit.evidence)
      return fail(409, 'REVIEW_ALREADY_VERIFIED', '다른 관리자가 이미 확인한 서평입니다.');
    if (
      Number(body.expectedApprovedPages) !== credit.approvedPages ||
      Number(body.expectedUncreditedPages) !== credit.uncreditedPages
    ) {
      return fail(
        409,
        'REVIEW_TOTALS_CHANGED',
        '승인 분량이 바뀌었습니다. 최신 값을 확인해 주세요.',
      );
    }
    verifyBook(book, {
      sourceUpdatedAt: (body.sourceUpdatedAt as string) ?? null,
      sourceContent: (body.sourceContent as string) ?? null,
      note: (body.note as string) ?? null,
      sourceType: 'MANUAL',
    });
    if (scenario === 'next-list-error') failNextList = true;
    return respond(toReviewTarget(book));
  }),
);
route(
  'GET',
  /^\/api\/admin\/reading-logs\/review-targets\/(\d+)\/approved-logs$/,
  requireAdmin((_, [, id]) => {
    const book = bookById(id);
    if (!book) return notFound('서평 확인 대상');
    const participation = participationOf(book.participationId)!;
    const logs: ApprovedBookLog[] = db.logs
      .filter((log) => log.participationId === book.participationId && log.status === 'APPROVED')
      .flatMap((log) =>
        log.books
          .filter((item) => item.libraryBookId === book.libraryBookId)
          .map((item) => ({
            readingLogId: log.readingLogId,
            eventId: participation.eventId,
            readingDate: log.readingDate,
            pages: item.submittedReadPages,
          })),
      );
    return respond(logs);
  }),
);
route(
  'GET',
  /^\/api\/admin\/reading-logs\/review-targets\/(\d+)\/evidence$/,
  requireAdmin((_, [, id]) => {
    const book = bookById(id);
    return book ? respond([...book.evidence].reverse()) : notFound('서평 확인 대상');
  }),
);
route(
  'PATCH',
  /^\/api\/admin\/reading-logs\/review-targets\/(\d+)\/evidence\/(\d+)\/revoke$/,
  requireAdmin(({ body }, [, id, evidenceId]) => {
    const book = bookById(id);
    const evidence = book?.evidence.find((item) => item.id === Number(evidenceId));
    if (!book || !evidence) return notFound('서평 확인 기록');
    if (evidence.revokedAt)
      return fail(409, 'EVIDENCE_ALREADY_REVOKED', '이미 취소된 확인 기록입니다.');
    Object.assign(evidence, {
      revokedAt: nowIso(),
      revokeReason: String(body.reason ?? ''),
      revokedBy: '도서관 관리자',
    });
    return respond(null);
  }),
);

/* 관리자: 서평 엑셀 대조 */
route(
  'POST',
  /^\/api\/admin\/review-imports$/,
  requireAdmin(() => unsupported('엑셀 파일 해석(업로드)')),
);
route(
  'GET',
  /^\/api\/admin\/review-imports$/,
  requireAdmin(({ url }) => {
    const eventId = numberParam(url, 'eventId');
    const batches = db.importBatches.filter((item) => item.eventId === eventId).map(toBatch);
    return respond({ page: 0, totalPages: batches.length ? 1 : 0, batches });
  }),
);
route(
  'GET',
  /^\/api\/admin\/review-imports\/(\d+)$/,
  requireAdmin(({ url }, [, id]) => {
    const batch = db.importBatches.find((item) => item.id === Number(id));
    if (!batch) return notFound('업로드 내역');
    const page = Number(url.searchParams.get('page') ?? 0);
    const size = 200;
    return respond({
      batch: toBatch(batch),
      page,
      totalPages: Math.max(1, Math.ceil(batch.rows.length / size)),
      rows: batch.rows.slice(page * size, page * size + size).map(toImportedRow),
    });
  }),
);
route(
  'POST',
  /^\/api\/admin\/review-imports\/(\d+)\/rows\/(\d+)\/confirm$/,
  requireAdmin(({ body }, [, batchId, rowId]) => {
    const row = db.importBatches
      .find((item) => item.id === Number(batchId))
      ?.rows.find((item) => item.id === Number(rowId));
    if (!row) return notFound('대조 행');
    // 검토 실패 재현 스위치(approve-error·conflict)는 엑셀 대조 반영에도 같게 적용합니다.
    const scenario = reviewScenario();
    if (scenario === 'approve-error')
      return fail(500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다.');
    if (scenario === 'conflict')
      return fail(
        409,
        'REVIEW_TOTALS_CHANGED',
        '다른 관리자가 먼저 처리해 인정 분량이 바뀌었습니다. 최신 내용을 확인해 주세요.',
      );
    if (row.status !== 'MATCHED' && row.status !== 'NEEDS_REVIEW')
      return fail(409, 'REVIEW_IMPORT_ROW_NOT_CONFIRMABLE', '반영할 수 없는 행입니다.');
    const participantBookId = Number(body.participantBookId);
    const book = row.candidateBookIds.includes(participantBookId)
      ? db.participantBooks.find((item) => item.participantBookId === participantBookId)
      : undefined;
    if (!book) return fail(400, 'INVALID_CANDIDATE', '대조 후보가 아닌 도서입니다.');
    const credit = bookCredit(db, book);
    if (credit.evidence) return fail(409, 'REVIEW_ALREADY_VERIFIED', '이미 확인된 서평입니다.');
    if (
      Number(body.expectedApprovedPages) !== credit.approvedPages ||
      Number(body.expectedUncreditedPages) !== credit.uncreditedPages
    ) {
      return fail(
        409,
        'REVIEW_TOTALS_CHANGED',
        '승인 분량이 바뀌었습니다. 대조 결과를 새로 확인해 주세요.',
      );
    }
    const evidence = verifyBook(book, {
      sourceUpdatedAt: row.sourceUpdatedAt,
      sourceContent: row.content,
      note: (body.note as string) || null,
      sourceType: 'SOLARS_EXCEL',
    });
    row.status = 'ALREADY_APPLIED';
    row.verification = {
      id: evidence.id,
      participantBookId,
      creditedPages: credit.approvedPages,
      creditedDistanceMeter: credit.approvedPages * METERS_PER_PAGE,
      verifiedBy: evidence.verifiedBy,
      verifiedAt: evidence.verifiedAt,
      alreadyApplied: false,
    };
    return respond(row.verification);
  }),
);

/* 관리자: 랭킹 */
route(
  'GET',
  /^\/api\/admin\/rankings$/,
  requireAdmin(({ url }) =>
    respond(
      rankingsFor(
        numberParam(url, 'eventId') ?? 0,
        numberParam(url, 'courseId'),
        url.searchParams.get('sort') ?? 'RANK',
        true,
      ),
    ),
  ),
);

/* 관리자: 도서 확인 요청 */
route(
  'GET',
  /^\/api\/admin\/book-requests$/,
  requireAdmin(({ url }) =>
    respond(db.bookRequests.filter((item) => item.eventId === numberParam(url, 'eventId'))),
  ),
);
route(
  'PATCH',
  /^\/api\/admin\/book-requests\/(\d+)\/(approve|reject)$/,
  requireAdmin(({ body }, [, id, action]) => {
    const request = db.bookRequests.find((item) => item.id === Number(id));
    if (!request) return notFound('도서 확인 요청');
    if (request.status !== 'PENDING')
      return fail(
        409,
        'BOOK_REQUEST_PROCESSED',
        '이미 처리된 요청입니다. 현재 상태를 확인해 주세요.',
      );
    request.reviewedAt = nowIso();
    if (action === 'reject') {
      request.status = 'REJECTED';
      request.rejectReason = String(body.reason ?? '');
      return respond(request);
    }
    // 확인한 판본으로 검토 대기 독서일지를 만들어 '일지 심사로 이관'합니다.
    let library = db.library.find((item) => item.libraryBookId === Number(body.libraryBookId));
    if (!library) {
      library = {
        libraryBookId: Number(body.libraryBookId) || 5900 + request.id,
        title: String(body.bookTitle ?? request.title),
        author: String(body.author ?? request.author),
        publisher: String(body.publisher ?? request.publisher),
        isbn: String(body.isbn ?? ''),
        pageCount: Number(body.totalBookPages ?? body.pageCount ?? 300) || 300,
        callNo: String(body.callNo ?? ''),
      };
      db.library.push(library);
    }
    const log = {
      readingLogId: (db.seq.log += 1),
      participationId: request.participationId,
      readingDate: request.readingDate,
      status: 'SUBMITTED' as const,
      memo: request.note || null,
      adminComment: null,
      reviewedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      books: [
        {
          readingLogBookId: (db.seq.logBook += 1),
          libraryBookId: library.libraryBookId,
          submittedReadPages: request.readPages,
          displayOrder: 0,
        },
      ],
    };
    db.logs.push(log);
    request.status = 'LINKED';
    request.readingLogId = log.readingLogId;
    return respond(request);
  }),
);

/* 관리자: 공지사항 */
route(
  'GET',
  /^\/api\/admin\/notices$/,
  requireAdmin(() => respond(db.notices)),
);
route(
  'POST',
  /^\/api\/admin\/notices$/,
  requireAdmin(({ body, me }) => {
    if (!String(body.title ?? '').trim() || !String(body.content ?? '').trim())
      return fail(400, 'INVALID_REQUEST', '제목과 내용은 필수 입력값입니다.');
    const notice = {
      noticeId: Math.max(0, ...db.notices.map((item) => item.noticeId)) + 1,
      title: String(body.title),
      content: String(body.content),
      bodyColor: (body.bodyColor as 'DEFAULT') ?? 'DEFAULT',
      pinned: !!body.pinned,
      visible: !!body.visible,
      authorName: me!.name,
      publishedAt: body.visible ? nowIso() : null,
      updatedAt: nowIso(),
    };
    db.notices.unshift(notice);
    return respond(notice);
  }),
);
route(
  'PATCH',
  /^\/api\/admin\/notices\/(\d+)$/,
  requireAdmin(({ body }, [, id]) => {
    const notice = db.notices.find((item) => item.noticeId === Number(id));
    if (!notice) return notFound('공지사항');
    if (!String(body.title ?? '').trim() || !String(body.content ?? '').trim())
      return fail(400, 'INVALID_REQUEST', '제목과 내용은 필수 입력값입니다.');
    Object.assign(notice, {
      title: body.title,
      content: body.content,
      bodyColor: body.bodyColor ?? 'DEFAULT',
      pinned: !!body.pinned,
      visible: !!body.visible,
      updatedAt: nowIso(),
      publishedAt: body.visible ? (notice.publishedAt ?? nowIso()) : notice.publishedAt,
    });
    return respond(notice);
  }),
);
route(
  'DELETE',
  /^\/api\/admin\/notices\/(\d+)$/,
  requireAdmin((_, [, id]) => {
    db.notices = db.notices.filter((item) => item.noticeId !== Number(id));
    return respond(null);
  }),
);

/* 관리자: 문의·FAQ */
route(
  'GET',
  /^\/api\/admin\/inquiries$/,
  requireAdmin(({ url }) => {
    const faq = url.searchParams.get('kind') === 'FAQ';
    const pending = url.searchParams.get('pending') === 'true';
    const query = url.searchParams.get('q') ?? '';
    const items = db.inquiries.filter(
      (item) =>
        item.kind === (faq ? 'FAQ' : 'QUESTION') &&
        (!pending || !item.answer) &&
        (matches(item.title, query) || matches(item.content, query) || matches(item.answer, query)),
    );
    return respond(inquiryListing(items, Number(url.searchParams.get('page') ?? 0), true));
  }),
);
route(
  'PUT',
  /^\/api\/admin\/inquiries\/(\d+)\/answer$/,
  requireAdmin(({ body }, [, id]) => {
    const item = db.inquiries.find((entry) => entry.id === Number(id));
    if (!item) return notFound('문의');
    // 답변 저장 실패 재현: localStorage.setItem('pagepace:mock:inquiry-scenario', 'answer-error')
    try {
      if (localStorage.getItem('pagepace:mock:inquiry-scenario') === 'answer-error')
        return fail(500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다.');
    } catch {
      /* 테스트(node)에는 localStorage가 없습니다. */
    }
    if (Number(body.version) !== item.version)
      return fail(
        409,
        'INQUIRY_CHANGED',
        '다른 관리자가 먼저 답변을 수정했습니다. 다시 불러와 주세요.',
      );
    Object.assign(item, {
      answer: String(body.answer ?? '') || null,
      answeredAt: body.answer ? nowIso() : null,
      version: item.version + 1,
    });
    return respond(item);
  }),
);
route(
  'POST',
  /^\/api\/admin\/inquiries\/faqs$/,
  requireAdmin(({ body }) => {
    const item: Inquiry = {
      id: Math.max(0, ...db.inquiries.map((entry) => entry.id)) + 1,
      kind: 'FAQ',
      title: String(body.title ?? ''),
      content: '',
      answer: String(body.answer ?? ''),
      publicEntry: !!body.publicEntry,
      authorName: null,
      createdAt: nowIso(),
      answeredAt: nowIso(),
      version: 1,
    };
    db.inquiries.push(item);
    return respond(item);
  }),
);
route(
  'PUT',
  /^\/api\/admin\/inquiries\/faqs\/(\d+)$/,
  requireAdmin(({ body }, [, id]) => {
    const item = db.inquiries.find((entry) => entry.id === Number(id) && entry.kind === 'FAQ');
    if (!item) return notFound('FAQ');
    if (Number(body.version) !== item.version)
      return fail(409, 'INQUIRY_CHANGED', '다른 관리자가 먼저 수정했습니다. 다시 불러와 주세요.');
    Object.assign(item, {
      title: String(body.title ?? item.title),
      answer: String(body.answer ?? ''),
      publicEntry: !!body.publicEntry,
      version: item.version + 1,
    });
    return respond(item);
  }),
);
route(
  'DELETE',
  /^\/api\/admin\/inquiries\/faqs\/(\d+)$/,
  requireAdmin((_, [, id]) => {
    db.inquiries = db.inquiries.filter(
      (entry) => !(entry.id === Number(id) && entry.kind === 'FAQ'),
    );
    return respond(null);
  }),
);

/* 결과 보고서: 가상 데이터로 실제 xlsx 파일을 만듭니다(mockReports.ts). */
const excelFile = (bytes: Uint8Array<ArrayBuffer>, name: string, eventId: number, headers = {}) =>
  new Response(new Blob([bytes], { type: EXCEL_TYPE }), {
    status: 200,
    headers: {
      'Content-Type': EXCEL_TYPE,
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${name}_${eventId}.xlsx`)}`,
      ...headers,
    },
  });
/** 오류 상황 재현 스위치(REPORT_SCENARIO_KEY)를 적용합니다. 정상이면 null입니다. */
async function reportScenarioResponse() {
  const scenario = reportScenario();
  if (scenario === 'slow') await new Promise((resolve) => setTimeout(resolve, 3000));
  if (scenario === 'unauthorized') return fail(401, 'UNAUTHORIZED', '인증이 필요합니다.');
  if (scenario === 'forbidden') return fail(403, 'ACCESS_DENIED', '접근 권한이 없습니다.');
  if (scenario === 'server-error') return fail(500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다.');
  if (scenario === 'network') throw new TypeError('Failed to fetch');
  return null;
}
const reportEvent = (eventId: string) =>
  eventOf(Number(eventId)) ? null : fail(404, 'EVENT_NOT_FOUND', '행사를 찾을 수 없습니다.');
route(
  'GET',
  /^\/api\/admin\/reports\/(\d+)\/participants$/,
  requireAdmin(async ({ url }, [, eventId]) => {
    const blocked = (await reportScenarioResponse()) ?? reportEvent(eventId);
    if (blocked) return blocked;
    const scope = url.searchParams.get('scope') ?? 'PARTICIPANTS';
    if (scope !== 'PARTICIPANTS' && scope !== 'APPLICANTS') {
      return fail(400, 'INVALID_PARAMETER', '요청 파라미터 형식이 올바르지 않습니다: scope');
    }
    return excelFile(participantsReport(db, Number(eventId), scope), '참가자현황', Number(eventId));
  }),
);
route(
  'GET',
  /^\/api\/admin\/reports\/(\d+)\/books$/,
  requireAdmin(async (_, [, eventId]) => {
    const blocked = (await reportScenarioResponse()) ?? reportEvent(eventId);
    if (blocked) return blocked;
    const report = booksReport(db, Number(eventId));
    return excelFile(report.file, '도서목록', Number(eventId), {
      'X-Missing-Call-Numbers': String(report.missingCallNumbers),
    });
  }),
);
route(
  'POST',
  /^\/api\/admin\/reports\/(\d+)\/journals$/,
  requireAdmin(async ({ rawBody }, [, eventId]) => {
    const blocked = (await reportScenarioResponse()) ?? reportEvent(eventId);
    if (blocked) return blocked;
    const file = rawBody instanceof FormData ? rawBody.get('file') : null;
    if (!(file instanceof File)) return fail(400, 'MISSING_FILE', '업로드할 파일이 필요합니다.');
    const problem = validateReportUpload(file, new Uint8Array(await file.arrayBuffer()));
    if (problem) return fail(400, 'INVALID_REVIEW_FILE', problem);
    return excelFile(journalsReport(db, Number(eventId)), '일지+서평', Number(eventId));
  }),
);
route(
  'GET',
  /^\/api\/admin\/reports\//,
  requireAdmin(() => unsupported('이 결과 보고서 요청')),
);
route(
  'POST',
  /^\/api\/admin\/reports\//,
  requireAdmin(() => unsupported('이 결과 보고서 요청')),
);

function readBody(body: BodyInit | null | undefined): Body {
  if (typeof body !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === 'object' ? (parsed as Body) : {};
  } catch {
    return {};
  }
}

function currentUser(headers: Headers) {
  const token = headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  return db.users.find((item) => item.userId === Number(token.slice(TOKEN_PREFIX.length))) ?? null;
}

/**
 * fetch와 같은 모양으로 목 응답을 돌려줍니다. 서버로 요청을 보내지 않습니다.
 */
export async function handleMockRequest(path: string, init: RequestInit = {}): Promise<Response> {
  await delay();
  const url = new URL(path, 'http://mock.local');
  const method = (init.method ?? 'GET').toUpperCase();
  const scenarioResponse =
    (await dashboardScenario(method, url.pathname)) ??
    (await bookRequestScenario(method, url.pathname));
  if (scenarioResponse) return scenarioResponse;
  const context: Context = {
    method,
    url,
    body: readBody(init.body),
    rawBody: init.body,
    me: currentUser(new Headers(init.headers)),
  };

  for (const [routeMethod, pattern, handler] of routes) {
    const match = url.pathname.match(pattern);
    if (routeMethod === method && match) {
      return handler(context, match);
    }
  }

  return unsupported(`${method} ${url.pathname}`);
}
