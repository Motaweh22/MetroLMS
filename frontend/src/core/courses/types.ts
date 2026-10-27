/**
 * Core Course Domain Types
 * Strict schema derived directly from the Cairo Metro LMS dataset.
 */

export type CourseLevel = 'مبتدئ' | 'متوسط' | 'متقدم';

export type CourseStatus =
  | 'published'
  | 'live'
  | 'draft'
  | 'pending_admin'
  | 'pending_owner'
  | 'hidden';

export type ContentItemType =
  | 'video'
  | 'pdf'
  | 'image'
  | 'powerpoint'
  | 'docx'
  | 'zip'
  | 'audio'
  | 'other';

export type ItemDownloadPolicy =
  | 'never'
  | 'immediate'
  | 'after_item_completion'
  | 'after_course_completion';

export type CourseZipPolicy =
  | 'disabled'
  | 'immediate'
  | 'after_course_completion';

export type VideoSourceType = 'upload' | 'youtube' | 'drive';

export interface ExternalResource {
  id: string;
  title: string;
  url: string;
  description?: string;
  icon?: string;
  order: number;
}

export interface ChapterItem {
  id: string;
  type: ContentItemType;
  title: string;
  url?: string;
  duration?: string; // e.g. "18:30"
  pages?: number;    // Legacy schema only; omitted from builder/player UI per Increment 8 specs
  views?: number;
  opensCount?: number;
  rewatchCount?: number;
  canDownload?: boolean;
  downloadPolicy?: ItemDownloadPolicy;
  originalFileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  uploadedAt?: string;
  requiresPrevious?: boolean;
  // Increment 8 Additions
  videoSourceType?: VideoSourceType;
  externalUrl?: string;
  youtubeVideoId?: string;
  driveFileId?: string;
  externalResources?: ExternalResource[];
  mediaId?: string;
  // Source-Aware Video Embed Policy (Google Drive Top Crop & Popup Blocking Sandbox)
  embedPolicy?: VideoEmbedPolicy;
  // Lesson Completion Policy (e.g. Google Drive Minimum Viewing-Time Requirement)
  completionPolicy?: LessonCompletionPolicy;
}

export interface LessonCompletionPolicy {
  requireMinimumViewingTime?: boolean;
}

export interface VideoEmbedPolicy {
  cropTopPixels?: number;
  blockPopups?: boolean;
}

