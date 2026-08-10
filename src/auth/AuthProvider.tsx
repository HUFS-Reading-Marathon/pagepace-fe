import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { login as requestLogin } from '../api/authApi';
import { AuthContext } from './AuthContext';
import {
  AUTH_CHANGE_EVENT,
  clearAuthStorage,
  emitAuthChange,
  getAccessToken,
  hasStoredAuthSession,
  saveAuthSession,
} from './authStorage';
import type { LoginRequest } from './authTypes';

function AuthProvider({ children }: PropsWithChildren) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const hasSession = hasStoredAuthSession();

    if (!hasSession) {
      clearAuthStorage();
    }

    return hasSession;
  });
  const [isLoading, setIsLoading] = useState(false);
  const loginPromiseRef = useRef<Promise<void> | null>(null);
  const isInitializing = false;

  const syncAuthentication = useCallback(() => {
    const hasSession = hasStoredAuthSession();

    if (!hasSession && getAccessToken()) {
      clearAuthStorage();
    }

    setIsAuthenticated(hasSession);
  }, []);

  useEffect(() => {
    window.addEventListener(AUTH_CHANGE_EVENT, syncAuthentication);
    window.addEventListener('storage', syncAuthentication);

    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, syncAuthentication);
      window.removeEventListener('storage', syncAuthentication);
    };
  }, [syncAuthentication]);

  const login = useCallback((credentials: LoginRequest) => {
    if (loginPromiseRef.current) {
      return loginPromiseRef.current;
    }

    setIsLoading(true);

    const loginPromise = (async () => {
      try {
        const { accessToken } = await requestLogin(credentials);

        if (!saveAuthSession(accessToken, credentials.studentNo)) {
          throw new Error('로그인 정보를 저장하지 못했습니다.');
        }

        setIsAuthenticated(true);
        emitAuthChange();
      } catch (error) {
        clearAuthStorage();
        setIsAuthenticated(false);
        emitAuthChange();
        throw error;
      } finally {
        loginPromiseRef.current = null;
        setIsLoading(false);
      }
    })();

    loginPromiseRef.current = loginPromise;

    return loginPromise;
  }, []);

  const logout = useCallback(() => {
    clearAuthStorage();
    setIsAuthenticated(false);
    emitAuthChange();
  }, []);

  const value = useMemo(
    () => ({
      user: null,
      isAuthenticated,
      isInitializing,
      isLoading,
      login,
      logout,
    }),
    [isAuthenticated, isInitializing, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
