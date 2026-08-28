"""
Backward-compat re-export shim — Phase 10 will remove this file.

Import directly from the focused modules instead:
  pricing_cache_service  — get_pricing, estimate_cost, fetch_openrouter_pricing, list_model_pricing
  module_gate          — assert_module_enabled
  credit_service         — consume_document, refund_document (the document charge)
  llm_usage_logger       — log_llm_usage
"""

from app.services.llm_usage_logger import log_llm_usage as log_llm_usage
from app.services.module_gate import (
    _ctx as _ctx,
)
from app.services.module_gate import (
    assert_module_enabled as assert_module_enabled,
)
from app.services.pricing_cache_service import (
    _PRICING_CACHE as _PRICING_CACHE,
)
from app.services.pricing_cache_service import (
    _utcnow as _utcnow,
)
from app.services.pricing_cache_service import (
    estimate_cost as estimate_cost,
)
from app.services.pricing_cache_service import (
    fetch_openrouter_pricing as fetch_openrouter_pricing,
)
from app.services.pricing_cache_service import (
    get_pricing as get_pricing,
)
from app.services.pricing_cache_service import (
    list_model_pricing as list_model_pricing,
)
