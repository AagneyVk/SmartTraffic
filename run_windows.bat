@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo SmartTraffic local launcher
echo ========================================

where py >nul 2>nul
if %errorlevel%==0 (
  set "PY=py"
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo ERROR: Python 3 is not installed or not on PATH.
    pause
    exit /b 1
  )
  set "PY=python"
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js/npm is not installed or not on PATH.
  pause
  exit /b 1
)

if not exist "backend\.venv\Scripts\python.exe" (
  echo [1/4] Creating backend virtual environment...
  %PY% -m venv backend\.venv
  if errorlevel 1 goto :fail
) else (
  echo [1/4] Backend virtual environment already exists.
)

echo [2/4] Installing/updating backend dependencies and bundled Eclipse SUMO...
"backend\.venv\Scripts\python.exe" -m pip install --upgrade pip
"backend\.venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
if errorlevel 1 goto :fail

echo [3/4] Installing/updating frontend dependencies...
pushd frontend
call npm install
if errorlevel 1 (
  popd
  goto :fail
)
popd

echo [4/4] Starting SmartTraffic...
start "SmartTraffic Backend" cmd /k "cd /d ""%~dp0backend"" && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
start "SmartTraffic Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo.
echo SmartTraffic is starting.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
ping 127.0.0.1 -n 4 >nul
start "" http://localhost:5173
exit /b 0

:fail
echo.
echo Setup failed. Check the error above.
pause
exit /b 1
