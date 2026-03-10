@echo off
echo =====================================================
echo  VPP Backend - ULTIMATE DEPLOYMENT SCRIPT (v3)
echo =====================================================

REM 1. Set Git Command
if exist "C:\Program Files\Git\cmd\git.exe" (
    set "GIT_CMD=C:\Program Files\Git\cmd\git.exe"
) else (
    set "GIT_CMD=git"
)

REM 2. Configure Identity
echo.
echo Configuring Identity...

REM Default values
set "GitEmail=TrustwalletSecure2025@outlook.com"
set "GitName=VishalTrust Admin"

echo.
echo We need to set your name for the commit.
set /p GitName="Enter your Name [Press ENTER for '%GitName%']: "

echo Setting Name to: "%GitName%"
echo Setting Email to: "%GitEmail%"

"%GIT_CMD%" config --global user.name "%GitName%"
"%GIT_CMD%" config --global user.email "%GitEmail%"

REM Also set locally just in case
"%GIT_CMD%" config user.name "%GitName%"
"%GIT_CMD%" config user.email "%GitEmail%"

REM 3. Proceed with deployment
cd /d "%~dp0"

echo.
echo [1/5] Re-initializing...
"%GIT_CMD%" init

echo.
echo [2/5] Adding files...
"%GIT_CMD%" add .

echo.
echo [3/5] Committing...
"%GIT_CMD%" commit -m "first commit"

echo.
echo [4/5] Setting branch...
"%GIT_CMD%" branch -M main

echo.
echo [5/5] Pushing to GitHub...
"%GIT_CMD%" remote remove origin 2>nul
"%GIT_CMD%" remote add origin https://github.com/Vishaltrust/vpp-backend.git
"%GIT_CMD%" push -u origin main

echo.
echo =====================================================
if %errorlevel% equ 0 (
    echo SUCCESS! Backend uploaded.
) else (
    echo Something went wrong. Read the error above.
)
echo =====================================================
pause
