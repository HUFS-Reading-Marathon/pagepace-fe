/*
 * 목데이터 상태. 고정 시드로 매번 같은 데이터를 만들고, 승인·반려·저장 같은 변경은 이 메모리 상태에만 반영합니다.
 * 새로고침하면 처음 상태로 돌아갑니다. 이름·학번·연락처·이메일은 모두 가상의 값입니다.
 *
 * 집계 규칙(참가자 인정 쪽수·거리·완주, 서평 대조 상태)은 프론트엔드 화면이 기대하는 백엔드 동작을
 * 단순화해 흉내 낸 것입니다. 실제 계산은 백엔드가 기준입니다.
 */
import type { AdminCourse, AdminEvent, EventStatus } from '../types/adminEvent';
import type {
  AdminApplicationAffiliationType,
  AdminApplicationStatus,
} from '../types/adminApplication';
import type { ReadingLogStatus } from '../types/readingLog';
import type { ReviewEvidence } from '../api/adminReadingLogApi';
import type { ImportedReview } from '../api/reviewImportApi';
import type { Notice, NoticeColor } from '../api/noticeApi';
import type { Inquiry } from '../api/inquiryApi';
import type { BookRequest } from '../api/bookRequestApi';
import { toStoredNoticeContent } from '../utils/noticeContent';

export const METERS_PER_PAGE = 5;
export const MOCK_TODAY = '2026-11-24';
export const MOCK_ADMIN_LOGIN = 'mockadmin';

export type MockUser = {
  userId: number;
  studentNo: string;
  name: string;
  email: string | null;
  phone: string | null;
  affiliationType: AdminApplicationAffiliationType;
  department: string | null;
  college: string | null;
  grade: string | null;
  gender: string | null;
  role: 'USER' | 'ADMIN';
};
export type MockCourse = AdminCourse & { eventId: number };
export type MockApplication = {
  applicationId: number;
  eventId: number;
  courseId: number;
  userId: number;
  status: AdminApplicationStatus;
  appliedAt: string;
  rejectReason: string | null;
};
export type MockParticipation = {
  participationId: number;
  eventId: number;
  courseId: number;
  userId: number;
  applicationId: number | null;
  /** 참가 취소·실격만 저장합니다. 승인/완주는 인정 거리로 계산합니다. */
  baseStatus: 'APPROVED' | 'CANCELLED' | 'DISQUALIFIED';
  approvedAt: string;
};
export type MockLibraryBook = {
  libraryBookId: number;
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  pageCount: number;
  callNo: string;
};
export type MockLogBook = {
  readingLogBookId: number;
  libraryBookId: number;
  submittedReadPages: number;
  displayOrder: number;
};
export type MockLog = {
  readingLogId: number;
  participationId: number;
  readingDate: string;
  status: ReadingLogStatus;
  memo: string | null;
  adminComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  books: MockLogBook[];
};
export type MockParticipantBook = {
  participantBookId: number;
  participationId: number;
  libraryBookId: number;
  reviewSubmittedAt: string | null;
  evidence: ReviewEvidence[];
};
export type MockImportRow = Omit<ImportedReview, 'candidates'> & {
  candidateBookIds: number[];
};
export type MockImportBatch = {
  id: number;
  eventId: number;
  filename: string;
  createdAt: string;
  uploadedBy: string;
  rows: MockImportRow[];
};

export type MockDb = {
  seq: {
    evidence: number;
    log: number;
    logBook: number;
    participation: number;
    user: number;
    course: number;
    event: number;
    notice: number;
    inquiry: number;
  };
  users: MockUser[];
  events: AdminEvent[];
  courses: MockCourse[];
  applications: MockApplication[];
  participations: MockParticipation[];
  library: MockLibraryBook[];
  logs: MockLog[];
  participantBooks: MockParticipantBook[];
  importBatches: MockImportBatch[];
  bookRequests: BookRequest[];
  notices: Notice[];
  inquiries: Inquiry[];
};

/* 고정 시드 난수(mulberry32): 같은 시드면 항상 같은 순서의 값을 냅니다. */
function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (value: number, size = 2) => String(value).padStart(size, '0');
const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const at = (date: string, hour: number, minute = 0) => `${date}T${pad(hour)}:${pad(minute)}:00`;

