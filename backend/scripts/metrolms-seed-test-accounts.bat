@echo off
setlocal EnableExtensions

REM ============================================================================
REM MetroLMS - Seed 6 Temporary Role-Based Test Accounts in SQL Server
REM Usage:
REM   metrolms-seed-test-accounts.bat [/DELETE | /HELP]
REM ============================================================================

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "BACKEND_DIR=%%~fI"
set "VENV_PY=%BACKEND_DIR%\.venv\Scripts\python.exe"

if /I "%~1"=="/HELP" (
    echo MetroLMS Temporary Test Accounts Seeder
    echo.
    echo Creates 6 role-based test accounts in SQL Server ^(MetroTest@2026^):
    echo   developer       : 01000000001
    echo   super_admin     : 01000000002
    echo   admin           : 01000000003
    echo   assistant_admin : 01000000004
    echo   lecturer        : 01000000005
    echo   trainee         : 01000000006
    echo.
    echo Options:
    echo   /DELETE  Remove the 6 seeded test accounts from SQL Server
    echo   /HELP    Show this help message
    exit /b 0
)

if not exist "%VENV_PY%" (
    echo [ERROR] Python venv not found: "%VENV_PY%"
    exit /b 1
)

pushd "%BACKEND_DIR%" || exit /b 1

if /I "%~1"=="/DELETE" (
    "%VENV_PY%" manage.py seed_demo_roles --delete
    set "EXIT_CODE=%ERRORLEVEL%"
    popd
    exit /b %EXIT_CODE%
)

"%VENV_PY%" manage.py migrate --noinput
if errorlevel 1 (
    popd
    echo [ERROR] Migration failed. Ensure SQL Server is running.
    exit /b 1
)

"%VENV_PY%" manage.py seed_demo_roles
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%

