import { ApiError, apiRequest } from './apiClient';
import type {
  AccessTokenResponse,
  LoginRequest,
} from '../auth/authTypes';

const LOGIN_PATH = '/api/auth/login';

export async function login(credentials: LoginRequest) {
  const response = await apiRequest<AccessTokenResponse>(LOGIN_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
    skipAuth: true,
  });
  const accessToken = response?.accessToken?.trim();

  if (!accessToken) {
    throw new ApiError(
      '로그인 응답에 Access Token이 없습니다.',
      200,
      'INVALID_LOGIN_RESPONSE',
    );
  }

  return { accessToken } satisfies AccessTokenResponse;
}
