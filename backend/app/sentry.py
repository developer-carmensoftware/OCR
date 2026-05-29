"""Sentry initialisation and capture helper — imported by lifecycle and factory."""

import logging

from app.config import settings

logger = logging.getLogger(__name__)


def init_sentry() -> None:
    if not settings.sentry_dsn:
        return
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        send_default_pii=False,
    )
    logger.info("Sentry initialised (env=%s)", settings.sentry_environment)


def capture(exc: Exception) -> None:
    if settings.sentry_dsn:
        import sentry_sdk

        sentry_sdk.capture_exception(exc)
