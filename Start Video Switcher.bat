@echo off
cd /d "%~dp0"
del /q server.log 2>nul
python server.py
pause