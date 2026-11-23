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

/** 솔라스 값과 PagePace 기록을 항목별로 비교한 결과 */
export type ReviewCompareMark = 'same' | 'edition' | 'title' | 'different' | 'none';

export const REVIEW_COMPARE_MARK_LABELS: Record<ReviewCompareMark, string> = {
  same: '일치',
  edition: '판본 일치',
  title: '제목으로 찾음',
  different: '다름',
  none: '—',
};

export type ReviewComparison = {
  key: 'memberNo' | 'name' | 'bookId' | 'bookTitle';
  label: string;
  source: string | null;
  record: string | undefined;
  mark: ReviewCompareMark;
};

/**
 * 회원번호·이름·도서 ID·도서명을 비교합니다.
 * 도서 ID가 달라도 서버가 승인된 다른 판본으로 찾았으면 '판본 일치', 제목으로만 찾았으면
 * '제목으로 찾음'으로 표시합니다.
 */
export function getReviewComparisons(
  row: ImportedReview,
  candidate: ReviewCandidate | undefined,
): ReviewComparison[] {
  const mark = (same: boolean): ReviewCompareMark =>
    !candidate ? 'none' : same ? 'same' : 'different';
  const bookIdMark: ReviewCompareMark = !candidate
    ? 'none'
    : candidate.libraryBookId === row.libraryBookId
      ? 'same'
      : candidate.matchType === 'TITLE'
        ? 'title'
        : 'edition';

  return [
    {
      key: 'memberNo',
      label: '회원번호',
      source: row.memberNo,
      record: candidate?.studentNo,
      mark: mark(row.memberNo === candidate?.studentNo),
    },
    {
      key: 'name',
      label: '이름',
      source: row.memberName,
      record: candidate?.name,
      mark: mark(normalizeForCompare(row.memberName) === normalizeForCompare(candidate?.name)),
    },
    {
      key: 'bookId',
      label: '도서 ID',
      source: row.libraryBookId === null ? null : String(row.libraryBookId),
      record: candidate ? String(candidate.libraryBookId) : undefined,
      mark: bookIdMark,
    },
    {
      key: 'bookTitle',
      label: '도서명',
      source: row.bookTitle,
      record: candidate?.bookTitle,
      mark: mark(normalizeForCompare(row.bookTitle) === normalizeForCompare(candidate?.bookTitle)),
    },
  ];
}

/**
 * 표 한 줄에 보여 줄 요약 대조 (회원번호·이름·도서).
 * 도서는 ID와 제목을 함께 보고, ID는 같지만 제목 표기가 다르면 확인이 필요한 것으로 봅니다.
 */
export function getCompactComparisons(row: ImportedReview, candidate: ReviewCandidate | undefined) {
  const [memberNo, name, bookId, bookTitle] = getReviewComparisons(row, candidate);
  const bookMark: ReviewCompareMark =
    bookId.mark === 'same' && bookTitle.mark === 'different' ? 'title' : bookId.mark;
  const bookLabel =
    bookId.mark === 'same' && bookTitle.mark === 'different'
      ? 'ID 같음 · 제목 표기 다름'
      : REVIEW_COMPARE_MARK_LABELS[bookMark];

  return [
    {
      key: 'memberNo',
      label: '회원번호',
      mark: memberNo.mark,
      title: REVIEW_COMPARE_MARK_LABELS[memberNo.mark],
    },
    { key: 'name', label: '이름', mark: name.mark, title: REVIEW_COMPARE_MARK_LABELS[name.mark] },
    { key: 'book', label: '도서', mark: bookMark, title: bookLabel },
  ] as const;
}

/** 대조표에서 행을 찾아 화면 안으로 옮길 때 쓰는 요소 id */
export function getReviewRowElementId(rowId: number) {
  return `reviewImportRow-${rowId}`;
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
