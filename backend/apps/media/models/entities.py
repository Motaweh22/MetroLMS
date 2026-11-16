"""Media storage metadata & content usage reference models (2 active entities)."""
from __future__ import annotations

from django.db import models
from django.db.models import Q

from shared.validators import validate_mime_type


class MediaAsset(models.Model):
    """Immutable binary media asset metadata (`INV-DOM21-05..17`, No Auto Purge)."""

    id = models.BigAutoField(primary_key=True)
    storage_key = models.CharField(max_length=512, unique=True)
    file_name = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=127, validators=[validate_mime_type])
    size_bytes = models.BigIntegerField()
    sha256_checksum = models.CharField(max_length=64, db_index=True)
    uploaded_by_user = models.ForeignKey(
        "identity.User",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="uploaded_by_user_id",
        related_name="uploaded_media_assets",
    )
    uploaded_by_tombstone = models.ForeignKey(
        "identity.DeletedUserTombstone",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="uploaded_by_tombstone_id",
        related_name="uploaded_media_assets",
    )
    created_at = models.DateTimeField()

    class Meta:
        db_table = "media_mediaasset"
        constraints = [
            models.CheckConstraint(condition=Q(size_bytes__gte=0), name="ck_mediaasset_size_gte_0"),
            models.CheckConstraint(
                condition=(
                    (Q(uploaded_by_user__isnull=False) & Q(uploaded_by_tombstone__isnull=True))
                    | (Q(uploaded_by_user__isnull=True) & Q(uploaded_by_tombstone__isnull=False))
                ),
                name="ck_mediaasset_uploader_xor",
            ),
        ]


class MediaContentReference(models.Model):
    """Context-specific media usage reference (3-way XOR across Draft, PublishedVersion, GroupCycle)."""

    id = models.BigAutoField(primary_key=True)
    media_asset = models.ForeignKey(
        MediaAsset,
        on_delete=models.DO_NOTHING,
        db_column="media_asset_id",
        related_name="content_references",
    )
    course_draft = models.ForeignKey(
        "courses.CourseDraft",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="course_draft_id",
        related_name="media_references",
    )
    published_version = models.ForeignKey(
        "courses.PublishedCourseVersion",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="published_version_id",
        related_name="media_references",
    )
    group_renewal_cycle = models.ForeignKey(
        "groups.GroupRenewalCycle",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="group_renewal_cycle_id",
        related_name="media_references",
    )
    title = models.CharField(max_length=255)
    is_visible = models.BooleanField()
    detached_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "media_mediacontentreference"
        constraints = [
            models.CheckConstraint(
                condition=(
                    (Q(course_draft__isnull=False) & Q(published_version__isnull=True) & Q(group_renewal_cycle__isnull=True))
                    | (Q(course_draft__isnull=True) & Q(published_version__isnull=False) & Q(group_renewal_cycle__isnull=True))
                    | (Q(course_draft__isnull=True) & Q(published_version__isnull=True) & Q(group_renewal_cycle__isnull=False))
                ),
                name="ck_mediaref_target_3way_xor",
            ),
        ]

