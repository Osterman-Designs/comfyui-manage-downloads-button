# Project index

Complete inventory of the **comfyui-manage-downloads-button** repository. The **repo root is the custom node package** (valid for ComfyUI Manager Git URL install).

## Repository map

```
comfyui-manage-downloads-button/     (clone name; local folder may be manager-bridge/)
├── __init__.py                      Custom node entry; loads bridge_backend
├── bridge_backend.py                HTTP routes (formerly bridge_routes.py)
├── bridge_api_keys.py               Token storage + downloads
├── bridge_install.py                Shared install logic (setup + install.py)
├── install.py                       ComfyUI-Manager Git URL install hook
├── js/                              Bridge frontend (see REFERENCE.md)
├── tools/
│   ├── setup_model_manager.bat      Portable deploy / refresh
│   └── uninstall_model_manager.bat
├── setup_model_manager.bat          Wrapper → tools/
├── uninstall_model_manager.bat      Wrapper → tools/
├── patches/                         Optional pip patch (APPLY_PIP_PATCH=1)
├── docs/
│   ├── PROJECT-INDEX.md             This file
│   └── REFERENCE.md
├── AGENTS.md                        Session handoff
├── README.md
└── LICENSE
```

## Install paths

| Method | What happens |
|--------|----------------|
| **Git URL** → `custom_nodes/comfy-manager-bridge` | Manager clones repo; `install.py` vendors pip JS in place |
| **Clone sibling + setup bat** | Deploys repo → `custom_nodes/comfy-manager-bridge` (wipes prior deploy) |
| **`python bridge_install.py setup`** from custom node dir | Refresh in place (Git install layout) |

## Deploy artifact (`custom_nodes/comfy-manager-bridge/`)

Same files as repo root node package, plus generated `js/bridge-config.json` and vendored pip JS:

- `model-manager.css`, `turbogrid.esm.js`, `popover-helper.js` (from pip)
- Overwritten bridge patches: `common.js`, `model-manager.js`, `comfyui-gui-builder.js`

## Files not committed at runtime

| Path | Created by |
|------|------------|
| `ComfyUI/user/__manager/bridge-api-keys.json` | Save token in hub |
| `.use-pip-backend` | Optional pip patch mode |
| `patches/__init__.py.original` | First pip patch backup |

## Vendored from pip (not in git)

From `{portable}/python_embeded/Lib/site-packages/comfyui_manager/js/` (or site-packages on manual installs):

`model-manager.js`, `common.js`, `model-manager.css`, `turbogrid.esm.js`, `comfyui-gui-builder.js`, `popover-helper.js`

Repo **overwrites** the first, third, and sixth with patched copies from `js/` after vendoring.

## Extension registration

| Property | Value |
|----------|-------|
| Folder | `comfy-manager-bridge` |
| JS extension | `Comfy.ManagerBridge` |
| Served at | `/extensions/comfy-manager-bridge/` |
| Load gate | `--enable-manager` |

## Version pins (tested)

| Component | Version |
|-----------|---------|
| ComfyUI | 0.25.x |
| Frontend | v1.45.19 |
| comfyui-manager | 4.2.2 |

See [REFERENCE.md](REFERENCE.md) for API routes, JS modules, and config keys.
