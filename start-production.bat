@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================================
REM MetroLMS - Internal Production-Build Launcher (Waitress + Built Frontend)
REM Builds minified/hashed frontend\dist (no source maps) and serves via
REM Vite Preview (:4173) proxying /api/* to Waitress (:8000) without IIS.
REM Usage:
REM   start-production.bat [/HELP] [/CHECKONLY] [/NOBROWSER] [/SKIPBUILD]
REM ============================================================================

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
set "BACKEND_DIR=%ROOT_DIR%\backend"
set "FRONTEND_DIR=%ROOT_DIR%\frontend"
set "VENV_PY=%BACKEND_DIR%\.venv\Scripts\python.exe"
set "WAITRESS_EXE=%BACKEND_DIR%\.venv\Scripts\waitress-serve.exe"

set "NO_BROWSER=0"
set "SKIP_BUILD=0"
set "CHECK_ONLY=0"

:parse_args
if "%~1"=="" goto after_args
if /I "%~1"=="/HELP" goto show_help
if /I "%~1"=="-h" goto show_help
if /I "%~1"=="/CHECKONLY" set "CHECK_ONLY=1"
if /I "%~1"=="/NOBROWSER" set "NO_BROWSER=1"
if /I "%~1"=="/SKIPBUILD" set "SKIP_BUILD=1"
shift
goto parse_args

:show_help
echo ============================================================================
echo  MetroLMS Internal Production-Build Launcher ^(No IIS Required^)
echo ============================================================================
echo  Usage:
echo    start-production.bat              Build frontend\dist + Start Waitress + Preview
echo    start-production.bat /CHECKONLY   Validate environment without starting
echo    start-production.bat /SKIPBUILD   Skip npm run build if dist already exists
echo    start-production.bat /NOBROWSER   Do not open browser automatically
echo    start-production.bat /HELP        Show this help
echo ============================================================================
exit /b 0

:after_args
echo ============================================================================
echo  MetroLMS - Internal Production-Build Launcher
echo  Root: "%ROOT_DIR%"
echo ============================================================================

if not exist "%VENV_PY%" (
    echo [ERROR] Python venv not found: "%VENV_PY%"
    exit /b 1
)
if not exist "%WAITRESS_EXE%" (
    echo [ERROR] waitress-serve.exe not found. Run:
    echo   "%VENV_PY%" -m pip install -r "%BACKEND_DIR%\requirements-prod.txt"
    exit /b 1
)
if not exist "%BACKEND_DIR%\.env" (
    echo [ERROR] Missing "%BACKEND_DIR%\.env"
    exit /b 1
)

if "%CHECK_ONLY%"=="1" (
    pushd "%BACKEND_DIR%" || exit /b 1
    "%VENV_PY%" manage.py check --settings=config.settings.development
    if errorlevel 1 (
        popd
        exit /b 1
    )
    popd
    echo [OK] Internal production-build pre-flight checks passed.
    exit /b 0
)

echo [1/4] Verifying SQL Server migrations...
pushd "%BACKEND_DIR%" || exit /b 1
"%VENV_PY%" manage.py migrate --noinput --settings=config.settings.development
if errorlevel 1 (
    popd
    echo [ERROR] Database migration failed. Ensure SQL Server is running.
    exit /b 1
)
popd

if "%SKIP_BUILD%"=="1" if exist "%FRONTEND_DIR%\dist\index.html" goto after_build

:do_build
echo [2/4] Building minified production frontend ^(no source maps^)...
pushd "%FRONTEND_DIR%" || exit /b 1
if not exist "%FRONTEND_DIR%\node_modules" call npm install
set "VITE_SHOW_TEST_CARDS=true"
call npx vite build
if errorlevel 1 (
    popd
    echo [ERROR] Frontend build failed.
    exit /b 1
)
popd

:after_build
echo [3/4] Stopping any old processes on ports 8000 and 4173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4173 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1

echo [3/4] Launching Waitress WSGI Backend on http://127.0.0.1:8000 ...
start "MetroLMS Backend - Waitress" cmd /k "cd /d "%BACKEND_DIR%" && set "DJANGO_SETTINGS_MODULE=config.settings.development" && "%WAITRESS_EXE%" --host=127.0.0.1 --port=8000 --threads=8 config.wsgi:application"

echo [4/4] Launching Built Frontend Preview on http://localhost:4173 ...
start "MetroLMS Frontend - Production Build" cmd /k "cd /d "%FRONTEND_DIR%" && npm run preview -- --host 0.0.0.0 --port 4173"

if "%NO_BROWSER%"=="0" (
    timeout /t 3 /nobreak >nul
    start "" "http://localhost:4173"
)

echo.
echo [OK] MetroLMS Internal Production-Build is running!
echo      Frontend ^(Minified/Hashed^): http://localhost:4173
echo      Backend  ^(Waitress WSGI^):   http://127.0.0.1:8000/api/
exit /b 0

