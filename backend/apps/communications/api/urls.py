"""URL routes for apps.communications."""
from django.urls import path

from apps.communications.api.views.communications import (
    AdminUserWhatsAppVisibilityView,
    CourseWhatsAppContactDeleteView,
    CourseWhatsAppContactsView,
    NotificationMarkReadView,
    NotificationsListView,
    NotificationsReadAllView,
    PublicSupportContactsView,
)

urlpatterns = [
    path("notifications", NotificationsListView.as_view(), name="notifications-list"),
    path("notifications/<int:notification_id>/read", NotificationMarkReadView.as_view(), name="notifications-read"),
    path("notifications/read-all", NotificationsReadAllView.as_view(), name="notifications-read-all"),
    path("notifications/mark-all-read", NotificationsReadAllView.as_view(), name="notifications-mark-all-read"),
    path(
        "courses/<int:course_id>/whatsapp-contacts",
        CourseWhatsAppContactsView.as_view(),
        name="course-whatsapp-contacts",
    ),
    path(
        "courses/<int:course_id>/whatsapp-contacts/<int:contact_id>",
        CourseWhatsAppContactDeleteView.as_view(),
        name="course-whatsapp-contact-delete",
    ),
    path(
        "admin/users/<int:user_id>/whatsapp-visibility",
        AdminUserWhatsAppVisibilityView.as_view(),
        name="admin-user-whatsapp-visibility",
    ),
    path("public/support-contacts", PublicSupportContactsView.as_view(), name="public-support-contacts"),
]
