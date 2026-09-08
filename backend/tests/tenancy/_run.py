"""Run the tenancy suite and print a clean per-test result table.

`pytest.ini` sets `--capture=no` (a Windows/anyio workaround), which drowns the summary
line in application logs. JUnit XML is read back instead — deterministic, and it gives the
report a per-test list rather than a count.
"""

import os
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent.parent
# Temp, not the package directory: this is a run artifact, and one written next to the
# tests is one somebody eventually commits.
XML = Path(tempfile.gettempdir()) / "carmen_ocr_tenancy_last_run.xml"


def main(argv):
    target = argv or ["tests/tenancy"]
    subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            *target,
            "-p",
            "no:cacheprovider",
            f"--junit-xml={XML}",
            "-q",
            "--tb=short",
        ],
        cwd=BACKEND,
        capture_output=True,
        text=True,
        errors="replace",
        env={**os.environ, "TENANCY_DB_TESTS": "1"},
    )
    if not XML.exists():
        print("no xml produced")
        return 1

    root = ET.parse(XML).getroot()
    suite = root if root.tag == "testsuite" else root.find("testsuite")
    bad = []
    for case in suite.iter("testcase"):
        problem = (
            case.find("failure")
            if case.find("failure") is not None
            else case.find("error")
            if case.find("error") is not None
            else None
        )
        name = f"{case.get('classname', '').split('.')[-1]}::{case.get('name')}"
        if problem is not None:
            bad.append((name, (problem.get("message") or "").strip().splitlines()[:4]))
        else:
            print(f"  PASS  {name}")

    for name, msg in bad:
        print(f"\n  FAIL  {name}")
        for line in msg:
            print(f"        {line[:160]}")

    print(
        f"\n  {suite.get('tests')} tests | {suite.get('failures')} failed | "
        f"{suite.get('errors')} errors | {suite.get('skipped')} skipped | "
        f"{float(suite.get('time', 0)):.1f}s"
    )
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
