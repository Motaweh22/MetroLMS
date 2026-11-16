"""Shared 6-tier RBAC permission engine and DRF integration exports."""
from .constants import (
    ALL_CAPABILITIES,
    CANONICAL_ROLES,
    GROUP_SCOPED_CAPABILITIES,
    IMMUTABLE_BLOCKED_FOR_ASSISTANT_ADMIN,
    READ_ONLY_CAPABILITIES,
    ROLE_CAPABILITY_CEILINGS,
    ROLE_DEFAULT_CAPABILITIES,
)
from .drf_permissions import get_visible_user_or_none, has_capability
from .engine import (
    PermissionDecision,
    evaluate_permission,
    evaluate_protected_invariant,
    is_developer_hidden,
)

__all__ = [
    "ALL_CAPABILITIES",
    "CANONICAL_ROLES",
    "GROUP_SCOPED_CAPABILITIES",
    "IMMUTABLE_BLOCKED_FOR_ASSISTANT_ADMIN",
    "PermissionDecision",
    "READ_ONLY_CAPABILITIES",
    "ROLE_CAPABILITY_CEILINGS",
    "ROLE_DEFAULT_CAPABILITIES",
    "evaluate_permission",
    "evaluate_protected_invariant",
    "get_visible_user_or_none",
    "has_capability",
    "is_developer_hidden",
]

