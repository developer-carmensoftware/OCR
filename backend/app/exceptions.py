"""
Typed application exceptions.

Raise these instead of generic RuntimeError so the global handler
can map them to correct HTTP status codes.

HTTP mapping (see main.py):
  400  — bad user input (validation, missing fields)
  404  — requested resource does not exist
  409  — conflict (duplicate document, resource in the wrong state for this action)
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
    """LLM returned content that could not be parsed as JSON. → 422

    The default message is what the end user reads: `_error_response` puts
    `str(exc)` straight into the response `detail`, so a bare json.JSONDecodeError
    here surfaces as "Unterminated string starting at: line 34 column 22" on an
    accountant's screen.
    """

    def __init__(
        self,
        message: str = (
            "Could not read this document. Please try again, or upload a clearer photo or PDF."
        ),
    ):
        super().__init__(message)


class ModuleDisabled(RuntimeError):
    """This module has been turned off for the tenant by an admin. → 403

    Opt-out: enforced only when tenant_modules carries an explicit enabled=False
    row. No row means allowed — most tenants have never had a row written.
    """

    def __init__(self, module_id: str = ""):
        self.module_id = module_id
        super().__init__("This module is turned off for your account. Contact your administrator.")


class ExtractionError(RuntimeError):
    """Document could not be processed (unsupported format, blank page). → 422"""


class DuplicateDocumentError(RuntimeError):
    """Document number already exists and overwrite was not requested. → 409"""


class CarmenServiceError(RuntimeError):
    """Carmen Cloud API call failed. → 503"""


class ValidationError(RuntimeError):
    """Request data failed business-level validation. → 400"""


class NotFoundError(RuntimeError):
    """Requested resource does not exist (or is soft-deleted). → 404"""


class ConflictError(RuntimeError):
    """Resource is in a state that conflicts with the requested action. → 409"""


class RateLimitExceeded(RuntimeError):
    """Business unit has exceeded its allocated LLM call quota. → 429"""

    def __init__(self, bu_name: str, limit: int):
        self.bu_name = bu_name
        self.limit = limit
        super().__init__(f"BU '{bu_name}' has exceeded its monthly quota of {limit} LLM calls.")


class InsufficientCredits(RuntimeError):
    """Free trial quota exhausted and no top-up credits remain. → 402

    Distinct from RateLimitExceeded (429): this signals the tenant should buy a
    top-up credit pack, not that they are being throttled. The free quota is a
    one-time lifetime trial allowance, not a monthly reset.
    """

    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id
        super().__init__(
            "Free trial document quota exhausted and no top-up credits remain. "
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


class LLMCapacityError(RuntimeError):
    """All LLM key slots are saturated (in-flight) for longer than the configured
    max queue wait. → 429 + Retry-After.

    This is the safety valve at the very edge of the capacity envelope: under normal
    load the key pool has free slots and this is never raised. Distinct from
    RequestRateLimitExceeded (per-IP throttle) and RateLimitExceeded (tenant quota) —
    this signals the LLM concurrency pool itself is momentarily full.
    """

    def __init__(self, retry_after: int = 5):
        self.retry_after = retry_after
        super().__init__("Service is at capacity — please retry shortly.")


class FileTooLargeError(ValidationError):
    """Uploaded file exceeds the configured size limit. → 413"""


class PdfPasswordRequired(ValidationError):
    """PDF is encrypted and no correct password was supplied. → 400

    Carries a machine-readable ``code`` so the frontend can distinguish this
    from other validation errors and prompt the user for the PDF password.
    """

    code = "pdf_password_required"

    def __init__(self, message: str = "This PDF is password-protected. Please enter its password."):
        super().__init__(message)


class TenantContextMissing(RuntimeError):
    """Programmer error — service called without tenant context being set.

    Raised by require_tenant() in app/context.py. Maps to 500 because the
    middleware/dependency should have established context before this point;
    reaching a service without it indicates a wiring bug, not user error.
    """
