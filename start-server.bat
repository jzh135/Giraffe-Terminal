@echo off
setlocal EnableDelayedExpansion
title Giraffe Terminal

echo ===============================================================================
echo   🦒 Giraffe Terminal
echo ===============================================================================
echo.

REM Change to the project directory
cd /d "%~dp0"

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [WARNING] Dependencies not found. Running installer first...
    echo.
    call install.bat
    if errorlevel 1 (
        echo.
        echo [ERROR] Installation failed. Cannot start server.
        pause
        exit /b 1
    )
)

REM Check if Node.js is available
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please run install.bat first or install Node.js manually.
    pause
    exit /b 1
)

REM Check if concurrently is installed
if not exist "node_modules\.bin\concurrently.cmd" (
    echo [WARNING] Concurrently not found. Reinstalling dependencies...
    call npm install
)

echo Starting services...
echo.
echo -------------------------------------------------------------------------------
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:3001
echo -------------------------------------------------------------------------------
echo.
echo Press Ctrl+C to stop the servers.
echo.

REM Use npx to ensure concurrently runs correctly
npx concurrently --kill-others-on-fail "npm run server" "npm run client"

if errorlevel 1 (
    echo.
    echo -------------------------------------------------------------------------------
    echo [ERROR] Server stopped unexpectedly.
    echo -------------------------------------------------------------------------------
    echo.
    echo Common issues:
    echo   - Port 3001 or 5173 already in use
    echo   - Missing dependencies (try running install.bat)
    echo   - Database connection issues
    echo.
    pause
)
