#!/usr/bin/env python3
"""ComfyUI-Manager install hook for Git URL installs."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from bridge_install import run_install_py


if __name__ == "__main__":
    raise SystemExit(run_install_py())
