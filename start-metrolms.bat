@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================================
REM MetroLMS - Unified Full-Stack Launcher (Local Dev & Windows Server Prod)
REM Usage:
REM   start-metrolms.bat [dev | prod | /CHECKONLY | /HELP] [/NOBROWSER] [/BUILD]
REM ============================================================================

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
set "BACKEND_DIR=%ROOT_DIR%\backend"
set "FRONTEND_DIR=%ROOT_DIR%\frontend"
set "VENV_PY=%BACKEND_DIR%\.venv\Scripts\python.exe"
set "WAITRESS_EXE=%BACKEND_DIR%\.venv\Scripts\waitress-serve.exe"

set "MODE="
set "NO_BROWSER=0"
set "FORCE_BUILD=0"
set "CHECK_ONLY=0"

:parse_args
if "%~1"=="" goto after_args
if /I "%~1"=="/HELP" goto show_help
if /I "%~1"=="-h" goto show_help
if /I "%~1"=="/CHECKONLY" set "CHECK_ONLY=1"
if /I "%~1"=="/NOBROWSER" set "NO_BROWSER=1"
if /I "%~1"=="/BUILD" set "FORCE_BUILD=1"
if /I "%~1"=="dev" set "MODE=dev"
if /I "%~1"=="prod" set "MODE=prod"
shift
goto parse_args

:show_help
echo ============================================================================
echo  MetroLMS Full-Stack Launcher
echo ============================================================================
echo  Usage:
echo    start-metrolms.bat dev          Start Local Dev ^(Django 8000 + Vite 5173^)
echo    start-metrolms.bat prod         Start Windows Server Prod ^(Waitress + Dist^)
echo    start-metrolms.bat /CHECKONLY   Validate environment without starting
echo    start-metrolms.bat /HELP        Show this help
echo.
echo  Optional flags:
echo    /NOBROWSER   Do not open browser automatically in dev mode
echo    /BUILD       Force rebuild frontend\dist before starting prod mode
echo ============================================================================
exit /b 0

:after_args
echo ============================================================================
echo  MetroLMS - Full-Stack Launcher
echo  Root: "%ROOT_DIR%"
echo ============================================================================

if not exist "%VENV_PY%" (
    echo [ERROR] Python venv not found: "%VENV_PY%"
    echo Please run: "%BACKEND_DIR%\scripts\metrolms-windows-environment-setup.bat"
    exit /b 1
)

if not exist "%BACKEND_DIR%\.env" (
    echo [ERROR] Missing "%BACKEND_DIR%\.env"
    echo Please copy .env.example to .env and configure SQL Server settings.
    exit /b 1
)

if "%CHECK_ONLY%"=="1" goto run_checkonly

if "%MODE%"=="" (
    echo.
    echo Select run mode:
    echo   [1] Local Development ^(Django runserver :8000 + Vite :5173^)
    echo   [2] Windows Server Production ^(Waitress WSGI :8000 + Frontend Build^)
    echo.
    set /p "CHOICE=Enter choice [1 or 2]: "
    if "!CHOICE!"=="1" set "MODE=dev"
    if "!CHOICE!"=="2" set "MODE=prod"
)

if /I "%MODE%"=="dev" goto start_dev
if /I "%MODE%"=="prod" goto start_prod

echo [ERROR] Invalid mode selected. Use "dev" or "prod".
exit /b 1

:run_checkonly
echo [INFO] Checking Django development settings...
pushd "%BACKEND_DIR%" || exit /b 1
"%VENV_PY%" manage.py check --settings=config.settings.development
if errorlevel 1 (
    popd
    echo [ERROR] Django development check failed.
    exit /b 1
)
echo [INFO] Checking Django production settings...
"%VENV_PY%" manage.py check --settings=config.settings.production
if errorlevel 1 (
    popd
    echo [ERROR] Django production check failed.
    exit /b 1
)
popd

if not exist "%WAITRESS_EXE%" (
    echo [WARN] waitress-serve.exe not found ^(required only for prod mode^).
) else (
    echo [OK] waitress-serve.exe is installed.
)

if not exist "%FRONTEND_DIR%\node_modules" (
    echo [WARN] frontend\node_modules not found ^(run "npm install" inside frontend^).
) else (
    echo [OK] frontend\node_modules is present.
)

echo [OK] All pre-flight checks passed.
exit /b 0

:start_dev
echo.
echo [DEV] Verifying SQL Server migrations...
pushd "%BACKEND_DIR%" || exit /b 1
"%VENV_PY%" manage.py check --settings=config.settings.development
if errorlevel 1 (
    popd
    echo [ERROR] Django check failed.
    exit /b 1
)
"%VENV_PY%" manage.py migrate --noinput --settings=config.settings.development
if errorlevel 1 (
    popd
    echo [ERROR] Database migration failed. Ensure SQL Server is running.
    exit /b 1
)
popd

