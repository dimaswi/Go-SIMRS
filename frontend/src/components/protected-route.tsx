import { Navigate, useLocation } from 'react-router-dom';
import { usePermission } from '@/hooks/usePermission';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission: string;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

interface AnyPermissionRouteProps {
  children: React.ReactNode;
  permissions: string[];
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({ children, permission, fallback, redirectTo }: ProtectedRouteProps) {
  const { hasPermission } = usePermission();
  const location = useLocation();

  if (!hasPermission(permission)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    // Redirect to parent path or dashboard instead of root
    const parentPath = redirectTo || location.pathname.split('/').slice(0, -1).join('/') || '/dashboard';
    return <Navigate to={parentPath} replace />;
  }

  return <>{children}</>;
}

export function AnyPermissionRoute({ children, permissions, fallback, redirectTo }: AnyPermissionRouteProps) {
  const { hasAnyPermission } = usePermission();
  const location = useLocation();

  if (!hasAnyPermission(permissions)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    const parentPath = redirectTo || location.pathname.split('/').slice(0, -1).join('/') || '/dashboard';
    return <Navigate to={parentPath} replace />;
  }

  return <>{children}</>;
}
