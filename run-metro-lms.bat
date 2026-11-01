@echo off
setlocal EnableDelayedExpansion

title MetroLMS - Cairo Metro Training Platform [Windows Server ^& Portable Launcher]

echo ======================================================================
echo   MetroLMS - Cairo Metro Training Platform
echo   Windows Server ^& Network Demo Launcher
echo ======================================================================
echo.

rem -------------------------------------------------------------------------
rem 1. Parse Command Line Arguments (Optional Port and --open / --no-open)
rem -------------------------------------------------------------------------
set "PORT=5173"
set "EXPLICIT_OPEN=0"
set "EXPLICIT_NO_OPEN=0"

for %%A in ("%~1" "%~2") do (
    if /i "%%~A"=="--no-open" set "EXPLICIT_NO_OPEN=1"
    if /i "%%~A"=="no-open"   set "EXPLICIT_NO_OPEN=1"
    if /i "%%~A"=="--open"    set "EXPLICIT_OPEN=1"
    if /i "%%~A"=="open"      set "EXPLICIT_OPEN=1"
    if not "%%~A"=="" (
        rem Check if argument is a numeric port
        set "ARG=%%~A"
        set /a NUM_CHECK=!ARG! 2>nul
        if "!NUM_CHECK!"=="!ARG!" (
            if !NUM_CHECK! geq 1024 if !NUM_CHECK! leq 65535 (
                set "PORT=!NUM_CHECK!"
            )
        )
    )
)

rem -------------------------------------------------------------------------
rem 2. Portable Path Resolution (%~dp0)
rem -------------------------------------------------------------------------
set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
set "FRONTEND_DIR=%PROJECT_ROOT%\frontend"

echo [1/7] Verifying project structure and portable paths...
echo       Project root: "%PROJECT_ROOT%"
echo       Frontend dir: "%FRONTEND_DIR%"

if not exist "%FRONTEND_DIR%\" (
    echo.
    echo [ERROR] The frontend directory was not found:
    echo         "%FRONTEND_DIR%"
    echo.
    echo Please ensure this launcher is placed at the root of the MetroLMS repository.
    echo.
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
    echo.
    echo [ERROR] Frontend package.json was not found at:
    echo         "%FRONTEND_DIR%\package.json"
    echo.
    echo Please verify that repository files are fully extracted.
    echo.
    pause
    exit /b 1
)

echo       [OK] Project structure verified.
echo.

rem -------------------------------------------------------------------------
rem 3. Detect Operating System & Server Environment (PowerShell 5.1 built-in)
rem -------------------------------------------------------------------------
echo [2/7] Detecting operating environment and operating system SKU...

set "IS_SERVER=0"
set "OS_TYPE=Client"
set "OS_CAPTION=Windows"

for /f "usebackq tokens=1,2,3,4 delims=|" %%A in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue; $isSvr = ($os.ProductType -ne 1); $type = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction SilentlyContinue).InstallationType; Write-Output ('SERVER|' + $isSvr + '|' + $type + '|' + $os.Caption)" 2^>nul`) do (
    if "%%A"=="SERVER" (
        set "IS_SERVER_RAW=%%B"
        set "OS_TYPE=%%C"
        set "OS_CAPTION=%%D"
    )
)

if /i "!IS_SERVER_RAW!"=="True" (
    set "IS_SERVER=1"
)

if "!IS_SERVER!"=="1" (
    echo       OS: !OS_CAPTION! [!OS_TYPE!] [Windows Server Environment]
    if "!EXPLICIT_OPEN!"=="1" (
        set "OPEN_BROWSER=1"
        echo       Mode: Server with explicit --open flag [Attempting browser launch]
    ) else (
        set "OPEN_BROWSER=0"
        echo       Mode: Headless Server [Browser auto-open disabled by default]
    )
) else (
    echo       OS: !OS_CAPTION! [!OS_TYPE!] [Workstation Environment]
    if "!EXPLICIT_NO_OPEN!"=="1" (
        set "OPEN_BROWSER=0"
        echo       Mode: Workstation with --no-open flag [Browser auto-open disabled]
    ) else (
        set "OPEN_BROWSER=1"
        echo       Mode: Interactive Workstation [Browser auto-open enabled]
    )
)
echo       [OK] Environment detection complete.
echo.

