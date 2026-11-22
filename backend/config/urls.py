"""Root URL configuration for MetroLMS Backend (Preserves /api/... contract)."""
from django.conf import settings
from django.http import HttpResponse, HttpResponseNotFound
from django.urls import include, path, re_path

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

if getattr(settings, "METROLMS_SERVE_FRONTEND", False):
    def _serve_spa_index(_request):
        index_path = settings.FRONTEND_DIST_DIR / "index.html"
        if not index_path.is_file():
            return HttpResponseNotFound("Frontend build (dist/index.html) not found.")
        resp = HttpResponse(index_path.read_bytes(), content_type="text/html; charset=utf-8")
        resp["Cache-Control"] = "no-cache"
        return resp

    urlpatterns += [
        re_path(r"^(?!api/).*$", _serve_spa_index, name="spa-index"),
    ]
