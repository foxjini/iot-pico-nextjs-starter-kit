@echo off
rem Extra circuits test UI launcher (double-click) - HC-SR04 / relay DC motor / PWM LED
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 pico_extra_ui.py
) else (
  python pico_extra_ui.py
)
if errorlevel 1 pause
