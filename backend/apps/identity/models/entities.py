"""Identity & Access Control models (7 active entities)."""
from __future__ import annotations

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.sessions.base_session import AbstractBaseSession, BaseSessionManager
from django.db import models
from django.db.models import F, Q

from shared.validators import (
    normalize_email_optional,
    normalize_national_id,
    normalize_phone_e164,
    validate_cairo_past_date,
    validate_egypt_phone_e164,
    validate_national_id,
    validate_non_empty_text,
)

ROLE_CHOICES = [
    ("developer", "Developer"),
    ("super_admin", "Super Admin"),
    ("admin", "Admin"),
    ("assistant_admin", "Assistant Admin"),
    ("lecturer", "Lecturer"),
    ("trainee", "Trainee"),
]

USER_STATUS_CHOICES = [
    ("Active", "Active"),
    ("Suspended", "Suspended"),
]


class RolePolicy(models.Model):
    """Canonical 6-tier role default capability policy."""

    role_key = models.CharField(primary_key=True, max_length=32, choices=ROLE_CHOICES)
    default_capabilities_json = models.JSONField(default=list)
    updated_at = models.DateTimeField()
    updated_by = models.CharField(max_length=64)

    class Meta:
        db_table = "identity_rolepolicy"

    def __str__(self) -> str:
        return self.role_key


class UserManager(BaseUserManager["User"]):
    """Custom manager for phone_e164-authenticated User accounts."""

    use_in_migrations = True

    def _create_user(self, phone_e164: str, password: str | None, **extra_fields: object) -> "User":
        if not phone_e164:
            raise ValueError("phone_e164 is required.")
        normalized_phone = normalize_phone_e164(phone_e164)
        validate_egypt_phone_e164(normalized_phone)
        if "email" in extra_fields:
            extra_fields["email"] = normalize_email_optional(extra_fields["email"])  # type: ignore[arg-type]
        if "national_id" in extra_fields and extra_fields["national_id"]:
            extra_fields["national_id"] = normalize_national_id(str(extra_fields["national_id"]))
        user = self.model(phone_e164=normalized_phone, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, phone_e164: str, password: str | None = None, **extra_fields: object) -> "User":
        if "role" not in extra_fields and "role_id" not in extra_fields:
            extra_fields["role_id"] = "trainee"
        elif isinstance(extra_fields.get("role"), str):
            extra_fields["role_id"] = extra_fields.pop("role")
        extra_fields.setdefault("status", "Active")
        return self._create_user(phone_e164, password, **extra_fields)


class User(AbstractBaseUser):
    """Canonical MetroLMS employee / user account (`identity.User`)."""

    id = models.BigAutoField(primary_key=True)
    last_login = None  # Excluded per frozen Data Dictionary §2.1
    phone_e164 = models.CharField(
        max_length=16,
        unique=True,
        validators=[validate_egypt_phone_e164],
    )
    password = models.CharField(max_length=255, db_column="password_hash")
    role = models.ForeignKey(
        RolePolicy,
        on_delete=models.DO_NOTHING,
        db_column="role",
        related_name="users",
    )
    status = models.CharField(max_length=20, choices=USER_STATUS_CHOICES, default="Active", db_default="Active")
    full_name = models.CharField(max_length=200, validators=[validate_non_empty_text])
    gender = models.CharField(
        max_length=10,
        choices=[("male", "ذكر"), ("female", "أنثى")],
        default="male",
        db_default="male",
    )
    national_id = models.CharField(max_length=14, unique=True, validators=[validate_national_id])
    marital_status = models.ForeignKey(
        "organization.MaritalStatusCatalog",
        on_delete=models.DO_NOTHING,
        db_column="marital_status_id",
        related_name="users",
    )
    appointment_date = models.DateField()
    military_service_status = models.ForeignKey(
        "organization.MilitaryServiceStatusCatalog",
        on_delete=models.DO_NOTHING,
        db_column="military_service_status_id",
        related_name="users",
    )
    educational_qualification = models.CharField(max_length=500, validators=[validate_non_empty_text])
    address = models.CharField(max_length=500, validators=[validate_non_empty_text])
    date_of_birth = models.DateField(validators=[validate_cairo_past_date])
    service_end_date = models.DateField(null=True, blank=True)
    metro_line = models.ForeignKey(
        "organization.MetroLine",
        on_delete=models.DO_NOTHING,
        db_column="metro_line_id",
        related_name="users",
    )
    email = models.EmailField(max_length=254, null=True, blank=True)
    leadership_title = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "phone_e164"
    REQUIRED_FIELDS = ["full_name", "national_id"]

    class Meta:
        db_table = "identity_user"
        constraints = [
            models.CheckConstraint(
                condition=Q(role__in=["developer", "super_admin", "admin", "assistant_admin", "lecturer", "trainee"]),
                name="ck_identity_user_role_valid",
            ),
            models.CheckConstraint(
                condition=Q(status__in=["Active", "Suspended"]),
                name="ck_identity_user_status_valid",
            ),
            models.CheckConstraint(
                condition=Q(gender__in=["male", "female"]),
                name="ck_identity_user_gender_valid",
            ),
            models.CheckConstraint(
                condition=Q(service_end_date__isnull=True) | Q(service_end_date__gte=F("appointment_date")),
                name="ck_identity_user_service_end_gte_appt",
            ),
            models.UniqueConstraint(
                fields=["role"],
                condition=Q(role="developer"),
                name="uq_identity_user_single_developer",
            ),
            models.UniqueConstraint(
                fields=["email"],
                condition=Q(email__isnull=False),
                name="uq_identity_user_email_not_null",
            ),
        ]

    @property
    def is_active(self) -> bool:
        return self.status == "Active"

    def __str__(self) -> str:
        return f"{self.full_name} ({self.phone_e164})"


