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

REM Check if Python AI agent is set up
set AI_AGENT_READY=0
if exist "agent\venv\Scripts\python.exe" (
    if exist "agent\.env" (
        set AI_AGENT_READY=1
    )
)

echo Starting services...
echo.
echo -------------------------------------------------------------------------------
echo   Frontend:  http://localhost:5173
echo   Backend:   http://localhost:3001
if %AI_AGENT_READY%==1 (
    echo   AI Agent:  http://localhost:8000
) else (
    echo   AI Agent:  [Not configured - see agent/README.md]
)
echo -------------------------------------------------------------------------------
echo.
echo Press Ctrl+C to stop the servers.
echo.

REM Start all services with concurrently
if %AI_AGENT_READY%==1 (
    REM Start with AI agent
    npx concurrently --kill-others-on-fail --names "server,client,agent" --prefix-colors "blue,green,magenta" "npm run server" "npm run client" "cd agent && venv\Scripts\python main.py"
) else (
    REM Start without AI agent
    npx concurrently --kill-others-on-fail "npm run server" "npm run client"
)

if errorlevel 1 (
    echo.
    echo -------------------------------------------------------------------------------
    echo [ERROR] Server stopped unexpectedly.
    echo -------------------------------------------------------------------------------
    echo.
    echo Common issues:
    echo   - Port 3001, 5173, or 8000 already in use
    echo   - Missing dependencies (try running install.bat)
    echo   - Database connection issues
    echo   - AI Agent: Missing .env file or GOOGLE_API_KEY
    echo.
    pause
)
