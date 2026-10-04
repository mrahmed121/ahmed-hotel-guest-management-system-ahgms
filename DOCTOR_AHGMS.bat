@echo off
REM ============================================================
REM  DOCTOR_AHGMS - Environment diagnostics
REM  ahgms — Developed by Ahmed
REM ============================================================
REM  Run this and paste the output when asking for support.
REM ============================================================
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

echo ============================================================
echo  DOCTOR_AHGMS — Environment Diagnostics
echo  ahgms
echo ============================================================
echo.
echo [Project]
echo   Root: %ROOT%
echo   Backend: %ROOT%\backend\composer.json — %~z0 bytes
if exist "%ROOT%\backend\composer.json" (echo   [OK] composer.json exists) else (echo   [MISSING] composer.json)
if exist "%ROOT%\backend\artisan" (echo   [OK] artisan exists) else (echo   [MISSING] artisan)
if exist "%ROOT%\frontend\package.json" (echo   [OK] package.json exists) else (echo   [MISSING] package.json)
if exist "%ROOT%\scripts\check-env.php" (echo   [OK] check-env.php exists) else (echo   [MISSING] check-env.php)
echo.
echo [PHP]
where php 2>nul
if %errorlevel% neq 0 (
    echo   [ERROR] php not found in PATH
) else (
    echo   --- where php ---
    where php
    echo   --- php -v ---
    php -v 2>&1 | findstr /r "^PHP"
    echo   --- php --ini ---
    php --ini 2>&1 | findstr /i "loaded\|path"
)
echo.
echo [PHP Extensions via check-env.php]
if exist "%ROOT%\scripts\check-env.php" (
    php "%ROOT%\scripts\check-env.php" pdo_sqlite mbstring openssl fileinfo curl zip 2>&1
) else (
    echo   check-env.php not found
)
echo.
echo [Composer]
where composer 2>nul >nul && (composer --version 2>&1) || echo   [ERROR] composer not found
echo.
echo [Node.js]
where node 2>nul >nul && (node --version 2>&1) || echo   [ERROR] node not found
where npm 2>nul >nul && (npm --version 2>&1) || echo   [ERROR] npm not found
echo.
echo [Database]
if exist "%ROOT%\backend\database\database.sqlite" (
    echo   [OK] database.sqlite exists (%~z0 bytes)
    for %%f in ("%ROOT%\backend\database\database.sqlite") do echo   Size: %%~zf bytes, Modified: %%~tf
) else (
    echo   [MISSING] database.sqlite (will be created on first run)
)
echo.
echo [Environment files]
if exist "%ROOT%\backend\.env" (echo   [OK] backend\.env exists) else (echo   [MISSING] backend\.env)
if exist "%ROOT%\frontend\.env" (echo   [OK] frontend\.env exists) else (echo   [MISSING] frontend\.env)
if exist "%ROOT%\backend\.env" (
    echo   --- backend .env (DB only, secrets hidden) ---
    findstr /i "DB_CONNECTION DB_DATABASE APP_ENV APP_DEBUG" "%ROOT%\backend\.env" 2>nul
)
echo.
echo [Ports]
for %%p in (8001 5174) do (
    netstat -an 2>nul | findstr /r /c:":%%p " | findstr "LISTENING" >nul
    if !errorlevel!==0 (echo   Port %%p: BUSY) else (echo   Port %%p: FREE)
)
echo.
echo [Setup marker]
if exist "%ROOT%\logs\.setup-complete" (echo   [OK] First-run setup completed) else (echo   [PENDING] First-run setup not done)
echo.
echo ============================================================
echo  End of diagnostics. Paste this output when asking for help.
echo ============================================================
pause