rem -------------------------------------------------------------------------
rem 4. Discover Toolchains & Enforce Exact Node.js / Vite Compatibility
rem -------------------------------------------------------------------------
echo [3/7] Discovering toolchains and enforcing Node.js runtime compatibility...

where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Node.js is not installed or not available on your system PATH.
    echo.
    echo MetroLMS requires Node.js LTS [Node.js 20.19+ or Node.js 22.12+ for Vite 7].
    echo.
    echo How to install on Windows Server:
    echo   1. Visit https://nodejs.org/
    echo   2. Download the LTS MSI installer for Windows x64.
    echo   3. On Server Core, run: msiexec /i node-vXX-x64.msi /qn
    echo   4. Ensure Node.js and npm directories are present in system PATH.
    echo   5. Re-open this launcher after installation finishes.
    echo.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] npm is not installed or not available on your system PATH.
    echo.
    echo npm is typically bundled with Node.js.
    echo Please repair or reinstall Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%v in ('node -v 2^>nul') do set "NODE_VERSION=%%v"
for /f "delims=" %%v in ('npm -v 2^>nul') do set "NPM_VERSION=%%v"

echo       Node.js: !NODE_VERSION!
echo       npm:     v!NPM_VERSION!

rem Discover Vite version from node_modules or package-lock.json without silent fallback
cd /d "%FRONTEND_DIR%"
set "VITE_STATUS="
set "VITE_VER="
set "VITE_ENG="
set "PKG_ENG="

for /f "usebackq tokens=1,2,3,4 delims=#" %%A in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$vVer = $null; $vEng = $null; if (Test-Path 'node_modules/vite/package.json') { $vp = Get-Content 'node_modules/vite/package.json' -Raw | ConvertFrom-Json; $vVer = $vp.version; $vEng = $vp.engines.node } elseif (Test-Path 'package-lock.json') { $lk = Get-Content 'package-lock.json' -Raw | ConvertFrom-Json; $vp = $lk.packages.'node_modules/vite'; if ($vp) { $vVer = $vp.version; $vEng = $vp.engines.node } }; if (-not $vVer) { Write-Output 'ERR_NOT_FOUND'; exit }; $nVer = (node -v).TrimStart('v'); $parts = $nVer.Split('.'); $maj = [int]$parts[0]; $min = [int]$parts[1]; $vMaj = [int]($vVer.Split('.')[0]); $ok = $false; if ($vMaj -ge 7) { $ok = (($maj -eq 20 -and $min -ge 19) -or ($maj -eq 22 -and $min -ge 12) -or ($maj -ge 23)) } else { $ok = ($maj -ge 18) }; if (-not $ok) { Write-Output ('ERR_INCOMPATIBLE#' + $nVer + '#' + $vVer + '#' + $vEng); exit }; $pEng = 'None'; if (Test-Path 'package.json') { $p = Get-Content 'package.json' -Raw | ConvertFrom-Json; if ($p.engines.node) { $pEng = $p.engines.node } }; Write-Output ('OK#' + $vVer + '#' + $vEng + '#' + $pEng)" 2^>nul`) do (
    set "VITE_STATUS=%%A"
    set "VITE_VER=%%B"
    set "VITE_ENG=%%C"
    set "PKG_ENG=%%D"
)

if "!VITE_STATUS!"=="ERR_NOT_FOUND" (
    echo.
    echo [ERROR] Could not determine the installed Vite version from node_modules or package-lock.json.
    echo         Cannot verify runtime engine compatibility without toolchain metadata.
    echo         Please ensure project files and lockfiles are fully present.
    echo.
    pause
    exit /b 1
)

