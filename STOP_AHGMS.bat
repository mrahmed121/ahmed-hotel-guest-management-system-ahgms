@echo off
REM ============================================================
REM  STOP_AHGMS - Stop Ahmed Hotel & Guest Management System servers
REM  Developed by Ahmed
REM ============================================================
setlocal EnableExtensions
cd /d "%~dp0"

echo Stopping AHGMS servers...
taskkill /fi "WINDOWTITLE eq AHGMS Backend*" /f >nul 2>nul
taskkill /fi "WINDOWTITLE eq AHGMS Frontend*" /f >nul 2>nul

REM Also kill any lingering artisan serve / vite processes for this project
for /f "tokens=2" %%p in ('tasklist /fi "IMAGENAME eq php.exe" /fo csv 2^>nul ^| findstr /i "artisan"') do taskkill /pid %%p /f >nul 2>nul

echo Done. AHGMS servers stopped.
pause
