"""Production Django settings for MetroLMS (Windows Server 2022)."""
import os
from .base import *  # noqa: F401, F403

DEBUG = False
SESSION_COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", "True").lower() in ("1", "true", "yes")
CSRF_COOKIE_SECURE = os.environ.get("CSRF_COOKIE_SECURE", "True").lower() in ("1", "true", "yes")
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

# Reverse proxy support (IIS ARR / URL Rewrite terminating TLS)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
