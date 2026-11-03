import { ApiError, apiRequest } from './apiClient';
import type {
  AccessTokenResponse,
  AffiliationType,
  AuthUser,
  LoginRequest,
  UserRole,
  UserStatus,
} from '../auth/authTypes';

const LOGIN_PATH = '/api/auth/login';
const CURRENT_USER_PATH = '/api/me';
const LOGOUT_PATH = '/api/auth/logout';
const PASSWORD_RESET_SEND_PATH = '/api/auth/password-reset/email-verifications/send';
const PASSWORD_RESET_CONFIRM_PATH = '/api/auth/password-reset/email-verifications/confirm';

const USER_ROLES: ReadonlyArray<UserRole> = ['USER', 'ADMIN', 'SUPER_ADMIN'];
const USER_STATUSES: ReadonlyArray<UserStatus> = ['ACTIVE', 'INACTIVE', 'BANNED', 'DELETED'];
const AFFILIATION_TYPES: ReadonlyArray<AffiliationType> = [
  'UNDERGRADUATE',
  'GRADUATE',
  'PROFESSOR',
  'STAFF',
  'OTHER',
];

function isCurrentUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const user = value as Record<string, unknown>;

  return (
    typeof user.userId === 'number' &&
    Number.isInteger(user.userId) &&
    typeof user.studentNo === 'string' &&
    typeof user.name === 'string' &&
    (typeof user.email === 'string' || user.email === null) &&
    (typeof user.phone === 'string' || user.phone === null) &&
    (typeof user.department === 'string' || user.department === null) &&
    typeof user.active === 'boolean' &&
    USER_ROLES.includes(user.role as UserRole) &&
    USER_STATUSES.includes(user.status as UserStatus) &&
    AFFILIATION_TYPES.includes(user.affiliationType as AffiliationType)
  );
}

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
    throw new ApiError('로그인 응답에 Access Token이 없습니다.', 200, 'INVALID_LOGIN_RESPONSE');
  }

  return { accessToken } satisfies AccessTokenResponse;
}

export async function getCurrentUser() {
  const response = await apiRequest<AuthUser>(CURRENT_USER_PATH, {
    method: 'GET',
  });

  if (!isCurrentUser(response)) {
    throw new ApiError(
      '내 정보 응답 형식을 확인할 수 없습니다.',
      200,
      'INVALID_CURRENT_USER_RESPONSE',
    );
  }

  return response;
}

export async function logout() {
  await apiRequest<null>(LOGOUT_PATH, {
    method: 'POST',
    skipRefresh: true,
  });
}

export async function sendPasswordResetCode(studentNo: string, email: string) {
  await apiRequest<null>(PASSWORD_RESET_SEND_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentNo, email }),
    skipAuth: true,
  });
}

export async function confirmPasswordReset(studentNo: string, email: string, code: string) {
  await apiRequest<null>(PASSWORD_RESET_CONFIRM_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentNo, email, code }),
    skipAuth: true,
  });
}
