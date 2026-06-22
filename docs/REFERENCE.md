# Technical reference

API routes, configuration, JavaScript modules, events, and data formats for **ComfyUI Manage Downloads Button**.

See also: [PROJECT-INDEX.md](PROJECT-INDEX.md) for the full file tree.

---

## HTTP API (bridge backend)

Base: ComfyUI server (default `http://127.0.0.1:8188`). All routes require ComfyUI running with **`--enable-manager`** and bridge routes enabled (log: `[ComfyUI-Manager-Bridge] Model Manager bridge routes enabled.`).

### `GET /v2/externalmodel/getlist`

Model catalog for **Browse catalog** tab.

| Query | Required | Values |
|-------|----------|--------|
| `mode` | yes | Manager DB mode, e.g. `cache`, `local` |

**Response:** JSON `{ "models": [ ... ] }` — each model entry gets HTML-sanitized `name`, `title`, `description` (markdown-ish → `<code>`, `<BR>`).

**Implementation:** `bridge_routes.fetch_externalmodel_list` → `core.get_data_by_mode(..., "model-list.json")` + `model_utils.check_model_installed`.

---

### `POST /v2/manager/queue/batch`

Queue one or more model installs (catalog grid + import tabs).

**Body (JSON):**

```json
{
  "batch_id": "optional-uuid",
  "install_model": [
    {
      "ui_id": "unique-row-id",
      "name": "display name",
      "url": "https://...",
      "filename": "file.safetensors",
      "type": "checkpoint",
      "save_path": "full/path/or/computed"
    }
  ]
}
```

Special: `"filename": "<huggingface>"` triggers `download_repo_in_bytes` for HF repos.

**Response:** `{ "failed": ["ui_id", ...] }`

**Download path:** `bridge_api_keys.download_model_file()` (not Manager `download_url()` — avoids Windows tqdm garble).

**WebSocket:** Progress via `cm-queue-status` events (`in_progress`, `batch-done`, `all-done`).

---

### `POST /v2/customnode/install/git_url`

Install custom node from Git URL (GitHub tab → Install custom node).

| Body | `text/plain` — single Git URL |
| Security | `allow_git_url_install = true` in `config.ini` |
| Response | 200 success/skip; 403 blocked; 400 clone failed |

**Implementation:** `core.gitclone_install(url)`

---

### `GET /v2/manager/bridge/api-keys`

Token **status only** (not values).

**Response:**

```json
{
  "civitai": { "configured": true },
  "huggingface": { "configured": false }
}
```

---

### `POST /v2/manager/bridge/api-keys`

Save or clear tokens. **Localhost listen only** (`403` if not loopback).

**Body:**

```json
{
  "civitai": "token-or-empty-to-clear",
  "huggingface": "hf_..."
}
```

Omit a key to leave unchanged. Empty string removes that provider.

**Storage:** `{USER}/__manager/bridge-api-keys.json`

---

### `GET /v2/manager/bridge/resolve-filename`

Probe remote URL for filename (Civitai Content-Disposition).

| Query | `url` — encoded download URL |
| Response | `{ "filename": "name.safetensors" }` or `{ "filename": null }` |

Uses Civitai/HF bearer headers when configured.

---

## Configuration reference

### `bridge-config.json` (deployed)

Written by `setup_model_manager.bat`:

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| `button` | string | `"float"` | `"float"` = FAB + menu; `"off"` = no bridge UI |
| `quickCatalog` | boolean | `false` | Second FAB opens hub directly (float only) |
| `defaultModelTab` | string | `"browse"` | Initial hub tab id |

**localStorage keys (frontend):**

| Key | Module | Purpose |
|-----|--------|---------|
| `cmb-fab-position` | `bridge.js` | FAB `{ left, bottom }` |
| `cmb-model-hub-last-tab` | `model-hub.js` | Last selected hub tab |
| `cmb-floating-{storageKey}` | `floating-window.js` | Hub dialog geometry |

Hub floating storage key: `cmb-model-hub-geometry` (via `setupFloatingDialog`).

### `setup_model_manager.bat` variables

| Variable | Default | Maps to |
|----------|---------|---------|
| `MANAGER_BTN` | `float` | `bridge-config.json` → `button` |
| `QUICK_CATALOG` | `0` / `1` | `quickCatalog` |
| `APPLY_PIP_PATCH` | `0` / `1` | Pip patch + `.use-pip-backend` marker |

### ComfyUI Manager `config.ini`

| Key | Required for bridge |
|-----|---------------------|
| `allow_git_url_install = true` | Git URL custom node install |
| `security_level` | Model install needs `weak`, `normal`, or `normal-` for `middle+` actions |
| `network_mode = personal_cloud` | Remote access + middle+ installs when not on localhost |

Path: `ComfyUI/user/__manager/config.ini`

---

## JavaScript module reference

### `bridge.js`

| Export / symbol | Description |
|-----------------|-------------|
| Extension `Comfy.ManagerBridge` | Entry point |
| `loadBridgeConfig()` | Fetches `./bridge-config.json` |
| `createStubManager()` | Minimal Manager instance for embedded catalog |
| `openHub(tab?)` | Opens Download Models hub |
| `buildMenuActions()` | Menu items: Download Models, unload, free, restart |
| `createFloatFabs(config)` | Renders `#cmb-fab-stack` |

### `model-hub.js`

| Export | Description |
|--------|-------------|
| `openModelHub({ tab, stubManager })` | Show hub, optional tab id |
| `closeModelHub()` | Hide hub |
| `ModelHub` | Tab bar, embeds catalog, switches import panels |
| `TABS` | `browse`, `huggingface`, `civitai`, `github`, `other` |

