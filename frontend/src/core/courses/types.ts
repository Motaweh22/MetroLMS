/**
 * Core Course Domain Types
 * Strict schema derived directly from the Cairo Metro LMS dataset.
 */

import type { LessonProgress } from '@/features/learning-player/types';

export type CourseLevel = 'مبتدئ' | 'متوسط' | 'متقدم' | 'beginner' | 'intermediate' | 'advanced';

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
  id?: string;
  title: string;
  url: string;
  description?: string;
  icon?: string;
  order?: number;
}

export interface ChapterItem {
  id: string;
  type: ContentItemType;
  title: string;
  url?: string;
  duration?: string | number; // e.g. "18:30" or 300 seconds
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
  isPreview?: boolean;
  contentUrl?: string;
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
  // Phase 2 / WP-2.3 / T-2.3.1: Curriculum Versioning & Substantive vs. Metadata Diffing (MFR-10, Rule B)
  contentVersion?: number;
  contentFingerprint?: string;
  videoUrl?: string;
  pdfUrl?: string;
  content?: string;
  durationSeconds?: number;
  description?: string;
  order?: number;
}

export interface PublishedCourseVersionItem {
  itemId: string;
  chapterId?: string;
  contentVersion: number;
  type: ContentItemType;
  durationSeconds?: number | null;
  contentFingerprint: string;
}

export interface PublishedCourseVersion {
  id?: string;
  courseId: string;
  versionNumber: number;
  publishedAt: string;
  publishedBy: string;
  title?: string;
  description?: string;
  chapters?: CourseChapter[];
  items: PublishedCourseVersionItem[];
  requiredItems?: PublishedCourseVersionItem[];
}

/**
 * Authoritative computed progress summary for an attempt (Phase 2 / WP-2.3 / T-2.3.2 — D-12, Rule B).
 */
export interface ComputedAttemptProgress {
  attemptId: string;
  userId: string;
  courseId: string;
  courseVersionNumber: number;
  completedRequiredItems: number;
  totalRequiredItems: number;
  completedItemIds: string[];
  progressPercent: number;
  isCompleted: boolean;
  isSealed: boolean;
}

/**
 * Version-scoped Certificate Record (Phase 2 / WP-2.3 / T-2.3.2 — D-13, MFR-46).
 */
