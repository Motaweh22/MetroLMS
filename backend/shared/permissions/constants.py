"""Canonical 6-tier MetroLMS roles, capabilities, ceilings, and defaults."""
from __future__ import annotations

CANONICAL_ROLES: tuple[str, ...] = (
    "developer",
    "super_admin",
    "admin",
    "assistant_admin",
    "lecturer",
    "trainee",
)

READ_ONLY_CAPABILITIES: frozenset[str] = frozenset(
    {
        "users.view_directory",
        "users.view_transcript",
        "users.export_roster",
        "learning.access_assigned",
        "permissions.view_matrix",
        "audit.view_system_logs",
    }
)

ALL_CAPABILITIES: tuple[str, ...] = (
    "users.view_directory",
    "users.view_transcript",
    "users.export_roster",
    "users.create",
    "users.change_role",
    "users.change_status",
    "users.delete",
    "groups.create",
    "groups.edit_config",
    "groups.archive",
    "groups.manage_members",
    "groups.generate_qr",
    "groups.review_join_requests",
    "materials.manage_folders",
    "materials.upload_files",
    "materials.delete_files",
    "materials.manage_meetings",
    "materials.manage_references",
    "courses.create",
    "courses.edit_metadata",
    "courses.publish",
    "courses.edit_curriculum",
    "courses.upload_lectures",
    "courses.delete_lectures",
    "reviews.submit_course",
    "reviews.decide_course",
    "learning.access_assigned",
    "learning.self_enroll",
    "permissions.view_matrix",
    "permissions.configure_roles",
    "permissions.configure_users",
    "permissions.manage_delegation",
    "permissions.configure_departments",
    "audit.view_system_logs",
    "approvals.submit_request",
    "approvals.decide_request",
    "comments.moderate",
    "comments.delete",
    "comments.ignore_report",
    "comments.toggle",
)

GROUP_SCOPED_CAPABILITIES: frozenset[str] = frozenset(
    {
        "groups.edit_config",
        "groups.manage_members",
        "groups.generate_qr",
        "groups.review_join_requests",
        "materials.manage_folders",
        "materials.upload_files",
        "materials.delete_files",
        "materials.manage_meetings",
        "materials.manage_references",
    }
)

IMMUTABLE_BLOCKED_FOR_ASSISTANT_ADMIN: frozenset[str] = frozenset(
    {
        "permissions.configure_roles",
        "permissions.configure_users",
        "permissions.manage_delegation",
        "permissions.configure_departments",
        "approvals.decide_request",
        "users.change_role",
        "courses.publish",
        "reviews.decide_course",
    }
)

_ADMIN_CORE: frozenset[str] = frozenset(ALL_CAPABILITIES) - frozenset(
    {"learning.self_enroll", "approvals.submit_request"}
)

ROLE_CAPABILITY_CEILINGS: dict[str, frozenset[str]] = {
    "developer": frozenset(ALL_CAPABILITIES),
    "super_admin": _ADMIN_CORE,
    "admin": _ADMIN_CORE,
    "assistant_admin": frozenset(ALL_CAPABILITIES)
    - IMMUTABLE_BLOCKED_FOR_ASSISTANT_ADMIN
    - frozenset({"learning.self_enroll"}),
    "lecturer": frozenset(
        {
            "courses.create",
            "courses.edit_metadata",
            "courses.edit_curriculum",
            "courses.upload_lectures",
            "courses.delete_lectures",
            "reviews.submit_course",
            "comments.moderate",
            "groups.manage_members",
            "materials.manage_folders",
            "materials.upload_files",
            "materials.delete_files",
            "materials.manage_meetings",
            "materials.manage_references",
            "learning.access_assigned",
        }
    ),
    "trainee": frozenset(
        {
            "learning.access_assigned",
            "learning.self_enroll",
        }
    ),
}

ROLE_DEFAULT_CAPABILITIES: dict[str, frozenset[str]] = {
    "developer": _ADMIN_CORE,
    "super_admin": _ADMIN_CORE,
    "admin": _ADMIN_CORE,
    "assistant_admin": frozenset(
        {
            "users.view_directory",
            "users.view_transcript",
            "users.export_roster",
            "users.create",
            "users.change_status",
            "users.delete",
            "groups.create",
            "groups.edit_config",
            "groups.archive",
            "groups.manage_members",
            "groups.generate_qr",
            "groups.review_join_requests",
            "materials.manage_folders",
            "materials.upload_files",
            "materials.delete_files",
            "materials.manage_meetings",
            "materials.manage_references",
            "permissions.view_matrix",
            "audit.view_system_logs",
            "approvals.submit_request",
            "comments.moderate",
            "comments.delete",
            "comments.ignore_report",
            "comments.toggle",
        }
    ),
    "lecturer": frozenset(
        {
            "courses.create",
            "courses.edit_metadata",
            "courses.edit_curriculum",
            "courses.upload_lectures",
            "courses.delete_lectures",
            "reviews.submit_course",
            "comments.moderate",
            "learning.access_assigned",
        }
    ),
    "trainee": frozenset(
        {
            "learning.access_assigned",
            "learning.self_enroll",
        }
    ),
}

