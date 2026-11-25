/**
 * 대량 검토 데이터(개발 서버 목데이터 모드 전용). 가상 참가자 40명이 30일 동안 매일 일지를 낸 제8회 행사를
 * 더해 1,200건 규모의 독서일지 검토·서평 확인 화면을 확인합니다. 실제 학생 정보는 쓰지 않습니다.
 *
 * 켜는 방법(둘 중 하나):
 * - VITE_MOCK_DATASET=large npm run dev:mock
 * - 브라우저 콘솔에서 localStorage.setItem('pagepace:mock:dataset', 'large') 후 새로고침
 *
 * 값: large(대기 120·승인 1,050·반려 30) | large-pending(대기 1,200) | large-single(대기 1) | large-empty(대기 0)
 */
import type { ReadingLogStatus } from '../types/readingLog';
import type { MockDb, MockLog } from './mockDb';

export const MOCK_DATASET_KEY = 'pagepace:mock:dataset';
export const LARGE_EVENT_ID = 8;
const VARIANTS = ['large', 'large-pending', 'large-single', 'large-empty'] as const;
export type LargeVariant = (typeof VARIANTS)[number];

export function mockDatasetVariant(): LargeVariant | null {
  let value: string | null | undefined = import.meta.env.VITE_MOCK_DATASET;
  try {
    value = localStorage.getItem(MOCK_DATASET_KEY) ?? value;
  } catch {
    /* 테스트(node)에는 localStorage가 없습니다. */
  }
  return (VARIANTS as readonly string[]).includes(value ?? '') ? (value as LargeVariant) : null;
}

const pad = (value: number, size = 2) => String(value).padStart(size, '0');
const addDays = (date: string, days: number) => {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
};
const at = (date: string, hour: number, minute = 0) => `${date}T${pad(hour)}:${pad(minute)}:00`;

const SURNAMES = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차'];
const GIVEN = ['하늘', '바다', '솔', '별', '빛나', '가람', '누리', '다온', '라온', '보람'];
const PARTICIPANTS = 40;
const DAYS = 30;
const START = '2026-10-25';

/** 도서 확인 요청 확인 대기 건수(처리 완료 기록은 variant와 관계없이 이관 6건·반려 4건) */
export const LARGE_BOOK_REQUESTS: Record<LargeVariant, number> = {
  large: 45,
  'large-pending': 60,
  'large-single': 1,
  'large-empty': 0,
};

/** 결과 보고용 기대 수치(테스트에서 씁니다) */
export const LARGE_EXPECTED: Record<LargeVariant, Record<ReadingLogStatus, number>> = {
  large: { SUBMITTED: 120, APPROVED: 1050, REJECTED: 30 },
  'large-pending': { SUBMITTED: 1200, APPROVED: 0, REJECTED: 0 },
  'large-single': { SUBMITTED: 1, APPROVED: 1169, REJECTED: 30 },
  'large-empty': { SUBMITTED: 0, APPROVED: 1170, REJECTED: 30 },
};

