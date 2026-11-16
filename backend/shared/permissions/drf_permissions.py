"""DRF permission classes and INV-R8 404 helper."""
from __future__ import annotations

from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from apps.identity.models import User

from .engine import evaluate_permission, is_developer_hidden


def has_capability(capability: str) -> type[BasePermission]:
    """Factory returning a DRF BasePermission checking a single MetroLMS capability."""

    class CapabilityPermission(BasePermission):
        message = "ليس لديك صلاحية للوصول إلى هذا المحتوى."

        def has_permission(self, request: Request, view: object) -> bool:
            user = getattr(request, "user", None)
            if not user or not getattr(user, "is_authenticated", False):
                return False
            decision = evaluate_permission(user, capability)
            self.message = decision.reason_ar
            return decision.granted and decision.execution_mode == "direct"

    CapabilityPermission.__name__ = f"HasCapability[{capability}]"
    return CapabilityPermission


def get_visible_user_or_none(actor: User, user_id: int) -> User | None:
    """Lookup target user enforcing INV-R8 (non-Developers receive None -> 404 for Developer)."""
    target = User.objects.select_related("role").filter(pk=user_id).first()
    if target is None or is_developer_hidden(actor, target):
        return None
    return target

