# Agent handoff — ComfyUI Manage Downloads Button

Use this file at the start of a new session when continuing work on this project.

## Documentation index

| Document | Audience | Contents |
|----------|----------|----------|
| [README.md](README.md) | End users | Install, uninstall, configure, troubleshoot |
| [docs/PROJECT-INDEX.md](docs/PROJECT-INDEX.md) | Developers / agents | Full file tree, deploy mapping, vendored assets, runtime paths |
| [docs/REFERENCE.md](docs/REFERENCE.md) | Developers / agents | HTTP API, config keys, JS/Python symbols, WebSocket events, CSS, security, test URLs |
| **AGENTS.md** (this file) | New AI sessions | Environment, constraints, test history, quick debug |

**New session prompt example:** *Read `AGENTS.md`, `docs/PROJECT-INDEX.md`, and `docs/REFERENCE.md` in Osterman-Designs/comfyui-manage-downloads-button, then …*

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
comfyui-manage-downloads-button/   ← repo root = custom node package (Git URL install)
├── __init__.py                    → loads bridge_backend.enable() if --enable-manager
├── bridge_backend.py              → HTTP routes
├── bridge_api_keys.py
├── bridge_install.py              → shared setup / install / uninstall logic
├── install.py                     → Manager Git URL hook
├── js/                            → bridge.js, model-hub.js, import-url.js, …
├── tools/setup_model_manager.bat  → portable deploy (sibling clone workflow)
└── patches/                       → optional APPLY_PIP_PATCH=1
```

**Two install paths:**

1. **Git URL** → `custom_nodes/comfy-manager-bridge` → `install.py` vendors pip JS in place  
2. **Sibling clone + setup bat** → deploys to `custom_nodes/comfy-manager-bridge`

Setup **vendors** pip Manager JS, then overwrites patched files from `js/`.

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

Or: `python bridge_install.py setup` / `install.py` from the custom node directory (Git install layout).

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
| Flattened Git-installable layout + install.py | OK (install.py, setup, in-place refresh, uninstall) |

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
