"""Local / network Windows storage abstraction for MetroLMS media (D-MEDIA-01, CL-02)."""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
import re
from typing import Iterator
import uuid

from django.conf import settings
from django.utils import timezone


class MediaStorageError(Exception):
    """Raised on storage validation, magic-byte mismatch, size overflow, or path traversal."""

    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


ALLOWED_MEDIA_SPECS: dict[str, dict[str, object]] = {
    "video/mp4": {"ext": ".mp4", "max_mb_env": "METROLMS_MAX_VIDEO_MB", "default_mb": 500},
    "application/pdf": {"ext": ".pdf", "max_mb_env": "METROLMS_MAX_DOC_MB", "default_mb": 50},
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
        "ext": ".docx",
        "max_mb_env": "METROLMS_MAX_DOC_MB",
        "default_mb": 50,
    },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
        "ext": ".pptx",
        "max_mb_env": "METROLMS_MAX_DOC_MB",
        "default_mb": 50,
    },
    "image/png": {"ext": ".png", "max_mb_env": "METROLMS_MAX_IMAGE_MB", "default_mb": 10},
    "image/jpeg": {"ext": ".jpg", "max_mb_env": "METROLMS_MAX_IMAGE_MB", "default_mb": 10},
}

_SAFE_KEY_RE = re.compile(
    r"\A(?:assets/\d{4}/\d{2}|courses/course_\d+(?:/cover|/chapter_[A-Za-z0-9_-]{1,64})?|groups/group_\d+(?:/folder_[A-Za-z0-9_-]{1,64})?)/[a-f0-9]{32}\.[a-z0-9]+\Z",
    re.ASCII,
)
_SCOPE_PREFIX_RE = re.compile(
    r"\A(?:courses/course_\d+(?:/cover|/chapter_[A-Za-z0-9_-]{1,64})?|groups/group_\d+(?:/folder_[A-Za-z0-9_-]{1,64})?)\Z",
    re.ASCII,
)


def validate_magic_bytes(mime_type: str, header: bytes) -> bool:
    """Verify binary signature (magic bytes) matches the allowed MIME type."""
    if mime_type == "application/pdf":
        return header.startswith(b"%PDF-")
    if mime_type == "video/mp4":
        return len(header) >= 12 and header[4:8] == b"ftyp"
    if mime_type in {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }:
        return header.startswith(b"PK\x03\x04")
    if mime_type == "image/png":
        return header.startswith(b"\x89PNG\r\n\x1a\n")
    if mime_type == "image/jpeg":
        return header.startswith(b"\xff\xd8\xff")
    return False


class LocalMediaStorage:
    """Storage abstraction writing atomically under settings.MEDIA_ROOT."""

    def __init__(self, root_path: Path | str | None = None) -> None:
        self.root = Path(root_path or settings.MEDIA_ROOT).resolve()

    def resolve_safe_path(self, storage_key: str) -> Path:
        """Resolve storage_key strictly inside MEDIA_ROOT, blocking path traversal."""
        if not storage_key or not _SAFE_KEY_RE.match(storage_key):
            raise MediaStorageError("INVALID_STORAGE_KEY", "مفتاح التخزين غير صالح.", 400)
        candidate = (self.root / storage_key).resolve()
        if not candidate.is_relative_to(self.root):
            raise MediaStorageError("PATH_TRAVERSAL_BLOCKED", "مسار التخزين غير مصرح به.", 403)
        return candidate

    def save_uploaded_file(
        self,
        uploaded_file,
        mime_type: str,
        *,
        scope_prefix: str | None = None,
    ) -> tuple[str, int, str]:
        """Validate MIME, magic bytes, size limit, compute SHA-256, and store atomically."""
        spec = ALLOWED_MEDIA_SPECS.get(mime_type)
        if spec is None:
            raise MediaStorageError("UNSUPPORTED_MEDIA_TYPE", "نوع الملف غير مدعوم.", 415)

        max_mb = int(os.environ.get(str(spec["max_mb_env"]), str(spec["default_mb"])))
        max_bytes = max_mb * 1024 * 1024

        staging_dir = self.root / "staging"
        staging_dir.mkdir(parents=True, exist_ok=True)
        temp_path = staging_dir / f"{uuid.uuid4().hex}.tmp"

        sha256 = hashlib.sha256()
        total_bytes = 0
        header_buf = b""

        try:
            with temp_path.open("wb") as dst:
                for chunk in uploaded_file.chunks(chunk_size=1024 * 1024):
                    if not chunk:
                        continue
                    if len(header_buf) < 64:
                        header_buf += chunk[: 64 - len(header_buf)]
                    total_bytes += len(chunk)
                    if total_bytes > max_bytes:
                        raise MediaStorageError(
                            "FILE_TOO_LARGE",
                            f"حجم الملف يتجاوز الحد الأقصى المسموح ({max_mb} ميجابايت).",
                            413,
                        )
                    sha256.update(chunk)
                    dst.write(chunk)

            if total_bytes == 0 or not validate_magic_bytes(mime_type, header_buf):
                raise MediaStorageError(
                    "INVALID_FILE_SIGNATURE",
                    "محتوى الملف لا يطابق نوع الملف المحدد.",
                    400,
                )

            now = timezone.now()
            ext = str(spec["ext"])
            if scope_prefix and _SCOPE_PREFIX_RE.match(scope_prefix):
                storage_key = f"{scope_prefix}/{uuid.uuid4().hex}{ext}"
            else:
                storage_key = f"assets/{now:%Y}/{now:%m}/{uuid.uuid4().hex}{ext}"
            final_path = self.resolve_safe_path(storage_key)
            final_path.parent.mkdir(parents=True, exist_ok=True)
            os.replace(temp_path, final_path)
            return storage_key, total_bytes, sha256.hexdigest()
        except Exception:
            if temp_path.exists():
                temp_path.unlink(missing_ok=True)
            raise

    def delete_stored_file(self, storage_key: str) -> None:
        """Physically delete an unreferenced file after dependency checks pass."""
        target = self.resolve_safe_path(storage_key)
        if target.exists():
            target.unlink()

    def open_range_stream(
        self,
        storage_key: str,
        start: int,
        end: int,
        chunk_size: int = 262144,
    ) -> Iterator[bytes]:
        """Yield file bytes for inclusive range [start, end] without loading full file into RAM."""
        target = self.resolve_safe_path(storage_key)
        if not target.is_file():
            raise MediaStorageError("ASSET_BINARY_MISSING", "ملف الوسائط غير موجود على وحدة التخزين.", 404)

        remaining = (end - start) + 1
        with target.open("rb") as fh:
            fh.seek(start)
            while remaining > 0:
                to_read = min(chunk_size, remaining)
                data = fh.read(to_read)
                if not data:
                    break
                remaining -= len(data)
                yield data