const SURNAMES = [
  '김',
  '이',
  '박',
  '최',
  '정',
  '강',
  '조',
  '윤',
  '장',
  '임',
  '한',
  '오',
  '서',
  '신',
  '권',
  '황',
];
const GIVEN = [
  '하늘',
  '서진',
  '도윤',
  '지안',
  '예린',
  '시우',
  '유나',
  '민재',
  '서아',
  '태윤',
  '하린',
  '준서',
  '다온',
  '이안',
  '수빈',
  '가온',
  '로아',
  '은찬',
  '채윤',
  '건우',
];
const DEPARTMENTS = [
  '영어통번역학부',
  '컴퓨터공학부',
  '경영학부',
  '국제금융학과',
  '바이오메디컬공학부',
  '독일어통번역학과',
  '전자공학과',
  '산업경영공학과',
  '중앙도서관 학술정보팀',
  '바이오메디컬공학부 (글로벌캠퍼스 융합전공 과정)',
];
const LIBRARY: Omit<MockLibraryBook, 'libraryBookId' | 'isbn' | 'callNo'>[] = [
  { title: '어린 왕자', author: '앙투안 드 생텍쥐페리', publisher: '문학동네', pageCount: 152 },
  { title: '데미안', author: '헤르만 헤세', publisher: '민음사', pageCount: 236 },
  { title: '코스모스', author: '칼 세이건', publisher: '사이언스북스', pageCount: 719 },
  { title: '사피엔스', author: '유발 하라리', publisher: '김영사', pageCount: 636 },
  { title: '이기적 유전자', author: '리처드 도킨스', publisher: '을유문화사', pageCount: 632 },
  { title: '정의란 무엇인가', author: '마이클 샌델', publisher: '와이즈베리', pageCount: 443 },
  { title: '총, 균, 쇠', author: '재레드 다이아몬드', publisher: '김영사', pageCount: 752 },
  { title: '1984', author: '조지 오웰', publisher: '민음사', pageCount: 456 },
  { title: '동물농장', author: '조지 오웰', publisher: '민음사', pageCount: 168 },
  { title: '멋진 신세계', author: '올더스 헉슬리', publisher: '소담출판사', pageCount: 412 },
  { title: '변신', author: '프란츠 카프카', publisher: '문학동네', pageCount: 128 },
  { title: '노인과 바다', author: '어니스트 헤밍웨이', publisher: '민음사', pageCount: 144 },
  { title: '위대한 개츠비', author: '스콧 피츠제럴드', publisher: '문학동네', pageCount: 260 },
  { title: '죄와 벌 1', author: '표도르 도스토옙스키', publisher: '민음사', pageCount: 496 },
  { title: '죄와 벌 2', author: '표도르 도스토옙스키', publisher: '민음사', pageCount: 512 },
  { title: '페스트', author: '알베르 카뮈', publisher: '민음사', pageCount: 412 },
  { title: '이방인', author: '알베르 카뮈', publisher: '민음사', pageCount: 168 },
  { title: '시간의 역사', author: '스티븐 호킹', publisher: '까치', pageCount: 312 },
  { title: '침묵의 봄', author: '레이첼 카슨', publisher: '에코리브르', pageCount: 400 },
  { title: '군주론', author: '니콜로 마키아벨리', publisher: '까치', pageCount: 216 },
  { title: '자유론', author: '존 스튜어트 밀', publisher: '책세상', pageCount: 284 },
  { title: '국가', author: '플라톤', publisher: '서광사', pageCount: 680 },
  {
    title:
      '아주 긴 제목의 교양서: 읽은 쪽수를 거리로 바꾸는 도서관 독서마라톤의 모든 것과 운영 사례 연구',
    author: '가상 저자',
    publisher: '가상 출판사',
    pageCount: 388,
  },
  { title: '데미안 (개정판)', author: '헤르만 헤세', publisher: '문예출판사', pageCount: 248 },
];

const REJECT_REASONS = [
  '제출한 쪽수가 이전 독서일지와 겹칩니다. 겹치지 않는 범위로 다시 제출해 주세요.',
  '책 정보(판본)가 도서관 소장 자료와 다릅니다. 실제로 읽은 판본으로 다시 선택해 주세요.',
  '하루 독서량이 400쪽을 초과했습니다. 날짜별로 나누어 제출해 주세요.',
  '제외 도서에 해당하여 인정할 수 없습니다. 참여 안내의 제외 도서 목록을 확인해 주세요.',
];