/** 제8회 대량 검증 행사를 목데이터에 더합니다. 다른 행사의 데이터와 ID는 건드리지 않습니다. */
export function addLargeReviewEvent(db: MockDb, variant: LargeVariant) {
  const eventId = LARGE_EVENT_ID;
  db.events.unshift({
    ...db.events[0],
    eventId,
    title: '제8회 독서마라톤 (대량 검증)',
    roundNo: 8,
    status: 'IN_PROGRESS',
    applicationStartDate: '2026-10-01',
    applicationEndDate: '2026-10-20',
    eventStartDate: START,
    eventEndDate: addDays(START, DAYS),
    publicVisible: false,
    kakaoOpenChatUrl: '',
    createdAt: at('2026-10-01', 9),
    updatedAt: at('2026-10-01', 9),
  });
  const courses = db.courses
    .filter((course) => course.eventId === db.events[1].eventId)
    .map((course) => ({ ...course, eventId, courseId: (db.seq.course += 1) }));
  db.courses.push(...courses);

  let applicationId = Math.max(...db.applications.map((item) => item.applicationId));
  const participationIds: number[] = [];
  for (let index = 0; index < PARTICIPANTS; index += 1) {
    const userId = 400 + index;
    db.users.push({
      userId,
      studentNo: `2026${pad(80000 + index, 5)}`,
      name:
        index === 0
          ? '남궁가람솔빛나래하늘누리'
          : `${SURNAMES[index % SURNAMES.length]}${GIVEN[(index * 3) % GIVEN.length]}${index}`,
      email: `bulk${pad(index + 1)}@example.com`,
      phone: `010-0000-${pad(5000 + index, 4)}`,
      affiliationType: 'UNDERGRADUATE',
      department: '가상학과',
      college: '가상대학',
      grade: String(1 + (index % 4)),
      gender: index % 2 ? '여' : '남',
      role: 'USER',
    });
    const course = courses[index % courses.length];
    applicationId += 1;
    db.applications.push({
      applicationId,
      eventId,
      courseId: course.courseId,
      userId,
      status: 'APPROVED',
      appliedAt: at('2026-10-05', 9, index),
      rejectReason: null,
    });
    const participationId = (db.seq.participation += 1);
    participationIds.push(participationId);
    db.participations.push({
      participationId,
      eventId,
      courseId: course.courseId,
      userId,
      applicationId,
      baseStatus: 'APPROVED',
      approvedAt: at('2026-10-21', 10, index),
    });
  }

  // 같은 책을 사흘씩 이어 읽게 해, 승인 누적이 책 전체 쪽수를 넘지 않게 합니다.
  const logs: MockLog[] = [];
  for (let day = 0; day < DAYS; day += 1) {
    const readingDate = addDays(START, day);
    for (let index = 0; index < PARTICIPANTS; index += 1) {
      const book = db.library[(index * 3 + Math.floor(day / 3)) % db.library.length];
      const pages = Math.min(20 + ((index * 7 + day * 5) % 41), Math.floor(book.pageCount / 3) - 1);
      const books = [
        {
          readingLogBookId: (db.seq.logBook += 1),
          libraryBookId: book.libraryBookId,
          submittedReadPages: pages,
          displayOrder: 0,
        },
      ];
      // 여러 권을 함께 기록한 일지
      if ((index + day) % 17 === 0) {
        const extra = db.library[(index * 3 + Math.floor(day / 3) + 11) % db.library.length];
        books.push({
          readingLogBookId: (db.seq.logBook += 1),
          libraryBookId: extra.libraryBookId,
          submittedReadPages: Math.min(25, Math.floor(extra.pageCount / 6)),
          displayOrder: 1,
        });
      }
      const createdAt = at(readingDate, 20, (index * 13) % 60);
      logs.push({
        readingLogId: (db.seq.log += 1),
        participationId: participationIds[index],
        readingDate,
        status: 'APPROVED',
        memo: index % 9 === 4 ? '가상 메모입니다. 읽은 범위를 적었습니다.' : null,
        adminComment: null,
        reviewedAt: at(addDays(readingDate, 1), 11),
        createdAt,
        updatedAt: createdAt,
        books,
      });
    }
  }

  // 최근 제출분부터 대기로 두고, 나머지 중 30건을 반려로 둡니다.
  const expected = LARGE_EXPECTED[variant];
  const newestFirst = [...logs].reverse();
  newestFirst.slice(0, expected.SUBMITTED).forEach((log) => {
    log.status = 'SUBMITTED';
    log.reviewedAt = null;
  });
  newestFirst
    .slice(expected.SUBMITTED)
    .filter((_, index) => index % 35 === 7)
    .slice(0, expected.REJECTED)
    .forEach((log) => {
      log.status = 'REJECTED';
      log.adminComment =
        '제출한 쪽수가 이전 독서일지와 겹칩니다. 겹치지 않는 범위로 다시 제출해 주세요.';
    });
  // 검토 대기 일지 두 건은 책 전체 쪽수를 넘게 제출해 승인 제한을 확인합니다.
  logs
    .filter((log) => log.status === 'SUBMITTED')
    .slice(0, 2)
    .forEach((log) => {
      const book = db.library.find((item) => item.libraryBookId === log.books[0].libraryBookId)!;
      log.books[0].submittedReadPages = book.pageCount + 30;
    });
  db.logs.push(...logs);

  // 서평 대상: 승인 쪽수가 있는 참가 도서 중 다수는 확인 완료, 일부는 제출 알림만, 일부는 알림 없음
  let participantBookId = Math.max(...db.participantBooks.map((item) => item.participantBookId));
  const approvedPages = new Map<string, number>();
  for (const log of logs) {
    if (log.status !== 'APPROVED') continue;
    for (const book of log.books) {
      const key = log.participationId + ':' + book.libraryBookId;
      approvedPages.set(key, (approvedPages.get(key) ?? 0) + book.submittedReadPages);
    }
  }
  const seen = new Set<string>();
  for (const log of logs) {
    for (const line of log.books) {
      const key = log.participationId + ':' + line.libraryBookId;
      if (seen.has(key)) continue;
      seen.add(key);
      const item = {
        participantBookId: (participantBookId += 1),
        participationId: log.participationId,
        libraryBookId: line.libraryBookId,
        reviewSubmittedAt: null as string | null,
        evidence: [] as MockDb['participantBooks'][number]['evidence'],
      };
      const approved = approvedPages.get(key) ?? 0;
      const roll = item.participantBookId % 10;
      if (approved && roll < 7) {
        const verifiedAt = at(addDays(log.readingDate, 4), 15, roll * 5);
        item.reviewSubmittedAt = at(addDays(log.readingDate, 3), 9);
        item.evidence.push({
          id: (db.seq.evidence += 1),
          sourceUpdatedAt: at(addDays(log.readingDate, 3), 8),
          creditedPages: approved,
          sourceType: roll < 2 ? 'MANUAL' : 'SOLARS_EXCEL',
          verifiedBy: '도서관 관리자',
          verifiedAt,
          revokedAt: null,
          revokeReason: null,
          sourceContent: '가상 서평 원문입니다.',
          note: null,
          revokedBy: null,
        });
      } else if (roll < 9) {
        item.reviewSubmittedAt = at(addDays(log.readingDate, 5), 18);
      }
      db.participantBooks.push(item);
    }
  }
  addBookRequests(db, eventId, participationIds, LARGE_BOOK_REQUESTS[variant]);
  return logs.length;
}

