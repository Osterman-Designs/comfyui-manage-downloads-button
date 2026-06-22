"""
Shared install logic for ComfyUI Manager Bridge.

Used by:
  - install.py (ComfyUI-Manager Git URL install)
  - setup_model_manager.bat (portable deploy / refresh)
"""

from __future__ import annotations

import json
import os
import shutil
import sys
from pathlib import Path

PIP_JS_FILES = (
    "model-manager.js",
    "common.js",
    "model-manager.css",
    "turbogrid.esm.js",
    "comfyui-gui-builder.js",
    "popover-helper.js",
)

BRIDGE_JS_FILES = (
    "bridge.js",
    "bridge.css",
    "model-hub.js",
    "floating-window.js",
    "import-url.js",
    "bridge-ui.js",
    "common.js",
    "comfyui-gui-builder.js",
    "model-manager.js",
)

NODE_PY_FILES = (
    "__init__.py",
    "bridge_backend.py",
    "bridge_api_keys.py",
    "install.py",
    "bridge_install.py",
)

SKIP_DEPLOY_NAMES = {
    ".git",
    ".gitignore",
    "docs",
    "tools",
    "patches",
    "LICENSE",
    "README.md",
    "AGENTS.md",
    "setup_model_manager.bat",
    "uninstall_model_manager.bat",
    "bridge_routes.py",
    "__pycache__",
}


def repo_root_from(start: Path | None = None) -> Path:
    start = (start or Path(__file__).resolve()).parent
    markers = ("__init__.py", "bridge_backend.py")
    for directory in (start, *start.parents):
        if all((directory / name).is_file() for name in markers):
            return directory
    raise FileNotFoundError(
        "Could not locate ComfyUI Manager Bridge repo root "
        "(expected __init__.py and bridge_backend.py)."
    )


def find_portable_root(start: Path) -> Path | None:
    for directory in (start, *start.parents):
        if (directory / "ComfyUI" / "main.py").is_file() and (
            directory / "python_embeded" / "python.exe"
        ).is_file():
            return directory
    return None


def custom_nodes_dir(portable_root: Path) -> Path:
    return portable_root / "ComfyUI" / "custom_nodes"


def default_deploy_dir(portable_root: Path) -> Path:
    return custom_nodes_dir(portable_root) / "comfy-manager-bridge"


def is_deployed_node_dir(path: Path) -> bool:
    normalized = path.as_posix().replace("\\", "/").lower()
    return normalized.endswith("/custom_nodes/comfy-manager-bridge")


def find_pip_manager_js_dir(portable_root: Path | None) -> Path:
    if portable_root is not None:
        portable_js = (
            portable_root
            / "python_embeded"
            / "Lib"
            / "site-packages"
            / "comfyui_manager"
            / "js"
        )
        if portable_js.is_dir():
            return portable_js

    try:
        import comfyui_manager

        pkg_js = Path(comfyui_manager.__file__).resolve().parent / "js"
        if pkg_js.is_dir():
            return pkg_js
    except ImportError as exc:
        raise FileNotFoundError(
            "comfyui-manager pip package is not installed. "
            "Install ComfyUI-Manager and launch once with --enable-manager."
        ) from exc

    raise FileNotFoundError("Could not locate comfyui_manager/js in site-packages.")


def write_bridge_config(
    js_dir: Path,
    *,
    button: str = "float",
    quick_catalog: bool = False,
    default_model_tab: str = "browse",
) -> None:
    js_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "button": button,
        "quickCatalog": quick_catalog,
        "defaultModelTab": default_model_tab,
    }
    config_path = js_dir / "bridge-config.json"
    config_path.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")


