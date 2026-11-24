"""Seed canonical Cairo Metro leadership titles into LeadershipTitleCatalog."""
from django.db import migrations

DEFAULT_LEADERSHIP_TITLES = [
    ("رئيس قطاع / رئيس إدارة مركزية", "Sector / Central Department Head"),
    ("مدير عام", "General Manager"),
    ("مدير إدارة", "Department Manager"),
    ("رئيس قسم / رئيس وحدة", "Section / Unit Head"),
    ("مشرف / رئيس وردية", "Supervisor / Shift Lead"),
    ("قائد فريق / منسق", "Team Lead / Coordinator"),
]


def seed_leadership_titles(apps, schema_editor):
    LeadershipTitleCatalog = apps.get_model("organization", "LeadershipTitleCatalog")
    User = apps.get_model("identity", "User")
    CourseAudienceLeadership = apps.get_model("courses", "CourseAudienceLeadership")

    for name_ar, name_en in DEFAULT_LEADERSHIP_TITLES:
        LeadershipTitleCatalog.objects.get_or_create(
            name_ar=name_ar,
            defaults={"name_en": name_en},
        )

    for raw_title in User.objects.exclude(leadership_title__isnull=True).values_list("leadership_title", flat=True):
        clean = (raw_title or "").strip()
        if clean:
            LeadershipTitleCatalog.objects.get_or_create(name_ar=clean)

    for raw_title in CourseAudienceLeadership.objects.values_list("leadership_title", flat=True):
        clean = (raw_title or "").strip()
        if clean:
            LeadershipTitleCatalog.objects.get_or_create(name_ar=clean)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("organization", "0007_leadershiptitlecatalog"),
        ("identity", "0005_user_gender"),
        ("courses", "0005_courseaudienceleadership"),
    ]

    operations = [
        migrations.RunPython(seed_leadership_titles, noop_reverse),
    ]
