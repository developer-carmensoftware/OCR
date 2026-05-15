"""Start the backend server with UTF-8 mode enabled (fixes Windows charmap errors)."""

import os
import subprocess
import sys

# PYTHONUTF8=1 is inherited by child processes (uvicorn --reload spawns a subprocess)
os.environ["PYTHONUTF8"] = "1"

sys.exit(
    subprocess.call(
        [
            sys.executable,
            "-X",
            "utf8",
            "-m",
            "uvicorn",
            "app.main:app",
            "--reload",
            "--port",
            "8010",
        ]
    )
)