if "!VITE_STATUS!"=="ERR_INCOMPATIBLE" (
    echo.
    echo [ERROR] Incompatible Node.js version [!NODE_VERSION!] for Vite !VITE_VER!.
    echo         Vite !VITE_VER! strictly requires Node.js !VITE_ENG!.
    echo         Current Node.js version does not satisfy toolchain engine requirements.
    echo.
    echo Please upgrade Node.js to a supported release [Node.js 20.19.0+ or Node.js 22 LTS] from:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo       Vite version: v!VITE_VER! [Engines: !VITE_ENG!]
if not "!PKG_ENG!"=="None" (
    echo       Package engines: !PKG_ENG!
)
echo       [OK] Runtime environment and engine compatibility verified.
echo.

rem -------------------------------------------------------------------------
rem 5. Project Dependencies & Strict Lockfile Governance
rem -------------------------------------------------------------------------
echo [4/7] Checking project dependencies and lockfile integrity...
cd /d "%FRONTEND_DIR%"

set "NEED_INSTALL=0"
if not exist "node_modules\" (
    set "NEED_INSTALL=1"
) else if not exist "node_modules\vite\package.json" (
    echo       [WARNING] Incomplete node_modules detected [missing Vite package].
    set "NEED_INSTALL=1"
)

if "!NEED_INSTALL!"=="1" (
    echo       Dependencies missing or incomplete in frontend\node_modules\.

    rem Detect lockfiles
    set "LOCK_PKG=0"
    set "LOCK_PNPM=0"
    set "LOCK_YARN=0"
    if exist "package-lock.json" set "LOCK_PKG=1"
    if exist "pnpm-lock.yaml"    set "LOCK_PNPM=1"
    if exist "yarn.lock"         set "LOCK_YARN=1"

    set /a TOTAL_LOCKS=!LOCK_PKG! + !LOCK_PNPM! + !LOCK_YARN!

    if !TOTAL_LOCKS! gtr 1 (
        echo.
        echo [ERROR] Multiple conflicting package manager lockfiles were detected:
        if "!LOCK_PKG!"=="1"  echo         - package-lock.json [npm]
        if "!LOCK_PNPM!"=="1" echo         - pnpm-lock.yaml [pnpm]
        if "!LOCK_YARN!"=="1" echo         - yarn.lock [yarn]
        echo.
        echo Conflicting lockfiles cause non-deterministic and potentially corrupted installations.
        echo To preserve environment integrity on Windows Server:
        echo   1. Keep only the canonical lockfile [package-lock.json] in frontend\.
        echo   2. Delete or archive the secondary or redundant lockfiles.
        echo   3. Re-run this launcher once the lockfile ambiguity is resolved.
        echo.
        pause
        exit /b 1
    ) else if "!LOCK_PKG!"=="1" (
        echo       [INFO] Canonical package-lock.json found. Running reproducible "npm ci"...
        echo       [INFO] This may take a few moments on initial launch...
        echo.
        call npm ci
    ) else if "!LOCK_PNPM!"=="1" (
        where pnpm >nul 2>&1
        if errorlevel 1 (
            echo.
            echo [ERROR] pnpm-lock.yaml found, but 'pnpm' executable is not available on PATH.
            echo Please install pnpm or run 'npm install -g pnpm'.
            echo.
            pause
            exit /b 1
        )
        echo       [INFO] Found pnpm-lock.yaml. Running "pnpm install --frozen-lockfile"...
        call pnpm install --frozen-lockfile
    ) else if "!LOCK_YARN!"=="1" (
        where yarn >nul 2>&1
        if errorlevel 1 (
            echo.
            echo [ERROR] yarn.lock found, but 'yarn' executable is not available on PATH.
            echo Please install yarn or run 'npm install -g yarn'.
            echo.
            pause
            exit /b 1
        )
        echo       [INFO] Found yarn.lock. Running "yarn install --frozen-lockfile"...
        call yarn install --frozen-lockfile
    ) else (
        echo       [WARNING] No lockfile found. Running standard "npm install"...
        call npm install
    )

    if errorlevel 1 (
        echo.
        echo [ERROR] Dependency installation failed.
        echo Please verify network connectivity, proxy settings, or npm registry availability.
        echo.
        pause
        exit /b 1
    )

    if not exist "node_modules\vite\package.json" (
        echo.
        echo [ERROR] Dependency installation finished but Vite binary was not found.
        echo.
        pause
        exit /b 1
    )
    echo       [OK] Dependencies installed and verified successfully.
) else (
    echo       Dependencies already installed and verified [Vite v!VITE_VER! ready].
)
echo.

