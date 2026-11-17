@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================================
REM MetroLMS - Production WSGI Server Launcher (Windows Server 2022 + Waitress)
REM Usage:
REM   metrolms-start-production-server.bat [/HELP] [/CHECKONLY]
REM ============================================================================

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "BACKEND_DIR=%%~fI"
set "VENV_PY=%BACKEND_DIR%\.venv\Scripts\python.exe"
set "WAITRESS_EXE=%BACKEND_DIR%\.venv\Scripts\waitress-serve.exe"
set "ENV_FILE=%BACKEND_DIR%\.env"

if /I "%~1"=="/HELP" (
    echo MetroLMS Production WSGI Server Launcher
    echo.
    echo Options:
    echo   /HELP       Show this help message
    echo   /CHECKONLY  Validate .venv, .env, and Django production checks without starting server
    echo.
    echo Environment overrides:
    echo   METROLMS_BIND_HOST  Default: 127.0.0.1 - behind IIS Reverse Proxy
    echo   METROLMS_BIND_PORT  Default: 8000
    exit /b 0
)

if not exist "%VENV_PY%" (
    echo [ERROR] Virtual environment Python not found: "%VENV_PY%"
    echo Run metrolms-windows-environment-setup.bat first.
    exit /b 1
)

if not exist "%ENV_FILE%" (
    echo [ERROR] Production environment file not found: "%ENV_FILE%"
    echo Create "%ENV_FILE%" from .env.example before starting production server.
    exit /b 1
)

if not defined METROLMS_BIND_HOST set "METROLMS_BIND_HOST=127.0.0.1"
if not defined METROLMS_BIND_PORT set "METROLMS_BIND_PORT=8000"

pushd "%BACKEND_DIR%" || exit /b 1

echo [INFO] Running Django production checks...
"%VENV_PY%" manage.py check --settings=config.settings.production
if errorlevel 1 (
    popd
    echo [ERROR] Django production check failed.
    echo.
    echo ============================================================================
    echo   RESULT: FAILURE ^(Django production check failed^)
    echo ============================================================================
    pause
    exit /b 1
)

if /I "%~1"=="/CHECKONLY" (
    popd
    echo [OK] Production pre-flight checks passed.
    echo.
    echo ============================================================================
    echo   RESULT: SUCCESS - Production pre-flight checks passed.
    echo ============================================================================
    pause
    exit /b 0
)

if not exist "%WAITRESS_EXE%" (
    popd
    echo [ERROR] waitress-serve.exe not found in .venv.
    echo Install production dependencies: "%VENV_PY%" -m pip install -r "%BACKEND_DIR%\requirements-prod.txt"
    pause
    exit /b 1
)

echo [INFO] Starting MetroLMS Waitress WSGI server on %METROLMS_BIND_HOST%:%METROLMS_BIND_PORT% ...
"%WAITRESS_EXE%" --host=%METROLMS_BIND_HOST% --port=%METROLMS_BIND_PORT% --threads=8 config.wsgi:application
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