/** 고정 시드로 목데이터 초기 상태를 만듭니다. 호출할 때마다 새 객체를 돌려줍니다. */
export function createMockDb(): MockDb {
  const random = createRandom(20261124);
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

  // 사용자: 관리자 1명 + 가상 참가자 56명
  const users: MockUser[] = [
    {
      userId: 1,
      studentNo: MOCK_ADMIN_LOGIN,
      name: '도서관 관리자',
      email: 'library-admin@example.com',
      phone: null,
      affiliationType: 'STAFF',
      department: '중앙도서관 학술정보팀',
      college: null,
      grade: null,
      gender: null,
      role: 'ADMIN',
    },
  ];
  const affiliations: AdminApplicationAffiliationType[] = [
    'UNDERGRADUATE',
    'UNDERGRADUATE',
    'UNDERGRADUATE',
    'GRADUATE',
    'PROFESSOR',
    'STAFF',
    'OTHER',
  ];
  for (let index = 0; index < 56; index += 1) {
    const affiliationType = affiliations[index % affiliations.length];
    const student = affiliationType === 'UNDERGRADUATE' || affiliationType === 'GRADUATE';
    users.push({
      userId: 100 + index,
      studentNo: student
        ? `20${pad(21 + (index % 6))}${pad(91000 + index, 5)}`
        : `M${pad(7000 + index, 4)}`,
      name:
        index === 7
          ? '남궁가람솔빛나래'
          : `${SURNAMES[index % SURNAMES.length]}${GIVEN[(index * 7) % GIVEN.length]}`,
      email: index % 9 === 4 ? null : `reader${pad(index + 1)}@example.com`,
      phone: index % 5 === 3 ? null : `010-0000-${pad(1000 + index, 4)}`,
      affiliationType,
      department: index % 11 === 6 ? null : DEPARTMENTS[index % DEPARTMENTS.length],
      college: student ? pick(['인문대학', '공과대학', '경상대학', '자연과학대학']) : null,
      grade: affiliationType === 'UNDERGRADUATE' ? String(1 + (index % 4)) : null,
      gender: index % 3 === 0 ? null : index % 2 ? '여' : '남',
      role: 'USER',
    });
  }

  const event = (
    eventId: number,
    roundNo: number,
    status: EventStatus,
    dates: [string, string, string, string],
    publicVisible: boolean,
  ): AdminEvent => ({
    eventId,
    title: `제${roundNo}회 독서마라톤`,
    roundNo,
    applicationStartDate: dates[0],
    applicationEndDate: dates[1],
    eventStartDate: dates[2],
    eventEndDate: dates[3],
    status,
    description:
      '한국외국어대학교 글로벌캠퍼스 도서관 독서마라톤입니다. 읽은 쪽수를 거리로 환산해 코스별 목표 거리에 도전합니다.',
    contactPhone: '02-0000-0000',
    contactEmail: 'reading-marathon@example.com',
    kakaoOpenChatUrl: eventId === 6 ? 'https://open.kakao.com/o/mock-reading-marathon' : '',
    publicVisible,
    createdAt: at(dates[0], 9),
    updatedAt: at(dates[0], 9),
  });
  const events = [
    event(6, 6, 'IN_PROGRESS', ['2026-11-01', '2026-11-30', '2026-11-01', '2026-12-31'], true),
    event(7, 7, 'APPLICATION_OPEN', ['2026-11-20', '2026-12-15', '2027-01-05', '2027-02-28'], true),
    event(5, 5, 'FINALIZED', ['2025-11-24', '2025-12-07', '2025-12-08', '2026-02-01'], false),
  ];

  const courses: MockCourse[] = [];
  let courseId = 60;
  for (const item of events) {
    [
      ['단축 코스', 10_000, 3, 'GIFT_CARD', 10_000],
      ['하프 코스', 21_100, 5, 'GIFT_CARD', 30_000],
      ['풀 코스', 42_195, 8, 'CASH', 100_000],
    ].forEach(([name, target, books, rewardType, rewardAmount], order) => {
      courses.push({
        eventId: item.eventId,
        courseId: (courseId += 1),
        name: name as string,
        targetDistanceMeter: target as number,
        standardBookCount: books as number,
        avgMonthlyReadingCount: 2,
        maxWinners: order === 2 ? 10 : 30,
        extraLoanCount: 2,
        rewardType: rewardType as string,
        rewardAmount: rewardAmount as number,
        displayOrder: order,
        active: true,
      });
    });
  }
  const eventCourses = (eventId: number) => courses.filter((course) => course.eventId === eventId);

  const library: MockLibraryBook[] = LIBRARY.map((book, index) => ({
    ...book,
    libraryBookId: 5000 + index,
    isbn: `97911${pad(91000000 + index * 137, 8)}`,
    // 마지막 두 권은 청구기호를 확인하지 못한 도서로 둡니다(결과 보고서의 청구기호 누락 안내 확인용).
    callNo:
      index >= LIBRARY.length - 2
        ? ''
        : `${800 + (index % 90)}.${index % 9}-${String.fromCharCode(65 + (index % 26))}${index + 10}`,
  }));

  const applications: MockApplication[] = [];
  const participations: MockParticipation[] = [];
  const seq = {
    evidence: 1,
    log: 3000,
    logBook: 9000,
    participation: 2000,
    user: 300,
    course: courseId,
    event: 7,
    notice: 1,
    inquiry: 1,
  };
  let applicationId = 1000;

  const enroll = (
    eventId: number,
    userId: number,
    status: AdminApplicationStatus,
    appliedAt: string,
    courseIndex: number,
  ) => {
    const course = eventCourses(eventId)[courseIndex];
    const application: MockApplication = {
      applicationId: (applicationId += 1),
      eventId,
      courseId: course.courseId,
      userId,
      status,
      appliedAt,
      rejectReason:
        status === 'REJECTED'
          ? '재학 여부를 확인할 수 없습니다. 학적 상태를 확인한 뒤 다시 신청해 주세요.'
          : null,
    };
    applications.push(application);
    if (status === 'APPROVED') {
      participations.push({
        participationId: (seq.participation += 1),
        eventId,
        courseId: course.courseId,
        userId,
        applicationId: application.applicationId,
        baseStatus: 'APPROVED',
        approvedAt: at(addDays(appliedAt.slice(0, 10), 1), 10),
      });
    }
  };

  // 6회(진행 중): 48명 신청 — 승인 대기 6, 반려 4, 신청 취소 2, 승인 36(그중 참가 취소 2)
  for (let index = 0; index < 48; index += 1) {
    const userId = 101 + index;
    const status: AdminApplicationStatus =
      index < 6 ? 'APPLIED' : index < 10 ? 'REJECTED' : index < 12 ? 'CANCELLED' : 'APPROVED';
    enroll(
      6,
      userId,
      status,
      at(addDays('2026-11-01', index % 28), 9 + (index % 9), (index * 7) % 60),
      index % 3,
    );
  }
  participations
    .filter((item) => item.eventId === 6)
    .slice(-2)
    .forEach((item) => (item.baseStatus = 'CANCELLED'));
  // 7회(신청 중): 12명 — 승인 대기 8, 승인 4
  for (let index = 0; index < 12; index += 1) {
    enroll(
      7,
      121 + index,
      index < 8 ? 'APPLIED' : 'APPROVED',
      at(addDays('2026-11-20', index % 5), 10 + (index % 8)),
      index % 3,
    );
  }
  // 5회(종료): 18명 참가
  for (let index = 0; index < 18; index += 1) {
    enroll(5, 101 + index, 'APPROVED', at(addDays('2025-11-24', index % 13), 11), index % 3);
  }

  // 독서일지: 참가자별 1~5건. 일부는 완주할 만큼 많이 읽은 참가자로 둡니다.
  const logs: MockLog[] = [];
  const participantBooks: MockParticipantBook[] = [];
  const bookFor = (participationId: number, libraryBookId: number) => {
    let found = participantBooks.find(
      (item) => item.participationId === participationId && item.libraryBookId === libraryBookId,
    );
    if (!found) {
      found = {
        participantBookId: 700 + participantBooks.length + 1,
        participationId,
        libraryBookId,
        reviewSubmittedAt: null,
        evidence: [],
      };
      participantBooks.push(found);
    }
    return found;
  };

  for (const participation of participations) {
    if (participation.eventId === 7) continue;
    const ended = participation.eventId === 5;
    const order = participations.indexOf(participation);
    const heavy = order % 7 === 0;
    const count = heavy ? 5 : between(1, 3);
    const start = ended ? '2025-12-10' : '2026-11-02';
    for (let index = 0; index < count; index += 1) {
      const readingDate = addDays(start, Math.min(index * 4 + between(0, 3), ended ? 50 : 21));
      const bookCount = random() < 0.25 ? 2 + (random() < 0.3 ? 1 : 0) : 1;
      const books: MockLogBook[] = [];
      for (let bookIndex = 0; bookIndex < bookCount; bookIndex += 1) {
        const libraryBook = pick(library);
        const pages = heavy ? between(300, 400) : between(30, 220);
        books.push({
          readingLogBookId: (seq.logBook += 1),
          libraryBookId: libraryBook.libraryBookId,
          submittedReadPages: pages,
          displayOrder: bookIndex,
        });
      }
      const daysAgo =
        (Date.parse(`${MOCK_TODAY}T00:00:00Z`) - Date.parse(`${readingDate}T00:00:00Z`)) /
        86_400_000;
      const status: ReadingLogStatus = ended
        ? 'APPROVED'
        : daysAgo <= 6 || random() < 0.2
          ? 'SUBMITTED'
          : random() < 0.12
            ? 'REJECTED'
            : 'APPROVED';
      const createdAt = at(readingDate, 20, between(0, 59));
      logs.push({
        readingLogId: (seq.log += 1),
        participationId: participation.participationId,
        readingDate,
        status,
        memo:
          random() < 0.12
            ? '도서관 대출본으로 읽었습니다. 중간에 한 번 반납했다가 다시 빌려 이어서 읽었는데, 쪽수 기록이 지난 일지와 겹칠 수 있어 확인 부탁드립니다. 감상은 서평에 따로 정리했습니다.'
            : null,
        adminComment: status === 'REJECTED' ? pick(REJECT_REASONS) : null,
        reviewedAt: status === 'SUBMITTED' ? null : at(addDays(readingDate, 2), 14),
        createdAt,
        updatedAt: createdAt,
        books,
      });
      books.forEach((book) => bookFor(participation.participationId, book.libraryBookId));
    }
  }

  // 검토 대기 일지 하나는 책 전체 쪽수를 넘게 제출해 경고를 볼 수 있게 합니다.
  const overflow = logs.find((log) => log.status === 'SUBMITTED');
  if (overflow) {
    const book = library.find((item) => item.libraryBookId === overflow.books[0].libraryBookId)!;
    overflow.books[0].submittedReadPages = book.pageCount + 40;
  }

  // 서평: 승인된 책 중 일부는 확인 완료(증빙 기록), 일부는 참가자가 서평 제출만 알린 상태
  let evidenceId = 0;
  for (const book of participantBooks) {
    const participation = participations.find(
      (item) => item.participationId === book.participationId,
    )!;
    const approved = approvedPagesFor({ logs } as MockDb, book.participationId, book.libraryBookId);
    if (!approved) continue;
    const ended = participation.eventId === 5;
    const roll = random();
    if (ended || roll < 0.45) {
      const verifiedAt = at(
        ended ? '2026-01-20' : addDays('2026-11-10', between(0, 10)),
        15,
        between(0, 59),
      );
      book.reviewSubmittedAt = at(verifiedAt.slice(0, 10), 9);
      book.evidence.push({
        id: (evidenceId += 1),
        sourceUpdatedAt: at(verifiedAt.slice(0, 10), 8),
        creditedPages: approved,
        sourceType: roll < 0.2 ? 'MANUAL' : 'SOLARS_EXCEL',
        verifiedBy: '도서관 관리자',
        verifiedAt,
        revokedAt: null,
        revokeReason: null,
        sourceContent: '가상 서평 원문입니다. 책을 읽고 느낀 점과 인상 깊은 문장을 정리했습니다.',
        note: null,
        revokedBy: null,
      });
    } else if (roll < 0.75) {
      book.reviewSubmittedAt = at(addDays('2026-11-12', between(0, 10)), 18);
    }
  }
  seq.evidence = evidenceId + 1;

  // 완주자: 6회 단축 코스 2명과 하프 코스 1명은 승인·서평 확인을 마쳐 목표 거리를 넘도록 둡니다.
  const makeCompleter = (participation: MockParticipation) => {
    const target =
      courses.find((item) => item.courseId === participation.courseId)!.targetDistanceMeter /
      METERS_PER_PAGE;
    const own = logs.filter((log) => log.participationId === participation.participationId);
    for (const log of own) {
      log.status = 'APPROVED';
      log.adminComment = null;
      log.reviewedAt ??= at(addDays(log.readingDate, 1), 11);
    }
    let approved = own
      .flatMap((log) => log.books)
      .reduce((sum, book) => sum + book.submittedReadPages, 0);
    for (let day = 0; approved < target + 60; day += 1) {
      const libraryBook = library[(participation.participationId + day * 5) % library.length];
      const pages = Math.min(380, libraryBook.pageCount);
      const readingDate = addDays('2026-11-03', day % 14);
      logs.push({
        readingLogId: (seq.log += 1),
        participationId: participation.participationId,
        readingDate,
        status: 'APPROVED',
        memo: null,
        adminComment: null,
        reviewedAt: at(addDays(readingDate, 1), 11),
        createdAt: at(readingDate, 21),
        updatedAt: at(readingDate, 21),
        books: [
          {
            readingLogBookId: (seq.logBook += 1),
            libraryBookId: libraryBook.libraryBookId,
            submittedReadPages: pages,
            displayOrder: 0,
          },
        ],
      });
      bookFor(participation.participationId, libraryBook.libraryBookId);
      approved += pages;
    }
    for (const book of participantBooks.filter(
      (item) => item.participationId === participation.participationId,
    )) {
      if (book.evidence.some((item) => !item.revokedAt)) continue;
      book.reviewSubmittedAt ??= at('2026-11-19', 9);
      book.evidence.push({
        id: (evidenceId += 1),
        sourceUpdatedAt: at('2026-11-19', 8),
        creditedPages: approvedPagesFor({ logs }, book.participationId, book.libraryBookId),
        sourceType: 'SOLARS_EXCEL',
        verifiedBy: '도서관 관리자',
        verifiedAt: at('2026-11-20', 15),
        revokedAt: null,
        revokeReason: null,
        sourceContent: '가상 서평 원문입니다.',
        note: null,
        revokedBy: null,
      });
    }
  };
  const activeIn = (courseIndex: number) =>
    participations.filter(
      (item) =>
        item.eventId === 6 &&
        item.baseStatus === 'APPROVED' &&
        item.courseId === eventCourses(6)[courseIndex].courseId,
    );
  activeIn(0).slice(0, 2).forEach(makeCompleter);
  activeIn(1).slice(2, 3).forEach(makeCompleter);
  seq.evidence = evidenceId + 1;

  // 공동 순위를 볼 수 있도록 6회 하프 코스 두 참가자의 승인·인정 분량을 같게 맞춥니다.
  const halfCourse = eventCourses(6)[1].courseId;
  const tied = participations
    .filter(
      (item) =>
        item.eventId === 6 && item.courseId === halfCourse && item.baseStatus === 'APPROVED',
    )
    .slice(0, 2);
  if (tied.length === 2) {
    const [first, second] = tied;
    const sharedBook = library[1].libraryBookId;
    for (const participation of [first, second]) {
      logs.push({
        readingLogId: (seq.log += 1),
        participationId: participation.participationId,
        readingDate: '2026-11-15',
        status: 'APPROVED',
        memo: null,
        adminComment: null,
        reviewedAt: at('2026-11-16', 11),
        createdAt: at('2026-11-15', 21),
        updatedAt: at('2026-11-15', 21),
        books: [
          {
            readingLogBookId: (seq.logBook += 1),
            libraryBookId: sharedBook,
            submittedReadPages: 200,
            displayOrder: 0,
          },
        ],
      });
      const book = bookFor(participation.participationId, sharedBook);
      book.evidence = [];
    }
    // 둘의 다른 책 기록을 걷어 내 총량을 같게 둡니다.
    for (const log of logs) {
      if (
        (log.participationId === first.participationId ||
          log.participationId === second.participationId) &&
        log.readingDate !== '2026-11-15'
      ) {
        log.status = 'REJECTED';
        log.adminComment = REJECT_REASONS[0];
      }
    }
    for (const participation of [first, second]) {
      const book = bookFor(participation.participationId, sharedBook);
      book.evidence.push({
        id: seq.evidence++,
        sourceUpdatedAt: at('2026-11-17', 8),
        creditedPages: 200,
        sourceType: 'SOLARS_EXCEL',
        verifiedBy: '도서관 관리자',
        verifiedAt: at('2026-11-18', 10),
        revokedAt: null,
        revokeReason: null,
        sourceContent: '가상 서평 원문입니다.',
        note: null,
        revokedBy: null,
      });
    }
  }

  const db: MockDb = {
    seq,
    users,
    events,
    courses,
    applications,
    participations,
    library,
    logs,
    participantBooks,
    importBatches: [],
    bookRequests: [],
    notices: [],
    inquiries: [],
  };

  db.importBatches.push(createImportBatch(db, random));
  db.bookRequests = createBookRequests(db);
  db.notices = createNotices();
  db.inquiries = createInquiries(db);
  return db;
}

