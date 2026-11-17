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
set "NO_PAUSE=0"
set "EXIT_CODE=0"
if /I "%~1"=="/NOPAUSE" set "NO_PAUSE=1"
if /I "%~2"=="/NOPAUSE" set "NO_PAUSE=1"

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
    set "EXIT_CODE=1"
    goto finish
)

pushd "%BACKEND_DIR%" || (
    set "EXIT_CODE=1"
    goto finish
)

if /I "%~1"=="/DELETE" (
    "%VENV_PY%" manage.py seed_demo_roles --delete
    set "EXIT_CODE=%ERRORLEVEL%"
    popd
    goto finish
)

"%VENV_PY%" manage.py migrate --noinput
if errorlevel 1 (
    popd
    echo [ERROR] Migration failed. Ensure SQL Server is running.
    set "EXIT_CODE=1"
    goto finish
)

"%VENV_PY%" manage.py seed_demo_roles
set "EXIT_CODE=%ERRORLEVEL%"
popd

:finish
echo.
if "%EXIT_CODE%"=="0" (
    echo ============================================================================
    echo   RESULT: SUCCESS - Test accounts operation completed.
    echo ============================================================================
) else (
    echo ============================================================================
    echo   RESULT: FAILURE ^(Exit Code: %EXIT_CODE%^)
    echo ============================================================================
)
if "%NO_PAUSE%"=="0" pause
exit /b %EXIT_CODE%

