export const ADMIN_READING_LOG_STATUSES = [
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
] as const;

export type AdminReadingLogStatus =
  (typeof ADMIN_READING_LOG_STATUSES)[number];

export type AdminReadingLogBookResponse = {
  readingLogBookId: number;
  bookTitle: string;
  author: string;
  publisher: string;
  isbn: string;
  coverImageUrl: string;
  totalBookPages: number;
  submittedReadPages: number;
  existingApprovedReadPages: number;
  expectedApprovedReadPages: number;
  remainingPagesAfterApproval: number;
  completedAfterApproval: boolean;
  pageExceeded: boolean;
  warningMessage: string;
  displayOrder: number;
};

export type AdminReadingLogResponse = {
  readingLogId: number;
  participationId: number;
  userId: number;
  studentNo: string;
  userName: string;
  eventId: number;
  eventTitle: string;
  courseId: number;
  courseName: string;
  readingDate: string;
  totalReadPages: number;
  convertedDistanceMeter: number;
  status: AdminReadingLogStatus;
  adminComment: string;
  reviewedAt: string;
  createdAt: string;
  updatedAt: string;
  books: AdminReadingLogBookResponse[];
  recommendedRejectReasons: string[];
};

export type AdminReadingLogListParams = {
  eventId: number;
  status?: AdminReadingLogStatus;
};

export type RejectAdminReadingLogRequest = {
  reason: string;
};
