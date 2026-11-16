"""SQL Server ISJSON OBJECT constraints for governance."""
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("governance", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE dbo.governance_pendingapprovalrequest
            ADD CONSTRAINT ck_pending_payload_isjson CHECK (ISJSON(payload_snapshot_json, OBJECT) = 1);

            ALTER TABLE dbo.governance_auditlogentry
            ADD CONSTRAINT ck_audit_details_isjson CHECK (details_snapshot_json IS NULL OR ISJSON(details_snapshot_json, OBJECT) = 1);
            """,
            reverse_sql="""
            ALTER TABLE dbo.governance_pendingapprovalrequest DROP CONSTRAINT IF EXISTS ck_pending_payload_isjson;
            ALTER TABLE dbo.governance_auditlogentry DROP CONSTRAINT IF EXISTS ck_audit_details_isjson;
            """,
        ),
    ]

