@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo ========================================================
echo         MetroLMS - GitHub Sync and Push Tool
echo ========================================================
echo.

where git >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Git is not installed or not found in system PATH.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set CURRENT_BRANCH=%%i
if "%CURRENT_BRANCH%"=="" (
    echo [ERROR] This directory is not a Git repository.
    echo.
    pause
    exit /b 1
)

echo Active Local Branch : %CURRENT_BRANCH%
echo Target Remote       : origin/main
echo.
echo Inspecting repository changes...
echo --------------------------------------------------------
git status --short
echo --------------------------------------------------------
echo.

set USER_MSG=
set /p USER_MSG="Enter commit message [Press Enter for default]: "
if not defined USER_MSG set "USER_MSG=chore: update project"
if "!USER_MSG!"=="" set "USER_MSG=chore: update project"

echo.
echo [1/3] Staging changes...
git add .

echo.
echo [2/3] Committing changes...
git commit -m "!USER_MSG!"

echo.
echo [3/3] Pushing to GitHub (origin/main)...
git push origin HEAD:main

if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================================
    echo      [SUCCESS] Changes successfully pushed to GitHub!
    echo ========================================================
) else (
    echo.
    echo ========================================================
    echo      [ERROR] Push failed. Check your network or permissions.
    echo ========================================================
)

echo.
echo Press any key to close this window...
pause >nul
exit /b 0
