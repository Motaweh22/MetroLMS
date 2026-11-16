"""SQL Server non-empty CHECK constraint for groups."""
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("groups", "0002_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE dbo.groups_traininggroup
            ADD CONSTRAINT ck_group_name_nonempty CHECK (LTRIM(RTRIM(name)) <> N'');
            """,
            reverse_sql="""
            ALTER TABLE dbo.groups_traininggroup DROP CONSTRAINT IF EXISTS ck_group_name_nonempty;
            """,
        ),
    ]

