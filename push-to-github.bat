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
    goto :END_PROMPT
)

for /f "tokens=*" %%i in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set CURRENT_BRANCH=%%i
if "%CURRENT_BRANCH%"=="" (
    echo [ERROR] This directory is not a Git repository.
    echo.
    goto :END_PROMPT
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
set /p "USER_MSG=Enter commit message [Press Enter for default]: "
if not defined USER_MSG set "USER_MSG=chore: update project"
if "!USER_MSG!"=="" set "USER_MSG=chore: update project"

echo.
echo [1/3] Staging changes...
git add -A

echo.
echo [2/3] Committing changes...
git diff --cached --quiet
if %ERRORLEVEL% equ 0 (
    echo No new changes to commit.
) else (
    git commit -m "!USER_MSG!"
)

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

:END_PROMPT
echo.
echo ========================================================
echo Press any key to exit...
pause
exit /b 0
