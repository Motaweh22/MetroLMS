import { setupServer } from 'msw/node';
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

/**
 * MSW Node Server for Vitest and Node environments
 */
export const server = setupServer(
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

