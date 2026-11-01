@echo off
setlocal EnableDelayedExpansion

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
set "FRONTEND_DIR=%PROJECT_ROOT%\frontend"
set "PORT=5173"

echo [1/5] Checking Node.js and npm...
for /f "delims=" %%v in ('node -v 2^>nul') do set "NODE_VERSION=%%v"
for /f "delims=" %%v in ('npm -v 2^>nul') do set "NPM_VERSION=%%v"
echo       Node.js: %NODE_VERSION%
echo       npm:     %NPM_VERSION%

echo.
echo [2/5] Checking dependencies...
if exist "%FRONTEND_DIR%\node_modules\" (
    echo       Dependencies already installed.
) else (
    echo       Dependencies missing.
)

echo.
echo [3/5] Detecting network interfaces...
set "PREF_IP="
set "PREF_IFACE="
set "OTHER_COUNT=0"

for /f "usebackq tokens=1,2,3 delims=|" %%A in (`powershell -NoProfile -Command "$def = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object RouteMetric | Select-Object -First 1; $prefIP = ''; $prefAlias = ''; if ($def) { $ipObj = Get-NetIPAddress -InterfaceIndex $def.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.254\.' } | Select-Object -First 1; if ($ipObj) { $prefIP = $ipObj.IPAddress; $prefAlias = $ipObj.InterfaceAlias } }; $all = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.254\.' }); if (-not $prefIP -and $all.Count -gt 0) { $prefIP = $all[0].IPAddress; $prefAlias = $all[0].InterfaceAlias }; if ($prefIP) { Write-Output ('PREF|' + $prefIP + '|' + $prefAlias) }; foreach ($a in $all) { if ($a.IPAddress -ne $prefIP) { Write-Output ('OTHER|' + $a.IPAddress + '|' + $a.InterfaceAlias) } }"`) do (
    if "%%A"=="PREF" (
        set "PREF_IP=%%B"
        set "PREF_IFACE=%%C"
    )
    if "%%A"=="OTHER" (
        set /a OTHER_COUNT+=1
        set "OTHER_IP_!OTHER_COUNT!=%%B"
        set "OTHER_IFACE_!OTHER_COUNT!=%%C"
    )
)

if not "!PREF_IP!"=="" (
    echo       Preferred LAN IP: !PREF_IP! ^(!PREF_IFACE!^)
) else (
    echo       [NOTE] No active LAN IPv4 interface found. Server will still be accessible via localhost.
)

if !OTHER_COUNT! gtr 0 (
    echo       Additional interfaces:
    for /l %%i in (1,1,!OTHER_COUNT!) do (
        echo         - !OTHER_IP_%%i! ^(!OTHER_IFACE_%%i!^)
    )
)

echo.
echo [4/5] Checking port !PORT! availability...
set "PORT_STATUS=FREE"
set "OCCUPIED_PID="
set "OCCUPIED_NAME="
for /f "usebackq tokens=1,2,3 delims=|" %%A in (`powershell -NoProfile -Command "$p = !PORT!; $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { $pr = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue; Write-Output ('OCCUPIED|' + $c.OwningProcess + '|' + $pr.ProcessName) } else { Write-Output 'FREE' }"`) do (
    set "PORT_STATUS=%%A"
    set "OCCUPIED_PID=%%B"
    set "OCCUPIED_NAME=%%C"
)
if "!PORT_STATUS!"=="FREE" (
    echo       Port !PORT! is available.
) else (
    echo       Port !PORT! is occupied by PID !OCCUPIED_PID! ^(!OCCUPIED_NAME!^)
)

echo.
echo [5/5] Ready to start MetroLMS on 0.0.0.0:!PORT!...
echo.
echo ============================================================
echo   MetroLMS Development Server Ready
echo   Bound: 0.0.0.0:!PORT! (All network interfaces)
echo.
echo   Local access:    http://localhost:!PORT!/
if not "!PREF_IP!"=="" (
echo   LAN network URL: http://!PREF_IP!:!PORT!/ ^(!PREF_IFACE!^)
)
if !OTHER_COUNT! gtr 0 (
    for /l %%i in (1,1,!OTHER_COUNT!) do (
echo   Alt network URL: http://!OTHER_IP_%%i!:!PORT!/ ^(!OTHER_IFACE_%%i!^)
    )
)
echo ============================================================

