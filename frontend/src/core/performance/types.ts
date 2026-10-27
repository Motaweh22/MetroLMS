/**
 * Lecturer Course Performance & Trainee Nudges Domain Types
 * (Increment 11 Phase 5D)
 */

export type TraineePerformanceStatus = 'completed' | 'active' | 'late' | 'not_started';

export interface TraineePerformanceDTO {
  userId: string;
  name: string;
  jobTitle: string;
  department: string;
  phone?: string | null;
  progressPercent: number; // 0..100
  lastActivityAt?: string | null;
  daysSinceLastActivity?: number | null;
  status: TraineePerformanceStatus;
  statusLabelAr: string;
  whatsappUrl?: string | null;
}

export interface CoursePerformanceReportDTO {
  courseId: string;
  courseTitle: string;
  lecturerId: string;
  lecturerName: string;
  totalEnrolled: number;
  completedCount: number;
  activeCount: number;
  lateCount: number;
  notStartedCount: number;
  averageProgressPercent: number;
  trainees: TraineePerformanceDTO[];
}
