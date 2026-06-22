@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================================
REM ComfyUI Manager Bridge - uninstall
REM Removes deployed extension and reverses optional pip patch.
REM Run from this repo folder, or from ComfyUI portable root.
REM ============================================================================

call :find_portable_roots "%~dp0"
if errorlevel 1 exit /b 1

set "EXT_DST=%ROOT%\ComfyUI\custom_nodes\comfy-manager-bridge"
set "CN_DIR=%ROOT%\ComfyUI\custom_nodes"
set "PIP_PKG=%ROOT%\python_embeded\Lib\site-packages\comfyui_manager"

echo [Manager-Bridge] Portable root: %ROOT%
echo.

if not exist "%EXT_DST%" (
  echo ERROR: Deployed extension not found at:
  echo   %EXT_DST%
  echo Nothing was removed. Run this from your ComfyUI portable folder, for example:
  echo   cd /d E:\Storage\AI\ComfyUI_windows_portable
  echo   manager-bridge\uninstall_model_manager.bat
  exit /b 1
)

echo [Manager-Bridge] Removing %EXT_DST%
rmdir /s /q "%EXT_DST%"

if exist "%CN_DIR%\comfyui-manager.orig" if not exist "%CN_DIR%\comfyui-manager" (
  echo [Manager-Bridge] Restoring custom_nodes\comfyui-manager from comfyui-manager.orig
  ren "%CN_DIR%\comfyui-manager.orig" "comfyui-manager"
) else if exist "%CN_DIR%\comfyui-manager.orig" (
  echo [Manager-Bridge] comfyui-manager already exists - leaving comfyui-manager.orig in place.
)

if exist "%BRIDGE_SRC%\patches\__init__.py.original" (
  echo [Manager-Bridge] Restoring pip comfyui_manager\__init__.py from backup
  copy /Y "%BRIDGE_SRC%\patches\__init__.py.original" "%PIP_PKG%\__init__.py" >nul
) else (
  echo [Manager-Bridge] No pip __init__.py backup - skipping pip restore.
)

if exist "%PIP_PKG%\bridge_routes.py" (
  del /Q "%PIP_PKG%\bridge_routes.py"
  echo [Manager-Bridge] Removed pip bridge_routes.py
)

if exist "%PIP_PKG%\bridge_api_keys.py" (
  del /Q "%PIP_PKG%\bridge_api_keys.py"
  echo [Manager-Bridge] Removed pip bridge_api_keys.py
)

echo.
echo [Manager-Bridge] Uninstall complete.
echo   Saved API tokens in ComfyUI\user\__manager\bridge-api-keys.json were not removed.
echo   Restart ComfyUI to unload the bridge extension.
echo.
exit /b 0

:find_portable_roots
set "ROOT="
set "BRIDGE_SRC="
set "BAT_DIR=%~1"
if "%BAT_DIR:~-1%"=="\" set "BAT_DIR=%BAT_DIR:~0,-1%"

if exist "%BAT_DIR%\bridge_routes.py" (
  call :try_portable_root "%BAT_DIR%\.."
  if defined ROOT set "BRIDGE_SRC=%BAT_DIR%"
)

if not defined ROOT if exist "%BAT_DIR%\ComfyUI\main.py" if exist "%BAT_DIR%\python_embeded\python.exe" (
  set "ROOT=%BAT_DIR%"
  call :pick_bridge_src "%ROOT%"
)

if not defined ROOT if exist "%CD%\ComfyUI\main.py" if exist "%CD%\python_embeded\python.exe" (
  set "ROOT=%CD%"
  call :pick_bridge_src "%ROOT%"
)

if not defined ROOT (
  echo ERROR: Could not find ComfyUI portable root.
  echo   cd to your portable folder first, then run:
  echo     manager-bridge\uninstall_model_manager.bat
  exit /b 1
)

if not defined BRIDGE_SRC (
  echo ERROR: Found portable root %ROOT% but no bridge source folder.
  exit /b 1
)
exit /b 0

:try_portable_root
set "CAND=%~1"
pushd "%CAND%" 2>nul
if errorlevel 1 exit /b 1
if exist "ComfyUI\main.py" if exist "python_embeded\python.exe" set "ROOT=%CD%"
popd
exit /b 0

:pick_bridge_src
set "PR=%~1"
if exist "%PR%\manager-bridge\bridge_routes.py" set "BRIDGE_SRC=%PR%\manager-bridge"
if not defined BRIDGE_SRC if exist "%PR%\comfyui-manage-downloads-button\bridge_routes.py" set "BRIDGE_SRC=%PR%\comfyui-manage-downloads-button"
exit /b 0
