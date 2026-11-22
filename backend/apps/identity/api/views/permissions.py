"""RBAC administration endpoints (/api/admin/permissions/*)."""
from __future__ import annotations

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.identity.api.serializers.permissions import (
    DelegatedAuthoritySerializer,
    RolePolicySerializer,
    UserPermissionOverrideSerializer,
)
from apps.identity.models import DelegatedAuthority, RolePolicy, UserPermissionOverride
from shared.api import error_response, success_response
from shared.permissions import (
    ALL_CAPABILITIES,
    IMMUTABLE_BLOCKED_FOR_ASSISTANT_ADMIN,
    ROLE_CAPABILITY_CEILINGS,
    evaluate_permission,
    get_visible_user_or_none,
    has_capability,
)


class RolePolicyListView(APIView):
    """GET /api/admin/permissions/roles."""

    permission_classes = [IsAuthenticated, has_capability("permissions.view_matrix")]

    def get(self, request: Request):
        qs = RolePolicy.objects.all().order_by("role_key")
        if request.user.role_id != "developer":
            qs = qs.exclude(role_key="developer")
        return success_response({"roles": RolePolicySerializer(qs, many=True).data})


class RolePolicyDetailView(APIView):
    """GET / PUT / PATCH /api/admin/permissions/roles/<role_key>."""

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated(), has_capability("permissions.view_matrix")()]
        return [IsAuthenticated(), has_capability("permissions.configure_roles")()]

    def _normalize_role_key(self, role_key: str) -> str:
        return "trainee" if role_key == "user" else role_key

    def get(self, request: Request, role_key: str):
        role_key = self._normalize_role_key(role_key)
        if role_key == "developer" and request.user.role_id != "developer":
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        policy = RolePolicy.objects.filter(role_key=role_key).first()
        if policy is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        return success_response({"role": RolePolicySerializer(policy).data})

    def put(self, request: Request, role_key: str):
        return self._update(request, role_key)

    def patch(self, request: Request, role_key: str):
        return self._update(request, role_key)

    def _update(self, request: Request, role_key: str):
        role_key = self._normalize_role_key(role_key)
        if role_key == "developer" and request.user.role_id != "developer":
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if role_key == "super_admin" and request.user.role_id != "developer":
            return error_response(
                "PERMISSION_DENIED",
                "تعديل صلاحيات دور المدير الأعلى مقصور على المطور فقط.",
                status.HTTP_403_FORBIDDEN,
            )
        if role_key == "admin" and request.user.role_id not in {"developer", "super_admin"}:
            return error_response(
                "PERMISSION_DENIED",
                "تعديل صلاحيات دور مدير النظام مقصور على المدير الأعلى أو المطور.",
                status.HTTP_403_FORBIDDEN,
            )
        policy = RolePolicy.objects.filter(role_key=role_key).first()
        if policy is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)

        payload = dict(request.data)
        if "permissions" in payload and "defaultCapabilities" not in payload:
            payload["defaultCapabilities"] = payload["permissions"]
        serializer = RolePolicySerializer(policy, data=payload, partial=True)
        serializer.is_valid(raise_exception=True)
        new_caps = serializer.validated_data.get(
            "default_capabilities_json", policy.default_capabilities_json
        )
        ceiling = ROLE_CAPABILITY_CEILINGS.get(role_key, frozenset())
        exceeded = [cap for cap in new_caps if cap not in ceiling]
        if exceeded:
            return error_response(
                "ROLE_CEILING_EXCEEDED",
                "غير مصرح: الصلاحيات المطلوبة تتجاوز السقف الأقصى المسموح به لهذا الدور.",
                status.HTTP_400_BAD_REQUEST,
            )
        policy.default_capabilities_json = new_caps
        policy.updated_at = timezone.now()
        policy.updated_by = str(request.user.id)
        policy.save(update_fields=["default_capabilities_json", "updated_at", "updated_by"])
        return success_response({"role": RolePolicySerializer(policy).data})


