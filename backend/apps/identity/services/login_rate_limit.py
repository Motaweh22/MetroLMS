"""Thread-safe login rate limiting and temporary lockout service (per-phone & per-IP)."""
from __future__ import annotations

import hashlib
import math
import threading
import time

from django.conf import settings
from django.core.cache import cache
from django.http import HttpRequest

_LOCK = threading.Lock()

DEFAULT_MAX_ATTEMPTS = 5
DEFAULT_WINDOW_SECONDS = 900  # 15 minutes
DEFAULT_LOCKOUT_SECONDS = 300  # 5 minutes
DEFAULT_IP_MAX_ATTEMPTS = 30
DEFAULT_IP_WINDOW_SECONDS = 600  # 10 minutes


def _get_int_setting(name: str, default: int) -> int:
    val = getattr(settings, name, default)
    try:
        parsed = int(val)
        return parsed if parsed > 0 else default
    except (TypeError, ValueError):
        return default


def _hash_key(prefix: str, value: str) -> str:
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()[:24]
    return f"metrolms:auth:{prefix}:{digest}"


def get_client_ip(request: HttpRequest) -> str:
    """Extract client IP address safely, honoring X-Forwarded-For behind reverse proxies."""
    xff = str(request.META.get("HTTP_X_FORWARDED_FOR") or "").strip()
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first[:64]
    return str(request.META.get("REMOTE_ADDR") or "unknown").strip()[:64]


def format_arabic_wait_duration(seconds: int) -> str:
    """Format remaining wait time in natural Arabic."""
    total = max(1, int(math.ceil(seconds)))
    mins, secs = divmod(total, 60)
    if mins == 0:
        if secs == 1:
            return "ثانية واحدة"
        if secs == 2:
            return "ثانيتين"
        if 3 <= secs <= 10:
            return f"{secs} ثوانٍ"
        return f"{secs} ثانية"

    if mins == 1:
        min_text = "دقيقة واحدة"
    elif mins == 2:
        min_text = "دقيقتين"
    elif 3 <= mins <= 10:
        min_text = f"{mins} دقائق"
    else:
        min_text = f"{mins} دقيقة"

    if secs == 0:
        return min_text
    if secs == 1:
        sec_text = "ثانية واحدة"
    elif secs == 2:
        sec_text = "ثانيتين"
    elif 3 <= secs <= 10:
        sec_text = f"{secs} ثوانٍ"
    else:
        sec_text = f"{secs} ثانية"
    return f"{min_text} و{sec_text}"


def _active_lock_remaining(lock_key: str, now: float) -> int | None:
    lock_until = cache.get(lock_key)
    if lock_until is None:
        return None
    try:
        remaining = float(lock_until) - now
    except (TypeError, ValueError):
        cache.delete(lock_key)
        return None
    if remaining <= 0:
        cache.delete(lock_key)
        return None
    return max(1, int(math.ceil(remaining)))


def check_login_rate_limit(phone_e164: str, client_ip: str) -> int | None:
    """Return remaining lockout seconds if phone or IP is currently locked, else None."""
    if not getattr(settings, "LOGIN_RATE_LIMIT_ENABLED", True):
        return None
    now = time.time()
    phone_lock_key = _hash_key("lock_phone", phone_e164)
    ip_lock_key = _hash_key("lock_ip", client_ip)
    with _LOCK:
        phone_rem = _active_lock_remaining(phone_lock_key, now)
        ip_rem = _active_lock_remaining(ip_lock_key, now)
        if phone_rem is not None and ip_rem is not None:
            return max(phone_rem, ip_rem)
        return phone_rem if phone_rem is not None else ip_rem


def record_failed_login_attempt(phone_e164: str, client_ip: str) -> tuple[int | None, int]:
    """Record a failed attempt; returns (lockout_seconds_or_None, remaining_phone_attempts)."""
    max_attempts = _get_int_setting("LOGIN_RATE_LIMIT_MAX_ATTEMPTS", DEFAULT_MAX_ATTEMPTS)
    if not getattr(settings, "LOGIN_RATE_LIMIT_ENABLED", True):
        return None, max_attempts

    window_seconds = _get_int_setting("LOGIN_RATE_LIMIT_WINDOW_SECONDS", DEFAULT_WINDOW_SECONDS)
    lockout_seconds = _get_int_setting("LOGIN_RATE_LIMIT_LOCKOUT_SECONDS", DEFAULT_LOCKOUT_SECONDS)
    ip_max = _get_int_setting("LOGIN_RATE_LIMIT_IP_MAX_ATTEMPTS", DEFAULT_IP_MAX_ATTEMPTS)
    ip_window = _get_int_setting("LOGIN_RATE_LIMIT_IP_WINDOW_SECONDS", DEFAULT_IP_WINDOW_SECONDS)

    now = time.time()
    phone_attempts_key = _hash_key("attempts_phone", phone_e164)
    phone_lock_key = _hash_key("lock_phone", phone_e164)
    ip_attempts_key = _hash_key("attempts_ip", client_ip)
    ip_lock_key = _hash_key("lock_ip", client_ip)

    with _LOCK:
        # Check if already locked
        existing_rem = _active_lock_remaining(phone_lock_key, now) or _active_lock_remaining(ip_lock_key, now)
        if existing_rem is not None:
            return existing_rem, 0

        # Track per-phone failures
        raw_phone = cache.get(phone_attempts_key) or []
        phone_ts = [float(t) for t in raw_phone if (now - float(t)) < window_seconds]
        phone_ts.append(now)

        # Track per-IP failures
        raw_ip = cache.get(ip_attempts_key) or []
        ip_ts = [float(t) for t in raw_ip if (now - float(t)) < ip_window]
        ip_ts.append(now)

        locked_for: int | None = None
        if len(phone_ts) >= max_attempts:
            cache.set(phone_lock_key, now + lockout_seconds, timeout=lockout_seconds)
            cache.delete(phone_attempts_key)
            locked_for = lockout_seconds
            remaining_phone = 0
        else:
            cache.set(phone_attempts_key, phone_ts, timeout=window_seconds)
            remaining_phone = max(0, max_attempts - len(phone_ts))

        if len(ip_ts) >= ip_max:
            cache.set(ip_lock_key, now + lockout_seconds, timeout=lockout_seconds)
            cache.delete(ip_attempts_key)
            locked_for = lockout_seconds
        else:
            cache.set(ip_attempts_key, ip_ts, timeout=ip_window)

        return locked_for, remaining_phone


def clear_login_failures(phone_e164: str) -> None:
    """Clear per-phone failed login counter & lock after successful authentication."""
    with _LOCK:
        cache.delete(_hash_key("attempts_phone", phone_e164))
        cache.delete(_hash_key("lock_phone", phone_e164))
