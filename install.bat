@echo off
REM Giraffe Terminal - Installation Script
REM Run this batch file for first-time setup

echo ========================================
echo   🦒 Giraffe Terminal - First Time Setup
echo ========================================
echo.

REM Change to the project directory
cd /d "%~dp0"

REM Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
    echo [INFO] Node.js is not installed. Attempting to install...
    echo.
    
    REM Check if winget is available
    where winget >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] Windows Package Manager (winget) is not available.
        echo.
        echo Please install Node.js manually from: https://nodejs.org/
        echo After installation, restart this script.
        echo.
        pause
        exit /b 1
    )
    
    echo Installing Node.js via Windows Package Manager...
    echo This may require administrator privileges.
    echo.
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    
    if errorlevel 1 (
        echo.
        echo [ERROR] Failed to install Node.js automatically.
        echo Please install Node.js manually from: https://nodejs.org/
        echo After installation, restart this script.
        echo.
        pause
        exit /b 1
    )
    
    echo.
    echo [SUCCESS] Node.js installed successfully!
    echo.
    echo ========================================
    echo   IMPORTANT: Please restart this script
    echo   to complete the installation.
    echo ========================================
    echo.
    pause
    exit /b 0
)

REM Display Node.js version
echo Detected Node.js version:
node --version
echo.

REM Check if npm is available
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm is not installed or not in PATH.
    echo.
    echo Please ensure npm is installed with Node.js.
    echo.
    pause
    exit /b 1
)

REM Display npm version
echo Detected npm version:
npm --version
echo.

REM Install dependencies
echo ========================================
echo Installing dependencies...
echo ========================================
echo.

call npm install

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to install dependencies.
    echo Please check the error messages above.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   ✅ Installation Complete!
echo ========================================
echo.
echo You can now run 'start-server.bat' to launch Giraffe Terminal.
echo.
echo Frontend will be available at: http://localhost:5173
echo Backend API will be available at: http://localhost:3001
echo.
pause