const REQUEST_REASONS = ['NOT_HELD', 'UNKNOWN_PAGES', 'EBOOK'] as const;
const LONG_TITLE =
  '아주 긴 제목의 번역 교양서: 도서관에 없는 판본과 전자책 쪽수를 종이책 기준으로 다시 확인해야 하는 경우의 모든 것 (개정증보판)';
const LONG_NOTE =
  '전자책으로 읽었습니다. 전자책 뷰어의 쪽수와 종이책 쪽수가 달라 종이책 기준으로 확인을 부탁드립니다. 판본은 2024년 개정증보판이며, 출판사 홈페이지에는 412쪽으로 안내되어 있습니다. 도서관에 같은 판본이 없다면 구판(2019년)으로 확인해 주셔도 괜찮습니다.';

/** 도서 확인 요청: 확인 대기 pending건 + 처리 완료 기록(이관 6·반려 4) */
function addBookRequests(db: MockDb, eventId: number, participationIds: number[], pending: number) {
  let id = Math.max(0, ...db.bookRequests.map((item) => item.id));
  const processed = ['LINKED', 'LINKED', 'REJECTED', 'LINKED', 'REJECTED'] as const;
  const total = pending + 10;
  for (let index = 0; index < total; index += 1) {
    const status = index < pending ? 'PENDING' : processed[(index - pending) % processed.length];
    const person = (index * 7) % participationIds.length;
    const user = db.users.find((item) => item.userId === 400 + person)!;
    // 일부 요청은 소장 자료와 같은 제목·ISBN이라 소장 서지 검색으로 찾을 수 있습니다.
    const library = index % 4 === 1 ? db.library[(index * 5) % db.library.length] : null;
    const createdDay = addDays(START, Math.floor((index * 29) / total));
    id += 1;
    db.bookRequests.push({
      id,
      eventId,
      participationId: participationIds[person],
      status,
      createdAt: at(createdDay, 9 + (index % 10), (index * 11) % 60),
      reviewedAt: status === 'PENDING' ? null : at(addDays(createdDay, 1), 10),
      rejectReason:
        status === 'REJECTED'
          ? '제출한 사진으로 같은 판본을 확인할 수 없습니다. 판권면이 보이는 사진을 문의 게시판으로 보내 주세요.'
          : null,
      readingLogId: null,
      studentNo: user.studentNo,
      participantName: user.name,
      readingDate: createdDay,
      readPages: 30 + ((index * 13) % 90),
      reason: REQUEST_REASONS[index % REQUEST_REASONS.length],
      title: index === 0 ? LONG_TITLE : (library?.title ?? `가상 요청 도서 ${index + 1}`),
      author: library?.author ?? '가상 저자',
      publisher: library?.publisher ?? '가상 출판사',
      isbn:
        library?.isbn ?? (index % 3 === 0 ? '' : `979-11-${pad(70000 + index, 5)}-${index % 10}`),
      note: index === 0 ? LONG_NOTE : index % 5 === 2 ? '종이책 쪽수를 확인해 주세요.' : '',
    });
  }
}
