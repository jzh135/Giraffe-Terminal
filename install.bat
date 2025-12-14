@echo off
setlocal EnableDelayedExpansion
title Giraffe Terminal Installer

echo ===============================================================================
echo   🦒 Giraffe Terminal - Installation
echo ===============================================================================
echo.

REM Change to the project directory
cd /d "%~dp0"

echo [STEP 1/4] Checking Environment...
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
        echo ===============================================================================
        echo   Node.js installed!
        echo   Please CLOSE this window and run install.bat again.
        echo ===============================================================================
        pause
        exit /b 0
    ) else (
        echo Winget not found. Please install Node.js manually.
        pause
        exit /b 1
    )
)

echo   [OK] Node.js detected:
for /f "tokens=*" %%i in ('node --version') do echo        Version: %%i
echo.

REM Check npm
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm is not installed or not in PATH.
    pause
    exit /b 1
)
echo   [OK] npm detected:
for /f "tokens=*" %%i in ('npm --version') do echo        Version: %%i
echo.

echo [STEP 2/4] Cleaning up old dependencies...
echo.

REM Remove node_modules if it exists but is corrupted
if exist "node_modules\" (
    echo   Removing existing node_modules...
    rmdir /s /q "node_modules" 2>nul
)

REM Remove package-lock.json for a fresh install
if exist "package-lock.json" (
    echo   Removing package-lock.json for fresh install...
    del /f /q "package-lock.json" 2>nul
)
echo   [OK] Cleanup complete
echo.

echo [STEP 3/4] Installing Dependencies...
echo.
echo   This may take a few minutes...
echo.

call npm install

if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed.
    echo.
    echo Common issues:
    echo   - Check your internet connection
    echo   - Try running as Administrator
    echo   - Check for antivirus blocking npm
    echo.
    pause
    exit /b 1
)

echo.
echo   [OK] Dependencies installed successfully
echo.

echo [STEP 4/4] Finalizing...
echo.

REM Ensure data folder exists
if not exist "data" (
    mkdir "data"
    echo   [OK] Created data directory
)

REM Verify critical dependencies
echo   Verifying installation...
if not exist "node_modules\.bin\concurrently.cmd" (
    echo   [WARNING] concurrently not found, installing globally...
    call npm install -g concurrently
)

if not exist "node_modules\.bin\vite.cmd" (
    echo   [ERROR] Vite not installed correctly.
    pause
    exit /b 1
)

echo   [OK] All dependencies verified
echo.

echo ===============================================================================
echo   ✅ Installation Complete!
echo ===============================================================================
echo.
echo   You can now use 'start-server.bat' to launch the application.
echo.
echo   The application will be available at:
echo     Frontend: http://localhost:5173
echo     Backend:  http://localhost:3001
echo.
pause
