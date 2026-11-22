"""Training groups, renewal cycles, memberships, QR join & resources models (8 active entities)."""
from __future__ import annotations

from django.db import models
from django.db.models import Q

from shared.validators import validate_https_url, validate_non_empty_text

GROUP_TYPE_CHOICES = [
    ("regular", "Regular"),
    ("reminder", "Reminder"),
]

CYCLE_STATUS_CHOICES = [
    ("Scheduled", "Scheduled"),
    ("Active", "Active"),
    ("Completed", "Completed"),
    ("Expired", "Expired"),
    ("Cancelled", "Cancelled"),
]

JOIN_REQUEST_STATUS_CHOICES = [
    ("Pending", "Pending"),
    ("Approved", "Approved"),
    ("Rejected", "Rejected"),
]

RESOURCE_PROVIDER_CHOICES = [
    ("teams", "Microsoft Teams"),
    ("zoom", "Zoom"),
    ("meet", "Google Meet"),
    ("other", "Other"),
]


class TrainingGroup(models.Model):
    """Persistent training group (`regular` or `reminder`)."""

    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=255, validators=[validate_non_empty_text])
    description = models.TextField(blank=True, default="", db_default="")
    group_type = models.CharField(max_length=20, choices=GROUP_TYPE_CHOICES)
    is_archived = models.BooleanField(default=False, db_default=False)
    auto_renewal_enabled = models.BooleanField()
    interval_days = models.IntegerField(null=True, blank=True)
    deadline_datetime = models.DateTimeField(null=True, blank=True)
    next_scheduled_renewal_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "groups_traininggroup"
        constraints = [
            models.CheckConstraint(
                condition=Q(group_type__in=["regular", "reminder"]),
                name="ck_group_type_valid",
            ),
            models.CheckConstraint(
                condition=Q(interval_days__isnull=True) | (Q(interval_days__gte=1) & Q(interval_days__lte=730)),
                name="ck_group_interval_days_range",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class GroupAssistantAssignment(models.Model):
    """Group-scoped assistant_admin / assistant lecturer assignment (`INV-R7`)."""

    id = models.BigAutoField(primary_key=True)
    training_group = models.ForeignKey(
        TrainingGroup,
        on_delete=models.DO_NOTHING,
        db_column="training_group_id",
        related_name="assistant_assignments",
    )
    user = models.ForeignKey(
        "identity.User",
        on_delete=models.DO_NOTHING,
        db_column="user_id",
        related_name="group_assistant_assignments",
    )
    assignment_role = models.CharField(max_length=32)

    class Meta:
        db_table = "groups_groupassistantassignment"
        constraints = [
            models.UniqueConstraint(
                fields=["training_group", "user", "assignment_role"],
                name="uq_groupassistant_group_user_role",
            ),
        ]


class GroupRenewalCycle(models.Model):
    """Time-bounded group renewal cycle (`CYC-<groupId>-<NN>`)."""

    id = models.BigAutoField(primary_key=True)
    training_group = models.ForeignKey(
        TrainingGroup,
        on_delete=models.DO_NOTHING,
        db_column="training_group_id",
        related_name="renewal_cycles",
    )
    cycle_code = models.CharField(max_length=64)
    cycle_number = models.IntegerField()
    start_datetime = models.DateTimeField()
    deadline_datetime = models.DateTimeField(null=True, blank=True)
    cycle_status = models.CharField(max_length=20, choices=CYCLE_STATUS_CHOICES)

    class Meta:
        db_table = "groups_grouprenewalcycle"
        constraints = [
            models.UniqueConstraint(
                fields=["training_group", "cycle_number"],
                name="uq_groupcycle_group_num",
            ),
            models.CheckConstraint(
                condition=Q(cycle_status__in=["Scheduled", "Active", "Completed", "Expired", "Cancelled"]),
                name="ck_groupcycle_status_valid",
            ),
        ]


class GroupCourseAssignment(models.Model):
    """Binds a Course to a GroupRenewalCycle (`1 : 0..N`)."""

    id = models.BigAutoField(primary_key=True)
    group_renewal_cycle = models.ForeignKey(
        GroupRenewalCycle,
        on_delete=models.DO_NOTHING,
        db_column="group_renewal_cycle_id",
        related_name="course_assignments",
    )
    course = models.ForeignKey(
        "courses.Course",
        on_delete=models.DO_NOTHING,
        db_column="course_id",
        related_name="group_course_assignments",
    )
    course_role = models.CharField(max_length=20, default="core", db_default="core")

    class Meta:
        db_table = "groups_groupcourseassignment"
        constraints = [
            models.UniqueConstraint(
                fields=["group_renewal_cycle", "course"],
                name="uq_groupcourse_cycle_course",
            ),
        ]


class GroupMembership(models.Model):
    """Trainee roster membership in a TrainingGroup (`D-07`)."""

    id = models.BigAutoField(primary_key=True)
    training_group = models.ForeignKey(
        TrainingGroup,
        on_delete=models.DO_NOTHING,
        db_column="training_group_id",
        related_name="memberships",
    )
    user = models.ForeignKey(
        "identity.User",
        on_delete=models.DO_NOTHING,
        db_column="user_id",
        related_name="group_memberships",
    )
    joined_at = models.DateTimeField()

    class Meta:
        db_table = "groups_groupmembership"
        constraints = [
            models.UniqueConstraint(
                fields=["training_group", "user"],
                name="uq_groupmembership_group_user",
            ),
        ]


class GroupQrCode(models.Model):
    """Single mutable SHA-256 QR join token per TrainingGroup (`TR-C3-01` Option B)."""

    id = models.BigAutoField(primary_key=True)
    training_group = models.OneToOneField(
        TrainingGroup,
        on_delete=models.DO_NOTHING,
        db_column="training_group_id",
        related_name="qr_code",
    )
    token_hash = models.BinaryField(max_length=32, unique=True)
    is_enabled = models.BooleanField()
    updated_at = models.DateTimeField()

    class Meta:
        db_table = "groups_groupqrcode"


class GroupJoinRequest(models.Model):
    """QR/join approval request with filtered UNIQUE on Pending requests."""

    id = models.BigAutoField(primary_key=True)
    training_group = models.ForeignKey(
        TrainingGroup,
        on_delete=models.DO_NOTHING,
        db_column="training_group_id",
        related_name="join_requests",
    )
    user = models.ForeignKey(
        "identity.User",
        on_delete=models.DO_NOTHING,
        db_column="user_id",
        related_name="group_join_requests",
    )
    request_status = models.CharField(max_length=20, choices=JOIN_REQUEST_STATUS_CHOICES)
    requested_at = models.DateTimeField()
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "groups_groupjoinrequest"
        constraints = [
            models.CheckConstraint(
                condition=Q(request_status__in=["Pending", "Approved", "Rejected"]),
                name="ck_groupjoinreq_status_valid",
            ),
            models.UniqueConstraint(
                fields=["training_group", "user"],
                condition=Q(request_status="Pending"),
                name="uq_groupjoinreq_pending_group_user",
            ),
        ]


class GroupResource(models.Model):
    """Online meeting link resource for a TrainingGroup (`INV-DOM16-03`)."""

    id = models.BigAutoField(primary_key=True)
    training_group = models.ForeignKey(
        TrainingGroup,
        on_delete=models.DO_NOTHING,
        db_column="training_group_id",
        related_name="resources",
    )
    provider = models.CharField(max_length=20, choices=RESOURCE_PROVIDER_CHOICES)
    title = models.CharField(max_length=255)
    meeting_url = models.CharField(max_length=2048, validators=[validate_https_url])

    class Meta:
        db_table = "groups_groupresource"
        constraints = [
            models.CheckConstraint(
                condition=Q(provider__in=["teams", "zoom", "meet", "other"]),
                name="ck_groupresource_provider_valid",
            ),
        ]

