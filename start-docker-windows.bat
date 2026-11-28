@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================================
REM MetroLMS - Interactive Windows Server 2022 Docker Launcher
REM Collects all required settings into backend\.env.docker (leaving backend\.env
REM untouched for non-Docker runs) and starts the unified container on port 8000.
REM Usage:
REM   start-docker-windows.bat              Configure (if needed) + build + start
REM   start-docker-windows.bat /TESTCARDS   Enable quick-login test cards in build
REM   start-docker-windows.bat /NOTESTCARDS Disable quick-login test cards in build
REM   start-docker-windows.bat /NOBUILD     Start without rebuilding image
REM   start-docker-windows.bat /DOWN        Stop and remove Docker container
REM   start-docker-windows.bat /LOGS        Follow container logs
REM   start-docker-windows.bat /NOPAUSE     Do not pause before exiting
REM   start-docker-windows.bat /HELP        Show this help
REM ============================================================================

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
set "BACKEND_DIR=%ROOT_DIR%\backend"
set "DOCKER_ENV_FILE=%BACKEND_DIR%\.env.docker"
set "COMPOSE_FILE=%ROOT_DIR%\docker-compose.windows.yml"

set "ACTION=UP"
set "NO_BUILD=0"
set "NO_PAUSE=0"
set "CLI_TEST_CARDS=%VITE_SHOW_TEST_CARDS%"
set "EXIT_CODE=0"

:parse_args
if "%~1"=="" goto after_args
if /I "%~1"=="/HELP" goto show_help
if /I "%~1"=="-h" goto show_help
if /I "%~1"=="/DOWN" set "ACTION=DOWN"
if /I "%~1"=="/LOGS" set "ACTION=LOGS"
if /I "%~1"=="/NOBUILD" set "NO_BUILD=1"
if /I "%~1"=="/NOPAUSE" set "NO_PAUSE=1"
if /I "%~1"=="/TESTCARDS" set "CLI_TEST_CARDS=true"
if /I "%~1"=="/NOTESTCARDS" set "CLI_TEST_CARDS=false"
shift
goto parse_args

:show_help
echo ============================================================================
echo  MetroLMS - Windows Server 2022 Docker Launcher
echo ============================================================================
echo  Usage:
echo    start-docker-windows.bat              Configure ^(if needed^) + build + start
echo    start-docker-windows.bat /TESTCARDS   Force Test Cards enabled in build
echo    start-docker-windows.bat /NOTESTCARDS Force Test Cards disabled in build
echo    start-docker-windows.bat /NOBUILD     Start without rebuilding image
echo    start-docker-windows.bat /DOWN        Stop and remove Docker container
echo    start-docker-windows.bat /LOGS        Follow container logs
echo    start-docker-windows.bat /NOPAUSE     Do not pause at exit
echo ============================================================================
exit /b 0

:after_args
echo ============================================================================
echo  MetroLMS - Windows Server 2022 Docker Launcher ^(%ACTION%^)
echo  Root: "%ROOT_DIR%"
echo ============================================================================

where docker >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Docker CLI not found in PATH. Install Docker / Mirantis Runtime first.
    set "EXIT_CODE=1"
    goto finish
)

docker info >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Docker daemon is not running or not accessible.
    echo        Ensure the Docker service is started ^(services.msc -^> Docker Engine^).
    set "EXIT_CODE=1"
    goto finish
)

set "COMPOSE_CMD="
docker compose version >nul 2>&1
if not errorlevel 1 (
    set "COMPOSE_CMD=docker compose"
) else (
    docker-compose version >nul 2>&1
    if not errorlevel 1 (
        set "COMPOSE_CMD=docker-compose"
    )
)
if "!COMPOSE_CMD!"=="" (
    echo [FAIL] Docker Compose is not installed ^(neither "docker compose" nor "docker-compose"^).
    echo        Install Docker Compose v2 plugin or docker-compose.exe and try again.
    set "EXIT_CODE=1"
    goto finish
)