def vendor_pip_js(pip_js_dir: Path, dest_js_dir: Path) -> None:
    dest_js_dir.mkdir(parents=True, exist_ok=True)
    missing = [name for name in PIP_JS_FILES if not (pip_js_dir / name).is_file()]
    if missing:
        raise FileNotFoundError(
            "Missing Manager JS dependencies in pip package:\n  "
            + "\n  ".join(str(pip_js_dir / name) for name in missing)
        )
    for name in PIP_JS_FILES:
        shutil.copy2(pip_js_dir / name, dest_js_dir / name)


def copy_bridge_js(source_js_dir: Path, dest_js_dir: Path) -> None:
    dest_js_dir.mkdir(parents=True, exist_ok=True)
    missing = [name for name in BRIDGE_JS_FILES if not (source_js_dir / name).is_file()]
    if missing:
        raise FileNotFoundError(
            "Missing bridge JS sources:\n  "
            + "\n  ".join(str(source_js_dir / name) for name in missing)
        )
    for name in BRIDGE_JS_FILES:
        shutil.copy2(source_js_dir / name, dest_js_dir / name)


def copy_node_python_files(source_root: Path, dest_root: Path) -> None:
    dest_root.mkdir(parents=True, exist_ok=True)
    for name in NODE_PY_FILES:
        src = source_root / name
        if src.is_file():
            shutil.copy2(src, dest_root / name)


def rename_legacy_manager(custom_nodes: Path) -> bool:
    legacy = custom_nodes / "comfyui-manager"
    backup = custom_nodes / "comfyui-manager.orig"
    if legacy.is_dir() and not backup.exists():
        legacy.rename(backup)
        print("[Manager-Bridge] Renamed custom_nodes/comfyui-manager to comfyui-manager.orig")
        return True
    return False


def refresh_node(
    node_dir: Path,
    repo_root: Path,
    pip_js_dir: Path,
    *,
    button: str = "float",
    quick_catalog: bool = False,
) -> None:
    """Vendor pip JS + bridge JS into an existing custom node directory."""
    js_dir = node_dir / "js"
    vendor_pip_js(pip_js_dir, js_dir)
    source_js = (repo_root / "js").resolve()
    if source_js != js_dir.resolve():
        copy_bridge_js(source_js, js_dir)
    write_bridge_config(
        js_dir,
        button=button,
        quick_catalog=quick_catalog,
    )
    print(f"[Manager-Bridge] Refreshed JS assets in {node_dir}")


def deploy_from_repo(
    repo_root: Path,
    deploy_dir: Path,
    pip_js_dir: Path,
    *,
    button: str = "float",
    quick_catalog: bool = False,
    rename_legacy: bool = True,
    portable_root: Path | None = None,
) -> None:
    if portable_root is not None and rename_legacy:
        rename_legacy_manager(custom_nodes_dir(portable_root))

    if deploy_dir.exists():
        shutil.rmtree(deploy_dir)
    deploy_dir.mkdir(parents=True, exist_ok=True)

    copy_node_python_files(repo_root, deploy_dir)
    (deploy_dir / "js").mkdir(parents=True, exist_ok=True)
    refresh_node(
        deploy_dir,
        repo_root,
        pip_js_dir,
        button=button,
        quick_catalog=quick_catalog,
    )
    print(f"[Manager-Bridge] Deployed extension to {deploy_dir}")


def apply_pip_patch(repo_root: Path, portable_root: Path, deploy_dir: Path) -> None:
    pip_pkg = (
        portable_root / "python_embeded" / "Lib" / "site-packages" / "comfyui_manager"
    )
    patches_dir = repo_root / "patches"
    backup = patches_dir / "__init__.py.original"
    if not backup.is_file() and (pip_pkg / "__init__.py").is_file():
        patches_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(pip_pkg / "__init__.py", backup)
        print("[Manager-Bridge] Backed up pip comfyui_manager/__init__.py")

    shutil.copy2(patches_dir / "__init__.py", pip_pkg / "__init__.py")
    shutil.copy2(repo_root / "bridge_backend.py", pip_pkg / "bridge_routes.py")
    shutil.copy2(repo_root / "bridge_api_keys.py", pip_pkg / "bridge_api_keys.py")
    (deploy_dir / ".use-pip-backend").touch()
    print("[Manager-Bridge] Applied optional pip patch.")


