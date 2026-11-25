import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import EventContactCard from '../src/components/main/EventContactCard';
import type { CurrentEvent } from '../src/api/eventApi';
import { createMockDb, MOCK_ADMIN_LOGIN } from '../src/mocks/mockDb';
import { handleMockRequest, resetMockDb } from '../src/mocks/mockHandlers';
import {
  answerState,
  readUserInquiryState,
  userInquiryViews,
  visibilityLabel,
  writeUserInquiryState,
} from '../src/pages/inquiries/inquiryBoardState';

async function call(path: string, init: RequestInit & { token?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.token) headers.set('Authorization', `Bearer ${init.token}`);
  const response = await handleMockRequest(path, { ...init, headers });
  return { status: response.status, payload: await response.json() };
}

async function login(studentNo: string) {
  const { payload } = await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ studentNo, password: 'any' }),
  });
  return payload.data.accessToken as string;
}

const ask = (token: string, title: string, publicEntry: boolean) =>
  call('/api/me/inquiries', {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content: '첫 줄\n둘째 줄', publicEntry }),
  });

describe('사용자 문의 게시판 주소 상태', () => {
  it('처음에는 자주 묻는 질문, 내 문의는 로그인한 일반 사용자에게만 연다', () => {
    expect(userInquiryViews(false)).toEqual(['faq', 'public']);
    expect(userInquiryViews(true)).toEqual(['faq', 'public', 'mine']);
    expect(readUserInquiryState(new URLSearchParams(''), ['faq', 'public'])).toEqual({
      view: 'faq',
      query: '',
      page: 0,
    });
    // 비로그인 상태에서 내 문의 주소로 와도 자주 묻는 질문을 보여 줍니다.
    expect(readUserInquiryState(new URLSearchParams('view=mine'), ['faq', 'public']).view).toBe(
      'faq',
    );
  });

  it('기존 게시판과 같은 view·q·page(0부터) 형식을 쓰고 기본값은 생략한다', () => {
    const params = writeUserInquiryState({ view: 'public', query: ' 서평 ', page: 2 });
    expect(params.toString()).toBe('view=public&q=%EC%84%9C%ED%8F%89&page=2');
    expect(readUserInquiryState(params, ['faq', 'public'])).toEqual({
      view: 'public',
      query: '서평',
      page: 2,
    });
    expect(writeUserInquiryState({ view: 'faq', query: '', page: 0 }).toString()).toBe('');
    expect(readUserInquiryState(new URLSearchParams('page=-3'), ['faq']).page).toBe(0);
  });

  it('답변 상태와 내 문의의 공개 여부를 구분한다', () => {
    expect(answerState({ answer: null })).toBe('waiting');
    expect(answerState({ answer: '  ' })).toBe('waiting');
    expect(answerState({ answer: '답변' })).toBe('answered');
    expect(visibilityLabel({ publicEntry: false, answer: '답변' })).toBe('비공개');
    expect(visibilityLabel({ publicEntry: true, answer: null })).toBe('답변 후 공개');
    expect(visibilityLabel({ publicEntry: true, answer: '답변' })).toBe('공개');
  });
});

describe('문의 및 운영 정보', () => {
  const event = {
    contactPhone: '02-0000-0000',
    contactEmail: 'library@example.com',
    kakaoOpenChatUrl: 'https://open.kakao.com/o/example',
  } as CurrentEvent;

  it('전화·이메일·소속과 문의 게시판 바로가기를 보이고, 오픈채팅은 보이지 않는다', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <EventContactCard currentEvent={event} />
      </MemoryRouter>,
    );
    expect(html).toContain('전화 문의');
    expect(html).toContain('mailto:library@example.com');
    expect(html).toContain('글로벌캠퍼스 도서관');
    expect(html).toContain('href="/inquiries"');
    expect(html).toContain('문의 게시판 바로가기');
    expect(html).not.toContain('open.kakao.com');
    expect(html).not.toContain('운영 채널');
  });
});

describe('목데이터 문의 API(서버 정책과 같게)', () => {
  beforeEach(() => resetMockDb());

  it('공개 문의는 답변이 등록된 뒤에만, 비공개 문의는 보이지 않고, 작성자 이름은 내려 주지 않는다', async () => {
    const participant = createMockDb().users.find((user) => user.studentNo === 'M7020')!;
    const token = await login(participant.studentNo);
    expect((await ask(token, '공개 질문', true)).status).toBe(200);
    expect((await ask(token, '비공개 질문', false)).status).toBe(200);

    const titles = async () =>
      (await call('/api/inquiries?kind=QUESTION&q=&page=0')).payload.data.items.map(
        (item: { title: string }) => item.title,
      );
    expect(await titles()).not.toContain('공개 질문');

    const mine = (await call('/api/me/inquiries?q=질문&page=0', { token })).payload.data.items;
    expect(mine.map((item: { title: string }) => item.title).sort()).toEqual([
      '공개 질문',
      '비공개 질문',
    ]);
    expect(mine.every((item: { authorName: string | null }) => item.authorName === null)).toBe(
      true,
    );

    const admin = await login(MOCK_ADMIN_LOGIN);
    for (const item of mine) {
      const answered = await call(`/api/admin/inquiries/${item.id}/answer`, {
        method: 'PUT',
        token: admin,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: '답변입니다.', version: item.version }),
      });
      expect(answered.status).toBe(200);
    }
    const published = await titles();
    expect(published).toContain('공개 질문');
    expect(published).not.toContain('비공개 질문');
    const publicItems = (await call('/api/inquiries?kind=QUESTION&q=&page=0')).payload.data.items;
    expect(
      publicItems.every((item: { authorName: string | null }) => item.authorName === null),
    ).toBe(true);
    // 관리자 목록에는 작성자 이름이 있습니다.
    const adminItems = (
      await call('/api/admin/inquiries?kind=QUESTION&q=질문&page=0', { token: admin })
    ).payload.data.items;
    expect(adminItems.every((item: { authorName: string | null }) => !!item.authorName)).toBe(true);
  });

  it('참가 신청이 승인되지 않은 회원은 문의를 등록할 수 없다', async () => {
    const db = createMockDb();
    const approved = new Set(
      db.applications.filter((item) => item.status === 'APPROVED').map((item) => item.userId),
    );
    const stranger = db.users.find((user) => user.role === 'USER' && !approved.has(user.userId))!;
    const result = await ask(await login(stranger.studentNo), '질문', false);
    expect(result.status).toBe(403);
    expect(result.payload.code).toBe('APPROVAL_REQUIRED');
  });
});
