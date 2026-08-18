import {
  clearAuthStorage,
  emitAuthChange,
  getAccessToken,
  saveAccessToken,
} from '../auth/authStorage';
import type { ApiResponse } from '../auth/authTypes';

type ApiRequestOptions = RequestInit & {
  skipAuth?: boolean;
  skipRefresh?: boolean;
};

let refreshPromise: Promise<string> | null = null;

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const response = value as Record<string, unknown>;

  return (
    typeof response.success === 'boolean' &&
    typeof response.code === 'string' &&
    typeof response.message === 'string' &&
    'data' in response
  );
}

async function parseApiResponse<T>(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(text);

    return isApiResponse(parsed) ? (parsed as ApiResponse<T>) : null;
  } catch {
    return null;
  }
}

function getHttpErrorMessage(status: number) {
  if (status === 400) {
    return '입력한 정보를 다시 확인해 주세요.';
  }

  if (status === 401) {
    return '학번/교번/사번 또는 비밀번호가 올바르지 않습니다.';
  }

  if (status === 403) {
    return '요청을 처리할 권한이 없습니다.';
  }

  if (status >= 500) {
    return '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }

  return '요청을 처리하는 중 오류가 발생했습니다.';
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T | null> {
  const {
    skipAuth = false,
    skipRefresh = false,
    headers: initialHeaders,
    ...fetchOptions
  } = options;
  const headers = new Headers(initialHeaders);
  const token = skipAuth ? null : getAccessToken();

  headers.set('Accept', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(path, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(
      '서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.',
      0,
      'NETWORK_ERROR',
    );
  }

  const payload = await parseApiResponse<T>(response);

  if (response.status === 401 && !skipAuth && !skipRefresh) {
    try {
      await refreshAccessToken();

      return apiRequest<T>(path, {
        ...options,
        headers: initialHeaders,
        skipRefresh: true,
      });
    } catch (refreshError) {
      clearAuthStorage();
      emitAuthChange();
      throw refreshError;
    }
  }

  if (!response.ok || !payload?.success) {
    throw new ApiError(
      payload?.message || getHttpErrorMessage(response.status),
      response.status,
      payload?.code,
    );
  }

  return payload.data;
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
      const payload = await parseApiResponse<{ accessToken: string }>(response);
      const accessToken = payload?.data?.accessToken?.trim();

      if (!response.ok || !payload?.success || !accessToken) {
        throw new ApiError(
          payload?.message || '로그인이 만료되었습니다.',
          response.status,
          payload?.code,
        );
      }

      saveAccessToken(accessToken);
      return accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}
