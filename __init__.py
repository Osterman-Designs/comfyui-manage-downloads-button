# ComfyUI-Manager bridge: Model Manager + power controls on the new UI.
# Backend routes load from bridge_backend.py unless pip patch marker is present.

import os

WEB_DIRECTORY = "./js"

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}


def _enable_bridge_routes():
    try:
        from comfy.cli_args import args
        if not args.enable_manager:
            return
    except Exception:
        return

    if os.path.exists(os.path.join(os.path.dirname(__file__), ".use-pip-backend")):
        return

    try:
        from .bridge_backend import enable
        enable()
    except Exception as e:
        import logging
        logging.error(f"[ComfyUI-Manager-Bridge] Failed to enable routes: {e}")


_enable_bridge_routes()
