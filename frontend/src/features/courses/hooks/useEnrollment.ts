import { useContext } from 'react';
import { EnrollmentContext, type EnrollmentContextValue } from '../context/context';
import { coursesApi } from '../services/coursesApi';

/**
 * Access the centralized enrollment context.
 * Gracefully provides safe fallback functions if used outside of EnrollmentProvider.
 */
export function useEnrollment(): EnrollmentContextValue {
  const context = useContext(EnrollmentContext);
  if (!context) {
    return {
      enrollments: [],
      enrolledCourseIds: [],
      isLoading: false,
      error: null,
      isEnrolledInCourse: () => false,
      getEnrollment: () => null,
      enroll: async (courseId: string) => coursesApi.enrollCourse(courseId),
      refetchEnrollments: async () => {},
    };
  }
  return context;
}

export default useEnrollment;
