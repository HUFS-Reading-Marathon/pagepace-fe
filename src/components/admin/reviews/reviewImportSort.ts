import type { ImportedReview } from '../../../api/reviewImportApi';
import {
  getDefaultCandidate,
  REVIEW_IMPORT_VIEWS,
  type ReviewImportView,
} from '../../../types/adminReviewImport';
import { orderValue, sortRows, timeValue, type SortState } from '../table/sorting';

/** 엑셀 대조 표에서 정렬할 수 있는 컬럼. 엑셀 행은 원본 파일의 실제 행 번호라 정렬 대상입니다. */
export type ReviewImportSortColumn =
  | 'sourceRow'
  | 'memberName'
  | 'bookTitle'
  | 'sourceUpdatedAt'
  | 'reason'
  | 'pages'
  | 'meters'
  | 'status'
  | 'result';
export type ReviewImportSort = SortState<ReviewImportSortColumn>;

/** 기본: 원본 엑셀 행 순서(서버가 내려 주는 순서와 같음) */
export const DEFAULT_REVIEW_IMPORT_SORT: ReviewImportSort = {
  column: 'sourceRow',
  direction: 'ascending',
};

/** 보기마다 표에 나오는 정렬 컬럼과 제목(체크박스·상세 버튼 제외, 표시 순서대로) */
export const REVIEW_IMPORT_SORT_COLUMNS: Record<
  Exclude<ReviewImportView, 'excluded'>,
  [ReviewImportSortColumn, string][]
> = {
  ready: [
    ['sourceRow', '엑셀 행'],
    ['memberName', '작성자'],
    ['bookTitle', '서평 도서'],
    ['sourceUpdatedAt', '서평 최종 수정'],
    ['pages', '인정 쪽수'],
    ['meters', '인정 거리'],
  ],
  review: [
    ['sourceRow', '엑셀 행'],
    ['memberName', '작성자'],
    ['bookTitle', '서평 도서'],
    ['reason', '확인 사항'],
    ['pages', '인정 쪽수'],
    ['meters', '인정 거리'],
  ],
  done: [
    ['sourceRow', '엑셀 행'],
    ['memberName', '작성자'],
    ['bookTitle', '서평 도서'],
    ['status', '상태'],
    ['result', '반영 내용'],
  ],
  blocked: [
    ['sourceRow', '엑셀 행'],
    ['memberName', '작성자'],
    ['bookTitle', '서평 도서'],
    ['status', '상태'],
    ['reason', '사유'],
  ],
};

/** 상태 순서: 대조 결과 보기 순서(반영 가능 → 확인 필요 → 처리 완료 → 반영 불가 → 비참가자) */
const STATUS_ORDER = REVIEW_IMPORT_VIEWS.flatMap((view) => view.statuses);

function importSortValue(row: ImportedReview, column: ReviewImportSortColumn) {
  switch (column) {
    case 'sourceRow':
      return row.sourceRow;
    case 'memberName':
      return row.memberName?.trim();
    case 'bookTitle':
      return row.bookTitle?.trim();
    case 'sourceUpdatedAt':
      return timeValue(row.sourceUpdatedAt);
    case 'reason':
      return row.warnings[0];
    // 후보 도서가 여러 권이라 아직 정해지지 않은 행은 값이 없는 것으로 보고 마지막에 둡니다.
    case 'pages':
      return getDefaultCandidate(row)?.uncreditedPages;
    case 'meters':
      return getDefaultCandidate(row)?.distanceToCreditMeter;
    case 'status':
      return orderValue(STATUS_ORDER, row.status);
    case 'result':
      return row.verification?.creditedPages;
  }
}

/** 보기에 없는 컬럼으로 정렬 중이면 기본 정렬로 돌립니다. */
export function sortForView(sort: ReviewImportSort, view: ReviewImportView): ReviewImportSort {
  if (view === 'excluded') return DEFAULT_REVIEW_IMPORT_SORT;
  return REVIEW_IMPORT_SORT_COLUMNS[view].some(([column]) => column === sort.column)
    ? sort
    : DEFAULT_REVIEW_IMPORT_SORT;
}

/** 보기·검색으로 거른 전체 행을 정렬합니다(페이지 나누기 전). 값이 같으면 엑셀 행, 그다음 행 ID 순입니다. */
export function sortImportRows(rows: ImportedReview[], sort: ReviewImportSort) {
  return sortRows(
    rows,
    sort,
    importSortValue,
    (left, right) => left.sourceRow - right.sourceRow || left.id - right.id,
  );
}
