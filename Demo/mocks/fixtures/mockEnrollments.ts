import type { CourseEnrollment } from '@/core/courses/types';

/**
 * Synthetic Initial Enrollments Fixtures
 * 
 * Provides an initial pre-enrolled course for the trainee persona (CRS002)
 * so that both already-enrolled and unenrolled states can be tested immediately.
 */
export const INITIAL_MOCK_ENROLLMENTS: CourseEnrollment[] = [
  {
    id: 'ENR-001-SYNTHETIC',
    courseId: 'CRS002', // "خدمة العملاء في مترو الأنفاق"
    userId: 'usr_trainee_003',
    enrolledAt: '2026-10-10T08:30:00.000Z',
    status: 'active',
    sources: [
      {
        sourceId: 'self:catalog:ATT-usr_trainee_003-CRS002-standalone',
        kind: 'self',
        attemptId: 'ATT-usr_trainee_003-CRS002-standalone',
        grantedAt: '2026-10-10T08:30:00.000Z',
        status: 'active',
      },
    ],
  },
];
