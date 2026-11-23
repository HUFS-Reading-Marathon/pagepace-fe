import type { ImportedReview, ReviewCandidate } from '../api/reviewImportApi';
import { formatKoDateTime24 } from '../utils/date';

export type ReviewImportStatus = ImportedReview['status'];

/** 솔라스 엑셀 행 대조 상태를 사서가 쓰는 말로 표시합니다. */
export const REVIEW_IMPORT_STATUS_LABELS: Record<ReviewImportStatus, string> = {
  MATCHED: '반영 가능',
  NEEDS_REVIEW: '확인 필요',
  ALREADY_APPLIED: '반영 완료',
  BOOK_VERIFIED: '인정된 도서',
  NO_CREDIT: '반영 불가',
  UNMATCHED: '기록 없음',
  INVALID: '자료 오류',
  EXCLUDED: '비참가자',
};

/**
 * 대조 결과 화면의 보기 단위입니다.
 * - ready: 경고 없이 일치해 바로 반영할 수 있는 서평 (여러 건을 한 번에 반영 가능)
 * - review: 후보는 있지만 사유 확인과 검토 메모가 필요한 서평
 * - done: 이 서평 또는 같은 책의 다른 서평으로 이미 인정된 행
 * - blocked: 반영할 수 없는 행 (기록 없음·자료 오류·인정할 쪽수 없음)
 * - excluded: 행사 참가자가 아닌 회원의 서평
 */
export type ReviewImportView = 'ready' | 'review' | 'done' | 'blocked' | 'excluded';

export const REVIEW_IMPORT_VIEWS: {
  key: ReviewImportView;
  label: string;
  statuses: ReviewImportStatus[];
}[] = [
  { key: 'ready', label: '반영 가능', statuses: ['MATCHED'] },
  { key: 'review', label: '확인 필요', statuses: ['NEEDS_REVIEW'] },
  { key: 'done', label: '처리 완료', statuses: ['ALREADY_APPLIED', 'BOOK_VERIFIED'] },
  { key: 'blocked', label: '반영 불가', statuses: ['NO_CREDIT', 'UNMATCHED', 'INVALID'] },
  { key: 'excluded', label: '비참가자', statuses: ['EXCLUDED'] },
];

export function getReviewImportView(status: ReviewImportStatus): ReviewImportView {
  return REVIEW_IMPORT_VIEWS.find((view) => view.statuses.includes(status))?.key ?? 'blocked';
}

/** 서버가 반영을 허용하는 상태(MATCHED, NEEDS_REVIEW)인지 확인합니다. */
export function isConfirmableRow(row: ImportedReview) {
  return (row.status === 'MATCHED' || row.status === 'NEEDS_REVIEW') && row.candidates.length > 0;
}

/**
 * 여러 건을 한 번에 반영할 수 있는 행인지 확인합니다.
 * 경고가 없고 후보 도서가 하나뿐이어서 검토 메모와 도서 선택이 필요 없는 행만 해당합니다.
 */
export function isBulkConfirmableRow(row: ImportedReview) {
  return row.status === 'MATCHED' && row.warnings.length === 0 && row.candidates.length === 1;
}

export function getDefaultCandidate(row: ImportedReview): ReviewCandidate | undefined {
  return row.candidates.length === 1 ? row.candidates[0] : undefined;
}

/** 후보 도서의 이번 인정 분량 (승인 누적 − 이미 인정 = 이번 인정) */
export function getCandidateCredit(candidate: ReviewCandidate) {
  return {
    approvedPages: candidate.approvedPages,
    alreadyCreditedPages: Math.max(0, candidate.approvedPages - candidate.uncreditedPages),
    creditPages: candidate.uncreditedPages,
    creditMeters: candidate.distanceToCreditMeter,
  };
}

/** 이름·도서명 비교용 정규화 (공백·대소문자 차이는 같은 값으로 봅니다) */
export function normalizeForCompare(value: string | null | undefined) {
  return (value ?? '').normalize('NFC').replace(/\s+/g, '').toLowerCase();
}

export function formatPages(pages: number) {
  return `${pages.toLocaleString('ko-KR')}쪽`;
}

export function formatMeters(meters: number) {
  return `${meters.toLocaleString('ko-KR')}m`;
}

export function formatSourceTime(value: string | null) {
  return value ? formatKoDateTime24(value) : '시각 정보 없음';
}

/** 검색어가 엑셀 행 번호·작성자·회원번호·도서명·후보 도서명 중 하나와 맞는지 확인합니다. */
export function matchesReviewImportKeyword(row: ImportedReview, keyword: string) {
  const normalized = keyword.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [
    String(row.sourceRow),
    row.memberName ?? '',
    row.memberNo ?? '',
    row.bookTitle ?? '',
    ...row.candidates.flatMap((candidate) => [candidate.bookTitle, candidate.name]),
  ].some((value) => value.toLowerCase().includes(normalized));
}
