/**
 * 목데이터 모드의 결과 보고서 엑셀. 백엔드(ContestReportService·ContestReportWorkbook)와 같은 대상·열 순서로
 * 가상 데이터만 담은 실제 xlsx 파일을 만듭니다. 서식(글꼴·테두리)은 단순화했습니다.
 */
import { activeEvidence, approvedPagesFor, type MockDb } from './mockDb';
import { buildXlsx, looksLikeXlsx, type XlsxCell } from './mockXlsx';

export const EXCEL_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * 결과 보고서 오류 상황 재현용 스위치(개발 서버 목데이터 모드 전용).
 * 브라우저 콘솔에서 localStorage.setItem('pagepace:mock:report-scenario', 'forbidden')처럼 지정하고,
 * removeItem으로 되돌립니다.
 * - slow: 파일 생성에 3초가 걸립니다.
 * - unauthorized: 토큰 갱신은 성공하지만 보고서 요청이 계속 401을 받습니다(운영에서 보고된 증상과 같은 흐름).
 * - forbidden: 403 접근 권한 없음
 * - server-error: 500 서버 오류
 * - network: 서버에 연결하지 못함
 */
export const REPORT_SCENARIO_KEY = 'pagepace:mock:report-scenario';
const SCENARIOS = ['slow', 'unauthorized', 'forbidden', 'server-error', 'network'] as const;
export type ReportScenario = (typeof SCENARIOS)[number];

export function reportScenario(): ReportScenario | null {
  try {
    const value = localStorage.getItem(REPORT_SCENARIO_KEY);
    return (SCENARIOS as readonly string[]).includes(value ?? '')
      ? (value as ReportScenario)
      : null;
  } catch {
    return null;
  }
}

export const MAX_REPORT_UPLOAD_BYTES = 20 * 1024 * 1024;

const eventLogs = (db: MockDb, eventId: number) => {
  const participations = new Set(
    db.participations
      .filter((item) => item.eventId === eventId)
      .map((item) => item.participationId),
  );
  return db.logs.filter(
    (log) => participations.has(log.participationId) && log.status === 'APPROVED',
  );
};

const userOf = (db: MockDb, userId: number) => db.users.find((item) => item.userId === userId)!;
const grade = (value: string | null) => (value ? `${value}학년` : null);

/** 참가자 현황: PARTICIPANTS는 승인·완주 참가자(승인 순), APPLICANTS는 철회(CANCELLED)를 뺀 신청 순 명단입니다. */
export function participantsReport(
  db: MockDb,
  eventId: number,
  scope: 'PARTICIPANTS' | 'APPLICANTS',
) {
  const event = db.events.find((item) => item.eventId === eventId)!;
  const userIds =
    scope === 'APPLICANTS'
      ? db.applications
          .filter((item) => item.eventId === eventId && item.status !== 'CANCELLED')
          .sort(
            (a, b) => a.appliedAt.localeCompare(b.appliedAt) || a.applicationId - b.applicationId,
          )
          .map((item) => item.userId)
      : db.participations
          .filter((item) => item.eventId === eventId && item.baseStatus === 'APPROVED')
          .sort(
            (a, b) =>
              a.approvedAt.localeCompare(b.approvedAt) || a.participationId - b.participationId,
          )
          .map((item) => item.userId);
  const rows: XlsxCell[][] = [
    [`${event.title} 신청자 명단`],
    [
      '연번',
      '1. 이름',
      '2. 학번 또는 사번',
      '3-1. 단대',
      '3-2. 학과',
      '4. 학년',
      '5. 핸드폰번호',
      '6. 이메일',
      '7. 성별',
    ],
    ...userIds.map((userId, index) => {
      const user = userOf(db, userId);
      return [
        index + 1,
        user.name,
        user.studentNo,
        user.college,
        user.department,
        grade(user.grade),
        user.phone,
        user.email,
        user.gender,
      ];
    }),
  ];
  return buildXlsx({
    name: '참가자현황',
    rows,
    merges: ['A1:I1'],
    widths: [4.75, 12, 14, 12, 18, 8, 15, 26, 8],
  });
}

/** 청구기호를 서가 순서(숫자 부분은 수치 비교)로 비교합니다. 청구기호가 없으면 마지막입니다. */
const shelfOrder = (left: string, right: string) => {
  if (!left || !right) return left ? -1 : right ? 1 : 0;
  return left.localeCompare(right, 'ko', { numeric: true });
};

