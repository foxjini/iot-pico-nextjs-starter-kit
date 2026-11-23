@echo off
rem Assessment circuit test UI launcher (double-click) - joystick / stepper / I2C LCD / RFID-RC522
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 pico_assess_ui.py
) else (
  python pico_assess_ui.py
)
if errorlevel 1 pause
