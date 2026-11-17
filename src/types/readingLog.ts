export type ReadingLogStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED';

/**
 * 사용자 화면에서 표시하는 독서일지 상태 라벨. 관리자 화면과 같은 이름을 씁니다.
 * '승인'은 일지 승인(쪽수 확정), '인정'은 서평 확인 후 거리에만 사용합니다.
 * 배지 색상 CSS는 라벨이 아닌 상태 값(`.status-SUBMITTED` 등)을 기준으로 합니다.
 */
export const READING_LOG_STATUS_LABELS: Record<ReadingLogStatus, string> = {
  SUBMITTED: '검토 대기',
  APPROVED: '승인',
  REJECTED: '반려',
};

export type ReadingLogBookRequest = {
  libraryBookId: number;
  bookTitle: string;
  author: string | null;
  publisher: string | null;
  isbn: string | null;
  coverImageUrl: string | null;
  callNo: string | null;
  totalBookPages: number;
  readPages: number;
};

export type ReadingLogBook = ReadingLogBookRequest & {
  readingLogBookId: number;
  displayOrder: number;
};

export type ReadingLog = {
  readingLogId: number;
  participationId: number;
  readingDate: string;
  totalReadPages: number;
  convertedDistanceMeter: number;
  status: ReadingLogStatus;
  adminComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  books: ReadingLogBook[];
};

export type ReadingLogRequest = {
  readingDate: string;
  books: ReadingLogBookRequest[];
};

export type ReviewTargetBook = {
  participantBookId: number;
  participationId: number;
  bookTitle: string;
  author: string | null;
  publisher: string | null;
  totalBookPages: number;
  approvedReadPages: number;
  completed: boolean;
  completedAt: string | null;
  reviewRequired: boolean;
  reviewCompleted: boolean;
  reviewCompletedAt: string | null;
  reviewSearchUrl: string;
};

export type ParticipantBook = {
  participantBookId: number;
  participationId: number;
  libraryBookId: number;
  bookTitle: string;
  author: string | null;
  publisher: string | null;
  isbn: string | null;
  coverImageUrl: string | null;
  callNo: string | null;
  totalBookPages: number;
  approvedReadPages: number;
  remainingPages: number;
  completed: boolean;
  completedAt: string | null;
  reviewRequired: boolean;
  reviewSearchUrl: string | null;
  reviewCompleted: boolean;
  reviewVerified: boolean;
  creditedReadPages: number;
};
