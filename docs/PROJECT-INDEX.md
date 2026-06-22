# Project index

Complete inventory of the **comfyui-manage-downloads-button** repository. Paths are relative to the **repo root** unless noted.

## Repository map

```
comfyui-manage-downloads-button/          (GitHub repo root; local clone may be named manager-bridge/)
├── AGENTS.md                             Session handoff for AI / developers
├── README.md                             User install guide + SEO
├── LICENSE                               GPL-3.0-only
├── .gitignore
├── setup_model_manager.bat               Deploy extension → custom_nodes/comfy-manager-bridge
├── uninstall_model_manager.bat           Remove deploy + undo optional pip patch
├── bridge_routes.py                      Backend HTTP routes (source)
├── bridge_api_keys.py                    Token storage + authenticated downloads
├── docs/
│   ├── PROJECT-INDEX.md                  This file
│   └── REFERENCE.md                      API, config, JS modules, deploy mapping
├── extension/comfy-manager-bridge/       Custom node package (WEB_DIRECTORY = ./js)
│   ├── __init__.py                       Loads bridge_backend on --enable-manager
│   └── js/
│       ├── bridge.js                     Extension entry: FAB, menu, config load
│       ├── bridge.css                    FAB + hub + import panel styles
│       ├── bridge-config.json            Template defaults (overwritten by setup)
│       ├── bridge-ui.js                  $el + ComfyDialog shim (new frontend API)
│       ├── model-hub.js                  Download Models dialog + tab shell
│       ├── import-url.js                 HF / Civitai / GitHub / Other import UI
│       ├── floating-window.js            Draggable/resizable hub geometry
│       ├── model-manager.js              Catalog grid (patched Manager legacy UI)
│       ├── common.js                     Shared Manager helpers (patched imports)
│       └── comfyui-gui-builder.js        Dialog frame builder (patched imports)
└── patches/                              Optional pip-package patch (APPLY_PIP_PATCH=1)
    ├── __init__.py                       Patched comfyui_manager/__init__.py
    └── bridge_routes.py                  Stale copy; live routes use repo bridge_routes.py
```

## Files not in repo (created at runtime)

| Path | Created by |
|------|------------|
| `ComfyUI/custom_nodes/comfy-manager-bridge/` | `setup_model_manager.bat` |
| `ComfyUI/custom_nodes/comfy-manager-bridge/bridge_backend.py` | Copy of `bridge_routes.py` |
| `ComfyUI/custom_nodes/comfy-manager-bridge/.use-pip-backend` | Setup when `APPLY_PIP_PATCH=1` |
| `ComfyUI/user/__manager/bridge-api-keys.json` | Save token in hub UI |
| `patches/__init__.py.original` | First pip patch run (backup) |
| `ComfyUI/custom_nodes/comfyui-manager.orig/` | Setup renames legacy custom_nodes Manager |

## Vendored from pip (not in git)

Copied from `{portable}/python_embeded/Lib/site-packages/comfyui_manager/js/` during setup:

| File | Role |
|------|------|
| `model-manager.css` | Catalog grid styling |
| `turbogrid.esm.js` | TurboGrid table component |
| `popover-helper.js` | Popover utilities |

Repo **overwrites** pip copies of `model-manager.js`, `common.js`, `comfyui-gui-builder.js` with patched versions from `extension/.../js/`.

---

## File reference (by path)

### Root — documentation & legal

| File | Purpose |
|------|---------|
| `AGENTS.md` | New-session context: paths, architecture, constraints, test history |
| `README.md` | End-user install, configure, troubleshoot, GitHub SEO hints |
| `LICENSE` | GPL-3.0-only; notes ComfyUI-Manager derivative |
| `.gitignore` | Excludes tokens, deploy markers, `__pycache__`, pip backup |

### Root — installers

| File | Purpose |
|------|---------|
| `setup_model_manager.bat` | Detect portable root; copy extension; vendor pip JS; write `bridge-config.json`; optional pip patch; rename conflicting `comfyui-manager` |
| `uninstall_model_manager.bat` | Remove `custom_nodes/comfy-manager-bridge`; restore `comfyui-manager.orig`; restore pip `__init__.py` if backed up |

Shared subroutines: `:find_portable_roots`, `:try_portable_root`, `:pick_bridge_src`.

### Root — Python backend (source)

| File | Purpose |
|------|---------|
| `bridge_routes.py` | aiohttp routes, install queue worker, catalog list, Git URL install. Deployed as `bridge_backend.py`. |
| `bridge_api_keys.py` | Read/write `bridge-api-keys.json`; `Authorization: Bearer` for Civitai/HF; chunked `download_model_file()`; filename probe |

### `extension/comfy-manager-bridge/__init__.py`

