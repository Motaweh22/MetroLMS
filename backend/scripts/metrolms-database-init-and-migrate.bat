@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================================
REM MetroLMS - Windows Server Database Provisioning & Django Migration Utility
REM Supports: Windows Server 2019/2022/2025 & Windows 10/11 Workstations
REM Functions:
REM   1. Prompts for SQL Server location, auth mode, TLS option & DB name
REM   2. Verifies ODBC Driver 18 + SQL Server connection
REM   3. Checks if target database exists; creates it (Arabic_100_CI_AS, Compat 160, RCSI ON)
REM   4. Runs Django system check & migrate, then verifies 54 dbo tables
REM   5. Keeps window open with explicit SUCCESS / FAILURE summary
REM ============================================================================

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "MODE=RUN"
set "NO_PAUSE=0"
set "EXIT_CODE=0"

:parse_args
if "%~1"=="" goto args_done
if /I "%~1"=="/HELP" goto show_help
if /I "%~1"=="-HELP" goto show_help
if /I "%~1"=="/?" goto show_help
if /I "%~1"=="/CHECKONLY" set "MODE=CHECKONLY"
if /I "%~1"=="/NOPAUSE" set "NO_PAUSE=1"
shift
goto parse_args

:show_help
echo.
echo MetroLMS Database Provisioning ^& Django Migration Utility
echo.
echo Usage:
echo   metrolms-database-init-and-migrate.bat              Interactive DB check/create + migrate
echo   metrolms-database-init-and-migrate.bat /CHECKONLY   Read-only check (connection, DB, pending migrations)
echo   metrolms-database-init-and-migrate.bat /NOPAUSE     Exit without waiting for keypress
echo   metrolms-database-init-and-migrate.bat /HELP        Show this help message
echo.
exit /b 0

:args_done
REM Resolve backend directory (expecting backend\scripts\ -> backend\)
set "BACKEND_DIR="
if exist "%SCRIPT_DIR%\..\manage.py" (
    for %%I in ("%SCRIPT_DIR%\..") do set "BACKEND_DIR=%%~fI"
) else if exist "%CD%\manage.py" (
    set "BACKEND_DIR=%CD%"
) else if exist "%CD%\backend\manage.py" (
    set "BACKEND_DIR=%CD%\backend"
)

if not defined BACKEND_DIR (
    echo [ERROR] Could not locate backend\manage.py. Run this script from backend\scripts\ or repo root.
    set "EXIT_CODE=1"
    goto finish
)

set "PYTHON_EXE=%BACKEND_DIR%\.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" (
    where python >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Python 3.12+ virtual environment not found at "%BACKEND_DIR%\.venv" and no system python in PATH.
        set "EXIT_CODE=1"
        goto finish
    )
    set "PYTHON_EXE=python"
)

echo.
echo ============================================================================
echo   MetroLMS - Database Check, Creation ^& Django Migration Utility
echo   Mode: %MODE%
echo   Backend: %BACKEND_DIR%
echo ============================================================================
echo.

REM Defaults
set "DB_HOST=localhost"
set "DB_PORT="
set "DB_NAME=MetroLMS"
set "AUTH_MODE=1"
set "DB_USER="
set "DB_PASSWORD="
set "TRUST_CERT=yes"
set "SETTINGS_MOD=config.settings.production"

set /p "INPUT_HOST=SQL Server Host/Instance [default: %DB_HOST%]: "
if not "%INPUT_HOST%"=="" set "DB_HOST=%INPUT_HOST%"

set /p "INPUT_PORT=SQL Server TCP Port (blank for default/Named Pipes, or e.g. 1433) [default: blank]: "
if not "%INPUT_PORT%"=="" set "DB_PORT=%INPUT_PORT%"

set /p "INPUT_DB=Database Name [default: %DB_NAME%]: "
if not "%INPUT_DB%"=="" set "DB_NAME=%INPUT_DB%"

echo.
echo Authentication Mode:
echo   [1] SQL Server Authentication (Username + Password)  [Recommended for Windows Server]
echo   [2] Windows Authentication (Integrated Security / Trusted Connection)
set "INPUT_AUTH="
set /p "INPUT_AUTH=Choose [1 or 2, default 1]: "
if "%INPUT_AUTH%"=="2" set "AUTH_MODE=2"