rem -------------------------------------------------------------------------
rem 6. Dynamic Network IPv4 Detection & Interface Classification
rem -------------------------------------------------------------------------
echo [5/7] Detecting network interfaces, default route, and adapter types [NetTCPIP]...

set "PREF_IP="
set "PREF_IFACE="
set "PREF_GW="
set "PREF_VIRT="
set "PREF_DESC="
set "OTHER_COUNT=0"

for /f "usebackq tokens=1,2,3,4,5,6 delims=|" %%A in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$configs = @(Get-NetIPConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.NetAdapter.Status -eq 'Up' -and $_.IPv4Address -ne $null }); $gwConfigs = @($configs | Where-Object { $_.IPv4DefaultGateway -ne $null }); $pref = $null; if ($gwConfigs.Count -gt 1) { $bestMetric = 999999; foreach ($g in $gwConfigs) { $m = @(Get-NetRoute -InterfaceIndex $g.InterfaceIndex -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Measure-Object -Property RouteMetric -Minimum).Minimum; if ($null -ne $m -and $m -lt $bestMetric) { $bestMetric = $m; $pref = $g } }; if (-not $pref) { $pref = $gwConfigs[0] } } elseif ($gwConfigs.Count -eq 1) { $pref = $gwConfigs[0] } else { $phys = @($configs | Where-Object { $_.NetAdapter.Virtual -ne $true }); if ($phys.Count -gt 0) { $pref = $phys[0] } elseif ($configs.Count -gt 0) { $pref = $configs[0] } }; if ($pref) { $ip = ($pref.IPv4Address | Where-Object { $_.IPAddress -notmatch '^169\.254\.' -and $_.IPAddress -notmatch '^127\.' } | Select-Object -First 1).IPAddress; $gw = if ($pref.IPv4DefaultGateway) { ($pref.IPv4DefaultGateway.NextHop | Select-Object -First 1) } else { 'None' }; $isVirt = ($pref.NetAdapter.Virtual -eq $true -or $pref.InterfaceDescription -match 'Virtual|Hyper-V|VMware|VirtualBox|WSL|TAP'); if ($ip) { Write-Output ('PREF|' + $ip + '|' + $pref.InterfaceAlias + '|' + $gw + '|' + $isVirt + '|' + $pref.InterfaceDescription) } }; foreach ($c in $configs) { $otherIps = @($c.IPv4Address | Where-Object { $_.IPAddress -notmatch '^169\.254\.' -and $_.IPAddress -notmatch '^127\.' }); foreach ($o in $otherIps) { if (-not $pref -or $o.IPAddress -ne $ip) { $cGW = if ($c.IPv4DefaultGateway) { ($c.IPv4DefaultGateway.NextHop | Select-Object -First 1) } else { 'None' }; $isV = ($c.NetAdapter.Virtual -eq $true -or $c.InterfaceDescription -match 'Virtual|Hyper-V|VMware|VirtualBox|WSL|TAP'); Write-Output ('OTHER|' + $o.IPAddress + '|' + $c.InterfaceAlias + '|' + $cGW + '|' + $isV + '|' + $c.InterfaceDescription) } } }" 2^>nul`) do (
    if "%%A"=="PREF" (
        set "PREF_IP=%%B"
        set "PREF_IFACE=%%C"
        set "PREF_GW=%%D"
        set "PREF_VIRT=%%E"
        set "PREF_DESC=%%F"
    )
    if "%%A"=="OTHER" (
        set /a OTHER_COUNT+=1
        set "OTHER_IP_!OTHER_COUNT!=%%B"
        set "OTHER_IFACE_!OTHER_COUNT!=%%C"
        set "OTHER_GW_!OTHER_COUNT!=%%D"
        set "OTHER_VIRT_!OTHER_COUNT!=%%E"
        set "OTHER_DESC_!OTHER_COUNT!=%%F"
    )
)

