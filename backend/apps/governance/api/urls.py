"""URL routes for apps.governance."""
from django.urls import path

from apps.governance.api.views.governance import (
    ApprovalDecisionView,
    ApprovalListView,
    AuditLogDetailView,
    AuditLogListView,
)

urlpatterns = [
    path("admin/permissions/governance/approvals", ApprovalListView.as_view(), name="governance-approvals"),
    path(
        "admin/permissions/governance/approvals/<uuid:request_id>/decide",
        ApprovalDecisionView.as_view(),
        name="governance-approval-decide",
    ),
    path("admin/audit", AuditLogListView.as_view(), name="governance-audit"),
    path("admin/audit/<int:entry_id>", AuditLogDetailView.as_view(), name="governance-audit-detail"),
]
