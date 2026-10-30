import { apiRequest, ApiError } from './apiClient';
export type ReviewImportBatch = {
  id: number;
  eventId: number;
  eventTitle: string;
  filename: string;
  rowCount: number;
  createdAt: string;
  uploadedBy: string;
};
export type ReviewCandidate = {
  participantBookId: number;
  name: string;
  studentNo: string;
  bookTitle: string;
  libraryBookId: number;
  approvedPages: number;
  uncreditedPages: number;
  distanceToCreditMeter: number;
  matchType: 'LIBRARY_ID' | 'TITLE';
};
export type ReviewVerification = {
  id: number;
  participantBookId: number;
  creditedPages: number;
  creditedDistanceMeter: number;
  verifiedBy: string;
  verifiedAt: string;
  alreadyApplied: boolean;
};
export type ImportedReview = {
  id: number;
  sourceRow: number;
  libraryBookId: number | null;
  bookTitle: string;
  bibliographicInfo: string;
  memberNo: string;
  memberName: string;
  reviewTitle: string;
  content: string;
  sourceUpdatedAt: string | null;
  status: 'INVALID' | 'UNMATCHED' | 'NO_CREDIT' | 'MATCHED' | 'NEEDS_REVIEW' | 'ALREADY_APPLIED';
  warnings: string[];
  candidates: ReviewCandidate[];
  verification: ReviewVerification | null;
};
export type ReviewImportDetail = {
  batch: ReviewImportBatch;
  page: number;
  totalPages: number;
  rows: ImportedReview[];
};
export type ReviewImportHistory = {
  page: number;
  totalPages: number;
  batches: ReviewImportBatch[];
};
export type ReviewConfirmation = {
  participantBookId: number;
  expectedApprovedPages: number;
  expectedUncreditedPages: number;
  evidenceChecked: boolean;
  note: string;
};
const PATH = '/api/admin/review-imports';
async function required<T>(path: string, options?: RequestInit): Promise<T> {
  const data = await apiRequest<T>(path, options);
  if (!data) throw new ApiError('서평 자료 응답을 확인할 수 없습니다.');
  return data;
}
export function uploadReviewExcel(eventId: number, file: File) {
  const body = new FormData();
  body.append('file', file);
  return required<ReviewImportBatch>(`${PATH}?eventId=${eventId}`, { method: 'POST', body });
}
export function getReviewImportHistory(eventId: number, page = 0) {
  return required<ReviewImportHistory>(`${PATH}?eventId=${eventId}&page=${page}`);
}
export function getReviewImportDetail(eventId: number, batchId: number, page = 0) {
  return required<ReviewImportDetail>(`${PATH}/${batchId}?eventId=${eventId}&page=${page}`);
}
export function confirmImportedReview(
  eventId: number,
  batchId: number,
  rowId: number,
  request: ReviewConfirmation,
) {
  return required<ReviewVerification>(
    `${PATH}/${batchId}/rows/${rowId}/confirm?eventId=${eventId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
  );
}
