"""Notifications, WhatsApp support & scheduled background job models (5 active entities)."""
from __future__ import annotations

from django.db import models
from django.db.models import Q

from shared.validators import validate_egypt_phone_e164

JOB_RUN_STATUS_CHOICES = [
    ("Pending", "Pending"),
    ("Running", "Running"),
    ("Succeeded", "Succeeded"),
    ("Failed", "Failed"),
    ("Skipped", "Skipped"),
]


class NotificationItem(models.Model):
    """User-targeted platform notification (`D-08`, deleted on `D-01`)."""

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        "identity.User",
        on_delete=models.DO_NOTHING,
        db_column="user_id",
        related_name="notifications",
    )
    title = models.CharField(max_length=255)
    body = models.TextField()
    notif_type = models.CharField(max_length=64, default="general_alert", db_default="general_alert")
    target_url = models.CharField(max_length=500, null=True, blank=True)
    action_required = models.BooleanField(default=False, db_default=False)
    metadata_json = models.JSONField(null=True, blank=True)
    is_read = models.BooleanField(default=False, db_default=False)
    created_at = models.DateTimeField()

    class Meta:
        db_table = "communications_notificationitem"


class WhatsAppContact(models.Model):
    """Course-scoped WhatsApp support contact (`D-09`)."""

    id = models.BigAutoField(primary_key=True)
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.DO_NOTHING,
        db_column="course_id",
        related_name="whatsapp_contacts",
    )
    phone_e164 = models.CharField(max_length=16, validators=[validate_egypt_phone_e164])
    label = models.CharField(max_length=150)

    class Meta:
        db_table = "communications_whatsappcontact"


class UserWhatsAppVisibility(models.Model):
    """Per-user support scenario visibility (`D-09`, deleted on `D-01`)."""

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        "identity.User",
        on_delete=models.DO_NOTHING,
        db_column="user_id",
        related_name="whatsapp_visibility_settings",
    )
    scenario_key = models.CharField(max_length=64)
    is_visible = models.BooleanField(default=True, db_default=True)

    class Meta:
        db_table = "communications_userwhatsappvisibility"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "scenario_key"],
                name="uq_wavisibility_user_scenario",
            ),
        ]


class ScheduledJob(models.Model):
    """Scheduled background job definition (`TR-C3-04` two-entity split)."""

    id = models.BigAutoField(primary_key=True)
    job_key = models.CharField(max_length=100, unique=True)
    schedule_config = models.CharField(max_length=255)
    timezone = models.CharField(max_length=64)
    is_enabled = models.BooleanField(default=True, db_default=True)

    class Meta:
        db_table = "communications_scheduledjob"


class ScheduledJobRun(models.Model):
    """Scheduled background job execution & retry record (`TR-C3-04`; max 3 attempts)."""

    id = models.BigAutoField(primary_key=True)
    job = models.ForeignKey(
        ScheduledJob,
        on_delete=models.DO_NOTHING,
        db_column="job_id",
        related_name="runs",
    )
    idempotency_key = models.CharField(max_length=128, unique=True)
    status = models.CharField(max_length=20, choices=JOB_RUN_STATUS_CHOICES)
    retry_count = models.IntegerField()
    started_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)
    details_json = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "communications_scheduledjobrun"
        constraints = [
            models.CheckConstraint(
                condition=Q(status__in=["Pending", "Running", "Succeeded", "Failed", "Skipped"]),
                name="ck_jobrun_status_valid",
            ),
            models.CheckConstraint(
                condition=Q(retry_count__gte=0) & Q(retry_count__lte=2),
                name="ck_jobrun_retry_count_range",
            ),
        ]

