"""Serializers for apps.organization catalogs, tracks, and historical training."""
from __future__ import annotations

from rest_framework import serializers

from apps.organization.models import (
    DepartmentTrack,
    HistoricalServiceTrainingRecord,
    JobTitle,
    MaritalStatusCatalog,
    MetroLine,
    MilitaryServiceStatusCatalog,
    OrganizationalDepartment,
)
from shared.validators import normalize_nfc_stripped


class BilingualCatalogSerializer(serializers.Serializer):
    """Shared serializer for OrganizationalDepartment, JobTitle, MetroLine."""

    id = serializers.IntegerField(read_only=True)
    nameAr = serializers.CharField(source="name_ar", max_length=150)
    nameEn = serializers.CharField(source="name_en", max_length=150, required=False, allow_null=True, allow_blank=True)

    def validate_nameAr(self, value: str) -> str:
        norm = normalize_nfc_stripped(value)
        if not norm:
            raise serializers.ValidationError("الاسم العربي مطلوب.")
        return norm

    def validate_nameEn(self, value: str | None) -> str | None:
        if value is None:
            return None
        norm = normalize_nfc_stripped(value)
        return norm or None


class CodedCatalogSerializer(BilingualCatalogSerializer):
    """Serializer for MaritalStatusCatalog & MilitaryServiceStatusCatalog."""

    code = serializers.CharField(max_length=32)


class DepartmentTrackSerializer(serializers.ModelSerializer):
    """Serializer for DepartmentTrack (Option A single PK)."""

    departmentCode = serializers.CharField(source="department_code", max_length=64)
    allowedTracks = serializers.ListField(
        source="allowed_tracks_json",
        child=serializers.CharField(max_length=64),
    )
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    updatedBy = serializers.CharField(source="updated_by", read_only=True)

    class Meta:
        model = DepartmentTrack
        fields = ["departmentCode", "allowedTracks", "updatedAt", "updatedBy"]


class HistoricalServiceTrainingSerializer(serializers.ModelSerializer):
    """Serializer for HistoricalServiceTrainingRecord."""

    id = serializers.IntegerField(read_only=True)
    courseName = serializers.CharField(source="course_name", max_length=255)
    providingOrganization = serializers.CharField(source="providing_organization", max_length=255)
    completionDate = serializers.DateField(source="completion_date", required=False, allow_null=True)
    certificateInfoOrNotes = serializers.CharField(
        source="certificate_info_or_notes",
        max_length=1000,
        required=False,
        allow_null=True,
        allow_blank=True,
        trim_whitespace=False,
    )

    class Meta:
        model = HistoricalServiceTrainingRecord
        fields = ["id", "courseName", "providingOrganization", "completionDate", "certificateInfoOrNotes"]

