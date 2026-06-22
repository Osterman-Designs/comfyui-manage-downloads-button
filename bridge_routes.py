"""
ComfyUI-Manager bridge routes for Model Manager + Git URL install on the new UI.

Registers only routes that glob/manager_server.py does not provide:
  GET  /v2/externalmodel/getlist
  POST /v2/manager/queue/batch   (install_model batches for model-manager.js)
  POST /v2/customnode/install/git_url
  GET  /v2/manager/bridge/api-keys
  POST /v2/manager/bridge/api-keys
  GET  /v2/manager/bridge/resolve-filename
"""

import asyncio
import concurrent.futures
import ipaddress
import logging
import os
import threading
import traceback
from collections import deque

from aiohttp import web
from comfy.cli_args import args
from server import PromptServer

from comfyui_manager.common import manager_downloader, manager_security, manager_util
from comfyui_manager.glob import manager_core as core
from comfyui_manager.glob.utils import model_utils

try:
    from . import bridge_api_keys
except ImportError:
    import bridge_api_keys

routes = PromptServer.instance.routes
_enabled = False

SECURITY_MESSAGE_FLAG_GIT_URL = (
    "ERROR: This action requires 'allow_git_url_install = true' in config.ini ([default] section)."
)


def _is_loopback(address):
    try:
        return ipaddress.ip_address(address).is_loopback
    except ValueError:
        return False


_is_local_mode = _is_loopback(args.listen)


def _is_allowed_security_level(level):
    is_personal_cloud = core.get_config()["network_mode"].lower() == "personal_cloud"

    if level == "middle+":
        if _is_local_mode or is_personal_cloud:
            return core.get_config()["security_level"] in ["weak", "normal", "normal-"]
        return False
    if level == "middle":
        return core.get_config()["security_level"] in ["weak", "normal", "normal-"]
    return True


def _dedicated_install_allowed(flag_key: str) -> bool:
    return manager_security.is_dedicated_install_allowed(
        core.get_config()[flag_key], args.listen, core.get_config()["network_mode"]
    )


def _convert_markdown_to_html(text):
    result_text = text
    code_pattern = r"`([^`]+)`"
    while True:
        match = __import__("re").search(code_pattern, result_text)
        if not match:
            break
        code_content = match.group(1)
        result_text = result_text.replace(
            f"`{code_content}`", f"<code>{code_content}</code>", 1
        )
    return result_text.replace("\n", "<BR>")


def _populate_markdown(x):
    if "description" in x:
        x["description"] = _convert_markdown_to_html(
            manager_util.sanitize_tag(x["description"])
        )
    if "name" in x:
        x["name"] = manager_util.sanitize_tag(x["name"])
    if "title" in x:
        x["title"] = manager_util.sanitize_tag(x["title"])


class TaskBatch:
    def __init__(self, batch_json, tasks, failed):
        self.nodepack_result = {}
        self.model_result = {}
        self.batch_id = batch_json.get("batch_id") if batch_json is not None else None
        self.batch_json = batch_json
        self.tasks = tasks
        self.current_index = 0
        self.stats = {}
        self.failed = failed if failed is not None else set()

    def is_done(self):
        return len(self.tasks) <= self.current_index

    def get_next(self):
        if self.is_done():
            return None
        item = self.tasks[self.current_index]
        self.current_index += 1
        return item

    def done_count(self):
        return len(self.nodepack_result) + len(self.model_result)

    def total_count(self):
        return len(self.tasks)


temp_queue_batch = []
task_batch_queue = deque()
tasks_in_progress = set()
task_worker_lock = threading.Lock()
task_worker_thread = None


def _finalize_temp_queue_batch(batch_json=None, failed=None):
    global temp_queue_batch
    if len(temp_queue_batch):
        batch = TaskBatch(batch_json, temp_queue_batch, failed)
        task_batch_queue.append(batch)
        temp_queue_batch = []


def _queue_start():
    global task_worker_thread
    if task_worker_thread is not None and task_worker_thread.is_alive():
        return web.Response(status=201)

    task_worker_thread = threading.Thread(target=lambda: asyncio.run(_task_worker()))
    task_worker_thread.start()
    return web.Response(status=200)


async def _do_install_model(item) -> str:
    ui_id, json_data = item
    model_path = model_utils.get_model_path(json_data)
    model_url = json_data["url"]
    res = False

    try:
        if model_path is not None:
            logging.info(
                f"[Manager-Bridge] Install model '{json_data['name']}' from '{model_url}' into '{model_path}'"
            )

            if json_data["filename"] == "<huggingface>":
                if os.path.exists(
                    os.path.join(model_path, os.path.dirname(json_data["url"]))
                ):
                    return f"The model path already exists: {model_path}"

                manager_downloader.download_repo_in_bytes(
                    repo_id=model_url, local_dir=model_path
                )
                return "success"

            res = bridge_api_keys.download_model_file(model_url, model_path)
            if res and model_path.endswith(".zip"):
                res = core.unzip(model_path)
        else:
            return f"Model installation error: invalid model type - {json_data['type']}"

        if res:
            return "success"
    except Exception as e:
        logging.error(f"[Manager-Bridge] ERROR: {e}")

    return f"Model installation error: {model_url}"


