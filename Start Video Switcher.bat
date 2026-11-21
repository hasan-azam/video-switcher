@echo off
title Video Switcher
cd /d "%~dp0"

rem --- Opened straight from inside the zip? Windows only extracts this one file.
if not exist "server.py" (
  echo.
  echo   Video Switcher can't start from inside the zip file.
  echo.
  echo   1. Close this window.
  echo   2. Right-click the zip file and choose "Extract All...", then click Extract.
  echo   3. Open the new folder and double-click "Start Video Switcher" again.
  echo.
  pause
  exit /b 1
)

del /q server.log 2>nul

rem --- Prefer the Python bundled with this folder, so nothing needs installing.
if exist "runtime\python\python.exe" (
  "runtime\python\python.exe" server.py
  goto :done
)

rem --- Otherwise fall back to a Python already on this computer.
where py >nul 2>nul && (
  py -3 server.py
  goto :done
)
for /f "delims=" %%P in ('where python 2^>nul') do (
  echo %%P | find /i "WindowsApps" >nul || (
    "%%P" server.py
    goto :done
  )
)

echo.
echo   Video Switcher couldn't find the "runtime" folder it needs.
echo.

:done
pause
