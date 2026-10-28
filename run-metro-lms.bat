@echo off
setlocal EnableDelayedExpansion

title MetroLMS - Application Launcher

echo ============================================================
echo   MetroLMS - Cairo Metro Training Platform
echo   One-Click Development Launcher
echo ============================================================
echo.

:: 1. Resolve paths relative to this batch file
set "PROJECT_ROOT=%~dp0"
set "FRONTEND_DIR=%PROJECT_ROOT%frontend"

:: 2. Verify project structure
if not exist "%FRONTEND_DIR%\" (
    echo [ERROR] The frontend directory was not found:
    echo         "%FRONTEND_DIR%"
    echo.
    echo Please make sure this launcher is placed at the root of the MetroLMS project.
    echo.
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] Frontend package.json was not found at:
    echo         "%FRONTEND_DIR%\package.json"
    echo.
    echo Please ensure the project files are complete.
    echo.
    pause
    exit /b 1
)

:: 3. Verify Node.js and npm on PATH
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not available on your system PATH.
    echo.
    echo Please install Node.js version 18 or newer from:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed or not available on your system PATH.
    echo.
    echo Please ensure npm is installed with Node.js and added to system PATH.
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%v in ('node -v 2^>nul') do set "NODE_VERSION=%%v"
for /f "delims=" %%v in ('npm -v 2^>nul') do set "NPM_VERSION=%%v"

echo [OK] Node.js: %NODE_VERSION%
echo [OK] npm:     %NPM_VERSION%
echo.

:: 4. Verify dev script in package.json
findstr /C:"\"dev\":" "%FRONTEND_DIR%\package.json" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] The dev script is missing from:
    echo         "%FRONTEND_DIR%\package.json"
    echo.
    pause
    exit /b 1
)

:: 5. Navigate to frontend directory
cd /d "%FRONTEND_DIR%"
if errorlevel 1 (
    echo [ERROR] Failed to navigate to directory:
    echo         "%FRONTEND_DIR%"
    echo.
    pause
    exit /b 1
)

:: 6. Check dependencies and run npm ci if node_modules is missing
if not exist "node_modules\" (
    echo [INFO] Dependencies not detected in frontend\node_modules\.
    echo [INFO] Running 'npm ci' to install project dependencies cleanly...
    echo.
    call npm ci
    if errorlevel 1 (
        echo.
        echo [ERROR] Dependency installation 'npm ci' failed.
        echo Please check your network connection and npm configuration.
        echo.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed successfully.
    echo.
) else (
    echo [OK] Dependencies detected: node_modules directory is present.
)

:: 7. Start Vite development server bound to 127.0.0.1 and auto-open browser
echo.
echo ============================================================
echo   Starting MetroLMS Frontend Server
echo   Host: 127.0.0.1 (Localhost only)
echo   Port: 5173
echo   URL:  http://127.0.0.1:5173/
echo ============================================================
echo [INFO] Opening default browser...
echo [INFO] Press Ctrl+C in this terminal window to stop the server.
echo ============================================================
echo.

call npm run dev -- --host 127.0.0.1 --open

if errorlevel 1 (
    echo.
    echo [ERROR] The development server exited with an error code: %errorlevel%
    echo Please review the terminal output above for error details.
    echo.
    pause
    exit /b %errorlevel%
)

echo.
echo [INFO] MetroLMS server has shut down.
pause