if not exist "%FRONTEND_DIR%\node_modules" (
    echo [DEV] Installing frontend npm packages...
    pushd "%FRONTEND_DIR%" || exit /b 1
    call npm install
    if errorlevel 1 (
        popd
        echo [ERROR] npm install failed.
        exit /b 1
    )
    popd
)

if exist "%WAITRESS_EXE%" (
    echo [DEV] Launching Django Backend via Waitress on http://127.0.0.1:8000 ...
    start "MetroLMS Backend - Dev" cmd /k "cd /d "%BACKEND_DIR%" && set "DJANGO_SETTINGS_MODULE=config.settings.development" && "%WAITRESS_EXE%" --host=127.0.0.1 --port=8000 --threads=8 config.wsgi:application"
) else (
    echo [DEV] Launching Django Backend via runserver on http://127.0.0.1:8000 ...
    start "MetroLMS Backend - Dev" cmd /k "cd /d "%BACKEND_DIR%" && "%VENV_PY%" manage.py runserver 127.0.0.1:8000 --noreload --settings=config.settings.development"
)

echo [DEV] Launching Vite Frontend on http://localhost:5173 ...
start "MetroLMS Frontend - Vite" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"

if "%NO_BROWSER%"=="0" (
    timeout /t 3 /nobreak >nul
    start "" "http://localhost:5173"
)

echo.
echo [OK] MetroLMS Dev servers launched in separate windows.
echo      Frontend: http://localhost:5173
echo      Backend:  http://127.0.0.1:8000/api/
exit /b 0

:start_prod
echo.
echo [PROD] Running Django production checks...
pushd "%BACKEND_DIR%" || exit /b 1
"%VENV_PY%" manage.py check --settings=config.settings.production
if errorlevel 1 (
    popd
    echo [ERROR] Django production check failed.
    exit /b 1
)
"%VENV_PY%" manage.py migrate --noinput --settings=config.settings.production
if errorlevel 1 (
    popd
    echo [ERROR] Production database migration failed.
    exit /b 1
)
popd

if not exist "%WAITRESS_EXE%" (
    echo [ERROR] waitress-serve.exe not found. Run:
    echo   "%VENV_PY%" -m pip install -r "%BACKEND_DIR%\requirements-prod.txt"
    exit /b 1
)

if "%FORCE_BUILD%"=="1" goto do_frontend_build
if not exist "%FRONTEND_DIR%\dist\index.html" goto do_frontend_build
goto skip_frontend_build

:do_frontend_build
echo [PROD] Building React frontend into frontend\dist ...
pushd "%FRONTEND_DIR%" || exit /b 1
if not exist "%FRONTEND_DIR%\node_modules" call npm install
call npx vite build
if errorlevel 1 (
    popd
    echo [ERROR] Frontend production build failed.
    exit /b 1
)
popd

:skip_frontend_build
if not defined METROLMS_BIND_HOST set "METROLMS_BIND_HOST=127.0.0.1"
if not defined METROLMS_BIND_PORT set "METROLMS_BIND_PORT=8000"

echo [PROD] Checking Windows Scheduled Task ^(MetroLMS_DueGroupRenewals_6H^)...
schtasks /Query /TN "MetroLMS_DueGroupRenewals_6H" >nul 2>&1
if errorlevel 1 (
    echo [WARN] Scheduled task "MetroLMS_DueGroupRenewals_6H" is NOT registered yet.
    echo        Run as Administrator: "%BACKEND_DIR%\scripts\metrolms-register-renewal-task.bat"
) else (
    echo [OK] Scheduled task "MetroLMS_DueGroupRenewals_6H" is registered.
)

echo [PROD] Launching Waitress WSGI Server on %METROLMS_BIND_HOST%:%METROLMS_BIND_PORT% ...
start "MetroLMS Backend - Production Waitress" cmd /k "cd /d "%BACKEND_DIR%" && "%WAITRESS_EXE%" --host=%METROLMS_BIND_HOST% --port=%METROLMS_BIND_PORT% --threads=8 config.wsgi:application"

echo.
echo [OK] MetroLMS Production backend launched on %METROLMS_BIND_HOST%:%METROLMS_BIND_PORT%.
echo      Static frontend build ready at: "%FRONTEND_DIR%\dist"
echo      Point IIS to "%FRONTEND_DIR%\dist" and reverse-proxy /api/* to http://%METROLMS_BIND_HOST%:%METROLMS_BIND_PORT%.
exit /b 0

