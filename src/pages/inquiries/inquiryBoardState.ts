import type { Inquiry } from '../../api/inquiryApi';

/** 사용자 문의 게시판의 탭. 내 문의는 로그인한 일반 사용자에게만 보입니다. */
export type UserInquiryView = 'faq' | 'public' | 'mine';

export const USER_VIEW_LABELS: Record<UserInquiryView, string> = {
  faq: '자주 묻는 질문',
  public: '공개 문의',
  mine: '내 문의',
};

export function userInquiryViews(canAsk: boolean): UserInquiryView[] {
  return canAsk ? ['faq', 'public', 'mine'] : ['faq', 'public'];
}

export type UserInquiryState = { view: UserInquiryView; query: string; page: number };

/** 주소의 view·q·page를 읽습니다. 쓸 수 없는 탭이나 잘못된 쪽 번호는 기본값(자주 묻는 질문, 첫 쪽)으로 둡니다. */
export function readUserInquiryState(
  params: URLSearchParams,
  views: readonly UserInquiryView[],
): UserInquiryState {
  const requested = params.get('view') as UserInquiryView | null;
  const page = Number(params.get('page') ?? 0);
  return {
    view: requested && views.includes(requested) ? requested : 'faq',
    query: (params.get('q') ?? '').trim(),
    page: Number.isSafeInteger(page) && page > 0 ? page : 0,
  };
}

/** 기존 게시판과 같은 주소 형식(view, q, page: 0부터)으로 씁니다. 기본값은 생략합니다. */
export function writeUserInquiryState({ view, query, page }: UserInquiryState) {
  const next = new URLSearchParams();
  if (view !== 'faq') next.set('view', view);
  if (query.trim()) next.set('q', query.trim());
  if (page > 0) next.set('page', String(page));
  return next;
}

export type AnswerState = 'answered' | 'waiting';

export function answerState(item: Pick<Inquiry, 'answer'>): AnswerState {
  return item.answer?.trim() ? 'answered' : 'waiting';
}

export const ANSWER_LABELS: Record<AnswerState, string> = {
  answered: '답변 완료',
  waiting: '답변 대기',
};

/**
 * 내 문의의 공개 여부. 공개를 고른 문의도 서버 정책상 답변이 등록된 뒤에만 공개 문의에 보입니다.
 */
export function visibilityLabel(item: Pick<Inquiry, 'publicEntry' | 'answer'>) {
  if (!item.publicEntry) return '비공개';
  return answerState(item) === 'answered' ? '공개' : '답변 후 공개';
}
