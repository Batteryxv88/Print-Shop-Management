@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Creating virtual environment...
  python -m venv .venv
)

call .venv\Scripts\activate.bat
python -m pip install -q -r requirements.txt -r requirements-build.txt

echo Building PrinterCounterCollector.exe ...
pyinstaller --noconfirm PrinterCounterCollector.spec
if errorlevel 1 (
  echo dist locked? Retrying to dist_rebuild ...
  pyinstaller --noconfirm --distpath dist_rebuild PrinterCounterCollector.spec
  if errorlevel 1 (
    echo Build failed. Close PrinterCounterCollector.exe and retry.
    exit /b 1
  )
  set OUT=dist_rebuild\PrinterCounterCollector
  goto done_out
)

set OUT=dist\PrinterCounterCollector
:done_out
if not exist "%OUT%\data" mkdir "%OUT%\data"
if not exist "%OUT%\data\config.yaml" (
  if exist "config.example.yaml" copy /Y "config.example.yaml" "%OUT%\data\config.yaml" >nul
)

echo.
echo Ready: %OUT%\PrinterCounterCollector.exe
echo Data folder: %OUT%\data\
endlocal
