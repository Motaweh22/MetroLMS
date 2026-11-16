"""6-step capability evaluation and INV-R1..INV-R10 security invariant engine."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from apps.identity.models import DelegatedAuthority, RolePolicy, User, UserPermissionOverride

from .constants import (
    GROUP_SCOPED_CAPABILITIES,
    IMMUTABLE_BLOCKED_FOR_ASSISTANT_ADMIN,
    READ_ONLY_CAPABILITIES,
    ROLE_CAPABILITY_CEILINGS,
    ROLE_DEFAULT_CAPABILITIES,
)

ExecutionMode = Literal["direct", "requires_approval", "denied"]


@dataclass(frozen=True)
class PermissionDecision:
    """Result of 6-step capability resolution."""

    granted: bool
    execution_mode: ExecutionMode
    source: str
    reason: str
    reason_ar: str
    violates_invariant: bool = False
    invariant_code: str | None = None


def is_developer_hidden(actor: User, target_user: User) -> bool:
    """INV-R8: Non-developer roles must never observe developer accounts (404 parity)."""
    return actor.role_id != "developer" and target_user.role_id == "developer"


def evaluate_protected_invariant(
    actor: User,
    capability: str,
    target_user: User | None = None,
    new_role: str | None = None,
) -> tuple[bool, str | None, str]:
    """Enforce INV-R1..INV-R8 immutable role protection invariants."""
    actor_role = actor.role_id

    # INV-R1 / INV-R2: Developer role cannot be created, assigned, promoted, or demoted via API
    if new_role == "developer":
        return (
            False,
            "INV-R2",
            "غير مصرح: لا يمكن تعيين أو ترقية أي حساب إلى دور المطور عبر واجهة النظام.",
        )

    if target_user is not None:
        target_role = target_user.role_id

        # INV-R3 / INV-R8: Developer account cannot be mutated via UI/API
        if target_role == "developer" and capability in {
            "users.delete",
            "users.change_status",
            "users.change_role",
            "permissions.configure_users",
        }:
            return (
                False,
                "INV-R3",
                "المورد المطلوب غير موجود أو تم نقله.",
            )

        # INV-R6: Anti-self-dealing for status/role/delete/permissions
        if actor.pk == target_user.pk and capability in {
            "users.delete",
            "users.change_status",
            "users.change_role",
            "permissions.configure_users",
        }:
            return (
                False,
                "INV-R6",
                "غير مصرح: لا يمكن للمستخدم تعديل حالة أو دور أو صلاحيات حسابه الشخصي.",
            )

        # INV-R6 (OD-01): Only developer can mutate super_admin; peer super_admin is read-only
        if target_role == "super_admin" and actor_role != "developer" and capability in {
            "users.delete",
            "users.change_status",
            "users.change_role",
            "permissions.configure_users",
        }:
            return (
                False,
                "INV-R6",
                "غير مصرح: حسابات مديري النظام الأعلى محمية ولا يمكن تعديلها إلا عبر المطور.",
            )

        # INV-R3 / INV-R6: Only super_admin or developer can create/mutate/delete admin accounts
        if (
            (target_role == "admin" or new_role == "admin" or new_role == "super_admin")
            and actor_role not in {"developer", "super_admin"}
            and capability in {"users.create", "users.change_role", "users.change_status", "users.delete"}
        ):
            return (
                False,
                "INV-R3",
                "غير مصرح: تعيين أو تعديل حسابات مديري النظام يقتصر على مدير النظام الأعلى أو المطور.",
            )

    if new_role in {"admin", "super_admin"} and actor_role not in {"developer", "super_admin"}:
        return (
            False,
            "INV-R3",
            "غير مصرح: تعيين هذا الدور يقتصر على مدير النظام الأعلى أو المطور.",
        )

    return (True, None, "")


def evaluate_permission(
    actor: User,
    capability: str,
    *,
    target_user: User | None = None,
    new_role: str | None = None,
    is_group_assigned: bool = True,
) -> PermissionDecision:
    """Execute the canonical 6-step permission evaluation pipeline."""
    actor_role = actor.role_id

    # Step 1: Immutable Protected Security Invariants
    allowed, inv_code, inv_msg = evaluate_protected_invariant(
        actor, capability, target_user=target_user, new_role=new_role
    )
    if not allowed:
        return PermissionDecision(
            granted=False,
            execution_mode="denied",
            source="invariant",
            reason=inv_code or "INVARIANT_VIOLATION",
            reason_ar=inv_msg,
            violates_invariant=True,
            invariant_code=inv_code,
        )

    # Step 2: Role Capability Ceiling + Immutable Assistant Admin Block
    if actor_role == "assistant_admin" and capability in IMMUTABLE_BLOCKED_FOR_ASSISTANT_ADMIN:
        return PermissionDecision(
            granted=False,
            execution_mode="denied",
            source="invariant",
            reason="IMMUTABLE_BLOCKED_FOR_ASSISTANT_ADMIN",
            reason_ar="هذه الصلاحية محجوبة بصورة قطعية عن مساعد مدير النظام وتتطلب رتبة مدير النظام الأصيل.",
            violates_invariant=True,
            invariant_code="INVARIANT_IMMUTABLE_BLOCKED",
        )

    override = UserPermissionOverride.objects.filter(user=actor).first()
    granted_list = set(override.granted_capabilities_json or []) if override else set()
    denied_list = set(override.denied_capabilities_json or []) if override else set()

    is_read_only = capability in READ_ONLY_CAPABILITIES
    is_admin_viewer = actor_role in {"developer", "super_admin", "admin", "assistant_admin"}
    ceiling = ROLE_CAPABILITY_CEILINGS.get(actor_role, frozenset())

    if capability not in ceiling:
        if not (is_read_only and is_admin_viewer) and not (
            actor_role == "assistant_admin" and capability in granted_list
        ):
            return PermissionDecision(
                granted=False,
                execution_mode="denied",
                source="role_default",
                reason="ROLE_CEILING_EXCEEDED",
                reason_ar="غير مصرح: هذه العملية تقع خارج السقف الأقصى المسموح لدور المستخدم.",
            )

    # Step 3: Individual UserPermissionOverride
    is_granted: bool | None = None
    source = "role_default"
    if capability in denied_list:
        return PermissionDecision(
            granted=False,
            execution_mode="denied",
            source="user_override",
            reason="USER_OVERRIDE_REVOKED",
            reason_ar="تم سحب هذه الصلاحية صراحة من حساب المستخدم عبر التخصيص الفردي.",
        )
    if capability in granted_list:
        is_granted = True
        source = "user_override"

    # Step 4: Configured RolePolicy defaults (falling back to fixed baseline)
    if is_granted is None and is_read_only and is_admin_viewer:
        is_granted = True
        source = "role_default"

    if is_granted is None:
        policy = RolePolicy.objects.filter(role_key=actor_role).first()
        if policy is not None:
            role_caps = set(policy.default_capabilities_json or [])
        else:
            role_caps = set(ROLE_DEFAULT_CAPABILITIES.get(actor_role, frozenset()))
        if capability in role_caps:
            is_granted = True
            source = "role_default"
        else:
            return PermissionDecision(
                granted=False,
                execution_mode="denied",
                source="role_default",
                reason="ROLE_DEFAULT_DENIED",
                reason_ar="غير مصرح: الصلاحية غير متضمنة في الدور الوظيفي للمستخدم.",
            )

    # Step 5: Resource / Group Scope Validation (INV-R7)
    if (
        capability in GROUP_SCOPED_CAPABILITIES
        and actor_role in {"assistant_admin", "lecturer"}
        and not is_group_assigned
    ):
        return PermissionDecision(
            granted=False,
            execution_mode="denied",
            source="group_scope",
            reason="UNASSIGNED_GROUP_CONTEXT",
            reason_ar="غير مصرح: المستخدم غير معيّن ضمن نطاق هذه المجموعة التدريبية.",
        )

    # Step 6: INV-R9 Approval / Delegation Policy for assistant_admin mutations
    if actor_role == "assistant_admin" and not is_read_only:
        has_delegation = DelegatedAuthority.objects.filter(
            user=actor,
            capability_key=capability,
            is_active=True,
        ).exists()
        if not has_delegation:
            return PermissionDecision(
                granted=True,
                execution_mode="requires_approval",
                source="delegation_policy",
                reason="APPROVAL_REQUIRED",
                reason_ar="تتطلب هذه العملية موافقة مدير النظام (PendingApproval).",
            )

    return PermissionDecision(
        granted=True,
        execution_mode="direct",
        source=source,
        reason="ALLOWED",
        reason_ar="مصرح بالتنفيذ المباشر.",
    )

