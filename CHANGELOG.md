# Changelog

All notable changes to [comfyui-manage-downloads-button](https://github.com/Osterman-Designs/comfyui-manage-downloads-button).

## [Unreleased]

### Added
- **Folder quick reference** on Hugging Face, Civitai, GitHub, and Other URL import tabs — collapsible “Which folder?” cheat sheet under **Install to folder**

### Known limitations
- Folder autopick uses narrow URL/filename rules; generic HF names like `model.safetensors` often stay on default `checkpoints` — use the cheat sheet or pick manually (e.g. CLIP ViT → `clip_vision`)

---

## 2026-06-21 — Git-installable release

### Added
- **Git URL install** — repo root is the custom node package; ComfyUI Manager runs `install.py` to vendor pip Manager JS
- **`bridge_install.py`** — shared setup / install / uninstall logic (used by bats and `install.py`)
- **`tools/setup_model_manager.bat`** and **`tools/uninstall_model_manager.bat`**
- **`docs/PROJECT-INDEX.md`** and **`docs/REFERENCE.md`**
- **`AGENTS.md`** session handoff for contributors and AI agents
- **Uninstall script** — removes deploy, restores optional pip patch, keeps API tokens
- README: Git URL install section, configure docs, download-manager SEO, portable `cd` instructions

### Changed
- **Flattened repo layout** — `__init__.py`, `bridge_backend.py`, `js/` at repo root (was `extension/comfy-manager-bridge/`)
- **`bridge_routes.py`** renamed to **`bridge_backend.py`**
- Setup/uninstall: improved portable root detection; fails clearly when extension path is wrong
- Import tabs: folder hint text; autopick from URL/filename (partial coverage)

### Fixed
- Setup/uninstall no longer targets wrong portable root (e.g. user profile) when run from incorrect cwd
- Catalog list 500 (`_convert_markdown_to_html` missing init) — earlier session
- Civitai/HF token storage, Git URL inline status, deprecated `ui.js` shim — earlier session

### Tested
- Portable: setup, uninstall, reinstall, Browse catalog, Civitai, GitHub, Other URL imports
- Git layout: `install.py`, in-place `bridge_install.py setup`, in-place uninstall (keeps source)
- User confirmed hub running after reinstall

---

## Initial release

- Download Models hub on new ComfyUI frontend (Browse, HF, Civitai, GitHub, Other URL)
- Manager FAB + power menu (unload, free memory, restart)
- Local API token storage for Civitai / Hugging Face
- Tested with ComfyUI 0.25.x, frontend v1.45.19, comfyui-manager 4.2.2
