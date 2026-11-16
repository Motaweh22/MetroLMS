"""SQL Server untyped ISJSON constraint for communications."""
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("communications", "0002_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE dbo.communications_scheduledjobrun
            ADD CONSTRAINT ck_jobrun_details_isjson CHECK (details_json IS NULL OR ISJSON(details_json) = 1);
            """,
            reverse_sql="""
            ALTER TABLE dbo.communications_scheduledjobrun DROP CONSTRAINT IF EXISTS ck_jobrun_details_isjson;
            """,
        ),
    ]

