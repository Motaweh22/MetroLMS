"""Custom Django authentication backend for phone_e164 + Active status."""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.http import HttpRequest

from shared.validators import EGYPT_PHONE_RE, normalize_phone_e164

User = get_user_model()


class PhoneE164Backend(ModelBackend):
    """Authenticate MetroLMS users via canonical Egyptian phone_e164 and password."""

    def authenticate(
        self,
        request: HttpRequest | None,
        username: str | None = None,
        password: str | None = None,
        phone_e164: str | None = None,
        **kwargs: object,
    ):
        raw_phone = phone_e164 or username
        if not raw_phone or not password:
            return None

        normalized_phone = normalize_phone_e164(str(raw_phone))
        if not EGYPT_PHONE_RE.match(normalized_phone):
            return None

        try:
            user = User.objects.select_related("role", "metro_line").get(phone_e164=normalized_phone)
        except User.DoesNotExist:
            # Run default password hasher to mitigate timing side-channels
            User().set_password(password)
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None

    def user_can_authenticate(self, user) -> bool:
        return getattr(user, "status", None) == "Active"