async def _task_worker():
    global task_batch_queue

    while True:
        with task_worker_lock:
            if len(task_batch_queue) > 0:
                cur_batch = task_batch_queue[0]
            else:
                PromptServer.instance.send_sync("cm-queue-status", {"status": "all-done"})
                return

        if cur_batch.is_done():
            res = {
                "status": "batch-done",
                "nodepack_result": cur_batch.nodepack_result,
                "model_result": cur_batch.model_result,
                "total_count": cur_batch.total_count(),
                "done_count": cur_batch.done_count(),
                "batch_id": cur_batch.batch_id,
                "remaining_batch_count": len(task_batch_queue),
            }
            PromptServer.instance.send_sync("cm-queue-status", res)
            with task_worker_lock:
                task_batch_queue.popleft()
            continue

        with task_worker_lock:
            kind, item = cur_batch.get_next()
            tasks_in_progress.add((kind, item[0]))

        try:
            if kind == "install-model":
                msg = await _do_install_model(item)
            else:
                msg = f"Unexpected kind: {kind}"
        except Exception:
            traceback.print_exc()
            msg = f"Exception: {(kind, item)}"

        with task_worker_lock:
            tasks_in_progress.remove((kind, item[0]))

        ui_id = item[0]
        cur_batch.model_result[ui_id] = msg
        ui_target = "model_manager"
        cur_batch.stats[kind] = cur_batch.stats.get(kind, 0) + 1

        PromptServer.instance.send_sync(
            "cm-queue-status",
            {
                "status": "in_progress",
                "target": item[0],
                "batch_id": cur_batch.batch_id,
                "ui_target": ui_target,
                "total_count": cur_batch.total_count(),
                "done_count": cur_batch.done_count(),
            },
        )


async def _queue_install_model(json_data):
    if not _is_allowed_security_level("middle+"):
        return web.Response(status=403, text="Security level too high for model install.")

    install_item = json_data.get("ui_id"), json_data
    temp_queue_batch.append(("install-model", install_item))
    return web.Response(status=200)


def _register_routes():
    @routes.get("/v2/externalmodel/getlist")
    async def fetch_externalmodel_list(request):
        json_obj = await core.get_data_by_mode(
            request.rel_url.query["mode"], "model-list.json"
        )
        model_utils.check_model_installed(json_obj)
        for x in json_obj["models"]:
            _populate_markdown(x)
        return web.json_response(json_obj, content_type="application/json")

    @routes.post("/v2/manager/queue/batch")
    async def queue_batch(request):
        json_data = await request.json()
        failed = set()

        install_models = json_data.get("install_model")
        if install_models:
            for x in install_models:
                res = await _queue_install_model(x)
                if res.status != 200:
                    failed.add(x.get("id", x.get("ui_id", "unknown")))

        with task_worker_lock:
            _finalize_temp_queue_batch(json_data, failed)
            _queue_start()

        return web.json_response({"failed": list(failed)}, content_type="application/json")

    @routes.post("/v2/customnode/install/git_url")
    async def install_custom_node_git_url(request):
        if not _dedicated_install_allowed("allow_git_url_install"):
            logging.error(SECURITY_MESSAGE_FLAG_GIT_URL)
            return web.Response(status=403)

        url = await request.text()
        res = await core.gitclone_install(url)

        if res.action == "skip":
            logging.info(f"\nAlready installed: '{res.target}'")
            return web.Response(status=200)
        if res.result:
            logging.info("\nAfter restarting ComfyUI, please refresh the browser.")
            return web.Response(status=200)

        logging.error(res.msg)
        return web.Response(status=400)

    @routes.get("/v2/manager/bridge/api-keys")
    async def get_bridge_api_keys(request):
        return web.json_response(bridge_api_keys.get_status(), content_type="application/json")

    @routes.post("/v2/manager/bridge/api-keys")
    async def post_bridge_api_keys(request):
        if not _is_local_mode:
            return web.Response(
                status=403,
                text="API key updates are only allowed when ComfyUI listens on localhost.",
            )

        try:
            payload = await request.json()
            status = bridge_api_keys.update_keys(payload)
            return web.json_response(status, content_type="application/json")
        except ValueError as e:
            return web.json_response({"error": str(e)}, status=400, content_type="application/json")
        except Exception as e:
            logging.error(f"[Manager-Bridge] Failed to save API keys: {e}")
            return web.json_response({"error": "Failed to save API keys."}, status=500)

    @routes.get("/v2/manager/bridge/resolve-filename")
    async def resolve_bridge_filename(request):
        url = request.rel_url.query.get("url", "").strip()
        if not url:
            return web.json_response({"error": "Missing url parameter."}, status=400)

        filename = bridge_api_keys.resolve_download_filename(url)
        if not filename:
            return web.json_response({"filename": None}, content_type="application/json")

        return web.json_response({"filename": filename}, content_type="application/json")


def enable():
    global _enabled
    if _enabled:
        return
    _enabled = True
    _register_routes()
    logging.info("[ComfyUI-Manager-Bridge] Model Manager bridge routes enabled.")
