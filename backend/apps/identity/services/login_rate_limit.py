"""Thread-safe login rate limiting and temporary lockout service (per-phone & per-IP)."""
from __future__ import annotations

import hashlib
import ipaddress
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


def _parse_ip(raw_ip: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    cleaned = str(raw_ip or "").strip()
    if not cleaned:
        return None
    if cleaned.startswith("[") and "]" in cleaned:
        cleaned = cleaned[1 : cleaned.index("]")]
    elif cleaned.count(":") == 1 and "." in cleaned:
        # Handle IPv4:port format if supplied by a proxy
        cleaned = cleaned.split(":", 1)[0]
    try:
        return ipaddress.ip_address(cleaned)
    except ValueError:
        return None


def _is_trusted_proxy_ip(ip_obj: ipaddress.IPv4Address | ipaddress.IPv6Address, trusted_entries: list[str] | tuple[str, ...]) -> bool:
    for entry in trusted_entries:
        raw = str(entry or "").strip()
        if not raw:
            continue
        try:
            net = ipaddress.ip_network(raw, strict=False)
        except ValueError:
            continue
        if ip_obj in net:
            return True
    return False


def get_client_ip(request: HttpRequest) -> str:
    """Derive canonical client IP without trusting arbitrary X-Forwarded-For headers (BUG-016)."""
    remote_raw = str(request.META.get("REMOTE_ADDR") or "").strip()
    remote_ip = _parse_ip(remote_raw)
    trusted_proxies = getattr(settings, "METROLMS_TRUSTED_PROXY_IPS", []) or []

    # Fail-closed: only inspect X-Forwarded-For when immediate socket peer is a configured trusted proxy.
    if remote_ip is not None and trusted_proxies and _is_trusted_proxy_ip(remote_ip, trusted_proxies):
        xff = str(request.META.get("HTTP_X_FORWARDED_FOR") or "").strip()
        if xff:
            parts = [p.strip() for p in xff.split(",") if p.strip()]
            # Walk right-to-left skipping trusted proxies; the first untrusted valid IP is the real client.
            for candidate in reversed(parts):
                parsed = _parse_ip(candidate)
                if parsed is None:
                    break
                if not _is_trusted_proxy_ip(parsed, trusted_proxies):
                    return str(parsed)[:64]

    if remote_ip is not None:
        return str(remote_ip)[:64]
    return (remote_raw or "unknown")[:64]


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
