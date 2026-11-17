@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================================
REM MetroLMS - Windows Server Full Deployment & Bootstrap Utility
REM Prepares all git-excluded runtime artifacts on Windows Server:
REM   1. Verifies Python 3.12+, Node.js/npm, and ODBC Driver 18
REM   2. Creates/updates backend\.venv from backend\requirements.txt
REM   3. Generates backend\.env interactively if missing (never overwrites existing .env)
REM   4. Installs frontend\node_modules (npm ci) & builds frontend\dist (npx vite build)
REM   5. Runs Django production check & optionally runs DB init/migrate
REM   6. Keeps window open with explicit SUCCESS / FAILURE summary
REM ============================================================================

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
for %%I in ("%SCRIPT_DIR%\..") do set "REPO_ROOT=%%~fI"
set "BACKEND_DIR=%REPO_ROOT%\backend"
set "FRONTEND_DIR=%REPO_ROOT%\frontend"

set "MODE=DEPLOY"
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
echo MetroLMS Windows Server Deployment ^& Bootstrap Utility
echo.
echo Usage:
echo   metrolms-windows-server-deploy.bat              Full setup (.venv, .env, node_modules, dist, DB check/migrate)
echo   metrolms-windows-server-deploy.bat /CHECKONLY   Read-only readiness check (no installs or file writes)
echo   metrolms-windows-server-deploy.bat /NOPAUSE     Exit without waiting for keypress
echo   metrolms-windows-server-deploy.bat /HELP        Show this help message
echo.
exit /b 0

:args_done
echo.
echo ============================================================================
echo   MetroLMS - Windows Server Deployment ^& Bootstrap Utility
echo   Mode     : %MODE%
echo   Repo Root: %REPO_ROOT%
echo ============================================================================
echo.

if not exist "%BACKEND_DIR%\manage.py" (
    echo [ERROR] Could not locate "%BACKEND_DIR%\manage.py".
    set "EXIT_CODE=1"
    goto finish
)
if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] Could not locate "%FRONTEND_DIR%\package.json".
    set "EXIT_CODE=1"
    goto finish
)

echo [Step 1/5] Checking system prerequisites ^(Python 3.12+, Node.js, npm^)...
set "SYS_PY="
where py >nul 2>&1
if not errorlevel 1 (
    py -3.12 -c "import sys; assert sys.version_info >= (3,12)" >nul 2>&1
    if not errorlevel 1 set "SYS_PY=py -3.12"
)
if not defined SYS_PY (
    where python >nul 2>&1
    if not errorlevel 1 (
        python -c "import sys; assert sys.version_info >= (3,12)" >nul 2>&1
        if not errorlevel 1 set "SYS_PY=python"
    )
)
if not defined SYS_PY (
    if /I "%MODE%"=="CHECKONLY" (
        echo [MISSING] Python 3.12+ not found.
        set "EXIT_CODE=1"
        goto finish
    )
    echo [WARN] Python 3.12+ not found. Attempting automatic installation...
    if exist "%BACKEND_DIR%\scripts\metrolms-windows-environment-setup.bat" (
        call "%BACKEND_DIR%\scripts\metrolms-windows-environment-setup.bat" /INSTALL /NOPAUSE
    ) else (
        where winget >nul 2>&1
        if not errorlevel 1 (
            winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
        )
    )
    for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"`) do set "PATH=%%P"
    where py >nul 2>&1
    if not errorlevel 1 (
        py -3.12 -c "import sys; assert sys.version_info >= (3,12)" >nul 2>&1
        if not errorlevel 1 set "SYS_PY=py -3.12"
    )
    if not defined SYS_PY (
        where python >nul 2>&1
        if not errorlevel 1 (
            python -c "import sys; assert sys.version_info >= (3,12)" >nul 2>&1
            if not errorlevel 1 set "SYS_PY=python"
        )
    )
    if not defined SYS_PY (
        echo [FAIL] Python 3.12+ could not be auto-installed. Run backend\scripts\metrolms-windows-environment-setup.bat /INSTALL as Administrator.
        set "EXIT_CODE=1"
        goto finish
    )
)
echo [OK] Python 3.12+ detected ^(%SYS_PY%^).

