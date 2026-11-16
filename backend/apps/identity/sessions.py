"""Custom Django session store backed by identity.ServerSession."""
from django.contrib.sessions.backends.db import SessionStore as DBStore


class SessionStore(DBStore):
    """Database session store targeting identity.ServerSession with user_id binding."""

    @classmethod
    def get_model_class(cls):
        from apps.identity.models import ServerSession

        return ServerSession

    def create_model_instance(self, data):
        obj = super().create_model_instance(data)
        user_id = data.get("_auth_user_id")
        if user_id is not None:
            try:
                obj.user_id = int(user_id)
            except (TypeError, ValueError):
                obj.user_id = None
        else:
            obj.user_id = None
        return obj
