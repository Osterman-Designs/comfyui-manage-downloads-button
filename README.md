# ComfyUI Download Manager — Model Download Hub for the New Frontend

A **ComfyUI download manager** bridge: bring **ComfyUI-Manager’s model catalog and download hub** to the **new ComfyUI frontend** without enabling legacy UI. Adds a floating **Manage Downloads** button and a full **model download manager** (Browse, Hugging Face, Civitai, GitHub, direct URL).

Also referred to as the **Manage Downloads Button** / **Manager Bridge** extension.

This is a community extension for [ComfyUI](https://github.com/comfyanonymous/ComfyUI). It is **not** affiliated with or maintained by Comfy-Org. It builds on [ComfyUI-Manager](https://github.com/Comfy-Org/ComfyUI-Manager) (GPL-3.0).

**Search terms:** ComfyUI download manager, ComfyUI model downloads, ComfyUI Manager model catalog, download models new UI, Civitai/Hugging Face import for ComfyUI.

**Continuing development?** See [AGENTS.md](AGENTS.md) and [docs/](docs/) for session handoff, project index, and API reference.

## What you get

- Floating **Manager** button on the graph (configurable)
- **Download Models** hub with tabs:
  - Browse catalog (Manager `model-list.json`)
  - Hugging Face
  - Civitai
  - GitHub (model files + custom node Git URL install)
  - Other URL (direct `.safetensors`, `.ckpt`, `.pt`, etc.)
- Manager power actions: unload models, free memory, restart
- Local API token storage for gated Civitai / Hugging Face downloads
- **Folder quick reference** on import tabs — collapsible cheat sheet for choosing the right model folder

The built-in sidebar **Models** button (Model Library) is unchanged — it still browses local folders only.

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## Requirements

- **Windows** ComfyUI portable layout (primary target)
- ComfyUI started with **`--enable-manager`**
- Pip package **`comfyui-manager`** installed (tested with **4.2.2**)
- ComfyUI frontend **v1.45.x** (new UI)

Re-run setup after upgrading `comfyui-manager` — the installer vendors Manager JS from the pip package.

## Install

1. Open a command prompt and go to your ComfyUI **portable root** (the folder that contains `ComfyUI\`, `python_embeded\`, and `run_nvidia_gpu.bat`):

   ```bat
   cd /d E:\Storage\AI\ComfyUI_windows_portable
   ```

   Use your actual portable path — not your user profile folder.

2. Clone this repo into that folder:

   ```bat
   git clone https://github.com/Osterman-Designs/comfyui-manage-downloads-button.git
   ```

3. From the **same portable root**, run setup:

   ```bat
   comfyui-manage-downloads-button\setup_model_manager.bat
   ```

   You should see `Portable root:` pointing at your portable folder (not `C:\Users\...`). If setup or uninstall targets the wrong folder, `cd` to portable root and run again.

4. To remove the deployed extension later, again from portable root:

   ```bat
   cd /d E:\Storage\AI\ComfyUI_windows_portable
   comfyui-manage-downloads-button\uninstall_model_manager.bat
   ```

   This deletes `custom_nodes/comfy-manager-bridge`, restores `comfyui-manager.orig` if setup renamed it, and reverses an optional pip patch. Saved API tokens are kept.

5. Edit `ComfyUI\user\__manager\config.ini`:

   ```ini
   [default]
   allow_git_url_install = true
   ```

6. Start ComfyUI with `--enable-manager` and **restart** after backend changes. Use **Ctrl+Shift+R** in the browser after JS changes.

### Install via Git URL (ComfyUI Manager)

The repo root **is** the custom node package. ComfyUI Manager can install it directly:

1. Open **Manage extensions** in ComfyUI (requires `--enable-manager`).
2. **Install custom node from Git URL**
3. URL:

   ```
   https://github.com/Osterman-Designs/comfyui-manage-downloads-button.git
   ```

4. Target folder name: **`comfy-manager-bridge`** (recommended)
5. Manager runs **`install.py`** automatically — vendors pip Manager JS into `js/`.
6. Set `allow_git_url_install = true` in `config.ini` if you use Git URL custom node installs.
7. **Restart ComfyUI** and hard refresh the browser.

After a **`comfyui-manager` pip upgrade**, re-run vendoring:

```bat
cd /d ComfyUI\custom_nodes\comfy-manager-bridge
..\..\..\python_embeded\python.exe install.py
```

(or use the portable **clone + setup** path below instead)

### Portable clone + setup (recommended for portable users)

Same as steps 1–6 above — clone as a sibling folder and run `setup_model_manager.bat`, which deploys to `custom_nodes/comfy-manager-bridge` and supports uninstall/reinstall.

## Configure

Edit variables at the top of `tools\setup_model_manager.bat` (or the root wrapper), then re-run setup from your portable root. Setup writes them into `ComfyUI/custom_nodes/comfy-manager-bridge/js/bridge-config.json`.

For a one-off change without re-running setup, edit that `bridge-config.json` directly and hard refresh the browser (`Ctrl+Shift+R`).

### `MANAGER_BTN` — bridge entry point on the canvas

| Value | What you see |
|-------|----------------|
| **`float`** (default) | A draggable **Manager** FAB on the graph. Click it for Download Models, Git URL install, unload/free/restart. |
| **`off`** | No bridge buttons or menu. Backend routes still load, but there is **no UI** to open the download hub. |

**When to use `float`:** Normal use. This is the whole point of the extension — Manager’s download catalog on the new frontend without legacy UI.

**When to use `off`:** Rare. Examples: you only want the backend routes (e.g. testing or automation) and will open nothing in the UI; you’re troubleshooting whether the FAB conflicts with another overlay; or you temporarily want ComfyUI without the extra canvas button but don’t want to uninstall. If you hide the UI, use **Manage extensions** in ComfyUI for custom nodes — you won’t get the download hub from this extension until you switch back to `float` or run uninstall.

### `QUICK_CATALOG` — second FAB (float mode only)

| Value | Meaning |
|-------|---------|
| **`0`** (default) | One **Manager** FAB; Download Models opens from its menu. |
| **`1`** | Adds a second FAB that opens the download hub directly (skips the Manager menu). |

Use `1` if you open the catalog often and want one less click. Ignored when `MANAGER_BTN=off`.

### `APPLY_PIP_PATCH` — where backend routes load from

| Value | Meaning |
|-------|---------|
| **`0`** (default) | Routes load from the deployed custom node (`bridge_backend.py`). Safer across Manager pip upgrades. |
| **`1`** | Patches the pip `comfyui_manager` package instead. Escape hatch if the custom-node path breaks after a Manager update. Re-apply after each Manager upgrade; use uninstall to restore pip files. |

Most users should leave this at **`0`**.

## API tokens

Civitai and Hugging Face tokens are saved locally at:

`ComfyUI/user/__manager/bridge-api-keys.json`

Tokens are never committed to git. Use the Save/Clear controls on each import tab.

## Project layout

```
bridge_routes.py          # Backend routes (deployed as bridge_backend.py)
bridge_api_keys.py        # Token storage + authenticated downloads
extension/comfy-manager-bridge/
  __init__.py
  js/                     # Bridge UI + patched Manager frontend modules
patches/                  # Optional pip-package patch files
setup_model_manager.bat     # Deploy into custom_nodes/comfy-manager-bridge
uninstall_model_manager.bat # Remove deployed extension + undo pip patch
```

Setup copies vendored Manager assets from:

`python_embeded/Lib/site-packages/comfyui_manager/js/`

## Documentation

| Doc | Description |
|-----|-------------|
| [AGENTS.md](AGENTS.md) | Session handoff for contributors and AI agents |
| [CHANGELOG.md](CHANGELOG.md) | Release notes |
| [docs/PROJECT-INDEX.md](docs/PROJECT-INDEX.md) | Complete file inventory and deploy mapping |
| [docs/REFERENCE.md](docs/REFERENCE.md) | HTTP API, config, JS/Python module reference |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Setup/uninstall uses wrong `Portable root:` (e.g. `C:\Users\...`) | `cd /d` to your portable folder first, then run the `.bat` |
| Setup can’t find portable root | Clone repo as a sibling of `ComfyUI\` and `python_embeded\`, then run from that folder |
| Missing manager JS dependency | Install/start ComfyUI once with `--enable-manager` so pip Manager is present |
| Git URL install blocked | Set `allow_git_url_install = true` in `config.ini` and restart |
| Catalog 500 / empty after update | Re-run `setup_model_manager.bat`, restart ComfyUI |
| UI changes not visible | Hard refresh browser (`Ctrl+Shift+R`) |

## License

GPL-3.0-only — see [LICENSE](LICENSE). This project includes modifications to ComfyUI-Manager frontend modules and integrates with the ComfyUI-Manager Python package.

## GitHub SEO (optional)

If you maintain this repo on GitHub, set **About → Description** to something like:

> ComfyUI download manager for the new frontend — model catalog, Civitai, Hugging Face, GitHub, and direct URL imports via ComfyUI-Manager.

Suggested **Topics**: `comfyui`, `comfyui-manager`, `download-manager`, `model-download`, `custom-node`, `huggingface`, `civitai`