export interface CourseChapter {
  id: string;
  title: string;
  order: number;
  items: ChapterItem[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  coverType?: 'image' | 'color' | 'default';
  coverColor?: string;
  lecturerId: string;
  lecturerName: string;
  coLecturers?: string[];
  assistants?: string[];
  targetJobTitles?: string[];
  level: CourseLevel;
  estimatedHours: number;
  rating: number;
  ratingCount: number;
  enrollmentCount: number;
  completionCount?: number;
  dropoutCount?: number;
  returnRate?: number;
  requiresApproval?: boolean;
  status: CourseStatus;
  prerequisiteCourseId?: string | null;
  prerequisiteCourseIds?: string[];
  knowledgePrerequisites?: string[];
  externalResources?: ExternalResource[];
  chapters: CourseChapter[];
  createdAt?: string;
  commentsEnabled?: boolean;
  enrolledUserIds?: string[];
  whatsappContacts?: Array<{
    name: string;
    number: string;
    role?: string;
  }>;
  courseZipPolicy?: CourseZipPolicy;
  hasDraftChanges?: boolean;
  draftUpdatedAt?: string;
  isTestLab?: boolean;
  // Refresher Course Version Configuration
  refresherConfig?: RefresherCourseConfig;
  // Increment 9 Course Review Additions
  submittedAt?: string;
  activeReviewFeedback?: CourseActiveReviewFeedback | null;
  auditLog?: CourseAuditLogEntry[];
  isUpdatePendingApproval?: boolean;
  lastEditedByAdminId?: string;
  lastEditedByAdminName?: string;
  adminEditedAt?: string;
}

export interface RefresherChapterConfig {
  chapterId: string;
  customTitle?: string;
}

export interface RefresherItemConfig {
  itemId: string;
  isVisible: boolean;
  customTitle?: string;
}

export interface RefresherCourseConfig {
  enabled: boolean;
  chapters?: Record<string, RefresherChapterConfig>;
  items?: Record<string, RefresherItemConfig>;
}

export interface CourseFilterParams {
  search?: string;
  level?: CourseLevel | 'all';
  sortBy?: 'rating' | 'enrollment' | 'newest';
}

/**
 * Course Enrollment Entity
 * Represents an authoritative registration record of a trainee in a course.
 */
export interface CourseEnrollment {
  id: string;
  courseId: string;
  userId: string;
  enrolledAt: string; // ISO 8601 date string e.g. "2026-10-16T08:30:00.000Z"
  status: 'active';
}

export interface EnrollmentResponse {
  enrollment: CourseEnrollment;
  course: Course;
  message: string;
}

export interface EnrollmentStatusResponse {
  isEnrolled: boolean;
  enrollment: CourseEnrollment | null;
}

export interface EnrolledCourseDetail extends Course {
  progress: {
    overallProgressPercentage: number;
    completedItemIds: string[];
    isCompleted: boolean;
    completedLessons: number;
    totalLessons: number;
  };
  isExpired: boolean;
  canCertify: boolean;
  policyLabel?: string;
  lastActivityDate?: string;
  lastWatchedItemId?: string;
}

/**
 * Increment 9: Course Review & Quality Audit Domain Types & Contracts
 */
export type ReviewOutcome = 'approved' | 'returned_with_admin_edits' | 'rejected';

export type CourseAuditAction =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'resubmitted'
  | 'returned_with_admin_edits';

export interface ReviewFeedbackItem {
  targetType: 'course' | 'chapter' | 'item';
  targetId: string; // Course ID, Chapter ID, or Lesson Item ID
  title?: string;
  comment: string;
  severity: 'required' | 'suggestion' | 'note';
}

export interface CourseActiveReviewFeedback {
  outcome: ReviewOutcome;
  reviewerId: string;
  reviewerName: string;
  reviewedAt: string; // ISO 8601
  summaryMessage: string;
  items: ReviewFeedbackItem[];
  stagedEditsApplied?: boolean;
}

export interface CourseBaselineSnapshot {
  id: string;
  title: string;
  description: string;
  level: CourseLevel;
  estimatedHours: number;
  coverType?: 'image' | 'color' | 'default';
  coverColor?: string;
  thumbnail?: string;
  targetJobTitles?: string[];
  prerequisiteCourseId?: string | null;
  courseZipPolicy?: CourseZipPolicy;
  externalResources?: ExternalResource[];
  chapters: CourseChapter[];
  capturedAt: string; // ISO 8601
  submittedAt?: string;
}

export interface CourseAuditLogEntry {
  id: string;
  courseId: string;
  action: CourseAuditAction;
  actorId: string;
  actorName: string;
  actorRole: 'admin' | 'lecturer';
  timestamp: string; // ISO 8601
  summary: string;
  approvalNote?: string;
  feedback?: CourseActiveReviewFeedback;
  baselineSnapshot?: CourseBaselineSnapshot;
  adminEditedSnapshot?: CourseBaselineSnapshot;
}

export interface ReviewerWorkingNotes {
  courseId: string;
  reviewerId: string;
  generalNote: string;
  chapterNotes: Record<string, string>; // chapterId -> note
  itemNotes: Record<string, string>;    // itemId -> note
  lastSavedAt: string;
}

export interface AdminStagedEditPayload {
  baselineId: string;
  baselineSubmittedAt: string;
  clientRevision: number;
  patch: Partial<Course>;
}

export interface StagedAdminEditsRecord {
  courseId: string;
  baselineId: string;
  baselineSubmittedAt: string;
  clientRevision: number; // Incrementing integer token
  patchedContent: Partial<Course>;
  lastSavedAt: string;
  savedByAdminId: string;
  isStale?: boolean;
}
export type StagedEditsRecord = StagedAdminEditsRecord;

/**
 * Increment 9 DTOs
 */
export interface SubmitCourseRequestDTO {
  courseId: string;
}

export interface SubmitCourseResponseDTO {
  course: Course;
  message: string;
  isPublishedUpdate: boolean;
  action: 'submitted' | 'resubmitted';
}

export interface ReviewQueueItemDTO {
  id: string;
  title: string;
  thumbnail?: string;
  coverType?: 'image' | 'color' | 'default';
  coverColor?: string;
  lecturerId: string;
  lecturerName: string;
  submittedAt?: string | null;
  submissionType: 'new' | 'update';
  status: CourseStatus;
  chapterCount: number;
  lessonCount: number;
  estimatedHours: number;
  hasStagedEdits?: boolean;
}

export interface ReviewQueueResponseDTO {
  items: ReviewQueueItemDTO[];
  totalCount: number;
}

export type StagedEditsSaveRequestDTO = AdminStagedEditPayload;

export interface StagedEditsSaveResponseDTO {
  record: StagedAdminEditsRecord;
  message: string;
}

export interface DiscardStagedEditsResponseDTO {
  success: boolean;
  message: string;
}

export interface ApproveCourseRequestDTO {
  publishOption?: 'submitted_baseline' | 'with_staged_edits';
  approvalNote?: string;
}

export interface ReturnCourseWithEditsRequestDTO {
  summaryMessage?: string;
  feedback?: string;
  items?: ReviewFeedbackItem[];
}

export interface RejectCourseRequestDTO {
  summaryMessage?: string;
  feedback?: string;
  items?: ReviewFeedbackItem[];
}

export interface ReviewDecisionRequestDTO {
  outcome: ReviewOutcome;
  summaryMessage?: string;
  items?: ReviewFeedbackItem[];
  approvalNote?: string;
  publishOption?: 'submitted_baseline' | 'with_staged_edits';
}

export interface ReviewDecisionResponseDTO {
  course: Course;
  message: string;
  outcome: ReviewOutcome;
  auditEntry: CourseAuditLogEntry;
}

export interface ConflictRebaseResultDTO {
  success: boolean;
  hasConflict: boolean;
  conflictingFields?: string[];
  mergedContent?: Partial<Course>;
  serverRecord?: StagedAdminEditsRecord;
}

export interface CourseReviewDataResponseDTO {
  course: Course;
  draft: Course | null;
  effectiveContent: Course;
  stagedEdits: StagedAdminEditsRecord | null;
  activeReviewFeedback: CourseActiveReviewFeedback | null;
  auditLog: CourseAuditLogEntry[];
  submissionType: 'new' | 'update';
  isPublishedUpdate: boolean;
}

export interface LecturerSubmissionItemDTO {
  id: string;
  title: string;
  thumbnail?: string;
  coverType?: 'image' | 'color' | 'default';
  coverColor?: string;
  status: CourseStatus;
  isUpdatePendingApproval?: boolean;
  hasDraft?: boolean;
  submittedAt?: string | null;
  draftUpdatedAt?: string | null;
  chapterCount: number;
  lessonCount: number;
  activeReviewFeedback?: CourseActiveReviewFeedback | null;
  reviewState: 'pending' | 'needs_revision' | 'approved' | 'draft';
}

export interface LecturerSubmissionsResponseDTO {
  items: LecturerSubmissionItemDTO[];
  totalCount: number;
  counts: {
    pending: number;
    needsRevision: number;
    approved: number;
    draft: number;
  };
}

