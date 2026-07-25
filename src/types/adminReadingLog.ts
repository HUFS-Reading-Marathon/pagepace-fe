export type ReadingLogStatus = 'submit' | 'approve' | 'rejected';

export type ReadingLogStatusFilter = 'ALL' | ReadingLogStatus;
export type ReadingLogReviewFilter = 'ALL' | 'safe' | 'warning';
export type ReadingLogDialogMode = 'detail' | 'approve-confirm' | 'reject';

export type ReadingLogBookEntry = {
  id: string;
  bookId: string;
  title: string;
  author: string;
  publisher: string;
  totalPages: number;
  previouslyApprovedPages: number;
  readPages: number;
  reviewWritten: boolean;
};

export type AdminReadingLog = {
  id: string;
  participantId: string;
  participantName: string;
  studentNumber: string;
  readingDate: string;
  submittedAt: string;
  status: ReadingLogStatus;
  books: ReadingLogBookEntry[];
  approvedAt?: string;
  rejectionReason?: string;
  adminMemo?: string;
  reviewFlags?: string[];
};

export type ReadingLogValidationCode =
  | 'daily-limit'
  | 'book-total-overflow'
  | 'invalid-pages'
  | 'missing-book-info';

export type ReadingLogValidationIssue = {
  code: ReadingLogValidationCode;
  label: string;
  detail: string;
  bookEntryId?: string;
};

export const READING_LOG_STATUS_LABELS: Record<ReadingLogStatus, string> = {
  submit: '제출',
  approve: '승인',
  rejected: '반려',
};

export const READING_LOG_STATUS_OPTIONS: ReadonlyArray<{
  value: ReadingLogStatusFilter;
  label: string;
}> = [
  { value: 'ALL', label: '전체 상태' },
  { value: 'submit', label: READING_LOG_STATUS_LABELS.submit },
  { value: 'approve', label: READING_LOG_STATUS_LABELS.approve },
  { value: 'rejected', label: READING_LOG_STATUS_LABELS.rejected },
];

export const READING_LOG_REVIEW_OPTIONS: ReadonlyArray<{
  value: ReadingLogReviewFilter;
  label: string;
}> = [
  { value: 'ALL', label: '전체 검토 상태' },
  { value: 'safe', label: '자동 검증 이상 없음' },
  { value: 'warning', label: '확인 필요' },
];

export const READING_LOG_REJECTION_REASONS = [
  '책 전체 페이지 수가 실제 도서 정보와 다름',
  '누적 독서량이 책 전체 페이지 수를 초과함',
  '하루 독서량이 400쪽을 초과함',
  '제외 도서에 해당함',
  '책 제목·저자·출판사 정보가 정확하지 않음',
  '읽은 페이지 수 확인이 필요함',
  '기타',
] as const;

export const DAILY_READING_PAGE_LIMIT = 400;
export const METERS_PER_PAGE = 5;

export function getReadingLogTotalPages(log: AdminReadingLog) {
  return log.books.reduce((sum, book) => sum + book.readPages, 0);
}

export function getReadingDistanceMeters(readPages: number) {
  return readPages * METERS_PER_PAGE;
}

export function getExpectedApprovedPages(book: ReadingLogBookEntry) {
  return book.previouslyApprovedPages + book.readPages;
}

export function getRemainingPages(book: ReadingLogBookEntry) {
  return book.totalPages - getExpectedApprovedPages(book);
}

export function validateReadingLog(
  log: AdminReadingLog,
): ReadingLogValidationIssue[] {
  const issues: ReadingLogValidationIssue[] = [];
  const totalReadPages = getReadingLogTotalPages(log);

  if (log.books.length === 0 || totalReadPages <= 0) {
    issues.push({
      code: 'invalid-pages',
      label: '잘못된 페이지 값',
      detail:
        log.books.length === 0
          ? '등록된 책이 없습니다.'
          : '하루 전체 독서량은 1쪽 이상이어야 합니다.',
    });
  }

  if (totalReadPages > DAILY_READING_PAGE_LIMIT) {
    issues.push({
      code: 'daily-limit',
      label: '일일 400쪽 초과',
      detail: `하루 전체 독서량이 ${totalReadPages}쪽으로 제한을 초과했습니다.`,
    });
  }

  log.books.forEach((book) => {
    const hasInvalidPageValue =
      book.totalPages <= 0 ||
      book.readPages <= 0 ||
      book.previouslyApprovedPages < 0 ||
      book.previouslyApprovedPages > book.totalPages;

    if (hasInvalidPageValue) {
      issues.push({
        code: 'invalid-pages',
        label: '잘못된 페이지 값',
        detail: `${book.title || '제목 없는 책'}의 페이지 값을 확인해 주세요.`,
        bookEntryId: book.id,
      });
    }

    if (
      !hasInvalidPageValue &&
      getExpectedApprovedPages(book) > book.totalPages
    ) {
      issues.push({
        code: 'book-total-overflow',
        label: '책 전체 페이지 초과',
        detail: `${book.title || '제목 없는 책'}의 승인 예상 누적이 전체 페이지를 초과합니다.`,
        bookEntryId: book.id,
      });
    }

    if (
      !book.title.trim() ||
      !book.author.trim() ||
      !book.publisher.trim()
    ) {
      issues.push({
        code: 'missing-book-info',
        label: '도서 정보 누락',
        detail: '책 제목·저자·출판사 정보를 모두 확인해 주세요.',
        bookEntryId: book.id,
      });
    }
  });

  return issues;
}

export function hasBlockingValidationIssue(log: AdminReadingLog) {
  return validateReadingLog(log).length > 0;
}

export function formatReadingLogDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(`${value}T00:00:00`));
}

export function formatReadingLogDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export function formatReadingDistance(meters: number) {
  return meters >= 1000
    ? `${(meters / 1000).toLocaleString('ko-KR', {
        maximumFractionDigits: 2,
      })}km`
    : `${meters.toLocaleString('ko-KR')}m`;
}
