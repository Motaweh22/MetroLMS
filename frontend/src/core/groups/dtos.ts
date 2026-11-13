import type {
  GroupAdminStatus,
  GroupEnrollmentPolicy,
  GroupStatus,
  GroupType,
  PostDeadlinePolicy,
  CourseRole,
  GroupRenewalSchedule,
  TrainingGroup,
  GroupResource,
  GroupInstructorDTO,
} from './types';

export interface CreateGroupRequestDTO {
  name: string;
  description: string;
  startDateTime: string;
  deadlineDateTime: string;
  postDeadlinePolicy: PostDeadlinePolicy;
  adminStatus?: GroupAdminStatus; // default: 'active'
  enrollmentPolicy?: GroupEnrollmentPolicy; // default: 'open'
  courseAssignments?: {
    courseId: string;
    courseRole?: CourseRole; // default: 'core'
    order?: number;
    customStartDateTime?: string | null;
    customDeadlineDateTime?: string | null;
    customPostDeadlinePolicy?: PostDeadlinePolicy | null;
  }[];
  primaryInstructorId?: string | null;
  assistantLecturerIds?: string[];
  supervisorIds?: string[];
  initialTraineeIds?: string[];
  maxTrainees?: number | null;
  isEnrollmentOpen?: boolean; // default: true
  enrollmentExpiresAt?: string | null;
  renewalSchedule?: GroupRenewalSchedule;
  resources?: GroupResource[];
}

export interface UpdateGroupRequestDTO {
  name?: string;
  description?: string;
  adminStatus?: GroupAdminStatus;
  enrollmentPolicy?: GroupEnrollmentPolicy;
  startDateTime?: string;
  deadlineDateTime?: string;
  postDeadlinePolicy?: PostDeadlinePolicy;
  primaryInstructorId?: string | null;
  assistantLecturerIds?: string[];
  supervisorIds?: string[];
  isEnrollmentOpen?: boolean;
  enrollmentExpiresAt?: string | null;
  maxTrainees?: number | null;
  renewalSchedule?: GroupRenewalSchedule;
  resources?: GroupResource[];
}

export interface AssignCoursesRequestDTO {
  courses: {
    courseId: string;
    courseRole?: CourseRole; // default: 'core' (D-GRP-03)
    order?: number;
    customStartDateTime?: string | null;
    customDeadlineDateTime?: string | null;
    customPostDeadlinePolicy?: PostDeadlinePolicy | null;
  }[];
}

export interface AssignCycleCoursesDTO {
  postDeadlinePolicy?: PostDeadlinePolicy;
  courses: {
    courseId: string;
    courseRole: CourseRole;
    order?: number;
    customStartDateTime?: string | null;
    customDeadlineDateTime?: string | null;
    customPostDeadlinePolicy?: PostDeadlinePolicy | null;
  }[];
}

export interface RenewGroupCycleRequestDTO {
  title: string;
  startDateTime: string;
  deadlineDateTime: string;
  postDeadlinePolicy?: PostDeadlinePolicy;
  courses: {
    courseId: string;
    courseRole: CourseRole;
    order?: number;
    customStartDateTime?: string | null;
    customDeadlineDateTime?: string | null;
    customPostDeadlinePolicy?: PostDeadlinePolicy | null;
  }[];
  renewalNote?: string;
}

export interface AddGroupMembersRequestDTO {
  traineeIds: string[];
}

export interface JoinGroupQRRequestDTO {
  enrollmentCode: string;
  note?: string;
}

export interface JoinGroupQRResponseDTO {
  group: TrainingGroup;
  enrolledCoursesCount: number;
  alreadyEnrolledCoursesCount: number;
  message: string;
  isPendingApproval?: boolean;
}

export interface RotateGroupQRCodeResponseDTO {
  groupId: string;
  newEnrollmentCode: string;
  qrUrl: string;
  message: string;
}

export interface GroupSummaryDTO {
  id: string;
  name: string;
  description: string;
  adminStatus: GroupAdminStatus;
  timeStatus: GroupStatus; // 'active' | 'scheduled' | 'expired'
  timeStatusLabelAr: string;
  enrollmentPolicy: GroupEnrollmentPolicy;
  startDateTime: string;
  deadlineDateTime: string;
  timeRemainingText: string;
  totalCoursesCount: number;
  totalTraineesCount: number;
  averageProgressPercent: number;
  completedTraineesCount: number;
  attentionTraineesCount: number;
  isEnrollmentOpen: boolean;
  currentCycleNumber?: number;
  currentCycleTitle?: string;
  pendingJoinRequestsCount?: number;
  primaryInstructorId?: string | null;
  assistantLecturerIds?: string[];
  instructors?: GroupInstructorDTO[];
  createdAt: string;
}

