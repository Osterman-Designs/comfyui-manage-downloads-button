# ComfyUI Manage Downloads Button

Bring **ComfyUI-Manager’s model catalog and download hub** to the **new ComfyUI frontend** without enabling legacy UI.

This is a community extension for [ComfyUI](https://github.com/comfyanonymous/ComfyUI). It is **not** affiliated with or maintained by Comfy-Org. It builds on [ComfyUI-Manager](https://github.com/Comfy-Org/ComfyUI-Manager) (GPL-3.0).

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

The built-in sidebar **Models** button (Model Library) is unchanged — it still browses local folders only.

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

## Configure

Edit variables at the top of `setup_model_manager.bat` before running setup:

| Variable | Default | Meaning |
|----------|---------|---------|
| `MANAGER_BTN` | `float` | `float` = canvas FAB, `off` = hide bridge UI |
| `QUICK_CATALOG` | `0` | `1` = extra Download Models FAB (float mode only) |
| `APPLY_PIP_PATCH` | `0` | `1` = patch pip `comfyui_manager` instead of custom-node backend |

Default backend loads routes from the deployed custom node (`bridge_backend.py`). Pip patch mode is an escape hatch after Manager upgrades.

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
