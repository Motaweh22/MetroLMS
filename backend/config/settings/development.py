"""Development Django settings for MetroLMS."""
import os
from .base import *  # noqa: F401, F403

DEBUG = os.environ.get("DJANGO_DEBUG", "True").lower() in ("1", "true", "yes")
SESSION_COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", "False").lower() in ("1", "true", "yes")
CSRF_COOKIE_SECURE = os.environ.get("CSRF_COOKIE_SECURE", "False").lower() in ("1", "true", "yes")
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
