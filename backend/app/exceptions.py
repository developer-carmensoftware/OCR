"""
Typed application exceptions.

Raise these instead of generic RuntimeError so the global handler
can map them to correct HTTP status codes.

HTTP mapping (see main.py):
  400  — bad user input (validation, missing fields)
  409  — conflict (duplicate document)
  402  — payment required (free quota exhausted, no top-up credits left)
  413  — payload too large (file size)
  422  — unprocessable entity (LLM parse error, post-process failure)
  429  — too many requests (quota or IP rate limit)
  500  — unexpected internal error (everything else, incl. programming bugs)
  503  — upstream service unavailable (LLM API down, Carmen unreachable)
"""


class LLMServiceError(RuntimeError):
    """LLM API call failed (network, auth, rate-limit). → 503"""


class LLMParseError(RuntimeError):
    """LLM returned content that could not be parsed as JSON. → 422"""


class ExtractionError(RuntimeError):
    """Document could not be processed (unsupported format, blank page). → 422"""


class DuplicateDocumentError(RuntimeError):
    """Document number already exists and overwrite was not requested. → 409"""


class CarmenServiceError(RuntimeError):
    """Carmen Cloud API call failed. → 503"""


class ValidationError(RuntimeError):
    """Request data failed business-level validation. → 400"""


class RateLimitExceeded(RuntimeError):
    """Business unit has exceeded its allocated LLM call quota. → 429"""

    def __init__(self, bu_name: str, limit: int):
        self.bu_name = bu_name
        self.limit = limit
        super().__init__(f"BU '{bu_name}' has exceeded its monthly quota of {limit} LLM calls.")


class InsufficientCredits(RuntimeError):
    """Free monthly quota exhausted and no top-up credits remain. → 402

    Distinct from RateLimitExceeded (429): this signals the tenant should buy a
    top-up credit pack, not that they are being throttled.
    """

    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id
        super().__init__(
            "Monthly free document quota exhausted and no top-up credits remain. "
            "Purchase a credit pack to continue."
        )


class RequestRateLimitExceeded(RuntimeError):
    """Caller has exceeded per-IP request rate limit. → 429

    Distinct from RateLimitExceeded (tenant quota) — this is short-window IP throttling.
    """

    def __init__(
        self, message: str = "Too many requests — please slow down.", retry_after: int = 60
    ):
        self.retry_after = retry_after
        super().__init__(message)


class FileTooLargeError(ValidationError):
    """Uploaded file exceeds the configured size limit. → 413"""


class TenantContextMissing(RuntimeError):
    """Programmer error — service called without tenant context being set.

    Raised by require_tenant() in app/context.py. Maps to 500 because the
    middleware/dependency should have established context before this point;
    reaching a service without it indicates a wiring bug, not user error.
    """
