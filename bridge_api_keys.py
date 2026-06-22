"""Local API key storage for Manager Bridge imports (Civitai, Hugging Face)."""

import json
import logging
import os
import threading
from typing import Any

_lock = threading.Lock()
_keys: dict[str, str] | None = None
_keys_path: str | None = None

PROVIDERS = ("civitai", "huggingface")


def _resolve_keys_path() -> str:
    global _keys_path
    if _keys_path:
        return _keys_path

    try:
        import folder_paths

        manager_dir = folder_paths.get_system_user_directory("manager")
    except Exception:
        manager_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "..", "user", "__manager"
        )

    os.makedirs(manager_dir, exist_ok=True)
    _keys_path = os.path.join(manager_dir, "bridge-api-keys.json")
    return _keys_path


def _load_keys() -> dict[str, str]:
    global _keys
    if _keys is not None:
        return _keys

    path = _resolve_keys_path()
    data: dict[str, str] = {}
    if os.path.isfile(path):
        try:
            with open(path, encoding="utf-8") as f:
                raw = json.load(f)
            if isinstance(raw, dict):
                for provider in PROVIDERS:
                    value = raw.get(provider)
                    if isinstance(value, str) and value.strip():
                        data[provider] = value.strip()
        except Exception as e:
            logging.warning(f"[Manager-Bridge] Could not read API keys file: {e}")

    _keys = data
    return _keys


def _save_keys(data: dict[str, str]) -> None:
    global _keys
    path = _resolve_keys_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    _keys = dict(data)


def get_key(provider: str) -> str | None:
    if provider not in PROVIDERS:
        return None
    value = _load_keys().get(provider)
    return value or None


def get_status() -> dict[str, Any]:
    keys = _load_keys()
    return {
        provider: {"configured": bool(keys.get(provider))}
        for provider in PROVIDERS
    }


def update_keys(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Expected JSON object.")

    with _lock:
        keys = dict(_load_keys())
        for provider in PROVIDERS:
            if provider not in payload:
                continue
            value = payload.get(provider)
            if value is None:
                continue
            if not isinstance(value, str):
                raise ValueError(f"Invalid value for {provider}.")
            trimmed = value.strip()
            if trimmed:
                keys[provider] = trimmed
            elif provider in keys:
                del keys[provider]
        _save_keys(keys)
        return get_status()


def auth_headers_for_url(url: str) -> dict[str, str]:
    if not url:
        return {}

    lower = url.lower()
    if "civitai.com" in lower or "civitai.red" in lower:
        token = get_key("civitai")
        if token:
            return {"Authorization": f"Bearer {token}"}
    if "huggingface.co" in lower:
        token = get_key("huggingface")
        if token:
            return {"Authorization": f"Bearer {token}"}
    return {}


DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _filename_from_content_disposition(value: str | None) -> str | None:
    if not value:
        return None

    import re

    match = re.search(r"filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?", value, re.I)
    raw = match.group(1) if match and match.group(1) else (match.group(2) if match else None)
    if not raw:
        return None

    from urllib.parse import unquote

    return unquote(raw.strip())


def resolve_download_filename(url: str) -> str | None:
    import urllib.error
    import urllib.request

    headers = {"User-Agent": DEFAULT_USER_AGENT}
    headers.update(auth_headers_for_url(url))

    for method in ("HEAD", "GET"):
        try:
            probe_headers = dict(headers)
            if method == "GET":
                probe_headers["Range"] = "bytes=0-0"
            req = urllib.request.Request(url, headers=probe_headers, method=method)
            with urllib.request.urlopen(req) as response:
                filename = _filename_from_content_disposition(
                    response.headers.get("Content-Disposition")
                )
                if filename:
                    return filename
        except urllib.error.HTTPError as e:
            filename = _filename_from_content_disposition(e.headers.get("Content-Disposition"))
            if filename:
                return filename
        except Exception as e:
            logging.debug(f"[Manager-Bridge] Could not probe filename ({method}) for {url}: {e}")

    return None


def download_model_file(url: str, save_path: str) -> bool:
    import sys
    import urllib.request

    headers = {"User-Agent": DEFAULT_USER_AGENT}
    headers.update(auth_headers_for_url(url))

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            parent = os.path.dirname(save_path)
            if parent:
                os.makedirs(parent, exist_ok=True)

            total_bytes = 0
            with open(save_path, "wb") as f:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    f.write(chunk)
                    total_bytes += len(chunk)

        logging.info(
            f"[Manager-Bridge] Download complete: {os.path.basename(save_path)} ({total_bytes:,} bytes)"
        )
        return True
    except Exception as e:
        print(f"Download error: {url} / {e}", file=sys.stderr)
        logging.error(f"[Manager-Bridge] Download failed for {url}: {e}")
        return False
