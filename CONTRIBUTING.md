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

Trunk-based: branch off `main`, open a PR, merge back into `main`. There is no long-lived
integration branch.

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready, and the only merge target. CI must pass; pushing here deploys. |
| `feat/...` | New capability. |
| `fix/...` | Bug fix. |
| `chore/...` `refactor/...` `test/...` `docs/...` | Housekeeping — no user-visible change. |
| `perf/...` `polish/...` | Faster, or better-looking, but the same behaviour. |

[`deploy.yml`](.github/workflows/deploy.yml) maps `dev` → staging and `main` → production.
`dev` does not currently exist; create it only if you actually want a staging deploy target,
and expect it to be short-lived.

## Commit conventions

```
feat: add new extraction field for branch number
fix: correct tax rounding in AP invoice postprocess
chore: update dependencies
ci: add Docker build step
docs: update CONTRIBUTING
```

## Pull request checklist

- [ ] New code has tests (especially for business logic in `services/`)
- [ ] No secrets committed (`.env` stays local)
- [ ] `changelog/<today>.md` updated — in the **same commit as the change**, not after CI complains

### What CI actually gates on

`pre-commit run --all-files` and `pytest tests/` are the fast local proxy, but
[`ci.yml`](.github/workflows/ci.yml) checks more than they do. Run the ones your change
touches before pushing — every item below fails the PR:

| Job | Fails on |
|-----|----------|
| Backend | `ruff check`, `ruff format --check`, **`mypy app/`**, **`bandit -c pyproject.toml -r app/ -ll`**, `pytest` + coverage |
| Frontend | `npm run lint`, `npm run format:check`, **`npm run type-check`** (tsc), `npm run test`, **`npm run build`** (vite) |
| Migrations | every `supabase/migrations/*.sql` applied to an ephemeral DB — a migration that only works against the current remote state fails here |
| Secret scan | `gitleaks` over the whole tree ([.gitleaks.toml](.gitleaks.toml)) |
| Changelog | the PR touches no file under `changelog/` (escape hatch: the `skip-changelog` label) |

## mypy strict modules

These modules are type-checked strictly — authoritative list in `[[tool.mypy.overrides]]` in [backend/pyproject.toml](backend/pyproject.toml):
`app/auth/session.py`, `app/exceptions.py`, `app/constants.py`, `app/context.py`, `app/config.py`, `app/llm/client.py`, `app/middleware/rate_limit.py`, `app/middleware/performance.py`, and services `ap_invoice_postprocess_service` / `usage_service` / `audit_service` / `llm_service`.

When adding new modules, add them to `[[tool.mypy.overrides]]` in `pyproject.toml`.

## Deploy

Push to `main` / `dev` → [.github/workflows/deploy.yml](.github/workflows/deploy.yml) applies DB migrations first (`supabase db push`), then fires the Render deploy hook. Render `autoDeploy` is intentionally off so code never ships ahead of its migration. Frontend deploys via Vercel.

For schema changes locally: `supabase migration new <name>` → write DDL → `supabase db push`.
