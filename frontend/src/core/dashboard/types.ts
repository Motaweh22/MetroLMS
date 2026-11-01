import type { TraineeAttentionResult } from '@/core/groups/types';

/**
 * Dashboard Domain Types
 *
 * Models role-specific operational dashboard views for Trainees, Lecturers, and Admins.
 */

export interface TraineeContinueLearningCard {
  courseId: string;
  courseTitle: string;
  lecturerName: string;
  thumbnail?: string;
  progressPercent: number;
  resumeItemId: string;
  resumeLessonTitle: string;
}

export interface TraineeUpcomingSession {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  url: string;
  description: string;
  dateText?: string;
}

export interface TraineeDashboardData {
  role: 'user';
  welcome: {
    name: string;
    dateAr: string;
    jobTitle: string;
    department: string;
  };
  continueLearning: TraineeContinueLearningCard | null;
  stats: {
    enrolledCount: number;
    completedCount: number;
    totalLearningHours: number;
    activeGroupsCount: number;
  };
  attention: {
    hasEvaluated: boolean;
    items: TraineeAttentionResult[];
    allClear: boolean;
    allClearMessage?: string;
  };
  upcomingSessions: TraineeUpcomingSession[];
}

export interface LecturerAssignedCourseSummary {
  id: string;
  title: string;
  level: string;
  duration: string;
  enrolledCount: number;
  rating: number;
  status: string;
}

export interface LecturerSupervisedGroupSummary {
  id: string;
  name: string;
  traineeCount: number;
  deadlineText: string;
  completionRate: number;
  status: string;
}

export interface LecturerDashboardData {
  role: 'lecturer';
  welcome: {
    name: string;
    roleTitle: string;
    department: string;
  };
  stats: {
    assignedCoursesCount: number;
    totalTraineesCount: number;
    averageRating: string;
    supervisedGroupsCount: number;
  };
  assignedCourses: LecturerAssignedCourseSummary[];
  supervisedGroups: LecturerSupervisedGroupSummary[];
}

export interface AdminTopCourseMetric {
  id: string;
  title: string;
  lecturerName: string;
  enrollmentCount: number;
  completionRate: number;
  rating: number;
}

export interface AdminGroupOverviewMetric {
  id: string;
  name: string;
  status: string;
  traineeCount: number;
  deadlineText: string;
  overallProgress: number;
}

export interface AdminDashboardData {
  role: 'admin' | 'assistant_admin' | 'super_admin' | 'developer';
  welcome: {
    name: string;
    roleTitle: string;
  };
  stats: {
    totalCoursesCount: number;
    totalEnrollmentsCount: number;
    activeGroupsCount: number;
    totalAttentionFlagsCount: number;
  };
  topCourses: AdminTopCourseMetric[];
  activeGroupsOverview: AdminGroupOverviewMetric[];
}

export type DashboardData =
  | TraineeDashboardData
  | LecturerDashboardData
  | AdminDashboardData;