/* ---------- 계산 ---------- */

export function approvedPagesFor(
  db: Pick<MockDb, 'logs'>,
  participationId: number,
  libraryBookId: number,
) {
  return db.logs
    .filter((log) => log.participationId === participationId && log.status === 'APPROVED')
    .flatMap((log) => log.books)
    .filter((book) => book.libraryBookId === libraryBookId)
    .reduce((sum, book) => sum + book.submittedReadPages, 0);
}

export function activeEvidence(book: MockParticipantBook) {
  return book.evidence.find((item) => !item.revokedAt) ?? null;
}

/** 서평이 확인된 책은 이후 승인 분량도 함께 인정합니다(확인 후 승인분 자동 반영). */
export function bookCredit(db: MockDb, book: MockParticipantBook) {
  const approvedPages = approvedPagesFor(db, book.participationId, book.libraryBookId);
  const evidence = activeEvidence(book);
  const creditedPages = evidence ? approvedPages : 0;
  return { approvedPages, creditedPages, uncreditedPages: approvedPages - creditedPages, evidence };
}

export function participationTotals(db: MockDb, participation: MockParticipation) {
  const books = db.participantBooks.filter(
    (book) => book.participationId === participation.participationId,
  );
  const credit = books.map((book) => bookCredit(db, book));
  const totalPages = db.logs
    .filter(
      (log) => log.participationId === participation.participationId && log.status === 'APPROVED',
    )
    .flatMap((log) => log.books)
    .reduce((sum, book) => sum + book.submittedReadPages, 0);
  const totalDistanceMeter =
    credit.reduce((sum, item) => sum + item.creditedPages, 0) * METERS_PER_PAGE;
  const course = db.courses.find((item) => item.courseId === participation.courseId)!;
  const completed =
    participation.baseStatus === 'APPROVED' && totalDistanceMeter >= course.targetDistanceMeter;
  const completedAt = completed
    ? credit
        .map((item) => item.evidence?.verifiedAt ?? '')
        .sort()
        .at(-1) || null
    : null;
  const status =
    participation.baseStatus === 'APPROVED'
      ? completed
        ? 'COMPLETED'
        : 'APPROVED'
      : participation.baseStatus;
  return { totalPages, totalDistanceMeter, status, completedAt, course };
}

