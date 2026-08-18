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

export type AuthUser = {
  userId: number;
  studentNo: string;
  name: string;
  email: string;
  phone: string;
  affiliationType: AffiliationType;
  department: string;
  role: UserRole;
  status: UserStatus;
  active: boolean;
};

export type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  isLoading: boolean;
  authError: string | null;
};

export type AuthContextValue = AuthState & {
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
};

export function isAdminRole(role?: UserRole) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}
