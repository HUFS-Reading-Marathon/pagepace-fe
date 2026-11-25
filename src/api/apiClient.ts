import {
  clearAuthStorage,
  emitAuthChange,
  getAccessToken,
  saveAccessToken,
} from '../auth/authStorage';
import { MOCK_MODE } from '../mocks/mockMode';
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

/** ApiError면 서버 메시지를, 그 외 오류면 fallback 문구를 돌려줍니다. */
export function getApiErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
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

/**
 * 목데이터 모드(개발 서버 전용)에서는 실제 서버 대신 메모리 목 API가 응답합니다.
 * 운영 빌드에서는 import.meta.env.DEV가 false라 이 경로와 목 코드가 번들에 포함되지 않습니다.
 */
async function sendMockRequest(path: string, init: RequestInit) {
  const { handleMockRequest } = await import('../mocks/mockHandlers');
  return handleMockRequest(path, init);
}

async function requestResponse(
  path: string,
  options: ApiRequestOptions,
  accept: string,
): Promise<Response> {
  const {
    skipAuth = false,
    skipRefresh = false,
    headers: initialHeaders,
    ...fetchOptions
  } = options;
  const headers = new Headers(initialHeaders);
  const token = skipAuth ? null : getAccessToken();

  headers.set('Accept', accept);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;

  try {
    const init: RequestInit = { ...fetchOptions, headers, credentials: 'include' };
    response =
      import.meta.env.DEV && MOCK_MODE
        ? await sendMockRequest(path, init)
        : await fetch(path, init);
  } catch {
    throw new ApiError(
      '서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.',
      0,
      'NETWORK_ERROR',
    );
  }

  if (response.status === 401 && !skipAuth && !skipRefresh) {
    try {
      await refreshAccessToken();
    } catch (error) {
      // 백엔드는 리프레시 쿠키가 없으면 400(REFRESH_REQUIRED), 무효·만료·비활성 계정이면 401을 돌려줍니다.
      // 둘 다 세션을 되살릴 수 없으므로 정리하고, 네트워크 오류·5xx는 다음 요청에서 다시 시도합니다.
      if (
        error instanceof ApiError &&
        (error.status === 400 || error.status === 401) &&
        getAccessToken() === token
      ) {
        clearAuthStorage();
        emitAuthChange();
      }
      throw error;
    }
    return requestResponse(path, { ...options, skipRefresh: true }, accept);
  }
  return response;
}

export async function downloadExcel(path: string, options: RequestInit = {}) {
  const excel = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const response = await requestResponse(path, options, excel + ', application/json');
  if (!response.ok || !response.headers.get('Content-Type')?.startsWith(excel)) {
    const error = await parseApiResponse(response);
    throw new ApiError(
      error?.message || '엑셀 파일을 내려받지 못했습니다.',
      response.status,
      error?.code,
    );
  }
  return {
    file: await response.blob(),
    missingCallNumbers: Number(response.headers.get('X-Missing-Call-Numbers') ?? 0),
  };
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T | null> {
  const response = await requestResponse(path, options, 'application/json');
  const payload = await parseApiResponse<T>(response);
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
      const session = await apiRequest<{ accessToken: string }>('/api/auth/refresh', {
        method: 'POST',
        skipAuth: true,
        skipRefresh: true,
      });
      const accessToken = session?.accessToken?.trim();

      if (!accessToken) {
        throw new ApiError(
          '인증 갱신 응답을 확인하지 못했습니다.',
          200,
          'INVALID_REFRESH_RESPONSE',
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
