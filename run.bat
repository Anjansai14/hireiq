@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo               HireIQ Application Runner
echo ========================================================

cd /d "%~dp0"

echo [1/3] Checking Docker daemon...
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Docker is not running. Attempting to start Docker Desktop...
    if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
        start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    ) else if exist "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe" (
        start "" "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe"
    ) else (
        echo Error: Docker Desktop executable not found. Please start Docker manually.
        pause
        exit /b 1
    )
    echo Waiting for Docker daemon to become ready...
    :wait_docker
    timeout /t 3 /nobreak >nul
    docker info >nul 2>&1
    if %ERRORLEVEL% neq 0 goto wait_docker
    echo Docker daemon is ready!
) else (
    echo Docker daemon is running.
)

if not exist ".env" (
    echo Creating .env from .env.example...
    copy ".env.example" ".env" >nul
)

echo [2/3] Starting backend, database, and AI service containers...
docker compose up -d

echo [3/3] Verifying services...
:wait_api
timeout /t 2 /nobreak >nul
curl -s http://localhost:4000/api/health >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Waiting for API to become ready...
    goto wait_api
)

echo.
echo ========================================================
echo   HireIQ is UP and RUNNING!
echo   - Web Application: http://localhost:4000
echo   - Dev Server:     http://localhost:5173 (run 'npm run dev' in frontend)
echo   - API Health:     http://localhost:4000/api/health
echo   - AI Service:     http://localhost:8001/docs
echo.
echo   Demo Login: anika.rao@peopletech.com / Hireiq@123
echo ========================================================

start http://localhost:4000
pause