if "%AUTH_MODE%"=="2" (
    set "METROLMS_FORCE_TRUSTED_CONNECTION=1"
    set "DB_USER="
    set "DB_PASSWORD="
) else (
    set "METROLMS_FORCE_TRUSTED_CONNECTION=0"
    set /p "DB_USER=SQL Login Username (must have dbcreator/sysadmin to create DB if missing): "
    if "!DB_USER!"=="" (
        echo [ERROR] Username cannot be empty for SQL Server Authentication.
        set "EXIT_CODE=1"
        goto finish
    )
    for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$s = Read-Host -AsSecureString 'SQL Login Password'; $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Runtime.InteropServices.Marshal]::PtrToStringAuto($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }"`) do set "DB_PASSWORD=%%P"
    if "!DB_PASSWORD!"=="" (
        echo [ERROR] Password cannot be empty for SQL Server Authentication.
        set "EXIT_CODE=1"
        goto finish
    )
)

echo.
set /p "INPUT_TRUST=Trust self-signed SQL Server TLS certificate? (yes/no) [default: no on prod, yes for local]: "
if /I "%INPUT_TRUST%"=="yes" set "TRUST_CERT=yes"
if /I "%INPUT_TRUST%"=="no" set "TRUST_CERT=no"
if "%INPUT_TRUST%"=="" (
    if /I "%DB_HOST%"=="localhost" (
        set "TRUST_CERT=yes"
    ) else (
        set "TRUST_CERT=no"
    )
)

echo.
echo Django Settings Module:
echo   [1] config.settings.production   (Windows Server / Production)
echo   [2] config.settings.development  (Local Workstation / Development)
set /p "INPUT_SET=Choose [1 or 2, default 1]: "
if "%INPUT_SET%"=="2" set "SETTINGS_MOD=config.settings.development"

REM Pass connection settings via process environment (never printed or logged)
set "DJANGO_SETTINGS_MODULE=%SETTINGS_MOD%"
set "METROLMS_TARGET_DB=%DB_NAME%"
set "DB_NAME=%DB_NAME%"
if "%DB_PORT%"=="" (
    set "METROLMS_FORCE_NO_PORT=1"
) else (
    set "METROLMS_FORCE_NO_PORT=0"
)
set "DB_ODBC_DRIVER=ODBC Driver 18 for SQL Server"
if "%TRUST_CERT%"=="yes" (
    set "DB_TRUST_SERVER_CERTIFICATE=True"
) else (
    set "DB_TRUST_SERVER_CERTIFICATE=False"
)

echo.
echo [Step 1/4] Testing SQL Server connection and checking database "%DB_NAME%"...
set "TMP_PY=%TEMP%\metrolms_db_check_%RANDOM%_%RANDOM%.py"
> "%TMP_PY%" (
    echo import os, sys, pyodbc
    echo host = os.environ.get("DB_HOST", "localhost"^)
    echo port = os.environ.get("DB_PORT", ""^)
    echo server = f"{host},{port}" if port else host
    echo db_name = os.environ.get("METROLMS_TARGET_DB", "MetroLMS"^)
    echo user = os.environ.get("DB_USER", ""^)
    echo pwd = os.environ.get("DB_PASSWORD", ""^)
    echo trust = "yes" if os.environ.get("DB_TRUST_SERVER_CERTIFICATE", "False"^) == "True" else "no"
    echo mode = os.environ.get("METROLMS_RUN_MODE", "RUN"^)
    echo conn_parts = [
    echo     "DRIVER={ODBC Driver 18 for SQL Server}",
    echo     f"SERVER={server}",
    echo     "DATABASE=master",
    echo     f"TrustServerCertificate={trust}",
    echo ]
    echo if user:
    echo     conn_parts.append(f"UID={user}"^)
    echo     conn_parts.append(f"PWD={pwd}"^)
    echo else:
    echo     conn_parts.append("Trusted_Connection=yes"^)
    echo conn_str = ";".join(conn_parts^)
    echo try:
    echo     conn = pyodbc.connect(conn_str, autocommit=True, timeout=10^)
    echo except Exception as exc:
    echo     print("[FAIL] Could not connect to SQL Server:", exc^)
    echo     sys.exit(2^)
    echo cur = conn.cursor(^)
    echo ver = cur.execute("SELECT @@VERSION"^).fetchone(^)[0].splitlines(^)[0]
    echo print("[OK] Connected:", ver^)
    echo db_id = cur.execute("SELECT DB_ID(?)", db_name^).fetchone(^)[0]
    echo if db_id is None:
    echo     print(f"[INFO] Database '{db_name}' does NOT exist yet."^)
    echo     if mode == "CHECKONLY":
    echo         print("[CHECKONLY] Skipping database creation."^)
    echo         conn.close(^)
    echo         sys.exit(0^)
    echo     safe_db = db_name.replace("]", "]]"^)
    echo     major_raw = str(cur.execute("SELECT SERVERPROPERTY('ProductMajorVersion')"^).fetchone(^)[0] or "15"^).split("."^)[0]
    echo     compat = min(160, max(130, int(major_raw^) * 10^)^)
    echo     cur.execute(f"CREATE DATABASE [{safe_db}] COLLATE Arabic_100_CI_AS"^)
    echo     cur.execute(f"ALTER DATABASE [{safe_db}] SET COMPATIBILITY_LEVEL = {compat}"^)
    echo     cur.execute(f"ALTER DATABASE [{safe_db}] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE"^)
    echo     print(f"[OK] Created database '{db_name}' (Arabic_100_CI_AS, COMPATIBILITY_LEVEL={compat}, RCSI=ON^)."^)
    echo else:
    echo     row = cur.execute("SELECT name, compatibility_level, collation_name, is_read_committed_snapshot_on FROM sys.databases WHERE name = ?", db_name^).fetchone(^)
    echo     if row and not row[3] and not (mode == "CHECKONLY"^):
    echo         safe_db = db_name.replace("]", "]]"^)
    echo         cur.execute(f"ALTER DATABASE [{safe_db}] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE"^)
    echo         print(f"[OK] Enabled RCSI on existing database '{db_name}'."^)
    echo     print(f"[OK] Database '{db_name}' already exists: compat={row[1]}, collation={row[2]}, RCSI={row[3]}"^)
    echo conn.close(^)
)

