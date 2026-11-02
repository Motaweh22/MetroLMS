@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

:: Navigate to script directory
cd /d "%~dp0"

echo ========================================================
echo         MetroLMS — GitHub Sync ^& Push Utility
echo ========================================================
echo.

:: Check Git installation
where git >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Git is not installed or not found in system PATH.
    pause
    exit /b 1
)

:: Display current branch & status
for /f "tokens=*" %%i in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set CURRENT_BRANCH=%%i
if "%CURRENT_BRANCH%"=="" (
    echo [ERROR] Not a valid Git repository directory.
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

:: Check if working tree has any changes
git status --porcelain > "%TEMP%\git_status.tmp"
for %%R in ("%TEMP%\git_status.tmp") do set STATUS_SIZE=%%~zR
del "%TEMP%\git_status.tmp" >nul 2>&1

if %STATUS_SIZE% equ 0 (
    echo Working tree clean (no new or modified files).
    echo.
    set /p PUSH_ONLY="Push already committed changes to GitHub? (y/n): "
    if /i not "!PUSH_ONLY!"=="y" (
        echo Operation cancelled.
        pause
        exit /b 0
    )
    goto DO_PUSH
)

:: Prompt for commit message
echo.
set /p COMMIT_MSG="Enter commit message (Leave empty for default timestamp): "
if "!COMMIT_MSG!"=="" (
    for /f "tokens=1-3 delims=/ " %%a in ("%DATE%") do set TODAY=%%a-%%b-%%c
    for /f "tokens=1-2 delims=: " %%a in ("%TIME%") do set NOW=%%a:%%b
    set COMMIT_MSG=chore(metro-lms): update !TODAY! !NOW!
)

echo.
echo [1/3] Staging changes...
git add .

echo.
echo [2/3] Committing changes...
git commit -m "!COMMIT_MSG!"
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Commit did not produce a new revision.
)

:DO_PUSH
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
    echo      [ERROR] Push failed. Please check network/credentials.
    echo ========================================================
)

echo.
pause