export interface CertificateRecord {
  id: string;
  userId: string;
  courseId: string;
  attemptId: string;
  attemptNumber?: number | null;
  courseVersionNumber: number;
  courseVersion: number;
  certificateLabel: string;
  certificateLabelAr: string;
  courseTitleSnapshot: string;
  traineeNameSnapshot: string;
  verificationCode: string;
  issuedAt: string;
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

export type CourseAccessMode = 'all_trainees' | 'targeted' | 'hidden';
export type CourseQrMode = 'view_only' | 'auto_enroll';

export interface CourseQrSettings {
  token: string | null;
  isEnabled: boolean;
  qrMode: CourseQrMode;
  expiresAt: string | null;
  updatedAt?: string | null;
}

export interface CourseLinkedGroupSummary {
  id: string;
  name: string;
  status: string;
  memberCount: number;
}

export interface CourseEnrollmentMember {
  id: number;
  userId: number;
  userName?: string;
  userEmail?: string;
  courseId: number;
  enrolledAt: string;
  hasActiveAccess: boolean;
  sourceGrants: Array<{
    id: number;
    sourceType: 'direct' | 'group' | 'self:continued' | 'qr_code';
    trainingGroupId: number | null;
  }>;
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
  targetDepartmentIds?: number[];
  targetJobTitleIds?: number[];
  targetMetroLineIds?: number[];
  accessMode?: CourseAccessMode;
  qrSettings?: CourseQrSettings;
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
  updatedAt?: string;
  commentsEnabled?: boolean;
  enrolledUserIds?: string[];
  whatsappContacts?: Array<{
    name: string;
    number: string;
    role?: string;
  }>;
  courseZipPolicy?: CourseZipPolicy;
  publishedAt?: string;
  publishedBy?: string;
  versionNumber?: number;
  currentVersionNumber?: number;
  sections?: any;
  hasDraftChanges?: boolean;
  draftUpdatedAt?: string;
  draftVersion?: number;
  draftContentHash?: string;
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
 * Increment 10 / Phase 6 (D-06, D-07, MFR-41):
 * Multi-Source Enrollment Provenance & Attempt Isolation Types
 */
export type EnrollmentSourceKind =
  | 'self'                        // Source category: independent self-enrollment from catalog OR standalone continuation grant after group removal (D-07)
  | 'group';                      // Source category: provisioned via membership in a specific training group

export type EnrollmentGrantStatus = 'active' | 'revoked_by_group_removal' | 'expired';

export interface EnrollmentSourceGrant {
  sourceId: string;               // Stable unique grant ID per source instance (e.g., `self:catalog:${attemptId}`, `self:continued:${groupId}:${attemptId}`, or `group:${groupId}:${cycleId}`)
  kind: EnrollmentSourceKind;     // Category ('self' | 'group'); multiple active grants of kind: 'self' are allowed when bound to distinct attempts/contexts
  groupId?: string;               // Present when kind === 'group'
  cycleId?: string;               // Active cycle when granted
  attemptId: string;              // Active CourseAttempt ID bound to this specific grant (D-06, D-07)
  convertedFromGroupId?: string;  // Present when this standalone continuation grant was created upon keeping a course during group removal (D-07)
  grantedAt: string;
  grantedBy?: string;
  revokedAt?: string;
  status: EnrollmentGrantStatus;
}

/**
 * Course Enrollment Entity / Enrollment Record (D-06, D-07, MFR-41)
 * Represents an authoritative registration record of a trainee in a course,
 * maintaining multi-source provenance grants.
 */
export interface EnrollmentRecord {
  id: string;
  courseId: string;
  userId: string;
  enrolledAt: string; // ISO 8601 date string e.g. "2026-10-16T08:30:00.000Z"
  status: 'active' | 'inactive' | 'revoked_by_group_removal';
  sources: EnrollmentSourceGrant[];
}

export type CourseEnrollment = EnrollmentRecord;

/**
 * Per-Attempt Progress Domain Model (D-06, MFR-02, MFR-41)
 * Represents isolated lesson and course progress bound strictly to a single CourseAttempt instance.
 */
export interface AttemptProgress {
  attemptId: string;
  courseId: string;
  userId: string;
  progressPercent: number;
  completedItemIds: string[];
  lastWatchedItemId: string | null;
  isCompleted: boolean;
  updatedAt: string;
  itemsProgress: Record<string, LessonProgress>;
}

/**
 * Course Access Mode Semantics (D-06, D-07, MFR-23, MFR-42, §9.1, §12)
 * - 'full': allows learning, progress mutation, and certificate eligibility.
 * - 'review_only': allows viewing content and reading existing progress; mutations rejected with 403.
 * - 'none': course access expired or hidden; denied with 403.
 */
export type CourseAccessMode = 'full' | 'review_only' | 'none';

/**
 * Eligible Attempt Option DTO (D-06, MFR-41, §9.1)
 * Represents an unambiguous candidate attempt context presented to the learner
 * when entering a course with multiple eligible attempts.
 */
export interface EligibleAttemptOption {
  attemptId: string;
  sourceId: string;
  kind: EnrollmentSourceKind;
  groupId?: string | null;
  groupName?: string | null;
  cycleId?: string | null;
  cycleTitle?: string | null;
  convertedFromGroupId?: string | null;
  convertedFromGroupName?: string | null;
  contextLabel: string;
  accessMode: CourseAccessMode;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
  lastActivityAt?: string | null;
  status: string;
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
  targetDepartmentIds?: number[];
  targetJobTitleIds?: number[];
  targetMetroLineIds?: number[];
  accessMode?: CourseAccessMode;
  qrSettings?: CourseQrSettings;
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