/** 도서 목록: 승인된 일지의 도서를 판본(ISBN, 없으면 소장 ID)별로 한 번씩 청구기호 순으로 정리합니다. */
export function booksReport(db: MockDb, eventId: number) {
  const event = db.events.find((item) => item.eventId === eventId)!;
  const unique = new Map<string, number>();
  for (const log of eventLogs(db, eventId)) {
    for (const line of log.books) {
      const book = db.library.find((item) => item.libraryBookId === line.libraryBookId)!;
      const key = book.isbn
        ? `isbn:${book.isbn.replace(/[^0-9X]/gi, '')}`
        : `id:${book.libraryBookId}`;
      if (!unique.has(key)) unique.set(key, book.libraryBookId);
    }
  }
  const books = [...unique.values()]
    .map((id) => db.library.find((item) => item.libraryBookId === id)!)
    .sort(
      (a, b) =>
        shelfOrder(a.callNo, b.callNo) ||
        a.title.localeCompare(b.title, 'ko') ||
        a.libraryBookId - b.libraryBookId,
    );
  const header = 5;
  const rows: XlsxCell[][] = [
    [`${event.title} 참가자 독서 목록`],
    ['▶ 정렬 : 청구기호순'],
    ['▶ 책 제목 클릭 시 해당 도서정보 및 서평 확인 가능합니다'],
    ['▶ 현재 링크되어 있는 책이 해당 도서가 아닐 수 있으니 청구기호로 확인해 주세요 (목데이터)'],
    ['연번', '책 제목', '저자', '출판사', '청구기호'],
    ...books.map((book, index) => [
      index + 1,
      book.title,
      book.author,
      book.publisher,
      book.callNo || null,
    ]),
  ];
  return {
    file: buildXlsx({
      name: '도서목록',
      rows,
      merges: ['A1:E1', 'A2:E2', 'A3:E3', 'A4:E4'],
      links: books.map((book, index) => ({
        ref: `B${header + index + 1}`,
        url: `https://lib.hufs.ac.kr/global/search/i-discovery/${book.libraryBookId}`,
      })),
      widths: [6, 44, 20, 16, 18],
    }),
    missingCallNumbers: books.filter((book) => !book.callNo).length,
  };
}

/** 업로드 파일 검증: 백엔드 SolasExcelParser와 같은 순서·문구입니다. 목데이터는 내용 대신 형식만 확인합니다. */
export function validateReportUpload(file: File, bytes: Uint8Array) {
  if (!file.size || file.size > MAX_REPORT_UPLOAD_BYTES) {
    return '20MB 이하의 비어 있지 않은 xlsx 파일을 선택해 주세요.';
  }
  if (!file.name.toLowerCase().endsWith('.xlsx') || file.name.length > 255) {
    return 'xlsx 파일만 업로드할 수 있습니다.';
  }
  if (!looksLikeXlsx(bytes)) {
    return '엑셀을 읽을 수 없습니다. 암호화되지 않은 솔라스 xlsx 파일인지 확인해 주세요.';
  }
  return null;
}

const logDate = (date: string) => date.replaceAll('-', '.');

/**
 * 일지 + 서평: 승인된 일지를 학번·날짜순으로 나열합니다. 목데이터는 솔라스 원문을 해석하지 않으므로
 * 서평 열은 비우고, 거리 인정 내역이 있는 책에는 백엔드와 같은 비고를 남깁니다.
 */
export function journalsReport(db: MockDb, eventId: number) {
  const lines = eventLogs(db, eventId)
    .flatMap((log) => log.books.map((line) => ({ log, line })))
    .map(({ log, line }) => {
      const participation = db.participations.find(
        (item) => item.participationId === log.participationId,
      )!;
      return { log, line, user: userOf(db, participation.userId), participation };
    })
    .sort(
      (a, b) =>
        a.user.studentNo.localeCompare(b.user.studentNo) ||
        a.log.readingDate.localeCompare(b.log.readingDate) ||
        a.log.readingLogId - b.log.readingLogId ||
        a.line.displayOrder - b.line.displayOrder,
    );
  const rows: XlsxCell[][] = [
    [
      '일지_작성일자',
      '이름',
      '학번',
      '서명',
      '저자',
      '출판사',
      '일지작성',
      '서지번호',
      '서명',
      '인정페이지',
      '형태_페이지',
      '서평_제목',
      '서명_내용',
      '서평_작성일자',
      '비고',
    ],
    ...lines.map(({ log, line, user, participation }) => {
      const book = db.library.find((item) => item.libraryBookId === line.libraryBookId)!;
      const owned = db.participantBooks.find(
        (item) =>
          item.participationId === participation.participationId &&
          item.libraryBookId === line.libraryBookId,
      );
      const credited =
        owned && activeEvidence(owned)
          ? approvedPagesFor(db, participation.participationId, line.libraryBookId)
          : 0;
      return [
        logDate(log.readingDate),
        user.name,
        user.studentNo,
        book.title,
        book.author,
        book.publisher,
        line.submittedReadPages,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        credited > 0 ? '거리 인정 내역 있음 · 전체기간 솔라스 원문 확인' : null,
      ];
    }),
  ];
  return buildXlsx({
    name: '일지+서평',
    rows,
    widths: [12, 10, 12, 30, 16, 14, 8, 10, 30, 10, 12, 20, 50, 18, 30],
  });
}
