@echo off
setlocal EnableDelayedExpansion
title Giraffe Terminal Installer

echo ===============================================================================
echo   🦒 Giraffe Terminal - Installation
echo ===============================================================================
echo.

REM Change to the project directory
cd /d "%~dp0"

echo [STEP 1/5] Checking Environment...
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

REM Check Python (optional - for AI agent)
set PYTHON_FOUND=0
where python >nul 2>nul
if not errorlevel 1 (
    set PYTHON_FOUND=1
    echo   [OK] Python detected:
    for /f "tokens=*" %%i in ('python --version') do echo        Version: %%i
) else (
    echo   [INFO] Python not found (optional - needed for AI agent)
)
echo.

echo [STEP 2/5] Cleaning up old dependencies...
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

echo [STEP 3/5] Installing Node.js Dependencies...
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
echo   [OK] Node.js dependencies installed successfully
echo.

echo [STEP 4/5] Setting up AI Agent (Python)...
echo.

if %PYTHON_FOUND%==1 (
    REM Check if venv already exists
    if exist "agent\venv\Scripts\python.exe" (
        echo   [OK] AI Agent virtual environment already exists
    ) else (
        echo   Creating Python virtual environment...
        python -m venv agent\venv
        
        if errorlevel 1 (
            echo   [WARNING] Failed to create virtual environment
            echo   AI Agent will not be available
        ) else (
            echo   [OK] Virtual environment created
        )
    )
    
    REM Install Python dependencies
    if exist "agent\venv\Scripts\pip.exe" (
        echo   Installing Python dependencies...
        agent\venv\Scripts\pip install -q -r agent\requirements.txt
        
        if errorlevel 1 (
            echo   [WARNING] Failed to install Python dependencies
        ) else (
            echo   [OK] Python dependencies installed
        )
    )
    
    REM Create .env file if it doesn't exist
    if not exist "agent\.env" (
        if exist "agent\.env.example" (
            copy "agent\.env.example" "agent\.env" >nul
            echo   [INFO] Created agent\.env file
            echo          Please add your GOOGLE_API_KEY to enable AI analysis
        )
    ) else (
        echo   [OK] AI Agent .env file exists
    )
) else (
    echo   [SKIP] Python not found - AI Agent will not be installed
    echo          Install Python from https://python.org to enable AI features
)
echo.

echo [STEP 5/5] Finalizing...
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
echo     Frontend:  http://localhost:5173
echo     Backend:   http://localhost:3001
if exist "agent\venv\Scripts\python.exe" (
    echo     AI Agent:  http://localhost:8000
    if not exist "agent\.env" (
        echo.
        echo   ⚠️  Note: Add your GOOGLE_API_KEY to agent\.env to enable AI analysis
    ) else (
        findstr /C:"your-google-api-key-here" "agent\.env" >nul 2>nul
        if not errorlevel 1 (
            echo.
            echo   ⚠️  Note: Replace 'your-google-api-key-here' in agent\.env with your actual API key
        )
    )
)
echo.
pause
