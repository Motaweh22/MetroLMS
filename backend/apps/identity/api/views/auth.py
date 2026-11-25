"""Authentication API views (/api/auth/csrf, /login, /logout, /me)."""
from __future__ import annotations

from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.identity.api.serializers.auth import AuthenticatedUserSerializer, LoginSerializer
from apps.identity.services.auth_service import (
    authenticate_with_phone,
    login_user_session,
    logout_user_session,
)
from apps.identity.services.login_rate_limit import (
    check_login_rate_limit,
    clear_login_failures,
    format_arabic_wait_duration,
    get_client_ip,
    record_failed_login_attempt,
)
from shared.api import error_response, success_response


class CsrfBootstrapView(APIView):
    """Issues readable csrftoken cookie prior to login."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @method_decorator(ensure_csrf_cookie)
    def get(self, request: Request):
        return success_response({"csrfReady": True})


def _rate_limited_login_response(retry_after_seconds: int):
    wait_label = format_arabic_wait_duration(retry_after_seconds)
    resp = error_response(
        code="LOGIN_RATE_LIMITED",
        message=f"تم تجاوز الحد المسموح لمحاولات تسجيل الدخول. يرجى الانتظار {wait_label} قبل المحاولة مرة أخرى.",
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        extra={"retryAfterSeconds": retry_after_seconds},
    )
    resp["Retry-After"] = str(retry_after_seconds)
    return resp


class LoginView(APIView):
    """POST /api/auth/login — Server-side HttpOnly session login via phone_e164."""

    permission_classes = [AllowAny]

    def post(self, request: Request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phone_e164 = serializer.validated_data["phone_e164"]
        client_ip = get_client_ip(request._request)
        locked_seconds = check_login_rate_limit(phone_e164, client_ip)
        if locked_seconds is not None:
            return _rate_limited_login_response(locked_seconds)

        user = authenticate_with_phone(
            request=request._request,
            phone_e164=phone_e164,
            password=serializer.validated_data["password"],
        )
        if user is None:
            new_lock_seconds, remaining_attempts = record_failed_login_attempt(phone_e164, client_ip)
            if new_lock_seconds is not None:
                return _rate_limited_login_response(new_lock_seconds)
            msg = "بيانات الدخول غير صحيحة أو الحساب غير نشط."
            if remaining_attempts == 2:
                msg = f"{msg} (تبقّت محاولتان فقط قبل الإيقاف المؤقت)"
            elif remaining_attempts == 1:
                msg = f"{msg} (تبقّت محاولة واحدة فقط قبل الإيقاف المؤقت)"
            return error_response(
                code="INVALID_CREDENTIALS",
                message=msg,
                status_code=status.HTTP_401_UNAUTHORIZED,
                extra={"remainingAttempts": remaining_attempts},
            )

        clear_login_failures(phone_e164)
        login_user_session(request._request, user)
        user_data = AuthenticatedUserSerializer(user).data
        return success_response({"user": user_data})


class LogoutView(APIView):
    """POST /api/auth/logout — Idempotent session invalidation & cookie eviction (CSRF-protected)."""

    permission_classes = [AllowAny]

    def post(self, request: Request):
        logout_user_session(request._request)
        response = success_response({"success": True, "message": "تم تسجيل الخروج بنجاح."})
        response.delete_cookie(
            key=settings.SESSION_COOKIE_NAME,
            path=settings.SESSION_COOKIE_PATH,
            samesite=settings.SESSION_COOKIE_SAMESITE,
        )
        return response


class MeView(APIView):
    """GET /api/auth/me — Authoritative session revalidation & user DTO bootstrap."""

    permission_classes = [IsAuthenticated]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request: Request):
        user = request.user
        if getattr(user, "status", None) != "Active":
            logout_user_session(request._request)
            return error_response(
                code="AUTHENTICATION_REQUIRED",
                message="جلسة العمل انتهت أو غير مصرح بها. يرجى تسجيل الدخول.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
        return success_response({"user": AuthenticatedUserSerializer(user).data})

