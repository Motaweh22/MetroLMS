import React, { useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { brandConfig } from '@/shared/config/brand';
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
        <div className="login-card">
          {/* Logos: Training Administration and Cairo Metro side-by-side */}
          <div className="login-logos">
            <img
              src={brandConfig.logos.training}
              alt="إدارة التدريب"
              id="training-logo"
            />
            <img
              src={brandConfig.logos.primary}
              alt="مترو القاهرة"
              id="metro-logo"
            />
          </div>

          {/* Title and Subtitle matching exact legacy typography hierarchy */}
          <h1 className="login-title">منصة التدريب الإلكتروني</h1>
          <p className="login-subtitle">الشركة المصرية لإدارة وتشغيل مترو القاهرة</p>
          <h2 className="sr-only">تسجيل الدخول للمنظومة</h2>

          {/* Form component with authentication logic and demo accounts */}
          <LoginForm onSuccess={() => navigate(targetPath, { replace: true })} />
        </div>
      </div>

      {/* Unauthenticated Login Support via WhatsApp Floating Widget */}
      <WhatsAppFloatingFab config={{ context: 'login' }} />
    </div>
  );
};

export default LoginPage;
