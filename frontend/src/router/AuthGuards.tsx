import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/auth/useAuth";

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base-100">
      <span className="loading loading-spinner loading-lg" />
    </div>
  );
}

// Pages only for connected users (profile, game...): otherwise go to /auth
export function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? <Outlet /> : <Navigate to="/auth" replace />;
}

// Pages only for visitors (auth): a connected user goes to /home
export function RedirectIfAuth() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? <Navigate to="/home" replace /> : <Outlet />;
}