if /I "%ACTION%"=="DOWN" (
    echo [INFO] Stopping MetroLMS Docker container...
    !COMPOSE_CMD! -f "%COMPOSE_FILE%" down
    if errorlevel 1 set "EXIT_CODE=1"
    goto finish
)

if /I "%ACTION%"=="LOGS" (
    !COMPOSE_CMD! -f "%COMPOSE_FILE%" logs -f
    if errorlevel 1 set "EXIT_CODE=1"
    goto finish
)

REM Check if backend\.env.docker already exists
set "DO_CONFIG=1"
if exist "%DOCKER_ENV_FILE%" (
    echo [OK] Found existing Docker config: "%DOCKER_ENV_FILE%"
    set /p "RECONF=Reconfigure Docker settings? ^(y/N^) [default: N]: "
    if /I not "!RECONF!"=="Y" if /I not "!RECONF!"=="YES" set "DO_CONFIG=0"
)

if "!DO_CONFIG!"=="1" (
    echo.
    echo [Step 1/3] Configuring Docker environment ^(saved to backend\.env.docker^)...

    REM Detect primary IPv4 address as a helpful default for SQL Server inside container
    set "DETECTED_IP="
    for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' -and $_.InterfaceAlias -notmatch 'vEthernet|WSL|Hyper-V|Docker|Loopback' } | Sort-Object InterfaceMetric | Select-Object -First 1 -ExpandProperty IPAddress)" 2^>nul`) do set "DETECTED_IP=%%I"
    if "!DETECTED_IP!"=="" set "DETECTED_IP=host.docker.internal"

    echo.
    echo Deployment Mode:
    echo   [1] Internal HTTP Testing ^(no SSL; accessible over LAN/localhost^)
    echo   [2] Production behind IIS HTTPS ^(SSL terminated by IIS^)
    set /p "MODE_CHOICE=Choose [1 or 2, default: 1]: "
    if "!MODE_CHOICE!"=="" set "MODE_CHOICE=1"

    set "ENV_SETTINGS=config.settings.development"
    set "ENV_DEBUG=False"
    set "ENV_COOKIE_SECURE=False"
    set "ENV_BIND=8000"
    set "ENV_TEST_CARDS=true"
    set "DEFAULT_HOST=!DETECTED_IP!"
    set "DEFAULT_SCHEME=http"
    set "DEFAULT_PORT_SUFFIX=:8000"

    if "!MODE_CHOICE!"=="2" (
        set "ENV_SETTINGS=config.settings.production"
        set "ENV_COOKIE_SECURE=True"
        set "ENV_BIND=127.0.0.1:8000"
        set "ENV_TEST_CARDS=false"
        set "DEFAULT_HOST=lms.company.com"
        set "DEFAULT_SCHEME=https"
        set "DEFAULT_PORT_SUFFIX="
    )

    if "!MODE_CHOICE!"=="1" (
        set /p "IN_CARDS=Show Quick-Login Test Cards on Login page? ^(Y/n^) [default: Y]: "
        if /I "!IN_CARDS!"=="N" set "ENV_TEST_CARDS=false"
        if /I "!IN_CARDS!"=="NO" set "ENV_TEST_CARDS=false"
    ) else (
        set /p "IN_CARDS=Show Quick-Login Test Cards on Login page? ^(y/N^) [default: N]: "
        if /I "!IN_CARDS!"=="Y" set "ENV_TEST_CARDS=true"
        if /I "!IN_CARDS!"=="YES" set "ENV_TEST_CARDS=true"
    )

    set /p "IN_DOMAIN=Public Domain or Server IP [default: !DEFAULT_HOST!]: "
    if "!IN_DOMAIN!"=="" set "IN_DOMAIN=!DEFAULT_HOST!"

    set "ENV_ALLOWED_HOSTS=!IN_DOMAIN!,localhost,127.0.0.1"
    set "ENV_CSRF_ORIGINS=!DEFAULT_SCHEME!://!IN_DOMAIN!!DEFAULT_PORT_SUFFIX!,http://localhost:8000,http://127.0.0.1:8000"
    if "!MODE_CHOICE!"=="2" (
        set "ENV_CSRF_ORIGINS=https://!IN_DOMAIN!"
    )

    echo.
    echo [NOTE] Inside a Windows Container, 'localhost' means the container itself.
    echo        Use the Server's IP address ^(or host.docker.internal^) for SQL Server.
    set /p "IN_DB_HOST=SQL Server Host/IP [default: !DETECTED_IP!]: "
    if "!IN_DB_HOST!"=="" set "IN_DB_HOST=!DETECTED_IP!"

    set /p "IN_DB_PORT=SQL Server TCP Port [default: 1433]: "
    if "!IN_DB_PORT!"=="" set "IN_DB_PORT=1433"

    set /p "IN_DB_NAME=Database Name [default: MetroLMS]: "
    if "!IN_DB_NAME!"=="" set "IN_DB_NAME=MetroLMS"

    set /p "IN_DB_USER=SQL Login Username [default: sa]: "
    if "!IN_DB_USER!"=="" set "IN_DB_USER=sa"

    set "IN_DB_PWD="
    for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$s = Read-Host -AsSecureString 'SQL Login Password'; $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Runtime.InteropServices.Marshal]::PtrToStringAuto($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }"`) do set "IN_DB_PWD=%%P"
    if "!IN_DB_PWD!"=="" (
        echo [FAIL] SQL Login Password cannot be empty for Docker container.
        set "EXIT_CODE=1"
        goto finish
    )

    set /p "IN_TRUST=Trust self-signed SQL Server TLS certificate? ^(True/False^) [default: True]: "
    if "!IN_TRUST!"=="" set "IN_TRUST=True"

    set /p "IN_MEDIA=Host Media Folder [default: D:\MetroLMSMedia]: "
    if "!IN_MEDIA!"=="" set "IN_MEDIA=D:\MetroLMSMedia"
    if not exist "!IN_MEDIA!" mkdir "!IN_MEDIA!" >nul 2>&1

    REM Generate secure random DJANGO_SECRET_KEY via PowerShell (no local Python needed)
    set "GEN_SECRET="
    for /f "usebackq delims=" %%K in (`powershell -NoProfile -Command "$bytes = New-Object byte[] 48; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes).Replace('+','-').Replace('/','_').TrimEnd('=')"`) do set "GEN_SECRET=%%K"

    > "%DOCKER_ENV_FILE%" (
        echo # MetroLMS Docker Environment ^(Generated by start-docker-windows.bat^)
        echo DJANGO_SETTINGS_MODULE=!ENV_SETTINGS!
        echo DJANGO_SECRET_KEY=!GEN_SECRET!
        echo DJANGO_DEBUG=!ENV_DEBUG!
        echo DJANGO_ALLOWED_HOSTS=!ENV_ALLOWED_HOSTS!
        echo.
        echo DB_ENGINE=mssql
        echo DB_NAME=!IN_DB_NAME!
        echo DB_USER=!IN_DB_USER!
        echo DB_PASSWORD=!IN_DB_PWD!
        echo DB_HOST=!IN_DB_HOST!
        echo DB_PORT=!IN_DB_PORT!
        echo DB_ODBC_DRIVER=ODBC Driver 18 for SQL Server
        echo DB_TRUST_SERVER_CERTIFICATE=!IN_TRUST!
        echo.
        echo SESSION_COOKIE_SECURE=!ENV_COOKIE_SECURE!
        echo CSRF_COOKIE_SECURE=!ENV_COOKIE_SECURE!
        echo CSRF_TRUSTED_ORIGINS=!ENV_CSRF_ORIGINS!
        echo.
        echo METROLMS_SERVE_FRONTEND=True
        echo METROLMS_MEDIA_HOST_DIR=!IN_MEDIA!
        echo METROLMS_DOCKER_BIND=!ENV_BIND!
        echo VITE_SHOW_TEST_CARDS=!ENV_TEST_CARDS!
        echo DJANGO_LOG_LEVEL=INFO
    )
    set "IN_DB_PWD="
    set "GEN_SECRET="
    echo [OK] Saved Docker settings to "%DOCKER_ENV_FILE%".
)

