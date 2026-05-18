# Contributing

## Setup

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt -r requirements-dev.txt

# Frontend
cd frontend
npm install --legacy-peer-deps
```

## Running locally

```bash
# Backend (http://localhost:8010)
cd backend && uvicorn app.main:app --reload --port 8010

# Frontend (http://localhost:3010)
cd frontend && npm run dev
```

## Before every commit (automated via pre-commit)

Pre-commit hooks run automatically on `git commit`. To run manually:

```bash
pre-commit run --all-files
```

Hooks check:
- **ruff** — Python lint + format
- **prettier** — JS/CSS format
- **trailing whitespace, end-of-file, large files, private keys**

## Running tests

```bash
# Backend
cd backend
pytest tests/ -q

# Backend with coverage report
pytest tests/ --cov=app --cov-report=term-missing

# Frontend
cd frontend
npm run test
```

## Branch strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready. CI must pass before merge. |
| `dev` | Integration branch for ongoing work. |
| `feat/...` | Feature branches — merge into `dev` via PR. |
| `fix/...` | Bug fix branches. |

## Commit conventions

```
feat: add new extraction field for branch number
fix: correct tax rounding in AP invoice postprocess
chore: update dependencies
ci: add Docker build step
docs: update CONTRIBUTING
```

## Pull request checklist

- [ ] `pre-commit run --all-files` passes
- [ ] `pytest tests/` passes locally
- [ ] New code has tests (especially for business logic in `services/` and `tools/`)
- [ ] No secrets committed (`.env` stays local)
- [ ] `mypy` warnings addressed for any new code in strict modules

## mypy strict modules

These modules are type-checked strictly (see `backend/pyproject.toml`):
- `app/tools/`
- `app/services/ap_invoice_postprocess_service.py`
- `app/auth/session.py`
- `app/exceptions.py`
- `app/constants.py`

When adding new modules, add them to `[[tool.mypy.overrides]]` in `pyproject.toml`.

## Deploy

```powershell
# Builds frontend + backend, generates IIS web.config, installs venv
.\deploy.ps1 -DeployPath "C:\inetpub\carmen_ai"
```

See [backend/scripts/](backend/scripts/) for DB backup scripts.
