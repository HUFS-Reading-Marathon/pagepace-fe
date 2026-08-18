import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  getCurrentUser,
  login as requestLogin,
  logout as requestLogout,
} from '../api/authApi';
import { ApiError } from '../api/apiClient';
import { AuthContext } from './AuthContext';
import {
  ACCESS_TOKEN_STORAGE_KEY,
  AUTH_CHANGE_EVENT,
  clearAuthStorage,
  emitAuthChange,
  getAccessToken,
  saveAuthSession,
} from './authStorage';
import type { AuthUser, LoginRequest } from './authTypes';

type CurrentUserRequest = {
  token: string;
  promise: Promise<AuthUser>;
};

function AuthProvider({ children }: PropsWithChildren) {
  const [initialToken] = useState(getAccessToken);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(Boolean(initialToken));
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const loginPromiseRef = useRef<Promise<AuthUser> | null>(null);
  const currentUserRequestRef = useRef<CurrentUserRequest | null>(null);
  const authSequenceRef = useRef(0);

  const requestCurrentUser = useCallback((token: string) => {
    if (
      currentUserRequestRef.current === null ||
      currentUserRequestRef.current.token !== token
    ) {
      const request = {
        token,
        promise: getCurrentUser(),
      };

      currentUserRequestRef.current = request;
      request.promise.then(
        () => {
          if (currentUserRequestRef.current === request) {
            currentUserRequestRef.current = null;
          }
        },
        () => {
          if (currentUserRequestRef.current === request) {
            currentUserRequestRef.current = null;
          }
        },
      );
    }

    return currentUserRequestRef.current.promise;
  }, []);

  const applyAuthenticatedUser = useCallback(
    (nextUser: AuthUser, token: string) => {
      saveAuthSession(token, nextUser.studentNo);
      setUser(nextUser);
      setIsAuthenticated(true);
      setAuthError(null);
    },
    [],
  );

  const clearAuthentication = useCallback(() => {
    clearAuthStorage();
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
  }, []);

  useEffect(() => {
    if (!initialToken) {
      clearAuthStorage();
      return;
    }

    let isActive = true;
    const sequence = ++authSequenceRef.current;

    requestCurrentUser(initialToken)
      .then((nextUser) => {
        if (isActive && authSequenceRef.current === sequence) {
          applyAuthenticatedUser(nextUser, initialToken);
        }
      })
      .catch((error: unknown) => {
        if (!isActive || authSequenceRef.current !== sequence) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          clearAuthentication();
          emitAuthChange();
          return;
        }

        setUser(null);
        setIsAuthenticated(false);
        setAuthError(
          error instanceof ApiError
            ? error.message
            : '사용자 정보를 불러오지 못했습니다.',
        );
      })
      .finally(() => {
        if (isActive && authSequenceRef.current === sequence) {
          setIsInitializing(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    applyAuthenticatedUser,
    clearAuthentication,
    initialToken,
    requestCurrentUser,
  ]);

  useEffect(() => {
    const syncFromStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== ACCESS_TOKEN_STORAGE_KEY) {
        return;
      }

      const token = getAccessToken();
      const sequence = ++authSequenceRef.current;

      if (!token) {
        setUser(null);
        setIsAuthenticated(false);
        setIsInitializing(false);
        setAuthError(null);
        return;
      }

      setUser(null);
      setIsAuthenticated(false);
      setIsInitializing(true);
      setAuthError(null);

      requestCurrentUser(token)
        .then((nextUser) => {
          if (authSequenceRef.current === sequence) {
            applyAuthenticatedUser(nextUser, token);
          }
        })
        .catch((error: unknown) => {
          if (authSequenceRef.current !== sequence) {
            return;
          }

          if (error instanceof ApiError && error.status === 401) {
            clearAuthentication();
            return;
          }

          setAuthError(
            error instanceof ApiError
              ? error.message
              : '사용자 정보를 불러오지 못했습니다.',
          );
        })
        .finally(() => {
          if (authSequenceRef.current === sequence) {
            setIsInitializing(false);
          }
        });
    };

    window.addEventListener('storage', syncFromStorage);

    return () => {
      window.removeEventListener('storage', syncFromStorage);
    };
  }, [applyAuthenticatedUser, clearAuthentication, requestCurrentUser]);

  useEffect(() => {
    const syncAuthChange = () => {
      if (!getAccessToken()) {
        authSequenceRef.current += 1;
        setUser(null);
        setIsAuthenticated(false);
        setIsInitializing(false);
      }
    };

    window.addEventListener(AUTH_CHANGE_EVENT, syncAuthChange);
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, syncAuthChange);
  }, []);

  const login = useCallback(
    (credentials: LoginRequest) => {
      if (loginPromiseRef.current) {
        return loginPromiseRef.current;
      }

      const sequence = ++authSequenceRef.current;

      setIsLoading(true);
      setAuthError(null);

      const loginPromise = (async () => {
        let sessionSaved = false;

        try {
          const { accessToken } = await requestLogin(credentials);

          if (authSequenceRef.current !== sequence) {
            throw new ApiError(
              '로그인 요청이 취소되었습니다.',
              0,
              'AUTH_REQUEST_CANCELLED',
            );
          }

          if (!saveAuthSession(accessToken, credentials.studentNo)) {
            throw new ApiError(
              '로그인 정보를 저장하지 못했습니다.',
              0,
              'AUTH_STORAGE_ERROR',
            );
          }

          sessionSaved = true;
          const nextUser = await requestCurrentUser(accessToken);

          if (authSequenceRef.current !== sequence) {
            throw new ApiError(
              '로그인 요청이 취소되었습니다.',
              0,
              'AUTH_REQUEST_CANCELLED',
            );
          }

          applyAuthenticatedUser(nextUser, accessToken);
          emitAuthChange();
          return nextUser;
        } catch (error) {
          if (authSequenceRef.current === sequence) {
            const shouldClearSession =
              !sessionSaved ||
              (error instanceof ApiError && error.status === 401);

            if (shouldClearSession) {
              clearAuthentication();
              emitAuthChange();
            } else {
              setUser(null);
              setIsAuthenticated(false);
              setAuthError(
                error instanceof ApiError
                  ? error.message
                  : '사용자 정보를 불러오지 못했습니다.',
              );
            }
          }

          throw error;
        } finally {
          loginPromiseRef.current = null;
          setIsLoading(false);
        }
      })();

      loginPromiseRef.current = loginPromise;

      return loginPromise;
    }, [applyAuthenticatedUser, clearAuthentication, requestCurrentUser],
  );

  const logout = useCallback(() => {
    authSequenceRef.current += 1;
    currentUserRequestRef.current = null;
    void requestLogout().catch(() => undefined);
    clearAuthentication();
    setIsInitializing(false);
    emitAuthChange();
  }, [clearAuthentication]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      isInitializing,
      isLoading,
      authError,
      login,
      logout,
    }),
    [
      authError,
      isAuthenticated,
      isInitializing,
      isLoading,
      login,
      logout,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
