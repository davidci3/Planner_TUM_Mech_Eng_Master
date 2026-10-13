@echo off
rem Entfernt den Autostart und beendet den Hilfsdienst
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0autostart.ps1" entfernen
pause