/* ---------- 서평 엑셀 대조 ---------- */

function createImportBatch(db: MockDb, random: () => number): MockImportBatch {
  const rows: MockImportRow[] = [];
  const event6 = db.participations.filter(
    (item) => item.eventId === 6 && item.baseStatus === 'APPROVED',
  );
  const books = db.participantBooks.filter((book) =>
    event6.some((item) => item.participationId === book.participationId),
  );
  const credited = books.filter((book) => bookCredit(db, book).approvedPages > 0);
  const pending = credited.filter((book) => !activeEvidence(book));
  const verified = credited.filter((book) => activeEvidence(book));
  let rowId = 0;

  const row = (
    status: ImportedReview['status'],
    book: MockParticipantBook | null,
    patch: Partial<MockImportRow> = {},
  ): MockImportRow => {
    const participation = book
      ? db.participations.find((item) => item.participationId === book.participationId)!
      : null;
    const user = participation
      ? db.users.find((item) => item.userId === participation.userId)!
      : null;
    const libraryBook = book
      ? db.library.find((item) => item.libraryBookId === book.libraryBookId)!
      : null;
    rowId += 1;
    return {
      id: 40_000 + rowId,
      sourceRow: rowId + 1,
      libraryBookId: libraryBook?.libraryBookId ?? null,
      bookTitle: libraryBook?.title ?? null,
      bibliographicInfo: libraryBook ? `${libraryBook.author} / ${libraryBook.publisher}` : null,
      memberNo: user?.studentNo ?? null,
      memberName: user?.name ?? null,
      reviewTitle: libraryBook ? `『${libraryBook.title}』을 읽고` : null,
      content: libraryBook
        ? `가상 서평 원문입니다. ${libraryBook.title}을(를) 읽으며 인상 깊었던 장면과 생각을 정리했습니다.\n\n<b>태그처럼 보이는 글자</b>도 글자 그대로 보여야 합니다.`
        : null,
      sourceUpdatedAt: at(addDays('2026-11-10', Math.floor(random() * 12)), 21),
      status,
      warnings: [],
      candidateBookIds: book ? [book.participantBookId] : [],
      verification: null,
      ...patch,
    };
  };

  pending.slice(0, 8).forEach((book) => rows.push(row('MATCHED', book)));
  pending.slice(8, 10).forEach((book) =>
    rows.push(
      row('NEEDS_REVIEW', book, {
        warnings: ['엑셀의 도서명이 독서일지의 도서명과 다릅니다.'],
        bookTitle: '데미안 (개정판)',
      }),
    ),
  );
  if (pending.length > 11) {
    rows.push(
      row('NEEDS_REVIEW', pending[10], {
        warnings: ['같은 회원의 같은 제목 도서가 두 권 있어 하나를 골라야 합니다.'],
        candidateBookIds: [pending[10].participantBookId, pending[11].participantBookId],
      }),
    );
  }
  verified.slice(0, 4).forEach((book) => {
    const credit = bookCredit(db, book);
    rows.push(
      row('ALREADY_APPLIED', book, {
        verification: {
          id: credit.evidence!.id,
          participantBookId: book.participantBookId,
          creditedPages: credit.creditedPages,
          creditedDistanceMeter: credit.creditedPages * METERS_PER_PAGE,
          verifiedBy: credit.evidence!.verifiedBy,
          verifiedAt: credit.evidence!.verifiedAt,
          alreadyApplied: true,
        },
      }),
    );
  });
  verified
    .slice(4, 6)
    .forEach((book) => rows.push(row('BOOK_VERIFIED', book, { candidateBookIds: [] })));
  const noCredit = books.filter((book) => bookCredit(db, book).approvedPages === 0).slice(0, 2);
  noCredit.forEach((book) =>
    rows.push(
      row('NO_CREDIT', book, {
        warnings: ['승인된 독서일지가 없어 인정할 분량이 없습니다.'],
        candidateBookIds: [],
      }),
    ),
  );
  rows.push(
    row('UNMATCHED', pending[12] ?? null, {
      candidateBookIds: [],
      bookTitle: '소장 자료에 없는 도서',
      libraryBookId: null,
      warnings: ['회원의 독서일지에서 같은 도서를 찾지 못했습니다.'],
    }),
  );
  rows.push(
    row('UNMATCHED', null, {
      memberNo: '2025099999',
      memberName: '정보불일치',
      bookTitle: '총, 균, 쇠',
    }),
  );
  rows.push(
    row('INVALID', null, {
      memberNo: null,
      memberName: null,
      bookTitle: null,
      content: null,
      warnings: ['필수 열(MEMBER_NO, TITLE)이 비어 있습니다.'],
    }),
  );
  rows.push(
    row('EXCLUDED', null, {
      memberNo: '2024088888',
      memberName: '비참가회원',
      bookTitle: '어린 왕자',
      reviewTitle: '어린 왕자 서평',
      content: '참가 신청을 하지 않은 회원의 서평입니다.',
    }),
  );
  rows.push(
    row('EXCLUDED', null, {
      memberNo: '2023077777',
      memberName: '비참가회원2',
      bookTitle: '코스모스',
      reviewTitle: '코스모스를 읽고',
      content: '비참가자 서평입니다.',
    }),
  );

  return {
    id: 900,
    eventId: 6,
    filename: 'solars_review_2026-11-20.xlsx',
    createdAt: at('2026-11-20', 16, 5),
    uploadedBy: '도서관 관리자',
    rows,
  };
}

