"""URL routes for apps.media."""
from django.urls import path

from apps.media.api.views.media import (
    MediaAssetDetailView,
    MediaAssetStreamView,
    MediaAssetUploadView,
    MediaReferenceDetailView,
    MediaReferenceLifecycleView,
    MediaReferenceListCreateView,
    MediaReferenceStreamView,
)

urlpatterns = [
    path("media/assets/upload", MediaAssetUploadView.as_view(), name="media-asset-upload"),
    path("media/assets/<int:asset_id>", MediaAssetDetailView.as_view(), name="media-asset-detail"),
    path("media/assets/<int:asset_id>/stream", MediaAssetStreamView.as_view(), name="media-asset-stream"),
    path("media/references", MediaReferenceListCreateView.as_view(), name="media-reference-create"),
    path("media/references/<int:ref_id>", MediaReferenceDetailView.as_view(), name="media-reference-detail"),
    path("media/references/<int:ref_id>/stream", MediaReferenceStreamView.as_view(), name="media-reference-stream"),
    path(
        "media/references/<int:ref_id>/<str:action>",
        MediaReferenceLifecycleView.as_view(),
        name="media-reference-lifecycle",
    ),
]
