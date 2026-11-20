"""URL routes for apps.identity."""
from django.urls import path

from apps.identity.api.views.auth import (
    CsrfBootstrapView,
    LoginView,
    LogoutView,
    MeView,
)
from apps.identity.api.views.permissions import (
    DelegatedAuthorityView,
    EffectivePermissionsView,
    RolePolicyDetailView,
    RolePolicyListView,
    UserOverrideDetailView,
)
from apps.identity.api.views.users import (
    AdminUserDeleteView,
    AdminUserListView,
    AdminUserRoleView,
    AdminUserStatusView,
    AdminUserTranscriptView,
    ProfileView,
    PublicUserOverviewView,
)

urlpatterns = [
    path("auth/csrf", CsrfBootstrapView.as_view(), name="auth-csrf"),
    path("auth/login", LoginView.as_view(), name="auth-login"),
    path("auth/logout", LogoutView.as_view(), name="auth-logout"),
    path("auth/me", MeView.as_view(), name="auth-me"),
    path("admin/permissions/roles", RolePolicyListView.as_view(), name="permissions-roles"),
    path("admin/permissions/roles/<str:role_key>", RolePolicyDetailView.as_view(), name="permissions-role-detail"),
    path("admin/permissions/users/<int:user_id>", UserOverrideDetailView.as_view(), name="permissions-user-override"),
    path("admin/permissions/effective/<int:user_id>", EffectivePermissionsView.as_view(), name="permissions-effective"),
    path(
        "admin/permissions/governance/delegation/<int:user_id>",
        DelegatedAuthorityView.as_view(),
        name="permissions-delegation",
    ),
    path("profile", ProfileView.as_view(), name="user-profile"),
    path("users/<int:user_id>/overview", PublicUserOverviewView.as_view(), name="user-public-overview"),
    path("admin/users", AdminUserListView.as_view(), name="admin-user-list"),
    path("admin/users/<int:user_id>", AdminUserDeleteView.as_view(), name="admin-user-delete"),
    path("admin/users/<int:user_id>/role", AdminUserRoleView.as_view(), name="admin-user-role"),
    path("admin/users/<int:user_id>/status", AdminUserStatusView.as_view(), name="admin-user-status"),
    path("admin/users/<int:user_id>/transcript", AdminUserTranscriptView.as_view(), name="admin-user-transcript"),
]
