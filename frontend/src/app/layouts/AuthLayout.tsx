import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * Dedicated Layout for Authentication Screens
 * Provides an unencumbered fullscreen canvas for the login interface
 * without the application shell, navigation bars, or sidebars.
 */
export const AuthLayout: React.FC = () => {
  return <Outlet />;
};

export default AuthLayout;
