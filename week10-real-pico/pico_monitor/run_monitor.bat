@echo off
rem Pico serial monitor launcher (double-click)
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 pico_monitor.py
) else (
  python pico_monitor.py
)
if errorlevel 1 pause