def clear_pip_patch(deploy_dir: Path) -> None:
    marker = deploy_dir / ".use-pip-backend"
    if marker.exists():
        marker.unlink()


def resolve_install_targets(
    repo_root: Path | None = None,
    portable_root: Path | None = None,
) -> tuple[Path, Path, Path, Path | None]:
    repo_root = repo_root or repo_root_from()
    portable_root = portable_root or find_portable_root(repo_root)
    pip_js_dir = find_pip_manager_js_dir(portable_root)

    if portable_root is None:
        raise FileNotFoundError(
            "Could not find ComfyUI portable root (ComfyUI/main.py + python_embeded/python.exe)."
        )

    deploy_dir = default_deploy_dir(portable_root)

    if is_deployed_node_dir(repo_root.resolve()):
        return repo_root, portable_root, pip_js_dir, deploy_dir

    return repo_root, portable_root, pip_js_dir, deploy_dir


def run_setup(
    *,
    button: str = "float",
    quick_catalog: bool = False,
    apply_pip_patch: bool = False,
    repo_root: Path | None = None,
    portable_root: Path | None = None,
) -> int:
    repo_root = repo_root or repo_root_from()
    repo_root = repo_root.resolve()
    portable_root = portable_root or find_portable_root(repo_root)
    if portable_root is None:
        print(
            "ERROR: Could not find ComfyUI portable root.\n"
            "  cd to your portable folder, then run setup_model_manager.bat",
            file=sys.stderr,
        )
        return 1

    pip_js_dir = find_pip_manager_js_dir(portable_root)
    deploy_dir = default_deploy_dir(portable_root)

    print(f"[Manager-Bridge] Portable root: {portable_root}")
    print(f"[Manager-Bridge] Repo/source:     {repo_root}")

    if is_deployed_node_dir(repo_root):
        print(f"[Manager-Bridge] Git install detected - refreshing in place: {repo_root}")
        refresh_node(
            repo_root,
            repo_root,
            pip_js_dir,
            button=button,
            quick_catalog=quick_catalog,
        )
        target = repo_root
    else:
        print(f"[Manager-Bridge] Installing to: {deploy_dir}")
        deploy_from_repo(
            repo_root,
            deploy_dir,
            pip_js_dir,
            button=button,
            quick_catalog=quick_catalog,
            rename_legacy=True,
            portable_root=portable_root,
        )
        target = deploy_dir

    if apply_pip_patch:
        apply_pip_patch_fn(repo_root, portable_root, target)
    else:
        clear_pip_patch(target)
        print("[Manager-Bridge] Skipping pip patch - routes load from custom node backend.")

    print()
    print("[Manager-Bridge] Setup complete.")
    print(f"  Button mode:   {button}")
    print(f"  Quick catalog: {int(quick_catalog)}")
    print(f"  Pip patch:     {int(apply_pip_patch)}")
    return 0


def apply_pip_patch_fn(repo_root: Path, portable_root: Path, deploy_dir: Path) -> None:
    apply_pip_patch(repo_root, portable_root, deploy_dir)


def run_install_py() -> int:
    """Entry point for ComfyUI-Manager install.py (Git URL install)."""
    repo_root = repo_root_from()
    portable_root = find_portable_root(repo_root)
    try:
        pip_js_dir = find_pip_manager_js_dir(portable_root)
    except FileNotFoundError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(f"[Manager-Bridge] install.py running in {repo_root}")
    refresh_node(repo_root, repo_root, pip_js_dir)
    clear_pip_patch(repo_root)
    print("[Manager-Bridge] install.py complete. Restart ComfyUI and hard refresh the browser.")
    return 0


