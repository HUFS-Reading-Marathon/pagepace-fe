import type { Notice } from '../../api/noticeApi';

/** 사용자 공지사항 게시판: 한 쪽에 10건 */
export const NOTICE_PAGE_SIZE = 10;

/** 목록에서 상세로 갈 때 넘기는 상태. 상세의 "목록으로"가 검색어·쪽 번호를 지킨 주소로 돌아갑니다. */
export type NoticeLinkState = { listSearch?: string } | null;

export const noticeDate = (notice: Notice) => notice.publishedAt ?? notice.updatedAt;

/**
 * 서버와 같은 순서(중요 공지 먼저, 그다음 게시일 최신순)로 정렬합니다. 서버가 이미 이 순서로 주지만,
 * 목데이터 등 다른 순서로 와도 같은 결과가 되도록 한 번 더 맞춥니다.
 */
export function orderNotices(notices: Notice[]) {
  return [...notices].sort(
    (left, right) =>
      Number(right.pinned) - Number(left.pinned) ||
      noticeDate(right).localeCompare(noticeDate(left)) ||
      right.noticeId - left.noticeId,
  );
}

/** 제목 검색(대소문자·앞뒤 공백 무시). 서버 검색 파라미터는 쓰지 않습니다. */
export function searchNotices(notices: Notice[], query: string) {
  const keyword = query.trim().toLocaleLowerCase();
  return keyword
    ? notices.filter((notice) => notice.title.toLocaleLowerCase().includes(keyword))
    : notices;
}

/**
 * 중요 공지 표시. 제목에 이미 "[중요]"가 있으면 같은 표시를 두 번 하지 않도록 배지를 생략합니다
 * (서버에 저장된 제목은 바꾸지 않습니다).
 */
export function showsImportantBadge(notice: Notice) {
  return notice.pinned && !/^\s*\[중요\]/.test(notice.title);
}

export type NoticeBoardState = { query: string; page: number };

export function readNoticeBoardState(params: URLSearchParams): NoticeBoardState {
  const page = Number(params.get('page'));
  return {
    query: params.get('q') ?? '',
    page: Number.isInteger(page) && page > 1 ? page - 1 : 0,
  };
}

/** 검색어·쪽 번호를 주소에 씁니다(기본값은 생략). */
export function writeNoticeBoardState({ query, page }: NoticeBoardState) {
  const next = new URLSearchParams();
  if (query.trim()) next.set('q', query.trim());
  if (page > 0) next.set('page', String(page + 1));
  return next;
}
