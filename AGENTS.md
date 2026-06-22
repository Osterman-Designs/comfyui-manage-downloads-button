# Agent handoff — ComfyUI Manage Downloads Button

Use this file at the start of a new session when continuing work on this project.

## What this is

Community extension that brings **ComfyUI-Manager’s model download catalog and import hub** to the **new ComfyUI frontend** (without `--enable-manager-legacy-ui`).

- **GitHub:** https://github.com/Osterman-Designs/comfyui-manage-downloads-button
- **Not official** Comfy-Org software. Builds on [ComfyUI-Manager](https://github.com/Comfy-Org/ComfyUI-Manager) (GPL-3.0).
- **User-facing name:** Manage Downloads Button / ComfyUI Download Manager / Manager Bridge

## Author’s environment (reference install)

| Item | Path / value |
|------|----------------|
| Portable root | `E:\Storage\AI\ComfyUI_windows_portable\` |
| Repo source (local) | `E:\Storage\AI\ComfyUI_windows_portable\manager-bridge\` |
| Deployed extension | `ComfyUI\custom_nodes\comfy-manager-bridge\` |
| GitHub clone name | `comfyui-manage-downloads-button` (folder name may differ locally as `manager-bridge`) |
| ComfyUI | 0.25.x, frontend **v1.45.19** |
| Manager pip | **comfyui-manager 4.2.2**, launch with **`--enable-manager`** |
| Manager config | `ComfyUI\user\__manager\config.ini` — `allow_git_url_install = True` |
| Models | Symlink `ComfyUI\models` → `C:\Users\ozman911\AI\models\` via `extra_model_paths.yaml` |
| API tokens | `ComfyUI\user\__manager\bridge-api-keys.json` (never commit) |

**Do not edit** the user’s AI stack launcher scripts (`C:\Users\ozman911\AppData\Roaming\open-webui\*.bat`). Desktop Start/Stop shortcuts are manual only.

## Architecture

```
manager-bridge/                    ← git repo root (source of truth)
├── bridge_routes.py               → deployed as bridge_backend.py
├── bridge_api_keys.py
├── setup_model_manager.bat        → deploy + write bridge-config.json
├── uninstall_model_manager.bat    → remove deploy + undo pip patch
├── extension/comfy-manager-bridge/
│   ├── __init__.py                → loads bridge_backend.enable() if --enable-manager
│   └── js/
│       ├── bridge.js              → FAB + Manager menu
│       ├── model-hub.js           → Download Models dialog + tabs
│       ├── import-url.js          → HF / Civitai / GitHub / Other URL panels
│       ├── bridge-ui.js           → $el / ComfyDialog (no deprecated ui.js)
│       ├── model-manager.js       → patched catalog grid (from pip + local patches)
│       └── bridge-config.json     → generated: button, quickCatalog, defaultModelTab
└── patches/                       → optional APPLY_PIP_PATCH=1 escape hatch
```

Setup **vendors** these from pip Manager: `model-manager.js`, `common.js`, `model-manager.css`, `turbogrid.esm.js`, `comfyui-gui-builder.js`, `popover-helper.js` — then overwrites with repo copies where patched.

Default backend: routes in **custom node** (`bridge_backend.py`). Pip patch mode is off by default.

## Backend routes (bridge only)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v2/externalmodel/getlist` | Model catalog for Browse tab |
| POST | `/v2/manager/queue/batch` | Batch model installs |
| POST | `/v2/customnode/install/git_url` | Git URL custom node install |
| GET/POST | `/v2/manager/bridge/api-keys` | Civitai/HF token storage |
| GET | `/v2/manager/bridge/resolve-filename` | Civitai filename probe |

Downloads use `bridge_api_keys.download_model_file()` (chunked; avoids garbled Windows tqdm in Manager’s `download_url()`).

## Download Models hub tabs

Browse catalog | Hugging Face | Civitai | GitHub | Other URL

Removed by design: Replicate tab, dedicated API Keys tab (tokens on HF/Civitai tabs).

## Install / uninstall (portable)

Always **`cd /d` to portable root** first. Verify output shows correct `Portable root:` (not `C:\Users\...`).

```bat
cd /d E:\Storage\AI\ComfyUI_windows_portable
manager-bridge\setup_model_manager.bat
manager-bridge\uninstall_model_manager.bat
```

After **backend** changes: restart ComfyUI. After **JS** changes: `Ctrl+Shift+R`.

Re-run setup after **comfyui-manager pip upgrades**.

## Configure (`setup_model_manager.bat`)

| Variable | Default | Notes |
|----------|---------|-------|
| `MANAGER_BTN` | `float` | `off` = hide all bridge UI (backend still loads) |
| `QUICK_CATALOG` | `0` | `1` = second FAB opens hub directly |
| `APPLY_PIP_PATCH` | `0` | `1` = patch site-packages (re-apply after Manager upgrades) |

## Testing completed (user session)

| Test | Result |
|------|--------|
| Civitai + API token | OK (test file removed) |
| GitHub model URL | OK (removed) |
| GitHub Git URL custom node | OK (removed) |
| Other URL (Meta SAM `.pt`) | OK (removed) |
| Uninstall → reinstall cycle | OK after portable-root detection fix |
| Browse catalog after reinstall | User confirmed ComfyUI + Hub up |

## Known fixes already shipped

- `_convert_markdown_to_html`: `result_text = text` (catalog 500)
- Civitai URL normalize, filename probe, bearer auth
- Git URL: backslash normalize, inline status (not silent `show_message`)
- `bridge-ui.js` instead of deprecated `scripts/ui.js`
- Portable root detection in setup/uninstall bats
- README: portable `cd`, configure docs, download manager SEO keywords

## Optional follow-ups (not requested / not done)

- Desktop / manual venv `setup.ps1` / `setup.sh`
- Warn when SAM-like files go to `checkpoints` vs `sams`
- “File already exists” before queue (user declined)
- VideoHelperSuite `VHS.core.js` deprecation patch (may be overwritten on git pull)

## Compatibility notes

- **Primary target:** Windows ComfyUI portable (`ComfyUI\` + `python_embeded\`).
- **ComfyUI Desktop:** Same code may work; current `.bat` won’t find paths — needs manual deploy or future PowerShell installer.
- **Legacy Manager UI:** Not supported (`--enable-manager-legacy-ui` is a different stack).

## Git workflow

Repo root = `manager-bridge/` contents. Do not commit deployed `custom_nodes/comfy-manager-bridge/`, tokens, or portable tree.

User prefers: **no commits unless asked**; user did request public GitHub push during session.

## Quick debug checklist

1. Log: `[ComfyUI-Manager-Bridge] Model Manager bridge routes enabled.`
2. `GET /v2/externalmodel/getlist?mode=cache` → 200 + JSON
3. `GET /extensions/comfy-manager-bridge/js/bridge.js` → 200
4. `--enable-manager` on launch
5. Hard refresh after JS deploy
6. Wrong uninstall root → extension still on disk; `cd` to portable root and re-run

## Related projects (not this repo)

- **hayden-cn/ComfyUI-Model-Manager** — third-party local model browser; user disabled in favor of this bridge.
- **Built-in Model Library** — local folders only; sidebar Models button unchanged.
