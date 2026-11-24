"""Courses, curriculum, review & discussion models (15 active entities)."""
from __future__ import annotations

from django.db import models
from django.db.models import F, Q

from shared.validators import validate_https_url, validate_non_empty_text

COURSE_TYPE_CHOICES = [
    ("main", "Main"),
    ("reminder", "Reminder"),
]

COURSE_LIFECYCLE_CHOICES = [
    ("Draft", "Draft"),
    ("InReview", "InReview"),
    ("Published", "Published"),
    ("Archived", "Archived"),
]

COURSE_ACCESS_MODE_CHOICES = [
    ("all_trainees", "All Trainees"),
    ("targeted", "Targeted Audience"),
    ("hidden", "Hidden (Groups & Direct Only)"),
]

COURSE_QR_MODE_CHOICES = [
    ("view_only", "View Course Only"),
    ("auto_enroll", "Auto Enroll on Scan"),
]

REVIEW_STATUS_CHOICES = [
    ("Pending", "Pending"),
    ("Approved", "Approved"),
    ("ReturnedForRevision", "ReturnedForRevision"),
]

COMMENT_REPORT_STATUS_CHOICES = [
    ("Pending", "Pending"),
    ("Resolved", "Resolved"),
    ("Dismissed", "Dismissed"),
]


class Course(models.Model):
    """Main or Reminder course entity (`1..1` Primary Lecturer)."""

    id = models.BigAutoField(primary_key=True)
    title = models.CharField(max_length=255, validators=[validate_non_empty_text])
    description = models.TextField(null=True, blank=True)
    course_type = models.CharField(max_length=20, choices=COURSE_TYPE_CHOICES)
    main_course = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="main_course_id",
        related_name="reminder_courses",
    )
    primary_lecturer = models.ForeignKey(
        "identity.User",
        on_delete=models.DO_NOTHING,
        db_column="primary_lecturer_id",
        related_name="primary_courses",
    )
    lifecycle_status = models.CharField(
        max_length=20,
        choices=COURSE_LIFECYCLE_CHOICES,
        default="Draft",
        db_default="Draft",
    )
    access_mode = models.CharField(
        max_length=20,
        choices=COURSE_ACCESS_MODE_CHOICES,
        default="targeted",
        db_default="targeted",
    )
    created_by_user = models.ForeignKey(
        "identity.User",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="created_by_user_id",
        related_name="created_courses",
    )
    created_by_tombstone = models.ForeignKey(
        "identity.DeletedUserTombstone",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="created_by_tombstone_id",
        related_name="created_courses",
    )
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        db_table = "courses_course"
        constraints = [
            models.CheckConstraint(
                condition=Q(course_type__in=["main", "reminder"]),
                name="ck_course_type_valid",
            ),
            models.CheckConstraint(
                condition=Q(lifecycle_status__in=["Draft", "InReview", "Published", "Archived"]),
                name="ck_course_lifecycle_valid",
            ),
            models.CheckConstraint(
                condition=Q(access_mode__in=["all_trainees", "targeted", "hidden"]),
                name="ck_course_access_mode_valid",
            ),
            models.CheckConstraint(
                condition=(
                    (Q(course_type="main") & Q(main_course__isnull=True))
                    | (Q(course_type="reminder") & Q(main_course__isnull=False) & ~Q(main_course=F("id")))
                ),
                name="ck_course_reminder_parent",
            ),
            models.CheckConstraint(
                condition=(
                    (Q(created_by_user__isnull=False) & Q(created_by_tombstone__isnull=True))
                    | (Q(created_by_user__isnull=True) & Q(created_by_tombstone__isnull=False))
                ),
                name="ck_course_creator_xor",
            ),
        ]

    def __str__(self) -> str:
        return self.title


class CourseAssistantLecturer(models.Model):
    """M:N teaching assignment between Course and Assistant Lecturer User."""

    id = models.BigAutoField(primary_key=True)
    course = models.ForeignKey(
        Course,
        on_delete=models.DO_NOTHING,
        db_column="course_id",
        related_name="assistant_lecturers",
    )
    user = models.ForeignKey(
        "identity.User",
        on_delete=models.DO_NOTHING,
        db_column="user_id",
        related_name="assistant_course_assignments",
    )

    class Meta:
        db_table = "courses_courseassistantlecturer"
        constraints = [
            models.UniqueConstraint(fields=["course", "user"], name="uq_course_assistant_user"),
        ]


