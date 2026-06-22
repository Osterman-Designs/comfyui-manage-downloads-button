@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================================
REM ComfyUI Manager Bridge - setup
REM Run from this repo folder, or from ComfyUI portable root.
REM ============================================================================

call :find_portable_roots "%~dp0"
if errorlevel 1 exit /b 1
REM float = single Manager FAB floating over the graph canvas (default)
REM off   = hide bridge buttons entirely
set "MANAGER_BTN=float"
REM set "MANAGER_BTN=off"

REM --- Optional second Download Models FAB (float mode only; 1=on, 0=off) ---
set "QUICK_CATALOG=0"
REM set "QUICK_CATALOG=1"

REM --- Optional pip patch (uncomment to re-apply after comfyui-manager upgrades) ---
set "APPLY_PIP_PATCH=0"
REM set "APPLY_PIP_PATCH=1"

set "EXT_SRC=%BRIDGE_SRC%\extension\comfy-manager-bridge"
set "EXT_DST=%ROOT%\ComfyUI\custom_nodes\comfy-manager-bridge"
set "PIP_JS=%ROOT%\python_embeded\Lib\site-packages\comfyui_manager\js"
set "PIP_PKG=%ROOT%\python_embeded\Lib\site-packages\comfyui_manager"
set "CN_DIR=%ROOT%\ComfyUI\custom_nodes"

echo [Manager-Bridge] Portable root: %ROOT%
echo [Manager-Bridge] Source:        %BRIDGE_SRC%
echo [Manager-Bridge] Installing to: %EXT_DST%

if not exist "%EXT_SRC%" (
  echo ERROR: Missing source extension at %EXT_SRC%
  exit /b 1
)

if not exist "%CN_DIR%" mkdir "%CN_DIR%"

if exist "%CN_DIR%\comfyui-manager" if not exist "%CN_DIR%\comfyui-manager.orig" (
  echo [Manager-Bridge] Renaming custom_nodes\comfyui-manager to comfyui-manager.orig
  ren "%CN_DIR%\comfyui-manager" "comfyui-manager.orig"
)

if exist "%EXT_DST%" rmdir /s /q "%EXT_DST%"
mkdir "%EXT_DST%"
mkdir "%EXT_DST%\js"

xcopy /Y /Q "%EXT_SRC%\__init__.py" "%EXT_DST%\" >nul
copy /Y "%BRIDGE_SRC%\bridge_routes.py" "%EXT_DST%\bridge_backend.py" >nul
copy /Y "%BRIDGE_SRC%\bridge_api_keys.py" "%EXT_DST%\bridge_api_keys.py" >nul

for %%F in (model-manager.js common.js model-manager.css turbogrid.esm.js comfyui-gui-builder.js popover-helper.js) do (
  if not exist "%PIP_JS%\%%F" (
    echo ERROR: Missing manager JS dependency: %PIP_JS%\%%F
    echo   Install comfyui-manager via pip and start ComfyUI once with --enable-manager.
    exit /b 1
  )
  copy /Y "%PIP_JS%\%%F" "%EXT_DST%\js\" >nul
)

copy /Y "%EXT_SRC%\js\bridge.js" "%EXT_DST%\js\" >nul
copy /Y "%EXT_SRC%\js\bridge.css" "%EXT_DST%\js\" >nul
copy /Y "%EXT_SRC%\js\model-hub.js" "%EXT_DST%\js\" >nul
copy /Y "%EXT_SRC%\js\floating-window.js" "%EXT_DST%\js\" >nul
copy /Y "%EXT_SRC%\js\import-url.js" "%EXT_DST%\js\" >nul
copy /Y "%EXT_SRC%\js\bridge-ui.js" "%EXT_DST%\js\" >nul
if exist "%EXT_SRC%\js\common.js" copy /Y "%EXT_SRC%\js\common.js" "%EXT_DST%\js\" >nul
if exist "%EXT_SRC%\js\comfyui-gui-builder.js" copy /Y "%EXT_SRC%\js\comfyui-gui-builder.js" "%EXT_DST%\js\" >nul
if exist "%EXT_SRC%\js\model-manager.js" copy /Y "%EXT_SRC%\js\model-manager.js" "%EXT_DST%\js\" >nul

powershell -NoProfile -Command "$qc = '%QUICK_CATALOG%' -eq '1'; $cfg = @{ button = '%MANAGER_BTN%'; quickCatalog = $qc; defaultModelTab = 'browse' } | ConvertTo-Json -Compress; Set-Content -Path '%EXT_DST%\js\bridge-config.json' -Value $cfg -Encoding UTF8" >nul

if "%APPLY_PIP_PATCH%"=="1" (
  echo [Manager-Bridge] Applying optional pip patch to comfyui_manager...

  if not exist "%BRIDGE_SRC%\patches\__init__.py.original" (
    if exist "%PIP_PKG%\__init__.py" (
      copy /Y "%PIP_PKG%\__init__.py" "%BRIDGE_SRC%\patches\__init__.py.original" >nul
      echo [Manager-Bridge] Backed up original __init__.py
    )
  )

  copy /Y "%BRIDGE_SRC%\patches\__init__.py" "%PIP_PKG%\__init__.py" >nul
  copy /Y "%BRIDGE_SRC%\bridge_routes.py" "%PIP_PKG%\bridge_routes.py" >nul
  copy /Y "%BRIDGE_SRC%\bridge_api_keys.py" "%PIP_PKG%\bridge_api_keys.py" >nul
  type nul > "%EXT_DST%\.use-pip-backend"
) else (
  if exist "%EXT_DST%\.use-pip-backend" del /Q "%EXT_DST%\.use-pip-backend"
  echo [Manager-Bridge] Skipping pip patch - routes load from custom node backend.
)

echo.
echo [Manager-Bridge] Setup complete.
echo   Button mode:   %MANAGER_BTN%
echo   Quick catalog: %QUICK_CATALOG%
echo   Pip patch:     %APPLY_PIP_PATCH%
echo.
echo Next steps:
echo   1. Start ComfyUI with --enable-manager
echo   2. Set allow_git_url_install = true in ComfyUI\user\__manager\config.ini
echo   3. Restart ComfyUI after backend updates; Ctrl+Shift+R after JS updates
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
  echo   Clone this repo into your portable folder, then run:
  echo     comfyui-manage-downloads-button\setup_model_manager.bat
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
