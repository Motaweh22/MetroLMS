"""Serializers for MediaAsset and MediaContentReference."""
from __future__ import annotations

from rest_framework import serializers

from apps.media.models import MediaAsset, MediaContentReference
from apps.media.services.media_service import get_asset_transcode_status


class MediaAssetSerializer(serializers.ModelSerializer):
    """Read-only MediaAsset metadata DTO (never exposes storage_key or physical paths)."""

    fileName = serializers.CharField(source="file_name", read_only=True)
    mimeType = serializers.CharField(source="mime_type", read_only=True)
    sizeBytes = serializers.IntegerField(source="size_bytes", read_only=True)
    sha256Checksum = serializers.CharField(source="sha256_checksum", read_only=True)
    transcodeStatus = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = MediaAsset
        fields = ["id", "fileName", "mimeType", "sizeBytes", "sha256Checksum", "transcodeStatus", "createdAt"]

    def get_transcodeStatus(self, obj: MediaAsset) -> str:
        return get_asset_transcode_status(obj)


class MediaContentReferenceSerializer(serializers.ModelSerializer):
    """DTO for MediaContentReference."""

    mediaAssetId = serializers.IntegerField(source="media_asset_id", read_only=True)
    courseDraftId = serializers.IntegerField(source="course_draft_id", read_only=True)
    publishedVersionId = serializers.IntegerField(source="published_version_id", read_only=True)
    groupRenewalCycleId = serializers.IntegerField(source="group_renewal_cycle_id", read_only=True)
    isVisible = serializers.BooleanField(source="is_visible", read_only=True)
    detachedAt = serializers.DateTimeField(source="detached_at", read_only=True)
    streamUrl = serializers.SerializerMethodField()

    class Meta:
        model = MediaContentReference
        fields = [
            "id",
            "mediaAssetId",
            "courseDraftId",
            "publishedVersionId",
            "groupRenewalCycleId",
            "title",
            "isVisible",
            "detachedAt",
            "streamUrl",
        ]

    def get_streamUrl(self, obj: MediaContentReference) -> str:
        return f"/api/media/references/{obj.id}/stream"

