import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    // Redirect to appropriate login page based on route
    const path = window.location.pathname;
    if (path.startsWith("/student")) {
      return <Navigate to="/student/login" replace />;
    } else if (path.startsWith("/admin")) {
      return <Navigate to="/admin/login" replace />;
    } else if (path.startsWith("/supervisor")) {
      return <Navigate to="/school-supervisor/login" replace />;
    }
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    // User has wrong role, redirect to home
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
