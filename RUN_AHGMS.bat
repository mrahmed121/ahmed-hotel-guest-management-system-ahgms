@echo off
REM ============================================================
REM  AHGMS - One-Click Launcher (Hardened v3)
REM  Ahmed Hotel & Guest Management System
REM  "Hospitality, Managed Smarter."
REM  Developed by Ahmed
REM ============================================================
REM  This script is safe to run from ANY directory, including
REM  C:\Windows\System32 (Run as Administrator / double-click).
REM  It always operates on the project folder containing this file.
REM ============================================================

setlocal EnableExtensions EnableDelayedExpansion

REM ---------- 0. Anchor to script directory (CRITICAL) ----------
cd /d "%~dp0"
set "ROOT=%~dp0"
REM Remove trailing backslash for clean joins (ROOT ends with \)
set "ROOT=%ROOT:~0,-1%"

title AHGMS Launcher
if not exist "%ROOT%\logs" mkdir "%ROOT%\logs" 2>nul
set "LOG=%ROOT%\logs\run.log"

echo ============================================================>>"%LOG%" 2>&1
echo [%date% %time%] AHGMS launcher started from %CD%>>"%LOG%" 2>&1

echo ============================================================
echo  AHGMS - Ahmed Hotel & Guest Management System
echo  "Hospitality, Managed Smarter."
echo  Developed by Ahmed
echo ============================================================
echo.
echo  Project root: %ROOT%
echo.

REM ============================================================
REM  STEP 1: Verify project structure (before running anything)
REM ============================================================
echo [1/9] Verifying project structure...
set "STRUCT_OK=1"
if not exist "%ROOT%\backend\composer.json" (
    echo [ERROR] Missing: %ROOT%\backend\composer.json
    set "STRUCT_OK=0"
)
if not exist "%ROOT%\backend\artisan" (
    echo [ERROR] Missing: %ROOT%\backend\artisan
    set "STRUCT_OK=0"
)
if not exist "%ROOT%\frontend\package.json" (
    echo [ERROR] Missing: %ROOT%\frontend\package.json
    set "STRUCT_OK=0"
)
if "%STRUCT_OK%"=="0" (
    echo.
    echo [ERROR] Project structure is incomplete. The files above were not found.
    echo        Make sure this .bat file is in the project root folder.
    echo        Looked in: %ROOT%
    echo [%date% %time%] STRUCTURE CHECK FAILED>>"%LOG%" 2>&1
    pause
    exit /b 1
)
echo [OK] Project structure verified.
echo [%date% %time%] Structure OK>>"%LOG%" 2>&1
echo.

REM ============================================================
REM  STEP 2: Verify tools (php, composer, node, npm)
REM ============================================================
echo [2/9] Checking required tools...
set "TOOLS_OK=1"

where php >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] PHP not found on PATH.
    echo        Install PHP 8.2+: https://www.php.net/downloads
    echo        Then restart this window and try again.
    set "TOOLS_OK=0"
) else (
    for /f "tokens=*" %%v in ('php -v 2^>nul ^| findstr /r "^PHP"') do echo [OK] %%v
)

where composer >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Composer not found on PATH.
    echo        Install: https://getcomposer.org/download/
    set "TOOLS_OK=0"
) else (
    for /f "tokens=3" %%v in ('composer --version 2^>nul') do echo [OK] Composer %%v
)

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found on PATH.
    echo        Install Node.js 18+: https://nodejs.org/
    set "TOOLS_OK=0"
) else (
    for /f "tokens=*" %%v in ('node --version 2^>nul') do echo [OK] Node.js %%v
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm not found on PATH. Install Node.js 18+ which includes npm.
    set "TOOLS_OK=0"
)

if "%TOOLS_OK%"=="0" (
    echo.
    echo [ERROR] Missing required tools. Install them, restart this window, try again.
    echo [%date% %time%] TOOL CHECK FAILED>>"%LOG%" 2>&1
    pause
    exit /b 1
)
echo.

