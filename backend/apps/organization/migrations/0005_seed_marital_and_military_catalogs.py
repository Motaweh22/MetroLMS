"""Seed standard Egyptian HR MaritalStatusCatalog and MilitaryServiceStatusCatalog options."""
from django.db import migrations


DEFAULT_MARITAL_STATUSES = [
    ("single", "أعزب", "Single"),
    ("married", "متزوج / متزوجة", "Married"),
    ("divorced", "مطلّق / مطلّقة", "Divorced"),
    ("widowed", "أرمل / أرملة", "Widowed"),
]

DEFAULT_MILITARY_STATUSES = [
    ("completed", "أدى الخدمة العسكرية (أنهى الخدمة)", "Completed Military Service"),
    ("final_exemption", "إعفاء نهائي", "Final Exemption"),
    ("temporary_exemption", "إعفاء مؤقت", "Temporary Exemption"),
    ("postponed", "مؤجل", "Postponed"),
    ("not_called", "لم يصبه الدور", "Not Called"),
    ("not_applicable", "غير مطلوب (للإناث)", "Not Applicable (Female)"),
]


def seed_marital_and_military(apps, schema_editor):
    MaritalStatusCatalog = apps.get_model("organization", "MaritalStatusCatalog")
    MilitaryServiceStatusCatalog = apps.get_model("organization", "MilitaryServiceStatusCatalog")

    for code, name_ar, name_en in DEFAULT_MARITAL_STATUSES:
        MaritalStatusCatalog.objects.update_or_create(
            code=code,
            defaults={"name_ar": name_ar, "name_en": name_en},
        )

    for code, name_ar, name_en in DEFAULT_MILITARY_STATUSES:
        MilitaryServiceStatusCatalog.objects.update_or_create(
            code=code,
            defaults={"name_ar": name_ar, "name_en": name_en},
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("organization", "0004_seed_default_catalogs"),
    ]

    operations = [
        migrations.RunPython(seed_marital_and_military, noop_reverse),
    ]
