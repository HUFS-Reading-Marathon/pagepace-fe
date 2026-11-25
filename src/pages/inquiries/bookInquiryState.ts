import {
  REQUEST_STATUS_LABELS,
  type BookRequest,
  type NewBookRequest,
} from '../../api/bookRequestApi';

/** 사용자 도서 문의 목록 한 쪽의 건수(문의 게시판과 같은 10건) */
export const BOOK_INQUIRIES_PER_PAGE = 10;

/** 서버 상태값(PENDING·LINKED·REJECTED)과 라벨을 그대로 씁니다. 화면용 색 구분만 더합니다. */
export const BOOK_INQUIRY_TONE: Record<BookRequest['status'], 'waiting' | 'answered' | 'rejected'> =
  {
    PENDING: 'waiting',
    LINKED: 'answered',
    REJECTED: 'rejected',
  };
export const bookInquiryStatusLabel = (status: BookRequest['status']) =>
  REQUEST_STATUS_LABELS[status];

/** ISBN은 하이픈·공백을 빼고 비교합니다(관리자 목록과 같은 규칙). */
const compact = (value: string) => value.replace(/[\s-]/g, '').toLowerCase();

/** 도서명·ISBN 검색과 쪽 나누기. 서버는 본인 요청 전체를 최신순으로 내려 줍니다. */
export function pageBookInquiries(rows: BookRequest[], query: string, page: number) {
  const keyword = query.trim().toLowerCase();
  const isbnKeyword = compact(query);
  const matched = rows.filter(
    (row) =>
      !keyword ||
      row.title.toLowerCase().includes(keyword) ||
      (!!isbnKeyword && compact(row.isbn ?? '').includes(isbnKeyword)),
  );
  const pages = Math.max(1, Math.ceil(matched.length / BOOK_INQUIRIES_PER_PAGE));
  const current = Math.min(Math.max(0, page), pages - 1);
  return {
    items: matched.slice(
      current * BOOK_INQUIRIES_PER_PAGE,
      (current + 1) * BOOK_INQUIRIES_PER_PAGE,
    ),
    total: matched.length,
    pages,
    page: current,
  };
}

/** 학생에게 보여 줄 처리 결과 문구 */
export function bookInquiryResult(row: Pick<BookRequest, 'status' | 'rejectReason'>) {
  switch (row.status) {
    case 'PENDING':
      return '담당자가 도서관 소장 판본과 쪽수를 확인하고 있습니다.';
    case 'LINKED':
      return '소장 판본으로 확인되어 처음 요청한 날짜와 쪽수로 독서일지가 만들어졌습니다. 독서일지 검토에서 승인되면 거리에 반영됩니다.';
    case 'REJECTED':
      return row.rejectReason?.trim() || '반려 사유가 등록되지 않았습니다.';
  }
}

/** 도서 문의 작성 화면의 주소 값(독서일지 검색어 등). 도서명·ISBN 길이는 서버 제한에 맞춥니다. */
export function readBookInquiryPrefill(params: URLSearchParams) {
  return {
    title: (params.get('title') ?? '').trim().slice(0, 500),
    isbn: (params.get('isbn') ?? '').trim().slice(0, 50),
  };
}

/** 독서일지 검색어를 도서 문의 작성 주소로 바꿉니다. ISBN처럼 보이면 ISBN 칸에 넣습니다. */
export function bookInquiryWritePath(searchText = '') {
  const text = searchText.trim();
  const params = new URLSearchParams();
  if (text) params.set(/^[\d\s-]{10,17}[\dXx]?$/.test(text) ? 'isbn' : 'title', text);
  const search = params.toString();
  return `/inquiries/books/new${search ? `?${search}` : ''}`;
}

export type BookInquiryForm = {
  title: string;
  readPages: string;
  reason: NewBookRequest['reason'] | '';
  isbn: string;
  note: string;
};

/** 입력값 검사. 서버 규칙(도서명 1~500자, 쪽수 1~400, 사유 필수, ISBN 50자)과 같습니다. */
export function bookInquiryErrors(form: BookInquiryForm) {
  const errors: Partial<Record<keyof BookInquiryForm, string>> = {};
  if (!form.title.trim()) errors.title = '도서명을 입력해 주세요.';
  const pages = Number(form.readPages);
  if (!form.readPages.trim()) errors.readPages = '오늘 읽은 쪽수를 입력해 주세요.';
  else if (!Number.isInteger(pages) || pages < 1 || pages > 400)
    errors.readPages = '1쪽부터 400쪽까지 입력할 수 있습니다.';
  if (!form.reason) errors.reason = '확인이 필요한 이유를 선택해 주세요.';
  return errors;
}

/**
 * 독서일지 도서 검색에서 도서 문의를 안내할지 정합니다. 검색이 성공했는데 결과가 없거나,
 * 쪽수 정보가 없는(선택할 수 없는) 결과가 있을 때만 안내합니다. 검색 오류는 안내하지 않습니다.
 */
export function bookSearchInquiryHint(search: {
  empty: boolean;
  results: { pageCount?: number | null }[];
}) {
  if (search.empty) return '찾는 책이 검색되지 않나요?';
  if (search.results.some((result) => !result.pageCount)) return '쪽수를 확인할 수 없는 책인가요?';
  return '';
}
