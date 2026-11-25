"""Canonical MetroLMS REST API response envelopes (OD-API-02)."""
from __future__ import annotations

from typing import Any

from rest_framework import status
from rest_framework.response import Response


def success_response(data: Any, status_code: int = status.HTTP_200_OK) -> Response:
    """Return immediate query/mutation success in canonical { status: 'OK', data } envelope."""
    return Response({"status": "OK", "data": data}, status=status_code)


def error_response(
    code: str,
    message: str,
    status_code: int = status.HTTP_400_BAD_REQUEST,
    field_errors: dict[str, list[str]] | None = None,
    extra: dict[str, Any] | None = None,
) -> Response:
    """Return StandardErrorResponse matching django-sqlserver-integration-contract.md §2.4."""
    payload: dict[str, Any] = {
        "status": "ERROR",
        "code": code,
        "message": message,
    }
    if field_errors:
        payload["fieldErrors"] = field_errors
    if extra:
        payload.update(extra)
    return Response(payload, status=status_code)

