@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================================
REM MetroLMS - Register 6-Hour Group Renewal Windows Scheduled Task (TR-C3-04)
REM Usage:
REM   metrolms-register-renewal-task.bat [/HELP] [/DRYRUN]
REM ============================================================================

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "BACKEND_DIR=%%~fI"
set "VENV_PY=%BACKEND_DIR%\.venv\Scripts\python.exe"
set "TASK_NAME=MetroLMS_DueGroupRenewals_6H"
set "TASK_CMD=\"%VENV_PY%\" \"%BACKEND_DIR%\manage.py\" process_due_group_renewals --settings=config.settings.production"
set "NO_PAUSE=0"
set "EXIT_CODE=0"
if /I "%~1"=="/NOPAUSE" set "NO_PAUSE=1"
if /I "%~2"=="/NOPAUSE" set "NO_PAUSE=1"

if /I "%~1"=="/HELP" (
    echo MetroLMS Windows Task Scheduler Registration
    echo.
    echo Options:
    echo   /HELP    Show this help message
    echo   /DRYRUN  Print the schtasks command without modifying Windows Task Scheduler
    exit /b 0
)

if not exist "%VENV_PY%" (
    echo [ERROR] Virtual environment Python not found: "%VENV_PY%"
    set "EXIT_CODE=1"
    goto finish
)

if /I "%~1"=="/DRYRUN" (
    echo [DRYRUN] schtasks /Create /TN "%TASK_NAME%" /SC HOURLY /MO 6 /TR "%TASK_CMD%" /RU SYSTEM /F
    set "EXIT_CODE=0"
    goto finish
)

echo [INFO] Registering scheduled task "%TASK_NAME%" (every 6 hours)...
schtasks /Create /TN "%TASK_NAME%" /SC HOURLY /MO 6 /TR "%TASK_CMD%" /RU SYSTEM /F
if errorlevel 1 (
    echo [ERROR] Failed to register scheduled task. Run as Administrator on Windows Server 2022.
    set "EXIT_CODE=1"
    goto finish
)

echo [OK] Scheduled task "%TASK_NAME%" registered successfully.
set "EXIT_CODE=0"

:finish
echo.
if "%EXIT_CODE%"=="0" (
    echo ============================================================================
    echo   RESULT: SUCCESS - Scheduled task operation completed.
    echo ============================================================================
) else (
    echo ============================================================================
    echo   RESULT: FAILURE ^(Exit Code: %EXIT_CODE%^)
    echo ============================================================================
)
if "%NO_PAUSE%"=="0" pause
exit /b %EXIT_CODE%

