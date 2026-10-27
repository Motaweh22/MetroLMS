/**
 * Courses Feature Module Entry Point
 * 
 * Exports UI components, custom hooks, services, and types
 * for the Course Catalog and Course Details pages.
 */

// Import styles for course components
import './styles/courses.css';

// Re-export core types
export type {
  Course,
  CourseChapter,
  ChapterItem,
  CourseLevel,
  CourseStatus,
  CourseFilterParams,
  CourseEnrollment,
  EnrollmentResponse,
  EnrollmentStatusResponse,
} from '@/core/courses/types';

// Export components
export { CourseCard } from './components/CourseCard';
export type { CourseCardProps } from './components/CourseCard';
export { CourseFilterBar } from './components/CourseFilterBar';
export type { CourseFilterBarProps } from './components/CourseFilterBar';
export { CourseGrid } from './components/CourseGrid';
export type { CourseGridProps } from './components/CourseGrid';
export { CourseHero } from './components/CourseHero';
export type { CourseHeroProps } from './components/CourseHero';
export { CourseCurriculum } from './components/CourseCurriculum';
export type { CourseCurriculumProps } from './components/CourseCurriculum';

// Export hooks & context
export { useCourses } from './hooks/useCourses';
export { useCourseDetail } from './hooks/useCourseDetail';
export { useEnrollCourse } from './hooks/useEnrollCourse';
export { useEnrollment } from './hooks/useEnrollment';
export { EnrollmentProvider } from './context/EnrollmentContext';

// Export API service
export { coursesApi } from './services/coursesApi';
