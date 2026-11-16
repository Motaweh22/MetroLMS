"""DRF exception handler enforcing MetroLMS StandardErrorResponse."""
from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import (
    AuthenticationFailed,
    NotAuthenticated,
    PermissionDenied,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler

from .responses import error_response


def metrolms_exception_handler(exc: Exception, context: dict) -> Response | None:
    """Normalize DRF exceptions into MetroLMS StandardErrorResponse without leaking internals."""
    response = exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
        return error_response(
            code="AUTHENTICATION_REQUIRED",
            message="جلسة العمل انتهت أو غير مصرح بها. يرجى تسجيل الدخول.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    if isinstance(exc, PermissionDenied):
        return error_response(
            code="PERMISSION_DENIED",
            message="ليس لديك صلاحية للوصول إلى هذا المحتوى.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    if isinstance(exc, ValidationError):
        field_errors: dict[str, list[str]] = {}
        if isinstance(response.data, dict):
            for key, val in response.data.items():
                if isinstance(val, list):
                    field_errors[key] = [str(v) for v in val]
                else:
                    field_errors[key] = [str(val)]
        return error_response(
            code="VALIDATION_ERROR",
            message="طلب غير صالح. يرجى مراجعة البيانات المدخلة.",
            status_code=response.status_code,
            field_errors=field_errors or None,
        )

    if response.status_code == status.HTTP_404_NOT_FOUND:
        return error_response(
            code="RESOURCE_NOT_FOUND",
            message="المورد المطلوب غير موجود أو تم نقله.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    return error_response(
        code="API_ERROR",
        message="تعذر إتمام العملية حاليًا. يرجى المحاولة مرة أخرى.",
        status_code=response.status_code,
    )

