@echo off
setlocal
title Giraffe Terminal

echo ===============================================================================
echo   🦒 Giraffe Terminal
echo ===============================================================================
echo.

REM Change to the project directory
cd /d "%~dp0"

if not exist "node_modules\" (
    echo [WARNING] Dependencies not found. Running installer first...
    call install.bat
)

echo Starting services...
echo.
echo [Frontend] http://localhost:5173
echo [Backend ] http://localhost:3001
echo.
echo Press Ctrl+C to stop the servers.
echo.

call npm run dev

if errorlevel 1 (
    echo.
    echo [ERROR] Server stopped unexpectedly.
    pause
)
