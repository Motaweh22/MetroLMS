import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

async function prepareApp() {
  if (import.meta.env.DEV) {
    try {
      // Seed development-only mock CSRF cookie on window/main thread before initial requests
      if (typeof document !== 'undefined' && !/(?:^|;\s*)csrftoken=([^;]+)/.test(document.cookie)) {
        document.cookie = 'csrftoken=mock-dev-csrftoken; path=/; SameSite=Lax';
      }

      const { worker } = await import('@/mocks/browser');
      await worker.start({
        onUnhandledRequest: 'bypass',
        serviceWorker: {
          url: '/mockServiceWorker.js',
        },
      });
    } catch (err) {
      console.warn('MSW worker failed to start in development environment:', err);
    }
  }
}

prepareApp().finally(() => {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
});