if not "!PREF_IP!"=="" (
    if not "!PREF_GW!"=="None" (
        echo       Primary LAN Interface: !PREF_IFACE! [!PREF_DESC!]
        echo       Primary LAN IPv4:      !PREF_IP!
        echo       Default Gateway:       !PREF_GW!
    ) else (
        echo       Direct Subnet Interface: !PREF_IFACE! [!PREF_DESC!]
        echo       Primary IPv4:            !PREF_IP!
        echo       Default Gateway:         None [Direct Subnet Route]
        echo       [NOTE] No active default gateway detected.
        echo              Directly connected clients on this subnet may still reach the server.
    )
) else (
    echo       [NOTE] No active external network interfaces detected.
    echo              Only localhost [127.0.0.1] will be reachable on this machine.
)

if !OTHER_COUNT! gtr 0 (
    echo       Additional active network interfaces:
    for /l %%i in (1,1,!OTHER_COUNT!) do (
        if "!OTHER_VIRT_%%i!"=="True" (
            echo         - [Virtual/Isolated Adapter] !OTHER_IFACE_%%i!: !OTHER_IP_%%i! [Gateway: !OTHER_GW_%%i!] [!OTHER_DESC_%%i!]
            echo           Notice: Virtual or host-only adapter. Unlikely to be reachable by external LAN devices.
        ) else (
            echo         - [Candidate Physical LAN Interface] !OTHER_IFACE_%%i!: !OTHER_IP_%%i! [Gateway: !OTHER_GW_%%i!] [!OTHER_DESC_%%i!]
        )
    )
)
echo.

rem -------------------------------------------------------------------------
rem 7. Port Availability Check & Robust Manual Validation Loop
rem -------------------------------------------------------------------------
echo [6/7] Checking port !PORT! availability...

:CHECK_PORT_AVAILABILITY
set "PORT_STATUS=FREE"
set "OCCUPIED_PID="
set "OCCUPIED_NAME="
set "FOUND_FALLBACK="

for /f "usebackq tokens=1,2,3,4 delims=|" %%A in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$target = [int]!PORT!; $c = Get-NetTCPConnection -LocalPort $target -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { $pr = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue; $found = ''; for ($p = $target + 1; $p -le $target + 10; $p++) { $t = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if (-not $t) { $found = $p; break } }; Write-Output ('OCCUPIED|' + $c.OwningProcess + '|' + $pr.ProcessName + '|' + $found) } else { Write-Output 'FREE' }" 2^>nul`) do (
    if "%%A"=="OCCUPIED" (
        set "PORT_STATUS=OCCUPIED"
        set "OCCUPIED_PID=%%B"
        set "OCCUPIED_NAME=%%C"
        set "FOUND_FALLBACK=%%D"
    )
)

