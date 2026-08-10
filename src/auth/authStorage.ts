export const AUTH_CHANGE_EVENT = 'auth-change';

const ACCESS_TOKEN_STORAGE_KEY = 'pagepaceAccessToken';
const LOGIN_STATE_STORAGE_KEY = 'isLoggedIn';
const LOGIN_ID_STORAGE_KEY = 'loginId';
const LEGACY_USER_NAME_STORAGE_KEY = 'userName';

export function getAccessToken() {
  const token = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)?.trim();

  return token || null;
}

export function hasStoredAuthSession() {
  return (
    Boolean(getAccessToken()) &&
    localStorage.getItem(LOGIN_STATE_STORAGE_KEY) === 'true'
  );
}

export function saveAuthSession(accessToken: string, loginId: string) {
  const normalizedToken = accessToken.trim();
  const normalizedLoginId = loginId.trim();

  if (!normalizedToken) {
    return false;
  }

  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, normalizedToken);
  localStorage.setItem(LOGIN_STATE_STORAGE_KEY, 'true');

  if (normalizedLoginId) {
    localStorage.setItem(LOGIN_ID_STORAGE_KEY, normalizedLoginId);
  } else {
    localStorage.removeItem(LOGIN_ID_STORAGE_KEY);
  }

  return true;
}

export function clearAuthStorage() {
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(LOGIN_STATE_STORAGE_KEY);
  localStorage.removeItem(LOGIN_ID_STORAGE_KEY);
  localStorage.removeItem(LEGACY_USER_NAME_STORAGE_KEY);
}

export function emitAuthChange() {
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}