/* ---------- 도서 확인 요청 ---------- */

function createBookRequests(db: MockDb): BookRequest[] {
  const participations = db.participations.filter(
    (item) => item.eventId === 6 && item.baseStatus === 'APPROVED',
  );
  const reasons = ['NOT_HELD', 'UNKNOWN_PAGES', 'EBOOK'] as const;
  const statuses = ['PENDING', 'PENDING', 'PENDING', 'LINKED', 'REJECTED'] as const;
  const titles = [
    '도서관에 없는 신간 에세이',
    '쪽수 정보가 없는 시집',
    '전자책으로 읽은 경제 교양서',
    '해외 원서 (영문판)',
    '절판된 소설집',
    '가상 과학 교양서',
    '가상 인문서',
    '가상 여행 에세이',
  ];
  return titles.map((title, index) => {
    const participation = participations[(index * 3) % participations.length];
    const user = db.users.find((item) => item.userId === participation.userId)!;
    const status = statuses[index % statuses.length];
    return {
      id: index + 1,
      eventId: 6,
      participationId: participation.participationId,
      status,
      createdAt: at(addDays('2026-11-05', index * 2), 13),
      reviewedAt: status === 'PENDING' ? null : at(addDays('2026-11-07', index * 2), 10),
      rejectReason:
        status === 'REJECTED'
          ? '같은 판본을 확인할 수 없습니다. 표지와 판권면 사진을 문의 게시판으로 보내 주세요.'
          : null,
      readingLogId: null,
      studentNo: user.studentNo,
      participantName: user.name,
      readingDate: addDays('2026-11-04', index * 2),
      readPages: 80 + index * 15,
      reason: reasons[index % reasons.length],
      title,
      author: '가상 저자',
      publisher: '가상 출판사',
      isbn: index % 2 ? '' : `97911${pad(90000000 + index, 8)}`,
      note:
        index % 3 === 0
          ? '전자책으로 읽었고 종이책 쪽수를 확인해 주세요. 판본은 2024년 개정판입니다.'
          : '',
    };
  });
}