class CourseAudienceDepartment(models.Model):
    """M:N Course audience targeting by OrganizationalDepartment."""

    id = models.BigAutoField(primary_key=True)
    course = models.ForeignKey(
        Course,
        on_delete=models.DO_NOTHING,
        db_column="course_id",
        related_name="audience_departments",
    )
    department = models.ForeignKey(
        "organization.OrganizationalDepartment",
        on_delete=models.DO_NOTHING,
        db_column="department_id",
        related_name="audience_courses",
    )

    class Meta:
        db_table = "courses_courseaudiencedepartment"
        constraints = [
            models.UniqueConstraint(fields=["course", "department"], name="uq_course_aud_dept"),
        ]


class CourseAudienceJobTitle(models.Model):
    """M:N Course audience targeting by JobTitle."""

    id = models.BigAutoField(primary_key=True)
    course = models.ForeignKey(
        Course,
        on_delete=models.DO_NOTHING,
        db_column="course_id",
        related_name="audience_job_titles",
    )
    job_title = models.ForeignKey(
        "organization.JobTitle",
        on_delete=models.DO_NOTHING,
        db_column="job_title_id",
        related_name="audience_courses",
    )

    class Meta:
        db_table = "courses_courseaudiencejobtitle"
        constraints = [
            models.UniqueConstraint(fields=["course", "job_title"], name="uq_course_aud_jobtitle"),
        ]


class CourseAudienceLeadership(models.Model):
    """M:N Course audience targeting by Leadership / Supervisory Title."""

    id = models.BigAutoField(primary_key=True)
    course = models.ForeignKey(
        Course,
        on_delete=models.DO_NOTHING,
        db_column="course_id",
        related_name="audience_leadership_titles",
    )
    leadership_title = models.CharField(max_length=100)

    class Meta:
        db_table = "courses_courseaudienceleadership"
        constraints = [
            models.UniqueConstraint(fields=["course", "leadership_title"], name="uq_course_aud_leadership"),
        ]


class CourseAudienceMetroLine(models.Model):
    """M:N Course audience targeting by MetroLine."""

    id = models.BigAutoField(primary_key=True)
    course = models.ForeignKey(
        Course,
        on_delete=models.DO_NOTHING,
        db_column="course_id",
        related_name="audience_metro_lines",
    )
    metro_line = models.ForeignKey(
        "organization.MetroLine",
        on_delete=models.DO_NOTHING,
        db_column="metro_line_id",
        related_name="audience_courses",
    )

    class Meta:
        db_table = "courses_courseaudiencemetroline"
        constraints = [
            models.UniqueConstraint(fields=["course", "metro_line"], name="uq_course_aud_metroline"),
        ]


class CourseDraft(models.Model):
    """Mutable working curriculum draft (`1 : 0..1` per Course)."""

    id = models.BigAutoField(primary_key=True)
    course = models.OneToOneField(
        Course,
        on_delete=models.DO_NOTHING,
        db_column="course_id",
        related_name="draft",
    )
    title_snapshot = models.CharField(max_length=255)
    course_zip_policy = models.CharField(max_length=32, default="disabled", db_default="disabled")
    refresher_config_json = models.JSONField(null=True, blank=True, default=None)
    cover_type = models.CharField(max_length=16, null=True, blank=True, default=None)
    cover_color = models.CharField(max_length=32, null=True, blank=True, default=None)
    updated_at = models.DateTimeField()
    updated_by_user = models.ForeignKey(
        "identity.User",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="updated_by_user_id",
        related_name="updated_course_drafts",
    )
    updated_by_tombstone = models.ForeignKey(
        "identity.DeletedUserTombstone",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="updated_by_tombstone_id",
        related_name="updated_course_drafts",
    )

    class Meta:
        db_table = "courses_coursedraft"
        constraints = [
            models.CheckConstraint(
                condition=(
                    (Q(updated_by_user__isnull=False) & Q(updated_by_tombstone__isnull=True))
                    | (Q(updated_by_user__isnull=True) & Q(updated_by_tombstone__isnull=False))
                ),
                name="ck_coursedraft_editor_xor",
            ),
        ]


