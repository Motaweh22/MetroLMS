"""Serializers for MetroLMS identity authentication endpoints."""
from __future__ import annotations

from rest_framework import serializers

from apps.identity.models import User
from shared.validators import normalize_phone_e164, validate_egypt_phone_e164


class LoginSerializer(serializers.Serializer):
    """Validates phone_e164 + password login payload."""

    phone_e164 = serializers.CharField(max_length=16, required=True, allow_blank=False)
    password = serializers.CharField(write_only=True, required=True, allow_blank=False, trim_whitespace=False)

    def validate_phone_e164(self, value: str) -> str:
        normalized = normalize_phone_e164(value).replace(" ", "").replace("-", "")
        if normalized.startswith("01") and len(normalized) == 11 and normalized.isdigit():
            normalized = f"+2{normalized}"
        elif normalized.startswith("201") and len(normalized) == 12 and normalized.isdigit():
            normalized = f"+{normalized}"
        try:
            validate_egypt_phone_e164(normalized)
        except Exception as exc:
            raise serializers.ValidationError("يرجى إدخال رقم هاتف مصري صحيح بصيغة +201XXXXXXXXX.") from exc
        return normalized


class AuthenticatedUserSerializer(serializers.ModelSerializer):
    """Read-only DTO for the authenticated User (never exposes password_hash)."""

    id = serializers.CharField(read_only=True)
    phoneE164 = serializers.CharField(source="phone_e164", read_only=True)
    role = serializers.CharField(source="role_id", read_only=True)
    fullName = serializers.CharField(source="full_name", read_only=True)
    nameEn = serializers.CharField(source="full_name_en", read_only=True, allow_null=True)
    employeeNumber = serializers.CharField(source="employee_number", read_only=True, allow_null=True)
    metroLineId = serializers.IntegerField(source="metro_line_id", read_only=True)

    class Meta:
        model = User
        fields = ["id", "phoneE164", "role", "status", "fullName", "nameEn", "email", "employeeNumber", "metroLineId"]