/* ---------- 공지사항 ---------- */

function createNotices(): Notice[] {
  const markdown = (body: string) => toStoredNoticeContent(body);
  const items: [string, string, NoticeColor, boolean, boolean][] = [
    [
      '제7회 독서마라톤 참가신청 안내',
      markdown(
        '## 신청 기간\n\n2026년 11월 20일(금)부터 12월 15일(화)까지 신청할 수 있습니다.  \n신청 결과는 12월 18일에 안내합니다.\n\n## 신청 방법\n\n1. 홈페이지에서 로그인합니다.\n2. 참가신청 화면에서 코스를 고릅니다.\n3. 신청서를 제출합니다.\n\n> 신청 후 코스 변경은 문의 게시판으로 요청해 주세요.\n\n자세한 내용은 [도서관 홈페이지](https://lib.hufs.ac.kr/global/)를 참고하세요.',
      ),
      'DEFAULT',
      true,
      true,
    ],
    [
      '[중요] 독서일지 제출 마감 및 인정 기준 변경 안내',
      markdown(
        '**12월 31일 23시 59분**까지 제출한 독서일지만 인정합니다.\n\n- 하루 독서량은 400쪽을 넘을 수 없습니다.\n- 같은 책의 같은 쪽을 다시 제출하면 반려됩니다.\n- *서평이 확인된 책*은 이후 승인되는 일지도 자동으로 인정됩니다.',
      ),
      'RED',
      true,
      true,
    ],
    [
      '도서관 휴관일 안내',
      '12월 25일(금)은 성탄절로 휴관합니다.\n\n휴관일에도 독서일지는 제출할 수 있습니다.\n승인은 다음 근무일에 처리합니다.',
      'DEFAULT',
      false,
      true,
    ],
    [
      '서평 작성 방법 안내',
      markdown(
        '## 서평은 어디에 쓰나요?\n\n도서관 홈페이지 > 내 서재 > 서평에서 작성합니다.\n\n### 작성 요령\n\n- 책 제목과 저자를 정확히 적어 주세요.\n- 300자 이상 작성해 주세요.\n\n\n\n문의: [library@example.com](mailto:library@example.com)',
      ),
      'NAVY',
      false,
      true,
    ],
    [
      '아주 긴 제목의 공지사항: 독서마라톤 코스별 완주 기준, 보상 지급 일정, 추가 대출 혜택 적용 방법과 유의사항을 한 번에 정리했습니다',
      Array.from(
        { length: 12 },
        (_, index) =>
          `${index + 1}번째 문단입니다. 긴 공지 본문이 화면에서 어떻게 줄바꿈되는지 확인하기 위한 가상의 안내 문장입니다. 참가자는 안내를 끝까지 읽어 주세요.`,
      ).join('\n\n'),
      'DEFAULT',
      false,
      true,
    ],
    [
      '코스별 완주 보상 지급 일정',
      '완주 보상은 행사 종료 후 2주 안에 지급합니다.\n- 단축 코스: 문화상품권\n- 하프 코스: 문화상품권\n- 풀 코스: 상금',
      'DEFAULT',
      false,
      true,
    ],
    [
      '게시 전 검토 중인 공지',
      markdown('아직 **게시 전**인 공지입니다. 비공개 상태라 사용자 화면에는 보이지 않습니다.'),
      'DEFAULT',
      false,
      false,
    ],
    ['제6회 시상식 일정 (작성 중)', '시상식 일정은 확정되면 안내합니다.', 'NAVY', true, false],
    [
      '독서일지 반려 사유별 안내',
      markdown(
        '## 자주 반려되는 사유\n\n1. 쪽수 중복\n2. 판본 불일치\n3. 하루 400쪽 초과\n\n반려된 일지는 고쳐서 다시 제출할 수 있습니다.',
      ),
      'DEFAULT',
      false,
      true,
    ],
    [
      '특수문자 표기 확인용 공지',
      '*별표*, # 샵, - 대시, 1. 숫자, <b>태그</b> & 기호가\n그대로 보여야 합니다.\n    네 칸 들여쓴 줄',
      'DEFAULT',
      false,
      true,
    ],
    [
      '링크 보안 확인용 공지',
      markdown(
        '[정상 링크](https://lib.hufs.ac.kr/global/) / [위험한 링크](javascript:alert(1)) / [사이트 안 경로](/notices)',
      ),
      'DEFAULT',
      false,
      false,
    ],
    [
      '겨울방학 운영 시간 안내',
      '겨울방학 중 열람실은 09:00~18:00에 운영합니다.',
      'DEFAULT',
      false,
      true,
    ],
  ];
  return items.map(([title, content, bodyColor, pinned, visible], index) => {
    const date = addDays('2026-11-21', -index * 2);
    return {
      noticeId: index + 1,
      title,
      content,
      bodyColor,
      pinned,
      visible,
      authorName: '도서관 관리자',
      publishedAt: visible ? at(date, 10) : null,
      updatedAt: at(date, 10),
    };
  });
}