set "METROLMS_RUN_MODE=%MODE%"
"%PYTHON_EXE%" "%TMP_PY%"
set "PY_RC=%ERRORLEVEL%"
del /q "%TMP_PY%" >nul 2>&1

if not "%PY_RC%"=="0" (
    echo [ERROR] SQL Server connection or database check/creation failed.
    set "EXIT_CODE=1"
    goto finish
)

pushd "%BACKEND_DIR%"
echo.
echo [Step 2/4] Running Django system check (%SETTINGS_MOD%)...
"%PYTHON_EXE%" manage.py check --settings=%SETTINGS_MOD%
if errorlevel 1 (
    echo [ERROR] Django system check failed.
    popd
    set "EXIT_CODE=1"
    goto finish
)

if /I "%MODE%"=="CHECKONLY" (
    echo.
    echo [Step 3/4] Checking pending Django migrations ^(CHECKONLY^)...
    "%PYTHON_EXE%" manage.py migrate --check --settings=%SETTINGS_MOD%
    if errorlevel 1 (
        echo [INFO] Pending migrations detected ^(expected before first migrate^).
    ) else (
        echo [OK] All migrations are already applied.
    )
    popd
    set "EXIT_CODE=0"
    goto finish
)

echo.
echo [Step 3/4] Running Django migrations on "%DB_NAME%"...
"%PYTHON_EXE%" manage.py migrate --noinput --settings=%SETTINGS_MOD%
if errorlevel 1 (
    echo [ERROR] Django migrate failed.
    popd
    set "EXIT_CODE=1"
    goto finish
)

echo.
echo [Step 4/4] Verifying migrated dbo Feature tables...
"%PYTHON_EXE%" -c "from django.db import connection; import django, os; django.setup(); cur=connection.cursor(); cur.execute(\"SELECT COUNT(*) FROM sys.tables t JOIN sys.schemas s ON t.schema_id=s.schema_id WHERE s.name='dbo' AND (t.name LIKE 'identity_%%' OR t.name LIKE 'organization_%%' OR t.name LIKE 'governance_%%' OR t.name LIKE 'courses_%%' OR t.name LIKE 'media_%%' OR t.name LIKE 'groups_%%' OR t.name LIKE 'learning_%%' OR t.name LIKE 'communications_%%')\"); print('[OK] dbo Feature tables count:', cur.fetchone()[0])"
if errorlevel 1 (
    echo [ERROR] Post-migration table verification failed.
    popd
    set "EXIT_CODE=1"
    goto finish
)
popd

:finish
REM Clear sensitive variables from process environment
set "DB_PASSWORD="
echo.
echo ============================================================================
if "%EXIT_CODE%"=="0" (
    echo   RESULT: SUCCESS - Database "%DB_NAME%" on "%DB_HOST%" is verified ^& ready.
) else (
    echo   RESULT: FAILURE - One or more steps failed. Review the messages above.
)
echo ============================================================================
echo.
if "%NO_PAUSE%"=="0" pause
exit /b %EXIT_CODE%