REM Load host bind, media dir, settings, and test-cards preference from .env.docker
set "DOCKER_DJANGO_SETTINGS="
set "SAVED_TEST_CARDS="
for /f "usebackq tokens=1,* delims==" %%A in ("%DOCKER_ENV_FILE%") do (
    if /I "%%A"=="METROLMS_MEDIA_HOST_DIR" set "METROLMS_MEDIA_HOST_DIR=%%B"
    if /I "%%A"=="METROLMS_DOCKER_BIND" set "METROLMS_DOCKER_BIND=%%B"
    if /I "%%A"=="DJANGO_SETTINGS_MODULE" set "DOCKER_DJANGO_SETTINGS=%%B"
    if /I "%%A"=="VITE_SHOW_TEST_CARDS" set "SAVED_TEST_CARDS=%%B"
)
if "!METROLMS_MEDIA_HOST_DIR!"=="" set "METROLMS_MEDIA_HOST_DIR=D:\MetroLMSMedia"
if not exist "!METROLMS_MEDIA_HOST_DIR!" mkdir "!METROLMS_MEDIA_HOST_DIR!" >nul 2>&1

if not "!CLI_TEST_CARDS!"=="" (
    set "VITE_SHOW_TEST_CARDS=!CLI_TEST_CARDS!"
) else if not "!SAVED_TEST_CARDS!"=="" (
    set "VITE_SHOW_TEST_CARDS=!SAVED_TEST_CARDS!"
) else if /I "!DOCKER_DJANGO_SETTINGS!"=="config.settings.development" (
    set "VITE_SHOW_TEST_CARDS=true"
) else (
    set "VITE_SHOW_TEST_CARDS=false"
)
echo [INFO] Frontend Test Cards ^(VITE_SHOW_TEST_CARDS^): !VITE_SHOW_TEST_CARDS!

