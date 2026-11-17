"""SQL Server-specific CHECK and ISJSON constraints for identity."""
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("identity", "0002_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE dbo.identity_user
            ADD CONSTRAINT ck_identity_user_phone_e164_fmt CHECK (
                phone_e164 COLLATE Arabic_100_BIN2 LIKE N'+201[0125][0123456789][0123456789][0123456789][0123456789][0123456789][0123456789][0123456789][0123456789]'
                AND DATALENGTH(phone_e164) = 26
                AND LEN(phone_e164) = 13
            );
            ALTER TABLE dbo.identity_user
            ADD CONSTRAINT ck_identity_user_full_name_nonempty CHECK (LTRIM(RTRIM(full_name)) <> N'');
            ALTER TABLE dbo.identity_user
            ADD CONSTRAINT ck_identity_user_edu_qual_nonempty CHECK (LTRIM(RTRIM(educational_qualification)) <> N'');
            ALTER TABLE dbo.identity_user
            ADD CONSTRAINT ck_identity_user_address_nonempty CHECK (LTRIM(RTRIM(address)) <> N'');
            ALTER TABLE dbo.identity_rolepolicy
            ADD CONSTRAINT ck_rolepolicy_caps_isjson CHECK (ISJSON(default_capabilities_json) = 1 AND LEFT(LTRIM(default_capabilities_json), 1) = N'[');
            ALTER TABLE dbo.identity_userpermissionoverride
            ADD CONSTRAINT ck_permoverride_granted_isjson CHECK (ISJSON(granted_capabilities_json) = 1 AND LEFT(LTRIM(granted_capabilities_json), 1) = N'[');
            ALTER TABLE dbo.identity_userpermissionoverride
            ADD CONSTRAINT ck_permoverride_denied_isjson CHECK (ISJSON(denied_capabilities_json) = 1 AND LEFT(LTRIM(denied_capabilities_json), 1) = N'[');
            """,
            reverse_sql="""
            ALTER TABLE dbo.identity_user DROP CONSTRAINT IF EXISTS ck_identity_user_phone_e164_fmt;
            ALTER TABLE dbo.identity_user DROP CONSTRAINT IF EXISTS ck_identity_user_full_name_nonempty;
            ALTER TABLE dbo.identity_user DROP CONSTRAINT IF EXISTS ck_identity_user_edu_qual_nonempty;
            ALTER TABLE dbo.identity_user DROP CONSTRAINT IF EXISTS ck_identity_user_address_nonempty;
            ALTER TABLE dbo.identity_rolepolicy DROP CONSTRAINT IF EXISTS ck_rolepolicy_caps_isjson;
            ALTER TABLE dbo.identity_userpermissionoverride DROP CONSTRAINT IF EXISTS ck_permoverride_granted_isjson;
            ALTER TABLE dbo.identity_userpermissionoverride DROP CONSTRAINT IF EXISTS ck_permoverride_denied_isjson;
            """,
        ),
    ]

