import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import App from '@/App';

describe('Project Foundation & Setup Verification', () => {
  it('renders the application foundation without throwing errors', () => {
    render(React.createElement(App));
    expect(screen.getAllByText(/مترو القاهرة/i).length).toBeGreaterThan(0);
    // Unauthenticated initial visit redirects to login screen
    expect(screen.getByText(/تسجيل الدخول للمنظومة/i)).toBeInTheDocument();
  });

  it('validates TypeScript path alias @/ resolves properly', () => {
    expect(App).toBeDefined();
    expect(typeof App).toBe('function');
  });
});
