export type LoginRequest = {
  studentNo: string;
  password: string;
};

export type AccessTokenResponse = {
  accessToken: string;
};

export type ApiResponse<T> = {
  success: boolean;
  code: string;
  message: string;
  data: T | null;
};

export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BANNED' | 'DELETED';

export type AffiliationType =
  | 'UNDERGRADUATE'
  | 'GRADUATE'
  | 'PROFESSOR'
  | 'STAFF'
  | 'OTHER';

// 로그인 응답에는 사용자 정보가 없으므로 로그인만으로 이 타입을 채우지 않습니다.
export type AuthUser = {
  userId?: number;
  studentNo?: string;
  name?: string;
  email?: string;
  phone?: string;
  affiliationType?: AffiliationType;
  department?: string;
  role?: UserRole;
  status?: UserStatus;
  active?: boolean;
};

export type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  isLoading: boolean;
};

export type AuthContextValue = AuthState & {
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
};

export function isAdminRole(role?: UserRole) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}