if "!PORT_STATUS!"=="OCCUPIED" (
    echo.
    echo [WARNING] Port !PORT! is already in use by another process:
    echo           Process ID:   !OCCUPIED_PID!
    echo           Process Name: !OCCUPIED_NAME!
    echo.
    echo In vite.config.ts, "strictPort: true" is enabled.
    echo If we start on port !PORT!, Vite will terminate immediately with an error.
    echo.
    if not "!FOUND_FALLBACK!"=="" (
        echo A bounded scan discovered available fallback port: !FOUND_FALLBACK!
        echo.
        echo Options:
        echo   [1] Use available fallback port !FOUND_FALLBACK! [Recommended]
        echo   [2] Enter a custom port manually
        echo   [3] Exit launcher to inspect or stop process !OCCUPIED_PID!
        echo.
        set "CHOICE="
        set /p "CHOICE=Select choice [1/2/3] (Default: 1): "
        if "!CHOICE!"=="" set "CHOICE=1"
        if "!CHOICE!"=="1" (
            set "PORT=!FOUND_FALLBACK!"
            echo.
            echo [INFO] Switched to verified open port !PORT!.
            goto PORT_VERIFIED
        ) else if "!CHOICE!"=="2" (
            goto MANUAL_PORT_INPUT_LOOP
        ) else (
            echo.
            echo [STOPPED] Launcher stopped by operator.
            pause
            exit /b 1
        )
    ) else (
        echo No free ports were found in range !PORT!-!PORT!+10.
        goto MANUAL_PORT_INPUT_LOOP
    )
) else (
    echo       Port !PORT! is open and ready.
    goto PORT_VERIFIED
)

:MANUAL_PORT_INPUT_LOOP
echo.
set "MANUAL_INPUT="
set /p "MANUAL_INPUT=Enter an alternative port number [1024-65535] (or press Enter to exit): "
if "!MANUAL_INPUT!"=="" (
    echo [STOPPED] Launcher exited by operator.
    pause
    exit /b 1
)

rem Strip any spaces
set "MANUAL_INPUT=!MANUAL_INPUT: =!"

rem Validate digits
set "NUM_VERIFY="
set /a NUM_VERIFY=!MANUAL_INPUT! 2>nul
if not "!NUM_VERIFY!"=="!MANUAL_INPUT!" (
    echo [ERROR] Invalid port '!MANUAL_INPUT!'. Please enter numeric digits only.
    goto MANUAL_PORT_INPUT_LOOP
)

if !NUM_VERIFY! lss 1024 (
    echo [ERROR] Port !NUM_VERIFY! is out of range. Privileged ports below 1024 are not permitted.
    goto MANUAL_PORT_INPUT_LOOP
)
if !NUM_VERIFY! gtr 65535 (
    echo [ERROR] Port !NUM_VERIFY! is out of range. Maximum port number is 65535.
    goto MANUAL_PORT_INPUT_LOOP
)

rem Check availability of user-selected port
set "MANUAL_OCCUPIED=0"
set "MANUAL_PID="
set "MANUAL_PNAME="
for /f "usebackq tokens=1,2,3 delims=|" %%A in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$c = Get-NetTCPConnection -LocalPort !NUM_VERIFY! -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { $pr = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue; Write-Output ('OCCUPIED|' + $c.OwningProcess + '|' + $pr.ProcessName) } else { Write-Output 'FREE' }" 2^>nul`) do (
    if "%%A"=="OCCUPIED" (
        set "MANUAL_OCCUPIED=1"
        set "MANUAL_PID=%%B"
        set "MANUAL_PNAME=%%C"
    )
)

if "!MANUAL_OCCUPIED!"=="1" (
    echo [ERROR] Port !NUM_VERIFY! is currently occupied by !MANUAL_PNAME! [PID: !MANUAL_PID!].
    echo         Please choose a different port.
    goto MANUAL_PORT_INPUT_LOOP
)

set "PORT=!NUM_VERIFY!"
echo [INFO] Configured verified open port !PORT!.

:PORT_VERIFIED
echo.