/* ---------- 문의·FAQ ---------- */

function createInquiries(db: MockDb): Inquiry[] {
  const askers = db.users.filter((user) => user.role === 'USER').slice(0, 18);
  const questions = [
    '독서일지 쪽수를 잘못 입력했어요',
    '서평은 어디에 작성하나요?',
    '코스를 바꿀 수 있나요?',
    '완주 기준이 궁금합니다',
    '전자책도 인정되나요?',
    '반려된 독서일지는 다시 제출할 수 있나요? 반려 사유가 이해되지 않아 자세한 설명을 부탁드립니다',
  ];
  const list: Inquiry[] = askers.map((user, index) => {
    const answered = index % 3 !== 0;
    const created = at(addDays('2026-11-23', -index), 9 + (index % 10));
    return {
      id: index + 1,
      kind: 'QUESTION',
      title: questions[index % questions.length],
      // 첫 문의는 줄바꿈이 있는 긴 본문으로 답변 화면의 가독성을 확인합니다.
      content:
        index === 0
          ? [
              '독서일지를 제출한 뒤 반려되었는데, 반려 사유가 이해되지 않아 문의드립니다.',
              '',
              '11월 3일에 「코스모스」 120쪽부터 180쪽까지 읽고 일지를 냈습니다. 반려 사유에는 이전 일지와 쪽수가 겹친다고 되어 있는데, 이전 일지는 1쪽부터 119쪽까지였습니다.',
              '',
              '1. 같은 책을 이어 읽을 때 쪽수를 어떻게 적어야 하나요?',
              '2. 다시 제출하면 기존 반려 기록은 어떻게 되나요?',
              '3. 이미 지난 날짜의 일지도 다시 낼 수 있나요?',
              '',
              '가상 문의 본문입니다. '.repeat(12).trim(),
            ].join('\n')
          : '가상 문의 본문입니다. '.repeat(1 + (index % 4)).trim(),
      answer: answered
        ? '독서일지 상세 화면에서 수정할 수 있습니다. 승인된 일지는 문의 게시판으로 요청해 주세요.'
        : null,
      publicEntry: index % 4 !== 1,
      authorName: user.name,
      createdAt: created,
      answeredAt: answered ? at(created.slice(0, 10), 17) : null,
      version: 1,
    };
  });
  const faqs = [
    '참가 신청은 언제까지인가요?',
    '독서일지는 하루에 몇 번 제출할 수 있나요?',
    '서평 확인은 얼마나 걸리나요?',
    '완주 보상은 언제 받나요?',
    '비공개 FAQ 초안',
    '도서관에 없는 책은 어떻게 기록하나요?',
  ];
  faqs.forEach((title, index) =>
    list.push({
      id: 100 + index,
      kind: 'FAQ',
      title,
      content: '',
      answer: `${title}에 대한 가상 답변입니다. 참여 안내를 함께 확인해 주세요.`,
      publicEntry: index !== 4,
      authorName: null,
      createdAt: at(addDays('2026-11-01', index), 10),
      answeredAt: at(addDays('2026-11-01', index), 10),
      version: 1,
    }),
  );
  return list;
}
