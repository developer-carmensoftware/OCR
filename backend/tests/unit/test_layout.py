"""Architecture guards, checked by parsing app/ with ast rather than importing it.

Two of these rules are live today (nothing under app/services/ may import app/routers/).
The other two describe the domain-package layout the refactor (see
codebase-refactor-recursive-scroll.md) introduces from Phase 1 onward — until those
packages exist, the checks simply find no matching files and pass. They are written now
so the very first PR that creates app/services/shared/ or app/services/email_automation/
is already covered, instead of the guard arriving after the first violation could.
"""

import ast
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[2] / "app"

# The domain packages the refactor plan settles on for app/services/. Not all of these
# exist yet; a name with no matching directory contributes zero files to every check
# below, which is exactly the "not enforced until it exists" behaviour this file wants.
_DOMAINS = {"email_automation", "credit_card", "ap_invoice", "billing", "admin"}

# Carmen/LLM calls email_automation must route through the module, not a bound name —
# see "Patch ที่ค้างต้องพังเสียงดัง" in the refactor plan: a dry-run script (e.g.
# scripts/email_multibu_qa.py) stubs Carmen by patching the module attribute
# (`ingest.post_gljv = ...`), and a `from ...carmen import post_gljv` binding inside the
# package would silently escape that patch and post a real JV during a "dry run".
_MUST_STAY_QUALIFIED = {"post_gljv", "post_input_tax", "extract_stateless"}


def _py_files(*parts: str) -> list[Path]:
    root = APP.joinpath(*parts)
    return sorted(root.rglob("*.py")) if root.is_dir() else []


def _imported_modules(path: Path) -> list[tuple[str, list[str]]]:
    """[(dotted module, [imported names])] for every `from X import a, b` in the file."""
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    out = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            out.append((node.module, [a.name for a in node.names]))
    return out


@pytest.mark.parametrize("path", _py_files("services"), ids=lambda p: str(p.relative_to(APP)))
def test_services_never_import_routers(path: Path):
    """Layering (skill.md): Router -> Service -> data access, never the reverse."""
    for module, _names in _imported_modules(path):
        assert not module.startswith("app.routers"), (
            f"{path.relative_to(APP)} imports from {module} — a service importing a "
            "router inverts the Router -> Service dependency direction."
        )


@pytest.mark.parametrize(
    "path", _py_files("services", "shared"), ids=lambda p: str(p.relative_to(APP))
)
def test_shared_services_do_not_import_a_domain_package(path: Path):
    """services/shared/* is domain-agnostic by definition — every domain may depend on
    it, so it must never depend back on one, or the two become a cycle risk."""
    for module, _names in _imported_modules(path):
        for domain in _DOMAINS:
            assert not module.startswith(f"app.services.{domain}"), (
                f"{path.relative_to(APP)} imports from {module} — services/shared/ "
                f"must not depend on the '{domain}' domain package."
            )


@pytest.mark.parametrize(
    "path",
    _py_files("services", "email_automation"),
    ids=lambda p: str(p.relative_to(APP)),
)
def test_email_automation_keeps_carmen_and_ocr_calls_patchable(path: Path):
    """See _MUST_STAY_QUALIFIED above: these three names must be reached as
    `module.name(...)`, never bound directly via `from ... import name`."""
    for module, names in _imported_modules(path):
        bad = _MUST_STAY_QUALIFIED.intersection(names)
        assert not bad, (
            f"{path.relative_to(APP)} does `from {module} import {', '.join(sorted(bad))}` "
            f"— import the module instead and call {next(iter(bad))}(...) through it, so a "
            "dry-run script's patch on the module attribute cannot be silently bypassed."
        )