Browse tab patches `ModelManager.show/close` to render inside hub instead of standalone dialog.

### `import-url.js`

| Export | Description |
|--------|-------------|
| `createImportPanel(providerId)` | Panel for `huggingface`, `civitai`, `other` |
| `createGitHubPanel(stubManager)` | GitHub model download + Git node install sections |
| `createImportUrlPanel()` | Legacy wrapper if used |
| `fetchModelFolders()` | `GET /experiment/models` → folder dropdown |

**Provider ids:** `huggingface`, `civitai`, `github` (model file section), `other`

**Model extensions accepted:** `.safetensors`, `.sft`, `.ckpt`, `.pth`, `.pt`

**Folder inference:** `FOLDER_INFERENCE_RULES` + `FOLDER_TO_TYPE` map UI folder → Manager `type` field.

**Import queue payload** (per submit):

```json
{
  "install_model": [{
    "ui_id": "<uuid>",
    "name": "<filename>",
    "url": "<https url>",
    "filename": "<filename>",
    "type": "<checkpoint|lora|vae|...>"
  }]
}
```

### `model-manager.js`

| Export | Description |
|--------|-------------|
| `ModelManager` | Catalog grid class |
| `ModelManager.show()` | Load list, open grid |
| `ModelManager.close()` | Close grid |

**Key API calls:**

- `GET /v2/externalmodel/getlist?mode={cache|local|...}`
- `POST /v2/manager/queue/batch`
- `POST /v2/manager/queue/reset`

Listens for `cm-queue-status` WebSocket messages.

### `common.js`

Patched Manager utilities. Notable exports: `setManagerInstance`, `fetchData`, `rebootAPI`, `free_models`, `install_via_git_url`, `infoToast`, `loadCss`, `generateUUID`.

**Change from pip:** imports `$el` from `./bridge-ui.js` instead of `../../scripts/ui.js`.

### `bridge-ui.js`

| Export | Source |
|--------|--------|
| `$el(tag, props, ...children)` | Local DOM helper |
| `ComfyDialog` | `window.comfyAPI.ui.ComfyDialog` |

### `floating-window.js`

| Export | Description |
|--------|-------------|
| `setupFloatingDialog({ dialog, dragHandle, storageKey, onLayoutChange })` | Drag, resize, persist geometry |

### `comfyui-gui-builder.js`

| Export | Description |
|--------|-------------|
| `buildGuiFrameCustomHeader(...)` | Catalog dialog frame |
| `createSettingsCombo(...)` | Channel/mode dropdown in catalog header |

---

## Python module reference

### `bridge_routes.py` / `bridge_backend.py`

| Function | Description |
|----------|-------------|
| `enable()` | Register routes once; log enabled message |
| `_register_routes()` | Decorates aiohttp handlers |
| `_do_install_model(item)` | Single model install in worker |
| `_task_worker()` | Async batch processor |
| `_convert_markdown_to_html(text)` | Catalog description formatting |
| `_populate_markdown(x)` | Sanitize model list entries |

### `bridge_api_keys.py`

| Function | Description |
|----------|-------------|
| `get_key(provider)` | `civitai` \| `huggingface` |
| `get_status()` | Configured flags for UI |
| `update_keys(payload)` | Save/clear tokens |
| `auth_headers_for_url(url)` | Bearer header by host |
| `resolve_download_filename(url)` | HEAD/GET probe |
| `download_model_file(url, save_path)` | 1 MiB chunked download |

---

## WebSocket events

| Event | Direction | Payload highlights |
|-------|-----------|-------------------|
| `cm-queue-status` | Server → client | `status`: `in_progress` \| `batch-done` \| `all-done`; `ui_target`: `model_manager`; `target`, `batch_id`, counts |

Used by `model-manager.js` to update install button state on catalog rows.

---

## CSS class reference (selected)

| Class | Component |
|-------|-----------|
| `#cmb-fab-stack` | Floating button container |
| `.cmb-fab`, `.cmb-fab-primary` | Manager / catalog FABs |
| `#cmb-model-hub-mask` | Modal backdrop |
| `#cmb-model-hub` | Hub dialog |
| `.cmb-model-hub-tab`, `.cmb-tab-active` | Tab bar |
| `.cmb-import-panel` | HF/Civitai/Other forms |
| `.cmb-api-key-row` | Token save/clear UI |
| `.cmb-floating-window` | Draggable hub chrome |

Styles in `bridge.css`.

---

## Security model (summary)

| Action | Policy |
|--------|--------|
| Model install (batch) | `_is_allowed_security_level("middle+")` — localhost or personal_cloud + security level |
| Git URL install | `_dedicated_install_allowed("allow_git_url_install")` |
| API key POST | Loopback listen address only |
| Catalog GET | Same as legacy Manager list (Manager security context) |

---

## Test URLs (manual QA)

| Tab | Example |
|-----|---------|
| Other URL | `https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_tiny.pt` → folder `sams` |
| GitHub model | `https://github.com/madebyollin/taesd/raw/main/taef1_decoder.pth` → `vae_approx` |
| GitHub node | `https://github.com/pythongosssss/ComfyUI-Custom-Scripts.git` |
| Civitai | `/api/download/models/{versionId}` (Copy link address on Download button) |

Remove test files after download verification.

---

## GitHub repository

| Item | Value |
|------|-------|
| URL | https://github.com/Osterman-Designs/comfyui-manage-downloads-button |
| Default branch | `main` |
| License | GPL-3.0-only |
| Suggested topics | `comfyui`, `comfyui-manager`, `download-manager`, `model-download`, `custom-node` |
