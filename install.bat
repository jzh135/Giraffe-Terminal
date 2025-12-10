@echo off
setlocal
title Giraffe Terminal Installer

echo ===============================================================================
echo   🦒 Giraffe Terminal - Installation
echo ===============================================================================
echo.

REM Change to the project directory
cd /d "%~dp0"

echo [STEP 1/3] Checking Environment...
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed.
    echo.
    echo Please install Node.js from https://nodejs.org/
    echo.
    
    REM Try to use winget if available
    where winget >nul 2>nul
    if not errorlevel 1 (
        echo Attempting to install via Windows Package Manager (winget)...
        echo This will ask for administrator access.
        echo.
        winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        
        if errorlevel 1 (
            echo.
            echo [FAILED] Automatic installation failed.
            echo Please install manually and restart this script.
            pause
            exit /b 1
        )
        
        echo.
        echo Node.js installed! Please restart this window for changes to take effect.
        pause
        exit /b 0
    ) else (
        echo Winget not found. Please install manually.
        pause
        exit /b 1
    )
)

echo Node.js detected:
node --version
echo.

echo [STEP 2/3] Installing Dependencies...
echo.
echo This may take a few minutes...
echo.

call npm install

if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed.
    echo Please check your internet connection or error logs.
    pause
    exit /b 1
)

echo.
echo [STEP 3/3] Finalizing...

REM Ensure data folder exists (optional, but good practice)
if not exist "data" mkdir "data"

echo.
echo ===============================================================================
echo   ✅ Installation Complete!
echo ===============================================================================
echo.
echo You can now use 'start-server.bat' to launch the application.
echo.
pause
