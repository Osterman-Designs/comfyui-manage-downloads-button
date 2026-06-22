@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================================
REM ComfyUI Manager Bridge - uninstall
REM Removes deployed extension and reverses optional pip patch.
REM Run from this repo folder, or from ComfyUI portable root.
REM ============================================================================

set "BRIDGE_SRC=%~dp0"
if "%BRIDGE_SRC:~-1%"=="\" set "BRIDGE_SRC=%BRIDGE_SRC:~0,-1%"

set "ROOT="
if exist "%BRIDGE_SRC%\bridge_routes.py" (
  pushd "%BRIDGE_SRC%\.."
  if exist "ComfyUI\main.py" if exist "python_embeded\python.exe" set "ROOT=%CD%"
  popd
)
if not defined ROOT (
  if exist "%CD%\ComfyUI\main.py" if exist "%CD%\python_embeded\python.exe" (
    set "ROOT=%CD%"
    if exist "%ROOT%\manager-bridge\bridge_routes.py" set "BRIDGE_SRC=%ROOT%\manager-bridge"
    if exist "%ROOT%\comfyui-manage-downloads-button\bridge_routes.py" set "BRIDGE_SRC=%ROOT%\comfyui-manage-downloads-button"
  )
)

if not defined ROOT (
  echo ERROR: Could not find ComfyUI portable root.
  exit /b 1
)

set "EXT_DST=%ROOT%\ComfyUI\custom_nodes\comfy-manager-bridge"
set "CN_DIR=%ROOT%\ComfyUI\custom_nodes"
set "PIP_PKG=%ROOT%\python_embeded\Lib\site-packages\comfyui_manager"

echo [Manager-Bridge] Portable root: %ROOT%
echo.

if exist "%EXT_DST%" (
  echo [Manager-Bridge] Removing %EXT_DST%
  rmdir /s /q "%EXT_DST%"
) else (
  echo [Manager-Bridge] Deployed extension not found - skipping.
)

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
