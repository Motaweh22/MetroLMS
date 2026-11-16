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
from shared.api import error_response, success_response


class CsrfBootstrapView(APIView):
    """Issues readable csrftoken cookie prior to login."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @method_decorator(ensure_csrf_cookie)
    def get(self, request: Request):
        return success_response({"csrfReady": True})


class LoginView(APIView):
    """POST /api/auth/login — Server-side HttpOnly session login via phone_e164."""

    permission_classes = [AllowAny]

    def post(self, request: Request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = authenticate_with_phone(
            request=request._request,
            phone_e164=serializer.validated_data["phone_e164"],
            password=serializer.validated_data["password"],
        )
        if user is None:
            return error_response(
                code="INVALID_CREDENTIALS",
                message="بيانات الدخول غير صحيحة أو الحساب غير نشط.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

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

