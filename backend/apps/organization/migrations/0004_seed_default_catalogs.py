"""Seed default Cairo Metro organizational departments, job titles (linked to departments), and metro lines."""
from django.db import migrations


DEFAULT_DEPARTMENTS = [
    "الإدارة العامة للتشغيل والتحكم المركزي",
    "مركز تدريب وإعداد القادة بمترو القاهرة",
    "إدارة تكنولوجيا المعلومات",
    "إدارة التدريب",
    "قطاع التشغيل",
    "قطاع صيانة الوحدات المتحركة — الخط الأول",
    "قطاع الصيانة",
    "قطاع خدمة العملاء",
    "قطاع الصيانة الكهربائية",
    "قطاع الإشارات والاتصالات",
    "قطاع الأمن",
    "قطاع الصيانة الميكانيكية",
    "الإدارة العامة",
]

DEFAULT_JOB_TITLES = [
    ("مدير عام أنظمة التشغيل", "الإدارة العامة للتشغيل والتحكم المركزي"),
    ("كبير مدربي الإشارات والتحكم الآلي", "مركز تدريب وإعداد القادة بمترو القاهرة"),
    ("مدير النظام", "إدارة تكنولوجيا المعلومات"),
    ("مهندس تدريب أول", "إدارة التدريب"),
    ("مهندس تشغيل", "قطاع التشغيل"),
    ("سائق قطار", "قطاع التشغيل"),
    ("مشرف محطة", "قطاع التشغيل"),
    ("فني صيانة قطارات أول", "قطاع صيانة الوحدات المتحركة — الخط الأول"),
    ("فني صيانة", "قطاع الصيانة"),
    ("موظف خدمة عملاء", "قطاع خدمة العملاء"),
    ("مهندس كهرباء", "قطاع الصيانة الكهربائية"),
    ("فني إشارات", "قطاع الإشارات والاتصالات"),
    ("مشرف أمن", "قطاع الأمن"),
    ("مهندس ميكانيكا", "قطاع الصيانة الميكانيكية"),
    ("موظف إداري", "الإدارة العامة"),
]

DEFAULT_METRO_LINES = [
    ("الخط الأول", "Line 1"),
    ("الخط الثاني", "Line 2"),
    ("الخط الثالث", "Line 3"),
]


def seed_catalogs(apps, schema_editor):
    OrganizationalDepartment = apps.get_model("organization", "OrganizationalDepartment")
    JobTitle = apps.get_model("organization", "JobTitle")
    MetroLine = apps.get_model("organization", "MetroLine")

    dept_map = {}
    for dept_name in DEFAULT_DEPARTMENTS:
        dept_obj, _ = OrganizationalDepartment.objects.get_or_create(name_ar=dept_name)
        dept_map[dept_name] = dept_obj

    for job_name, dept_name in DEFAULT_JOB_TITLES:
        dept_obj = dept_map.get(dept_name)
        job_obj, created = JobTitle.objects.get_or_create(
            name_ar=job_name,
            defaults={"department": dept_obj},
        )
        if not created and job_obj.department_id is None and dept_obj is not None:
            job_obj.department = dept_obj
            job_obj.save(update_fields=["department"])

    if not MetroLine.objects.exists():
        for name_ar, name_en in DEFAULT_METRO_LINES:
            MetroLine.objects.get_or_create(name_ar=name_ar, defaults={"name_en": name_en})


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("organization", "0003_jobtitle_department"),
    ]

    operations = [
        migrations.RunPython(seed_catalogs, noop_reverse),
    ]
