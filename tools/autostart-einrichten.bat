@echo off
rem Startet den Hilfsdienst jetzt und kuenftig bei jeder Windows-Anmeldung (unsichtbar)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0autostart.ps1" einrichten
pause