class PublishedCourseVersion(models.Model):
    """Immutable published curriculum snapshot (`1 : 0..N` per Course)."""

    id = models.BigAutoField(primary_key=True)
    course = models.ForeignKey(
        Course,
        on_delete=models.DO_NOTHING,
        db_column="course_id",
        related_name="published_versions",
    )
    version_number = models.IntegerField()
    course_zip_policy = models.CharField(max_length=32, default="disabled", db_default="disabled")
    refresher_config_json = models.JSONField(null=True, blank=True, default=None)
    cover_type = models.CharField(max_length=16, null=True, blank=True, default=None)
    cover_color = models.CharField(max_length=32, null=True, blank=True, default=None)
    published_at = models.DateTimeField()
    published_by_user = models.ForeignKey(
        "identity.User",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="published_by_user_id",
        related_name="published_course_versions",
    )
    published_by_tombstone = models.ForeignKey(
        "identity.DeletedUserTombstone",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="published_by_tombstone_id",
        related_name="published_course_versions",
    )

    class Meta:
        db_table = "courses_publishedcourseversion"
        constraints = [
            models.UniqueConstraint(fields=["course", "version_number"], name="uq_pubver_course_vernum"),
            models.CheckConstraint(condition=Q(version_number__gte=1), name="ck_pubver_vernum_gte_1"),
            models.CheckConstraint(
                condition=(
                    (Q(published_by_user__isnull=False) & Q(published_by_tombstone__isnull=True))
                    | (Q(published_by_user__isnull=True) & Q(published_by_tombstone__isnull=False))
                ),
                name="ck_pubver_publisher_xor",
            ),
        ]


class Module(models.Model):
    """Curriculum section owned exclusively by CourseDraft OR PublishedCourseVersion."""

    id = models.BigAutoField(primary_key=True)
    course_draft = models.ForeignKey(
        CourseDraft,
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="course_draft_id",
        related_name="modules",
    )
    published_version = models.ForeignKey(
        PublishedCourseVersion,
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="published_version_id",
        related_name="modules",
    )
    title = models.CharField(max_length=255, validators=[validate_non_empty_text])
    sort_order = models.IntegerField(default=0, db_default=0)

    class Meta:
        db_table = "courses_module"
        constraints = [
            models.CheckConstraint(
                condition=(
                    (Q(course_draft__isnull=False) & Q(published_version__isnull=True))
                    | (Q(course_draft__isnull=True) & Q(published_version__isnull=False))
                ),
                name="ck_module_parent_xor",
            ),
            models.CheckConstraint(condition=Q(sort_order__gte=0), name="ck_module_sort_order_gte_0"),
        ]


class LessonItem(models.Model):
    """Ordered lesson item within a Module."""

    id = models.BigAutoField(primary_key=True)
    module = models.ForeignKey(
        Module,
        on_delete=models.DO_NOTHING,
        db_column="module_id",
        related_name="lessons",
    )
    title = models.CharField(max_length=255, validators=[validate_non_empty_text])
    description = models.TextField(blank=True, default="", db_default="")
    lesson_type = models.CharField(max_length=32)
    sort_order = models.IntegerField(default=0, db_default=0)
    external_video_url = models.CharField(max_length=2048, null=True, blank=True, validators=[validate_https_url])
    duration_seconds = models.IntegerField(null=True, blank=True, default=0, db_default=0)
    download_policy = models.CharField(max_length=32, default="never", db_default="never")

    class Meta:
        db_table = "courses_lessonitem"
        constraints = [
            models.CheckConstraint(condition=Q(sort_order__gte=0), name="ck_lesson_sort_order_gte_0"),
            models.CheckConstraint(
                condition=Q(duration_seconds__isnull=True) | Q(duration_seconds__gte=0),
                name="ck_lesson_duration_gte_0",
            ),
        ]


class QuizDefinition(models.Model):
    """Optional 1 : 0..1 quiz configuration for a LessonItem."""

    id = models.BigAutoField(primary_key=True)
    lesson_item = models.OneToOneField(
        LessonItem,
        on_delete=models.DO_NOTHING,
        db_column="lesson_item_id",
        related_name="quiz_definition",
    )
    questions_json = models.JSONField(default=list)
    passing_score = models.DecimalField(max_digits=5, decimal_places=2)

    class Meta:
        db_table = "courses_quizdefinition"
        constraints = [
            models.CheckConstraint(
                condition=Q(passing_score__gte=0) & Q(passing_score__lte=100),
                name="ck_quiz_passing_score_range",
            ),
        ]