def run_uninstall(
    *,
    repo_root: Path | None = None,
    portable_root: Path | None = None,
    remove_deploy: bool = True,
) -> int:
    repo_root = repo_root or repo_root_from()
    portable_root = portable_root or find_portable_root(repo_root)
    if portable_root is None:
        print("ERROR: Could not find ComfyUI portable root.", file=sys.stderr)
        return 1

    deploy_dir = default_deploy_dir(portable_root)
    pip_pkg = (
        portable_root / "python_embeded" / "Lib" / "site-packages" / "comfyui_manager"
    )
    custom_nodes = custom_nodes_dir(portable_root)

    print(f"[Manager-Bridge] Portable root: {portable_root}")

    in_place = is_deployed_node_dir(repo_root.resolve())

    if remove_deploy:
        if in_place:
            print(
                "[Manager-Bridge] Git install detected - removing vendored pip JS only "
                "(keeping extension source)."
            )
            js_dir = repo_root / "js"
            for name in PIP_JS_FILES:
                path = js_dir / name
                if path.is_file():
                    path.unlink()
            marker = repo_root / ".use-pip-backend"
            if marker.exists():
                marker.unlink()
        elif deploy_dir.is_dir():
            print(f"[Manager-Bridge] Removing {deploy_dir}")
            shutil.rmtree(deploy_dir)
        else:
            print(f"ERROR: Deployed extension not found at:\n  {deploy_dir}", file=sys.stderr)
            return 1

    backup = repo_root / "patches" / "__init__.py.original"
    if backup.is_file() and (pip_pkg / "__init__.py").is_file():
        shutil.copy2(backup, pip_pkg / "__init__.py")
        print("[Manager-Bridge] Restored pip comfyui_manager/__init__.py from backup.")
    else:
        print("[Manager-Bridge] No pip __init__.py backup - skipping pip restore.")

    for name in ("bridge_routes.py", "bridge_api_keys.py"):
        path = pip_pkg / name
        if path.is_file():
            path.unlink()
            print(f"[Manager-Bridge] Removed pip {name}")

    legacy = custom_nodes / "comfyui-manager"
    backup_dir = custom_nodes / "comfyui-manager.orig"
    if backup_dir.is_dir() and not legacy.exists():
        backup_dir.rename(legacy)
        print("[Manager-Bridge] Restored custom_nodes/comfyui-manager from comfyui-manager.orig")

    print()
    print("[Manager-Bridge] Uninstall complete.")
    print("  Saved API tokens in ComfyUI/user/__manager/bridge-api-keys.json were not removed.")
    print("  Restart ComfyUI to unload the bridge extension.")
    return 0


def _parse_bool(value: str) -> bool:
    return value.strip().lower() in ("1", "true", "yes", "on")


def main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description="ComfyUI Manager Bridge installer")
    sub = parser.add_subparsers(dest="command", required=True)

    setup = sub.add_parser("setup", help="Deploy or refresh the bridge extension")
    setup.add_argument("--button", default=os.environ.get("CMB_MANAGER_BTN", "float"))
    setup.add_argument(
        "--quick-catalog",
        default=os.environ.get("CMB_QUICK_CATALOG", "0"),
    )
    setup.add_argument(
        "--pip-patch",
        default=os.environ.get("CMB_APPLY_PIP_PATCH", "0"),
    )

    sub.add_parser("install", help="Manager Git URL install hook")

    uninstall = sub.add_parser("uninstall", help="Remove deployed extension")
    uninstall.add_argument(
        "--keep-git-source",
        action="store_true",
        help="When installed via Git URL, only remove vendored pip JS",
    )

    args = parser.parse_args(argv)

    if args.command == "setup":
        return run_setup(
            button=args.button,
            quick_catalog=_parse_bool(str(args.quick_catalog)),
            apply_pip_patch=_parse_bool(str(args.pip_patch)),
        )
    if args.command == "install":
        return run_install_py()
    if args.command == "uninstall":
        return run_uninstall()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
