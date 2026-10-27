import { setupWorker } from 'msw/browser';
import { authHandlers } from './handlers/authHandlers';
import { courseHandlers } from './handlers/courseHandlers';
import { enrollmentHandlers } from './handlers/enrollmentHandlers';
import { learningHandlers } from './handlers/learningHandlers';
import { groupHandlers } from './handlers/groupHandlers';
import { notificationHandlers } from './handlers/notificationHandlers';
import { dashboardHandlers } from './handlers/dashboardHandlers';
import { builderHandlers } from './handlers/builderHandlers';
import { reviewHandlers } from './handlers/reviewHandlers';
import { userManagementHandlers } from './handlers/userManagementHandlers';
import { permissionsHandlers } from './handlers/permissionsHandlers';
import { commentsHandlers } from './handlers/commentsHandlers';
import { performanceHandlers } from './handlers/performanceHandlers';

import { inMemoryStore } from './store/inMemoryStore';

/**
 * MSW Browser Worker Initialization
 * Intercepts outgoing fetch requests at the service worker level in the browser.
 */
export const worker = setupWorker(
  ...authHandlers,
  ...courseHandlers,
  ...enrollmentHandlers,
  ...learningHandlers,
  ...groupHandlers,
  ...notificationHandlers,
  ...dashboardHandlers,
  ...builderHandlers,
  ...reviewHandlers,
  ...userManagementHandlers,
  ...permissionsHandlers,
  ...commentsHandlers,
  ...performanceHandlers
);

// Dev helpers for inspecting or resetting mock store during verification
// Hard-gated strictly to development environment (dead-code-eliminated in production builds)
if (import.meta.env.DEV && typeof window !== 'undefined' && import.meta.env.MODE !== 'production') {
  // Pre-seed Increment 10 rich demo cohorts for manual UI audit in development
  inMemoryStore.seedIncrement10DemoFixtures();

  Object.defineProperty(window, '__inMemoryStore', {
    value: inMemoryStore,
    configurable: true,
    writable: false,
  });
  Object.defineProperty(window, '__resetMockStore', {
    value: () => {
      inMemoryStore.reset();
      inMemoryStore.seedIncrement10DemoFixtures();
    },
    configurable: true,
    writable: false,
  });
}

