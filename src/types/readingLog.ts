export type ReadingLogStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED';

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
};
