"""Enrollments, course attempts, lesson progress & certificates models (5 active entities)."""
from __future__ import annotations

from django.db import models
from django.db.models import Q

ENROLLMENT_SOURCE_CHOICES = [
    ("direct", "Direct"),
    ("group", "Group"),
    ("self:continued", "Self Continued"),
]


class Enrollment(models.Model):
    """Trainee course access anchor (`D-07`, `D-01`)."""

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        "identity.User",
        on_delete=models.DO_NOTHING,
        db_column="user_id",
        related_name="enrollments",
    )
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.DO_NOTHING,
        db_column="course_id",
        related_name="enrollments",
    )
    enrolled_at = models.DateTimeField()

    class Meta:
        db_table = "learning_enrollment"
        constraints = [
            models.UniqueConstraint(fields=["user", "course"], name="uq_enrollment_user_course"),
        ]


class EnrollmentSourceGrant(models.Model):
    """Access provenance grant (`direct`, `group`, `self:continued`)."""

    id = models.BigAutoField(primary_key=True)
    enrollment = models.ForeignKey(
        Enrollment,
        on_delete=models.DO_NOTHING,
        db_column="enrollment_id",
        related_name="source_grants",
    )
    source_type = models.CharField(max_length=20, choices=ENROLLMENT_SOURCE_CHOICES)
    training_group = models.ForeignKey(
        "groups.TrainingGroup",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="training_group_id",
        related_name="enrollment_source_grants",
    )

    class Meta:
        db_table = "learning_enrollmentsourcegrant"
        constraints = [
            models.CheckConstraint(
                condition=Q(source_type__in=["direct", "group", "self:continued"]),
                name="ck_enrollgrant_sourcetype_valid",
            ),
        ]


class CourseAttempt(models.Model):
    """Isolated learning attempt bound to Enrollment, PublishedCourseVersion & optional Cycle."""

    id = models.BigAutoField(primary_key=True)
    enrollment = models.ForeignKey(
        Enrollment,
        on_delete=models.DO_NOTHING,
        db_column="enrollment_id",
        related_name="attempts",
    )
    published_version = models.ForeignKey(
        "courses.PublishedCourseVersion",
        on_delete=models.DO_NOTHING,
        db_column="published_version_id",
        related_name="course_attempts",
    )
    group_renewal_cycle = models.ForeignKey(
        "groups.GroupRenewalCycle",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="group_renewal_cycle_id",
        related_name="course_attempts",
    )
    is_sealed = models.BooleanField()

    class Meta:
        db_table = "learning_courseattempt"


class LessonProgress(models.Model):
    """Per-lesson completion & playback telemetry (`OD-PF-02`: no persisted progress_percent)."""

    id = models.BigAutoField(primary_key=True)
    course_attempt = models.ForeignKey(
        CourseAttempt,
        on_delete=models.DO_NOTHING,
        db_column="course_attempt_id",
        related_name="lesson_progress_records",
    )
    lesson_item = models.ForeignKey(
        "courses.LessonItem",
        on_delete=models.DO_NOTHING,
        db_column="lesson_item_id",
        related_name="lesson_progress_records",
    )
    is_completed = models.BooleanField()
    last_position_seconds = models.IntegerField(default=0, db_default=0)
    furthest_watched_seconds = models.IntegerField(default=0, db_default=0)
    eligible_viewing_seconds = models.IntegerField(default=0, db_default=0)
    watch_count = models.IntegerField(default=0, db_default=0)
    updated_at = models.DateTimeField()

    class Meta:
        db_table = "learning_lessonprogress"
        constraints = [
            models.UniqueConstraint(
                fields=["course_attempt", "lesson_item"],
                name="uq_lessonprogress_attempt_lesson",
            ),
            models.CheckConstraint(condition=Q(last_position_seconds__gte=0), name="ck_lp_last_pos_gte_0"),
            models.CheckConstraint(condition=Q(furthest_watched_seconds__gte=0), name="ck_lp_furthest_gte_0"),
            models.CheckConstraint(condition=Q(eligible_viewing_seconds__gte=0), name="ck_lp_eligible_gte_0"),
            models.CheckConstraint(condition=Q(watch_count__gte=0), name="ck_lp_watch_count_gte_0"),
        ]


class CertificateRecord(models.Model):
    """Version-scoped completion certificate preserved on D-01 if issued (`TR-C3-03`)."""

    id = models.BigAutoField(primary_key=True)
    course_attempt = models.ForeignKey(
        CourseAttempt,
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="course_attempt_id",
        related_name="certificates",
    )
    published_version = models.ForeignKey(
        "courses.PublishedCourseVersion",
        on_delete=models.DO_NOTHING,
        db_column="published_version_id",
        related_name="certificates",
    )
    verification_token_hash = models.BinaryField(max_length=32, unique=True)
    issued_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    certificate_serial = models.CharField(max_length=64, unique=True)
    recipient_name_snapshot = models.CharField(max_length=200)
    course_title_snapshot = models.CharField(max_length=255)

    class Meta:
        db_table = "learning_certificaterecord"
        constraints = [
            models.UniqueConstraint(
                fields=["course_attempt"],
                condition=Q(course_attempt__isnull=False),
                name="uq_cert_attempt_not_null",
            ),
        ]

