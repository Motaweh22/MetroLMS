import React, { useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { WhatsAppFloatingFab } from '@/features/whatsapp';
import '@/features/auth/styles/login.css';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // If already authenticated, redirect away from login to dashboard or previous route
  const targetPath = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(targetPath, { replace: true });
    }
  }, [isAuthenticated, navigate, targetPath]);

  return (
    <div className="login-page">
      {/* Discreet Developer Navigation to Design System Preview */}
      <Link to="/design-system" className="login-dev-link" tabIndex={-1}>
        <span>معمل التصميم</span>
      </Link>

      <div className="login-container">
        <LoginForm onSuccess={() => navigate(targetPath, { replace: true })} />
      </div>

      {/* Unauthenticated Login Support via WhatsApp Floating Widget */}
      <WhatsAppFloatingFab config={{ context: 'login' }} />
    </div>
  );
};

export default LoginPage;
