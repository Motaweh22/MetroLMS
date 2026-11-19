"""Base Django settings for MetroLMS (Foundation Scaffold)."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent


def _load_dotenv(env_path: Path) -> None:
    """Load key=value pairs from .env if present without overriding existing OS env vars."""
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)


_load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-placeholder-key")
DEBUG = os.environ.get("DJANGO_DEBUG", "False").lower() in ("1", "true", "yes")
ALLOWED_HOSTS = [
    h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()
]

AUTH_USER_MODEL = "identity.User"

DJANGO_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
]

FEATURE_APPS = [
    "apps.identity.apps.IdentityConfig",
    "apps.organization.apps.OrganizationConfig",
    "apps.governance.apps.GovernanceConfig",
    "apps.courses.apps.CoursesConfig",
    "apps.media.apps.MediaConfig",
    "apps.groups.apps.GroupsConfig",
    "apps.learning.apps.LearningConfig",
    "apps.communications.apps.CommunicationsConfig",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + FEATURE_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Optional unified single-port serving (for Docker / single-process deployments)
METROLMS_SERVE_FRONTEND = os.environ.get("METROLMS_SERVE_FRONTEND", "False").lower() in ("1", "true", "yes")
FRONTEND_DIST_DIR = Path(os.environ.get("METROLMS_FRONTEND_DIST_DIR", str(BASE_DIR.parent / "frontend" / "dist")))
if METROLMS_SERVE_FRONTEND:
    MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")
    if FRONTEND_DIST_DIR.is_dir():
        WHITENOISE_ROOT = FRONTEND_DIST_DIR

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# Database configuration (D-DB-01: Microsoft SQL Server 2022 target; local SQL Server 2025 compat 160)
_force_trusted = os.environ.get("METROLMS_FORCE_TRUSTED_CONNECTION", "").lower() in ("1", "true", "yes")
_db_user = "" if _force_trusted else os.environ.get("DB_USER", "")
_db_password = "" if _force_trusted else os.environ.get("DB_PASSWORD", "")
_db_trust_cert = os.environ.get("DB_TRUST_SERVER_CERTIFICATE", "False").lower() in ("1", "true", "yes")
_extra_params = [f"TrustServerCertificate={'yes' if _db_trust_cert else 'no'}"]
if not _db_user:
    _extra_params.append("Trusted_Connection=yes")

DATABASES = {
    "default": {
        "ENGINE": "mssql",
        "NAME": os.environ.get("DB_NAME", "MetroLMS"),
        "USER": _db_user,
        "PASSWORD": _db_password,
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": "" if os.environ.get("METROLMS_FORCE_NO_PORT") == "1" else os.environ.get("DB_PORT", ""),
        "OPTIONS": {
            "driver": os.environ.get("DB_ODBC_DRIVER", "ODBC Driver 18 for SQL Server"),
            "extra_params": ";".join(_extra_params),
        },
    }
}

# Temporal Policy (D-05 / WP55-PT-05): UTC canonical storage; Africa/Cairo via explicit ZoneInfo
USE_TZ = True
TIME_ZONE = "UTC"
LANGUAGE_CODE = "ar"
USE_I18N = True

# Authentication & Session Security (D-AUTH-01)
SESSION_ENGINE = "apps.identity.sessions"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_PATH = "/"
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_PATH = "/"
CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()
]

# Media Storage (D-MEDIA-01 / INV-DOM21-06)
MEDIA_ROOT = Path(os.environ.get("METROLMS_MEDIA_ROOT", r"D:\MetroLMSMedia"))
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

AUTHENTICATION_BACKENDS = [
    "apps.identity.services.auth_backend.PhoneE164Backend",
]

# DRF Baseline (Session-only auth; no JWT/Bearer in production)
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "EXCEPTION_HANDLER": "shared.api.exceptions.metrolms_exception_handler",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
