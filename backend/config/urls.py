"""Root URL configuration for MetroLMS Backend (Preserves /api/... contract)."""
from django.urls import include, path

urlpatterns = [
    path("api/", include("apps.identity.api.urls")),
    path("api/", include("apps.organization.api.urls")),
    path("api/", include("apps.governance.api.urls")),
    path("api/", include("apps.courses.api.urls")),
    path("api/", include("apps.media.api.urls")),
    path("api/", include("apps.groups.api.urls")),
    path("api/", include("apps.learning.api.urls")),
    path("api/", include("apps.communications.api.urls")),
]
