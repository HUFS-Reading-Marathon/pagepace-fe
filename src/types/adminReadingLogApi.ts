import type { ReadingLogStatus } from './readingLog';

/** 서버 ReadingLogStatus enum과 동일한 값입니다. */
export type AdminReadingLogStatus = ReadingLogStatus;

export type AdminReadingLogBookResponse = {
  readingLogBookId: number;
  bookTitle: string;
  author: string | null;
  publisher: string | null;
  isbn: string | null;
  coverImageUrl: string | null;
  totalBookPages: number;
  submittedReadPages: number;
  existingApprovedReadPages: number;
  expectedApprovedReadPages: number;
  remainingPagesAfterApproval: number;
  completedAfterApproval: boolean;
  pageExceeded: boolean;
  warningMessage: string | null;
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
  adminComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  books: AdminReadingLogBookResponse[];
  recommendedRejectReasons: string[] | null;
};

export type AdminReadingLogListParams = {
  eventId: number;
  status?: AdminReadingLogStatus;
};

export type RejectAdminReadingLogRequest = {
  reason: string;
};