class CourseReviewSubmission(models.Model):
    """Course review submission retained indefinitely (`D-OWNER-REV-31`)."""

    id = models.BigAutoField(primary_key=True)
    course = models.ForeignKey(
        Course,
        on_delete=models.DO_NOTHING,
        db_column="course_id",
        related_name="review_submissions",
    )
    submitted_by_user = models.ForeignKey(
        "identity.User",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="submitted_by_user_id",
        related_name="submitted_course_reviews",
    )
    submitted_by_tombstone = models.ForeignKey(
        "identity.DeletedUserTombstone",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="submitted_by_tombstone_id",
        related_name="submitted_course_reviews",
    )
    reviewed_by_user = models.ForeignKey(
        "identity.User",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="reviewed_by_user_id",
        related_name="reviewed_course_submissions",
    )
    reviewed_by_tombstone = models.ForeignKey(
        "identity.DeletedUserTombstone",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="reviewed_by_tombstone_id",
        related_name="reviewed_course_submissions",
    )
    review_status = models.CharField(
        max_length=32,
        choices=REVIEW_STATUS_CHOICES,
        default="Pending",
        db_default="Pending",
    )
    submitted_at = models.DateTimeField()
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "courses_coursereviewsubmission"
        constraints = [
            models.CheckConstraint(
                condition=(
                    (Q(submitted_by_user__isnull=False) & Q(submitted_by_tombstone__isnull=True))
                    | (Q(submitted_by_user__isnull=True) & Q(submitted_by_tombstone__isnull=False))
                ),
                name="ck_review_submitter_xor",
            ),
            models.CheckConstraint(
                condition=~(Q(reviewed_by_user__isnull=False) & Q(reviewed_by_tombstone__isnull=False)),
                name="ck_review_reviewer_max_one",
            ),
            models.CheckConstraint(
                condition=Q(review_status__in=["Pending", "Approved", "ReturnedForRevision"]),
                name="ck_review_status_valid",
            ),
        ]


class StagedAdminEdit(models.Model):
    """Staged reviewer edit child of CourseReviewSubmission."""

    id = models.BigAutoField(primary_key=True)
    submission = models.ForeignKey(
        CourseReviewSubmission,
        on_delete=models.DO_NOTHING,
        db_column="submission_id",
        related_name="staged_edits",
    )
    edit_payload_json = models.JSONField(default=dict)
    created_at = models.DateTimeField()

    class Meta:
        db_table = "courses_stagedadminedit"


class WorkingNote(models.Model):
    """Internal review working note child of CourseReviewSubmission."""

    id = models.BigAutoField(primary_key=True)
    submission = models.ForeignKey(
        CourseReviewSubmission,
        on_delete=models.DO_NOTHING,
        db_column="submission_id",
        related_name="working_notes",
    )
    note_body = models.TextField()
    created_at = models.DateTimeField()

    class Meta:
        db_table = "courses_workingnote"


class CourseComment(models.Model):
    """Course discussion comment anonymized on author deletion (`D-02`)."""

    id = models.BigAutoField(primary_key=True)
    course = models.ForeignKey(
        Course,
        on_delete=models.DO_NOTHING,
        db_column="course_id",
        related_name="comments",
    )
    author_user = models.ForeignKey(
        "identity.User",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="author_user_id",
        related_name="course_comments",
    )
    is_author_deleted = models.BooleanField(default=False, db_default=False)
    body = models.TextField()
    created_at = models.DateTimeField()

    class Meta:
        db_table = "courses_coursecomment"


class CourseCommentReport(models.Model):
    """Moderation report on a CourseComment."""

    id = models.BigAutoField(primary_key=True)
    comment = models.ForeignKey(
        CourseComment,
        on_delete=models.DO_NOTHING,
        db_column="comment_id",
        related_name="reports",
    )
    reporter_user = models.ForeignKey(
        "identity.User",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="reporter_user_id",
        related_name="course_comment_reports",
    )
    reason = models.CharField(max_length=500, validators=[validate_non_empty_text])
    status = models.CharField(
        max_length=32,
        choices=COMMENT_REPORT_STATUS_CHOICES,
        default="Pending",
        db_default="Pending",
    )
    created_at = models.DateTimeField()

    class Meta:
        db_table = "courses_coursecommentreport"
        constraints = [
            models.CheckConstraint(
                condition=Q(status__in=["Pending", "Resolved", "Dismissed"]),
                name="ck_commentreport_status_valid",
            ),
        ]


class CourseQrCode(models.Model):
    """Configurable QR enrollment & access settings for a Course."""

    id = models.BigAutoField(primary_key=True)
    course = models.OneToOneField(
        Course,
        on_delete=models.DO_NOTHING,
        db_column="course_id",
        related_name="qr_code",
    )
    token = models.CharField(max_length=64, unique=True)
    is_enabled = models.BooleanField(default=True, db_default=True)
    qr_mode = models.CharField(
        max_length=20,
        choices=COURSE_QR_MODE_CHOICES,
        default="view_only",
        db_default="view_only",
    )
    expires_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField()

    class Meta:
        db_table = "courses_courseqrcode"
        constraints = [
            models.CheckConstraint(
                condition=Q(qr_mode__in=["view_only", "auto_enroll"]),
                name="ck_course_qr_mode_valid",
            ),
        ]