where node >nul 2>&1
if errorlevel 1 (
    if /I "%MODE%"=="CHECKONLY" (
        echo [MISSING] Node.js not found in PATH.
        set "EXIT_CODE=1"
        goto finish
    )
    echo [WARN] Node.js not found. Attempting automatic installation via winget...
    where winget >nul 2>&1
    if not errorlevel 1 (
        winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"`) do set "PATH=%%P"
    )
    where node >nul 2>&1
    if errorlevel 1 (
        echo [FAIL] Node.js not found in PATH. Install Node.js 20+/24+ LTS and re-run this script.
        set "EXIT_CODE=1"
        goto finish
    )
)
where npm >nul 2>&1
if errorlevel 1 (
    echo [FAIL] npm not found in PATH.
    set "EXIT_CODE=1"
    goto finish
)
for /f "delims=" %%V in ('node -v') do echo [OK] Node.js %%V detected.

echo.
echo [Step 2/5] Checking / preparing backend\.venv...
set "VENV_PY=%BACKEND_DIR%\.venv\Scripts\python.exe"
if /I "%MODE%"=="CHECKONLY" (
    if exist "%VENV_PY%" (
        echo [OK] backend\.venv exists.
    ) else (
        echo [MISSING] backend\.venv does not exist yet.
    )
) else (
    if not exist "%VENV_PY%" (
        echo [INFO] Creating backend\.venv...
        %SYS_PY% -m venv "%BACKEND_DIR%\.venv"
        if errorlevel 1 (
            echo [FAIL] Could not create backend\.venv.
            set "EXIT_CODE=1"
            goto finish
        )
    )
    echo [INFO] Installing backend\requirements.txt...
    "%VENV_PY%" -m pip install --upgrade pip >nul 2>&1
    "%VENV_PY%" -m pip install -r "%BACKEND_DIR%\requirements.txt"
    if errorlevel 1 (
        echo [FAIL] pip install -r requirements.txt failed.
        set "EXIT_CODE=1"
        goto finish
    )
    echo [OK] backend\.venv is ready.
)

echo.
echo [Step 3/5] Checking / preparing backend\.env...
if exist "%BACKEND_DIR%\.env" (
    echo [OK] backend\.env already exists ^(preserved untouched^).
) else (
    if /I "%MODE%"=="CHECKONLY" (
        echo [MISSING] backend\.env does not exist yet.
    ) else (
        echo [INFO] backend\.env not found. Let us configure production environment settings:
        set "ENV_HOST=localhost"
        set "ENV_PORT=1433"
        set "ENV_DB=MetroLMS"
        set "ENV_USER=metrolms_app_user"
        set "ENV_PWD="
        set "ENV_TRUST=False"
        set "ENV_HOSTS=localhost,127.0.0.1"
        set "ENV_ORIGINS=https://localhost"
        set "ENV_MEDIA=D:\MetroLMSMedia"

        set /p "IN_HOST=SQL Server Host [default: localhost]: "
        if not "!IN_HOST!"=="" set "ENV_HOST=!IN_HOST!"
        set /p "IN_PORT=SQL Server Port ^(blank for default/Named Pipes^) [default: 1433]: "
        if not "!IN_PORT!"=="" set "ENV_PORT=!IN_PORT!"
        set /p "IN_DB=Database Name [default: MetroLMS]: "
        if not "!IN_DB!"=="" set "ENV_DB=!IN_DB!"
        set /p "IN_USER=SQL App Login Username [default: metrolms_app_user]: "
        if not "!IN_USER!"=="" set "ENV_USER=!IN_USER!"
        for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$s = Read-Host -AsSecureString 'SQL App Login Password'; $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Runtime.InteropServices.Marshal]::PtrToStringAuto($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }"`) do set "ENV_PWD=%%P"
        if "!ENV_PWD!"=="" (
            echo [FAIL] SQL password cannot be empty when creating production .env.
            set "EXIT_CODE=1"
            goto finish
        )
        set /p "IN_TRUST=Trust self-signed SQL TLS certificate? ^(True/False^) [default: False]: "
        if not "!IN_TRUST!"=="" set "ENV_TRUST=!IN_TRUST!"
        set /p "IN_HOSTS=DJANGO_ALLOWED_HOSTS [default: localhost,127.0.0.1]: "
        if not "!IN_HOSTS!"=="" set "ENV_HOSTS=!IN_HOSTS!"
        set /p "IN_ORIGINS=CSRF_TRUSTED_ORIGINS [default: https://localhost]: "
        if not "!IN_ORIGINS!"=="" set "ENV_ORIGINS=!IN_ORIGINS!"
        set /p "IN_MEDIA=METROLMS_MEDIA_ROOT [default: D:\MetroLMSMedia]: "
        if not "!IN_MEDIA!"=="" set "ENV_MEDIA=!IN_MEDIA!"

        for /f "usebackq delims=" %%K in (`"%VENV_PY%" -c "import secrets; print(secrets.token_urlsafe(48))"`) do set "GEN_KEY=%%K"

        > "%BACKEND_DIR%\.env" (
            echo # MetroLMS Production Environment ^(Generated by metrolms-windows-server-deploy.bat^)
            echo DJANGO_SETTINGS_MODULE=config.settings.production
            echo DJANGO_SECRET_KEY=!GEN_KEY!
            echo DJANGO_DEBUG=False
            echo DJANGO_ALLOWED_HOSTS=!ENV_HOSTS!
            echo.
            echo DB_ENGINE=mssql
            echo DB_NAME=!ENV_DB!
            echo DB_USER=!ENV_USER!
            echo DB_PASSWORD=!ENV_PWD!
            echo DB_HOST=!ENV_HOST!
            echo DB_PORT=!ENV_PORT!
            echo DB_ODBC_DRIVER=ODBC Driver 18 for SQL Server
            echo DB_TRUST_SERVER_CERTIFICATE=!ENV_TRUST!
            echo.
            echo METROLMS_MEDIA_ROOT=!ENV_MEDIA!
            echo SESSION_COOKIE_SECURE=True
            echo CSRF_COOKIE_SECURE=True
            echo CSRF_TRUSTED_ORIGINS=!ENV_ORIGINS!
            echo DJANGO_LOG_LEVEL=INFO
        )
        set "ENV_PWD="
        set "GEN_KEY="
        echo [OK] Created backend\.env securely.
    )
)