REM ---------- 2b. PHP extensions (RELIABLE via check-env.php) ----------
echo [2b] Checking PHP extensions via scripts\check-env.php...
for /f "tokens=*" %%p in ('where php 2^>nul') do echo    PHP: %%p
set "EXT_LIST="
for /f "tokens=*" %%e in ('php -r "$j=json_decode(file_get_contents(\"backend/composer.json\"),true); foreach(($j[\"require\"]??[]) as $k=>$v){ if(str_starts_with($k,\"ext-\")) echo substr($k,4).\" \"; }" 2^>nul') do set "EXT_LIST=%%e"
set "EXT_LIST=%EXT_LIST% pdo_sqlite"
echo  Required extensions: %EXT_LIST%
php "%ROOT%\scripts\check-env.php" %EXT_LIST% > "%TEMP%\AHGMS-env.txt" 2>&1
set "ENV_EXIT=%ERRORLEVEL%"
findstr /b "EXT:" "%TEMP%\AHGMS-env.txt"
for /f "tokens=1* delims=:" %%a in ('findstr /b "INI_PATH:" "%TEMP%\AHGMS-env.txt" 2^>nul') do echo  Ini:%%b
if "%ENV_EXIT%"=="2" (
    echo [ERROR] No php.ini loaded! Run DOCTOR_AHGMS.bat for details.
    pause & exit /b 1
)
if "%ENV_EXIT%"=="1" (
    echo [ERROR] Missing PHP extensions. Run DOCTOR_AHGMS.bat for fix steps.
    pause & exit /b 1
)
echo [OK] All required PHP extensions loaded.
echo.

REM ============================================================
REM  STEP 3: Backend setup
REM ============================================================
echo [3/9] Setting up backend...
pushd "%ROOT%\backend"
if %errorlevel% neq 0 (
    echo [ERROR] Cannot enter backend directory: %ROOT%\backend
    pause
    exit /b 1
)

REM 3a. Composer dependencies
if not exist "vendor\autoload.php" (
    echo       Installing backend dependencies (first run, takes a few minutes)...
    call composer install --no-interaction --no-progress>>"%LOG%" 2>&1
    if !errorlevel! neq 0 (
        echo [ERROR] composer install failed. Check logs\run.log and your internet connection.
        popd & pause & exit /b 1
    )
    echo [OK] Backend dependencies installed.
) else (
    echo [OK] Backend dependencies already present.
)

REM 3b. .env file
if not exist ".env" (
    echo       Creating backend .env...
    copy /y ".env.example" ".env" >nul
    if !errorlevel! neq 0 (
        echo [ERROR] Cannot copy .env.example to .env
        popd & pause & exit /b 1
    )
    call php artisan key:generate --no-interaction --force>>"%LOG%" 2>&1
    call php artisan jwt:secret --no-interaction --force>>"%LOG%" 2>&1
    echo [OK] .env created with app key.
) else (
    echo [OK] backend\.env exists.
)

REM 3c. SQLite database file
if not exist "database\database.sqlite" (
    echo       Creating SQLite database file...
    type nul > "database\database.sqlite"
    echo [OK] database.sqlite created.
) else (
    echo [OK] database.sqlite exists.
)

REM 3d. Migrations (first run only, via marker file)
if not exist "%ROOT%\logs\.setup-complete" (
    echo       Running migrations and seeders (first run)...
    call php artisan migrate --seed --force --no-interaction>>"%LOG%" 2>&1
    if !errorlevel! neq 0 (
        echo [ERROR] Database migration failed. Check logs\run.log for details.
        popd & pause & exit /b 1
    )
    echo [OK] Database migrated and seeded.
    echo %date% %time% > "%ROOT%\logs\.setup-complete"
) else (
    echo [OK] Database already set up (marker: logs\.setup-complete).
    echo       To reset: delete logs\.setup-complete and database\database.sqlite, then re-run.
)

REM 3e. Storage link (ignore "already exists")
call php artisan storage:link --no-interaction>>"%LOG%" 2>&1

popd
echo.

REM ============================================================
REM  STEP 4: Frontend setup
REM ============================================================
echo [4/9] Setting up frontend...
pushd "%ROOT%\frontend"
if %errorlevel% neq 0 (
    echo [ERROR] Cannot enter frontend directory: %ROOT%\frontend
    pause
    exit /b 1
)

REM 4a. Validate package.json is valid JSON
node -e "require('./package.json')" 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] frontend\package.json is not valid JSON or not readable.
    popd & pause & exit /b 1
)
echo [OK] package.json is valid.

REM 4b. npm dependencies
if not exist "node_modules" (
    echo       Installing frontend dependencies (first run, takes a few minutes)...
    call npm install --no-audit --no-fund>>"%LOG%" 2>&1
    if !errorlevel! neq 0 (
        echo [ERROR] npm install failed. Check logs\run.log and your internet connection.
        popd & pause & exit /b 1
    )
    echo [OK] Frontend dependencies installed.
) else (
    echo [OK] Frontend dependencies already present.
)

popd
echo.

