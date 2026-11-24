import { describe, expect, it } from 'vitest';
import type { Notice } from '../src/api/noticeApi';
import {
  NOTICE_PAGE_SIZE,
  orderNotices,
  readNoticeBoardState,
  searchNotices,
  showsImportantBadge,
  writeNoticeBoardState,
} from '../src/pages/notices/noticeBoard';

const notice = (noticeId: number, patch: Partial<Notice> = {}): Notice => ({
  noticeId,
  title: `공지 ${noticeId}`,
  content: '',
  pinned: false,
  visible: true,
  authorName: '도서관 관리자',
  publishedAt: `2026-11-${String(noticeId).padStart(2, '0')}T10:00:00`,
  updatedAt: '2026-11-01T10:00:00',
  ...patch,
});

describe('사용자 공지사항 게시판', () => {
  it('서버와 같은 순서로 중요 공지를 먼저, 그다음 게시일 최신순으로 둔다', () => {
    const rows = orderNotices([
      notice(1),
      notice(3),
      notice(2, { pinned: true }),
      notice(4, { publishedAt: null, updatedAt: '2026-11-20T09:00:00' }),
    ]);
    expect(rows.map((row) => row.noticeId)).toEqual([2, 4, 3, 1]);
  });

  it('제목으로만 찾고 대소문자·앞뒤 공백을 무시한다', () => {
    const rows = [notice(1, { title: 'PagePace 안내' }), notice(2, { title: '휴관일' })];
    expect(searchNotices(rows, ' pagepace ').map((row) => row.noticeId)).toEqual([1]);
    expect(searchNotices(rows, '')).toHaveLength(2);
    expect(searchNotices(rows, '없는 제목')).toHaveLength(0);
  });

  it('제목에 이미 [중요]가 있는 중요 공지에는 배지를 겹쳐 붙이지 않고 제목은 그대로 둔다', () => {
    const marked = notice(1, { pinned: true, title: '[중요] 마감 안내' });
    expect(showsImportantBadge(marked)).toBe(false);
    expect(marked.title).toBe('[중요] 마감 안내');
    expect(showsImportantBadge(notice(2, { pinned: true }))).toBe(true);
    expect(showsImportantBadge(notice(3))).toBe(false);
  });

  it('10건씩 나누고 검색어·쪽 번호를 주소에 담는다(기본값 생략)', () => {
    expect(NOTICE_PAGE_SIZE).toBe(10);
    const rows = orderNotices(Array.from({ length: 23 }, (_, index) => notice(index + 1)));
    expect(rows.slice(20, 30)).toHaveLength(3);
    const params = writeNoticeBoardState({ query: ' 휴관 ', page: 2 });
    expect(params.toString()).toBe('q=%ED%9C%B4%EA%B4%80&page=3');
    expect(readNoticeBoardState(params)).toEqual({ query: '휴관', page: 2 });
    expect(writeNoticeBoardState({ query: '', page: 0 }).toString()).toBe('');
    expect(readNoticeBoardState(new URLSearchParams('page=-4'))).toEqual({ query: '', page: 0 });
  });
});