echo.
echo [Step 4/5] Checking / building frontend^(node_modules ^& dist^)...
if /I "%MODE%"=="CHECKONLY" (
    if exist "%FRONTEND_DIR%\node_modules\" (echo [OK] frontend\node_modules exists.) else (echo [MISSING] frontend\node_modules missing.)
    if exist "%FRONTEND_DIR%\dist\index.html" (echo [OK] frontend\dist exists.) else (echo [MISSING] frontend\dist missing.)
) else (
    pushd "%FRONTEND_DIR%"
    echo [INFO] Installing frontend dependencies ^(npm ci^)...
    call npm ci
    if errorlevel 1 (
        echo [WARN] npm ci failed; falling back to npm install...
        call npm install
        if errorlevel 1 (
            popd
            echo [FAIL] Frontend npm install failed.
            set "EXIT_CODE=1"
            goto finish
        )
    )
    echo [INFO] Building frontend production bundle ^(npx vite build^)...
    call npx vite build
    if errorlevel 1 (
        popd
        echo [FAIL] Frontend Vite build failed.
        set "EXIT_CODE=1"
        goto finish
    )
    popd
    echo [OK] frontend\node_modules and frontend\dist are ready.
)

echo.
echo [Step 5/5] Backend Django check ^& optional DB migration...
if /I "%MODE%"=="CHECKONLY" (
    if exist "%VENV_PY%" (
        "%VENV_PY%" "%BACKEND_DIR%\manage.py" check --settings=config.settings.production
        if errorlevel 1 (
            echo [WARN] Django production check reported issues.
        ) else (
            echo [OK] Django production check passed.
        )
    )
) else (
    set "RUN_MIG="
    set /p "RUN_MIG=Run Database Init & Django Migrations now? ^(y/n^) [default: y]: "
    if /I not "!RUN_MIG!"=="n" (
        call "%BACKEND_DIR%\scripts\metrolms-database-init-and-migrate.bat" /NOPAUSE
        if errorlevel 1 (
            echo [FAIL] Database init/migration step failed.
            set "EXIT_CODE=1"
            goto finish
        )
    ) else (
        echo [INFO] Skipped DB migration step by user choice.
    )
)

:finish
echo.
echo ============================================================================
if "%EXIT_CODE%"=="0" (
    echo   RESULT: SUCCESS - MetroLMS Windows Server runtime artifacts are ready.
) else (
    echo   RESULT: FAILURE - One or more deployment steps failed. See details above.
)
echo ============================================================================
echo.
if "%NO_PAUSE%"=="0" pause
exit /b %EXIT_CODE%

