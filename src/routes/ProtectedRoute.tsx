import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isAdminRole, useAuth } from '../auth';

type ProtectedRouteProps = PropsWithChildren<{
  adminOnly?: boolean;
}>;

function ProtectedRoute({ adminOnly = false, children }: ProtectedRouteProps) {
  const { user, isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return <main className="page-container">사용자 정보를 확인하고 있습니다.</main>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (adminOnly && !isAdminRole(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
