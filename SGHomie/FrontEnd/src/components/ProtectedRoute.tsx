import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireProfileSetup?: boolean;
  signInMessage?: string;
  requiredRole?: 'seller' | 'admin';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireProfileSetup = true,
  signInMessage = 'Please sign in to access this feature',
  requiredRole,
}) => {
  const { user, needsProfileSetup, isSeller, isAdmin, loading } = useAuth();
  const hasRegisteredUser = !!user && user.is_anonymous !== true;
  const hasRequiredRole = !requiredRole || (requiredRole === 'seller' ? isSeller : isAdmin);

  useEffect(() => {
    if (loading) return;
    if (!hasRegisteredUser) toast.error(signInMessage, { id: `protected-route-auth:${signInMessage}` });
    else if (requireProfileSetup && needsProfileSetup) {
      toast.error('Please complete your profile setup first', { id: 'protected-route-profile-setup' });
    } else if (requiredRole && !hasRequiredRole && !(requiredRole === 'seller' && isAdmin)) {
      toast.error('You do not have access to this page', { id: `protected-route-role:${requiredRole}` });
    }
  }, [loading, hasRegisteredUser, needsProfileSetup, requireProfileSetup, requiredRole, hasRequiredRole, isAdmin, signInMessage]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!hasRegisteredUser) return <Navigate to="/" replace />;

  if (requireProfileSetup && needsProfileSetup) return <Navigate to="/" replace />;

  if (requiredRole && !hasRequiredRole) {
    return <Navigate to={requiredRole === 'seller' && isAdmin ? '/admin' : '/'} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
