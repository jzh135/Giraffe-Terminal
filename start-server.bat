@echo off
REM Giraffe Terminal - Start Server Script
REM This batch file starts both the backend server and frontend development server

echo ========================================
echo   🦒 Giraffe Terminal Launcher
echo ========================================
echo.

REM Change to the project directory
cd /d "%~dp0"

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [WARNING] node_modules not found!
    echo.
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] Failed to install dependencies.
        echo Please run 'npm install' manually and check for errors.
        pause
        exit /b 1
    )
    echo.
    echo Dependencies installed successfully!
    echo.
)

echo Starting Giraffe Terminal...
echo.
echo Frontend will be available at: http://localhost:5173
echo Backend API will be available at: http://localhost:3001
echo.
echo Press Ctrl+C to stop the servers.
echo ========================================
echo.

REM Start the application (both frontend and backend)
call npm run dev

REM If npm run dev exits, pause so user can see any error messages
if errorlevel 1 (
    echo.
    echo [ERROR] Application failed to start.
)

echo.
echo Server stopped.
pause