REM ============================================================
REM  STEP 5: Port availability check
REM ============================================================
echo [5/9] Checking ports...
set "BACKEND_PORT=8001"
set "FRONTEND_PORT=5174"

REM Check backend port, find next free if busy
:check_backend_port
netstat -an 2>nul | findstr /r /c:":%BACKEND_PORT% " | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo       Port %BACKEND_PORT% is busy, trying next...
    set /a BACKEND_PORT+=1
    if !BACKEND_PORT! gtr 8010 (
        echo [ERROR] No free port found for backend (tried 8001-8010).
        echo        Stop the conflicting service and try again.
        pause & exit /b 1
    )
    goto :check_backend_port
)
echo [OK] Backend port: %BACKEND_PORT%

:check_frontend_port
netstat -an 2>nul | findstr /r /c:":%FRONTEND_PORT% " | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo       Port %FRONTEND_PORT% is busy, trying next...
    set /a FRONTEND_PORT+=1
    if !FRONTEND_PORT! gtr 5180 (
        echo [ERROR] No free port found for frontend (tried 5174-5180).
        pause & exit /b 1
    )
    goto :check_frontend_port
)
echo [OK] Frontend port: %FRONTEND_PORT%
echo.

REM ---------- 5b. Write frontend .env with ACTUAL backend port ----------
echo       Writing frontend .env with backend port %BACKEND_PORT%...
pushd "%ROOT%\frontend"
echo VITE_API_BASE_URL=http://127.0.0.1:%BACKEND_PORT%/api/v1> ".env"
if !errorlevel! neq 0 (
    echo [ERROR] Cannot write frontend\.env
    popd & pause & exit /b 1
)
echo [OK] frontend\.env points to backend port %BACKEND_PORT%.
popd
echo.

REM ============================================================
REM  STEP 6: Start servers
REM ============================================================
echo [6/9] Starting servers...
echo       Backend:  start "AHGMS Backend" /D "%ROOT%\backend"
start "AHGMS Backend" /D "%ROOT%\backend" cmd /k "php artisan serve --host=127.0.0.1 --port=%BACKEND_PORT%"
echo       Waiting for backend to start...
timeout /t 5 /nobreak >nul

echo       Frontend: start "AHGMS Frontend" /D "%ROOT%\frontend"
start "AHGMS Frontend" /D "%ROOT%\frontend" cmd /k "npm run dev -- --host 127.0.0.1 --port=%FRONTEND_PORT%"
echo       Waiting for frontend to start...
timeout /t 8 /nobreak >nul
echo.

REM ============================================================
REM  STEP 7: Health check + open browser
REM ============================================================
echo [7/9] Verifying backend is responding...
set "HEALTH_OK=0"
for /l %%i in (1,1,6) do (
    curl -s -o nul -w "%%{http_code}" http://127.0.0.1:%BACKEND_PORT%/api/v1/health 2>nul | findstr "200" >nul
    if !errorlevel!==0 ( set "HEALTH_OK=1" & goto :health_done )
    timeout /t 2 /nobreak >nul
)
:health_done
if "%HEALTH_OK%"=="1" (
    echo [OK] Backend health check passed.
) else (
    echo [WARN] Backend did not respond to health check yet - it may still be starting.
    echo       Check the "AHGMS Backend" window for errors.
)
echo.

echo [8/9] Opening browser...
start "" "http://127.0.0.1:%FRONTEND_PORT%"
echo.

REM ============================================================
REM  STEP 9: Summary
REM ============================================================
echo [9/9] Done!
echo ============================================================
echo  AHGMS is running!
echo.
echo  Frontend: http://127.0.0.1:%FRONTEND_PORT%
echo  Backend:  http://127.0.0.1:%BACKEND_PORT%
echo  API:      http://127.0.0.1:%BACKEND_PORT%/api/v1
echo.
echo  Demo login:
echo  Demo: admin@ahmedgrand.local
echo  Password: password123 (demo data only)
echo.
echo  To stop: run STOP_AHGMS.bat, or close the two server windows.
echo  Logs:    logs\run.log
echo ============================================================
echo [%date% %time%] Launcher completed successfully>>"%LOG%" 2>&1
echo.
echo Do NOT close this window while using the app.
echo Press any key to stop the servers and exit.
pause >nul

echo Stopping servers...
taskkill /fi "WINDOWTITLE eq AHGMS Backend*" /f >nul 2>nul
taskkill /fi "WINDOWTITLE eq AHGMS Frontend*" /f >nul 2>nul
echo Done. Servers stopped.
pause
