@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================================
REM ComfyUI Manager Bridge - setup
REM Run from repo root, tools\, or ComfyUI portable root.
REM ============================================================================

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

REM --- Button layout (uncomment ONE) ---
set "MANAGER_BTN=float"
REM set "MANAGER_BTN=off"

REM --- Optional second Download Models FAB (float mode only; 1=on, 0=off) ---
set "QUICK_CATALOG=0"
REM set "QUICK_CATALOG=1"

REM --- Optional pip patch (uncomment to re-apply after comfyui-manager upgrades) ---
set "APPLY_PIP_PATCH=0"
REM set "APPLY_PIP_PATCH=1"

call :resolve_repo_root "%SCRIPT_DIR%"
if errorlevel 1 exit /b 1

if not defined REPO_ROOT (
  echo ERROR: REPO_ROOT was not resolved.
  exit /b 1
)

call :resolve_python "%REPO_ROOT%"
if errorlevel 1 exit /b 1

set "CMB_MANAGER_BTN=%MANAGER_BTN%"
set "CMB_QUICK_CATALOG=%QUICK_CATALOG%"
set "CMB_APPLY_PIP_PATCH=%APPLY_PIP_PATCH%"

"%PYTHON_EXE%" "%REPO_ROOT%\bridge_install.py" setup
set "RC=%ERRORLEVEL%"

if "%RC%"=="0" (
  echo.
  echo Next steps:
  echo   1. Start ComfyUI with --enable-manager
  echo   2. Set allow_git_url_install = true in ComfyUI\user\__manager\config.ini
  echo   3. Restart ComfyUI after backend updates; Ctrl+Shift+R after JS updates
)

exit /b %RC%

:resolve_repo_root
set "REPO_ROOT="
set "CUR=%~1"
if "%CUR:~-1%"=="\" set "CUR=%CUR:~0,-1%"

:rr_loop
if exist "%CUR%\bridge_install.py" if exist "%CUR%\__init__.py" (
  set "REPO_ROOT=%CUR%"
  exit /b 0
)
for %%P in ("%CUR%\..") do set "PARENT=%%~fP"
if /i "%PARENT%"=="%CUR%" (
  echo ERROR: Could not find repo root containing bridge_install.py and __init__.py
  exit /b 1
)
set "CUR=%PARENT%"
goto rr_loop

:resolve_python
set "PYTHON_EXE="
set "SEARCH_FROM=%~1"
for %%D in ("%SEARCH_FROM%" "%SEARCH_FROM%\.." "%CD%") do (
  call :try_python "%%~fD"
  if defined PYTHON_EXE exit /b 0
)
where python >nul 2>&1
if not errorlevel 1 (
  for /f "delims=" %%P in ('where python 2^>nul') do (
    set "PYTHON_EXE=%%P"
    exit /b 0
  )
)
echo ERROR: Could not find Python. Run from ComfyUI portable root or set PATH.
exit /b 1

:try_python
set "BASE=%~1"
if exist "%BASE%\python_embeded\python.exe" (
  set "PYTHON_EXE=%BASE%\python_embeded\python.exe"
)
exit /b 0