class ServerSessionManager(BaseSessionManager):
    """Manager for ServerSession."""

    use_in_migrations = True


class ServerSession(AbstractBaseSession):
    """Server-side session record with optional indexed user_id FK for bulk invalidation."""

    user = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="user_id",
        related_name="server_sessions",
    )

    objects = ServerSessionManager()

    class Meta:
        db_table = "identity_serversession"

    @classmethod
    def get_session_store_class(cls):
        from apps.identity.sessions import SessionStore

        return SessionStore


class DeletedUserTombstone(models.Model):
    """Append-only anti-resurrection tombstone for deleted User accounts."""

    id = models.BigAutoField(primary_key=True)
    canonical_user_id = models.CharField(max_length=64, unique=True)
    deleted_at = models.DateTimeField()
    deleted_by_actor_id = models.CharField(max_length=64)
    reason = models.CharField(max_length=1000, null=True, blank=True)

    class Meta:
        db_table = "identity_deletedusertombstone"

    def __str__(self) -> str:
        return self.canonical_user_id


class DeletedUserAlias(models.Model):
    """Normalized child alias table mapped to DeletedUserTombstone (Option B)."""

    id = models.BigAutoField(primary_key=True)
    tombstone = models.ForeignKey(
        DeletedUserTombstone,
        on_delete=models.DO_NOTHING,
        db_column="tombstone_id",
        related_name="aliases",
    )
    alias_id = models.CharField(max_length=64, unique=True)

    class Meta:
        db_table = "identity_deleteduseralias"

    def __str__(self) -> str:
        return self.alias_id


class UserPermissionOverride(models.Model):
    """Per-user capability allow/deny overrides bounded by role ceiling."""

    id = models.BigAutoField(primary_key=True)
    user = models.OneToOneField(
        User,
        on_delete=models.DO_NOTHING,
        db_column="user_id",
        related_name="permission_override",
    )
    granted_capabilities_json = models.JSONField(default=list)
    denied_capabilities_json = models.JSONField(default=list)

    class Meta:
        db_table = "identity_userpermissionoverride"


class DelegatedAuthority(models.Model):
    """Exact capability delegation record (INV-R9) with Tombstone attribution on D-01."""

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="user_id",
        related_name="delegated_authorities_received",
    )
    grantee_tombstone = models.ForeignKey(
        DeletedUserTombstone,
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="grantee_tombstone_id",
        related_name="delegated_authorities_received",
    )
    capability_key = models.CharField(max_length=100)
    granted_by_user = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="granted_by_user_id",
        related_name="delegated_authorities_granted",
    )
    granted_by_tombstone = models.ForeignKey(
        DeletedUserTombstone,
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="granted_by_tombstone_id",
        related_name="delegated_authorities_granted",
    )
    granted_at = models.DateTimeField()
    is_active = models.BooleanField(default=True, db_default=True)

    class Meta:
        db_table = "identity_delegatedauthority"
        indexes = [
            models.Index(fields=["user", "capability_key"], name="ix_delauth_user_cap"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    (Q(user__isnull=False) & Q(grantee_tombstone__isnull=True))
                    | (Q(user__isnull=True) & Q(grantee_tombstone__isnull=False))
                ),
                name="ck_delauth_grantee_xor",
            ),
            models.CheckConstraint(
                condition=(
                    (Q(granted_by_user__isnull=False) & Q(granted_by_tombstone__isnull=True))
                    | (Q(granted_by_user__isnull=True) & Q(granted_by_tombstone__isnull=False))
                ),
                name="ck_delauth_grantor_xor",
            ),
        ]

