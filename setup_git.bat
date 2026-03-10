@echo off
echo Initializing Git Repository for Backend...

REM Check if git is installed
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Git is not installed or not in your PATH.
    echo Please install Git from https://git-scm.com/
    pause
    exit /b
)

REM Initialize git
git init
if %errorlevel% neq 0 (
    echo Error initializing git.
    pause
    exit /b
)

REM Add files
echo Adding files...
git add .

REM Commit
echo Committing files...
git commit -m "Initial backend commit"

echo.
echo ========================================================
echo SUCCESS! Local repository ready.
echo.
echo NEXT STEPS:
echo 1. Create a new repository on GitHub.
echo 2. Run the following commands (replace URL with yours):
echo.
echo    git branch -M main
echo    git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
echo    git push -u origin main
echo.
echo ========================================================
pause