echo.
echo [Step 2/3] Ensuring port 8000 is free from non-Docker processes and SQL port 1433 is open...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
powershell -NoProfile -Command "if (-not (Get-NetFirewallRule -DisplayName 'MetroLMS SQL Server 1433 (Docker)' -ErrorAction SilentlyContinue)) { New-NetFirewallRule -DisplayName 'MetroLMS SQL Server 1433 (Docker)' -Direction Inbound -Protocol TCP -LocalPort 1433 -Profile Any -Action Allow | Out-Null }" >nul 2>&1

echo.
echo [Step 3/3] Starting MetroLMS Windows Container...
if "%NO_BUILD%"=="1" (
    !COMPOSE_CMD! -f "%COMPOSE_FILE%" up -d
) else (
    !COMPOSE_CMD! -f "%COMPOSE_FILE%" up -d --build
)
if errorlevel 1 (
    echo [FAIL] Docker Compose failed. Check the messages above.
    set "EXIT_CODE=1"
    goto finish
)

echo.
echo [OK] MetroLMS Docker container is running!
echo      Container : metrolms-app
echo      Bind Port : !METROLMS_DOCKER_BIND! -> container :8000
echo      Media Dir : !METROLMS_MEDIA_HOST_DIR!
echo      Logs cmd  : start-docker-windows.bat /LOGS
echo      Stop cmd  : start-docker-windows.bat /DOWN

:finish
echo.
echo ============================================================================
if "%EXIT_CODE%"=="0" (
    echo   RESULT: SUCCESS
) else (
    echo   RESULT: FAILURE - Review the messages above.
)
echo ============================================================================
if "%NO_PAUSE%"=="0" pause
exit /b %EXIT_CODE%
