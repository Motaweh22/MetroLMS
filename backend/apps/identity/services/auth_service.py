"""Authentication and ServerSession lifecycle services (D-AUTH-01, INV-DOM01-03)."""
from __future__ import annotations

from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import rotate_token
from django.http import HttpRequest

from apps.identity.models import ServerSession, User


def authenticate_with_phone(request: HttpRequest, phone_e164: str, password: str) -> User | None:
    """Authenticate an active MetroLMS user by canonical phone_e164 and password."""
    return authenticate(request=request, phone_e164=phone_e164, password=password)  # type: ignore[return-value]


def login_user_session(request: HttpRequest, user: User) -> None:
    """Establish server-side Django session, bind ServerSession.user_id, and rotate CSRF token."""
    login(request, user)
    rotate_token(request)
    session_key = request.session.session_key
    if session_key:
        ServerSession.objects.filter(session_key=session_key).update(user=user)


def logout_user_session(request: HttpRequest) -> None:
    """Invalidate and remove the server-side session row cleanly."""
    session_key = getattr(request.session, "session_key", None)
    logout(request)
    if session_key:
        ServerSession.objects.filter(session_key=session_key).delete()


def invalidate_user_sessions(user_id: int) -> int:
    """Bulk-invalidate all active ServerSession rows for a user (INV-DOM01-03)."""
    deleted_count, _ = ServerSession.objects.filter(user_id=user_id).delete()
    return deleted_count