class UserOverrideDetailView(APIView):
    """GET / PUT / PATCH /api/admin/permissions/users/<user_id>."""

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated(), has_capability("permissions.view_matrix")()]
        return [IsAuthenticated(), has_capability("permissions.configure_users")()]

    def get(self, request: Request, user_id: int):
        target = get_visible_user_or_none(request.user, user_id)
        if target is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        override, _ = UserPermissionOverride.objects.get_or_create(
            user=target,
            defaults={"granted_capabilities_json": [], "denied_capabilities_json": []},
        )
        return success_response({"override": UserPermissionOverrideSerializer(override).data})

    def put(self, request: Request, user_id: int):
        return self._update(request, user_id)

    def patch(self, request: Request, user_id: int):
        return self._update(request, user_id)

    def delete(self, request: Request, user_id: int):
        target = get_visible_user_or_none(request.user, user_id)
        if target is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        decision = evaluate_permission(request.user, "permissions.configure_users", target_user=target)
        if not decision.granted:
            return error_response(
                decision.invariant_code or "PERMISSION_DENIED",
                decision.reason_ar,
                status.HTTP_403_FORBIDDEN,
            )
        UserPermissionOverride.objects.filter(user=target).delete()
        return success_response({"success": True, "message": "تم إعادة تعيين صلاحيات المستخدم للوضع الافتراضي."})

    def _update(self, request: Request, user_id: int):
        target = get_visible_user_or_none(request.user, user_id)
        if target is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)

        decision = evaluate_permission(request.user, "permissions.configure_users", target_user=target)
        if not decision.granted:
            return error_response(
                decision.invariant_code or "PERMISSION_DENIED",
                decision.reason_ar,
                status.HTTP_403_FORBIDDEN,
            )

        serializer = UserPermissionOverrideSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        granted = serializer.validated_data.get("granted_capabilities_json", [])
        denied = serializer.validated_data.get("denied_capabilities_json", [])

        ceiling = ROLE_CAPABILITY_CEILINGS.get(target.role_id, frozenset())
        exceeded = [cap for cap in granted if cap not in ceiling]
        if exceeded:
            return error_response(
                "ROLE_CEILING_EXCEEDED",
                "غير مصرح: الصلاحيات المطلوبة تتجاوز السقف الأقصى لدور المستخدم.",
                status.HTTP_400_BAD_REQUEST,
            )

        override, _ = UserPermissionOverride.objects.update_or_create(
            user=target,
            defaults={
                "granted_capabilities_json": list(dict.fromkeys(granted)),
                "denied_capabilities_json": list(dict.fromkeys(denied)),
            },
        )
        return success_response({"override": UserPermissionOverrideSerializer(override).data})


class EffectivePermissionsView(APIView):
    """GET /api/admin/permissions/effective/<user_id>."""

    permission_classes = [IsAuthenticated, has_capability("permissions.view_matrix")]

    def get(self, request: Request, user_id: int):
        target = get_visible_user_or_none(request.user, user_id)
        if target is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)

        matrix = {}
        for cap in ALL_CAPABILITIES:
            res = evaluate_permission(target, cap)
            matrix[cap] = {
                "granted": res.granted,
                "executionMode": res.execution_mode,
                "source": res.source,
            }
        return success_response({"userId": target.id, "role": target.role_id, "effective": matrix})


class DelegatedAuthorityView(APIView):
    """GET / POST / DELETE /api/admin/permissions/governance/delegation/<user_id>."""

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated(), has_capability("permissions.view_matrix")()]
        return [IsAuthenticated(), has_capability("permissions.manage_delegation")()]

    def get(self, request: Request, user_id: int):
        target = get_visible_user_or_none(request.user, user_id)
        if target is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        qs = DelegatedAuthority.objects.filter(user=target, is_active=True).order_by("id")
        return success_response(
            {
                "userId": str(target.id),
                "enabled": qs.exists(),
                "delegations": DelegatedAuthoritySerializer(qs, many=True).data,
            }
        )

    def post(self, request: Request, user_id: int):
        target = get_visible_user_or_none(request.user, user_id)
        if target is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)

        if target.role_id != "assistant_admin":
            return error_response(
                "INVALID_DELEGATION_TARGET",
                "تفويض الصلاحيات المباشرة ينطبق على حسابات مساعد مدير النظام فقط.",
                status.HTTP_400_BAD_REQUEST,
            )

        serializer = DelegatedAuthoritySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        capability_key = serializer.validated_data["capability_key"]

        if capability_key in IMMUTABLE_BLOCKED_FOR_ASSISTANT_ADMIN:
            return error_response(
                "IMMUTABLE_BLOCKED_FOR_ASSISTANT_ADMIN",
                "هذه الصلاحية محجوبة بصورة قطعية عن مساعد مدير النظام.",
                status.HTTP_403_FORBIDDEN,
            )

        delegation, created = DelegatedAuthority.objects.get_or_create(
            user=target,
            capability_key=capability_key,
            is_active=True,
            defaults={
                "granted_by_user": request.user,
                "granted_at": timezone.now(),
            },
        )
        return success_response(
            {"delegation": DelegatedAuthoritySerializer(delegation).data},
            status_code=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request: Request, user_id: int):
        target = get_visible_user_or_none(request.user, user_id)
        if target is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)

        capability_key = request.data.get("capabilityKey") or request.query_params.get("capabilityKey")
        if not capability_key:
            return error_response("VALIDATION_ERROR", "يرجى تحديد capabilityKey.", status.HTTP_400_BAD_REQUEST)

        updated = DelegatedAuthority.objects.filter(
            user=target, capability_key=capability_key, is_active=True
        ).update(is_active=False)
        if not updated:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        return success_response({"revoked": True, "capabilityKey": capability_key})

