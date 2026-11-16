"""Management command: seed_demo_roles — Idempotent 6-role test accounts for local & staging verification."""
from __future__ import annotations

import datetime

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.communications.models import UserWhatsAppVisibility
from apps.identity.models import RolePolicy, User
from apps.organization.models import MaritalStatusCatalog, MetroLine, MilitaryServiceStatusCatalog
from shared.permissions import ROLE_DEFAULT_CAPABILITIES

TEST_ACCOUNTS = [
    ("developer", "+201000000001", "29001010000001", "مطور النظام (تجريبي)"),
    ("super_admin", "+201000000002", "29001010000002", "السوبر أدمن (تجريبي)"),
    ("admin", "+201000000003", "29001010000003", "مدير التدريب (تجريبي)"),
    ("assistant_admin", "+201000000004", "29001010000004", "مساعد إداري (تجريبي)"),
    ("lecturer", "+201000000005", "29001010000005", "محاضر معتمد (تجريبي)"),
    ("trainee", "+201000000006", "29001010000006", "متدرب فني (تجريبي)"),
]

DEFAULT_TEST_PASSWORD = "MetroTest@2026"


class Command(BaseCommand):
    help = "Seed 6 role-based test accounts (+201000000001..006) & RolePolicies into SQL Server."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--password",
            default=DEFAULT_TEST_PASSWORD,
            help="Password for all seeded test accounts (default: MetroTest@2026).",
        )
        parser.add_argument(
            "--delete",
            action="store_true",
            help="Remove the seeded test accounts instead of creating them.",
        )

    @transaction.atomic
    def handle(self, *args, **options) -> None:
        if options["delete"]:
            phones = [p for _, p, _, _ in TEST_ACCOUNTS]
            UserWhatsAppVisibility.objects.filter(user__phone_e164__in=phones).delete()
            deleted, _ = User.objects.filter(phone_e164__in=phones).delete()
            self.stdout.write(self.style.SUCCESS(f"Removed {deleted} seeded test account record(s)."))
            return

        now = timezone.now()
        password = options["password"]

        # 1. Ensure RolePolicies exist
        policies: dict[str, RolePolicy] = {}
        for role_key, caps in ROLE_DEFAULT_CAPABILITIES.items():
            rp, _ = RolePolicy.objects.get_or_create(
                role_key=role_key,
                defaults={
                    "default_capabilities_json": sorted(caps),
                    "updated_at": now,
                    "updated_by": "seed_demo_roles",
                },
            )
            policies[role_key] = rp

        # 2. Ensure base lookup catalogs exist
        marital, _ = MaritalStatusCatalog.objects.get_or_create(code="single", defaults={"name_ar": "أعزب"})
        military, _ = MilitaryServiceStatusCatalog.objects.get_or_create(
            code="completed", defaults={"name_ar": "أنهى الخدمة"}
        )
        metro_line, _ = MetroLine.objects.get_or_create(name_ar="الخط الأول")

        # 3. Create or update the 6 test accounts
        created_count = 0
        admin_user: User | None = None
        for role_key, phone, nid, full_name in TEST_ACCOUNTS:
            user = User.objects.filter(phone_e164=phone).first()
            if user is None:
                # For developer singleton rule, reuse existing developer if one already exists
                if role_key == "developer" and User.objects.filter(role_id="developer").exists():
                    user = User.objects.get(role_id="developer")
                else:
                    user = User.objects.create_user(
                        phone_e164=phone,
                        password=password,
                        role=policies[role_key],
                        full_name=full_name,
                        national_id=nid,
                        marital_status=marital,
                        appointment_date=datetime.date(2020, 1, 1),
                        military_service_status=military,
                        educational_qualification="بكالوريوس",
                        address="القاهرة",
                        date_of_birth=datetime.date(1995, 1, 1),
                        metro_line=metro_line,
                        status="Active",
                    )
                    created_count += 1
            if role_key == "admin":
                admin_user = user

        # 4. Configure admin as WhatsApp support contact for testing scenarios
        if admin_user is not None:
            for scenario in ("technical_support", "account_registration", "password_recovery"):
                UserWhatsAppVisibility.objects.update_or_create(
                    user=admin_user,
                    scenario_key=scenario,
                    defaults={"is_visible": True},
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded 6 role test accounts (created={created_count}, password={password})."
            )
        )

