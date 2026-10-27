import { createContext } from 'react';
import type { CourseEnrollment, EnrollmentResponse } from '@/core/courses/types';

export interface EnrollmentContextValue {
  enrollments: CourseEnrollment[];
  enrolledCourseIds: string[];
  isLoading: boolean;
  error: string | null;
  isEnrolledInCourse: (courseId: string) => boolean;
  getEnrollment: (courseId: string) => CourseEnrollment | null;
  enroll: (courseId: string) => Promise<EnrollmentResponse>;
  refetchEnrollments: () => Promise<void>;
}

export const EnrollmentContext = createContext<EnrollmentContextValue | null>(null);
