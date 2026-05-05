"""
Typed application exceptions.

Raise these instead of generic RuntimeError so the global handler
can map them to correct HTTP status codes.

HTTP mapping (see main.py):
  400  — bad user input (validation, missing fields)
  409  — conflict (duplicate document)
  422  — unprocessable entity (LLM parse error, post-process failure)
  503  — upstream service unavailable (LLM API down, Carmen unreachable)
  500  — unexpected internal error (everything else)
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