| Symbol | Behavior |
|--------|----------|
| `WEB_DIRECTORY` | `"./js"` — frontend extension root |
| `_enable_bridge_routes()` | If `--enable-manager` and no `.use-pip-backend`, imports `bridge_backend.enable()` |

### `extension/comfy-manager-bridge/js/` — frontend

| File | Lines (approx) | Role |
|------|----------------|------|
| `bridge.js` | ~490 | Registers `Comfy.ManagerBridge`; loads config; stub Manager; draggable FAB; menu (Download Models, unload, free, restart) |
| `model-hub.js` | ~230 | `ModelHub` class; tabs; embeds `ModelManager` on Browse; import panels on other tabs |
| `import-url.js` | ~810 | Provider configs; folder inference; API key UI; queue batch POST; GitHub model + Git node panels |
| `model-manager.js` | ~850 | `ModelManager` class; TurboGrid catalog; `/v2/externalmodel/getlist`; batch install |
| `common.js` | ~660 | Manager shared UI helpers; patched to use `bridge-ui.js` |
| `comfyui-gui-builder.js` | ~140 | Dialog chrome for catalog grid |
| `bridge-ui.js` | ~6 | `$el` helper; `ComfyDialog` from `window.comfyAPI.ui` |
| `floating-window.js` | ~170 | Persist/restore hub position/size in `localStorage` |
| `bridge.css` | — | FAB stack, hub mask, tabs, import forms, API key badges |
| `bridge-config.json` | — | Template; **deployed copy is authoritative** after setup |

### `patches/` — pip escape hatch

| File | Purpose |
|------|---------|
| `patches/__init__.py` | Replaces pip `comfyui_manager/__init__.py` to load `bridge_routes` from site-packages |
| `patches/bridge_routes.py` | Older duplicate; **not used by default** — setup copies root `bridge_routes.py` to pip when patching |

---

## Deploy artifact mapping

| Repo source | Deployed path |
|-------------|---------------|
| `extension/comfy-manager-bridge/__init__.py` | `custom_nodes/comfy-manager-bridge/__init__.py` |
| `bridge_routes.py` | `custom_nodes/comfy-manager-bridge/bridge_backend.py` |
| `bridge_api_keys.py` | `custom_nodes/comfy-manager-bridge/bridge_api_keys.py` |
| `extension/.../js/*` (bridge files) | `custom_nodes/comfy-manager-bridge/js/*` |
| pip `comfyui_manager/js/*` (6 files) | `custom_nodes/comfy-manager-bridge/js/*` |
| setup-generated JSON | `custom_nodes/comfy-manager-bridge/js/bridge-config.json` |

---

## Extension registration

| Property | Value |
|----------|-------|
| Python package folder | `comfy-manager-bridge` |
| JS extension name | `Comfy.ManagerBridge` (in `bridge.js`) |
| Served URL prefix | `/extensions/comfy-manager-bridge/` |
| Load gate | ComfyUI `--enable-manager` |
| Pip Manager blocklist | Name contains `comfyui-manager-bridge` → **not** disabled |

---

## External dependencies

### Python (runtime)

| Package | Usage |
|---------|--------|
| `comfyui-manager` | `manager_core`, `manager_downloader`, `manager_security`, `model_utils`, queue patterns |
| ComfyUI core | `PromptServer`, `folder_paths`, `comfy.cli_args` |
| stdlib | `aiohttp`, `asyncio`, `urllib` (downloads in bridge_api_keys) |

### JavaScript (runtime)

| Module | Usage |
|--------|--------|
| `../../scripts/app.js` | `app.registerExtension` |
| `../../scripts/api.js` | `api.fetchApi` |
| `window.comfyAPI.ui` | `ComfyDialog` via `bridge-ui.js` |
| TurboGrid | Catalog table in `model-manager.js` |

### Manager routes used but not implemented by bridge

| Route | Provider |
|-------|----------|
| `/v2/manager/reboot` | pip Manager |
| `/v2/manager/queue/reset` | pip Manager |
| `/v2/manager/db_mode` | pip Manager (stub Manager in bridge.js) |
| `/experiment/models` | ComfyUI core (folder list for imports) |
| `/free` | ComfyUI core (unload models) |

---

## Related paths (author install — not in repo)

| Path | Note |
|------|------|
| `E:\Storage\AI\ComfyUI_windows_portable\` | Portable root |
| `run_comfyui_manager_bridge.bat` | Local launcher; calls setup + `--enable-manager` |
| `restore_manager_bridge.bat` | Legacy partial restore; superseded by `uninstall_model_manager.bat` |
| `ComfyUI\user\__manager\config.ini` | `allow_git_url_install`, `security_level`, `network_mode` |

---

## Version pins (tested)

| Component | Version |
|-----------|---------|
| ComfyUI | 0.25.x |
| Frontend | v1.45.19 |
| comfyui-manager (pip) | 4.2.2 |

Re-verify after upgrading Manager pip or ComfyUI frontend.
