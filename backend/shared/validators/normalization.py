"""Centralized OR-DB-04 pre-validation normalization and domain validators.

Enforces MetroLMS OR-DB-04 field-scoped normalization rules without blanket
NFKC/NFKD, Arabic character substitution, or digit conversion.
"""
from __future__ import annotations

import datetime
import re
import unicodedata
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from django.core.exceptions import ValidationError

CAIRO_TZ = ZoneInfo("Africa/Cairo")
EGYPT_PHONE_RE = re.compile(r"\A\+201[0125][0-9]{8}\Z", re.ASCII)
NATIONAL_ID_RE = re.compile(r"\A[0-9]{14}\Z", re.ASCII)
MIME_TYPE_RE = re.compile(r"\A[a-z0-9][a-z0-9!#$&^_.+-]*/[a-z0-9][a-z0-9!#$&^_.+-]*\Z", re.ASCII)


def normalize_nfc_stripped(value: str) -> str:
    """Apply Unicode NFC and strip leading/trailing whitespace for short display fields."""
    return unicodedata.normalize("NFC", value).strip()


def normalize_nfc_preserve_whitespace(value: str) -> str:
    """Apply Unicode NFC while preserving leading/trailing whitespace (OR-DB-04 Condition A)."""
    return unicodedata.normalize("NFC", value)


def normalize_email_optional(value: str | None) -> str | None:
    """Strip email, convert empty/whitespace-only to None, and lowercase domain only (OD-PF-01)."""
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    if "@" not in stripped:
        return stripped
    local_part, _, domain_part = stripped.rpartition("@")
    return f"{local_part}@{domain_part.lower()}"


def normalize_phone_e164(value: str) -> str:
    """Strip whitespace only; enforce canonical Egyptian +201[0125]XXXXXXXX."""
    return value.strip()


def normalize_national_id(value: str) -> str:
    """Strip whitespace only; preserve leading zeros."""
    return value.strip()


def normalize_optional_url(value: str | None) -> str | None:
    """Strip URL and normalize empty/whitespace-only to None."""
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def normalize_mime_type(value: str) -> str:
    """Strip whitespace and ASCII-lowercase type/subtype (no Content-Type parameters)."""
    return value.strip().lower()


def validate_egypt_phone_e164(value: str) -> None:
    """Validate canonical Egyptian mobile E.164 format (+201[0125] + 8 ASCII digits)."""
    if not EGYPT_PHONE_RE.match(value):
        raise ValidationError("Phone number must be a valid Egyptian E.164 number (+201[0125]XXXXXXXX).")


def validate_national_id(value: str) -> None:
    """Validate 14 ASCII digits for Egyptian National ID."""
    if not NATIONAL_ID_RE.match(value):
        raise ValidationError("National ID must consist of exactly 14 ASCII digits.")


def validate_mime_type(value: str) -> None:
    """Validate type/subtype format without parameters."""
    if not MIME_TYPE_RE.match(value):
        raise ValidationError("MIME type must be a valid 'type/subtype' value without parameters.")


def validate_non_empty_text(value: str) -> None:
    """Reject empty or whitespace-only text."""
    if not value or not value.strip():
        raise ValidationError("This field cannot be empty or whitespace-only.")


def validate_cairo_past_date(value: datetime.date) -> None:
    """Validate date is strictly before today's calendar date in Africa/Cairo."""
    cairo_today = datetime.datetime.now(CAIRO_TZ).date()
    if value >= cairo_today:
        raise ValidationError("Date of birth must be before today's date in Africa/Cairo.")


def validate_https_url(value: str | None) -> None:
    """Validate that a non-null URL uses the https scheme and includes a network host."""
    if value is None:
        return
    parsed = urlparse(value)
    if parsed.scheme.lower() != "https" or not parsed.netloc:
        raise ValidationError("URL must be a valid HTTPS URL.")

