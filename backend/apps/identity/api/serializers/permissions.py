"""Serializers for RBAC RolePolicy, UserPermissionOverride & DelegatedAuthority endpoints."""
from __future__ import annotations

from rest_framework import serializers

from apps.identity.models import DelegatedAuthority, RolePolicy, UserPermissionOverride
from shared.permissions import ALL_CAPABILITIES, ROLE_CAPABILITY_CEILINGS


class RolePolicySerializer(serializers.ModelSerializer):
    """Serializer for RolePolicy matrix."""

    roleKey = serializers.CharField(source="role_key", read_only=True)
    role = serializers.SerializerMethodField()
    defaultCapabilities = serializers.ListField(
        source="default_capabilities_json",
        child=serializers.ChoiceField(choices=ALL_CAPABILITIES),
    )
    permissions = serializers.SerializerMethodField()
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    updatedBy = serializers.CharField(source="updated_by", read_only=True)

    class Meta:
        model = RolePolicy
        fields = ["roleKey", "role", "defaultCapabilities", "permissions", "updatedAt", "updatedBy"]

    def get_role(self, obj: RolePolicy) -> str:
        return "user" if obj.role_key == "trainee" else obj.role_key

    def get_permissions(self, obj: RolePolicy) -> list[str]:
        return list(obj.default_capabilities_json or [])

    def validate_defaultCapabilities(self, value: list[str]) -> list[str]:
        role_key = self.instance.role_key if self.instance else None
        if role_key:
            ceiling = ROLE_CAPABILITY_CEILINGS.get(role_key, frozenset())
            exceeded = [cap for cap in value if cap not in ceiling]
            if exceeded:
                raise serializers.ValidationError(
                    f"Capabilities exceed ceiling for role '{role_key}': {', '.join(exceeded)}"
                )
        return list(dict.fromkeys(value))


class UserPermissionOverrideSerializer(serializers.ModelSerializer):
    """Serializer for UserPermissionOverride allow/deny lists."""

    userId = serializers.IntegerField(source="user_id", read_only=True)
    grantedCapabilities = serializers.ListField(
        source="granted_capabilities_json",
        child=serializers.ChoiceField(choices=ALL_CAPABILITIES),
        default=list,
    )
    deniedCapabilities = serializers.ListField(
        source="denied_capabilities_json",
        child=serializers.ChoiceField(choices=ALL_CAPABILITIES),
        default=list,
    )

    class Meta:
        model = UserPermissionOverride
        fields = ["userId", "grantedCapabilities", "deniedCapabilities"]


class DelegatedAuthoritySerializer(serializers.ModelSerializer):
    """Serializer for DelegatedAuthority records."""

    id = serializers.IntegerField(read_only=True)
    userId = serializers.IntegerField(source="user_id", read_only=True)
    capabilityKey = serializers.ChoiceField(source="capability_key", choices=ALL_CAPABILITIES)
    grantedByUserId = serializers.IntegerField(source="granted_by_user_id", read_only=True)
    grantedAt = serializers.DateTimeField(source="granted_at", read_only=True)
    isActive = serializers.BooleanField(source="is_active", read_only=True)

    class Meta:
        model = DelegatedAuthority
        fields = ["id", "userId", "capabilityKey", "grantedByUserId", "grantedAt", "isActive"]

