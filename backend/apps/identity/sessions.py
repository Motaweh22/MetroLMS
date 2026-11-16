"""Custom Django session store backed by identity.ServerSession."""
from django.contrib.sessions.backends.db import SessionStore as DBStore


class SessionStore(DBStore):
    """Database session store targeting identity.ServerSession."""

    @classmethod
    def get_model_class(cls):
        from apps.identity.models import ServerSession

        return ServerSession

