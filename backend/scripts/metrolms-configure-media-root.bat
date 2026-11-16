@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================================
REM MetroLMS - Configure & Verify Media Storage Root (Local or LAN UNC Share)
REM Usage:
REM   metrolms-configure-media-root.bat [path | /SHOW | /HELP]
REM Examples:
REM   metrolms-configure-media-root.bat "D:\MetroLMSMedia"
REM   metrolms-configure-media-root.bat "\\FILESERVER\MetroLMSMedia"
REM ============================================================================

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "BACKEND_DIR=%%~fI"
set "ENV_FILE=%BACKEND_DIR%\.env"
set "VENV_PY=%BACKEND_DIR%\.venv\Scripts\python.exe"

if /I "%~1"=="/HELP" goto show_help
if /I "%~1"=="-h" goto show_help

if not exist "%ENV_FILE%" (
    echo [ERROR] Environment file not found: "%ENV_FILE%"
    exit /b 1
)

if /I "%~1"=="/SHOW" (
    for /f "usebackq tokens=1,* delims==" %%A in (`findstr /B /I "METROLMS_MEDIA_ROOT=" "%ENV_FILE%"`) do (
        echo [INFO] Current METROLMS_MEDIA_ROOT=%%B
        exit /b 0
    )
    echo [INFO] METROLMS_MEDIA_ROOT is not set in .env ^(default: D:\MetroLMSMedia^)
    exit /b 0
)

set "NEW_MEDIA_ROOT=%~1"
if "%NEW_MEDIA_ROOT%"=="" (
    echo ============================================================================
    echo  MetroLMS - Media Storage Location Configuration
    echo ============================================================================
    for /f "usebackq tokens=1,* delims==" %%A in (`findstr /B /I "METROLMS_MEDIA_ROOT=" "%ENV_FILE%"`) do (
        echo  Current path: %%B
    )
    echo.
    echo  Examples:
    echo    Local drive : D:\MetroLMSMedia
    echo    LAN share   : \\FILESERVER\MetroLMSMedia
    echo.
    set /p "NEW_MEDIA_ROOT=Enter new Media Root path: "
)

if "%NEW_MEDIA_ROOT%"=="" (
    echo [ERROR] Media path cannot be empty.
    exit /b 1
)

if not exist "%NEW_MEDIA_ROOT%" (
    echo [INFO] Directory does not exist. Attempting to create "%NEW_MEDIA_ROOT%"...
    mkdir "%NEW_MEDIA_ROOT%" 2>nul
    if errorlevel 1 (
        echo [ERROR] Could not create or access "%NEW_MEDIA_ROOT%".
        echo         For LAN UNC shares, ensure the share exists and this account has Modify permissions.
        exit /b 1
    )
)

REM Verify write permission with a temporary probe file
set "PROBE_FILE=%NEW_MEDIA_ROOT%\.metrolms_write_test.tmp"
echo test>"%PROBE_FILE%" 2>nul
if errorlevel 1 (
    echo [ERROR] No write permission on "%NEW_MEDIA_ROOT%".
    exit /b 1
)
del /f /q "%PROBE_FILE%" >nul 2>&1

REM Update METROLMS_MEDIA_ROOT cleanly in backend\.env using Python (preserves all other lines)
if exist "%VENV_PY%" (
    "%VENV_PY%" -c "from pathlib import Path; p=Path(r'%ENV_FILE%'); new_val=r'%NEW_MEDIA_ROOT%'; lines=p.read_text(encoding='utf-8').splitlines(); out=[]; found=False; [out.append(f'METROLMS_MEDIA_ROOT={new_val}') or (found:=True) if l.startswith('METROLMS_MEDIA_ROOT=') else out.append(l) for l in lines]; found or out.append(f'METROLMS_MEDIA_ROOT={new_val}'); p.write_text('\n'.join(out)+'\n', encoding='utf-8')"
) else (
    echo [ERROR] Python venv not found: "%VENV_PY%"
    exit /b 1
)

if errorlevel 1 (
    echo [ERROR] Failed to update "%ENV_FILE%".
    exit /b 1
)

echo [OK] METROLMS_MEDIA_ROOT updated to: "%NEW_MEDIA_ROOT%"
echo      Restart the MetroLMS backend server for changes to take effect.
exit /b 0

:show_help
echo ============================================================================
echo  MetroLMS Media Root Configuration Utility
echo ============================================================================
echo  Usage:
echo    metrolms-configure-media-root.bat                  Interactive prompt
echo    metrolms-configure-media-root.bat "D:\Media"       Set local media path
echo    metrolms-configure-media-root.bat "\\SRV\Media"    Set LAN UNC share path
echo    metrolms-configure-media-root.bat /SHOW            Display current path
echo    metrolms-configure-media-root.bat /HELP            Show this help
echo ============================================================================
exit /b 0

