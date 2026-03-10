@echo off
echo ===========================================
echo   VPP Backend GitHub Deployment Script
echo   (Git Path Fix Version)
echo ===========================================

cd /d "%~dp0"

REM ----------------------------------------------------------------------
REM FIX: Manually adding standard Git paths to this session
REM This avoids the need to restart the computer/terminal
REM ----------------------------------------------------------------------
set "PATH=%PATH%;C:\Program Files\Git\cmd;C:\Program Files (x86)\Git\cmd"

REM Check if git is working now
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is STILL not found.
    echo Please try RESTARTING YOUR COMPUTER.
    echo After restart, run this script again.
    pause
    exit /b
)

echo [SUCCESS] Git found! Proceeding...
echo.

echo 1. Creating README.md...
echo # vpp-backend >> README.md

echo 2. Initializing Git...
git init

echo 3. Adding ALL backend files...
git add .

echo 4. Committing...
git commit -m "first commit"

echo 5. Renaming branch to main...
git branch -M main

echo 6. Adding remote origin...
git remote remove origin 2>nul
git remote add origin https://github.com/Vishaltrust/vpp-backend.git

echo 7. Pushing to GitHub...
echo.
echo [IMPORTANT] You may be asked to sign in to GitHub in the next step.
echo.
git push -u origin main

echo.
pause
