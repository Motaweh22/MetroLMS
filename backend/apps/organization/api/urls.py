"""URL routes for apps.organization."""
from django.urls import path

from apps.organization.api.views.org import (
    CatalogDependenciesView,
    CatalogResolveDependenciesView,
    DepartmentDetailView,
    DepartmentListView,
    DepartmentTrackDetailView,
    DepartmentTrackListView,
    JobTitleDetailView,
    JobTitleListView,
    LeadershipTitleDetailView,
    LeadershipTitleListView,
    MaritalStatusListView,
    MetroLineDetailView,
    MetroLineListView,
    MilitaryStatusListView,
    UserHistoricalTrainingView,
    UserOrganizationAssignmentView,
)

urlpatterns = [
    path("admin/department-tracks", DepartmentTrackListView.as_view(), name="department-tracks-list"),
    path(
        "admin/department-tracks/<str:department_code>",
        DepartmentTrackDetailView.as_view(),
        name="department-tracks-detail",
    ),
    path("admin/organization/departments", DepartmentListView.as_view(), name="org-departments"),
    path("admin/organization/departments/<int:item_id>", DepartmentDetailView.as_view(), name="org-department-detail"),
    path("admin/organization/job-titles", JobTitleListView.as_view(), name="org-job-titles"),
    path("admin/organization/job-titles/<int:item_id>", JobTitleDetailView.as_view(), name="org-job-title-detail"),
    path("admin/organization/metro-lines", MetroLineListView.as_view(), name="org-metro-lines"),
    path("admin/organization/metro-lines/<int:item_id>", MetroLineDetailView.as_view(), name="org-metro-line-detail"),
    path("admin/organization/leadership-titles", LeadershipTitleListView.as_view(), name="org-leadership-titles"),
    path(
        "admin/organization/leadership-titles/<int:item_id>",
        LeadershipTitleDetailView.as_view(),
        name="org-leadership-title-detail",
    ),
    path("admin/organization/marital-statuses", MaritalStatusListView.as_view(), name="org-marital-statuses"),
    path("admin/organization/military-statuses", MilitaryStatusListView.as_view(), name="org-military-statuses"),
    path(
        "admin/organization/<str:catalog>/<int:item_id>/dependencies",
        CatalogDependenciesView.as_view(),
        name="org-catalog-dependencies",
    ),
    path(
        "admin/organization/<str:catalog>/<int:item_id>/resolve-dependencies",
        CatalogResolveDependenciesView.as_view(),
        name="org-catalog-resolve-dependencies",
    ),
    path("admin/users/<int:user_id>/organization", UserOrganizationAssignmentView.as_view(), name="user-org-assign"),
    path(
        "admin/users/<int:user_id>/historical-training",
        UserHistoricalTrainingView.as_view(),
        name="user-historical-training",
    ),
]