rem -------------------------------------------------------------------------
rem 8. Start MetroLMS Vite Server (Bound to 0.0.0.0)
rem -------------------------------------------------------------------------
echo ======================================================================
echo   [7/7] Starting MetroLMS Development Server
echo   Binding: 0.0.0.0:!PORT! [Listening on all network interfaces]
echo ======================================================================
echo.
echo   Local access:             http://localhost:!PORT!/
if not "!PREF_IP!"=="" (
echo   Primary LAN access:       http://!PREF_IP!:!PORT!/ [!PREF_IFACE!]
)
if !OTHER_COUNT! gtr 0 (
    for /l %%i in (1,1,!OTHER_COUNT!) do (
        if "!OTHER_VIRT_%%i!"=="False" (
echo   Candidate network access: http://!OTHER_IP_%%i!:!PORT!/ [!OTHER_IFACE_%%i!]
        )
    )
    for /l %%i in (1,1,!OTHER_COUNT!) do (
        if "!OTHER_VIRT_%%i!"=="True" (
echo   Virtual/Host-Only IP:     !OTHER_IP_%%i! [!OTHER_IFACE_%%i! - Isolated Adapter]
        )
    )
)
echo.
echo ----------------------------------------------------------------------
echo [WINDOWS SERVER FIREWALL ^& SUBNET SECURITY GUIDANCE]
echo   To permit colleagues on your internal network to access this demo:
echo.
echo   1. An Administrator can open inbound TCP on port !PORT! scoped to your internal subnet:
echo.
echo      PowerShell [Recommended]:
echo        New-NetFirewallRule -DisplayName "MetroLMS Demo Server" -Direction Inbound -Action Allow -Protocol TCP -LocalPort !PORT! -Profile Domain,Private -RemoteAddress ^<YOUR_TRUSTED_SUBNET_CIDR^>
echo.
echo      netsh:
echo        netsh advfirewall firewall add rule name="MetroLMS Demo Server" dir=in action=allow protocol=TCP localport=!PORT! profile=domain,private remoteip=^<YOUR_TRUSTED_SUBNET_CIDR^>
echo.
echo   2. Subnet Configuration Guidance:
echo      - Replace ^<YOUR_TRUSTED_SUBNET_CIDR^> with your actual client subnet [e.g., 10.210.83.0/24 or 192.168.1.0/24].
echo      - DO NOT allow access on the "Public" profile.
echo      - DO NOT expose port !PORT! directly to external or public networks.
echo      - This launcher DOES NOT automatically alter firewall rules or request elevation.
echo ----------------------------------------------------------------------
echo [HOST-HEADER ^& HOSTNAME ACCESS NOTE]
echo   - Vite permits direct IP access [http://!PREF_IP!:!PORT!/] out of the box.
echo   - Host-header protections remain enabled by default [defense-in-depth].
echo   - If accessing via an internal DNS hostname [e.g., http://metrolms-svr:!PORT!/],
echo     add only that specific trusted hostname to server.allowedHosts in vite.config.ts.
echo     Do NOT set server.allowedHosts: true.
echo ----------------------------------------------------------------------
echo [INTERACTIVE CONSOLE PROCESS NOTICE]
echo   - This demo runs as an interactive foreground process in this console window.
echo   - The demo remains available ONLY while this Command Prompt window stays open.
echo   - Closing this window or pressing Ctrl+C will terminate the server.
echo   - It is NOT installed as a Windows Service or background scheduled task.
echo ======================================================================
echo.

rem Build Vite startup arguments
set "VITE_ARGS=--host 0.0.0.0 --port !PORT!"
if "!OPEN_BROWSER!"=="1" (
    echo [INFO] Launching default web browser to http://localhost:!PORT!/ ...
    set "VITE_ARGS=!VITE_ARGS! --open"
)

call npm run dev -- !VITE_ARGS!

if errorlevel 1 (
    echo.
    echo [ERROR] The development server exited with error code: %errorlevel%
    echo Please review the diagnostic messages above.
    echo.
    pause
    exit /b %errorlevel%
)

echo.
echo [INFO] MetroLMS server has shut down.
pause