export interface SubmitJoinRequestDTO {
  enrollmentCode: string;
  note?: string;
}

export interface ReviewJoinRequestDTO {
  requestId: string;
  decision: 'approved' | 'rejected';
  reviewNote?: string;
}

export interface CreateMaterialFolderDTO {
  name: string;
  isVisibleToTrainees?: boolean;
  cycleId?: string | null;
  parentId?: string | null;
}

export interface UploadMaterialFileDTO {
  folderId: string;
  title: string;
  file: File;
  isVisible?: boolean;
  cycleId?: string | null;
}

export interface AddMaterialFileRequestDTO {
  folderId: string;
  title: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  isVisible?: boolean;
  cycleId?: string | null;
}

export interface ReplaceMaterialFileRequestDTO {
  fileName: string;
  sizeBytes: number;
  mimeType: string;
}

export interface UpdateMaterialFolderDTO {
  name?: string;
  isVisibleToTrainees?: boolean;
  order?: number;
  parentId?: string | null;
}

export interface ToggleGroupEnrollmentDTO {
  isOpen: boolean;
}

export interface GroupPreviewInfoDTO {
  id: string;
  name: string;
  description: string;
  enrollmentPolicy: GroupEnrollmentPolicy;
  isEnrollmentOpen: boolean;
  totalCoursesCount: number;
  currentTraineesCount: number;
  maxTrainees: number | null;
}

export interface CandidateTraineeDTO {
  id: string;
  name: string;
  email: string;
  department?: string;
  jobTitle?: string;
}

export interface CandidateLecturerDTO {
  id: string;
  name: string;
  username: string;
  email: string;
  jobTitle: string;
  department: string;
  phone?: string;
  status: 'active' | 'pending' | 'suspended';
}

export interface UpdateGroupAssistantsRequestDTO {
  assistantLecturerIds: string[];
}

// ── Trainee Normalized Groups API DTOs (D-GRP-01..08) ────────────────

export interface GroupTimeInfo {
  situation:
    | 'active_regular'
    | 'scheduled_regular'
    | 'active_reminder'
    | 'scheduled_reminder'
    | 'expired_reminder_with_next'
    | 'expired_reminder_without_next'
    | 'expired_regular';
  primaryTargetDate: string | null;     // ISO string (null if unavailable)
  secondaryDate: string | null;          // ISO string (null if unavailable)
  daysRemaining: number | null;
  hoursRemaining: number | null;
  daysPassed: number | null;
  isOverdue: boolean;
}

export interface TraineeCourseSummaryDTO {
  courseId: string;
  courseTitle: string;
  courseCode?: string;          // Compact code (e.g. "CRS001") for concise carousel pills (D-GRP-08)
  courseRole: CourseRole;       // 'core' | 'reminder' (D-GRP-03, D-GRP-05, D-GRP-08)
  order: number;
}

export interface TraineeGroupCurrentCycleDTO {
  id: string;
  cycleNumber: number;
  title: string;
  status: 'active' | 'completed' | 'archived';
  startDateTime: string | null;
  deadlineDateTime: string | null;
  postDeadlinePolicy: PostDeadlinePolicy;
}

export interface TraineeGroupItemDTO {
  id: string;
  enrollmentCode?: string;
  name: string;
  description: string;
  groupType: GroupType;             // 'regular' | 'reminder' (D-GRP-03, D-GRP-06)
  operationalStatus: GroupStatus;   // 'active' | 'scheduled' | 'expired'
  traineeCount: number;             // Authoritative enrolled trainee count (group.traineeIds.length)
  startDateTime: string | null;
  deadlineDateTime: string | null;
  postDeadlinePolicy: PostDeadlinePolicy;
  renewalSchedule?: {
    autoRenewalEnabled: boolean;
    intervalDays: number | null;
    nextScheduledRenewalDate: string | null;
  };
  currentCycle: TraineeGroupCurrentCycleDTO | null;
  courses: TraineeCourseSummaryDTO[];
  timeInfo: GroupTimeInfo;
  navigationUrl: string;            // e.g. "/my-groups/GRP-101"
}

export type GetMyGroupsResponseDTO = TraineeGroupItemDTO[];


