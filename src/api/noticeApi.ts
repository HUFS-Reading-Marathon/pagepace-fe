import { ApiError, apiRequest } from './apiClient';

export type Notice = {
  noticeId: number;
  title: string;
  content: string;
  pinned: boolean;
  visible: boolean;
  authorName: string;
  publishedAt: string | null;
  updatedAt: string;
};

export type NoticeRequest = Pick<Notice, 'title' | 'content' | 'pinned' | 'visible'>;

const NOTICES_PATH = '/api/notices';
const ADMIN_NOTICES_PATH = '/api/admin/notices';

function jsonOptions(method: 'POST' | 'PATCH', body: NoticeRequest): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function getNotices() {
  const notices = await apiRequest<Notice[]>(NOTICES_PATH, {
    method: 'GET',
    skipAuth: true,
  });

  return notices ?? [];
}

export async function getNotice(noticeId: string | number) {
  const notice = await apiRequest<Notice>(`${NOTICES_PATH}/${noticeId}`, {
    method: 'GET',
    skipAuth: true,
  });

  if (!notice) {
    throw new ApiError('공지사항 응답을 확인할 수 없습니다.', 200, 'INVALID_NOTICE_RESPONSE');
  }

  return notice;
}

export async function getAdminNotices() {
  const notices = await apiRequest<Notice[]>(ADMIN_NOTICES_PATH, {
    method: 'GET',
  });

  return notices ?? [];
}

export function createAdminNotice(request: NoticeRequest) {
  return apiRequest<Notice>(ADMIN_NOTICES_PATH, jsonOptions('POST', request));
}

export function updateAdminNotice(noticeId: number, request: NoticeRequest) {
  return apiRequest<Notice>(`${ADMIN_NOTICES_PATH}/${noticeId}`, jsonOptions('PATCH', request));
}

export function deleteAdminNotice(noticeId: number) {
  return apiRequest<null>(`${ADMIN_NOTICES_PATH}/${noticeId}`, {
    method: 'DELETE',
  });
}
